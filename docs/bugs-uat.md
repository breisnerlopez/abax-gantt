# Bugs encontrados en UAT — 2026-05-19

Sesión de UAT exhaustivo contra `https://demo.breisner.info/abax-gantt` con 3 usuarios reales (akadmin, responsable@test.com, ejecutor@test.com).

**Resumen:** 14 bugs encontrados, **todos arreglados y re-verificados**. La app pasa los 51 checks del smoke (`ops/uat-smoke.sh`).

---

## Configuración inicial (no eran bugs de código pero bloqueaban UAT)

### CONF-1 — Provider Authentik `abax-gantt` sin scope mappings
**Severidad:** Crítica · **Componente:** Authentik provider

El provider OAuth2 `abax-gantt-spa` no tenía property mappings configurados, por lo que los JWT emitidos NO incluían claims `email`, `name`, `groups`. Todos los logins generaban perfiles vacíos con `is_admin=false`.

**Fix:** Adjuntar los 4 mappings estándar al provider:
- `OpenID 'openid'`
- `OpenID 'profile'` (incluye `groups`)
- `OpenID 'email'`
- `OpenID 'offline_access'`

### CONF-2 — `akadmin` no estaba en grupo `abax-admins`
**Severidad:** Alta · **Componente:** Authentik

El usuario admin no estaba en el grupo declarado en `ADMIN_GROUP`, por lo que después del fix de scopes seguiría sin obtener `is_admin=true`.

**Fix:** `akadmin.ak_groups.add(Group.objects.get(name='abax-admins'))`.

### CONF-3 — Profile `akadmin` en `abax_gantt` DB con email/full_name vacíos
**Severidad:** Media · **Componente:** Datos producción

Producto de CONF-1, el primer login creó el profile con strings vacíos. Quedaba imposible identificarlo en UI.

**Fix:** Actualizar el profile a `root@example.com` / `authentik Default Admin` / `is_admin=true`.

---

## Bugs de código

### BUG-1 — Sumas numéricas se concatenan como strings en KPI/Summary/Reports
**Severidad:** Crítica · **HU:** US-21, US-23
**Archivos:** `deploy/server/api/_shared/db.ts`, `deploy/server/api/kpi.ts`, `deploy/server/api/summary.ts`, `deploy/server/api/reports.ts`, `deploy/server/api/mcp.ts`

`postgres@3` devuelve columnas `NUMERIC` como string. `reduce((s,p) => s + p.budget_total)` concatenaba strings: 4 proyectos con budget 0.00 producían `"00.000.000.000.00"`.

**Fix:** Configurar parser de tipo NUMERIC en el cliente postgres para auto-convertir a `Number`. Aplica globalmente:

```ts
postgres(url, {
  types: { numeric: { to: 1700, from: [1700],
    serialize: (n) => String(n), parse: (s) => Number(s) } },
});
```

**Verificación:** `GET /api/kpi` ahora devuelve `budget.total: 0` (number).

---

### BUG-2 — Frontend llama URLs `api-X` (estilo Supabase) que no existen en deploy
**Severidad:** Crítica · **HU:** US-04, US-09, US-10, US-10B, US-11, US-13, US-21, US-24
**Archivos:** `poc/src/lib/api.ts`, `poc/src/pages/GanttPage.tsx`, `poc/src/pages/AdminPage.tsx`

El cliente HTTP usaba inconsistentemente `api-X/${id}` (Edge Functions) en lugar de `api/X/${id}` (deploy router). Todas las operaciones de update/delete fallaban silenciosamente:

| Roto | Correcto |
|------|----------|
| `api-wbs-node/${id}` | `api/wbs/${id}` |
| `api-wbs-schedule/${id}` | `api/wbs/schedule/${id}` |
| `api-wbs-progress/${id}` | `api/wbs/progress/${id}` |
| `api-wbs-move/${id}` | `api/wbs/move/${id}` |
| `api-assignees`, `api-assignee/${id}` | `api/assignees`, `api/assignees/${id}` |
| `api-dependency/${id}` | `api/dependencies/${id}` |
| `api-attachments`, `api-attachment/${id}` | `api/attachments`, `api/attachments/${id}` |
| `api-reports/${id}` | `api/reports/${id}` |
| `api-timesheet` | `api/timesheet` |
| `api-admin-users`, `api-admin-user/${id}` | `api/admin/users`, `api/admin/users/${id}` |
| `api-export/${id}` | `api/export/${id}` |

**Fix:** Normalizar todos los paths a `api/...`. Confirmado 0 referencias a `api-` y a `localhost:54321` en `poc/src/`.

---

### BUG-3 — `wbs-node.ts` y `projects.ts` no aceptaban PATCH (solo PUT)
**Severidad:** Crítica · **HU:** US-04, US-09

Frontend envía PATCH para actualizaciones parciales. Handlers respondían "Metodo no permitido".

**Fix:** `if (req.method === "PUT" || req.method === "PATCH")` en ambos handlers.

