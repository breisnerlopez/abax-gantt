# API de Abax Gantt — Referencia Completa

**URL base:** `https://<project-ref>.supabase.co/functions/v1`

Todas las respuestas de error siguen el formato:

```json
{ "error": "mensaje descriptivo" }
```

Todas las respuestas exitosas de colección siguen el formato:

```json
{ "data": [...], "count": N }
```

---

## Autenticación

Todos los endpoints (excepto `/api-debug` y ciertas rutas MCP) requieren autenticación mediante Bearer token JWT emitido por Authentik.

```
Authorization: Bearer <jwt-token>
```

**Errores de autenticación:**

| Código | Significado |
|--------|-------------|
| 401    | Token requerido o inválido |
| 403    | Sin permiso sobre el recurso / usuario inactivo |

---

## 1. Proyectos

### `GET /api-projects`

Lista todos los proyectos visibles para el usuario autenticado. Los administradores ven todos; los usuarios regulares ven los que crearon, los que tienen asignaciones, o los que pueden gestionar.

**Auth:** Bearer token

**Parámetros:** Ninguno

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Proyecto Alpha",
      "description": "...",
      "project_type_id": "uuid",
      "autoscheduling_enabled": true,
      "budget_total": 100000,
      "status": "active",
      "created_by": "uuid",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z",
      "project_types": {
        "id": "uuid",
        "name": "Construcción",
        "color": "#6366f1"
      }
    }
  ],
  "count": 1
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-projects \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api-projects`

Crea un proyecto nuevo junto con su nodo raíz WBS.

**Auth:** Bearer token

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | Sí | Nombre del proyecto (máx. 300) |
| `description` | string | No | Descripción (máx. 2000) |
| `project_type_id` | UUID | No | ID del tipo de proyecto |
| `autoscheduling_enabled` | boolean | No | Activar auto-planificación (default: `true`) |
| `budget_total` | number | No | Presupuesto total (default: `0`) |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "name": "Proyecto Alpha",
    "description": "...",
    "project_type_id": "uuid",
    "autoscheduling_enabled": true,
    "budget_total": 100000,
    "created_by": "uuid",
    "created_at": "...",
    "root_node": {
      "id": "uuid",
      "project_id": "uuid",
      "parent_id": null,
      "name": "Proyecto Alpha",
      "type": "project",
      "responsible_id": "uuid",
      "created_by": "uuid",
      "is_unscheduled": false,
      "path": "n_<uuid>"
    }
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-projects \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nuevo Proyecto","budget_total":50000}'
```

**Errores:** 400 (datos inválidos), 401, 403

---

## 2. WBS (Estructura de Desglose de Trabajo)

### `GET /api-wbs`

Lista los nodos WBS visibles para el usuario. Si el usuario no es admin, solo ve proyectos creados por el usuario, proyectos donde gestiona nodos o proyectos donde tiene tareas asignadas.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `project_id` | UUID | Filtrar por proyecto |
| `include_context` | `"true"` / `"false"` | Con `project_id`, devuelve el árbol completo del proyecto visible |
| `project_type_id` | UUID | Filtrar por tipo de proyecto |
| `responsible_id` | UUID | Filtrar nodos por responsable directo |
| `assignee_id` | UUID | Filtrar tareas asignadas a un usuario |
| `my_tasks` | `"true"` / `"false"` | Devuelve tareas asignadas al usuario autenticado e incluye ancestros para contexto visual |
| `status` | string | `pendiente`, `en_progreso`, `completado`, `retrasado` |
| `date_from` | date | Incluye nodos cuyo `end_date >= date_from` |
| `date_to` | date | Incluye nodos cuyo `start_date <= date_to` |
| `search` | string | Busca por `name` o `description` con coincidencia parcial case-insensitive |
| `unscheduled` | `"true"` / `"false"` | Filtrar por estado no programado |

**Contrato de `status`:**

| Valor | Regla backend |
|---|---|
| `completado` | `progress >= 1` |
| `retrasado` | `end_date < hoy` y `progress < 1` |
| `en_progreso` | `0 < progress < 1` y no esta retrasado |
| `pendiente` | `progress = 0` y no esta retrasado |

