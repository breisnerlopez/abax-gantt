# Smoke demo MVP

Este smoke valida el flujo completo del MVP contra Supabase local y el frontend Vite.

## Preparacion

1. Instalar dependencias: `npm install`.
2. Iniciar Supabase local: `npm run db:start`.
3. Aplicar migraciones y seed demo: `npm run db:reset`.
4. Servir las Edge Functions necesarias en terminales separadas:
   `api-projects`, `api-wbs`, `api-wbs-node`, `api-dependencies`, `api-dependency`, `api-assignees`, `api-assignee`, `api-users`, `api-backlog`, `api-wbs-schedule`, `api-wbs-progress`, `api-wbs-move`, `api-summary`, `api-attachments`, `api-attachment`, `api-reports`.
5. Generar o pegar un JWT Authentik compatible en la pantalla de login dev.
6. Levantar frontend: `npm run dev`.

## Datos Demo

`supabase/seed.sql` crea:

- Proyecto `Demo ABAX Gantt`.
- Usuarios `Admin Demo`, `Responsable Demo`, `Ejecutor Demo`.
- WBS con etapas, tareas programadas, una tarea en backlog, dependencia y ejecutor asignado.

## Checklist Manual

1. Entrar a `/gantt/login` y guardar token dev.
2. Abrir `/gantt/gantt` y confirmar que carga `Demo ABAX Gantt`.
3. Crear un proyecto nuevo.
4. Crear un nodo hijo sin fechas y verificar que aparece en backlog.
5. Programar el nodo desde backlog.
6. Editar nombre/descripcion/fechas y confirmar autosave.
7. Asignar responsable y ejecutor.
8. Reportar avance y horas reales.
9. Subir un PDF o TXT y eliminarlo desde el modal de confirmacion.
10. Crear una dependencia en el Gantt y eliminarla desde el modal.
11. Mover/reordenar una tarea en el Gantt.
12. Repetir con rol `ejecutor`: debe poder reportar avance/horas, pero no editar estructura.

## Automatizacion Disponible

- Frontend mock smoke: `npm run smoke:frontend`.
- Backend/integracion real: `npm run smoke:backend`.
- Browser E2E smoke con API mockeada: `npm run smoke:e2e`.
- Suite completa backend: `npm run test`.
- Build/lint frontend: `npm run build` y `npm run lint`.
- Servir core functions: `npm run serve:core` (arranca todas las Edge Functions principales).
- CI/CD: `.github/workflows/ci.yml` ejecuta frontend smoke, build, E2E y backend check automáticamente.

El smoke E2E usa Playwright y mockea las rutas HTTP del frontend. Esto cubre interaccion real de navegador sin depender de levantar todas las Edge Functions. La integracion real de backend sigue cubierta por `npm run smoke:backend`.

## Atajos de teclado

| Combinación         | Acción                        |
|---------------------|-------------------------------|
| `⌘⇧N` / `Ctrl+Shift+N` | Crear proyecto            |
| `⌘K` / `Ctrl+K`     | Abrir/cerrar backlog          |
| `⌘⌫` / `Ctrl+Backspace` | Enviar nodo al backlog    |
| `Escape`            | Cerrar diálogos y backlog     |

## Bundle

El bundle inicial carga ~309 kB. DHTMLX Gantt (~608 kB) se carga de forma diferida (`React.lazy`) al entrar a la vista Gantt. No se puede tree-shakear mas porque es una libreria monolítica.
