# ABAX Gantt — Documentación de lo implementado

## Estado general

MVP full-stack funcional. 27 tests unitarios frontend (Vitest), 86 tests unitarios backend (Deno), 79 tests de integración backend con JWT Authentik reales (Deno). Cobertura de permisos por rol, operaciones CRUD completas, UI con DHTMLX Gantt, panel de detalle, backlog, filtros, búsqueda, dark mode, administración de usuarios y PWA.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 + React Router 7 |
| Gantt | DHTMLX Gantt 9 (lazy loaded) |
| Auth | Authentik OIDC (`oidc-client-ts`) + fallback dev token (`localStorage`) |
| Backend | Supabase Edge Functions (Deno) + PostgreSQL 15 |
| Storage | Supabase Storage (bucket `attachments`, 5 MB) |
| Testing | Vitest + Testing Library + jsdom (unitarios), Playwright (E2E), Deno test (integración) |

---

## Rutas del frontend

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/gantt/login` | `LoginPage` | Login vía Authentik o token dev |
| `/gantt/auth/callback` | `AuthCallbackPage` | Callback OIDC post-login |
| `/gantt/gantt` | `GanttPage` (lazy) | Vista principal con Gantt, backlog, panel de detalle, filtros |
| `/gantt/admin` | `AdminPage` (lazy) | Administración de usuarios (invitar, activar/desactivar) |

---

## Arquitectura del frontend

```
poc/src/
├── App.tsx                    # Rutas, ThemeProvider, ToastProvider, Suspense
├── main.tsx                   # Entry point
├── styles.css                 # 291 líneas de CSS + dark mode + responsive
├── components/
│   ├── AppShell.tsx            # Topbar con búsqueda, KPIs, toggle tema, user chip
│   ├── BacklogPanel.tsx        # Panel lateral de tareas sin fecha, agrupado por proyecto
│   ├── ConfirmDialog.tsx       # Modal de confirmación (reemplaza window.confirm)
│   ├── CreateDialog.tsx        # Modal crear proyecto o nodo hijo, con fechas opcionales
│   ├── DetailPanel.tsx         # Panel derecho con tabs: Info, Responsables, Ejecutores, Avance, Horas, Presupuesto, Adjuntos
│   ├── ErrorBoundary.tsx       # Captura errores de render en GanttCanvas y DetailPanel
│   ├── FilterBar.tsx           # Filtros: búsqueda por nombre, tipo, solo backlog
│   ├── GanttCanvas.tsx         # DHTMLX Gantt con dependencias, mover, reordenar (lazy)
│   ├── TimesheetPanel.tsx      # Registro y listado de horas por tarea
│   ├── ToastProvider.tsx       # Toasts success/error/info con auto-dismiss
│   └── Toolbar.tsx             # Botones crear, exportar, indicadores
├── hooks/
│   ├── useAuthSession.ts       # Estado de sesión: OIDC o dev token
│   └── usePortfolio.ts         # Carga, polling 30s, actualización local optimista
├── lib/
│   ├── api.ts                  # Cliente HTTP para 19 endpoints
│   ├── auth.ts                 # Configuración OIDC (Authentik)
│   ├── dhtmlx-adapter.ts       # Convierte nodos WBS a formato DHTMLX Gantt
│   ├── portfolio-state.ts      # Helpers puros para estado local (add/remove/update)
│   ├── test-fixtures.ts        # Fábricas makeNode, makePortfolio para tests
│   ├── theme.tsx               # ThemeContext + ThemeProvider (light/dark)
│   ├── toast.ts                # Contexto y hook useToast
│   ├── types.ts                # Tipos: WbsNode, Project, Dependency, Profile, etc.
│   └── validation.ts           # Validaciones: nombres, fechas, adjuntos, jerarquía WBS
├── pages/
│   ├── AdminPage.tsx            # CRUD de usuarios (listar, invitar, toggle estado)
│   ├── AuthCallbackPage.tsx     # Procesa callback OIDC
│   ├── GanttPage.tsx            # Página principal: estado, filtros, atajos, polling
│   └── LoginPage.tsx            # Login con Authentik o token dev
└── tests/e2e/
    └── gantt-smoke.spec.ts      # Smoke E2E con Playwright + API mockeada
