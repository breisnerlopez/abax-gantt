# Análisis UX Completo — ABAX Gantt 2026-05-23

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Flujo de Creación de Proyectos](#1-flujo-de-creacion-de-proyectos)
3. [Backlog vs Gantt](#2-backlog-vs-gantt)
4. [Sincronización de Fechas Proyecto vs Tareas](#3-sincronizacion-de-fechas-proyecto-vs-tareas)
5. [Sistema de Filtros](#4-sistema-de-filtros)
6. [Revisión de Componentes Web](#5-revision-de-componentes-web)
7. [Estado de Bugs Visuales](#6-estado-de-bugs-visuales)
8. [Recomendaciones Priorizadas](#7-recomendaciones-priorizadas)

---

## Resumen Ejecutivo

ABAX Gantt es un gestor de portafolio/WBS/Gantt con backend sólido (51/51 UAT API), React 19 + DHTMLX Gantt 9 en frontend, PostgreSQL (ltree) como base de datos, y Authentik como proveedor OIDC. La capa funcional está madura; la capa visual tiene 4 bugs críticos documentados en el análisis anterior y hallazgos nuevos detallados aquí.

---

## 1. Flujo de Creación de Proyectos

### 1.1 ¿El proyecto aparece inmediatamente en el Gantt?

**NO.** Hay un problema de diseño sutil pero importante:

**Backend** (`deploy/server/api/projects.ts:68-87`): Al crear un proyecto, se inserta un nodo raíz WBS con:
- `is_unscheduled = false` (es decir, el proyecto "está programado")
- `start_date = NULL` (sin fechas)

**Frontend** (`poc/src/lib/dhtmlx-adapter.ts:45`):
```ts
const scheduledNodes = nodes.filter((node) => !node.is_unscheduled && node.start_date);
```

El filtro requiere **tanto** `!is_unscheduled` **como** `start_date`. Como el nodo raíz recién creado no tiene `start_date`, queda excluido del Gantt aunque no esté en backlog.

**Flujo de creación en el frontend** (`GanttPage.tsx:409-422`):
```ts
const created = await createProject(token, name);  // Backend crea proyecto + raíz sin fechas
const data = await portfolio.refetch();             // Refresca TODO el portafolio
// Busca el root_node en el portafolio y lo selecciona
onSelectNode(fromPortfolio);
```

El nodo se selecciona en el DetailPanel, pero **no aparece en la tabla Gantt** porque no tiene fechas. El usuario ve el panel de detalle con el proyecto, pero la tabla/gráfico del Gantt está vacía.

**Diagnóstico**: Hay una inconsistencia conceptual. El backend dice `is_unscheduled: false` pero no asigna fechas. El frontend interpreta "sin fecha = sin barra en el Gantt". El usuario cree que creó un proyecto pero no lo ve.

### 1.2 Recomendación

**Opción A (Recomendada)**: Al crear un proyecto, el frontend debería mostrar el nodo raíz en el Gantt con la fecha actual como `start_date` por defecto, y un `end_date` vacío (duración 1 día visual). O bien, el modal de creación de proyecto debería preguntar "¿Cuándo inicia este proyecto?" con un date picker opcional.

**Opción B**: Mostrar nodos sin fecha en el Gantt con una franja visual distinta (ej. barra gris/transparente con "Sin fecha"), como una línea fantasma. Esto aplica también al backlog (ver §2).

**Opción C**: Marcar el nodo raíz como `is_unscheduled: true` para que aparezca en el Backlog lateral, desde donde el usuario puede "Programar" el proyecto.

---

## 2. Backlog vs Gantt

### 2.1 ¿El backlog se ve en el Gantt?

**NO.** Por diseño, el backlog está completamente separado del Gantt:

- BacklogPanel (`BacklogPanel.tsx`): Rail lateral izquierdo, colapsable. Muestra items con `is_unscheduled: true` agrupados por proyecto.
- GanttCanvas (`GanttCanvas.tsx` + `dhtmlx-adapter.ts:45`): Filtra `node => !node.is_unscheduled && node.start_date`, excluyendo explícitamente el backlog.

### 2.2 ¿Hace sentido tenerlos separados?

**Argumentos a favor de la separación actual:**
1. El backlog es conceptualmente diferente: son tareas "sin fecha", no planificadas
2. Mantiene el Gantt limpio, mostrando solo lo planificado
3. El rail lateral es un patrón conocido (Trello, Jira, Notion)
4. La transición backlog → Gantt es explícita: el usuario "Programa" una tarea con fechas concretas

**Argumentos a favor de integrarlos:**
1. Un usuario nuevo puede no descubrir el backlog (el rail es sutil)
2. Las tareas en backlog son invisibles en la vista principal
3. Ver tareas sin fecha en el Gantt (como barras fantasma) ayuda a priorizar y planificar
4. Jira y otros PM tools muestran el backlog en la misma vista

**Recomendación**: Mantener la separación actual como opción por defecto, pero:
- Agregar un toggle en la FilterBar: "Mostrar backlog en Gantt" que renderice las tareas sin fecha como barras fantasma (grises, sin fecha fija, con un placeholder como "Sin programar")
- Hacer el rail del backlog más descubrible (ya se mejoró con V-20: botón con icono + badge)
- Agregar un atajo de teclado visible: `⌘K` para abrir/cerrar backlog

### 2.3 UX del Backlog actual

**Puntos fuertes:**
- Agrupación por proyecto con contador
- Cards con nombre, tipo, responsable y botón "Programar"
- Formulario inline para asignar fechas
- Animación de transición entre rail colapsado y panel expandido

**Puntos a mejorar:**
- El rail colapsado (44px) es muy sutil. El contador (badge) ayuda pero el texto "BACKLOG" está rotado 180° — ilegible a primera vista
- La acción de "Enviar al backlog" (unschedule) no tiene confirmación y es irreversible sin re-programar
- El botón "Enviar al backlog" aparece para etapas (`stage`), lo cual no tiene sentido (las etapas heredan fechas de sus hijos)

---

## 3. Sincronización de Fechas Proyecto vs Tareas

### 3.1 ¿Un proyecto puede terminar antes que su última tarea?

**SÍ, y es un bug de UX.** El proyecto (nodo raíz tipo `project`) tiene campos `start_date` y `end_date` independientes. DHTMLX Gantt renderiza la barra del proyecto como summary task (abarcando visualmente a sus hijos), pero los campos en base de datos NO se recalculan automáticamente.

**Análisis del código:**

1. **GanttCanvas.tsx:248-286** (`onAfterTaskUpdate`): Cuando el usuario arrastra una barra de tarea hija en el Gantt, se persiste `start_date`/`end_date` de esa tarea individual, pero **NO** se actualizan las fechas del proyecto padre.

2. **dhtmlx-adapter.ts:44-60** (`toGanttData`): Los nodos se pasan a DHTMLX con `parent: node.parent_id`, por lo que DHTMLX calcula la barra summary visualmente. Pero esto es solo visual — los datos en el estado del portfolio no cambian.

3. **DetailPanel.tsx:201-226** (InfoTab): Permite editar manualmente `start_date` y `end_date` del proyecto, pero no muestra ninguna advertencia si la fecha fin es anterior a alguna tarea hija.

**Consecuencias:**
- El KPI summary (`api/summary`) puede reportar avance incorrecto o fechas inconsistentes
- La exportación (JSON/CSV) exporta las fechas del proyecto tal cual están en BD, no las fechas derivadas del árbol
- Si un usuario edita manualmente la fecha fin del proyecto a un valor anterior a la última tarea, los filtros por fecha (`date_from`, `date_to`) darán resultados inconsistentes

### 3.2 Recomendación

**Opción A (Recomendada)**: Hacer que los nodos tipo `project` y `stage` tengan `start_date`/`end_date` calculados automáticamente como MIN/MAX de sus hijos. El campo sería read-only en la UI para estos tipos. Se puede implementar como:
- Trigger SQL en PostgreSQL que recalcule al modificar cualquier hijo
- O un paso en el handler `api/wbs-schedule` que propague hacia arriba

**Opción B**: Mantener fechas manuales pero agregar validación visual:
- Badge de warning "La fecha fin del proyecto es anterior a 3 tareas hijas" en el DetailPanel
- Tooltip en el Gantt mostrando la discrepancia
- Color/estilo diferente en la barra del proyecto si hay inconsistencia

---

## 4. Sistema de Filtros

### 4.1 Arquitectura actual

**FilterBar** (`FilterBar.tsx`): 10 controles de filtro implementados como chips inline + popover "Más filtros":
- Búsqueda por nombre (input search con debounce en el padre)
- Tipo de nodo: chips project/stage/group/task/milestone
- Solo backlog (toggle `showUnscheduled`)
- Ocultar cerrados (toggle `activeOnly`)
- "Más filtros" (popover): proyecto, responsable, ejecutor, estado, desde, hasta

**Sincronización**: 
- URL params via `useSearchParams` (URL search params)
- localStorage `abax.filters` como respaldo
- El filtro `responsible_id`, `assignee_id`, y `status` se envían al backend como query params

**Flujo**:
1. Filtros → `portfolioFilters` object → `usePortfolio(token, portfolioFilters)`
2. `usePortfolio` → `loadPortfolio(token, filters)` → 6 llamadas API en paralelo
3. Adicionalmente, filtrado client-side en `filteredNodes` y `filteredBacklog` (búsqueda local, my_tasks, etc.)
4. `filteredNodes` → `GanttCanvas`

### 4.2 Evaluación UX de filtros

**Puntos fuertes:**
- Chips visuales claros con estado activo/inactivo
- Contador "N elementos" siempre visible
- Botón "Limpiar" con estado disabled cuando no hay filtros activos
- URL sync: los filtros se comparten al copiar el link
- SearchableSelect con búsqueda inline para proyectos/responsables/ejecutores
- Atajos de teclado: `⌘K` búsqueda global

**Puntos a mejorar:**

1. **Filtros en el pie (V-10)**: La FilterBar está debajo del Toolbar y sobre el workspace. En pantallas pequeñas, los filtros quedan al final del scroll vertical. **Recomendación**: Mover la FilterBar justo debajo de los KPIs (top) o permitir anclarla.

2. **Filtros "Más filtros" poco descubribles**: El popover está oculto detrás de un botón con texto "Más filtros ▾". Solo muestra un indicador (●) si hay filtros activos dentro. Un usuario puede no notar que existen filtros de responsable/ejecutor/fechas.

3. **Filtro `my_tasks` usa el nombre de usuario, no el ID**: En `GanttPage.tsx:291`:
   ```ts
   const myIds = new Set(portfolio.data?.users.filter((u) => u.id === session?.userName || u.full_name === session?.userName).map((u) => u.id));
   ```
   Esto compara `session.userName` con `u.id` — claramente un bug. Debería comparar con `u.email` o usar `currentUserId`.

4. **Doble filtrado (backend + frontend)**: Los filtros `project_id`, `responsible_id`, `assignee_id`, `status`, `date_from`, `date_to` se envían al backend, pero `searchTerm`, `typeFilter`, `myTasks`, `focusProjectId` se aplican solo en frontend. Esto causa inconsistencias:
   - El contador "N elementos" incluye el filtro frontend
   - Pero el backend puede devolver más/menos elementos de los que el frontend muestra
   - Ejemplo: filtrar por `responsible_id=X` en backend + `type=task` en frontend → el backend devuelve todos los tipos, el frontend recorta

5. **Falta filtro por progreso**: No hay forma de filtrar "Tareas completadas", "Tareas > 50%", etc.

### 4.3 Recomendaciones de filtros

| Prioridad | Acción |
|-----------|--------|
| P1 | Mover FilterBar al top (debajo de KPIs) |
| P1 | Unificar filtrado: todo en backend o todo en frontend, no mezclado |
| P1 | Corregir `my_tasks` para usar `currentUserId` en lugar de `userName === id` |
| P2 | Agregar filtro por progreso (slider o chips: 0% / 1-49% / 50-99% / 100%) |
| P2 | Agregar filtro "Tareas vencidas" (end_date < today AND progress < 1) |
| P3 | Tooltip en "Más filtros" indicando cuántos filtros hay activos dentro |
| P3 | Persistir estado de "Más filtros" abierto/cerrado |

---

## 5. Revisión de Componentes Web

### 5.1 AppShell
**Función**: Layout principal con topbar, KPIs, y children.
**Estado**: Robusto. Breadcrumb dinámico (V-13 fix), tema oscuro, búsqueda global con `⌘K`.
**Issues**:
- Los KPIs pueden mostrar "0 de 0 totales" mientras el árbol tiene datos — si el summary endpoint falla silenciosamente.
- El botón de Admin aparece incluso para usuarios no-admin (el backend protege la ruta, pero la UI debería ocultarlo).

### 5.2 GanttCanvas
**Función**: Renderiza el Gantt de DHTMLX con datos del portafolio.
**Estado**: Inicialización única (evitando re-renderizados destructivos), ResizeObserver para V-02 fix, zoom con niveles Día/Semana/Mes/Año, drag & drop para dependencias, inline editor de estado.
**Issues**:
- `gantt.clearAll()` + `gantt.parse()` en cada cambio de `nodes`/`dependencies` puede causar flicker
- El plugin tooltip se activa con try/catch silencioso
- `canEditStructure` fuerza re-init completo del Gantt (pierde estado de scroll/colapso)

### 5.3 DetailPanel
**Función**: Panel derecho con 7 tabs (Info, Responsables, Ejecutores, Avance, Horas, Presupuesto, Adjuntos).
**Estado**: Completo. Autosave con debounce de 500ms. Slider de avance con persistencia inmediata al soltar.
**Issues**:
- "Enviar al backlog" disponible para tipos `stage` y `project` — debería limitarse a `task` (V-16 parcialmente arreglado: solo si `node.type === 'task'`)
- Tabs "Presupuesto" y "Adjuntos" se desbordan horizontalmente en viewports pequeños
- El autosave no incluye `progress` (manejado por separado en ProgressTab) — esto es intencional pero confuso si el usuario edita en InfoTab y no ve el progreso cambiar

### 5.4 FilterBar
**Función**: 10 controles de filtro como chips + popover.
**Estado**: Funcional, completo. Ver §4 para evaluación detallada.

### 5.5 BacklogPanel
**Función**: Rail lateral colapsable + panel expandido con tareas sin fecha.
**Estado**: Mejorado con V-20 (rail más descubrible con botón + badge). Ver §2 para discusión de backlog vs Gantt.

### 5.6 Toolbar
**Función**: Acciones primarias: Crear proyecto, crear nodo hijo, Hoy, escala, Mis tareas, Enfocar proyecto, Pantalla completa, Exportar.
**Estado**: Completo. Atajos de teclado visibles (`⌘⇧N`). Menú Exportar con 4 formatos.
**Issues**:
- "Enfocar proyecto" requiere tener un nodo seleccionado — debería permitir seleccionar proyecto de una lista
- El botón "+ Nodo hijo" no indica qué tipo de hijo se creará por defecto

### 5.7 CreateDialog
**Función**: Modal minimal para crear proyecto o nodo hijo.
**Estado**: Excelente. Una sola entrada (nombre), placeholder contextual, tecla Enter/ESC, validación inline. Para nodos hijos: selector de tipo con default inteligente (project→stage, stage→group, etc.), checkbox para programar con fechas opcionales.
**Issue**: Al crear un proyecto, no se pregunta fecha de inicio (ver §1.1).

### 5.8 MobileTaskList
**Función**: Vista mobile (<768px) con lista de tareas categorizadas por urgencia.
**Estado**: Bien diseñada — agrupa Atrasadas/Hoy/Esta semana. Slider de avance + input de horas. Botón para volver al Gantt.
**Issues**:
- Solo muestra tareas `type === 'task'`. Hitos, etapas y grupos no son visibles.
- No tiene filtros. El usuario mobile no puede buscar ni filtrar.
- El botón "Ver Gantt" lleva a una vista Gantt no optimizada para touch.

### 5.9 AdminPage
**Función**: Gestión de usuarios (invitar, activar/desactivar, cambiar rol admin).
**Estado**: Funcional con V-17 parcial (search + filtro por status).
**Issues**:
- No hay paginación (no escala a cientos de usuarios)
- El formulario de invitación ocupa todo el ancho
- No hay vista de tipos de proyecto (US-01 pendiente)

### 5.10 ShortcutsModal
**Función**: Modal con todos los atajos de teclado, accesible con `?`.
**Estado**: Completo (V-22 fix). Grupos: Navegación, Gantt, Backlog, Exportar.

### 5.11 SearchableSelect
**Función**: Dropdown con búsqueda inline usado en FilterBar "Más filtros".
**Estado**: Funcional. Soporta teclado, filtrado local, empty state.

### 5.12 ToastProvider
**Función**: Notificaciones toast (success/error/info) stackeables.
**Estado**: Robusto. Animación, auto-dismiss, máximo 3 visibles.

### 5.13 ConfirmDialog
**Función**: Modal de confirmación para acciones destructivas.
**Estado**: Usado para eliminar dependencias y adjuntos. Simple pero efectivo.

### 5.14 GanttSkeleton
**Función**: Loading skeleton del Gantt con shimmer animation.
**Estado**: Excelente. Animación sutil, columnas simuladas, barras de tarea placeholder.

### 5.15 ErrorBoundary
**Función**: Captura errores de renderizado en GanttCanvas y DetailPanel.
**Estado**: Básico — muestra mensaje de error sin acción de recuperación.

### 5.16 TimesheetPanel
**Función**: Tab "Horas" en DetailPanel — registros de tiempo por tarea.
**Estado**: Lectura de time entries, agrupados por usuario, con avatar + horas + fecha.

### 5.17 DetailRail
**Función**: Versión colapsada del DetailPanel (solo label vertical).
**Estado**: Mirror del backlog rail. Muestra el nombre del nodo seleccionado en vertical.

---

## 6. Estado de Bugs Visuales

Resumen ejecutivo del análisis de Mayo 19 (21 capturas) y estado actual:

| # | Severidad | Hallazgo | Estado (May 23) |
|---|-----------|----------|-----------------|
| V-01 | 🔴 Crítica | Mobile/tablet rotos | **PARCIAL**: MobileTaskList agregada para <768px; el Gantt se oculta en mobile y se muestra la lista de tareas |
| V-02 | 🔴 Crítica | Grid se vacía al cambiar layout | **ARREGLADO**: ResizeObserver en GanttCanvas llama gantt.setSizes() |
| V-03 | 🔴 Crítica | Detail panel superpuesto a 900px | **ARREGLADO**: CSS muestra detail panel como fullscreen modal ≤900px |
| V-04 | 🔴 Crítica | Dark mode rompe DHTMLX grid | **ARREGLADO**: CSS overrides para `[data-theme="dark"]` en .gantt_* |
| V-05 | 🟠 Alta | CSP bloquea fuentes | **ARREGLADO**: Self-host de Inter (woff2) |
| V-06 | 🟠 Alta | frame-ancestors en meta ignorado | **PENDIENTE**: Requiere header HTTP en Deno server |
| V-07 | 🟠 Alta | KPIs inconsistentes con árbol | **PENDIENTE**: Si el summary endpoint falla, muestra 0 |
| V-08 | 🟠 Alta | Errores JSON crudos | **ARREGLADO**: api.ts captura 401, limpia token, emite evento |
| V-09 | 🟠 Alta | Responsable no ve proyecto | **ARREGLADO**: Backend projects.ts consulta responsible_id y assignee_id en sub-nodos |
| V-10 | 🟡 Media | Filtros al pie | **PENDIENTE**: Siguen en el pie |
| V-11 | 🟡 Media | Detail panel roba espacio | **ARREGLADO**: Empty panel se oculta ≤1199px |
| V-12 | 🟡 Media | Fecha INICIO truncada | **PENDIENTE**: Columna de 95px con formato dd/mm/yyyy es ajustado |
| V-13 | 🟡 Media | Breadcrumb estático | **ARREGLADO**: Breadcrumb dinámico en AppShell |
| V-14 | 🟡 Media | Sin indent en árbol | **ARREGLADO**: CSS indent de 22px en .gantt_tree_indent |
| V-15 | 🟡 Media | Nombres duplicados | **ARREGLADO**: Tooltip con ruta de ancestros (proyecto > etapa > grupo) |
| V-16 | 🟡 Media | Backlog en etapas | **PARCIAL**: Solo `node.type === 'task'` en DetailPanel. Pero aún se puede vía atajo ⌘Backspace. |
| V-17 | 🟡 Media | Admin sin búsqueda | **ARREGLADO**: Search input + filtro por status |
| V-18 | 🟢 Baja | Inter Google Fonts | **ARREGLADO**: Self-host woff2 |
| V-19 | 🟢 Baja | Sin loading state | **ARREGLADO**: GanttSkeleton con shimmer |
| V-20 | 🟢 Baja | Backlog rail poco descubrible | **ARREGLADO**: Botón con icono + badge + label |
| V-21 | 🟢 Baja | Sin confirmación archivar | **PENDIENTE** |
| V-22 | 🟢 Baja | Atajos no documentados | **ARREGLADO**: ShortcutsModal con `?` |

---

## 7. Recomendaciones Priorizadas

### P0 — Críticas (nuevo hallazgo)
1. **Proyecto recién creado no visible en Gantt** (ver §1): Agregar `start_date` por defecto al crear proyecto, o mostrar nodos sin fecha como barras fantasma.

### P1 — Altas (pendientes del análisis anterior + hallazgos nuevos)
2. **Sincronización de fechas proyecto ↔ tareas** (ver §3): Implementar cálculo automático de fechas para project/stage basado en hijos.
3. **Mover FilterBar al top** (V-10): Colocar debajo de los KPIs.
4. **Unificar filtrado backend/frontend**: Evitar el doble filtro que causa conteos inconsistentes.
5. **Corregir my_tasks filter**: `userName === id` es un bug — usar `currentUserId`.
6. **CSP frame-ancestors en headers HTTP** (V-06): Mover del meta tag al Deno server.

### P2 — Medias
7. **Backlog "fantasma" en Gantt**: Opción de visualizar tareas sin fecha en el Gantt como barras grises.
8. **Filtro por progreso**: Chips o slider para filtrar por % de avance.
9. **Mostrar nodos sin fecha en Gantt**: Franja visual distinta en vez de ocultarlos.
10. **Fechas relativas en columna INICIO**: Formato "15 May" en vez de "15/05/2026" para ahorrar espacio (V-12).
11. **Confirmación visual al archivar proyecto** (V-21): Badge "archivado" o toast.
12. **Limitar "Enviar al backlog" a task** también en el atajo ⌘Backspace.

### P3 — Bajas
13. **AdminPage**: Paginación de usuarios.
14. **ErrorBoundary**: Botón "Reintentar" para recuperación.
15. **Toolbar "Enfocar proyecto"**: Permitir seleccionar de lista, no solo del nodo activo.
16. **MobileTaskList**: Agregar búsqueda y filtros básicos.