El frontend actual no define un enum propio para status de tarea; por contrato debe usar exactamente estos valores al llamar a `api-wbs`.

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "parent_id": "uuid",
      "name": "Tarea 1",
      "type": "task",
      "description": "...",
      "start_date": "2026-06-01",
      "end_date": "2026-06-15",
      "duration_days": 14,
      "progress": 0.5,
      "estimated_hours": 40,
      "estimated_cost": 2000,
      "color": "#22c55e",
      "sort_order": 0,
      "responsible_id": "uuid",
      "is_unscheduled": false,
      "is_collapsed": false,
      "path": "n_<root>.n_<parent>.n_<self>",
      "created_by": "uuid",
      "created_at": "...",
      "updated_at": "...",
      "task_assignees": [
        {
          "user_id": "uuid",
          "profiles": {
            "full_name": "Juan Pérez",
            "avatar_url": "..."
          }
        }
      ]
    }
  ],
  "count": 5
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-wbs?project_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"

# Mis tareas con contexto visual
curl -s "https://<ref>.supabase.co/functions/v1/api-wbs?my_tasks=true" \
  -H "Authorization: Bearer $TOKEN"

# Filtros combinados
curl -s "https://<ref>.supabase.co/functions/v1/api-wbs?project_id=<uuid>&status=retrasado&search=diseño" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api-wbs`

Crea un nodo WBS hijo debajo de un nodo padre existente.

**Auth:** Bearer token (requiere permiso `can_manage_node` sobre el padre)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `parent_id` | UUID | Sí | ID del nodo padre |
| `name` | string | Sí | Nombre del nodo (máx. 300) |
| `type` | string | No | `"task"`, `"milestone"`, `"stage"`, `"group"` (default: `"task"`) |
| `description` | string | No | Descripción (máx. 2000) |
| `start_date` | string | No | Fecha inicio `YYYY-MM-DD` |
| `end_date` | string | No | Fecha fin `YYYY-MM-DD` (default: `start_date`) |
| `progress` | number | No | Avance 0–1 (default: `0`) |
| `estimated_hours` | number | No | Horas estimadas (default: `0`) |
| `estimated_cost` | number | No | Costo estimado (default: `0`) |
| `color` | string | No | Color hexadecimal `#RRGGBB` |
| `sort_order` | number | No | Orden (default: `0`) |
| `responsible_id` | UUID | No | ID del responsable |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "parent_id": "uuid",
    "name": "Nueva Tarea",
    "type": "task",
    "start_date": "2026-06-01",
    "end_date": "2026-06-15",
    "progress": 0,
    "estimated_hours": 40,
    "estimated_cost": 2000,
    "color": "#22c55e",
    "sort_order": 0,
    "responsible_id": "uuid",
    "created_by": "uuid",
    "is_unscheduled": false,
    "path": "n_<parent>.n_<self>"
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-wbs \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parent_id":"<uuid>","name":"Diseño preliminar","type":"task","start_date":"2026-06-01","end_date":"2026-06-15","estimated_hours":40}'
```

**Errores:** 400 (datos inválidos), 401, 403, 404 (padre no encontrado)

---

### `GET /api-wbs-node/<id>`

Obtiene un nodo WBS individual con sus asignaciones.

**Auth:** Bearer token (requiere acceso de lectura al nodo)

**Respuesta:**

```json
{
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "parent_id": "uuid",
    "name": "Tarea 1",
    "type": "task",
    "description": "...",
    "start_date": "2026-06-01",
    "end_date": "2026-06-15",
    "duration_days": 14,
    "progress": 0.5,
    "estimated_hours": 40,
    "estimated_cost": 2000,
    "color": "#22c55e",
    "sort_order": 0,
    "responsible_id": "uuid",
    "is_unscheduled": false,
    "is_collapsed": false,
    "path": "n_<root>.n_<self>",
    "task_assignees": [...]
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-node/<id> \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 400 (id inválido), 401, 403, 404

---

### `PUT / PATCH /api-wbs-node/<id>`

Actualiza un nodo WBS existente.

**Auth:** Bearer token (requiere `can_manage_node`)

**Body (JSON):** Todos los campos son opcionales; solo se actualizan los enviados.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre (máx. 300) |
| `description` | string | Descripción (máx. 2000) |
| `start_date` | string | `YYYY-MM-DD` |
| `end_date` | string | `YYYY-MM-DD` |
| `progress` | number | 0–1 |
| `estimated_hours` | number | ≥ 0 |
| `estimated_cost` | number | ≥ 0 |
| `color` | string | `#RRGGBB` |
| `sort_order` | number | Orden |
| `responsible_id` | UUID | Responsable |
| `is_collapsed` | boolean | Colapsado en UI |

**Nota:** Si `start_date` se envía como `null`, el nodo se marca como `is_unscheduled = true`. Si se actualiza el nombre de un nodo tipo `project`, también se actualiza el nombre en la tabla `projects`.

**Respuesta:**

```json
{
  "data": { ...nodo actualizado }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-node/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"progress":0.75,"estimated_hours":60}'
```

**Errores:** 400 (sin campos para actualizar), 401, 403, 404

---

### `DELETE /api-wbs-node/<id>`

Elimina un nodo WBS.

**Auth:** Bearer token (requiere `can_manage_node`)

**Respuesta:**

```json
{
  "data": { "id": "uuid" }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-node/<id> \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 400, 401, 403, 404

---

### `PATCH / PUT /api-wbs-move/<id>`

Mueve un nodo WBS a otro padre y/o cambia su orden.

**Auth:** Bearer token (requiere `can_manage_node` sobre el nodo y el nuevo padre)

**Body (JSON):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `parent_id` | UUID | ID del nuevo padre (no puede ser el mismo nodo ni un descendiente) |
| `sort_order` | number | Nuevo orden |

**Respuesta:**

```json
{
  "data": { ...nodo con nueva ubicación }
}
```

**Respuesta con warning de dependencia (409):**

```json
{
  "data": null,
  "warnings": [
    {
      "code": "DEPENDENCY_VIOLATION",
      "message": "No se puede mover a otro proyecto con dependencias existentes",
      "dependency_id": "uuid"
    }
  ]
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-move/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parent_id":"<new-parent-uuid>","sort_order":3}'
```

**Errores:** 400 (auto-referencia, movimiento a descendiente, demasiados nodos), 401, 403, 404, 409 (warning estructurado por dependencias)

---

## 3. Dependencias

### `GET /api-dependencies`

Lista dependencias. Opcionalmente filtradas por proyecto.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `project_id` | UUID | Filtrar dependencias cuyos nodos pertenecen al proyecto |

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "predecessor_id": "uuid",
      "successor_id": "uuid",
      "type": "FS",
      "created_by": "uuid",
      "created_at": "..."
    }
  ],
  "count": 3
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-dependencies?project_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api-dependencies`

Crea una dependencia entre dos nodos WBS.

**Auth:** Bearer token (requiere `can_manage_dependency`)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `predecessor_id` | UUID | Sí | Nodo predecesor |
| `successor_id` | UUID | Sí | Nodo sucesor |
| `type` | string | No | Tipo: `"FS"` (Fin→Inicio), `"SS"`, `"FF"`, `"SF"` (default: `"FS"`) |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "predecessor_id": "uuid",
    "successor_id": "uuid",
    "type": "FS",
    "created_by": "uuid",
    "created_at": "..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-dependencies \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"predecessor_id":"<uuid>","successor_id":"<uuid>","type":"FS"}'
```

**Errores:** 400, 401, 403

---

### `DELETE /api-dependency/<id>`

Elimina una dependencia.

**Auth:** Bearer token (requiere `can_manage_dependency`)

**Respuesta:**

```json
{
  "data": { "id": "uuid" }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-dependency/<id> \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 400, 401, 403, 404

---

## 4. Asignaciones (Assignees)

### `GET /api-assignees`

Lista las asignaciones de una tarea.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `task_id` | UUID | Sí | ID del nodo WBS |

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "user_id": "uuid",
      "assigned_by": "uuid",
      "created_at": "...",
      "profiles": {
        "id": "uuid",
        "full_name": "Juan Pérez",
        "email": "juan@example.com",
        "avatar_url": "...",
        "status": "active"
      }
    }
  ],
  "count": 2
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-assignees?task_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api-assignees`

Asigna un usuario a una tarea.

**Auth:** Bearer token (requiere `can_manage_node` sobre la tarea)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `task_id` | UUID | Sí | ID del nodo WBS |
| `user_id` | UUID | Sí | ID del usuario a asignar (debe estar activo) |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "task_id": "uuid",
    "user_id": "uuid",
    "assigned_by": "uuid",
    "created_at": "..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-assignees \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_id":"<uuid>","user_id":"<uuid>"}'
```

**Errores:** 400 (usuario inactivo/no encontrado), 401, 403, 404

---

### `DELETE /api-assignee/<id>`

Elimina una asignación.

**Auth:** Bearer token (requiere `can_manage_node` sobre la tarea asociada)

**Respuesta:**

```json
{
  "data": { "id": "uuid" }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-assignee/<id> \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 400, 401, 403, 404

---

## 5. Programación y Avance

### `PATCH / PUT /api-wbs-progress/<id>`

Reporta avance de un nodo WBS y opcionalmente registra horas.

**Auth:** Bearer token (requiere `can_report_progress` sobre el nodo)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `progress` | number | Sí | Avance 0–1 |
| `hours` | number | No | Horas a registrar (≥ 0). Requiere estar asignado a la tarea. |
| `notes` | string | No | Notas de la entrada de tiempo |
| `entry_date` | string | No | Fecha de entrada `YYYY-MM-DD` |

**Respuesta:**

```json
{
  "data": {
    "node": { ...nodo actualizado },
    "time_entry": {
      "id": "uuid",
      "task_id": "uuid",
      "user_id": "uuid",
      "hours": 8,
      "notes": "Avance del día",
      "entry_date": "2026-06-10",
      "created_at": "..."
    }
  }
}
```

Si `hours` es 0 o no se envía, `time_entry` será `null`.

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-progress/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"progress":0.5,"hours":8,"notes":"Diseño completado al 50%"}'
```

**Errores:** 400, 401, 403

---

### `PATCH / PUT /api-wbs-schedule/<id>`

Programa o desprograma un nodo WBS.

**Auth:** Bearer token (requiere `can_manage_node`)

**Body (JSON):**

**Modo programar:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `start_date` | string | Sí | `YYYY-MM-DD` |
| `end_date` | string | No | `YYYY-MM-DD` (default: `start_date`) |

**Modo desprogramar:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `unschedule` | boolean | Sí | Enviar `true` para marcar como no programado |

**Respuesta:**

```json
{
  "data": { ...nodo actualizado }
}
```

**Respuesta con warning de dependencia (409):**

```json
{
  "data": null,
  "warnings": [
    {
      "code": "DEPENDENCY_VIOLATION",
      "message": "La nueva fecha viola una dependencia FS",
      "dependency_id": "uuid"
    }
  ]
}
```

```bash
# Programar
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-schedule/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2026-07-01","end_date":"2026-07-15"}'

# Desprogramar
curl -s https://<ref>.supabase.co/functions/v1/api-wbs-schedule/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"unschedule":true}'
```

**Errores:** 400, 401, 403, 409 (warning estructurado por dependencias)

---

## 6. Timesheet (Registro de Horas)

### `GET /api-timesheet`

Lista entradas de tiempo.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `task_id` | UUID | Filtrar por tarea |
| `user_id` | UUID | Filtrar por usuario |

Si el usuario no es admin y no se especifican filtros, solo ve sus propias entradas.

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "user_id": "uuid",
      "hours": 8,
      "notes": "Diseño de interfaz",
      "entry_date": "2026-06-10",
      "created_at": "...",
      "profiles": {
        "id": "uuid",
        "full_name": "Juan Pérez",
        "avatar_url": "..."
      }
    }
  ],
  "count": 15
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-timesheet?task_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api-timesheet`

Registra horas en una tarea.

**Auth:** Bearer token (requiere estar asignado a la tarea)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `task_id` | UUID | Sí | ID del nodo WBS |
| `hours` | number | Sí | Horas (> 0) |
| `notes` | string | No | Notas |
| `entry_date` | string | No | Fecha `YYYY-MM-DD` |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "task_id": "uuid",
    "user_id": "uuid",
    "hours": 8,
    "notes": "Diseño de interfaz",
    "entry_date": "2026-06-10",
    "created_at": "..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-timesheet \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_id":"<uuid>","hours":8,"notes":"Diseño completo"}'
```

