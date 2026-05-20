# Revisión y Carga de Migración OpenProject

Fuente descifrada desde FerriShare: `openproject-migration.tar.gz`.

Estado: importado en `abax_gantt` el 2026-05-19.
Limpieza posterior: eliminados 17 proyectos no migrados para dejar solo datos OpenProject.

## Contenido Migrado al Workspace

| Archivo | Uso |
|---------|-----|
| `MIGRATE.md` | Descripción original del paquete y lista completa de proyectos |
| `gantt-export/migration.json` | Dataset completo correlacionado |
| `gantt-export/*.csv` | Exportaciones tabulares para revisión manual |
| `abax-preview.json` | Vista previa convertida al modelo ABAX Gantt |
| `tools/openproject-migration.mjs` | Validador/conversor reproducible |
| `tools/openproject-import.ts` | Importador idempotente hacia PostgreSQL |

## Resumen de Datos

| Métrica | Valor |
|---------|------:|
| Proyectos | 99 |
| Proyectos activos | 97 |
| Proyectos archivados | 2 |
| Work packages | 1857 |
| Work packages con fechas | 1717 |
| Work packages sin fechas | 140 |
| Work packages asignados | 113 |
| Work packages sin asignar | 1744 |
| Work packages cerrados | 1166 |
| Work packages abiertos | 691 |
| Dependencias | 150 |
| Usuarios | 27 |
| Rango de fechas | 2025-04-09 a 2027-01-05 |

## Tipos OpenProject

| Tipo | Cantidad | Mapeo ABAX |
|------|---------:|------------|
| Task | 1300 | `task` |
| Summary task | 144 | `group` |
| Feature | 245 | `group` |
| Epic | 52 | `group` |
| User story | 113 | `task` |
| Bug | 1 | `task` |
| Milestone | 2 | `milestone` |

## Mapeo Aplicado en `abax-preview.json`

| OpenProject | ABAX Gantt |
|-------------|------------|
| `projects` | `projects` |
| Cada `project` | Nodo raíz tipo `project` |
| `work_packages` | `wbs_nodes` |
| `start_date` | `start_date` |
| `due_date` | `end_date` |
| `done_ratio` | `progress` dividido entre 100 |
| `estimated_hours` | `estimated_hours` |
| `assigned_to_id` | Conservado como `source_assigned_to_id` para revisión |
| `relations.follows` | Dependencia `FS`, invirtiendo dirección predecessor/successor |

El preview usa UUIDs determinísticos generados desde los IDs de OpenProject. Esto permite repetir conversiones sin cambiar IDs mientras se revisa la estrategia final.

## Validación Ejecutada

Comando:

```bash
npm run migration:openproject:write
```

Resultado:

```json
{
  "issue_count": 0,
  "project_parent_orphans": [],
  "work_package_project_orphans": [],
  "work_package_parent_orphans": [],
  "work_package_type_orphans": [],
  "work_package_status_orphans": [],
  "work_package_assignee_orphans": [],
  "relation_orphans": []
}
```

## Carga Ejecutada

La carga fue aplicada contra PostgreSQL `abax_gantt` en `<postgres-host>` usando la red Docker `infra-net`.

Comando operativo usado:

```bash
docker run --rm --network infra-net \
  -v /workspace/abax-gantt:/workspace \
  -w /workspace \
  -e DATABASE_URL='postgresql://abax:<password>@<host>:5432/abax_gantt' \
  denoland/deno:2.2.0 \
  deno run --no-lock --allow-read --allow-env --allow-net tools/openproject-import.ts --apply
```

Resultado reportado por el importador:

```json
{
  "imported": {
    "projects": 99,
    "nodes": 1956,
    "dependencies": 150,
    "assignees": 113
  }
}
```

Verificación SQL ejecutada:

```sql
select
  (select count(*) from projects where description like 'OpenProject id=%') as imported_projects,
  (select count(*) from wbs_nodes where description like 'OpenProject wp=%') as imported_work_packages,
  (select count(*) from wbs_nodes where type='project' and project_id in (select id from projects where description like 'OpenProject id=%')) as imported_roots,
  (select count(*) from task_assignees ta join wbs_nodes wn on wn.id=ta.task_id where wn.description like 'OpenProject wp=%') as imported_assignees;
```

Resultado:

| Métrica | Valor |
|---------|------:|
| Proyectos importados | 99 |
| Work packages importados | 1857 |
| Nodos raíz importados | 99 |
| Asignaciones importadas | 113 |

Limpieza posterior ejecutada:

```sql
delete from projects
where description is null
   or description not like 'OpenProject id=%';
```

Resultado posterior:

| Métrica | Valor |
|---------|------:|
| Proyectos totales | 99 |
| Proyectos OpenProject | 99 |
| Proyectos no migrados | 0 |
| Nodos totales | 1956 |
| Dependencias totales | 150 |
| Asignaciones totales | 113 |
| Time entries totales | 0 |
| Adjuntos totales | 0 |

Health posterior a la carga:

```bash
curl -fsS https://demo.breisner.info/abax-gantt/api/health
```

Respuesta OK: `{"status":"ok","db":"connected"}`.

## Notas Post-Importación

- La importación es idempotente: usa UUIDs determinísticos y `ON CONFLICT`, por lo que puede repetirse sin duplicar proyectos/nodos/dependencias.
- Se normalizó la visualización del Gantt: los `path` importados ahora usan IDs OpenProject (`p_00000007.w_00000159...`) en vez de UUIDs, para que `ORDER BY path` respete jerarquía y orden natural.
- Se calcularon fechas agregadas para nodos padre y raíces de proyecto a partir de sus descendientes fechados. Esto evita que DHTMLX oculte padres y deje tareas hijas sueltas en la raíz.
- El dump incluye emails y nombres de usuarios de aplicación. El usuario confirmó que no es data sensible.
- Solo 113 de 1857 work packages tienen asignado. No asumir que los usuarios cubren todo el portafolio.
- ABAX Gantt no tiene jerarquía nativa entre proyectos; la jerarquía de `projects.parent_id` queda preservada como metadata en el preview, pero debe decidirse si se representa como tipos, carpetas o proyectos independientes.
- Todas las relaciones vienen como `follows`; se mapearon a `FS` invirtiendo dirección. Debe revisarse visualmente en una muestra antes de carga masiva.

## Plan de Pruebas Recomendado

1. Revisar `abax-preview.json` y confirmar mapeo de tipos.
2. Seleccionar 3 proyectos representativos: uno pequeño, uno con jerarquía profunda y uno con dependencias.
3. Validar en UI: árbol WBS, fechas, barras, progreso y dependencias.
4. Medir rendimiento con 99 proyectos y 1956 nodos totales incluyendo raíces.
5. Revisar si la jerarquía de proyectos debe exponerse en UI como agrupador o filtro.

## Comandos Útiles

Validar sin regenerar preview:

```bash
npm run migration:openproject
```

Validar y regenerar `abax-preview.json`:

```bash
npm run migration:openproject:write
```

Aplicar importación desde un entorno con acceso a `DATABASE_URL`:

```bash
npm run migration:openproject:apply
```

Verificar que no queden hijos fechados con padres ocultos:

```sql
select count(*)
from wbs_nodes child
join wbs_nodes parent on parent.id = child.parent_id
where child.project_id in (select id from projects where description like 'OpenProject id=%')
  and child.start_date is not null
  and (parent.start_date is null or parent.is_unscheduled = true);
```

Resultado esperado: `0`.
