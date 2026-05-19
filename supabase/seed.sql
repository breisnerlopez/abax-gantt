insert into public.project_types (name, description, color)
values
  ('Desarrollo', 'Proyectos de software y producto digital', '#2563eb'),
  ('Operaciones', 'Mejoras operativas y procesos internos', '#16a34a'),
  ('Infraestructura', 'Infraestructura fisica o tecnologica', '#ea580c')
on conflict do nothing;

insert into public.profiles (id, authentik_sub, email, full_name, status, is_admin)
values
  ('10000000-0000-0000-0000-000000000001', 'demo-admin', 'admin.demo@abax.local', 'Admin Demo', 'active', true),
  ('10000000-0000-0000-0000-000000000002', 'demo-responsable', 'responsable.demo@abax.local', 'Responsable Demo', 'active', false),
  ('10000000-0000-0000-0000-000000000003', 'demo-ejecutor', 'ejecutor.demo@abax.local', 'Ejecutor Demo', 'active', false)
on conflict (authentik_sub) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  status = excluded.status,
  is_admin = excluded.is_admin;

insert into public.projects (id, name, description, status, budget_total, created_by)
values (
  '20000000-0000-0000-0000-000000000001',
  'Demo ABAX Gantt',
  'Proyecto semilla para smoke demo del MVP',
  'active',
  250000,
  '10000000-0000-0000-0000-000000000001'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  budget_total = excluded.budget_total;

insert into public.wbs_nodes (id, project_id, parent_id, name, type, description, start_date, end_date, progress, estimated_hours, estimated_cost, sort_order, responsible_id, created_by, is_unscheduled, path)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, 'Demo ABAX Gantt', 'project', 'Raiz del proyecto demo', '2026-05-18', '2026-06-12', 0.35, 160, 120000, 0, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false, 'n_30000000_0000_0000_0000_000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Planeacion', 'stage', 'Alcance y estructura base', '2026-05-18', '2026-05-24', 0.8, 32, 18000, 1, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false, 'n_30000000_0000_0000_0000_000000000001.n_30000000_0000_0000_0000_000000000002'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Levantamiento WBS', 'task', 'Definir entregables y responsables', '2026-05-18', '2026-05-21', 1, 16, 9000, 1, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false, 'n_30000000_0000_0000_0000_000000000001.n_30000000_0000_0000_0000_000000000002.n_30000000_0000_0000_0000_000000000003'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Ejecucion', 'stage', 'Construccion del plan operativo', '2026-05-25', '2026-06-12', 0.2, 96, 76000, 2, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false, 'n_30000000_0000_0000_0000_000000000001.n_30000000_0000_0000_0000_000000000004'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Configurar integracion Authentik', 'task', 'Smoke de permisos y sesion', '2026-05-25', '2026-05-29', 0.35, 24, 16000, 1, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', false, 'n_30000000_0000_0000_0000_000000000001.n_30000000_0000_0000_0000_000000000004.n_30000000_0000_0000_0000_000000000005'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Checklist de demo', 'task', 'Elemento intencionalmente sin fechas para backlog', null, null, 0, 8, 5000, 2, null, '10000000-0000-0000-0000-000000000001', true, 'n_30000000_0000_0000_0000_000000000001.n_30000000_0000_0000_0000_000000000004.n_30000000_0000_0000_0000_000000000006')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  progress = excluded.progress,
  estimated_hours = excluded.estimated_hours,
  estimated_cost = excluded.estimated_cost,
  sort_order = excluded.sort_order,
  responsible_id = excluded.responsible_id,
  is_unscheduled = excluded.is_unscheduled,
  path = excluded.path;

insert into public.dependencies (id, predecessor_id, successor_id, type, created_by)
values (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000005',
  'FS',
  '10000000-0000-0000-0000-000000000001'
)
on conflict (predecessor_id, successor_id) do update set type = excluded.type;

insert into public.task_assignees (id, task_id, user_id, assigned_by)
values (
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001'
)
on conflict (task_id, user_id) do nothing;