**Errores:** 400 (hours ≤ 0), 401, 403

---

## 7. Backlog

### `GET /api-backlog`

Lista todos los nodos WBS no programados (`is_unscheduled = true`).

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `project_id` | UUID | Filtrar por proyecto |

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "parent_id": "uuid",
      "name": "Tarea pendiente",
      "type": "task",
      "description": "...",
      "start_date": null,
      "end_date": null,
      "progress": 0,
      "estimated_hours": 40,
      "estimated_cost": 2000,
      "is_unscheduled": true,
      "path": "...",
      "task_assignees": [...]
    }
  ],
  "count": 8
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-backlog?project_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Adjuntos (Attachments)

### `GET /api-attachments`

Lista adjuntos de un proyecto. Incluye URLs firmadas temporales (1 hora) para descarga.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `project_id` | UUID | Sí | ID del proyecto |

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "file_name": "cronograma.pdf",
      "file_path": "<project_id>/<uuid>.pdf",
      "file_size": 245760,
      "mime_type": "application/pdf",
      "uploaded_by": "uuid",
      "created_at": "...",
      "download_url": "https://...signed-url..."
    }
  ],
  "count": 2
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-attachments?project_id=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

---

### `POST /api-attachments`

Sube un archivo adjunto al proyecto.

**Auth:** Bearer token (requiere `can_manage_project`)

