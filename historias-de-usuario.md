# Historias de Usuario — Gestor de Proyectos con Diagramas de Gantt

---

## Requerimiento Refinado

Sistema web responsive (desktop + móvil) con autenticación, centrado en una **única vista principal: el diagrama de Gantt**. En desktop se prioriza la edición completa; en móvil se garantiza consulta, filtros, revisión de detalle y actualización de avance. Toda operación —crear, editar, asignar, arrastrar, depender— se hace directamente sobre el Gantt cuando el dispositivo lo permite. No existen pantallas de detalle separadas; toda la información se despliega en paneles laterales, modales o inlines sobre el mismo Gantt sin perder el contexto visual.

Filosofía: **simplicidad extrema**. Solo el nombre es obligatorio al crear cualquier entidad. Las tareas sin fechas van a un backlog lateral y se arrastran al Gantt para programarlas. El sistema debe sentirse como una herramienta que "no estorba": crear una tarea es un Enter sobre el Gantt, programarla es un drag.

### Decisiones de experiencia

- **Autoscheduling activado por defecto:** al mover tareas con dependencias, el sistema puede ajustar sucesoras automáticamente. El usuario puede desactivarlo por vista/proyecto; si está apagado, el sistema solo advierte conflictos.
- **Backlog simple por contexto:** el panel de backlog muestra tareas sin programar del proyecto enfocado. Si no hay un único proyecto enfocado, agrupa tareas por proyecto y permite filtrar rápidamente.
- **Ejecutores con contexto de solo lectura:** en "Mis tareas", el ejecutor ve proyecto, etapas y grupos ancestros en solo lectura para entender contexto, pero solo puede reportar avance/horas sobre sus tareas asignadas.
- **Asignación custom:** al usar DHTMLX GPL, la asignación de ejecutores se implementa con UI propia en panel lateral y tabla `task_assignees`, sin depender de Resource Management PRO.
- **Estados UX obligatorios:** todo autosave muestra estado guardando/guardado/error; las acciones sin permiso aparecen deshabilitadas con explicación; los cambios destructivos requieren confirmación; los conflictos por dependencias o colaboración muestran aviso recuperable.

### Roles base del sistema

| Rol | Descripción |
|---|---|
| **Administrador** | Configura el sistema (tipos de proyecto, usuarios). Ve y edita absolutamente todo. |
| **Usuario** | Crea proyectos. Cuando crea un proyecto o es asignado como responsable de cualquier nodo del WBS, obtiene control sobre ese nodo y toda su descendencia. |

### Principio rector de permisos: responsabilidad heredada hacia abajo

> **Quien es responsable de un nodo, es responsable de todo lo que cuelga de él.**  
> Si soy responsable del proyecto → administro sus etapas, grupos, tareas e hitos.  
> Si soy responsable de una etapa → administro esa etapa y todo lo que contiene.  
> Si soy responsable de un grupo → administro ese grupo y sus tareas.  
> Si soy responsable de una tarea → administro esa tarea y sus sub-tareas.  
> Si un nodo no tiene responsable designado explícitamente, hereda el responsable de su ancestro más cercano. El creador del proyecto es siempre el responsable raíz, por lo que ninguna tarea queda sin responsable administrativo.
> Esto reemplaza cualquier matriz compleja de roles por proyecto: el permiso se hereda en cascada por la estructura del WBS.

### Principio rector de simplicidad

> **El único campo obligatorio en cualquier entidad es el nombre/título.** Todo lo demás —fechas, tipo, presupuesto, asignado, color, adjuntos, horas— es opcional. Las tareas sin fechas no se grafican en el Gantt: quedan en un backlog lateral listas para ser programadas arrastrándolas al calendario.

---

## Épica 1 — Administración del Sistema

### US-01 — Configuración de tipos de proyecto

**Como** administrador
**quiero** crear y gestionar tipos de proyecto (ej. desarrollo, marketing, obra civil, TI)
**para** categorizar los proyectos y aplicar configuraciones o filtros por tipología.

**Criterios de aceptación:**
- El admin puede crear, editar y desactivar tipos de proyecto.
- Cada tipo tiene un nombre, descripción opcional y un color identificativo.
- Al listar proyectos, se muestra el tipo con su color asociado.
- Un tipo no se puede eliminar si tiene proyectos activos asociados.

---

### US-02 — Gestión de usuarios

**Como** administrador
**quiero** invitar, activar y desactivar usuarios en el sistema
**para** controlar quién puede acceder.

