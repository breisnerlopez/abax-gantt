alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();

alter table public.profiles add column if not exists authentik_sub text;
alter table public.profiles add constraint profiles_authentik_sub_unique unique (authentik_sub);

update public.profiles
set authentik_sub = coalesce(authentik_sub, id::text)
where authentik_sub is null;

alter table public.profiles alter column authentik_sub set not null;

alter table public.profiles disable row level security;
alter table public.project_types disable row level security;
alter table public.projects disable row level security;
alter table public.wbs_nodes disable row level security;
alter table public.dependencies disable row level security;
alter table public.task_assignees disable row level security;
alter table public.time_entries disable row level security;
alter table public.attachments disable row level security;