**Content-Type:** `multipart/form-data`

**Form fields:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `project_id` | string (UUID) | Sí | ID del proyecto |
| `file` | File | Sí | Archivo (máx. 5 MB) |

**Tipos permitidos:** PDF, XLS, XLSX, DOC, DOCX, TXT, CSV, ZIP, PNG, JPG, JPEG, WEBP, y cualquier `image/*`.

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "file_name": "cronograma.pdf",
    "file_path": "<project_id>/<uuid>.pdf",
    "file_size": 245760,
    "mime_type": "application/pdf",
    "uploaded_by": "uuid",
    "created_at": "...",
    "download_url": "https://...signed-url..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-attachments \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "project_id=<uuid>" \
  -F "file=@/path/to/cronograma.pdf"
```

**Errores:** 400 (archivo excede 5 MB, tipo no permitido, Content-Type incorrecto), 401, 403

---

### `DELETE /api-attachment/<id>`

Elimina un adjunto (archivo en storage + registro en DB).

**Auth:** Bearer token (requiere `can_manage_project` sobre el proyecto asociado)

**Respuesta:**

```json
{
  "data": {
    "id": "uuid",
    "file_name": "cronograma.pdf"
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-attachment/<id> \
  -X DELETE \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 400, 401, 403, 404

---

## 9. Reportes y KPI

### `GET /api-reports/<id>`

Genera un reporte detallado de un proyecto. Incluye presupuesto, horas, avance ponderado, desglose por tarea y horas por persona.

**Auth:** Bearer token (requiere `can_manage_project`)

**Parámetros de ruta:** `id` — UUID del proyecto

**Respuesta:**

```json
{
  "data": {
    "project": {
      "id": "uuid",
      "name": "Proyecto Alpha",
      "status": "active"
    },
    "budget": {
      "total": 100000,
      "estimated_cost": 45000,
      "consumed_pct": 45
    },
    "hours": {
      "estimated": 120,
      "actual": 95.5,
      "variance_pct": -20.42
    },
    "progress": 62.5,
    "task_count": 8,
    "task_breakdown": [
      {
        "id": "uuid",
        "name": "Diseño",
        "progress": 0.8,
        "estimated_hours": 40,
        "actual_hours": 35,
        "hours_variance": -12.5,
        "estimated_cost": 2000,
        "assignees": ["Juan Pérez", "María López"]
      }
    ],
    "hours_by_person": [
      {
        "user_id": "uuid",
        "full_name": "Juan Pérez",
        "hours": 55.5
      }
    ]
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-reports/<project-id> \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 401, 403, 404

---

### `GET /api-kpi`

Dashboard de KPIs globales del portafolio. Incluye progreso global, hitos próximos, presupuesto, tareas retrasadas.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `project_type_id` | UUID | Filtrar por tipo de proyecto |
| `days` | number | Ventana de días para hitos próximos (default: `30`) |

**Respuesta:**

```json
{
  "data": {
    "projects": {
      "active": 5,
      "total": 8,
      "breakdown": [
        {
          "id": "uuid",
          "name": "Proyecto Alpha",
          "task_count": 12,
          "progress": 65.5,
          "unscheduled": 3
        }
      ]
    },
    "progress": {
      "global_pct": 52.3,
      "total_tasks": 45,
      "unscheduled": 8
    },
    "budget": {
      "total": 500000,
      "estimated_cost": 210000,
      "consumed_pct": 42
    },
    "hours": {
      "estimated": 800,
      "actual": 620,
      "variance_pct": -22.5
    },
    "milestones_upcoming": [
      {
        "id": "uuid",
        "name": "Entrega Fase 1",
        "project_id": "uuid",
        "start_date": "2026-06-15"
      }
    ],
    "milestones_count": 12,
    "delayed_tasks": [
      {
        "id": "uuid",
        "name": "Revisión QA",
        "project_id": "uuid",
        "type": "task",
        "end_date": "2026-05-01",
        "progress": 0.3
      }
    ],
    "delayed_count": 5
  }
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-kpi?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 401, 500

---

### `GET /api-summary`

Resumen ejecutivo del portafolio completo.

**Auth:** Bearer token

**Respuesta:**

```json
{
  "data": {
    "active_projects": 5,
    "total_projects": 8,
    "global_progress": 52.3,
    "upcoming_milestones": [
      {
        "id": "uuid",
        "name": "Entrega Fase 1",
        "project_id": "uuid",
        "start_date": "2026-06-15"
      }
    ],
    "upcoming_milestones_count": 12,
    "total_budget": 500000,
    "total_estimated_cost": 210000,
    "budget_consumed_pct": 42,
    "total_tasks": 45,
    "unscheduled_tasks": 8
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-summary \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 401, 500

---

## 10. Exportación

### `GET /api-export/<id>`

Exporta un proyecto completo en formato JSON o CSV. PNG/PDF queda diferido fuera del instalable inicial.

**Auth:** Bearer token

**Parámetros de ruta:** `id` — UUID del proyecto

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `format` | string | `"json"` (default), `"csv"`, `"pdf"` o `"png"` |

**Respuesta (JSON):**

```json
{
  "data": {
    "project": { ...proyecto completo },
    "wbs_nodes": [ ...todos los nodos WBS con asignaciones ],
    "dependencies": [ ...todas las dependencias ]
  },
  "metadata": {
    "exported_at": "2026-06-10T12:00:00.000Z",
    "exported_by": "uuid",
    "node_count": 25,
    "dependency_count": 8
  }
}
```

**Respuesta (CSV):** Archivo CSV con headers: `id, name, type, start_date, end_date, duration_days, progress, estimated_hours, estimated_cost, responsible_id, is_unscheduled, parent_id, project_id`. El `Content-Type` es `text/csv` con `Content-Disposition: attachment`.

**Respuesta diferida PNG/PDF (501):**

```json
{
  "error": "Export PNG/PDF no implementado en backend; usar export client-side de DHTMLX o implementar render headless"
}
```

Decisión US-24: el instalable inicial no incluye export PNG/PDF backend. Se mantiene JSON/CSV y se deja `pdf/png` como contrato explícito `501`. Ver `docs/export-png-pdf.md`.

```bash
# JSON
curl -s "https://<ref>.supabase.co/functions/v1/api-export/<project-id>?format=json" \
  -H "Authorization: Bearer $TOKEN"

# CSV (descarga como archivo)
curl -s "https://<ref>.supabase.co/functions/v1/api-export/<project-id>?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o proyecto.csv

# PNG/PDF diferido
curl -s "https://<ref>.supabase.co/functions/v1/api-export/<project-id>?format=pdf" \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 400 (formato no soportado), 401, 404, 501 (PNG/PDF diferido)

---

## 11. Importación

### `POST /api-import`

Importa tareas a un proyecto desde CSV o archivo multipart.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `type` | string | Sí | `"csv"` para importar. `"msproject"` no disponible en MVP. |

**Opción A — JSON con datos CSV inline:**

Content-Type: `application/json`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `project_id` | UUID | Sí | ID del proyecto destino |
| `data` | string | Sí | Contenido CSV como string (máx. 5,000,000 chars) |
| `parent_id` | UUID | No | ID del nodo padre donde insertar las tareas |

**Opción B — Multipart con archivo CSV:**

Content-Type: `multipart/form-data`

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `project_id` | string (UUID) | Sí | ID del proyecto destino |
| `file` | File | Sí | Archivo CSV con headers: `name, type, start_date, end_date, duration, progress, estimated_hours, estimated_cost, description` |

**Formato CSV esperado (primera línea = headers):**

```
name,type,start_date,end_date,progress,estimated_hours,estimated_cost,description
Diseño,task,2026-06-01,2026-06-15,0,40,2000,Diseño preliminar
```

**Respuesta (201):**

```json
{
  "data": [ ...nodos creados ],
  "imported_count": 3
}
```

```bash
# Opción A: JSON inline
curl -s "https://<ref>.supabase.co/functions/v1/api-import?type=csv" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","data":"name,type,start_date,end_date\nTarea 1,task,2026-06-01,2026-06-15"}'

# Opción B: Archivo CSV
curl -s "https://<ref>.supabase.co/functions/v1/api-import?type=csv" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "project_id=<uuid>" \
  -F "file=@tareas.csv"
```

**Errores:** 400 (CSV vacío, formato incorrecto, tipo no especificado), 401, 501 (MS Project no disponible)

---

## 12. Administración

### Usuarios

#### `GET /api-admin-users`

Lista todos los usuarios del sistema.

**Auth:** Bearer token (admin)

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "juan@example.com",
      "full_name": "Juan Pérez",
      "avatar_url": "...",
      "status": "active",
      "is_admin": true,
      "authentik_sub": "abc123",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "count": 3
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-admin-users \
  -H "Authorization: Bearer $TOKEN"
```

**Errores:** 401, 403 (no admin)

---

#### `POST /api-admin-users`

Invita a un nuevo usuario al sistema.

**Auth:** Bearer token (admin)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `email` | string | Sí | Email válido (máx. 320) |
| `full_name` | string | Sí | Nombre completo (máx. 300) |
| `avatar_url` | string | No | URL del avatar (máx. 1000) |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "email": "nuevo@example.com",
    "full_name": "Nuevo Usuario",
    "avatar_url": null,
    "status": "invited",
    "is_admin": false,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-admin-users \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"nuevo@example.com","full_name":"Nuevo Usuario"}'
```

**Errores:** 400 (email duplicado/inválido), 401, 403

---

#### `PUT / PATCH /api-admin-user/<id>`

Actualiza el perfil de un usuario. No permite modificar el propio perfil.

**Auth:** Bearer token (admin)

**Body (JSON):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `full_name` | string | Nombre completo (máx. 300) |
| `avatar_url` | string | URL del avatar (máx. 1000) |
| `status` | string | `"active"`, `"inactive"`, `"invited"` |
| `is_admin` | boolean | Otorgar/quitar admin |

**Respuesta:**

```json
{
  "data": {
    "id": "uuid",
    "email": "juan@example.com",
    "full_name": "Juan Pérez",
    "avatar_url": "...",
    "status": "active",
    "is_admin": false,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-admin-user/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"inactive"}'
```

**Errores:** 400 (modificar perfil propio, sin campos), 401, 403

---

#### `GET /api-users`

Búsqueda de usuarios activos para dropdowns de asignación.

**Auth:** Bearer token

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | string | Búsqueda parcial por `full_name` o `email` (ilike) |

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "juan@example.com",
      "full_name": "Juan Pérez",
      "avatar_url": "...",
      "status": "active",
      "is_admin": true
    }
  ],
  "count": 1
}
```

```bash
curl -s "https://<ref>.supabase.co/functions/v1/api-users?q=juan" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Tipos de Proyecto

