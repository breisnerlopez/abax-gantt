# Diseño de Despliegue Instalable — ABAX Gantt

> **Archivado.** Este documento describe el diseño de referencia original. La implementación real está en `deploy/`:
> - `deploy/Dockerfile` — build multi-stage
> - `deploy/docker-compose.external.yml` — modo infraestructura propia
> - `deploy/docker-compose.bundled.yml` — modo todo incluido
> - `deploy/README-INSTALL.md` — guía de instalación actualizada
>
> Ver `README.md` para quickstart y configuración runtime con `PUBLIC_*`.

**Versión:** 1.0 (archivado)  
**Fecha:** Mayo 2026  
**Destino:** Producto instalable con Docker Compose

---

## 1. Arquitectura Simplificada

```
docker-compose.yml
─────────────────────────────────────────────────────────────
│  abax-app          │  authentik           │  postgres      │
│  (Deno HTTP)       │  (OIDC IdP)          │  (opcional)    │
│                    │                      │                │
│  • /api/*   (API)  │  • OAuth2/OIDC       │  • shared o    │
│  • /*       (SPA)  │  • login, MFA, SSO   │    interno     │
│  • storage  (local)│  • grupos, políticas  │                │
│                    │                      │                │
│  Puerto: 8000      │  Puerto: 9000        │  Puerto: 5432  │
└────────────────────┴──────────────────────┴────────────────┘
```

- `abax-app`: un solo contenedor Deno que sirve API + frontend estático + storage local.
- `authentik`: solo en modo bundled. En modo external se omite.
- `postgres`: solo en modo bundled. En modo external se usa uno existente.

---

## 2. El Contenedor `abax-app`

### 2.1 Qué incluye

| Función | Cómo se resuelve |
|---------|-----------------|
| API REST | Mismas funciones Deno/TypeScript de `supabase/functions/`, servidas por un solo `Deno.serve()` con router |
| Frontend SPA | Build de Vite (`poc/dist/`), servido como archivos estáticos por el mismo servidor Deno |
| Storage local | Directorio `./data/attachments/` montado como volumen. Sin S3, sin Supabase Storage |
| Conexión DB | PostgreSQL vía `postgres` (npm) con connection pool. Service role implícito (sin RLS) |
| Auth | Validación JWT contra Authentik vía JWKS (igual que en Edge Functions) |
| Migraciones | Ejecutadas al iniciar el contenedor desde `supabase/migrations/` |

### 2.2 Punto de entrada único

```typescript
// server.ts — entrypoint del contenedor abax-app

import { serveDir } from "jsr:@std/http/file-server";
import { router } from "./api/router.ts";
import { runMigrations } from "./db/migrate.ts";
import { ensureStorageDir } from "./storage/init.ts";

// 1. Aplicar migraciones al iniciar
await runMigrations();

// 2. Crear directorio de adjuntos
await ensureStorageDir();

// 3. Servir API + frontend
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // API
  if (url.pathname.startsWith("/api/")) {
    return router(req);
  }

  // Storage (adjuntos servidos directamente)
  if (url.pathname.startsWith("/storage/")) {
    return serveDir(req, { fsRoot: "./data/attachments", urlRoot: "/storage" });
  }

  // Frontend SPA
  return serveDir(req, {
    fsRoot: "./public",
    urlRoot: "",
    showIndex: true,      // fallback a index.html para rutas SPA
  });
});
```

### 2.3 Router de API

El mismo código de Edge Functions se reutiliza. Cada función se registra como ruta:

```typescript
// api/router.ts
import { apiWbs } from "./wbs.ts";
import { apiProjects } from "./projects.ts";
import { apiDependencies } from "./dependencies.ts";
// ... resto de funciones

export function router(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/api/wbs" || url.pathname.startsWith("/api/wbs/")) {
    return apiWbs(req);
  }
  if (url.pathname === "/api/projects" || url.pathname.startsWith("/api/projects/")) {
    return apiProjects(req);
  }
  // ... resto de rutas

  return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
}
```

Cada archivo exporta la misma función `Deno.serve()` o se adapta para retornar `Response`.

### 2.4 Migraciones automáticas

```typescript
// db/migrate.ts
import { Client } from "npm:postgres";

export async function runMigrations() {
  const client = new Client(Deno.env.get("DATABASE_URL")!);
  await client.connect();

  // Crear tabla de control si no existe
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Listar archivos de migración ordenados
  const migrationsDir = "./migrations";
  const files = [...Deno.readDirSync(migrationsDir)]
    .filter((f) => f.name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    // Verificar si ya se ejecutó
    const { rows } = await client.query(
      `SELECT 1 FROM _migrations WHERE name = $1`,
      [file.name]
    );
    if (rows.length > 0) continue;

    // Ejecutar migración
    const sql = Deno.readTextFileSync(`${migrationsDir}/${file.name}`);
    await client.query(sql);
    await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file.name]);
  }

  await client.close();
}
```