```

---

## Funcionalidades implementadas

### Core Gantt
- Render de WBS con jerarquía árbol (ltree)
- Tipos: proyecto, etapa, grupo, tarea, hito (con estilos visuales distintos)
- Dependencias FS/SS/FF/SF con creación por drag y validación de integridad
- Mover y reordenar nodos con validación de jerarquía
- Autosave con debounce 500ms en panel Info
- Zoom (día/semana/mes)
- Columna "Resp." con iniciales del responsable

### Backlog
- Panel lateral colapsable/expandible
- Tareas agrupadas por proyecto
- Programar tarea asignando fechas desde el backlog
- Enviar tarea programada al backlog (`⌘⌫`)

### Panel de detalle (7 tabs)
- **Info**: nombre, descripción, fechas, horas estimadas, avance. Autosave 500ms.
- **Responsables**: designar responsable con selector de usuarios activos
- **Ejecutores**: asignar/quitar ejecutores con selector
- **Avance**: slider de progreso + horas reales opcionales
- **Horas**: registro de time entries con API timesheet
- **Presupuesto**: KPIs del reporte presupuestario (costo, horas, avance)
- **Adjuntos**: subir (multipart), listar, eliminar con modal de confirmación

### Permisos por rol
- `admin` / `responsable`: edición estructural completa
- `ejecutor`: solo reportar avance, horas, ver presupuesto. Campos estructurales deshabilitados.
- Validación backend: `can_manage_node`, `can_manage_project`, `can_report_progress`
- RLS como defensa secundaria

### Filtros y búsqueda
- Filtro por nombre (búsqueda textual)
- Filtro por tipo de nodo (project/stage/group/task/milestone)
- Filtro "Solo backlog"
- Botón limpiar filtros
- Búsqueda global en topbar con selección automática del nodo coincidente

### Exportar
- Botón Exportar en toolbar
- Descarga JSON del proyecto activo vía `api-export`

### Administración
- Ruta `/gantt/admin`
- Listado de usuarios con email, estado (active/inactive/invited), admin
- Formulario de invitación (nombre + email)
- Toggle activar/desactivar usuario

### UX
- Dark mode con toggle ☽/☀, persistente en localStorage, respeta `prefers-color-scheme`
- Atajos de teclado: `⌘⇧N` crear proyecto, `⌘K` toggle backlog, `⌘⌫` enviar a backlog, `Escape` cerrar diálogos
- Scroll-restore: guarda último nodo seleccionado en `sessionStorage`
- Estado vacío del panel de detalle con ilustración
- Toasts success/error/info con auto-dismiss
- Modal de confirmación propio (reemplaza `window.confirm`) para adjuntos y dependencias
- ErrorBoundary en GanttCanvas y DetailPanel
- Mobile responsive: CSS para ≤768px con fallback de lista

### PWA
- `manifest.json` con nombre, iconos, theme color
- Service worker con cache-first (`sw.js`)
- Registro automático en `index.html`

### Seguridad
- CSP header vía meta tag: restringe scripts, estilos, conexiones, fuentes
- 0 vulnerabilidades npm (`npm audit`)
- JWKS para validación JWT con rotación automática
- `verify_jwt = false` en Edge Functions (la validación es programática con jose)
- API keys para MCP

### Tiempo real
- Polling automático cada 30s en `usePortfolio`
- Silencioso (no muestra loading spinner en updates)
- Limpia el intervalo al desmontar

### Pre-commit hooks
- Husky + lint-staged configurados
- ESLint + auto-fix en archivos ts/tsx

---

## Backend: Edge Functions (26 endpoints)

| Dominio | Endpoints |
|---------|-----------|
| Projects | `GET/POST api-projects` |
| WBS | `GET/POST api-wbs`, `GET/PUT/DELETE api-wbs-node` |
| Dependencies | `GET/POST api-dependencies`, `DELETE api-dependency` |
| Assignees | `GET/POST api-assignees`, `DELETE api-assignee` |
| Schedule | `PATCH api-wbs-schedule` (programar/desprogramar) |
| Progress | `PATCH api-wbs-progress` (avance + horas) |
| Move | `PATCH api-wbs-move` |
| Timesheet | `GET/POST api-timesheet` |
| Backlog | `GET api-backlog` |
| Attachments | `GET/POST api-attachments`, `DELETE api-attachment` |
| Reports | `GET api-reports` (presupuesto), `GET api-summary` (KPIs), `GET api-kpi` |
| Export | `GET api-export` (JSON/CSV) |
| Import | `POST api-import` (CSV inline) |
| Admin | `GET/POST api-admin-users`, `PUT api-admin-user`, `GET/POST admin-project-types`, `PUT admin-project-type` |
| Users | `GET api-users` (directorio activo) |
| MCP | `POST api-mcp` (agentes IA) |
| Debug | `GET/POST api-debug` |

Todos validan JWT vía Authentik JWKS. Autorización programática con funciones `can_manage_node`, `can_manage_project`, `can_report_progress`, `assertAssignedToTask`.

---

## Base de datos

7 migraciones SQL:
- `00001_schema.sql`: modelo completo con ltree, constraints, índices
- `00002_functions_rls.sql`: permisos heredados, políticas RLS, función `can_manage_node`
- `00003_dependency_guards.sql`: integridad de dependencias (mismo proyecto, sin ciclos)
- `00004_subtree_repath.sql`: recálculo de path ltree al mover nodos
- `00005_storage_bucket.sql`: bucket `attachments` con límite 5 MB y MIME types
- `00006_authentik_profiles.sql`: desacople de `auth.users`, columna `authentik_sub`
- `00007_set_user_context.sql`: RPC para contexto de usuario en operaciones

Seed demo en `supabase/seed.sql`: 3 usuarios, 1 proyecto, 6 nodos WBS, 1 dependencia, 1 ejecutor asignado.

---

## Cobertura de tests

| Suite | Framework | Archivos | Tests | Cobertura |
|-------|-----------|----------|-------|-----------|
| Frontend unit | Vitest + jsdom | 6 | 27 | Validaciones, adaptador DHTMLX, estado local, permisos, roles, adjuntos, presupuesto, flujos Gantt mockeados |
| E2E navegador | Playwright + Chromium | 1 | 1 | Smoke de creación con toasts de validación (API mockeada) |
| Backend unit | Deno test | 3 | 86 | CORS, errores, validación de inputs |
| Backend integración | Deno test + Docker | 1 | 79 | CRUD completo contra Supabase local con JWT reales |
| Type check | Deno check | 26 | - | Todas las Edge Functions |

### Archivos de test
```
poc/src/
├── components/DetailPanel.test.tsx    # 6 tests: permisos, roles, presupuesto, adjuntos
├── lib/dhtmlx-adapter.test.ts         # Adaptador WBS → DHTMLX
├── lib/portfolio-state.test.ts        # Estado local inmutable
├── lib/validation.test.ts             # Validaciones de negocio + adjuntos
├── pages/GanttPage.test.tsx           # 6 tests: flujos mockeados con Router
└── pages/LoginPage.test.tsx           # Render de login