#### `GET /api-admin-project-types`

Lista todos los tipos de proyecto.

**Auth:** Bearer token (admin)

**Respuesta:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Construcción",
      "description": "...",
      "color": "#6366f1",
      "is_active": true,
      "created_at": "..."
    }
  ],
  "count": 3
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-admin-project-types \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api-admin-project-types`

Crea un nuevo tipo de proyecto.

**Auth:** Bearer token (admin)

**Body (JSON):**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `name` | string | Sí | Nombre (máx. 300) |
| `description` | string | No | Descripción (máx. 2000) |
| `color` | string | No | Hexadecimal `#RRGGBB` (default: `#6366f1`) |

**Respuesta (201):**

```json
{
  "data": {
    "id": "uuid",
    "name": "Construcción",
    "description": "Proyectos de obra civil",
    "color": "#6366f1",
    "is_active": true,
    "created_at": "..."
  }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-admin-project-types \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Construcción","color":"#f97316"}'
```

---

#### `PUT / PATCH /api-admin-project-type/<id>`

Actualiza un tipo de proyecto.

**Auth:** Bearer token (admin)

**Body (JSON):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre (máx. 300) |
| `description` | string | Descripción (máx. 2000) |
| `color` | string | `#RRGGBB` |
| `is_active` | boolean | Activar/desactivar. No se puede desactivar si hay proyectos activos asociados. |