---

### BUG-4 — wbs-node.ts NO verificaba permisos en PATCH/DELETE (SEGURIDAD)
**Severidad:** Crítica (security) · **HU:** US-11, US-13

Cualquier usuario autenticado podía editar/eliminar cualquier nodo. Reproducido con ejecutor:
```
PATCH /api/wbs/{id} -d '{"name":"hack"}' → 200 OK (debería ser 403)
```

**Fix:** Llamar `assertCanManageNode(auth.userId, id)` antes de UPDATE/DELETE.

---

### BUG-5 — projects.ts NO verificaba permisos en PATCH/DELETE (SEGURIDAD)
**Severidad:** Crítica (security) · **HU:** US-04

Igual que BUG-4 para proyectos. Cualquier usuario podía archivar/editar cualquier proyecto.

**Fix:** `assertCanManageProject(auth.userId, id)`.

---

### BUG-6 — progress.ts NO verificaba que sea responsable/ejecutor (SEGURIDAD)
**Severidad:** Alta · **HU:** US-13

Cualquier usuario podía reportar avance en cualquier tarea, no solo el ejecutor asignado o el responsable del nodo padre.

**Fix:** Nueva función `assertCanReportProgress(userId, nodeId)` que valida `can_manage_node OR task_assignees`. Llamada al inicio del handler.

---

### BUG-7 — assignees, dependencies, attachments, timesheet sin permisos (SEGURIDAD)
**Severidad:** Alta · **HU:** US-09B, US-10, US-11, US-22

Mismo patrón en los demás handlers.

**Fix:** Agregar al handler:
- `assignees POST/DELETE` → `assertCanManageNode(taskId)`
- `dependencies POST/DELETE` → `assertCanManageDependency / assertCanManageNode(successor)`
- `attachments POST/DELETE` → `assertCanManageProject(projectId)`
- `timesheet POST` → `assertAssignedToTask(taskId)`
- `reports GET` → `assertCanManageProject(projectId)`

Funciones nuevas en `deploy/server/api/_shared/auth.ts`:
- `assertAdmin(auth)`
- `assertCanReportProgress(userId, nodeId)`
- `assertAssignedToTask(userId, nodeId)`
- `assertCanManageDependency(userId, predId, succId)`

---

### BUG-8 — Admin invite user → 500 (NOT NULL constraint)
**Severidad:** Alta · **HU:** US-02

`POST /api/admin/users` con email+name fallaba en `INSERT INTO profiles` porque `authentik_sub` es NOT NULL pero el invitado no tiene cuenta Authentik aún.

**Fix:**
1. `admin-users.ts` POST: usar placeholder `authentik_sub = 'invited:' || email`.
2. `auth.ts` `authenticate`: en primer login, si existe profile con email coincidente y `authentik_sub LIKE 'invited:%'`, **actualizar** ese profile con el sub real en lugar de crear duplicado.

Bonus: ahora `is_admin` se mantiene sincronizado con membresía del grupo Authentik en cada login (antes solo se setteaba al crear).

---

### BUG-9 — Export endpoint requería UUID en path
**Severidad:** Media · **HU:** US-24

Backend en deploy/ usa `/api/export/{id}` (UUID en path). Frontend hacía `/api-export/${id}?format=json` (path + query).

**Fix:** Cubierto por BUG-2 (normalización de paths).

---

### BUG-10 — Frontend default fallback URL `http://localhost:54321/functions/v1`
**Severidad:** Media · **HU:** US-01, US-02

En `AdminPage.tsx`, si `VITE_API_BASE_URL` no estaba seteado (o quedaba vacío) caía al URL de dev de Supabase. Esto deshabilitaba la página admin en producción.

**Fix:** Default a `''` (relativo al host actual).

---

### BUG-11 — Reports endpoint sin filtro por permisos
**Severidad:** Media · **HU:** US-21

`GET /api/reports/{id}` retornaba presupuesto a cualquier usuario autenticado, no solo a quienes administraban el proyecto.

**Fix:** `if (!auth.isAdmin) assertCanManageProject(auth.userId, projectId)`.

---

## Verificación

- **Smoke UAT (51 checks):** `ops/uat-smoke.sh` con tokens de los 3 roles reales → **51/51 OK**.
- **Tests deploy/_shared unit (41 tests Deno):** `deno test deploy/server/api/_shared/tests/` → **41/41 OK**.
- **Tests supabase/_shared unit (86 tests Deno):** `npm run test:unit` → **86/86 OK** (sin regresión).
- **Tests frontend (39 tests Vitest):** `npm --prefix poc test` → **39/39 OK** (sin regresión).

---

## Cómo reproducir / regresión

```bash
# 1. Generar tokens
source <(./ops/mint-test-tokens.sh)

# 2. Correr smoke (51 checks)
./ops/uat-smoke.sh

# 3. Unit tests
deno test --allow-env --allow-net --allow-read deploy/server/api/_shared/tests/
```
