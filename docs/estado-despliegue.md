# Estado del Despliegue — ABAX Gantt

**Fecha:** 19 de mayo de 2026  
**URL:** `https://demo.breisner.info/abax-gantt`  
**Entorno:** Docker self-hosted (shared PostgreSQL + Authentik + Cloudflare Tunnel + Traefik)  
**Runbook de publicación:** `docs/publicacion-contenedor.md`  
**Migración OpenProject:** `docs/imports/openproject-migration/REVISION.md` (importada en `abax_gantt`)

---

## 1. Infraestructura desplegada

| Componente | Contenedor | Red | Puerto |
|-----------|-----------|-----|--------|
| ABAX Gantt (Deno) | `abax-gantt` | `infra-net` | 8000 |
| PostgreSQL | `<postgres-host>` | `infra-net` | 5432 |
| Authentik Server | `authentik-server` | `infra-net` | 9000 |
| Authentik Proxy | `authentik-proxy` | `infra-net` | 9000/9300/9443 |
| Authentik Worker | `authentik-worker` | `infra-net` | — |
| Traefik | `secure-traefik` | `infra-net` + `secure-publishing` | 80 (via CF Tunnel) |

**Base de datos:** `abax_gantt` en `<postgres-host>` (convención `{marca}_{módulo}`)

**Imagen activa:** `ghcr.io/breisnerlopez/abax-gantt:v0.1.0`  
**Volumen adjuntos:** `abax-gantt_attachments:/app/data/attachments`

---

## 2. Authentik — Configuración aplicada

| Elemento | Valor |
|----------|-------|
| Provider OAuth2 | `abax-gantt` / `client_id=abax-gantt-spa` |
| Application | `ABAX Gantt` / slug `abax-gantt` |
| Grupo admin | `abax-admins` |
| Usuario admin | `admin` (admin@example.com) en grupo `abax-admins` |
| Redirect URI | `https://demo.breisner.info/abax-gantt/auth/callback` |
| Post-logout URI | `https://demo.breisner.info/abax-gantt/login` |
| Issuer mode | `per_provider` |
| Issuer URL | `https://auth.breisner.info/application/o/abax-gantt/` |
| JWKS URL | `https://auth.breisner.info/application/o/abax-gantt/jwks/` |
| Client type | `public` |
| Grant type | `authorization_code` + PKCE S256 |
| Signing key | `authentik Self-signed Certificate` |
| Authorization flow | `default-provider-authorization-implicit-consent` |
| Outpost vinculado | `Shared Proxy Outpost` (providers: OpenCode, Traefik Dashboard, abax-gantt) |

---

## 3. Traefik — Rutas configuradas

Archivo: `/opt/secure-publishing/traefik/dynamic/abax-gantt.yml`

| Regla | Middleware | Destino |
|-------|-----------|---------|
| `Host(demo.breisner.info) && PathPrefix(/abax-gantt)` | `cloudflare-https` + `abax-gantt-strip` | `abax-gantt:8000` |

El middleware `abax-gantt-strip` remueve el prefijo `/abax-gantt` antes de forwardear al contenedor.

---

## 4. Variables de entorno del contenedor

```env
DATABASE_URL=postgresql://abax:<password>@<host>:5432/abax_gantt
AUTHENTIK_ISSUER=https://auth.breisner.info/application/o/abax-gantt/
AUTHENTIK_CLIENT_ID=abax-gantt-spa
AUTHENTIK_JWKS_URL=https://auth.breisner.info/application/o/abax-gantt/jwks/
STORAGE_PATH=/app/data/attachments
ADMIN_GROUP=abax-admins
PUBLIC_AUTHENTIK_AUTHORITY=https://auth.breisner.info/application/o/abax-gantt/
PUBLIC_AUTHENTIK_CLIENT_ID=abax-gantt-spa
PUBLIC_AUTHENTIK_REDIRECT_URI=https://demo.breisner.info/abax-gantt/auth/callback
PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.breisner.info/abax-gantt/login
PUBLIC_BASE_PATH=/abax-gantt/
PUBLIC_API_BASE_URL=/abax-gantt
```

---

## 5. Migraciones aplicadas

| # | Archivo | Descripción |
|---|---------|-------------|
| 00001 | `schema.sql` | Tablas: profiles, project_types, projects, wbs_nodes, dependencies, task_assignees, time_entries, attachments |
| 00002 | `functions_rls.sql` | Funciones `can_manage_node`, políticas RLS |
| 00003 | `dependency_guards.sql` | Integridad de dependencias |
| 00004 | `subtree_repath.sql` | Recalculo ltree al mover nodos |
| 00005 | `storage_bucket.sql` | Bucket de adjuntos |
| 00006 | `authentik_profiles.sql` | Desacople de auth.users, `authentik_sub` |
| 00007 | `set_user_context.sql` | RPC `set_user_context` |