**Criterios de aceptación:**
- El admin puede crear usuarios con email y nombre.
- El sistema envía un correo de invitación para que el usuario establezca su contraseña.
- Todos los usuarios tienen el mismo rol base: pueden crear proyectos y ser asignados como responsables.
- El admin puede desactivar usuarios (no se eliminan, se inhabilitan).
- Los permisos sobre proyectos y tareas no se configuran aquí: se heredan por ser responsable de un nodo del WBS (ver principio de permisos).

---

## Épica 2 — Gestión de Proyectos

### US-03 — Crear un proyecto desde el Gantt consolidado

**Como** usuario
**quiero** crear un proyecto con solo un nombre desde un botón o atajo en la vista Gantt principal
**para** registrar rápidamente un nuevo proyecto sin fricción, sin salir del Gantt, y quedar como su responsable automáticamente.

**Criterios de aceptación:**
- En el Gantt consolidado (vista principal) existe un botón "+ Proyecto" o atajo de teclado.
- Al presionarlo, se agrega una fila nueva en el árbol del Gantt donde escribo el nombre y presiono Enter.
- El único campo obligatorio es el nombre.
- El usuario que crea el proyecto queda como **responsable** del proyecto (y por tanto de todo lo que contenga).
- El proyecto aparece inmediatamente como un nuevo nodo raíz colapsable en el Gantt consolidado.

---

### US-04 — Editar datos del proyecto (inline en el Gantt)

**Como** responsable del proyecto
**quiero** poder editar el nombre, descripción, tipo, fechas o presupuesto directamente desde el Gantt
**para** mantener la información actualizada sin navegar a otra pantalla.

**Criterios de aceptación:**
- Doble clic en el nombre del proyecto en el árbol del Gantt permite editar el nombre inline.
- Clic derecho > "Editar detalles" o un panel lateral desplegable muestra los campos opcionales: descripción, tipo, fechas, presupuesto.
- Los cambios se guardan automáticamente.
- Solo el responsable del proyecto o el admin pueden editar.

---

### US-05 — Adjuntar archivos al proyecto (panel lateral del Gantt)

**Como** responsable del proyecto
**quiero** poder adjuntar documentos o imágenes desde un panel lateral sobre el mismo Gantt
**para** tener referencias a mano sin perder de vista el cronograma.

**Criterios de aceptación:**
- Panel lateral derecho que se abre/cierra sin salir del Gantt.
- Se permite arrastrar o seleccionar archivo (PDF, imagen, Excel, Word).
- Tamaño máximo por archivo: 5 MB. Máximo 5 archivos por proyecto.

---

## Épica 3 — Estructura de Trabajo (WBS)

### US-06 — Crear hitos (inline en el Gantt)

**Como** responsable del proyecto/etapa/grupo
**quiero** agregar un hito directamente sobre la línea de tiempo del Gantt
**para** marcar fechas clave sin salir de la vista principal.

**Criterios de aceptación:**
- Clic derecho sobre una fecha en el área del calendario > "Agregar hito".
- Solo se requiere nombre y la fecha queda definida por la posición del clic.
- Se muestra como rombo en el Gantt.
- Se puede arrastrar horizontalmente para cambiar la fecha.
- Solo el responsable del nodo padre o el admin pueden crear/editarlo.

---

### US-07 — Crear etapas (inline en el árbol del Gantt)

**Como** responsable del proyecto
**quiero** agregar una etapa directamente como una fila en el árbol del Gantt bajo el proyecto
**para** organizar el trabajo en fases sin formularios ni pantallas extra.

**Criterios de aceptación:**
- Clic derecho sobre el proyecto > "Agregar etapa", o atajo de teclado (ej. Ctrl+Shift+E).
- Solo el nombre es obligatorio. Fechas y color son opcionales.
- La etapa aparece como un nodo colapsable en el árbol del Gantt.
- Sin fechas propias, el rango se calcula automáticamente de sus tareas hijas.
- Solo el responsable del proyecto o el admin pueden crear etapas.

---

### US-08 — Crear grupos de tareas (inline en el árbol del Gantt)

**Como** responsable de una etapa o grupo padre
**quiero** agregar un grupo como fila anidada en el árbol del Gantt
**para** categorizar tareas relacionadas sin salir de la vista.

