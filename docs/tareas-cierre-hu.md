# Tareas de Cierre de Historias de Usuario

## Objetivo

Cerrar las brechas detectadas entre el MVP implementado y los criterios de aceptación de las historias de usuario originales antes de pasar a productización, instalador y despliegue para usuarios finales.

## Alcance

Estas tareas se enfocan en las HUs marcadas como parciales o no confirmadas:

- US-12 — Filtro rápido "Mis tareas".
- US-14 — Foco en proyecto individual dentro del Gantt consolidado.
- US-16 — Filtros completos del Gantt.
- US-17 — Navegación temporal avanzada.
- US-18 — Drag & drop completo y advertencias por dependencias.
- US-24 — Export PNG/PDF de la vista actual.

---

## Backend

### BE-01 — Soporte API para "Mis tareas" (US-12)

**Descripción:**
Agregar soporte para consultar las tareas donde el usuario autenticado es ejecutor asignado.

**Tareas:**
- Extender `api-wbs` con query param `my_tasks=true` o crear endpoint `api-my-tasks`.
- Filtrar por `task_assignees.user_id = current_user`.
- Incluir ancestros necesarios para contexto visual: proyecto, etapa, grupo padre.
- Mantener permisos: el ejecutor solo puede editar avance/horas, no estructura.

**Criterios de aceptación:**
- Un ejecutor ve únicamente tareas asignadas a él.
- La respuesta incluye el contexto jerárquico mínimo para renderizar el árbol.
- Usuario sin asignaciones recibe lista vacía.
- Admin puede seguir viendo todo si no usa `my_tasks=true`.

**Tests requeridos:**
- Integración: ejecutor ve solo sus tareas.
- Integración: usuario sin asignaciones recibe `[]`.
- Integración: tarea devuelta incluye ancestros.

---

### BE-02 — Filtros completos del Gantt (US-16)

**Descripción:**
Extender la API para soportar todos los filtros definidos en la HU original.

**Tareas:**
- Extender `api-wbs` con filtros:
  - `project_id`
  - `project_type_id`
  - `responsible_id`
  - `assignee_id`
  - `status`
  - `date_from`
  - `date_to`
  - `search`
- Definir cálculo server-side de `status`:
  - `pending`: `progress = 0`
  - `in_progress`: `progress > 0 AND progress < 1`
  - `completed`: `progress = 1`
  - `delayed`: `end_date < current_date AND progress < 1`
- Asegurar que los filtros respeten permisos del usuario autenticado.

**Criterios de aceptación:**
- Cada filtro puede aplicarse individualmente.
- Se pueden combinar filtros.
- Los resultados nunca exponen proyectos/tareas fuera de permisos.
- El filtro por fecha considera intersección con el rango visible.

**Tests requeridos:**
- Integración por cada filtro individual.
- Integración de filtros combinados.
- Integración de `status=delayed`.
- Integración de permisos + filtros.

---

### BE-03 — Proyecto individual / foco de proyecto (US-14)

**Descripción:**
Permitir cargar el árbol completo de un solo proyecto visible para el usuario.

**Tareas:**
- Soportar `GET api-wbs?project_id=<uuid>&include_context=true`.
- Validar que el usuario puede ver o gestionar ese proyecto.
- Devolver el proyecto raíz y todos sus descendientes.

**Criterios de aceptación:**
- Usuario autorizado recibe el árbol completo del proyecto.
- Usuario no autorizado recibe `403` o `404` controlado.
- El endpoint mantiene orden jerárquico y `sort_order`.

**Tests requeridos:**
- Integración: admin carga cualquier proyecto.
- Integración: responsable carga su proyecto.
- Integración: usuario sin permiso no carga proyecto ajeno.

---

### BE-04 — Validación de drag & drop y dependencias (US-18)

**Descripción:**
Completar validaciones backend para movimientos, reprogramación y conflictos de dependencias.

**Tareas:**
- Revisar `api-wbs-schedule` y `api-wbs-move`.
- Confirmar soporte para:
  - mover tarea completa
  - cambiar inicio/fin
  - programar desde backlog
  - desprogramar hacia backlog
  - mover/reordenar en árbol