**Respuesta:**

```json
{
  "data": { ...tipo actualizado }
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-admin-project-type/<id> \
  -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Renovación","color":"#22c55e"}'
```

---

## 13. MCP (Model Context Protocol)

El endpoint MCP usa el protocolo JSON-RPC 2.0 y se autentica mediante `X-API-Key` (configurada en la variable de entorno `MCP_API_KEY`).

### `POST /api-mcp`

**Auth:** Header `X-API-Key: <mcp-api-key>`

**Content-Type:** `application/json`

---

#### `initialize`

Handshake inicial del protocolo MCP.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "abax-gantt-mcp", "version": "0.1.0" }
  }
}
```

---

#### `tools/list`

Lista las herramientas disponibles.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "list_projects",
        "description": "Lista todos los proyectos del portafolio",
        "inputSchema": { "type": "object", "properties": {} }
      },
      {
        "name": "get_project_wbs",
        "description": "Obtiene el WBS completo de un proyecto con dependencias",
        "inputSchema": {
          "type": "object",
          "properties": { "project_id": { "type": "string", "description": "UUID del proyecto" } },
          "required": ["project_id"]
        }
      },
      {
        "name": "get_summary",
        "description": "Obtiene un resumen ejecutivo del portafolio",
        "inputSchema": { "type": "object", "properties": {} }
      },
      {
        "name": "create_task",
        "description": "Crea una tarea en un proyecto",
        "inputSchema": {
          "type": "object",
          "properties": {
            "project_id": { "type": "string", "description": "UUID del proyecto" },
            "name": { "type": "string", "description": "Nombre de la tarea" },
            "type": { "type": "string", "description": "Tipo: task, milestone, stage, group" },
            "start_date": { "type": "string", "description": "Fecha inicio YYYY-MM-DD" },
            "end_date": { "type": "string", "description": "Fecha fin YYYY-MM-DD" },
            "description": { "type": "string", "description": "Descripcion" }
          },
          "required": ["project_id", "name"]
        }
      }
    ]
  }
}
```