---

## 6. Bugs corregidos durante el despliegue

| # | Error | Causa | Solución |
|---|-------|-------|----------|
| 1 | `failed to fetch` al hacer login | `.well-known/openid-configuration` devuelve HTML | Metadata OIDC estática en `auth.ts` |
| 2 | `not found` en authorize | Endpoints OIDC mal enrutados | Corregida ruta de authorize/token a `/application/o/authorize/` y `/application/o/token/` |
| 3 | `server error` en Authentik | `redirect_uris` guardado como string en columna JSONB | Almacenado como JSONB real con `matching_mode: "strict"` |
| 4 | `authorization_flow: None` | Provider sin flow de autorización | Asignado `default-provider-authorization-implicit-consent` |
| 5 | Provider no vinculado al outpost | Sin outpost, proxy no enruta OIDC | Vinculado al `Shared Proxy Outpost` |
| 6 | 404 en rutas SPA (`/login`, `/gantt`, `/admin`) | `serveDir` sin fallback SPA | Agregado fallback: si archivo no existe → servir `index.html` |
| 7 | `Error interno del servidor` (500) | `db.queryObject is not a function` | Reescribo `db.ts` con wrapper `query()` sobre `sql.unsafe()` |
| 8 | `(intermediate value) is not iterable` | Destructuring `[{rows:...}]` incorrecto | Corregido a `{rows:...}` y `{rows: [x]}` en 20+ handlers |
| 9 | Tagged template `db.query\`SQL\`` | Incompatible con el wrapper | Convertido a `db.query(\`SQL\`, params)` en assignees.ts y dependencies.ts |
| 10 | `API_BASE_URL` apuntaba a `localhost:54321` | Default de desarrollo | Seteado a `/abax-gantt` via runtime `PUBLIC_API_BASE_URL` |
| 11 | Rutas API en formato `api-projects` | Formato viejo de Supabase | Cambiadas a `api/projects` en `api.ts` |
| 12 | Faltaba endpoint `/api/summary` | No implementado en el servidor Deno | Creado `summary.ts` y ruta |
| 13 | PostgreSQL sin DB `abax_gantt` | DB no creada | Creada con usuario `abax`, schemas `auth`, `extensions`, `storage`, `vault` |
| 14 | Extensión `ltree` no instalada | PostgreSQL estándar sin ltree | Instalada con `CREATE EXTENSION ltree` |
| 15 | `auth.uid()` no existe | Migración Supabase en PG estándar | Creado stub `auth.uid()` |
| 16 | `storage.buckets` no existe | Migración Supabase en PG estándar | Creado stub `storage.buckets` |
| 17 | `vault` schema no existe | Migración Supabase en PG estándar | Creado schema `vault` |
| 18 | API pública devolvía 404 | Frontend podía llamar a `/api/*` sin subpath; Traefik solo enruta `/abax-gantt/*` | `apiUrl()` usa runtime `PUBLIC_API_BASE_URL=/abax-gantt` |
| 19 | Compose creaba `deploy-abax-gantt-1` | Faltaba alinear `container_name`/volumen con despliegue existente | `docker-compose.prod.yml` usa `container_name: abax-gantt` y volumen externo `abax-gantt_attachments` |

---

## 7. Cambios en el código fuente

### Frontend (`poc/src/`)

| Archivo | Cambio |
|---------|--------|
| `lib/auth.ts` | Metadata OIDC estática, redirect URIs a `/abax-gantt/`, endpoints dinámicos |
| `lib/api.ts` | `API_BASE_URL` deriva de `PUBLIC_API_BASE_URL`, rutas `api/*` en vez de `api-*` |
| `App.tsx` | `BrowserRouter basename="/abax-gantt"` |
| `vite.config.ts` | `base: './'` para assets relativos; `PUBLIC_BASE_PATH` controla routing/runtime |
| `index.html` | Paths: favicon, manifest, service worker a `/abax-gantt/` |

### Backend (`deploy/server/`)

