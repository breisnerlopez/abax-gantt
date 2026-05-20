# Publicación del Contenedor — ABAX Gantt

Fecha de referencia: 2026-05-19

Esta guía documenta el flujo operativo para publicar la imagen genérica de ABAX Gantt en el entorno actual `https://demo.breisner.info/abax-gantt`.

## 1. Estado Actual

| Elemento | Valor |
|----------|-------|
| Contenedor | `abax-gantt` |
| Imagen local | `abax-gantt:latest` |
| Imagen publicada | `ghcr.io/<owner>/<repo>:<tag>` |
| Red Docker | `infra-net` |
| Puerto interno | `8000` |
| Volumen adjuntos | `abax-gantt_attachments:/app/data/attachments` |
| URL pública | `https://demo.breisner.info/abax-gantt` |
| Health público | `https://demo.breisner.info/abax-gantt/api/health` |
| Base pública frontend | `/abax-gantt/` |
| Base API frontend | `/abax-gantt` |

El contenedor sirve frontend y API desde el mismo proceso Deno:

| Ruta externa | Ruta dentro del contenedor | Uso |
|--------------|---------------------------|-----|
| `/abax-gantt/` | `/` | SPA React/Vite |
| `/abax-gantt/api/*` | `/api/*` | API REST |
| `/abax-gantt/storage/*` | `/storage/*` | Adjuntos |

Traefik remueve `/abax-gantt` antes de enviar la petición al contenedor.

## 2. Archivos Relevantes

| Archivo | Propósito |
|---------|-----------|
| `deploy/Dockerfile` | Build multi-stage: frontend Vite + runtime Deno |
| `deploy/docker-compose.prod.yml` | Publicación productiva del contenedor existente |
| `deploy/.env.production` | Template de variables productivas |
| `deploy/README-INSTALL.md` | Guía general de instalación |
| `docs/estado-despliegue.md` | Estado histórico del despliegue actual |

## 3. Variables Requeridas

El deploy productivo necesita variables runtime del backend y variables públicas runtime del frontend.

Runtime del contenedor:

```env
DATABASE_URL=postgresql://<usuario>:<password>@<host>:5432/<db>
AUTHENTIK_ISSUER=https://auth.breisner.info/application/o/abax-gantt/
AUTHENTIK_CLIENT_ID=abax-gantt-spa
AUTHENTIK_JWKS_URL=https://auth.breisner.info/application/o/abax-gantt/jwks/
ADMIN_GROUP=abax-admins
```

Runtime público del frontend:

```env
PUBLIC_AUTHENTIK_AUTHORITY=https://auth.breisner.info/application/o/abax-gantt/
PUBLIC_AUTHENTIK_CLIENT_ID=abax-gantt-spa
PUBLIC_AUTHENTIK_REDIRECT_URI=https://demo.breisner.info/abax-gantt/auth/callback
PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.breisner.info/abax-gantt/login
PUBLIC_BASE_PATH=/abax-gantt/
PUBLIC_API_BASE_URL=/abax-gantt
```

`PUBLIC_BASE_PATH=/abax-gantt/` y `PUBLIC_API_BASE_URL=/abax-gantt` son críticos para subpath. Si falta el API base, el frontend puede llamar a `/api/*`; esa ruta no entra al router de Traefik y produce 404. Si falta el base path, React Router, service worker y callbacks pueden resolverse contra una ruta pública incorrecta.

## 4. Preparar `.env` Productivo

En el servidor, crear `deploy/.env` a partir del template y ajustar `DATABASE_URL` con el valor real. El archivo `.env.production` es un template, no debe usarse sin editar.

```bash
cd /workspace/abax-gantt/deploy
cp .env.production .env
```

Verificar que `.env` tenga, como mínimo:

```env
DATABASE_URL=postgresql://abax:<password>@<host>:5432/abax_gantt
AUTHENTIK_ISSUER=https://auth.breisner.info/application/o/abax-gantt/
AUTHENTIK_CLIENT_ID=abax-gantt-spa
AUTHENTIK_JWKS_URL=https://auth.breisner.info/application/o/abax-gantt/jwks/
ADMIN_GROUP=abax-admins
PUBLIC_AUTHENTIK_AUTHORITY=https://auth.breisner.info/application/o/abax-gantt/
PUBLIC_AUTHENTIK_CLIENT_ID=abax-gantt-spa
PUBLIC_AUTHENTIK_REDIRECT_URI=https://demo.breisner.info/abax-gantt/auth/callback
PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.breisner.info/abax-gantt/login
PUBLIC_BASE_PATH=/abax-gantt/
PUBLIC_API_BASE_URL=/abax-gantt
```

No versionar `deploy/.env` si contiene credenciales reales.

Verificar prerequisitos externos:

```bash
docker network inspect infra-net >/dev/null
docker volume inspect abax-gantt_attachments >/dev/null || docker volume create abax-gantt_attachments
```

## 5. Publicar

Desde el servidor:

```bash
cd /workspace/abax-gantt/deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Este comando:

- Construye o descarga `abax-gantt` y configura el frontend desde variables runtime.
- Recrea el contenedor con nombre fijo `abax-gantt`.
- Reutiliza el volumen externo `abax-gantt_attachments`.
- Mantiene el servicio en la red `infra-net`.

Para usar una imagen ya publicada por CI en vez de construir localmente:

```bash
cd /workspace/abax-gantt/deploy
ABAX_IMAGE=ghcr.io/<owner>/<repo>:<tag> docker compose -f docker-compose.prod.yml --env-file .env up -d --no-build
```

## 6. Publicar Sin `.env` Local

Si el `.env` todavía no existe, se pueden tomar los valores del contenedor desplegado y ejecutar el deploy con variables inline:

```bash
cd /workspace/abax-gantt/deploy
DATABASE_URL='postgresql://abax:<password>@<host>:5432/abax_gantt' \
AUTHENTIK_ISSUER='https://auth.breisner.info/application/o/abax-gantt/' \
AUTHENTIK_CLIENT_ID='abax-gantt-spa' \
AUTHENTIK_JWKS_URL='https://auth.breisner.info/application/o/abax-gantt/jwks/' \
ADMIN_GROUP='abax-admins' \
PUBLIC_AUTHENTIK_AUTHORITY='https://auth.breisner.info/application/o/abax-gantt/' \
PUBLIC_AUTHENTIK_CLIENT_ID='abax-gantt-spa' \
PUBLIC_AUTHENTIK_REDIRECT_URI='https://demo.breisner.info/abax-gantt/auth/callback' \
PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI='https://demo.breisner.info/abax-gantt/login' \
PUBLIC_BASE_PATH='/abax-gantt/' \
PUBLIC_API_BASE_URL='/abax-gantt' \
docker compose -f docker-compose.prod.yml up -d --build
```

Este modo sirve para emergencias. Para operación normal, usar `deploy/.env`.

## 7. Verificación

Después de publicar:

```bash
docker ps --filter name=abax-gantt --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Networks}}'
docker logs --since 2m abax-gantt
curl -fsS https://demo.breisner.info/abax-gantt/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://demo.breisner.info/abax-gantt/api/projects
```

Resultados esperados:

| Comando | Resultado esperado |
|---------|--------------------|
| `docker ps` | `abax-gantt` en `infra-net`, estado `Up` |
| `docker logs` | Migraciones `ya ejecutada` o `completadas`, servidor en puerto 8000 |
| `/abax-gantt/api/health` | `{"status":"ok","db":"connected"}` |
| `/abax-gantt/api/projects` sin token | `401` |

Un `401` en rutas protegidas confirma que Traefik llegó al backend. Un `404` indicaría problema de ruta/proxy/build frontend.

## 8. Diagnóstico Rápido

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| Frontend llama a `/api/*` | Falta `PUBLIC_API_BASE_URL=/abax-gantt` | Ajustar `.env` y recrear contenedor |
| Rutas SPA/callback bajo subpath fallan | Falta `PUBLIC_BASE_PATH=/abax-gantt/` | Ajustar `.env` y recrear contenedor |
| `/abax-gantt/api/health` da 404 | Traefik no enruta o no aplica strip prefix | Revisar labels y middleware `abax-gantt-strip` |
| `/abax-gantt/api/projects` da 401 | Normal sin token | Probar con sesión válida en navegador |
| SPA `/login` o `/gantt` da 404 | Fallback SPA roto | Revisar `deploy/server.ts` y build frontend |
| Navegador sigue usando rutas viejas | Service worker/cache viejo | Probar incógnito o limpiar site data |
| Contenedor nuevo con otro nombre | Compose ejecutado sin `container_name` o proyecto distinto | Usar `deploy/docker-compose.prod.yml` actual |

## 9. Rollback Operativo

Si el contenedor nuevo falla durante el arranque:

```bash
docker logs --since 5m abax-gantt
docker ps -a --filter name=abax-gantt
```

Si existe una imagen previa etiquetada, volver a levantarla con el mismo compose ajustando `image`. Si no existe tag previo, reconstruir desde el commit/artefacto anterior y ejecutar:

```bash
cd /workspace/abax-gantt/deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Antes de cambios de alto riesgo, crear un tag local de respaldo:

```bash
docker tag abax-gantt:latest abax-gantt:backup-$(date +%Y%m%d-%H%M)
```

## 10. Checklist Antes de Publicar

- `deploy/.env` existe y contiene valores reales.
- `PUBLIC_API_BASE_URL=/abax-gantt` está definido.
- `PUBLIC_BASE_PATH=/abax-gantt/` está definido.
- `PUBLIC_AUTHENTIK_REDIRECT_URI` apunta a `/abax-gantt/auth/callback`.
- `PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` apunta a `/abax-gantt/login`.
- La red externa `infra-net` existe.
- El volumen externo `abax-gantt_attachments` existe.
- `docker compose -f docker-compose.prod.yml --env-file .env config` no muestra variables vacías.
- Después del deploy, `/abax-gantt/api/health` responde OK.

## 11. Publicar Imagen en Registry

La publicación está integrada en GitHub Actions (`.github/workflows/ci.yml`) y usa GHCR.

Publicación automática:

| Evento | Resultado |
|--------|-----------|
| PR | Construye imagen sin push |
| Push a `main` | Publica `ghcr.io/<owner>/<repo>:main`, `:sha-<commit>` y `:latest` |
| Tag `v*` | Publica `ghcr.io/<owner>/<repo>:vX.Y.Z` y `:sha-<commit>` |
| Manual (`workflow_dispatch`) | Ejecuta el mismo workflow |

El workflow no necesita variables de dominio/Auth: la imagen publicada es genérica y esos valores se pasan al contenedor con `PUBLIC_*`. Build manual:

```bash
docker build -f deploy/Dockerfile -t abax-gantt:latest \
  .
```

Tag y push:

```bash
docker tag abax-gantt:latest <registry>/<namespace>/abax-gantt:<version>
docker push <registry>/<namespace>/abax-gantt:<version>
```

Para despliegues en raíz de dominio, usar la misma imagen con `PUBLIC_BASE_PATH=/` y `PUBLIC_API_BASE_URL=`.