**Criterios de aceptación:**
- Clic derecho sobre una etapa o grupo > "Agregar grupo", o atajo.
- Solo el nombre es obligatorio. Color opcional.
- Colapsa/expande en el árbol del Gantt.
- La barra resumen abarca de la primera a la última tarea hija con fecha.

---

### US-09 — Crear tareas con jerarquía padre-hijo (inline en el Gantt)

**Como** responsable de cualquier nodo del WBS
**quiero** agregar una tarea con solo escribir su nombre debajo del nodo que administro, y poder anidar sub-tareas
**para** desglosar el trabajo sin formularios: escribir, Enter, listo.

**Criterios de aceptación:**
- Selecciono un nodo (etapa, grupo, tarea), presiono Enter o Insert, escribo el nombre, presiono Enter de nuevo.
- Solo el nombre es obligatorio.
- La tarea se crea como hija del nodo seleccionado.
- Las tareas sin fecha van al backlog lateral automáticamente.
- Las tareas con fecha aparecen como barra en el calendario del Gantt.
- Se soportan al menos 5 niveles de anidación.
- Solo el responsable del nodo padre puede crear tareas debajo de él.

---

### US-09B — Designar responsable de cualquier nodo del WBS

**Como** responsable de un nodo (proyecto, etapa, grupo o tarea)
**quiero** designar a otro usuario como responsable de ese nodo
**para** delegar la administración de una rama completa del WBS sin intervenir en el resto.

**Criterios de aceptación:**
- Clic derecho sobre cualquier nodo del árbol del Gantt > "Designar responsable", o desde el panel lateral de detalles.
- Se busca y selecciona un usuario del sistema.
- El usuario designado obtiene control total sobre ese nodo y **toda su descendencia**: puede crear, editar, eliminar, asignar ejecutores y a su vez delegar responsabilidad hacia abajo.
- El responsable padre (quien delegó) conserva también el control (herencia hacia abajo no revoca al padre).
- Un nodo puede tener un solo responsable. Al cambiar, el anterior pierde el control sobre esa rama (salvo que sea responsable de un ancestro).
- En el Gantt, el avatar o iniciales del responsable aparecen junto al nombre del nodo.
- El administrador puede ver y editar todo independientemente de esta delegación.

---

### US-10 — Establecer dependencias entre tareas (sobre el Gantt)

**Como** responsable del nodo padre de las tareas involucradas
**quiero** definir que una tarea depende de otra arrastrando de una barra a otra sobre el mismo Gantt
**para** modelar la secuencia de trabajo sin abrir formularios.

**Criterios de aceptación:**
- Tipos de dependencia: Fin-a-Inicio (FS), Inicio-a-Inicio (SS), Fin-a-Fin (FF), Inicio-a-Fin (SF).
- Se crean arrastrando el borde de una barra hacia otra barra en el calendario.
- Se visualizan como flechas entre barras.
- Autoscheduling está activado por defecto: al mover una predecesora, el sistema recalcula sucesoras dependientes y muestra una notificación con opción de deshacer.
- Si el usuario desactiva autoscheduling, al mover una predecesora el sistema solo alerta conflictos y no mueve sucesoras automáticamente.
- Solo el responsable de un ancestro común administrable de ambas tareas (o el admin) puede crear dependencias.

---

### US-10B — Gestionar el backlog de tareas sin programar

**Como** responsable (PM)
**quiero** ver en un panel lateral las tareas que no tienen fecha asignada y poder arrastrarlas directamente al Gantt para programarlas
**para** planificar de forma flexible: primero vaciar ideas como lista de tareas y luego ubicarlas en el tiempo.

**Criterios de aceptación:**
- El backlog se muestra como un panel colapsable a la izquierda del Gantt.
- Si hay un proyecto enfocado o seleccionado, el backlog muestra solo ese proyecto; si la vista está consolidada, agrupa las tareas sin fecha por proyecto y permite filtrar a uno.
- Las tareas en el backlog se agrupan bajo su etapa/grupo/tarea padre, reflejando la jerarquía WBS.
- Cada tarea del backlog muestra su nombre, asignado (si tiene) y un ícono para indicar que no está programada.
- El PM puede arrastrar una tarea del backlog hacia el área del calendario en el Gantt para asignarle fechas de inicio y fin automáticamente.
- También puede crear tareas nuevas directamente en el backlog con solo escribir un nombre y presionar Enter.
- Las tareas programadas desaparecen del backlog automáticamente y aparecen en el Gantt.

---

