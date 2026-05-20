# Smoke Demo MVP

> **Nota:** El artefacto principal ahora es la imagen Docker en `deploy/`. Este documento describe el flujo de desarrollo y tests; las rutas `/gantt` corresponden al entorno de desarrollo local Vite, no al despliegue productivo bajo subpath.

Este smoke valida el flujo completo del MVP contra el contenedor Docker o Supabase local.

## Preparacion

### Opcion A — Contenedor Docker (recomendado)

```bash
docker build -f deploy/Dockerfile -t abax-gantt:latest .
docker run -d --name abax-gantt-smoke -p 8000:8000 \
  --env-file deploy/.env \
  abax-gantt:latest
```

Acceder en `http://localhost:8000/login`.

### Opcion B — Supabase Local (desarrollo historico)

1. `npm install && npm --prefix poc install`
2. `npm run db:start`
3. `npm run db:reset`
4. `npm run serve:core` (Edge Functions principales)
5. Generar o pegar un JWT Authentik en la pantalla de login dev.
6. `npm --prefix poc run dev`
7. Acceder en `http://localhost:5173/login`

## Checklist Manual

1. Entrar a `/login` y autenticarse con Authentik.
2. Abrir `/gantt` y confirmar que carga el proyecto demo.
3. Crear un proyecto nuevo.
4. Crear un nodo hijo sin fechas y verificar que aparece en backlog.
5. Programar el nodo desde backlog.
6. Editar nombre/descripcion/fechas y confirmar autosave.
7. Asignar responsable y ejecutor.
8. Reportar avance y horas reales.
9. Subir un adjunto y eliminarlo.
10. Crear una dependencia en el Gantt y eliminarla.
11. Mover/reordenar una tarea en el Gantt.
12. Repetir con rol ejecutor: debe poder reportar avance/horas, pero no editar estructura.

## Automatizacion Disponible

| Comando | Descripcion |
|---------|-------------|
| `npm run smoke:frontend` | Tests unitarios frontend con Vitest |
| `npm run smoke:backend` | Integracion real backend contra PostgreSQL |
| `npm run smoke:e2e` | E2E con Playwright (API mockeada) |
| `npm run test` | Suite completa backend |
| `npm run build` | Build frontend |
| `npm run lint` | Lint frontend |

CI/CD en `.github/workflows/ci.yml`: frontend smoke, build, E2E y backend check automatico.

## Atajos de teclado

| Combinación         | Acción                        |
|---------------------|-------------------------------|
| `⌘⇧N` / `Ctrl+Shift+N` | Crear proyecto            |
| `⌘K` / `Ctrl+K`     | Abrir/cerrar backlog          |
| `⌘⌫` / `Ctrl+Backspace` | Enviar nodo al backlog    |
| `Escape`            | Cerrar diálogos y backlog     |

## Bundle

El bundle inicial carga ~309 kB. DHTMLX Gantt (~608 kB) se carga de forma diferida (`React.lazy`) al entrar a la vista Gantt. No se puede tree-shakear mas porque es una libreria monolítica.
