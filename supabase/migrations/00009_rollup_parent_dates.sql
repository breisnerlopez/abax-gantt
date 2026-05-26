-- Roll-up automatico de fechas: padres (project, stage, group) derivan
-- start_date = MIN(hijos.start_date) y end_date = MAX(hijos.end_date),
-- ignorando hijos con is_unscheduled = true o sin start_date.
--
-- Reglas de diseno:
--   * task y milestone NUNCA se recalculan (tienen fechas propias).
--   * Si un padre se queda sin hijos programados, queda con fechas null
--     y is_unscheduled = true.
--   * El trigger es AFTER y usa pg_trigger_depth() para evitar recursion:
--     el UPDATE recursivo del padre dispara el trigger otra vez, pero la
--     llamada anidada retorna inmediatamente. El loop manual del trigger
--     externo se encarga de subir hasta la raiz.
--   * Si cambia parent_id, recalcula el padre VIEJO y el NUEVO.

create or replace function public.recalc_node_dates(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_type public.node_type;
  current_start date;
  current_end date;
  current_unscheduled boolean;
  new_start date;
  new_end date;
begin
  select type, start_date, end_date, is_unscheduled
  into target_type, current_start, current_end, current_unscheduled
  from public.wbs_nodes
  where id = target_id;

  if target_type is null then return; end if;
  if target_type not in ('project', 'stage', 'group') then return; end if;

  select min(start_date), max(end_date)
  into new_start, new_end
  from public.wbs_nodes
  where parent_id = target_id
    and is_unscheduled = false
    and start_date is not null;

  -- end_date no puede ser null si start_date no lo es (constraint del schema).
  if new_start is not null and new_end is null then
    new_end := new_start;
  end if;

  if current_start is distinct from new_start
     or current_end is distinct from new_end
     or current_unscheduled is distinct from (new_start is null) then
    update public.wbs_nodes
    set start_date = new_start,
        end_date = new_end,
        is_unscheduled = (new_start is null),
        updated_at = now()
    where id = target_id;
  end if;
end;
$$;

create or replace function public.rollup_dates_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ancestor_id uuid;
  iter int := 0;
begin
  -- Anti-recursion: si estamos dentro de un recalculo propio, salir.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  -- En UPDATE, salir temprano si los campos relevantes no cambiaron.
  if tg_op = 'UPDATE'
     and new.start_date is not distinct from old.start_date
     and new.end_date is not distinct from old.end_date
     and new.parent_id is not distinct from old.parent_id
     and new.is_unscheduled is not distinct from old.is_unscheduled then
    return null;
  end if;

  -- Si cambio el padre, recalcular el padre VIEJO antes que el nuevo.
  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
    ancestor_id := old.parent_id;
    iter := 0;
    while ancestor_id is not null and iter < 50 loop
      perform public.recalc_node_dates(ancestor_id);
      select parent_id into ancestor_id from public.wbs_nodes where id = ancestor_id;
      iter := iter + 1;
    end loop;
  end if;

  -- Padre del nodo en su estado actual: NEW para INSERT/UPDATE, OLD para DELETE.
  if tg_op = 'DELETE' then
    ancestor_id := old.parent_id;
  else
    ancestor_id := new.parent_id;
  end if;

  iter := 0;
  while ancestor_id is not null and iter < 50 loop
    perform public.recalc_node_dates(ancestor_id);
    select parent_id into ancestor_id from public.wbs_nodes where id = ancestor_id;
    iter := iter + 1;
  end loop;

  return null;
end;
$$;

drop trigger if exists wbs_rollup_dates on public.wbs_nodes;
create trigger wbs_rollup_dates
after insert or update or delete on public.wbs_nodes
for each row execute function public.rollup_dates_on_change();

-- Backfill: recalcular todos los contenedores que ya existan, partiendo desde las hojas.
-- Recorremos por nlevel(path) descendente para que cuando recalculamos un padre,
-- sus hijos contenedores (stage/group) ya esten con fechas correctas.
do $$
declare
  rec record;
begin
  for rec in
    select id
    from public.wbs_nodes
    where type in ('project', 'stage', 'group')
    order by nlevel(path) desc
  loop
    perform public.recalc_node_dates(rec.id);
  end loop;
end;
$$;
