# Manual de Importación — ABAX Gantt

La metodología usada para importar 99 proyectos, 1956 nodos y 150 dependencias desde OpenProject.

## 1. Preparar los datos fuente

Los datos deben estar en un JSON con esta estructura (`migration.json`):

```json
{
  "source": "OpenProject 15.5.0",
  "export_date": "2026-05-16",
  "users": [
    { "id": 1, "firstname": "Admin", "lastname": "Sistema", "mail": "admin@example.com" }
  ],
  "types": [
    { "id": 1, "name": "Task" },
    { "id": 2, "name": "Milestone" },
    { "id": 4, "name": "Feature" },
    { "id": 5, "name": "Epic" }
  ],
  "statuses": [],
  "projects": [
    { "id": 1, "name": "Proyecto A", "parent_id": null }
  ],
  "work_packages": [
    {
      "id": 100,
      "project_id": 1,
      "parent_id": null,
      "subject": "Tarea principal",
      "type_id": 1,
      "start_date": "2026-01-15",
      "due_date": "2026-02-28",
      "estimated_hours": 80,
      "done_ratio": 30
    }
  ],
  "relations": [
    { "id": 1, "relation_type": "follows", "from_id": 100, "to_id": 101 }
  ]
}
```

## 2. Convertir al formato ABAX

Ejecutar el conversor que mapea tipos y genera `abax-preview.json`:

```bash
npm run migration:openproject:write
```

Este comando:
- Lee `docs/imports/openproject-migration/gantt-export/migration.json`
- Mapea tipos OpenProject → ABAX (`Task` → `task`, `Milestone` → `milestone`, `Feature` → `group`)
- Convierte `done_ratio` (0-100) a `progress` (0.0-1.0)
- Genera UUIDs determinísticos desde los IDs originales
- Invierte relaciones `follows` → `FS`
- Escribe `docs/imports/openproject-migration/abax-preview.json`

## 3. Validar

```bash
npm run migration:openproject
```

Resultado esperado: `"issue_count": 0` (sin huérfanos ni referencias rotas).

## 4. Aplicar a la base de datos

```bash
npm run migration:openproject:apply
```

O manualmente con acceso a la DB:

```bash
docker run --rm --network infra-net \
  -v $(pwd):/workspace -w /workspace \
  -e DATABASE_URL='postgresql://abax:<password>@<host>:5432/abax_gantt' \
  denoland/deno:2.2.0 \
  deno run --no-lock --allow-read --allow-env --allow-net \
  tools/openproject-import.ts --apply
```

## 5. Verificar

```sql
-- Proyectos importados
SELECT count(*) FROM projects WHERE description LIKE 'OpenProject id=%';

-- Nodos importados
SELECT count(*) FROM wbs_nodes WHERE description LIKE 'OpenProject wp=%';

-- Dependencias importadas
SELECT count(*) FROM dependencies WHERE description LIKE 'OpenProject rel=%';
```

## 6. Para otras fuentes (no OpenProject)

Si los datos vienen de otra herramienta, preparar un JSON con este formato mínimo:

```json
{
  "rows": [
    { "name": "Proyecto", "project_id": "<uuid>", "type": "project" },
    { "name": "Etapa", "project_id": "<uuid>", "parent_id": "<uuid>", "type": "stage", "start_date": "2026-06-01", "end_date": "2026-06-15" },
    { "name": "Tarea", "project_id": "<uuid>", "parent_id": "<uuid>", "type": "task", "start_date": "2026-06-01", "end_date": "2026-06-05", "progress": 0.5, "estimated_hours": 40 }
  ]
}
```

Y enviar vía API:

```bash
curl -X POST https://demo.breisner.info/abax-gantt/api/import \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d @datos.json
```

**Importante:** importar en orden jerárquico (proyectos primero, luego etapas, luego tareas) porque `parent_id` referencia nodos ya existentes. El `path` ltree se calcula automáticamente al insertar.
