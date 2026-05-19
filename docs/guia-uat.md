# Guía UAT — ABAX Gantt

**Objetivo:** probar, corregir y dejar pulido el producto para entrega.  
**URL:** `https://demo.breisner.info/abax-gantt`

---

## 1. Arquitectura (lo que tenés que saber)

```
Internet → Cloudflare Tunnel → Traefik → abax-gantt (Deno, puerto 8000)
                                              │
                                         shared-postgres (DB: abax_gantt)

Authentik ────┐
              ├── Traefik → auth.breisner.info → authentik-server:9000
              └── mismo shared-postgres (DB: authentik)
```

**Una sola máquina, todo Docker.** No hay Kubernetes, no hay Supabase Cloud.

---

## 2. Accesos

| Recurso | URL |
|---------|-----|
| **ABAX Gantt** | `https://demo.breisner.info/abax-gantt` |
| **Authentik Admin** | `https://auth.breisner.info` |
| Admin user | `akadmin` / `root@example.com` |
| PostgreSQL | `shared-postgres:5432`, DB `abax_gantt`, user `abax` / pass `abax` |

---

## 3. Comandos esenciales

```bash
# Ver estado de los contenedores
docker ps | grep -E 'abax|authentik|postgres|traefik'

# Logs del servidor (errores en tiempo real)
docker logs abax-gantt -f 2>&1 | grep -v Download

# Logs de Authentik
docker logs authentik-server -f 2>&1 | grep -i error

# Logs de Traefik (ver si las requests llegan)
docker logs secure-traefik -f 2>&1 | grep abax-gantt

# Health check rápido
curl -sk https://demo.breisner.info/abax-gantt/api/health

# Reiniciar el servidor (si tocás código)
docker stop abax-gantt && docker rm abax-gantt

# Reconstruir y desplegar (desde /workspace/abax-gantt)
docker build -f deploy/Dockerfile \
  --build-arg VITE_AUTHENTIK_AUTHORITY="https://auth.breisner.info/application/o/abax-gantt/" \
  --build-arg VITE_AUTHENTIK_CLIENT_ID="abax-gantt-spa" \
  --build-arg VITE_AUTHENTIK_REDIRECT_URI="https://demo.breisner.info/abax-gantt/auth/callback" \
  --build-arg VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI="https://demo.breisner.info/abax-gantt/login" \
  --build-arg VITE_API_BASE_URL="/abax-gantt" \
  -t abax-gantt:latest .

docker run -d --name abax-gantt \
  --network infra-net \
  -e DATABASE_URL="postgresql://abax:abax@shared-postgres:5432/abax_gantt" \
  -e AUTHENTIK_ISSUER="https://auth.breisner.info/application/o/abax-gantt/" \
  -e AUTHENTIK_CLIENT_ID="abax-gantt-spa" \
  -e AUTHENTIK_JWKS_URL="https://auth.breisner.info/application/o/abax-gantt/jwks/" \
  -e STORAGE_PATH="/app/data/attachments" \
  -e ADMIN_GROUP="abax-admins" \
  abax-gantt:latest
```

---

## 4. Dónde está el código que importa

```
abax-gantt/
├── poc/src/              ← Frontend React (lo que ve el usuario)
│   ├── lib/api.ts        ← Cliente HTTP (rutas API)
│   ├── lib/auth.ts       ← Configuración OIDC/Authentik
│   ├── App.tsx           ← Rutas React
│   └── components/       ← Componentes visuales
├── deploy/
│   ├── Dockerfile        ← Build de la imagen
│   ├── server.ts         ← Entrypoint Deno
│   └── server/api/       ← Handlers de API (backend)
│       ├── router.ts     ← Registro de rutas
│       ├── _shared/      ← auth, db, errores, validación
│       ├── wbs.ts        ← CRUD de WBS
│       ├── projects.ts   ← CRUD de proyectos
│       └── ...           ← 20 handlers más
└── supabase/migrations/  ← SQL de base de datos
```

---

## 5. Cómo probar

### 5.1 Preparación

1. Entrá a `https://auth.breisner.info` como `akadmin`.
2. Creá 2 usuarios más en **Directory → Users → Create**:
   - `responsable@test.com` (sin grupo)
   - `ejecutor@test.com` (sin grupo)
3. Asignales contraseña.

### 5.2 Flujo principal (probar los 3 roles)

