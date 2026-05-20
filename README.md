# ABAX Gantt

Gestor de portafolio, WBS y cronogramas Gantt auto-contenido en una imagen Docker. Un solo proceso Deno sirve la API REST, el frontend SPA (React + DHTMLX Gantt), aplica migraciones PostgreSQL y gestiona adjuntos locales. Autenticación vía OIDC con Authentik.

## Demo

[https://demo.breisner.info/abax-gantt](https://demo.breisner.info/abax-gantt)

## Quick Start

```bash
docker pull ghcr.io/breisnerlopez/abax-gantt:v0.1.0

docker run --rm --name abax-gantt -p 8000:8000 \
  -e DATABASE_URL='postgresql://abax:<password>@<host>:5432/abax_gantt' \
  -e AUTHENTIK_ISSUER='https://auth.example.com/application/o/abax-gantt/' \
  -e AUTHENTIK_CLIENT_ID='abax-gantt-spa' \
  -e AUTHENTIK_JWKS_URL='https://auth.example.com/application/o/abax-gantt/jwks/' \
  -e PUBLIC_AUTHENTIK_AUTHORITY='https://auth.example.com/application/o/abax-gantt/' \
  -e PUBLIC_AUTHENTIK_CLIENT_ID='abax-gantt-spa' \
  -e PUBLIC_AUTHENTIK_REDIRECT_URI='https://gantt.example.com/auth/callback' \
  -e PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI='https://gantt.example.com/login' \
  -e PUBLIC_BASE_PATH='/' \
  -e PUBLIC_API_BASE_URL='' \
  -v abax-gantt_data:/app/data/attachments \
  -d ghcr.io/breisnerlopez/abax-gantt:v0.1.0
```

Accede en `http://localhost:8000`. El primer usuario que haga login con grupo `abax-admins` obtiene rol admin.

### Docker Compose

```bash
cd deploy
cp .env.example .env
# Editar DATABASE_URL y valores de Authentik
docker compose -f docker-compose.external.yml up -d
```

Modos disponibles: `docker-compose.external.yml` (infraestructura propia), `docker-compose.bundled.yml` (todo incluido: PostgreSQL + Authentik + ABAX).

## Configuración

La imagen es genérica: dominio público, subpath y Authentik se configuran con variables `PUBLIC_*` al arrancar. No hace falta reconstruir para cambiar de dominio.

### Variables Runtime — Backend

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión PostgreSQL | Requerido |
| `AUTHENTIK_ISSUER` | Issuer OIDC para validación JWT | Requerido |
| `AUTHENTIK_CLIENT_ID` | Client ID OIDC esperado | Requerido |
| `AUTHENTIK_JWKS_URL` | JWKS para validar tokens | Requerido |
| `ADMIN_GROUP` | Grupo Authentik con rol admin | `abax-admins` |
| `STORAGE_PATH` | Directorio de adjuntos | `/app/data/attachments` |
| `PORT` | Puerto HTTP del servidor | `8000` |

### Variables Runtime — Frontend Público

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PUBLIC_BASE_PATH` | Subpath de la app (`/` o `/abax-gantt/`) | `/` |
| `PUBLIC_API_BASE_URL` | Prefijo público de la API | derivado de `PUBLIC_BASE_PATH` |
| `PUBLIC_AUTHENTIK_AUTHORITY` | Authority OIDC para el frontend | — |
| `PUBLIC_AUTHENTIK_CLIENT_ID` | Client ID para el frontend | — |
| `PUBLIC_AUTHENTIK_REDIRECT_URI` | URL de callback post-login | derivado de `PUBLIC_BASE_PATH` |
| `PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | URL post logout | derivado de `PUBLIC_BASE_PATH` |

### Subpath

Para servir bajo `/abax-gantt`:

| Variable | Valor |
|----------|-------|
| `PUBLIC_BASE_PATH` | `/abax-gantt/` |
| `PUBLIC_API_BASE_URL` | `/abax-gantt` |
| `PUBLIC_AUTHENTIK_REDIRECT_URI` | `https://<dominio>/abax-gantt/auth/callback` |
| `PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | `https://<dominio>/abax-gantt/login` |

El proxy reverso debe remover el prefijo antes de forwardear (Traefik: `stripprefix`; Nginx: `proxy_pass` sin path).

### Authentik

Configurar en Authentik:

| Campo | Valor |
|-------|-------|
| Client type | Public |
| Grant type | Authorization Code + PKCE |
| Scopes | `openid email profile groups` |
| Redirect URI | `https://<dominio>/<subpath>/auth/callback` |
| Post-logout URI | `https://<dominio>/<subpath>/login` |

Crear grupo `abax-admins` (o el definido en `ADMIN_GROUP`) y asignarlo a usuarios admin.

## Persistencia y Backup

### Volúmenes

| Volumen | Montaje | Contenido |
|---------|---------|-----------|
| `abax-gantt_data` | `/app/data/attachments` | Adjuntos subidos por usuarios |

### Backup

```bash
# Base de datos
pg_dump "$DATABASE_URL" > abax-gantt-$(date +%Y%m%d).sql

# Adjuntos
tar czf abax-gantt-attachments-$(date +%Y%m%d).tar.gz /app/data/attachments
```

## Tags y Releases

| Evento | Tags generados |
|--------|---------------|
| Push a `main` | `main`, `sha-<commit>`, `latest` |
| Tag `v*` | `vX.Y.Z`, `sha-<commit>` |
| Pull request | Build sin push |

No usar `latest` como referencia única de release. Usar tags inmutables (`vX.Y.Z`).

## Desarrollo

```bash
# Instalar dependencias
npm install && npm --prefix poc install

# Build frontend
npm run build

# Lint
npm run lint

# Tests unitarios frontend
npm run smoke:frontend

# E2E con Playwright
npm run smoke:e2e

# Desarrollo local del frontend
npm --prefix poc run dev
```

### Build de Imagen

```bash
docker build -f deploy/Dockerfile -t abax-gantt:latest .
```

## Arquitectura

```
docker pull ghcr.io/breisnerlopez/abax-gantt:v0.1.0
       │
       ▼
┌─────────────────────────────────────────┐
│  abax-gantt (Deno HTTP :8000)           │
│  ├── /api/*            API REST         │
│  ├── /storage/*        Adjuntos locales │
│  ├── /*                SPA React/Vite   │
│  ├── /config.js        Runtime config   │
│  └── /sw.js            Service worker   │
├─────────────────────────────────────────┤
│  PostgreSQL            externo o bundled │
│  Authentik             externo o bundled │
│  /app/data/attachments  volumen Docker   │
└─────────────────────────────────────────┘
```

## Documentación

| Documento | Contenido |
|-----------|-----------|
| `deploy/README-INSTALL.md` | Instalación paso a paso, variables, monitoreo y publicación |
| `docs/publicacion-contenedor.md` | Runbook operativo de publicación, verificación y rollback |
| `docs/estado-despliegue.md` | Estado técnico del despliegue actual y bugs corregidos |
| `docs/api.md` | Referencia de la API REST |
| `docs/qa-test-suite.md` | Suite de tests y smoke |
| `docs/imports/openproject-migration/REVISION.md` | Migración OpenProject aplicada |

## Licencia

MIT