### 2.5 Dockerfile único

```dockerfile
# Dockerfile
FROM denoland/deno:2.2-alpine

WORKDIR /app

# Copiar archivos fuente
COPY server.ts .
COPY api/ ./api/
COPY db/ ./db/
COPY storage/ ./storage/
COPY migrations/ ./migrations/
COPY public/ ./public/

# Volumen para adjuntos
VOLUME /app/data/attachments

# Puerto
EXPOSE 8000

# Entrypoint
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "server.ts"]
```

---

## 3. Dos Modos de Instalación

### 3.1 Modo Bundled (todo incluido)

Para instalaciones simples, demos o clientes sin infraestructura.

```yaml
# docker-compose.bundled.yml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: abax
      POSTGRES_PASSWORD: ${DB_PASSWORD:-abax_secret}
      POSTGRES_DB: abax
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U abax"]
      interval: 5s

  authentik:
    image: ghcr.io/goauthentik/server:latest
    environment:
      AUTHENTIK_SECRET_KEY: ${AUTHENTIK_SECRET_KEY}
      AUTHENTIK_ERROR_REPORTING__ENABLED: "false"
      AUTHENTIK_POSTGRESQL__HOST: postgres
      AUTHENTIK_POSTGRESQL__NAME: authentik
      AUTHENTIK_POSTGRESQL__USER: abax
      AUTHENTIK_POSTGRESQL__PASSWORD: ${DB_PASSWORD:-abax_secret}
    volumes:
      - media:/media
      - custom-templates:/templates
    ports:
      - "9000:9000"
    depends_on:
      postgres:
        condition: service_healthy

  abax-app:
    build: .
    environment:
      DATABASE_URL: postgresql://abax:${DB_PASSWORD:-abax_secret}@postgres:5432/abax
      AUTHENTIK_ISSUER: http://authentik:9000/application/o/abax-gantt/
      AUTHENTIK_CLIENT_ID: ${AUTHENTIK_CLIENT_ID:-abax-gantt}
      AUTHENTIK_JWKS_URL: http://authentik:9000/application/o/abax-gantt/jwks/
      STORAGE_PATH: /app/data/attachments
      DEFAULT_ADMIN_EMAIL: ${DEFAULT_ADMIN_EMAIL:-admin@abax.local}
      DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD:-ChangeMe123!}
      ADMIN_GROUP: abax-admins
    ports:
      - "8000:8000"
    volumes:
      - attachments:/app/data/attachments
    depends_on:
      postgres:
        condition: service_healthy
      authentik:
        condition: service_started

volumes:
  pgdata:
  media:
  custom-templates:
  attachments:
```

**Bootstrap en modo bundled:**

1. Levanta PostgreSQL + Authentik.
2. Crea base de datos `abax` y `authentik`.
3. Crea aplicación OIDC en Authentik vía API.
4. Crea grupo `abax-admins`.
5. Crea usuario admin inicial.
6. Aplica migraciones de ABAX.
7. Crea bucket de adjuntos local.
8. El usuario entra con `admin@abax.local` / `ChangeMe123!`.

### 3.2 Modo External (infraestructura propia)

Para clientes que ya tienen Authentik y PostgreSQL.

```yaml
# docker-compose.external.yml
services:
  abax-app:
    build: .
    environment:
      DATABASE_URL: ${DATABASE_URL}
      AUTHENTIK_ISSUER: ${AUTHENTIK_ISSUER}
      AUTHENTIK_CLIENT_ID: ${AUTHENTIK_CLIENT_ID}
      AUTHENTIK_JWKS_URL: ${AUTHENTIK_JWKS_URL}
      STORAGE_PATH: /app/data/attachments
      ADMIN_GROUP: ${ADMIN_GROUP:-abax-admins}
      AUTH_MODE: external
    ports:
      - "8000:8000"
    volumes:
      - attachments:/app/data/attachments

volumes:
  attachments:
```

**Bootstrap en modo external:**

1. Valida conexión a PostgreSQL.
2. Aplica migraciones.
3. Valida conexión a Authentik (JWKS reachable).
4. Crea bucket de adjuntos local.
5. No crea usuarios: Authentik es fuente de verdad.
6. Primer usuario que haga login con grupo `abax-admins` queda como admin.

---

## 4. Variables de Entorno