---

#### `tools/call`

Ejecuta una herramienta MCP.

**Request genérico:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "<nombre-herramienta>",
    "arguments": { ... }
  }
}
```

**Herramientas disponibles:**

##### `list_projects`

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-mcp \
  -X POST \
  -H "X-API-Key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_projects","arguments":{}}}'
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"projects\":[{\"id\":\"...\",\"name\":\"...\",\"status\":\"active\",\"created_at\":\"...\"}],\"count\":5}"
    }]
  }
}
```

##### `get_project_wbs`

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-mcp \
  -X POST \
  -H "X-API-Key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_project_wbs","arguments":{"project_id":"<uuid>"}}}'
```

**Response:** Retorna `project`, `wbs_nodes[]`, `dependencies[]`, `node_count`, `dependency_count` dentro de `content[0].text` como JSON string.

##### `get_summary`

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-mcp \
  -X POST \
  -H "X-API-Key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_summary","arguments":{}}}'
```

**Response:** Retorna `active_projects`, `total_projects`, `total_tasks`, `upcoming_milestones[]` dentro de `content[0].text` como JSON string.

##### `create_task`

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-mcp \
  -X POST \
  -H "X-API-Key: $MCP_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"create_task","arguments":{"project_id":"<uuid>","name":"Nueva Tarea","type":"task","start_date":"2026-06-01"}}}'
