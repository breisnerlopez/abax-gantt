# ABAX Gantt — Guía de Instalación y Publicación

## Requisitos

- Docker y Docker Compose.
- (Solo modo bundled) 4 GB de RAM libre.
- (Modo external) PostgreSQL 15+ y Authentik ya configurado.

Para el despliegue productivo actual en `https://demo.breisner.info/abax-gantt`, usar también `docs/publicacion-contenedor.md` como runbook operativo.

## Instalación Rápida (Modo External)

Usar cuando ya se tiene PostgreSQL y Authentik.

```bash
# 1. Configurar variables
cp .env.example .env
# Editar .env con valores reales:
#   DATABASE_URL=postgresql://...
#   AUTHENTIK_ISSUER=https://auth.miempresa.com/application/o/abax-gantt/
#   AUTHENTIK_CLIENT_ID=abax-gantt-spa
#   AUTHENTIK_JWKS_URL=https://auth.miempresa.com/application/o/abax-gantt/jwks/

# 2. Iniciar
docker compose -f docker-compose.external.yml up -d

# 3. Verificar salud
curl http://localhost:8000/api/health
# → {"status":"ok","db":"connected"}

# 4. Acceder
# Frontend: http://localhost:8000
# Login via Authentik de la empresa
```

## Instalación Completa (Modo Bundled)

Usar para instalación independiente con todo incluido.

```bash
# 1. Configurar variables
cp .env.example .env
# Editar .env:
#   AUTH_MODE=bundled
#   AUTHENTIK_SECRET_KEY=<clave aleatoria larga>
#   DEFAULT_ADMIN_EMAIL=admin@miempresa.com
#   DEFAULT_ADMIN_PASSWORD=<contraseña segura>

# 2. Construir e iniciar
docker compose -f docker-compose.bundled.yml up -d --build

# 3. Verificar que todo esté healthy
docker compose -f docker-compose.bundled.yml ps

# 4. Configurar Authentik manualmente (primera vez):
#    a) Acceder a http://localhost:9000
#    b) Crear aplicación OIDC:
#       - Nombre: abax-gantt
#       - Client type: Public
#       - Grant type: Authorization Code
#       - Redirect URI: http://localhost:8000/auth/callback
#       - Scopes: openid email profile groups
#    c) Crear grupo "abax-admins"
#    d) Crear usuario admin y asignarlo al grupo

# 5. Acceder
# Frontend: http://localhost:8000
# Authentik admin: http://localhost:9000
```

## Variables de Entorno Principales

