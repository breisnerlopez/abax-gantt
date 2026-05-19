# Desarrollo Backend

## Entorno Oficial

El entorno oficial es el Dev Container del proyecto `abax-gantt`. Debe usarse para desarrollo diario porque fija Node, Deno, Docker y Supabase CLI.

## Primer Arranque

1. Abrir el proyecto en el Dev Container.
2. Crear `.env` desde `.env.example`.
3. Ejecutar `npm install` si el contenedor no lo hizo automaticamente.
4. Levantar Supabase local con `npm run db:start`.
5. Copiar la `service_role key` impresa por Supabase a `.env`.
6. Configurar `AUTHENTIK_JWKS_URL`, `AUTHENTIK_ISSUER` y `AUTHENTIK_CLIENT_ID`.
7. Aplicar migraciones y seed con `npm run db:reset`.

## Funciones Edge

Durante desarrollo, servir cada funcion en una terminal separada:

```bash
npm run functions:projects
npm run functions:wbs
npm run functions:wbs-node
npm run functions:dependencies
npm run functions:dependency
npm run functions:assignees
npm run functions:assignee
npm run functions:admin-users
npm run functions:users
npm run functions:admin-user
npm run functions:backlog
npm run functions:wbs-schedule
npm run functions:wbs-progress
npm run functions:timesheet
npm run functions:wbs-move
npm run functions:summary
npm run functions:admin-project-types
npm run functions:admin-project-type
npm run functions:attachments
npm run functions:attachment
npm run functions:export
npm run functions:reports
npm run functions:kpi
npm run functions:import
npm run functions:mcp
```

## Endpoints Iniciales

| Funcion | Responsabilidad |
|---|---|
| `api-projects` | Crear/listar proyectos visibles |
| `api-wbs` | Crear/listar nodos WBS |
| `api-wbs-node` | Consultar/editar/eliminar un nodo WBS |
| `api-dependencies` | Listar/crear dependencias |
| `api-dependency` | Eliminar una dependencia |
| `api-assignees` | Listar/asignar ejecutores |
| `api-assignee` | Eliminar una asignacion de ejecutor |
| `api-admin-users` | Listar/invitar usuarios como admin |
| `api-users` | Directorio de usuarios activos asignables |
| `api-admin-user` | Activar/desactivar o actualizar usuario como admin |
| `api-backlog` | Listar tareas sin programar visibles |
| `api-wbs-schedule` | Programar/desprogramar una tarea |
| `api-wbs-progress` | Reportar avance y opcionalmente horas |
| `api-timesheet` | Listar/registrar horas reales |
| `api-wbs-move` | Mover un nodo WBS a otro padre o reordenar |
| `api-summary` | Indicadores consolidados del portafolio |
| `api-admin-project-types` | Listar/crear tipos de proyecto |
| `api-admin-project-type` | Editar/desactivar un tipo de proyecto |
| `api-attachments` | Listar/subir adjuntos a un proyecto |
| `api-attachment` | Eliminar un adjunto |
| `api-export` | Exportar proyecto a JSON o CSV |
| `api-reports` | Reporte presupuestario detallado por proyecto |
| `api-kpi` | KPI consolidados con filtros por tipo y responsable |
| `api-import` | Importar tareas desde CSV |
| `api-mcp` | Servidor MCP para agentes IA |

## Reglas De Seguridad

- Toda lectura de negocio debe validar permisos en la Edge Function antes de responder.
- Toda mutacion con service role debe validar permisos antes de escribir.
- No se acepta acceso directo del frontend a mutaciones de tablas criticas.
- Los ejecutores solo pueden leer sus tareas asignadas y ancestros de contexto.
- Las dependencias se validan por ancestro comun administrable, mismo proyecto y ausencia de ciclos.
- El progreso puede reportarlo un ejecutor, responsable o admin.
- Las horas reales solo puede registrarlas un ejecutor asignado.
- Mover un nodo WBS recalcula el path ltree de todo el subarbol automaticamente.
- El summary consulta KPI global: proyectos activos, avance ponderado, hitos proximos, presupuesto.
- Los tipos de proyecto no se pueden desactivar si tienen proyectos activos asociados.
- Los adjuntos se guardan en Supabase Storage con URLs firmadas. Limite de 5 archivos/5 MB por proyecto.
- La exportacion genera CSV con todas las columnas del WBS o JSON con el arbol completo incluyendo dependencias.
- El reporte presupuestario detalla horas estimadas vs reales, costo, avance y desglose por persona.
- KPI incluye metricas de proyectos, avance ponderado, presupuesto, horas, hitos y tareas retrasadas.
- Import soporta CSV con columnas name, type, start_date, end_date, duration, progress, estimated_hours, estimated_cost.
- MCP expone tools: list_projects, get_project_wbs, get_summary, create_task. Autenticacion via X-API-Key.
- Adjuntos tienen limite de 5 por proyecto y 5 MB por archivo.

## QA Y Tests

- `npm run check` es la validacion automatica actualmente fiable: type-check de las 24 Edge Functions y lint del frontend POC.
- `npm run test:unit` ejecuta los tests unitarios compartidos y no requiere Supabase local.
- `npm run test:integration` requiere Supabase local, Edge Functions servidas con `--env-file .env`, variables Authentik reales y una llave privada de prueba compatible en `AUTHENTIK_TEST_PRIVATE_JWK_PATH` o `/tmp/test-jwk-private.json`.
- No usar Supabase Auth ni tokens de `auth/v1` para pruebas nuevas; los endpoints esperan JWT Authentik.
- Ver `docs/correcciones-authentik-qa.md` para el detalle de bugs corregidos tras la revision de documentacion.

## Orden MVP Backend

1. Frontend del MVP con integracion DHTMLX + API.
2. Testing end-to-end de permisos y flujos criticos.
3. Publicacion de imagen Docker del contenedor unico `abax-gantt`.
