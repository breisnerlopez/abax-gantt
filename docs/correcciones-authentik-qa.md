# Correcciones Authentik Y QA

Fecha: Mayo 2026

## Resumen

Se reviso la documentacion generada y se detectaron inconsistencias que podian provocar bugs reales de seguridad y de operacion. La correccion principal fue alinear el backend y la documentacion con la decision vigente: Authentik es el unico proveedor de identidad y Supabase Auth no se usa para sesiones de usuario.

## Bugs Detectados

| Area | Problema | Riesgo |
|---|---|---|
| `auth.ts` | JWKS QA embebido y fallback cuando faltaba `AUTHENTIK_JWKS_URL` | Aceptar tokens de prueba por configuracion incompleta |
| `auth.ts` | `AUTHENTIK_ISSUER` y `AUTHENTIK_CLIENT_ID` tenian defaults hardcodeados | Validar tokens contra un issuer/audience ficticio |
| `docs/qa-test-suite.md` | Afirmaba `162 passed, 0 failed` sin validacion reproducible actual | Falsa confianza en cobertura/integracion |
| `package.json` | Scripts `test:*` duplicados | Confusion operativa y mantenimiento inconsistente |
| `test:integration` | Faltaban permisos para leer la llave privada y ejecutar Docker | Tests de integracion no reproducibles |
| `integration.test.ts` | Usaba issuer/audience QA hardcodeados | Tests desacoplados de la configuracion real |
| Documentacion UX/backend | Mezclaba Supabase Auth, magic links y RLS con JWT de usuario | Implementaciones futuras podian ir contra la arquitectura definida |

## Correcciones Aplicadas

| Archivo | Cambio |
|---|---|
| `supabase/functions/_shared/auth.ts` | Eliminado `createLocalJWKSet`, `QA_JWKS` y defaults QA. Las variables Authentik son obligatorias. |
| `package.json` | Eliminados scripts duplicados. `test:integration` y `test` incluyen permisos necesarios para archivo de llave y Docker. |
| `supabase/tests/integration.test.ts` | Issuer, audience y ruta de llave privada salen de entorno: `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_TEST_PRIVATE_JWK_PATH`. |
| `docs/qa-test-suite.md` | Reescrito como estado actual verificable; ya no afirma 162 tests pasados salvo ejecucion real documentada. |
| `README.md` | Arranque local actualizado para exigir variables Authentik y aclarar que no hay fallbacks hardcodeados. |
| `docs/desarrollo-backend.md` | Seguridad actualizada a autorizacion programatica en Edge Functions con service role. |
| `flujo-navegacion-ux.md` | Login, alta y recuperacion alineados con Authentik OIDC + PKCE. |
| `analisis-diseno.md` | Decision Authentik marcada como resuelta; eliminada recomendacion de volver a Supabase Auth. |
| `hallazgos-poc.md` | Plan MVP actualizado de Supabase Auth a Authentik OIDC + PKCE. |

## Estado De Seguridad Resultante

- Las Edge Functions validan JWT Authentik mediante JWKS remoto.
- `AUTHENTIK_JWKS_URL`, `AUTHENTIK_ISSUER` y `AUTHENTIK_CLIENT_ID` son obligatorios.
- No hay JWKS de prueba embebido en codigo productivo.
- No hay issuer/audience QA hardcodeados en runtime.
- Supabase Auth no se usa para sesiones de usuario.
- La autorizacion efectiva se aplica en Edge Functions usando `profiles.id` resuelto desde `authentik_sub`.

## Validaciones Ejecutadas

```bash
npm run check
deno check supabase/tests/integration.test.ts
npm run test:unit
npm run build
npm run db:reset
```

Resultado:

| Comando | Resultado |
|---|---|
| `npm run check` | OK |
| `deno check supabase/tests/integration.test.ts` | OK |
| `npm run test:unit` | OK, 86 passed |
| `npm run build` | OK, con warning esperado de chunk grande |
| `npm run db:reset` | OK, migraciones `00001` a `00007` y seed aplicados |

## Pendiente

- Ejecutar `npm run test:integration` cuando exista un entorno Authentik/JWKS real o un entorno de test controlado con llave privada compatible.
- Documentar el comando exacto y resultado antes de afirmar cualquier total global de tests de integracion.
- Mantener fuera del repositorio cualquier llave privada usada para tests.
