alter table public.wbs_nodes add column if not exists status text;
alter table public.wbs_nodes add constraint wbs_status_check check (
  status is null or status in ('pendiente', 'en_progreso', 'completado', 'retrasado', 'cancelado', 'en_pausa', 'en_revision')
);
