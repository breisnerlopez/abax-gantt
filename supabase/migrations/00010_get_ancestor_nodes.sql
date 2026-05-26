-- Helper para que el backend recupere ancestros de un nodo en una sola query.
-- Lo usan api-wbs-schedule y api-wbs-move para devolver ancestros recalculados
-- por el trigger de rollup, de modo que el cliente no necesite hacer refetch.
create or replace function public.get_ancestor_nodes(node_path ltree, exclude_id uuid)
returns setof public.wbs_nodes
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.wbs_nodes
  where path @> node_path
    and id <> exclude_id
  order by nlevel(path);
$$;