poc/tests/e2e/
└── gantt-smoke.spec.ts                # 1 test: validación + toasts

supabase/
├── functions/_shared/tests/cors.test.ts      # 8 tests
├── functions/_shared/tests/errors.test.ts    # 16 tests
├── functions/_shared/tests/validation.test.ts # 62 tests
└── tests/integration.test.ts                  # 79 tests
```

---

## Scripts disponibles

```bash
# Arranque
npm run dev              # Frontend Vite (localhost:5173)
npm run db:start         # Supabase local (Docker)
npm run db:reset         # Migraciones + seed
npm run serve:core       # Todas las Edge Functions (16 funciones)

# Build y calidad
npm run build            # TypeScript + Vite build
npm run lint             # ESLint
npm run check:functions  # Deno check de todas las Edge Functions
npm audit                # 0 vulnerabilidades

# Tests
npm run smoke:frontend   # Vitest (27 tests)
npm run smoke:backend    # Integración Deno (79 tests)
npm run smoke:e2e        # Playwright (1 test)
npm run test             # Suite completa backend (165 tests)
```

---

## Bundle

| Chunk | Tamaño (min+gzip) | Notas |
|-------|-------------------|-------|
| `index` | 310 kB + 94 kB gzip | Shell inicial (React, Router, componentes core) |
| `GanttCanvas` | 609 kB + 164 kB gzip | DHTMLX Gantt (lazy loaded) |
| `GanttPage` | 33 kB + 9 kB gzip | Lógica de página principal (lazy) |
| `AdminPage` | 3.4 kB + 1.4 kB gzip | Panel admin (lazy) |
| `index.css` | 168 kB + 56 kB gzip | Estilos completos + dark mode + responsive |
| `validation` | 2.9 kB + 1.3 kB gzip | Validaciones compartidas |
| `AppShell` | 2.3 kB + 1.1 kB gzip | Shell compartido |

Carga inicial: ~310 kB JS + 168 kB CSS. DHTMLX se carga bajo demanda al entrar a la vista Gantt.

---

## Pendiente para producción

1. **Publicación de imagen Docker** — etiquetar y publicar `abax-gantt:latest` con tag inmutable tras validar `docs/publicacion-contenedor.md`.
2. **Observabilidad** — Sentry/log shipping para errores frontend/backend, analytics de uso.
3. **Monitoreo** — health checks externos sobre `/abax-gantt/api/health` y alertas de contenedor/DB.
4. **E2E profundo** — Playwright con DHTMLX real (arrastrar, crear dependencias, mover tareas en el Gantt).
5. **Iconos PWA** — generar `icon-192.png` y `icon-512.png` reales.
6. **CI/CD** — pipeline en `.github/workflows/ci.yml` ya creado; activar en GitHub Actions con secrets y build args Docker.