| Variable | Descripción | Momento |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión PostgreSQL | Runtime |
| `AUTHENTIK_ISSUER` | Issuer OIDC del backend | Runtime |
| `AUTHENTIK_CLIENT_ID` | Client ID OIDC | Runtime + build |
| `AUTHENTIK_JWKS_URL` | JWKS URL para validar tokens | Runtime |
| `ADMIN_GROUP` | Grupo Authentik para admins | Runtime |
| `VITE_AUTHENTIK_AUTHORITY` | Issuer OIDC usado por el frontend | Build |
| `VITE_AUTHENTIK_CLIENT_ID` | Client ID usado por el frontend | Build |
| `VITE_AUTHENTIK_REDIRECT_URI` | Callback público del frontend | Build |
| `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | URL pública post logout | Build |
| `VITE_BASE_PATH` | Base pública de assets Vite (`/` o `/abax-gantt/`) | Build |
| `VITE_API_BASE_URL` | Prefijo público API cuando hay subpath | Build |
| `DB_PASSWORD` | Contraseña PostgreSQL interna | Bundled |
| `AUTHENTIK_SECRET_KEY` | Clave secreta Authentik | Bundled |

En producción bajo `/abax-gantt`, `VITE_BASE_PATH` debe ser `/abax-gantt/` y `VITE_API_BASE_URL` debe ser `/abax-gantt`. Si `VITE_API_BASE_URL` queda vacío, el frontend puede llamar a `/api/*` y Traefik devolverá 404.

## Arquitectura Interna

```
docker compose
├── postgres (PostgreSQL 17)
├── abax-gantt / abax-app (Deno HTTP)
│   ├── API REST en /api/*
│   ├── Frontend SPA en /*
│   └── Storage local en /app/data/attachments
└── authentik (solo modo bundled)
```

El contenedor de aplicación ejecuta un solo proceso Deno que:
- Sirve archivos estáticos del frontend (build Vite).
- Sirve la API REST con los mismos handlers de Edge Functions.
- Aplica migraciones automáticamente al iniciar.
- Guarda adjuntos en volumen local.

## Salud y Monitoreo

```bash
# Health check
curl http://localhost:8000/api/health

# Logs
docker compose logs -f abax-app

# Reiniciar
docker compose restart abax-app
```

## Publicación Productiva con Traefik + Subpath

Para servir bajo `demo.breisner.info/abax-gantt`:

```bash
# 1. Crear variables de producción si aún no existen
cd /workspace/abax-gantt/deploy
cp .env.production .env
# Editar DATABASE_URL y valores Authentik reales

# 2. Desplegar reconstruyendo el frontend con los build args del .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

# 3. Verificar salud pública
curl https://demo.breisner.info/abax-gantt/api/health

# 4. Verificar ruta protegida. Debe devolver 401 sin token, no 404.
curl -fsS -o /dev/null -w '%{http_code}\n' https://demo.breisner.info/abax-gantt/api/projects
```

**Configuración necesaria en Authentik:**

| Campo | Valor |
|-------|-------|
| Redirect URI | `https://demo.breisner.info/abax-gantt/auth/callback` |
| Post-logout URI | `https://demo.breisner.info/abax-gantt/login` |

**Traefik automático:**

El `docker-compose.prod.yml` incluye labels para Traefik:

- Ruta: `demo.breisner.info/abax-gantt` hacia `abax-gantt:8000`.
- Strip prefix: Traefik remueve `/abax-gantt` antes de forwardear.
- TLS: certresolver `le`.
- Red: `infra-net` externa.
- Volumen externo: `abax-gantt_attachments`.

La ruta `https://demo.breisner.info/api/*` no es válida en este despliegue. La API pública correcta siempre incluye `/abax-gantt/api/*`.

Para el procedimiento completo de publicación, prerequisitos, verificación y rollback, ver `docs/publicacion-contenedor.md`.

## Operación del Contenedor Productivo

```bash
# Estado
docker ps --filter name=abax-gantt

# Logs recientes
docker logs --since 5m abax-gantt

# Variables activas del contenedor
docker inspect abax-gantt --format '{{range .Config.Env}}{{println .}}{{end}}'

# Volumen montado
docker inspect abax-gantt --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

Antes de publicar cambios grandes, crear un tag local de respaldo:

```bash
docker tag abax-gantt:latest abax-gantt:backup-$(date +%Y%m%d-%H%M)
```

## Publicar Imagen en Registry

La publicación automatizada vive en `.github/workflows/ci.yml` y publica en GHCR.

Tags generados:

| Evento | Tags |
|--------|------|
| Push a `main` | `main`, `sha-<commit>`, `latest` |
| Tag `v*` | `vX.Y.Z`, `sha-<commit>` |
| Pull request | Build sin push |

Construcción manual alternativa con valores definitivos de frontend antes de etiquetar:

```bash
# Ejecutar desde la raiz del repositorio.
docker build -f deploy/Dockerfile -t abax-gantt:latest \
  --build-arg VITE_AUTHENTIK_AUTHORITY=https://auth.breisner.info/application/o/abax-gantt/ \
  --build-arg VITE_AUTHENTIK_CLIENT_ID=abax-gantt-spa \
  --build-arg VITE_AUTHENTIK_REDIRECT_URI=https://demo.breisner.info/abax-gantt/auth/callback \
  --build-arg VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.breisner.info/abax-gantt/login \
  --build-arg VITE_BASE_PATH=/abax-gantt/ \
  --build-arg VITE_API_BASE_URL=/abax-gantt \
  .
```

Etiquetar y publicar con tag inmutable:

```bash
docker tag abax-gantt:latest <registry>/<namespace>/abax-gantt:<version>
docker push <registry>/<namespace>/abax-gantt:<version>
```

No usar `latest` como única referencia de release.

Para desplegar una imagen publicada por CI:

```bash
cd deploy
ABAX_IMAGE=ghcr.io/<owner>/<repo>:<tag> docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build
```

## Backup

- PostgreSQL: usar `pg_dump` contra la base configurada en `DATABASE_URL`.
- Adjuntos: respaldar el volumen `abax-gantt_attachments` o el directorio `STORAGE_PATH`.
- Authentik (modo bundled): respaldar base `authentik` y volumen `media`.