## Épica 4 — Asignación y Ejecución de Tareas

### US-11 — Asignar ejecutores a una tarea (quién hace el trabajo)

**Como** responsable del nodo padre de la tarea
**quiero** asignar uno o varios usuarios como ejecutores de una tarea directamente desde el Gantt
**para** distribuir el trabajo operativo. El ejecutor no administra, solo ejecuta y reporta avance.

**Criterios de aceptación:**
- Sobre la barra de la tarea en el Gantt: clic > dropdown con usuarios del sistema.
- Se pueden asignar uno o varios ejecutores por tarea.
- El nombre/avatar del ejecutor aparece sobre la barra en el Gantt.
- El ejecutor **no** puede editar la tarea, solo reportar avance y horas.
- El ejecutor **no** puede crear, editar ni eliminar tareas hijas (eso es potestad del responsable).
- Si una tarea no tiene ejecutor asignado, no aparece en "Mis tareas" de nadie. El responsable puede editarla normalmente; queda visible en el Gantt esperando a que se le asigne un ejecutor.
- Solo el responsable de la etapa/grupo/tarea padre (o admin) puede asignar ejecutores.

---

### US-12 — Ver "Mis tareas" (como ejecutor)

**Como** usuario
**quiero** aplicar un filtro rápido en el Gantt para ver solo las tareas donde soy ejecutor asignado
**para** concentrarme en el trabajo que debo ejecutar, sin distracciones del resto del WBS.

**Criterios de aceptación:**
- Botón/filtro rápido "Mis tareas" en la barra de herramientas del Gantt.
- Al activarlo, el Gantt muestra solo las tareas donde el usuario actual es ejecutor.
- Las tareas se agrupan bajo su proyecto/etapa/grupo padre, mostrando todos los ancestros necesarios en solo lectura para conservar contexto.
- En móvil: se adapta como lista simple con fechas y % de avance.

---

### US-13 — Reportar avance en una tarea (como ejecutor)

**Como** ejecutor asignado a una tarea
**quiero** actualizar el porcentaje de avance directamente desde la barra en el Gantt o desde "Mis tareas"
**para** que el responsable y stakeholders vean el progreso real sin fricción.

**Criterios de aceptación:**
- Clic sobre la barra de mi tarea en el Gantt > deslizar % de avance (0-100) o marcar "Completada".
- En móvil: toggle o slider en la lista de "Mis tareas".
- El ejecutor solo puede modificar avance y horas reportadas; no puede cambiar nombre, fechas, jerarquía, responsables, ejecutores ni dependencias.
- Las tareas completadas se muestran en verde con check.
- El avance de tareas padre se calcula automáticamente como promedio ponderado por duración de sus hijas.
- Solo el ejecutor asignado (o el responsable del nodo padre, o el admin) puede reportar avance.

---

## Épica 5 — Vista Gantt

### US-14 — Navegar al Gantt de un proyecto individual

**Como** cualquier usuario
**quiero** hacer clic en el nombre de un proyecto en el Gantt consolidado para expandirlo y trabajar sobre él directamente en el mismo árbol
**para** gestionar un proyecto específico sin "navegar a otra pantalla": simplemente colapso los demás proyectos.

**Criterios de aceptación:**
- En el Gantt consolidado, al expandir un proyecto se muestran todas sus etapas, grupos, tareas e hitos.
- Colapsar los demás proyectos oculta su contenido, enfocando la vista en el proyecto deseado.
- La escala de tiempo y los filtros se mantienen.
- Toda operación (crear, editar, arrastrar, asignar) funciona igual esté en vista consolidada o con un solo proyecto expandido.

---

### US-15 — Vista Gantt multi-proyecto (consolidado)

**Como** cualquier usuario
**quiero** ver el Gantt consolidado como mi pantalla de inicio al entrar al sistema, con todos los proyectos donde soy responsable o ejecutor visibles por defecto, y poder expandir a todos los proyectos
**para** tener una visión global inmediata del portafolio.

**Criterios de aceptación:**
- El Gantt consolidado es la **vista principal y única** del sistema. No hay dashboard de lista de proyectos separado.
- Muestra todos los proyectos visibles para el usuario (donde es responsable, ejecutor, o todos si es admin).
- Cada proyecto es un nodo raíz colapsable en el árbol del Gantt.
- Selector de proyectos (checkbox) para mostrar/ocultar proyectos sin salir de la vista.
- Las barras de cada proyecto heredan un color por tipo de proyecto o un color automático.

