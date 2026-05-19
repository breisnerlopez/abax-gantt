create extension if not exists pgcrypto with schema extensions;
create extension if not exists ltree with schema public;

create type public.node_type as enum ('project', 'stage', 'group', 'task', 'milestone');
create type public.dep_type as enum ('FS', 'SS', 'FF', 'SF');
create type public.project_status as enum ('active', 'archived');
create type public.user_status as enum ('active', 'inactive', 'invited');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  avatar_url text,
  status public.user_status not null default 'invited',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#6366f1',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_types_name_not_blank check (length(btrim(name)) > 0),
  constraint project_types_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  project_type_id uuid references public.project_types(id) on delete set null,
  status public.project_status not null default 'active',
  autoscheduling_enabled boolean not null default true,
  budget_total numeric(12,2),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (length(btrim(name)) > 0),
  constraint projects_budget_non_negative check (budget_total is null or budget_total >= 0)
);

create table public.wbs_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.wbs_nodes(id) on delete cascade,
  name text not null,
  type public.node_type not null default 'task',
  description text,
  start_date date,
  end_date date,
  duration_days int generated always as (
    case
      when start_date is not null and end_date is not null and type <> 'milestone'
      then (end_date - start_date)::int
      else null
    end
  ) stored,
  progress real not null default 0,
  estimated_hours numeric(10,2),
  estimated_cost numeric(12,2),
  color text,
  sort_order int not null default 0,
  responsible_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  is_unscheduled boolean not null default true,
  is_collapsed boolean not null default false,
  path ltree not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wbs_name_not_blank check (length(btrim(name)) > 0),
  constraint wbs_progress_range check (progress >= 0 and progress <= 1),
  constraint wbs_estimated_hours_non_negative check (estimated_hours is null or estimated_hours >= 0),
  constraint wbs_estimated_cost_non_negative check (estimated_cost is null or estimated_cost >= 0),
  constraint wbs_dates_order check (start_date is null or end_date is null or end_date >= start_date),
  constraint wbs_milestone_single_date check (type <> 'milestone' or end_date is null or start_date = end_date),
  constraint wbs_color_hex check (color is null or color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index wbs_one_project_root_per_project on public.wbs_nodes(project_id) where parent_id is null and type = 'project';
create index idx_wbs_project on public.wbs_nodes(project_id);
create index idx_wbs_parent on public.wbs_nodes(parent_id);
create index idx_wbs_type on public.wbs_nodes(type);
create index idx_wbs_path on public.wbs_nodes using gist(path);
create index idx_wbs_responsible on public.wbs_nodes(responsible_id);
create index idx_wbs_unscheduled on public.wbs_nodes(project_id, is_unscheduled) where is_unscheduled = true;

create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_id uuid not null references public.wbs_nodes(id) on delete cascade,
  successor_id uuid not null references public.wbs_nodes(id) on delete cascade,
  type public.dep_type not null default 'FS',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint uq_dependency unique(predecessor_id, successor_id),
  constraint chk_no_self_dep check (predecessor_id <> successor_id)
);

create index idx_dep_predecessor on public.dependencies(predecessor_id);
create index idx_dep_successor on public.dependencies(successor_id);

create table public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wbs_nodes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint uq_task_assignee unique(task_id, user_id)
);

create index idx_assignee_user on public.task_assignees(user_id);
create index idx_assignee_task on public.task_assignees(task_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wbs_nodes(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  hours real not null check (hours > 0),
  notes text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_time_task on public.time_entries(task_id);
create index idx_time_user on public.time_entries(user_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size int not null check (file_size > 0 and file_size <= 5242880),
  mime_type text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint attachments_file_name_not_blank check (length(btrim(file_name)) > 0),
  constraint attachments_file_path_not_blank check (length(btrim(file_path)) > 0)
);

create index idx_attach_project on public.attachments(project_id);
