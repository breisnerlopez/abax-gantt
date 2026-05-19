create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger project_types_set_updated_at before update on public.project_types for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger wbs_nodes_set_updated_at before update on public.wbs_nodes for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Usuario'),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.make_wbs_label(node_id uuid)
returns text
language sql
immutable
strict
as $$
  select 'n_' || replace(node_id::text, '-', '_');
$$;

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = check_user_id and p.status = 'active'), false);
$$;

create or replace function public.can_manage_node(check_user_id uuid, node_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  is_admin boolean;
  node_path ltree;
begin
  if check_user_id is null or node_id is null then
    return false;
  end if;

  select public.is_admin(check_user_id) into is_admin;
  if coalesce(is_admin, false) then
    return true;
  end if;

  select wn.path into node_path from public.wbs_nodes wn where wn.id = node_id;
  if node_path is null then
    return false;
  end if;

  return exists (
    select 1
    from public.wbs_nodes ancestor
    where ancestor.path @> node_path
      and ancestor.responsible_id = check_user_id
  );
end;
$$;

create or replace function public.can_manage_project(check_user_id uuid, check_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_admin(check_user_id)
    or exists (
      select 1
      from public.wbs_nodes wn
      where wn.project_id = check_project_id
        and wn.parent_id is null
        and public.can_manage_node(check_user_id, wn.id)
    );
$$;

create or replace function public.effective_responsible(node_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select ancestor.responsible_id
  from public.wbs_nodes node
  join public.wbs_nodes ancestor on ancestor.path @> node.path
  where node.id = node_id
    and ancestor.responsible_id is not null
  order by nlevel(ancestor.path) desc
  limit 1;
$$;

create or replace function public.can_read_node(check_user_id uuid, node_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  is_admin boolean;
  node_path ltree;
begin
  if check_user_id is null or node_id is null then
    return false;
  end if;

  select public.is_admin(check_user_id) into is_admin;
  if coalesce(is_admin, false) then
    return true;
  end if;

  if public.can_manage_node(check_user_id, node_id) then
    return true;
  end if;

  select wn.path into node_path from public.wbs_nodes wn where wn.id = node_id;
  if node_path is null then
    return false;
  end if;

  return exists (
    select 1
    from public.wbs_nodes assigned
    join public.task_assignees ta on ta.task_id = assigned.id
    where ta.user_id = check_user_id
      and node_path @> assigned.path
  );
end;
$$;

create or replace function public.can_manage_dependency(check_user_id uuid, predecessor uuid, successor uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  is_admin boolean;
  predecessor_path ltree;
  successor_path ltree;
begin
  if check_user_id is null or predecessor is null or successor is null then
    return false;
  end if;

  select public.is_admin(check_user_id) into is_admin;
  if coalesce(is_admin, false) then
    return true;
  end if;

  select wn.path into predecessor_path from public.wbs_nodes wn where wn.id = predecessor;
  select wn.path into successor_path from public.wbs_nodes wn where wn.id = successor;
  if predecessor_path is null or successor_path is null then
    return false;
  end if;

  return exists (
    select 1
    from public.wbs_nodes ancestor
    where ancestor.path @> predecessor_path
      and ancestor.path @> successor_path
      and ancestor.responsible_id = check_user_id
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.project_types enable row level security;
alter table public.projects enable row level security;
alter table public.wbs_nodes enable row level security;
alter table public.dependencies enable row level security;
alter table public.task_assignees enable row level security;
alter table public.time_entries enable row level security;
alter table public.attachments enable row level security;

create policy profiles_select on public.profiles for select using (true);
create policy profiles_update_admin on public.profiles for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy project_types_select on public.project_types for select using (true);
create policy project_types_insert_admin on public.project_types for insert with check (public.is_admin(auth.uid()));
create policy project_types_update_admin on public.project_types for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy projects_select on public.projects for select using (
  public.can_manage_project(auth.uid(), id)
  or created_by = auth.uid()
  or exists (
    select 1 from public.wbs_nodes wn
    join public.task_assignees ta on ta.task_id = wn.id
    where wn.project_id = projects.id and ta.user_id = auth.uid()
  )
);
create policy projects_insert on public.projects for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy projects_update on public.projects for update using (public.can_manage_project(auth.uid(), id)) with check (public.can_manage_project(auth.uid(), id));

create policy wbs_select on public.wbs_nodes for select using (public.can_read_node(auth.uid(), id));
create policy wbs_insert on public.wbs_nodes for insert with check (
  (parent_id is null and type = 'project' and responsible_id = auth.uid() and created_by = auth.uid())
  or public.can_manage_node(auth.uid(), parent_id)
);
create policy wbs_update on public.wbs_nodes for update using (public.can_manage_node(auth.uid(), id)) with check (public.can_manage_node(auth.uid(), id));
create policy wbs_delete on public.wbs_nodes for delete using (public.can_manage_node(auth.uid(), coalesce(parent_id, id)));

create policy dependencies_select on public.dependencies for select using (public.can_read_node(auth.uid(), predecessor_id) or public.can_read_node(auth.uid(), successor_id));
create policy dependencies_insert on public.dependencies for insert with check (public.can_manage_dependency(auth.uid(), predecessor_id, successor_id));
create policy dependencies_delete on public.dependencies for delete using (public.can_manage_dependency(auth.uid(), predecessor_id, successor_id));

create policy task_assignees_select on public.task_assignees for select using (public.can_read_node(auth.uid(), task_id));
create policy task_assignees_insert on public.task_assignees for insert with check (public.can_manage_node(auth.uid(), task_id));
create policy task_assignees_delete on public.task_assignees for delete using (public.can_manage_node(auth.uid(), task_id));

create policy time_entries_select on public.time_entries for select using (user_id = auth.uid() or public.can_manage_node(auth.uid(), task_id));
create policy time_entries_insert on public.time_entries for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.task_assignees ta where ta.task_id = time_entries.task_id and ta.user_id = auth.uid())
);

create policy attachments_select on public.attachments for select using (public.can_manage_project(auth.uid(), project_id));
create policy attachments_insert on public.attachments for insert with check (uploaded_by = auth.uid() and public.can_manage_project(auth.uid(), project_id));
create policy attachments_delete on public.attachments for delete using (public.can_manage_project(auth.uid(), project_id));

create or replace function public.enforce_project_attachment_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.attachments where project_id = new.project_id) >= 5 then
    raise exception 'Un proyecto no puede tener mas de 5 adjuntos';
  end if;
  return new;
end;
$$;

create trigger attachments_project_limit before insert on public.attachments for each row execute function public.enforce_project_attachment_limit();