- Agregar respuesta controlada para conflictos de dependencias.
- Definir si el conflicto bloquea (`error`) o advierte (`warning`) según autoscheduling.

**Criterios de aceptación:**
- El movimiento válido persiste fechas o jerarquía.
- Movimiento inválido retorna error claro.
- Si una dependencia queda violada, el backend retorna warning estructurado.
- No se permiten ciclos ni mover un nodo dentro de su propio subárbol.

**Tests requeridos:**
- Integración: programar tarea desde backlog.
- Integración: desprogramar tarea.
- Integración: mover nodo a otro padre.
- Integración: rechazar ciclo jerárquico.
- Integración: warning por dependencia violada.

---

### BE-05 — Export PNG/PDF (US-24)

**Descripción:**
Definir e implementar exportación visual de la vista actual si se confirma que JSON/CSV no cubre la HU.

**Decisión técnica pendiente:**
- Opción A: usar export client-side de DHTMLX para PNG/PDF.
- Opción B: backend con Playwright/headless para generar PNG/PDF server-side.

**Tareas si se implementa backend:**
- Crear `api-export-pdf` y/o `api-export-png`.
- Recibir estado de vista: filtros, zoom, proyectos colapsados, rango temporal.
- Renderizar/capturar vista y devolver archivo.

**Criterios de aceptación:**
- Export PNG respeta vista visible.
- Export PDF incluye nombre de proyecto(s) y fecha de exportación.
- Export respeta filtros, zoom y proyectos expandidos/colapsados.

**Tests requeridos:**
- Integración: endpoint devuelve archivo con content-type correcto.
- E2E: usuario dispara export desde UI.

---

## Frontend

### FE-01 — Botón "Mis tareas" (US-12)

**Descripción:**
Agregar filtro rápido para ejecutores.

**Tareas:**
- Agregar toggle visible en toolbar o `FilterBar`.
- Al activarlo, llamar API con `my_tasks=true`.
- Mostrar tareas agrupadas bajo sus ancestros.
- En modo ejecutor, mantener estructura en solo lectura excepto avance/horas.

**Criterios de aceptación:**
- El botón activa/desactiva el filtro.
- La grilla mantiene contexto de proyecto/etapa/grupo.
- El ejecutor puede reportar avance y horas.
- El ejecutor no puede editar nombre, fechas, jerarquía ni asignaciones.

**Tests requeridos:**
- Unit: toggle aplica `my_tasks=true`.
- Unit: permisos de ejecutor deshabilitan edición estructural.
- E2E: usuario ejecutor ve solo sus tareas.

---

### FE-02 — Filtros completos (US-16)

**Descripción:**
Completar `FilterBar` con todos los filtros requeridos.

**Tareas:**
- Agregar filtros por:
  - proyecto
  - tipo de proyecto
  - responsable
  - asignado a
  - estado
  - rango de fechas
- Mostrar filtros activos como chips removibles.
- Agregar botón `Limpiar filtros`.
- Sincronizar filtros con URL query params.

**Criterios de aceptación:**
- Cambiar un filtro refresca el Gantt.
- Los chips se pueden quitar individualmente.
- `Limpiar filtros` resetea la vista.
- La URL permite compartir la vista filtrada.

**Tests requeridos:**
- Unit: cada filtro genera query param correcto.
- Unit: chips se eliminan individualmente.
- E2E: aplicar filtro cambia resultados visibles.

---

### FE-03 — Foco en proyecto individual (US-14)

**Descripción:**
Permitir trabajar un proyecto específico sin salir de la vista Gantt.

**Tareas:**
- Agregar acción `Enfocar proyecto` al hacer clic o desde menú contextual del proyecto.
- Ocultar/colapsar otros proyectos.
- Mantener zoom, escala temporal y filtros aplicados.
- Agregar botón `Volver a portafolio`.

**Criterios de aceptación:**
- Al enfocar, se muestra solo el proyecto seleccionado.
- Las operaciones de crear/editar/asignar siguen funcionando igual.
- Volver a portafolio restaura vista consolidada.

**Tests requeridos:**
- Unit: estado `focusedProjectId` filtra proyectos visibles.
- E2E: enfocar proyecto y volver a portafolio.

---

### FE-04 — Navegación temporal (US-17)

**Descripción:**
Completar controles de navegación temporal en el Gantt.

