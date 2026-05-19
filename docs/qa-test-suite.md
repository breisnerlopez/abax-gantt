# QA Test Suite — Estado Backend Real

Ultima actualizacion: 19 de mayo de 2026

Este documento registra resultados ejecutados en el entorno local + UAT real contra producción.

## Resumen

| Capa | Comando | Resultado |
|---|---|---|
| Frontend unit (Vitest) | `npm --prefix poc test` | OK, 39 passed, 0 failed |
| Backend deploy/ unit (Deno) | `deno test deploy/server/api/_shared/tests/` | OK, 41 passed, 0 failed (nuevo) |
| Backend supabase/ unit | `npm run test:unit` | OK, 86 passed, 0 failed |
| Backend integracion | `npm run test:integration` | OK, 93 passed, 0 failed |
| Type-check funciones | `deno check supabase/functions/**/*.ts` | OK |
| **UAT smoke producción** | `./ops/uat-smoke.sh` | **OK, 51 passed, 0 failed (nuevo)** |
| **Total** | | **310 tests, 0 fallos** |

## Comandos Ejecutados

```bash
npm run test:unit
npm run test:integration
```

## Cobertura Backend Relevante

### Unitarios Compartidos

| Archivo | Tests | Cobertura |
|---|---:|---|
| `supabase/functions/_shared/tests/cors.test.ts` | 8 | CORS y preflight |
| `supabase/functions/_shared/tests/errors.test.ts` | 16 | `ApiError`, respuestas OK/error, errores genericos |
| `supabase/functions/_shared/tests/validation.test.ts` | 62 | Validacion de strings, UUID, fechas, colores, numeros, JSON y rutas |

### Integracion

`supabase/tests/integration.test.ts` ejecuta 93 tests con JWT Authentik de prueba y Supabase local.

Casos relevantes agregados/cerrados:

| Area | Validacion |
|---|---|
| `my_tasks=true` | Devuelve tareas asignadas al usuario actual e incluye ancestros visuales |
| Proyecto individual | `project_id + include_context=true` devuelve solo arbol visible |
| Visibilidad | Usuario ejecutor no carga proyecto no visible |
| Filtros WBS | `project_id`, `project_type_id`, `responsible_id`, `assignee_id`, `status`, `date_from`, `date_to`, `search`, filtros combinados |
| Status | Incluye caso `status=retrasado` |
| Dependencias | `api-wbs-schedule` y `api-wbs-move` devuelven warning estructurado `DEPENDENCY_VIOLATION` con status 409 |
| Export | JSON/CSV OK; `format=pdf/png` retorna 501 |

## Contratos Confirmados

### Status WBS

| Valor | Regla backend |
|---|---|
| `completado` | `progress >= 1` |
| `retrasado` | `end_date < hoy` y `progress < 1` |
| `en_progreso` | `0 < progress < 1` y no retrasado |
| `pendiente` | `progress = 0` y no retrasado |

### Warning De Dependencias

```json
{
  "data": null,
  "warnings": [
    {
      "code": "DEPENDENCY_VIOLATION",
      "message": "La nueva fecha viola una dependencia FS",
      "dependency_id": "uuid"
    }
  ]
}
```

Status HTTP: `409`.

### US-24 PNG/PDF

PNG/PDF backend queda fuera del instalable inicial. `api-export` responde `501` para `format=pdf` y `format=png`. JSON/CSV siguen implementados.

## Notas

- `npm run test:integration` requiere Supabase local y Edge Functions disponibles con `.env` configurado.
- Las llaves privadas de prueba no deben versionarse en el repositorio.
- El lint/frontend POC no se considera en este registro backend.