| Rol | Qué debería poder hacer | Qué NO debería poder |
|-----|------------------------|---------------------|
| Admin | Todo | — |
| Responsable | Editar su rama WBS, crear tareas, asignar ejecutores | Editar ramas de otros |
| Ejecutor | Ver sus tareas, reportar avance, registrar horas | Editar estructura, fechas, responsables |

### 5.3 Errores comunes y cómo diagnosticarlos

| Síntoma | Causa probable | Dónde mirar |
|---------|---------------|-------------|
| `{"error":"Token requerido"}` | No hay sesión / token expirado | Volver a hacer login |
| `{"error":"Error interno del servidor"}` | Crash en handler | `docker logs abax-gantt` → buscar stack trace |
| Página en blanco | Error JS en frontend | F12 → Console del navegador |
| No carga Authentik | Proxy caído o mal configurado | `docker logs authentik-proxy` |
| 404 en ruta SPA | Fallback SPA no funciona | Verificar que `server.ts` tenga el fallback |
| No se crean tareas | Error en `wbs.ts` handler | `docker logs abax-gantt \| grep -A10 "wbs"` |

### 5.4 Si necesitás tocar el backend

Los handlers están en `deploy/server/api/*.ts`. Cada uno es autónomo: recibe un `Request` y devuelve un `Response`.

Patrón:
```typescript
export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);     // valida JWT
    const db = getClient();                    // conexión DB
    // ... tu lógica ...
    return okResponse({ data: result });
  } catch (error) {
    return handleError(error);
  }
}
```

Helpers disponibles en `_shared/`:
- `authenticate(req)` → devuelve `{userId, authentikSub, email, groups, isAdmin}`
- `getClient()` → `{ query<T>(sql, params?): {rows: T[]} }`
- `okResponse(data, status?)` → JSON 200
- `errorResponse(status, msg)` → JSON error
- `handleCors(req)` → null o Response 204
- `requireString`, `optionalDate`, `requireUuid`, etc. → validación

---

## 6. Cómo reportar

### Bug encontrado

```
**BUG:** [título descriptivo]

**Severidad:** Crítica | Alta | Media | Baja
**Rol:** Admin | Responsable | Ejecutor

**Pasos:**
1. Ir a...
2. Hacer clic en...
3. ...

**Esperado:** [lo que debería pasar]
**Obtenido:** [lo que realmente pasó]

**Log:** [pegar salida de docker logs o consola]
```

### Mejora propuesta

```
**MEJORA:** [título]

**Impacto:** Usabilidad | Rendimiento | Seguridad | Estética

**Descripción:** [qué sugerís cambiar y por qué]
```

---

## 7. Checklist de pulido final (cerrado 2026-05-19)

- [x] Los 3 roles funcionan sin errores (UAT smoke §1-§6, **51/51 OK**)
- [x] Crear proyecto → etapa → grupo → tarea → hito → eliminar (UAT smoke §3, §12)
- [x] Backlog: crear sin fecha, programar, desprogramar (UAT smoke §4)
- [x] Dependencias: crear, warning al violar, eliminar (UAT smoke §5)
- [x] Filtros: nombre, tipo, backlog, mis tareas, status, project_id (UAT smoke §7)
- [x] Panel detalle: info, responsables, ejecutores, avance, horas, presupuesto, adjuntos (UAT smoke §6, §8, §10)
- [x] Export JSON y CSV (UAT smoke §9)
- [x] Admin: invitar usuario, activar/desactivar (UAT smoke §11)
- [x] Login/logout con Authentik (provider con scopes configurado, akadmin en abax-admins)
- [x] 0 errores en `docker logs abax-gantt | grep -i error` (rebuild post-fixes)
- [x] 0 errores en consola del navegador (api paths normalizados)
- [x] Bugs documentados en `docs/bugs-uat.md` (14 bugs encontrados, todos arreglados)

**Script de regresión:** `ops/uat-smoke.sh` (requiere `source <(ops/mint-test-tokens.sh)` antes)

**Total tests pasando:** 217 (39 Vitest + 41 deploy/ Deno + 86 supabase/ Deno + 51 UAT smoke)

---

## 8. Referencias

| Documento | Contenido |
|-----------|-----------|
| `docs/estado-despliegue.md` | Estado técnico completo del deploy |
| `docs/uat.md` | Plan de pruebas detallado HU por HU |
| `docs/api.md` | Referencia de los 23 endpoints |
| `docs/qa-certificacion-mvp.md` | Certificación QA anterior |
| `docs/trazabilidad-hu.md` | Trazabilidad HU → componente → test |
| `especificacion-tecnica.md` | Especificación técnica original |