---

### US-16 — Aplicar filtros en la vista Gantt

**Como** cualquier usuario
**quiero** filtrar las tareas visibles en el Gantt por proyecto, tipo de proyecto, responsable, estado, fechas o miembro asignado
**para** enfocarme solo en la información relevante para mi análisis.

**Criterios de aceptación:**
- Barra de filtros en la parte superior del Gantt con al menos: proyecto, tipo, responsable, asignado a, estado (pendiente, en progreso, completado, retrasado) y rango de fechas.
- Los filtros se aplican en tiempo real al cambiar cualquier valor.
- Los filtros activos se muestran como "chips" o "tags" que se pueden quitar individualmente.
- Hay un botón "Limpiar filtros".
- La URL se actualiza con los filtros aplicados para poder compartir la vista.

---

### US-17 — Navegación temporal en el Gantt

**Como** cualquier usuario
**quiero** desplazarme en el tiempo (zoom in/out, arrastrar, saltar a "Hoy")
**para** explorar el cronograma con fluidez en diferentes niveles de detalle.

**Criterios de aceptación:**
- Zoom con scroll del mouse o botones +/-.
- Arrastre horizontal (pan) para mover la línea de tiempo.
- Botón "Hoy" para centrar la vista en la fecha actual.
- Atajos de teclado: flechas izquierda/derecha para navegar, +/- para zoom.
- En móvil: gestos de pellizco para zoom y deslizamiento para navegar.

---

### US-18 — Interacción directa sobre barras del Gantt y backlog (drag & drop)

**Como** responsable (PM)
**quiero** poder modificar fechas, crear dependencias y programar tareas directamente arrastrando elementos en la interfaz
**para** planificar de forma visual y rápida sin tener que abrir formularios.

**Criterios de aceptación:**
- Arrastrar el borde izquierdo/derecho de una barra cambia la fecha de inicio/fin respectivamente.
- Arrastrar la barra completa mueve la tarea en bloque (cambian inicio y fin manteniendo duración).
- Arrastrar una tarea desde el panel de backlog hacia el área del calendario la programa automáticamente (asigna fechas de inicio y fin).
- Arrastrar una tarea del Gantt de vuelta al backlog le quita las fechas y queda sin programar.
- Los cambios de fecha se guardan automáticamente al soltar (autosave).
- Si la tarea tiene dependencias que se violan con el movimiento, el sistema muestra una advertencia.

---

### US-19 — Vista Gantt en dispositivo móvil

**Como** miembro / stakeholder
**quiero** consultar el Gantt desde mi teléfono con una experiencia adaptada
**para** revisar avances y fechas estando fuera de la oficina.

**Criterios de aceptación:**
- La vista se adapta a pantalla pequeña: las tareas se muestran como lista expandible con indicador visual de barra simplificada.
- Toque en una tarea expande su detalle (fechas, asignado, avance, dependencias).
- Se mantiene la funcionalidad de filtros.
- Los hitos y tareas próximas se resaltan.

---

## Épica 6 — Presupuesto

### US-20 — Registrar costo/horas estimadas por tarea (panel lateral)

**Como** responsable del nodo padre de la tarea
**quiero** asignar horas o costo estimado a una tarea desde el panel lateral sobre el Gantt
**para** tener trazabilidad presupuestaria desde el nivel más granular sin salir de la vista.

**Criterios de aceptación:**
- Selecciono una tarea, el panel lateral muestra campos opcionales: horas estimadas, costo estimado.
- El costo de una tarea padre se calcula como suma de sus hijas.
- El presupuesto del proyecto se consolida hacia arriba automáticamente.

---

### US-21 — Visualizar el presupuesto (panel lateral del Gantt)

**Como** responsable del proyecto / admin
**quiero** ver en un panel lateral, sin salir del Gantt, el resumen presupuestario del proyecto
**para** detectar desviaciones de un vistazo.

**Criterios de aceptación:**
- Panel lateral derecho > pestaña "Presupuesto" muestra: presupuesto global, total estimado (suma de tareas), desviación.
- Indicador de color: verde (ok), amarillo (>80%), rojo (excedido).
- Solo visible para el responsable del proyecto y admin.

---

### US-22 — Registrar horas reales ejecutadas (como ejecutor)

**Como** ejecutor de una tarea
**quiero** registrar opcionalmente las horas trabajadas al reportar avance
**para** que el responsable pueda comparar estimado vs. real sin salir del Gantt.