```

**Response:** Retorna el objeto de la tarea creada dentro de `content[0].text`.

**Errores MCP:**

| Código JSON-RPC | Significado |
|-----------------|-------------|
| -32700 | Parse error (JSON inválido) |
| -32601 | Método/herramienta no soportado |
| -32603 | Error interno del servidor |
| -32001 | API Key inválida (HTTP 401) |

---

## 14. Debug

### `GET /api-debug`

Endpoint de diagnóstico sin autenticación. Devuelve la URL del JWKS configurado y el estado de conectividad con Authentik.

**Auth:** Ninguna

**Respuesta:**

```json
{
  "jwks_url": "https://auth.example.com/application/o/abax-gantt/jwks/",
  "fetch_status": "200",
  "fetch_body": "{\"keys\":[...]}"
}
```

```bash
curl -s https://<ref>.supabase.co/functions/v1/api-debug
```

---

## Resumen de Códigos de Error

| HTTP | Significado |
|------|-------------|
| 400  | Datos inválidos o faltantes en la solicitud |
| 401  | Token JWT no proporcionado, inválido o expirado |
| 403  | Usuario sin permisos sobre el recurso o cuenta inactiva |
| 404  | Recurso no encontrado (proyecto, nodo, dependencia, etc.) |
| 405  | Método HTTP no permitido para el endpoint |
| 500  | Error interno del servidor o de base de datos |
| 501  | Funcionalidad no implementada (MS Project import) |
