-- ================================================================
-- 00011_teams.sql — Rediseño Fase 9 (handoff §5.2 + §6)
-- Introduce el modelo de "equipos" para que el portfolio pueda
-- agrupar proyectos por equipo (cabeceras sintéticas).
-- ================================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text not null default '#6366f1',
  lead_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_not_blank check (length(btrim(name)) > 0),
  constraint teams_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create unique index teams_name_unique_active on public.teams(lower(name)) where is_active;
create index idx_teams_lead on public.teams(lead_id);

-- ----------------------------------------------------------------
-- projects: nueva FK a teams.
-- ----------------------------------------------------------------
alter table public.projects
  add column team_id uuid references public.teams(id) on delete set null;

create index idx_projects_team on public.projects(team_id);

-- ----------------------------------------------------------------
-- RLS — mismo patrón que project_types: lectura libre, escritura admin.
-- ----------------------------------------------------------------
alter table public.teams enable row level security;

create policy teams_select on public.teams
  for select using (true);

create policy teams_insert_admin on public.teams
  for insert with check (public.is_admin(auth.uid()));

create policy teams_update_admin on public.teams
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- (No exponemos DELETE — se desactiva con is_active=false para preservar referencias.)