**Criterios de aceptación:**
- Al reportar avance en el panel lateral o inline, campo opcional "Horas trabajadas".
- El sistema acumula las horas reportadas por todos los ejecutores en la tarea.
- La tarea muestra en el panel lateral: horas estimadas vs. horas reales acumuladas.

---

## Épica 7 — Dashboard y Reportes

### US-23 — Panel de indicadores sobre el Gantt

**Como** responsable de proyectos / admin
**quiero** ver indicadores resumen (total proyectos activos, avance global, hitos próximos) en una barra superior o panel colapsable sobre el mismo Gantt
**para** tener una foto general sin abandonar la vista principal ni navegar a un dashboard separado.

**Criterios de aceptación:**
- Barra superior colapsable con widgets compactos: proyectos activos, % avance global, próximos hitos (30 días), presupuesto consumido.
- Cada widget es cliqueable: aplica el filtro correspondiente en el Gantt.
- Se recarga al cambiar los filtros del Gantt.

---

### US-24 — Exportar vista actual del Gantt

**Como** cualquier usuario
**quiero** exportar la vista actual del Gantt (con filtros y zoom aplicados) como PNG o PDF desde un botón en la barra de herramientas
**para** incluirla en presentaciones o reportes.

**Criterios de aceptación:**
- Botón "Exportar" en la barra del Gantt.
- PNG: captura de lo visible en pantalla con los filtros activos.
- PDF: incluye nombre del proyecto(s) y fecha de exportación.
- Respeta el nivel de zoom y los proyectos expandidos/colapsados.

---

## Resumen de alcance y priorización (MoSCoW)

### Must Have (MVP)
- US-02 — Gestión de usuarios (solo admin crea/desactiva usuarios)
- US-03 — Crear proyecto desde el Gantt (solo nombre obligatorio, auto-responsable)
- US-06 — Hitos (inline en el Gantt)
- US-07 — Etapas (inline en el árbol del Gantt)
- US-08 — Grupos de tareas (inline en el árbol del Gantt)
- US-09 — Tareas con jerarquía padre-hijo (inline, Enter para crear)
- US-09B — Designar responsable de cualquier nodo del WBS (permisos heredados)
- US-10 — Dependencias entre tareas (arrastrar sobre el Gantt)
- US-10B — Backlog de tareas sin programar (panel lateral + drag al Gantt)
- US-11 — Asignar ejecutores a tareas
- US-14/15 — Gantt consolidado como vista única principal
- US-16 — Filtros en Gantt

### Should Have (v1.1)
- US-01 — Tipos de proyecto
- US-04 — Editar datos del proyecto (panel lateral)
- US-12 — Filtro rápido "Mis tareas" (como ejecutor)
- US-13 — Reportar avance (como ejecutor, inline)
- US-17 — Navegación temporal avanzada
- US-18 — Drag & drop completo (barras + backlog)
- US-20 — Costo/horas estimadas por tarea (panel lateral)
- US-21 — Panel de presupuesto (lateral)

### Could Have (v1.2)
- US-05 — Adjuntos al proyecto (panel lateral)
- US-19 — Vista móvil del Gantt avanzada
- US-22 — Horas reales ejecutadas
- US-23 — Panel de indicadores sobre el Gantt
- US-24 — Exportar Gantt (PNG/PDF)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript |
| Gantt | **DHTMLX Gantt 9.1.4 GPL** |
| UI Kit | TailwindCSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Row Level Security) |
| Storage | Supabase Storage (para adjuntos) |
| Mobile | PWA (misma app web con service worker) |

### Decisión de licencia GPL

Se usará **DHTMLX Gantt GPL**. Para reducir dependencia de funcionalidades PRO, el MVP se diseña con un único Gantt, propiedades custom y UI React complementaria.

| Necesidad | Enfoque con GPL |
|---|---|
| Proyecto, etapa, grupo, tarea | Un solo modelo `task` con propiedad `type` custom y estilos CSS/templates |
| Hitos | Milestone nativo si está disponible; si no, tarea de duración cero con template visual de rombo |
| Autoscheduling | Preferir extensión disponible en GPL; si no cubre todo, implementar recálculo server-side mínimo para FS y validación/alertas para SS/FF/SF |
| Asignar ejecutores | Panel lateral React + tabla `task_assignees`, sin Resource Management PRO |
| Multi-proyecto | Un único Gantt con proyectos como nodos raíz, sin múltiples instancias |
| Export | Usar export disponible en GPL si aplica; si no, dejar PDF/PNG para v1.2 con solución server-side/captura |