### 4.1 Comunes

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión PostgreSQL | Requerido |
| `AUTHENTIK_ISSUER` | Issuer OIDC de Authentik | Requerido |
| `AUTHENTIK_CLIENT_ID` | Client ID OIDC | Requerido |
| `AUTHENTIK_JWKS_URL` | URL de JWKS para validar tokens | Requerido |
| `STORAGE_PATH` | Directorio de adjuntos | `/app/data/attachments` |
| `ADMIN_GROUP` | Grupo Authentik que asigna rol admin | `abax-admins` |
| `AUTH_MODE` | `bundled` o `external` | `external` |

### 4.2 Solo modo bundled

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | Contraseña PostgreSQL | `abax_secret` |
| `AUTHENTIK_SECRET_KEY` | Clave secreta de Authentik | Requerido |
| `DEFAULT_ADMIN_EMAIL` | Email del admin inicial | `admin@abax.local` |
| `DEFAULT_ADMIN_PASSWORD` | Contraseña del admin inicial | `ChangeMe123!` |

---

## 5. Instalación Paso a Paso

### 5.1 Modo Bundled

```bash
# 1. Clonar o descargar el paquete
git clone <repo> abax-gantt && cd abax-gantt

# 2. Configurar variables
cp .env.example .env
# Editar .env:
#   AUTHENTIK_SECRET_KEY=<generar clave>
#   DEFAULT_ADMIN_EMAIL=admin@miempresa.com
#   DEFAULT_ADMIN_PASSWORD=<contraseña segura>

# 3. Construir e iniciar
docker compose -f docker-compose.bundled.yml up -d

# 4. Verificar
curl http://localhost:8000/api/kpi -H "Authorization: Bearer <token>"

# 5. Acceder
# Frontend: http://localhost:8000
# Authentik: http://localhost:9000
```

### 5.2 Modo External

```bash
# 1. Configurar variables
cp .env.example .env
# Editar .env con valores de infraestructura existente:
#   DATABASE_URL=postgresql://...
#   AUTHENTIK_ISSUER=https://auth.miempresa.com/application/o/abax-gantt/
#   AUTHENTIK_CLIENT_ID=abax-gantt
#   AUTHENTIK_JWKS_URL=https://auth.miempresa.com/application/o/abax-gantt/jwks/

# 2. Iniciar
docker compose -f docker-compose.external.yml up -d

# 3. Verificar
curl http://localhost:8000/api/health

# 4. Acceder
# Frontend: http://localhost:8000
# Authentik: usar URL de la empresa
```

---

## 6. Storage de Adjuntos

En modo self-hosted, los adjuntos se guardan en el sistema de archivos local:

```
/app/data/attachments/
├── <project-uuid>/
│   ├── <attachment-uuid>.pdf
│   └── <attachment-uuid>.png
```

- Servidos directamente por Deno vía `/storage/<project-id>/<file>`.
- Validación de acceso: el middleware de API verifica que el usuario tiene permiso sobre el proyecto.
- Límites: 5 MB por archivo, 5 archivos por proyecto (aplicado en backend, no en filesystem).

Para producción con múltiples réplicas, montar un volumen NFS o S3-compatible con un adaptador de storage.

---

## 7. Salud y Monitoreo

### 7.1 Health Check

```
GET /api/health
→ 200 { "status": "ok", "db": "connected", "authentik_jwks": "reachable" }
```

### 7.2 Logs

Deno escribe a stdout/stderr. Docker Compose los captura:

```bash
docker compose logs -f abax-app
```

Para producción, redirigir a un agregador de logs.

---

## 8. Plan de Implementación del Despliegue

| Tarea | Descripción | Output |
|-------|-------------|--------|
| D-01 | Crear `server.ts` con servidor Deno HTTP unificado | Entrypoint funcional |
| D-02 | Adaptar Edge Functions a módulos de router Deno | `api/` reutilizando código |
| D-03 | Implementar migraciones automáticas | `db/migrate.ts` |
| D-04 | Implementar storage local | `storage/init.ts` |
| D-05 | Crear `Dockerfile` para `abax-app` | Imagen contenedor |
| D-06 | Crear `docker-compose.bundled.yml` | Modo todo incluido |
| D-07 | Crear `docker-compose.external.yml` | Modo infraestructura propia |
| D-08 | Crear `.env.example` | Variables documentadas |
| D-09 | Crear script bootstrap para modo bundled | `bootstrap.ts` |
| D-10 | Probar instalación limpia bundled | Docker Compose up desde cero |
| D-11 | Probar instalación limpia external | Docker Compose up con PostgreSQL externo |
| D-12 | Crear `README-INSTALL.md` | Guía de instalación |
| D-13 | Validar health check, logs y storage | Pruebas funcionales |
