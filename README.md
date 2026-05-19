# ABAX Gantt

ABAX Gantt es una aplicación web para gestión de portafolio, WBS y cronogramas Gantt. El artefacto publicable actual es una imagen Docker única que sirve frontend React/Vite, API Deno, migraciones PostgreSQL y storage local de adjuntos.

## Estado Actual

| Área | Estado |
|------|--------|
| Frontend | React + DHTMLX Gantt, build Vite |
| Backend | Deno HTTP server en `deploy/server.ts` |
| API | `/api/*` servida dentro del mismo contenedor |
| Base de datos | PostgreSQL con migraciones en `supabase/migrations/` |
| Auth | Authentik OIDC/OAuth2 con validación JWKS |
| Storage | Volumen local `/app/data/attachments` |
| Despliegue actual | `https://demo.breisner.info/abax-gantt` |
| Dataset actual | Migración OpenProject importada |

Documentos operativos principales:

| Documento | Uso |
|-----------|-----|
| `docs/publicacion-contenedor.md` | Runbook de publicación Docker del entorno actual |
| `deploy/README-INSTALL.md` | Guía de instalación y operación del contenedor |
| `docs/estado-despliegue.md` | Estado técnico del despliegue actual |
| `docs/imports/openproject-migration/REVISION.md` | Migración OpenProject aplicada |

## Arquitectura

```text
abax-gantt:latest
├── Deno server :8000
│   ├── /api/*       API REST
│   ├── /storage/*   Adjuntos locales
│   └── /*           SPA React/Vite
├── PostgreSQL       externo o bundled
└── Authentik        externo o bundled
```

En el despliegue actual, Traefik publica la app bajo `/abax-gantt` y remueve ese prefijo antes de enviar tráfico al contenedor.

## Build de Imagen Docker

Desde la raíz del repositorio:

```bash
docker build -f deploy/Dockerfile -t abax-gantt:latest \
  --build-arg VITE_AUTHENTIK_AUTHORITY=https://auth.example.com/application/o/abax-gantt/ \
  --build-arg VITE_AUTHENTIK_CLIENT_ID=abax-gantt-spa \
  --build-arg VITE_AUTHENTIK_REDIRECT_URI=https://demo.example.com/abax-gantt/auth/callback \
  --build-arg VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.example.com/abax-gantt/login \
  --build-arg VITE_BASE_PATH=/abax-gantt/ \
  --build-arg VITE_API_BASE_URL=/abax-gantt \
  .
```

Para servir en la raíz del dominio, usar:

```bash
--build-arg VITE_BASE_PATH=/
--build-arg VITE_API_BASE_URL=
```

`VITE_BASE_PATH` controla rutas de assets del frontend. `VITE_API_BASE_URL` controla a qué prefijo llama el cliente para `/api/*`.

## Publicación Productiva Actual

El despliegue actual se opera desde `deploy/docker-compose.prod.yml`:

```bash
cd deploy
cp .env.production .env
# Editar DATABASE_URL y valores reales.
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Verificación:

```bash
curl -fsS https://demo.breisner.info/abax-gantt/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://demo.breisner.info/abax-gantt/api/projects
```

Resultado esperado:

```text
/api/health -> 200 con {"status":"ok","db":"connected"}
/api/projects sin token -> 401, no 404
```

## Variables Principales

Runtime del contenedor:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL usado por API y migraciones |
| `AUTHENTIK_ISSUER` | Issuer esperado para JWT |
| `AUTHENTIK_CLIENT_ID` | Audience/client ID esperado |
| `AUTHENTIK_JWKS_URL` | JWKS para validar tokens |
| `ADMIN_GROUP` | Grupo Authentik que habilita admin |
| `STORAGE_PATH` | Ruta de adjuntos, por defecto `/app/data/attachments` |

Build del frontend:

| Variable | Descripción |
|----------|-------------|
| `VITE_AUTHENTIK_AUTHORITY` | Authority OIDC usada por el cliente |
| `VITE_AUTHENTIK_CLIENT_ID` | Client ID usado por el cliente |
| `VITE_AUTHENTIK_REDIRECT_URI` | Callback público |
| `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | URL post logout |
| `VITE_BASE_PATH` | Base de assets Vite, por ejemplo `/` o `/abax-gantt/` |
| `VITE_API_BASE_URL` | Prefijo público de API, por ejemplo vacío o `/abax-gantt` |

## Desarrollo Local

El flujo histórico de desarrollo local sigue disponible con Supabase CLI y Edge Functions para pruebas de backend, pero el artefacto publicable es el contenedor de `deploy/`.

```bash
npm install
npm run build
npm run test:unit
```

Para levantar Supabase local:

```bash
npm run db:start
npm run db:reset
```

Para frontend local:

```bash
npm --prefix poc run dev
```

## Migración OpenProject

El dataset OpenProject ya fue importado en el entorno actual. La documentación y utilidades están en:

```text
docs/imports/openproject-migration/REVISION.md
tools/openproject-import.ts
tools/openproject-migration.mjs
```

Comandos:

```bash
npm run migration:openproject
npm run migration:openproject:write
npm run migration:openproject:apply
```

## Publicar Imagen en un Registry

El CI publica la imagen en GitHub Container Registry (GHCR) desde `.github/workflows/ci.yml`.

Publicación automática:

| Evento | Acción |
|--------|--------|
| Pull request | Build Docker sin push |
| Push a `main` | Push a GHCR con tags `main`, `sha-<commit>` y `latest` |
| Tag `v*` | Push a GHCR con tag de versión y `sha-<commit>` |
| `workflow_dispatch` | Ejecución manual del mismo flujo |

Imagen publicada:

```text
ghcr.io/<owner>/<repo>:<tag>
```

Variables recomendadas en GitHub Actions (`Settings` → `Secrets and variables` → `Actions` → `Variables`):

```env
VITE_AUTHENTIK_AUTHORITY=https://auth.breisner.info/application/o/abax-gantt/
VITE_AUTHENTIK_CLIENT_ID=abax-gantt-spa
VITE_AUTHENTIK_REDIRECT_URI=https://demo.breisner.info/abax-gantt/auth/callback
VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.breisner.info/abax-gantt/login
VITE_BASE_PATH=/abax-gantt/
VITE_API_BASE_URL=/abax-gantt
```

El workflow tiene defaults para el entorno demo, pero se recomienda declarar las variables explícitamente antes de publicar releases.

Para publicar manualmente fuera de CI, crear un tag inmutable:

```bash
docker tag abax-gantt:latest <registry>/<namespace>/abax-gantt:<version>
docker push <registry>/<namespace>/abax-gantt:<version>
```

No publicar tags ambiguos como único mecanismo de release. Mantener `latest` solo como conveniencia local.

Para desplegar una imagen ya publicada con `docker-compose.prod.yml`:

```bash
cd deploy
ABAX_IMAGE=ghcr.io/<owner>/<repo>:<tag> docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build
```

## Referencias

- `deploy/README-INSTALL.md`
- `docs/publicacion-contenedor.md`
- `docs/estado-despliegue.md`
- `docs/api.md`
- `docs/qa-test-suite.md`
- `docs/imports/openproject-migration/REVISION.md`
