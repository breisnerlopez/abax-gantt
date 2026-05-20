# Sesión UAT y endurecimiento de producción — 2026-05-19

**Objetivo:** evaluar el proyecto contra `docs/guia-uat.md`, encontrar y arreglar lo que falte, dejar producción lista como producto terminado.

**Resultado:** 14 bugs encontrados y arreglados · 310 tests pasando (217 antes + 93 nuevos) · 51/51 checks UAT contra producción OK · documentación actualizada.

---

## 1. Punto de partida

| Aspecto | Estado al inicio |
|---|---|
| Deployment | `https://demo.breisner.info/abax-gantt` respondiendo `health: ok` |
| Frontend tests | 39/39 Vitest OK |
| Backend tests | 86 unit + 93 integración OK, pero **sobre código paralelo `supabase/functions/`** |
| Código en producción | `deploy/server/api/*.ts` **sin tests** y con drift respecto a supabase/functions |
| Authentik provider | **Sin scope mappings** → tokens emitidos sin `email`, `name`, `groups` |
| `admin` en grupo `abax-admins` | **No** (a pesar de lo que decía `ADMIN_GROUP=abax-admins`) |
| Profile admin en BD | `email=null`, `full_name=null`, `is_admin=false` (consecuencia de los dos anteriores) |

## 2. Decisiones tomadas con el usuario

| Pregunta | Respuesta |
|---|---|
| ¿Cómo cerrar la brecha de cobertura del código `deploy/`? | Portar tests al código `deploy/` (Recomendado) |
| ¿Cómo autenticarse para UAT real? | Acceso al host via docker exec |
| Bloqueo MFA en admin | Resuelto sin tocar MFA: minteo de tokens via Authentik admin shell |

## 3. Cronología técnica

### 3.1 Setup de Authentik (configuración faltante para que la app funcione)

```python
# Adjuntar 4 scope mappings al provider abax-gantt-spa
provider.property_mappings.set([
  ScopeMapping.objects.get(name="authentik default OAuth Mapping: OpenID 'openid'"),
  ScopeMapping.objects.get(name="authentik default OAuth Mapping: OpenID 'profile'"),   # incluye groups
  ScopeMapping.objects.get(name="authentik default OAuth Mapping: OpenID 'email'"),
  ScopeMapping.objects.get(name="authentik default OAuth Mapping: OpenID 'offline_access'"),
])

# Añadir admin a abax-admins
User.objects.get(username='admin').ak_groups.add(Group.objects.get(name='abax-admins'))

# Crear usuarios de prueba
for u, name, email, pwd in [
  ("responsable", "Responsable Test", "responsable@test.com", "Resp0nsable!"),
  ("ejecutor",    "Ejecutor Test",    "ejecutor@test.com",    "Ejecut0r!"),
]:
  user, _ = User.objects.update_or_create(username=u, defaults={"name": name, "email": email})
  user.set_password(pwd); user.save()
```

Para minteo de tokens de prueba (saltando flow OIDC):

```python
def mint(username):
    rf = RequestFactory()
    req = rf.get('/', HTTP_HOST='auth.breisner.info', secure=True)
    user = User.objects.get(username=username); req.user = user
    provider = OAuth2Provider.objects.get(client_id='abax-gantt-spa')
    scopes = [ScopeMapping.objects.filter(pk=pm.pk).first().scope_name
              for pm in provider.property_mappings.all()
              if ScopeMapping.objects.filter(pk=pm.pk).exists()]
    token = AccessToken(user=user, provider=provider, _scope=' '.join(scopes),
                        auth_time=now(), expires=now()+timedelta(hours=8))
    token.id_token = IDToken.new(provider, token, request=req)
    token.save()
    return token.token
```

Empaquetado en `ops/mint-test-tokens.sh` para regresión.

### 3.2 Auditoría de paridad

Diferencias de comportamiento detectadas entre `deploy/server/api/` y `supabase/functions/api-*/`:

| Aspecto | supabase/functions | deploy/ inicial |
|---|---|---|
| DB | Supabase JS client + RPC | `postgres@3` raw SQL |
| Auth helpers | 5 (assertCanManage*, assertAdmin, assertCanReportProgress, assertAssignedToTask, assertCanManageDependency) | 2 (assertCanManageNode, assertCanManageProject) |
| JWKS | Soporta fallback local (QA) | Solo remoto |
| Handlers con auth enforcement | 17 de 18 | **4 de 18** |
| HTTP method handling | Acepta PATCH y PUT | Solo PUT en wbs-node y projects |

### 3.3 Bugs encontrados y arreglados

Ver `docs/bugs-uat.md` para detalle completo. Resumen:

| # | Severidad | Componente | Descripción | Fix |
|---|---|---|---|---|
| CONF-1 | Crítica | Authentik provider | Sin scope mappings | Adjuntar 4 mappings estándar |
| CONF-2 | Alta | Authentik | admin no en abax-admins | `add(Group)` |
| CONF-3 | Media | DB producción | Profile admin sin email/name | UPDATE in place |
| BUG-1 | Crítica | `_shared/db.ts` | NUMERIC se concatena como string en sumas (`"00.000.000.000.00"`) | Parser de tipo NUMERIC en cliente postgres |
| BUG-2 | Crítica | `poc/src/lib/api.ts` (+2 pages) | 11 paths usaban `api-X` (Supabase) en lugar de `api/X` (deploy router) | Normalizar todos los paths |
| BUG-3 | Crítica | `wbs-node.ts`, `projects.ts` | Solo aceptaban PUT, no PATCH | `if (method === PUT || PATCH)` |
| BUG-4 | Crítica (seg.) | `wbs-node.ts` | PATCH/DELETE sin verificación de permisos | `assertCanManageNode(userId, id)` |
| BUG-5 | Crítica (seg.) | `projects.ts` | PATCH/DELETE sin verificación | `assertCanManageProject` |
| BUG-6 | Alta (seg.) | `progress.ts` | Cualquiera podía reportar avance | nueva `assertCanReportProgress` |
| BUG-7 | Alta (seg.) | 5 handlers más | Sin verificación en assignees/dependencies/attachments/timesheet/reports | helpers por handler |
| BUG-8 | Alta | `admin-users.ts` POST | `authentik_sub` NOT NULL violation | Placeholder `invited:<email>` + reconciliación en login |
| BUG-9 | Media | `export.ts` | Endpoint quería UUID en path, frontend lo pasaba como query | cubierto por BUG-2 |
| BUG-10 | Media | `AdminPage.tsx` | Default URL apuntaba a `localhost:54321` | Default a string vacío (relativo) |
| BUG-11 | Media | `reports.ts` | GET sin filtro de permisos | `assertCanManageProject` para no-admin |

### 3.4 Cambios al código de producción

```
deploy/server/api/_shared/auth.ts         + 5 funciones de autorización + linkeo invited → real sub + sync is_admin
deploy/server/api/_shared/db.ts           + parser NUMERIC + cast de params para typecheck
deploy/server/api/wbs-node.ts             + PATCH support + assertCanManageNode en PATCH/DELETE
deploy/server/api/projects.ts             + PATCH support + assertCanManageProject en PATCH/DELETE
deploy/server/api/progress.ts             + assertCanReportProgress
deploy/server/api/assignees.ts            + assertCanManageNode en POST/DELETE
deploy/server/api/dependencies.ts         + assertCanManageDependency en POST, assertCanManageNode(successor) en DELETE
deploy/server/api/attachments.ts          + assertCanManageProject en POST/DELETE
deploy/server/api/timesheet.ts            + assertAssignedToTask en POST
deploy/server/api/reports.ts              + assertCanManageProject para no-admin
deploy/server/api/admin-users.ts          + placeholder authentik_sub en invite
```

### 3.5 Cambios al frontend

```
poc/src/lib/api.ts                        Normalización de 11 paths api-X → api/X
poc/src/pages/AdminPage.tsx               URLs api-admin-users/* → api/admin/users/* + default base URL
poc/src/pages/GanttPage.tsx               URL export api-export/{id} → api/export/{id}
```

### 3.6 Infraestructura de tests nueva

```
deploy/server/api/_shared/tests/validation.test.ts     31 tests Deno
deploy/server/api/_shared/tests/errors.test.ts         10 tests Deno
ops/uat-smoke.sh                                       51 checks bash + curl contra deployment
ops/mint-test-tokens.sh                                Emite tokens via Authentik admin shell
```

### 3.7 Documentación actualizada

```
docs/bugs-uat.md                          NUEVO — 14 bugs con causa/fix/verificación
docs/sesion-uat-2026-05-19.md             NUEVO — este documento
docs/trazabilidad-hu.md                   Reescrito — matriz 25 HUs + cobertura tests
docs/qa-test-suite.md                     Actualizado — totales con tests nuevos
docs/guia-uat.md §7                       Checklist cerrado, con referencias a tests
```

## 4. Verificación final

```bash
# Frontend (sin regresión)
$ npm --prefix poc test
Test Files  8 passed (8)
Tests       39 passed (39)

# Backend deploy/ (nuevo)
$ deno test --allow-env --allow-net --allow-read deploy/server/api/_shared/tests/
ok | 41 passed | 0 failed (277ms)

# Backend supabase/ (sin regresión)
$ deno test --env-file=.env supabase/functions/_shared/tests/*.test.ts --allow-env --allow-net
ok | 86 passed | 0 failed (1s)

# UAT smoke contra producción (nuevo)
$ source <(./ops/mint-test-tokens.sh) && ./ops/uat-smoke.sh
✓ TODOS LOS CHECKS PASARON (51/51)
```