| Archivo | Cambio |
|---------|--------|
| `server.ts` | SPA fallback (404 → index.html), CORS en health |
| `api/_shared/db.ts` | Nuevo: wrapper `getClient()` con `query()` sobre `sql.unsafe()` |
| `api/_shared/auth.ts` | Validación JWT con `jose`, auto-provisioning de usuarios, logs de error |
| `api/_shared/validation.ts` | Agregado `optionalBoolean` |
| `api/router.ts` | 20 rutas registradas, agregado `/api/summary` |
| `api/summary.ts` | Nuevo: handler de KPI consolidados |
| `api/wbs.ts` | Filtros completos: `project_type_id`, `responsible_id`, `assignee_id`, `status`, `date_from`, `date_to`, `search`, `my_tasks` |
| `api/projects.ts` | CRUD proyectos con creación de nodo raíz WBS |
| `api/*.ts` (20 archivos) | Migración de `getDb()` a `getClient()`, `queryObject` a `query`, destructuring corregido |
| `db/migrate.ts` | Migraciones automáticas al iniciar |

### Deploy (`deploy/`)

| Archivo | Descripción |
|---------|-------------|
| `Dockerfile` | Multi-stage: Node build frontend genérico + Deno runtime |
| `docker-compose.prod.yml` | Modo productivo: `container_name: abax-gantt`, variables runtime `PUBLIC_*`, volumen externo `abax-gantt_attachments`, red `infra-net` |
| `docker-compose.bundled.yml` | Modo todo incluido: PostgreSQL + Authentik + ABAX |
| `docker-compose.external.yml` | Modo infraestructura propia |
| `.env.production` | Template de variables de producción |
| `.env.example` | Template de variables |
| `README-INSTALL.md` | Guía de instalación ambos modos |
| `docs/publicacion-contenedor.md` | Runbook operativo de publicación, verificación, diagnóstico y rollback |

---

## 8. Verificación post-publicación

| Prueba | Resultado |
|--------|-----------|
| `docker ps --filter name=abax-gantt` | `abax-gantt` activo en `infra-net` |
| `curl https://demo.breisner.info/abax-gantt/api/health` | `{"status":"ok","db":"connected"}` |
| `curl .../abax-gantt/api/projects` sin token | `401` esperado |

`401` en rutas protegidas confirma que la petición llega al backend. `404` en `/api/*` sin prefijo es esperado porque esa ruta no pertenece al despliegue público.

---

## 9. Endpoints API funcionales

| Método | Ruta | Auth | Estado |
|--------|------|------|--------|
| GET | `/api/health` | No | OK |
| GET | `/api/projects` | JWT | OK |
| POST | `/api/projects` | JWT | OK |
| GET | `/api/wbs` | JWT | OK (filtros completos) |
| POST | `/api/wbs` | JWT | OK |
| GET/PUT/DELETE | `/api/wbs-node/:id` | JWT | OK |
| PATCH | `/api/wbs/schedule/:id` | JWT | OK (warning dependencias) |
| PATCH | `/api/wbs/progress/:id` | JWT | OK |
| PATCH | `/api/wbs/move/:id` | JWT | OK (warning dependencias) |
| GET/POST/DELETE | `/api/dependencies` | JWT | OK |
| GET/POST/DELETE | `/api/assignees` | JWT | OK |
| GET | `/api/backlog` | JWT | OK |
| GET/POST | `/api/timesheet` | JWT | OK |
| GET/POST/DELETE | `/api/attachments` | JWT | OK |
| GET | `/api/export/:id` | JWT | OK (JSON/CSV) |
| GET | `/api/kpi` | JWT | OK |
| GET | `/api/reports` | JWT | OK |
| GET | `/api/summary` | JWT | OK |
| GET | `/api/users` | JWT | OK |
| GET/POST/PUT | `/api/admin/users` | JWT+admin | OK |
| GET/POST/PUT | `/api/admin/project-types` | JWT+admin | OK |
| POST | `/api/import` | JWT | OK |
| POST | `/api/mcp` | API Key | OK |

---

## 10. Pendientes / Diferidos

| Item | Estado |
|------|--------|
| US-24 Export PNG/PDF | Diferido (backend `501`, frontend oculta opción) |
| `project_type_id` en FilterBar UI | Diferido (expuesto en backend, sin UI) |
| Conexión Authentik → outpost con hostname correcto | `.well-known/openid-configuration` sigue devolviendo HTML. Se bypassó con metadata estática. |
| Integración OIDC completa con PKCE real | Funciona con metadata estática. El discovery dinámico queda pendiente. |
| Warm restart del contenedor (Deno descarga deps cada inicio) | Las dependencias JSR/npm se descargan en cada arranque (~30s). |