**Tareas:**
- Agregar botón `Hoy`.
- Confirmar controles zoom `+` y `-`.
- Confirmar pan horizontal.
- Agregar atajos:
  - `+`: zoom in
  - `-`: zoom out
  - flechas izquierda/derecha: navegación temporal

**Criterios de aceptación:**
- `Hoy` centra la fecha actual.
- Zoom modifica escala sin perder selección.
- Atajos funcionan cuando el foco está en el Gantt.

**Tests requeridos:**
- Unit: handlers llaman métodos DHTMLX correctos.
- E2E: botón `Hoy` y zoom visibles/operables.

---

### FE-05 — Drag & drop visual completo (US-18)

**Descripción:**
Validar y completar interacciones visuales de drag & drop en `GanttCanvas`.

**Tareas:**
- Confirmar drag de barra completa.
- Confirmar drag borde izquierdo/derecho.
- Confirmar creación de dependencia arrastrando entre barras.
- Confirmar programar desde backlog.
- Confirmar enviar al backlog.
- Mostrar toast de éxito o warning de dependencia.

**Criterios de aceptación:**
- Los cambios se guardan al soltar.
- El usuario recibe feedback visual.
- Si backend retorna warning, se muestra advertencia sin romper UI.

**Tests requeridos:**
- Unit: respuesta warning muestra toast.
- E2E: mover/programar/desprogramar tarea.

---

### FE-06 — Export PNG/PDF (US-24)

**Descripción:**
Completar opciones visuales de exportación.

**Tareas:**
- Agregar menú `Exportar` con opciones:
  - PNG
  - PDF
  - JSON
  - CSV
- Para PNG/PDF, usar API DHTMLX client-side o endpoint backend si se elige Playwright.
- Incluir estado actual de filtros, zoom y expand/collapse.

**Criterios de aceptación:**
- PNG exporta lo visible en pantalla.
- PDF incluye nombre de proyecto(s) y fecha.
- JSON/CSV se mantienen como export técnico.

**Tests requeridos:**
- Unit: menú muestra 4 formatos.
- E2E: disparar export JSON/CSV y validar descarga; PNG/PDF según implementación final.

---

## QA y Documentación

### QA-01 — Matriz de trazabilidad HU

**Descripción:**
Crear una matriz que conecte cada historia de usuario con evidencia real de implementación.

**Archivo:**
`docs/trazabilidad-hu.md`

**Columnas mínimas:**
- HU
- Criterio de aceptación
- Estado: `OK`, `Parcial`, `Pendiente`, `No aplica`
- Backend endpoint
- Frontend componente/ruta
- Test automatizado
- Evidencia manual / nota

**Criterios de aceptación:**
- Las 24 HUs originales están cubiertas.
- Cada criterio tiene estado individual, no solo estado por HU.
- Los parciales tienen tarea asociada en este documento.

---

### QA-02 — E2E de HUs parciales

**Descripción:**
Agregar pruebas E2E específicas para las HUs cerradas en esta fase.

**Casos mínimos:**
- Usuario ejecutor usa `Mis tareas`.
- Admin aplica filtros combinados.
- Responsable enfoca proyecto individual.
- Usuario mueve tarea y recibe warning por dependencia.
- Usuario exporta vista.

---

## Orden Recomendado

1. BE-01 + FE-01 — Mis tareas.
2. BE-02 + FE-02 — Filtros completos.
3. BE-03 + FE-03 — Proyecto individual.
4. BE-04 + FE-05 — Drag & drop y dependencias.
5. FE-04 — Navegación temporal.
6. BE-05 + FE-06 — Export PNG/PDF.
7. QA-01 + QA-02 — Matriz de trazabilidad y E2E final.

## Criterio De Salida

Antes de iniciar instalador/productización, deben cumplirse estas condiciones:

- Todas las HUs Must Have están en `OK`.
- Las HUs Should/Could acordadas como parte del mínimo comercial están en `OK` o explícitamente diferidas.
- `docs/trazabilidad-hu.md` existe y está actualizado.
- `npm run check` pasa.
- `npm run test` pasa o se documenta exactamente qué entorno externo falta.
- Smoke manual de `docs/demo-smoke.md` completado.
