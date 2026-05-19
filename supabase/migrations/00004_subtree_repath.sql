create or replace function public.repath_subtree(old_path_prefix ltree, new_path_root ltree)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
  remaining int := 0;
begin
  if old_path_prefix is null or new_path_root is null then return; end if;

  loop
    select count(*) into remaining
    from public.wbs_nodes
    where path <@ old_path_prefix
      and path <> old_path_prefix;

    if remaining = 0 then exit; end if;

    for batch in
      select id, path
      from public.wbs_nodes
      where path <@ old_path_prefix
        and path <> old_path_prefix
      limit 200
    loop
      update public.wbs_nodes
      set path = new_path_root || subpath(batch.path, nlevel(old_path_prefix))
      where id = batch.id;
    end loop;

    if remaining <= 200 then exit; end if;
  end loop;
end;
$$;

create or replace function public.ensure_one_project_root()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count int;
begin
  if tg_op = 'UPDATE' then
    if new.parent_id is null and new.type = 'project' then
      select count(*) into existing_count
      from public.wbs_nodes
      where project_id = new.project_id
        and parent_id is null
        and type = 'project'
        and id <> new.id;

      if existing_count > 0 then
        raise exception 'El proyecto ya tiene un nodo raiz';
      end if;
    end if;

    if new.project_id is distinct from old.project_id then
      update public.wbs_nodes
      set project_id = new.project_id
      where path <@ old.path
        and id <> new.id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists wbs_ensure_one_project_root on public.wbs_nodes;
create trigger wbs_ensure_one_project_root before update on public.wbs_nodes
  for each row execute function public.ensure_one_project_root();