---

## Consideraciones de implementación con DHTMLX Gantt

### Modelo de datos nativo de DHTMLX

DHTMLX maneja **un solo tipo de entidad base: la tarea** (`task`). No existe distinción nativa entre "proyecto", "etapa", "grupo" y "tarea". La diferenciación se logra con:

- **`type`**: propiedad custom de negocio (`"project"`, `"stage"`, `"group"`, `"task"`, `"milestone"`) renderizada con templates/CSS sobre DHTMLX GPL
- **`parent`**: define la jerarquía padre-hijo
- **`open`**: controla si un nodo se muestra expandido o colapsado

Nuestra estructura WBS (Proyecto → Etapa → Grupo → Tarea → Sub-tarea) se mapea así:

| Nuestro concepto | Tipo DHTMLX | Comportamiento |
|---|---|---|
| Proyecto | `type: "project"` | Barra contenedora o fila resumen estilizada, duración = rango de sus hijos |
| Etapa | `type: "stage"` | Barra contenedora visualmente distinta vía CSS/template |
| Grupo | `type: "group"` | Barra contenedora delgada, sin fechas propias |
| Tarea | `type: "task"` | Tarea regular, arrastrable, con fechas |
| Hito | `type: "milestone"` | Rombo o tarea de duración cero estilizada |

### Ajustes por historia

**US-10B (Backlog):** DHTMLX soporta tareas sin fecha con `unscheduled: true`. La opción más simple y mejor para UX es un panel React colapsable: si hay un proyecto enfocado, muestra su backlog; si la vista es consolidada, agrupa por proyecto. El drag al timeline se implementa custom; como fallback, seleccionar una tarea del backlog abre el panel lateral para asignar fecha de inicio/duración.

**US-15 (Gantt multi-proyecto):** Para mantener compatibilidad con GPL, usar un único Gantt con cada proyecto como nodo raíz (`parent: 0`, `type: "project"`). Colapsar/expandir proyectos reemplaza la necesidad de múltiples Gantts. El selector de proyectos se implementa como filtro sobre el campo `type` y/o `parent`.

**US-09B (Designar responsable):** No existe en DHTMLX. Se implementa agregando una propiedad custom `responsible_id` al objeto task. La lógica de herencia de permisos (responsable de un nodo controla sus hijos) se implementa en el backend (Row Level Security en Supabase) y en el frontend (habilitar/deshabilitar edición según `responsible_id` del ancestro).

**US-11 (Asignar ejecutores):** con DHTMLX GPL se implementa fuera del resource management: panel lateral React con multi-select de usuarios, persistido en `task_assignees` y renderizado como avatares/chips sobre la barra o columna del grid.

**US-12/13 (Mis tareas y avance):** el backend debe incluir ancestros de solo lectura para contexto. El avance se actualiza mediante endpoint específico (`PATCH /api/wbs/:id/progress`) que valida que el usuario sea ejecutor y solo permita cambiar `progress` y horas reportadas.

**US-14/15 (Panel lateral):** DHTMLX no incluye un panel lateral nativo. Opciones:
- **Quick info**: popup al hacer hover/clic en una tarea (nativo, ligero)
- **Lightbox**: formulario modal al hacer doble clic (nativo, configurable)
- **Panel HTML custom**: div lateral con eventos del Gantt para mostrar/editar detalles (requiere desarrollo)

**US-18 (Drag & drop):** DHTMLX soporta drag & drop nativo de barras (mover, redimensionar) y crear dependencias arrastrando. El drag desde/hacia backlog requiere implementación custom.

**US-13 (Reportar avance):** DHTMLX soporta `progress` (0-1) en cada tarea. Se muestra como relleno verde sobre la barra. Editable via lightbox o inline editing. El avance de tareas padre NO se auto-calcula (requiere código custom con `gantt.templates.progress` o eventos).

**US-16 (Filtros):** DHTMLX tiene API de filtrado (`gantt.attachEvent("onBeforeTaskDisplay")`). Los filtros como chips y URL sync requieren implementación custom.

**US-19 (Móvil):** DHTMLX soporta touch devices (iOS, Android). La adaptación a lista simple en móvil requiere desarrollo responsive custom (media queries + reconfiguración de columnas).