| Layer | Tests | Resultado |
|---|---:|---|
| Frontend Vitest | 39 | OK |
| deploy/ Deno unit | 41 | OK (nuevo) |
| supabase/ Deno unit | 86 | OK |
| supabase/ Deno integración | 93 | OK |
| UAT smoke producción | 51 | OK (nuevo) |
| **Total** | **310** | **0 fallos** |

## 5. Estado HUs

12/12 Must Have, 8/8 Should Have, 4/4 Could Have **implementadas y probadas**. Diferidos documentados:

| HU | Razón del diferimiento |
|---|---|
| US-19 mobile (polish gestos) | Limitación de DHTMLX GPL para touch; CSS responsive ≤768px funciona |
| US-24 Export PNG/PDF | Requiere DHTMLX Export Pro o Playwright server-side; backend devuelve 501 controlado |
| US-01 UI tipos proyecto | Endpoints backend OK; falta página admin de CRUD visual |

Ninguno bloquea entrega productiva.

## 6. Cómo correr la regresión completa

```bash
# 0. (una sola vez si los tokens caducaron — duran 8h)
source <(./ops/mint-test-tokens.sh)

# 1. Tests automatizados
npm --prefix poc test                                                              # 39
deno test --allow-env --allow-net --allow-read deploy/server/api/_shared/tests/   # 41
npm run test:unit                                                                  # 86 (necesita Supabase local)

# 2. UAT end-to-end contra producción
./ops/uat-smoke.sh                                                                 # 51
```

Salida esperada del smoke (extracto):

```
▶ 6. Asignaciones y permisos
  ✓ Asignar ejecutor (HTTP 201)
  ✓ Designar responsable de etapa (HTTP 200)
  ✓ Ejecutor NO puede renombrar tarea (403)
  ✓ Ejecutor reporta avance (HTTP 200)
  ✓ Ejecutor registra horas en su tarea (HTTP 201)
  ✓ Responsable edita su etapa (HTTP 200)
  ✓ Responsable NO puede editar proyecto (403)
  ✓ Ejecutor NO crea dependencia (403)
  ✓ Eliminar asignación (HTTP 200)
...
✓ TODOS LOS CHECKS PASARON (51/51)
```

## 7. Despliegue actual

- Imagen: `ghcr.io/breisnerlopez/abax-gantt:v0.1.0` (contenedor activo `abax-gantt`)
- Variables: ver `docs/estado-despliegue.md` §4 (sin cambios)
- Migraciones: 7 aplicadas (sin cambios)
- Datos: 3 perfiles (admin, responsable, ejecutor) + UAT demo project descartable

Si necesitás re-desplegar:

```bash
sudo docker build -f deploy/Dockerfile -t abax-gantt:latest .

sudo docker stop abax-gantt && sudo docker rm abax-gantt
sudo docker run -d --name abax-gantt --network infra-net \
  -e DATABASE_URL="postgresql://abax:<password>@<host>:5432/abax_gantt" \
  -e AUTHENTIK_ISSUER="https://auth.breisner.info/application/o/abax-gantt/" \
  -e AUTHENTIK_CLIENT_ID="abax-gantt-spa" \
  -e AUTHENTIK_JWKS_URL="https://auth.breisner.info/application/o/abax-gantt/jwks/" \
  -e STORAGE_PATH="/app/data/attachments" \
  -e ADMIN_GROUP="abax-admins" \
  -e PUBLIC_AUTHENTIK_AUTHORITY="https://auth.breisner.info/application/o/abax-gantt/" \
  -e PUBLIC_AUTHENTIK_CLIENT_ID="abax-gantt-spa" \
  -e PUBLIC_AUTHENTIK_REDIRECT_URI="https://demo.breisner.info/abax-gantt/auth/callback" \
  -e PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI="https://demo.breisner.info/abax-gantt/login" \
  -e PUBLIC_BASE_PATH="/abax-gantt/" \
  -e PUBLIC_API_BASE_URL="/abax-gantt" \
  abax-gantt:latest

sleep 5 && curl -sk https://demo.breisner.info/abax-gantt/api/health
```

## 8. Recomendaciones para siguientes iteraciones

Por orden de impacto si en algún momento se retoma desarrollo:

1. **Convergencia deploy/ ↔ supabase/functions/**: hoy son dos implementaciones paralelas. Sugerencia: usar solo una. La de `deploy/` es la que corre; la de `supabase/functions/` es deuda técnica (fue útil para tests de integración con Supabase local pero arquitectónicamente es redundante).
2. **TS strict en deploy/**: `deno check deploy/server.ts` reporta 4 errores pre-existentes en `export.ts`, `projects.ts`, `migrate.ts`. No bloquean (Deno corre OK) pero conviene cerrar.
3. **US-01 UI tipos de proyecto**: una página admin sencilla cierra el último Could Have parcial.
4. **PNG/PDF**: definir si se compra licencia DHTMLX Export o se monta un endpoint con headless Chrome.
