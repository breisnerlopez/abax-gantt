create or replace function public.enforce_dependency_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  predecessor_project uuid;
  successor_project uuid;
  creates_cycle boolean;
begin
  select project_id into predecessor_project from public.wbs_nodes where id = new.predecessor_id;
  select project_id into successor_project from public.wbs_nodes where id = new.successor_id;

  if predecessor_project is null or successor_project is null then
    raise exception 'La dependencia referencia nodos inexistentes';
  end if;

  if predecessor_project <> successor_project then
    raise exception 'La dependencia debe pertenecer al mismo proyecto';
  end if;

  with recursive reachable(node_id) as (
    select new.successor_id
    union
    select d.successor_id
    from public.dependencies d
    join reachable r on r.node_id = d.predecessor_id
    where d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  select exists(select 1 from reachable where node_id = new.predecessor_id) into creates_cycle;

  if creates_cycle then
    raise exception 'La dependencia crea un ciclo';
  end if;

  return new;
end;
$$;

create trigger dependencies_integrity before insert or update on public.dependencies for each row execute function public.enforce_dependency_integrity();
