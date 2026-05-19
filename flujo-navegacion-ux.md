# Flujo de Navegación y Experiencia de Usuario — ABAX Gantt

**Versión:** 1.0  
**Para:** Equipo de Diseño  
**Base:** Historias de Usuario · Especificación Técnica · Hallazgos POC

---

## 0. Principios de Experiencia

| Principio | Implicación de diseño |
|---|---|
| **Vista única** | No existen pantallas de detalle separadas. Todo ocurre sobre el Gantt. |
| **Simplicidad extrema** | Solo el nombre es obligatorio. El resto es opcional. |
| **Enter para crear** | El flujo feliz de creación es: seleccionar padre → Enter → escribir → Enter. |
| **Drag para programar** | Las tareas sin fecha viven en el backlog; se arrastran al timeline para fecharlas. |
| **Autosave** | Todo cambio se persiste al perder foco o tras 500ms de inactividad. |
| **Permisos heredados** | El responsable de un nodo controla todo lo que cuelga de él. El ejecutor solo reporta avance. |
| **Autoscheduling por defecto** | Las dependencias mueven sucesoras automáticamente; el usuario puede desactivarlo. |
| **Estados explícitos** | Guardando, guardado, error, sin permiso, conflicto: siempre visibles y recuperables. |

---

## 1. Arquitectura de Pantalla Única

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo]  KPI Bar (colapsable)                     [Admin] [Perfil] [Salir] │
├──────────────────────────────────────────────────────────────────────┤
│  Toolbar: [+ Proyecto] [Escala: Semana ▾] [Mis Tareas] [Hoy] [⚙] [Exportar] │
├───────────┬──────────────────────────────────────┬───────────────────┤
│           │                                      │                   │
│  Backlog  │                                      │  Detail Panel     │
│  Panel    │         DHTMLX Gantt                 │  ┌─────────────┐  │
│  ◀ ▶     │         (Grid + Timeline)            │  │ Info         │  │
│           │                                      │  │ Responsables │  │
│  Tareas   │  ┌──────────┬────────────────────┐  │  │ Ejecutores   │  │
│  sin      │  │ Árbol    │  Barras, Hitos,    │  │  │ Presupuesto  │  │
│  fecha    │  │ WBS      │  Flechas, Today    │  │  │ Adjuntos     │  │
│           │  │          │  marker            │  │  │ Historial    │  │
│  [Crear]  │  └──────────┴────────────────────┘  │  └─────────────┘  │
│           │                                      │                   │
├───────────┴──────────────────────────────────────┴───────────────────┤
│  Filter Bar: [Proyecto ▾] [Tipo ▾] [Responsable ▾] [Estado ▾] [Fechas] │
│  Chips activos: ✕ Proyecto A  ✕ En progreso        [Limpiar filtros]  │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.1 Zonas de la Interfaz

| Zona | Posición | Visible por defecto | Colapsable | Responsabilidad |
|---|---|---|---|---|
| **KPI Bar** | Superior, bajo header | Sí | Sí (admin/responsable) | Widgets cliqueables de resumen |
| **Toolbar** | Superior, bajo KPI | Sí | No | Acciones globales |
| **Backlog Panel** | Izquierdo | Colapsado | Sí, toggle ◀▶ | Tareas sin programar |
| **Gantt (Grid + Timeline)** | Centro | Sí | No | Vista principal WBS |
| **Detail Panel** | Derecho | Oculto | Se abre al seleccionar nodo | Tabs de detalle |
| **Filter Bar** | Inferior al Gantt | Sí | No | Filtros dinámicos con chips |

---

## 2. Punto de Entrada: Autenticación

### 2.1 Login

```
[Pantalla: Login]
┌────────────────────────────────────────┐
│                                        │
│         [Logo ABAX Gantt]              │
│                                        │
│     [  Continuar con Authentik    ]    │
│                                        │
└────────────────────────────────────────┘

Flujo:
1. Usuario pulsa "Continuar con Authentik"
2. Frontend inicia Authorization Code + PKCE con `oidc-client-ts`
3. Authentik gestiona credenciales, MFA, recuperación y políticas de acceso
4. Callback OIDC vuelve a ABAX Gantt con sesión válida
5. Frontend llama a Edge Functions con el access token de Authentik
6. Éxito → redirige al Gantt consolidado (vista principal)
7. Error → mensaje bajo el botón: "No se pudo iniciar sesión"
```

### 2.2 Alta de usuario

```
Flujo:
1. Admin gestiona identidad, contraseña inicial, MFA y grupos en Authentik
2. En ABAX Gantt, el modal de usuarios muestra perfiles provisionados o crea un perfil pendiente si aplica
3. En el primer login OIDC, la Edge Function resuelve `authentik_sub` y activa/sincroniza el perfil
4. Usuario entra al Gantt consolidado (vacío si es primer acceso)
```

### 2.3 Recuperación de contraseña

```
1. Usuario usa el flujo de recuperación de Authentik
2. Authentik valida identidad y políticas configuradas
3. Al completar recuperación, vuelve a ABAX Gantt por el login OIDC
```

---

## 3. Vista Principal: Gantt Consolidado

Es la **única vista del sistema**. Todo usuario, tras autenticarse, llega aquí.

### 3.1 Estado: Primer acceso (sin proyectos)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo]                                          [Admin] [Perfil] [Salir] │
├──────────────────────────────────────────────────────────────────────┤
│  [+ Proyecto] [Escala: Semana ▾] [Mis Tareas] [Hoy] [⚙] [Exportar]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│                    ┌─────────────────────────┐                       │
│                    │                         │                       │
│                    │    📋 Sin proyectos      │                       │
│                    │                         │                       │
│                    │  Crea tu primer proyecto │                       │
│                    │  con el botón superior   │                       │
│                    │  "+ Proyecto" o presiona │                       │
│                    │  Ctrl+Shift+N            │                       │
│                    │                         │                       │
│                    └─────────────────────────┘                       │
│                                                                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Filter Bar: [Proyecto ▾] [Tipo ▾] [Responsable ▾] [Estado ▾] ...   │
└──────────────────────────────────────────────────────────────────────┘
```

**Comportamiento:** Toolbar visible, filtros visibles pero sin datos. Mensaje central con call-to-action.

### 3.2 Estado: Con proyectos (normal)

El Gantt muestra todos los proyectos donde el usuario es responsable, ejecutor, o todos si es admin. Cada proyecto es un nodo raíz colapsable.

```
Árbol WBS (grid izquierdo):
┌──────────────────────────────────────┐
│ ☰ Nombre                       ►    │
├──────────────────────────────────────┤
│ 🟦 ▼ Proyecto Alfa        [JP]  80%  │  ← barra en timeline
│      🟪 ▼ Etapa 1               60%  │
│         🟩 ▼ Grupo A             50%  │
│            ■ Tarea 1.1   [MG]   30%  │
│            ■ Tarea 1.2   [AR]    0%  │
│         ◆ Hito: Diseño aprobado      │
│      🟪 ▶ Etapa 2               40%  │
│ 🟧 ▶ Proyecto Beta                   │  ← colapsado
│ 🟩 ▶ Proyecto Gamma                  │  ← colapsado
└──────────────────────────────────────┘

Timeline (derecho):
 Muestra barras, hitos (◆), flechas de dependencia,
 marcador "Hoy" (línea vertical roja)
```

**Convenciones visuales:**
- 🟦 `project`: barra contenedora, color por tipo de proyecto
- 🟪 `stage`: barra punteada contenedora
- 🟩 `group`: barra sólida delgada contenedora
- ■ `task`: barra sólida arrastrable, relleno verde = % avance
- ◆ `milestone`: rombo en la fecha
- Flechas entre barras: dependencias FS/SS/FF/SF
- `[JP]`: avatar/iniciales del responsable
- `[MG]`: avatar/iniciales del ejecutor

---

## 4. Flujos por Rol

### 4.1 Flujo del Administrador

```
Inicio → Gantt consolidado (ve todo)
├── ⚙ Configuración → Modal "Tipos de proyecto" → CRUD tipos
├── ⚙ Configuración → Modal "Usuarios" → Invitar/desactivar usuarios
├── Crear/editar/eliminar cualquier proyecto, etapa, grupo, tarea, hito
├── Designar responsables en cualquier nodo
├── Asignar ejecutores en cualquier tarea
├── Ver panel de presupuesto de cualquier proyecto
│
└── [Resto de acciones idénticas al Responsable]
```

**Modales exclusivos del Admin:**

| Modal | Gatillo | Contenido |
|---|---|---|
| Tipos de proyecto | Toolbar ⚙ → "Tipos de proyecto" | Tabla: nombre, color, descripción, activo/inactivo. Botón "+ Nuevo tipo". Editar inline. |
| Gestión de usuarios | Toolbar ⚙ → "Usuarios" | Tabla: nombre, email, estado (activo/inactivo/invitado). Botón "+ Invitar usuario". |

### 4.2 Flujo del Responsable (PM / dueño de nodo)

```
Inicio → Gantt consolidado (ve sus proyectos)
│
├── [+ Proyecto] o Ctrl+Shift+N
│   → Se agrega fila en árbol → escribir nombre → Enter
│   → El creador queda como responsable automático
│
├── Seleccionar proyecto → expandir (▶)
│   ├── Click derecho proyecto → "Agregar etapa" (Ctrl+Shift+E)
│   │   → Escribe nombre → Enter → aparece nodo colapsable
│   ├── Click derecho etapa → "Agregar grupo"
│   │   → Escribe nombre → Enter
│   ├── Seleccionar etapa/grupo/tarea → Enter
│   │   → Input inline bajo el nodo → escribe nombre → Enter
│   │   → Si no tiene fecha, va al backlog automáticamente
│   ├── Click derecho timeline → "Agregar hito"
│   │   → Escribe nombre → Enter → rombo en fecha del clic
│   ├── Arrastrar borde de barra a otra → crea dependencia
│   ├── Arrastrar barra completa → mueve fechas
│   └── Arrastrar borde → cambia duración
│
├── Panel lateral derecho (clic en nodo → se abre)
│   ├── Tab "Info": editar nombre, descripción, tipo, fechas, color, presupuesto
│   ├── Tab "Responsables": buscar y designar responsable del nodo
│   ├── Tab "Ejecutores": multi-select de usuarios asignados
│   ├── Tab "Presupuesto": horas estimadas, costo estimado, desviación
│   ├── Tab "Adjuntos": drag & drop de archivos (PDF, img, Excel)
│   └── Tab "Historial": cambios recientes del nodo
│
├── Backlog panel (toggle ◀▶)
│   ├── Ver tareas sin fecha (de proyecto enfocado o agrupadas)
│   ├── Crear tarea en backlog: escribir nombre → Enter
│   ├── Drag de tarea del backlog → timeline → programa fechas
│   └── Drag de tarea del timeline → backlog → quita fechas
│
├── Filtros
│   ├── "Mis tareas": toggle en toolbar
│   ├── Filtros por proyecto, tipo, responsable, ejecutor, estado
│   └── Chips activos removibles
│
└── Toolbar
    ├── Escala: cambiar nivel de zoom (Hora/Día/Semana/Mes/Trimestre/Año)
    ├── "Hoy": centrar timeline en fecha actual
    ├── Autoscheduling: toggle on/off
    ├── Exportar: PNG / PDF
    └── Fullscreen: expandir Gantt
```

### 4.3 Flujo del Ejecutor

```
Inicio → Gantt consolidado
│
├── Por defecto ve proyectos donde es ejecutor
│   (ancestros de solo lectura para contexto)
│
├── [Mis Tareas] en toolbar → filtra solo sus tareas
│   → Ve proyectos/etapas/grupos en solo lectura
│   → Sus tareas resaltadas
│
├── Click en su tarea → panel lateral (solo tabs permitidos)
│   ├── Tab "Info": ve datos en solo lectura (nombre, fechas, descripción)
│   ├── Tab "Avance": slider 0-100% + campo "Horas trabajadas"
│   │   → Mueve slider → autosave (500ms)
│   │   → Opcional: marca "Completada" (checkbox)
│   └── Resto de tabs: solo lectura
│
├── Click en barra de su tarea → popup rápido de avance
│   → Slider compacto sobre la barra
│   → Campo opcional de horas
│
├── NO puede:
│   ✕ Crear proyectos/etapas/grupos/tareas/hitos
│   ✕ Editar nombres, fechas, jerarquía
│   ✕ Designar responsables
│   ✕ Asignar/quitar ejecutores
│   ✕ Crear/eliminar dependencias
│   ✕ Eliminar nada
│
└── [Móvil] → lista simplificada de "Mis tareas"
    → Toque expande detalle + slider de avance
```

### 4.4 Flujo del Stakeholder (solo lectura)

```
Inicio → Gantt consolidado (ve proyectos donde es ejecutor)
│
├── Navega, expande, colapsa, hace zoom
├── Aplica filtros
├── Abre panel lateral para ver detalles (todo solo lectura)
├── Exporta vista (PNG/PDF)
│
└── NO puede modificar absolutamente nada
    → Botones de creación/edición aparecen deshabilitados
    → Sin panel de backlog (no necesita programar)
    → Sin acciones de click derecho
```

---

## 5. Paneles: Interacción Detallada

### 5.1 Backlog Panel (izquierdo)

```
┌─────────────────────────┐
│ Backlog            [✕]  │
│ 🎯 Proyecto Alfa    ▾   │  ← selector de proyecto (si vista consolidada)
├─────────────────────────┤
│                          │
│ [+ Nueva tarea...]       │  ← input inline
│                          │
│ 📋 Etapa 1               │
│   └ □ Tarea sin fecha 1  │  ← draggable
│   └ □ Otra tarea     [MG]│
│                          │
│ 📋 Etapa 2               │
│   └ □ Diseñar mockup     │
│                          │
│ 📋 Sin etapa              │  ← tareas huérfanas de etapa
│   └ □ Revisar docs       │
│                          │
└─────────────────────────┘
```

**Interacciones:**
| Acción | Resultado |
|---|---|
| Clic en toggle ◀▶ | Abre/cierra panel (ancho: ~280px) |
| Escribir en "+ Nueva tarea..." + Enter | Crea tarea sin fecha en el proyecto/etapa enfocada |
| Drag item → timeline | Asigna start_date en la posición del drop, calcula duración default (1d) |
| Click en item | Abre panel lateral derecho para editar/ver detalle |
| Selector de proyecto (solo vista consolidada) | Filtra backlog a un proyecto específico |
| Hover sobre □ | Tooltip: nombre completo, padre, ejecutor asignado |

**Estados:**
- **Vacío:** "No hay tareas sin programar. Las tareas creadas sin fecha aparecerán aquí."
- **Loading:** Skeleton items (3 barras grises animadas)
- **Error:** "Error al cargar el backlog. [Reintentar]"

### 5.2 Detail Panel (derecho)

```
┌─────────────────────────────────────┐
│ Tarea: Diseñar mockup          [✕]  │
│ Proyecto Alfa › Etapa 2             │  ← breadcrumb
├─────────────────────────────────────┤
│ [Info] [Responsables] [Ejecutores]  │  ← tabs
│ [Presupuesto] [Adjuntos] [Historial]│
├─────────────────────────────────────┤
│                                     │
│  ┌─ Info ───────────────────────┐  │
│  │                               │  │
│  │  Nombre                       │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Diseñar mockup           │  │  │  ← editable (si tiene permiso)
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Descripción                  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Crear mockups de alta... │  │  │
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  │  Tipo          [Tarea ▾]     │  │
│  │  Color         [■] #3B82F6   │  │
│  │  Inicio        12/05/2026    │  │
│  │  Fin           20/05/2026    │  │
│  │  Duración      8 días        │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  Guardado ✓                         │  ← indicador de autosave
└─────────────────────────────────────┘
```

**Tabs del panel lateral:**

| Tab | Visible para | Contenido | Editable por |
|---|---|---|---|
| **Info** | Todos | Nombre, descripción, tipo, color, fechas, duración | Responsable, Admin |
| **Responsables** | Todos | Avatar + nombre del responsable actual. Botón "Cambiar". Buscador de usuarios. | Responsable del ancestro, Admin |
| **Ejecutores** | Todos | Chips con avatar de cada ejecutor. Botón "+ Asignar". Multi-select con búsqueda. | Responsable del ancestro, Admin |
| **Presupuesto** | Responsable, Admin | Horas estimadas, costo estimado, horas reales, presupuesto del proyecto, barra de consumo (%) con color | Responsable, Admin |
| **Adjuntos** | Responsable, Admin | Lista de archivos. Drop zone para subir. Máx. 5 archivos, 5MB c/u. | Responsable, Admin |
| **Historial** | Admin | Timeline de cambios: quién, qué, cuándo | Solo lectura |

**Estados del panel:**
- **Oculto:** no hay nodo seleccionado (estado default)
- **Abriendo:** slide desde la derecha (300ms, ease-out)
- **Cerrando:** slide hacia la derecha (200ms, ease-in)
- **Guardando:** spinner junto a "Guardando..."
- **Guardado:** check verde "Guardado ✓" (desaparece a los 2s)
- **Error:** texto rojo "Error al guardar. [Reintentar]"
- **Sin permiso:** campos en gris con tooltip "Solo el responsable puede editar este campo"

### 5.3 Filter Bar (inferior)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Proyecto ▾] [Tipo ▾] [Responsable ▾] [Ejecutor ▾] [Estado ▾] [Fechas] │
│                                                                      │
│ ✕ Proyecto Alfa   ✕ En progreso   ✕ Mayo 2026    [Limpiar filtros]  │
└──────────────────────────────────────────────────────────────────────┘
```

**Interacciones:**
| Acción | Resultado |
|---|---|
| Clic en dropdown | Abre lista de opciones (checkboxes). Varios valores = OR dentro del filtro. |
| Seleccionar valor | Se agrega chip abajo. Gantt se actualiza en tiempo real. |
| Clic en ✕ del chip | Remueve ese filtro individual. Gantt se actualiza. |
| Clic en "Limpiar filtros" | Remueve todos los filtros. Vuelve al default. |
| URL sync | Al cambiar filtros, la URL se actualiza. Al compartir URL, se restauran filtros. |
| "Mis tareas" en toolbar | Atajo: activa filtro por ejecutor = usuario actual. |

**Dropdowns:**
- **Proyecto:** checkboxes con nombre + color de tipo
- **Tipo:** checkboxes con indicador de color
- **Responsable:** checkboxes con avatar + nombre
- **Ejecutor:** checkboxes con avatar + nombre
- **Estado:** checkboxes: Pendiente, En progreso, Completado, Retrasado
- **Fechas:** date range picker (desde → hasta)

### 5.4 KPI Bar (superior, colapsable)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  [▲ colapsar] │
│  │          │  │          │  │          │  │          │              │
│  │    3     │  │   42%    │  │    5     │  │  $850k   │              │
│  │ Proyectos│  │ Avance   │  │ Hitos    │  │ de $1.2M │              │
│  │ activos  │  │ global   │  │ próximos │  │ ejecutado│              │
│  │          │  │          │  │ (30d)    │  │          │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

**Interacciones:**
- Cada widget es cliqueable: aplica el filtro correspondiente en el Gantt.
  - Click en "Proyectos activos" → filtra estado = activo
  - Click en "Hitos próximos" → filtra tipo = milestone + próximos 30 días
  - Click en presupuesto → abre panel de presupuesto consolidado
- Botón ▲/▼ colapsa/expande la barra (40px de altura).
- Visible solo para admin y responsables de proyecto.
- Se refresca al cambiar filtros del Gantt.

### 5.5 Toolbar

```
┌──────────────────────────────────────────────────────────────────────┐
│ [+ Proyecto] │ Escala: [Semana ▾] │ [Mis Tareas] │ [🕐 Hoy] │ [⚙] │ [↗] │ [📥] │
└──────────────────────────────────────────────────────────────────────┘
```

| Botón | Acción | Atajo |
|---|---|---|
| **+ Proyecto** | Crea nuevo proyecto como nodo raíz en el Gantt | Ctrl+Shift+N |
| **Escala** | Dropdown: Hora, Día, Semana, Mes, Trimestre, Año | Ctrl+rueda mouse |
| **Mis Tareas** | Toggle: filtra solo tareas del usuario actual | — |
| **Hoy** | Centra timeline en fecha actual | — |
| **⚙ Configuración** | Dropdown: Tipos de proyecto, Usuarios (admin), Autoscheduling on/off, Fullscreen | — |
| **↗ Fullscreen** | Gantt ocupa toda la ventana | F11 |
| **📥 Exportar** | Dropdown: PNG, PDF | — |

---

## 6. Modales

### 6.1 Modal: Tipos de Proyecto (Admin)

```
┌──────────────────────────────────────────────┐
│  Tipos de Proyecto                      [✕]  │
├──────────────────────────────────────────────┤
│                                              │
│  [+ Nuevo tipo]                              │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ ■ Desarrollo                     ✕     │  │
│  │   Software y producto digital    [editar]│
│  ├────────────────────────────────────────┤  │
│  │ ■ Operaciones                    ✕     │  │
│  │   Mejoras operativas             [editar]│
│  ├────────────────────────────────────────┤  │
│  │ ■ Infraestructura (inactivo)     ✕     │  │
│  │   Infraestructura física          [editar]│
│  └────────────────────────────────────────┘  │
│                                              │
│  [Cerrar]                                    │
└──────────────────────────────────────────────┘
```

**Interacciones:**
- "+ Nuevo tipo": expande formulario inline con nombre, descripción, color picker.
- Color picker: 12 colores predefinidos + input hex.
- ✕ en activo: desactiva (no elimina). Si tiene proyectos activos → modal de confirmación.
- ✕ en inactivo: reactiva.
- "Editar": convierte fila en inputs editables.
- Autosave al perder foco.

### 6.2 Modal: Gestión de Usuarios (Admin)

```
┌──────────────────────────────────────────────┐
│  Usuarios                               [✕]  │
├──────────────────────────────────────────────┤
│                                              │
│  [+ Invitar usuario]                         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ 👤 Juan Pérez                      [···]│  │
│  │    juan@correo.com     Activo           │  │
│  ├────────────────────────────────────────┤  │
│  │ 👤 María García                    [···]│  │
│  │    maria@correo.com    Inactivo         │  │
│  ├────────────────────────────────────────┤  │
│  │ 👤 Carlos López                    [···]│  │
│  │    carlos@correo.com   Invitado         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [Cerrar]                                    │
└──────────────────────────────────────────────┘
```

**Interacciones:**
- "+ Invitar usuario": formulario inline con nombre + email.
- [···] menú contextual: Desactivar/Reactivar, Reenviar invitación.
- Desactivar → confirmación: "¿Desactivar a [nombre]? No podrá acceder al sistema."
- Estados visuales:
  - **Activo**: chip verde, texto "Activo"
  - **Inactivo**: chip gris, texto "Inactivo", fila atenuada
  - **Invitado**: chip amarillo, texto "Pendiente de activación"

### 6.3 Popup: Quick Info (hover/click en barra)

```
┌─────────────────────────────┐
│ Diseñar mockup              │
│ ─────────────────────────   │
│ Tipo: Tarea                 │
│ Inicio: 12/05/2026          │
│ Fin: 20/05/2026             │
│ Duración: 8 días            │
│ Avance: 30% ████░░░░░░░░    │
│ Responsable: Juan Pérez     │
│ Ejecutores: María, Carlos   │
│                             │
│ [Editar detalle] [Avance ▶] │
└─────────────────────────────┘
```

**Comportamiento:**
- Aparece con hover de 400ms sobre la barra, o con click simple.
- Posición: cerca del cursor, ajustándose para no salir de viewport.
- "Editar detalle" → abre panel lateral derecho, tab Info.
- "Avance ▶" → expande slider inline de progreso (solo ejecutor/responsable/admin).

### 6.4 Confirmaciones (genéricas)

```
┌──────────────────────────────────────────────┐
│                                              │
│  ¿Eliminar "Diseñar mockup"?                 │
│                                              │
│  Esta acción eliminará la tarea y todas      │
│  sus sub-tareas (2), dependencias (1),       │
│  asignaciones (2) y horas reportadas (4).    │
│                                              │
│  Esta acción no se puede deshacer.           │
│                                              │
│  [Cancelar]           [Eliminar] (rojo)      │
│                                              │
└──────────────────────────────────────────────┘
```

**Reglas de confirmación:**
- Eliminar cualquier entidad con hijos, dependencias o asignaciones → confirmación.
- Cambiar responsable de un nodo → confirmación si el nodo tiene hijos.
- Desactivar tipo de proyecto con proyectos asociados → no permitido, mostrar aviso.
- Eliminar dependencia → sin confirmación (bajo impacto).

---

## 7. Patrones de Interacción Clave

### 7.1 Crear Proyecto

```
Usuario → Click [+ Proyecto] en toolbar
       → Aparece nueva fila en raíz del árbol: input inline
       → Escribe "Proyecto X" + Enter
       → Sistema crea nodo project, usuario queda responsable
       → Proyecto aparece colapsado en el árbol
       → Timeline muestra barra contenedora vacía (sin hijos aún)
       
Atajo: Ctrl+Shift+N
```

### 7.2 Crear Etapa / Grupo / Tarea

```
Usuario → Selecciona nodo padre en el árbol (click)
       → Presiona Enter (o Insert)
       → Aparece input inline bajo el nodo padre
       → Escribe nombre + Enter
       → Si el nodo creado es task y no tiene fecha:
           → Va al backlog automáticamente
       → Si tiene fecha:
           → Aparece en el árbol y en el timeline

Alternativa click derecho:
  Click derecho sobre nodo en árbol → menú contextual
  ├── "Agregar etapa" (solo bajo project)
  ├── "Agregar grupo" (bajo stage o group)
  ├── "Agregar tarea" (bajo cualquier nodo administrable)
  └── "Agregar hito" (en área de timeline)
```

### 7.3 Crear Hito

```
Usuario → Click derecho en área vacía del timeline
       → "Agregar hito"
       → Input inline cerca de la fecha del clic
       → Escribe nombre + Enter
       → Rombo (◆) aparece en esa fecha
       
Alternativa: seleccionar nodo padre + Enter + cambiar tipo a "milestone" en panel lateral
```

### 7.4 Designar Responsable

```
Usuario → Click derecho sobre nodo en árbol → "Designar responsable"
       → O: abrir panel lateral → tab "Responsables" → click "Cambiar"
       
       → Se abre buscador de usuarios:
         ┌─────────────────────────┐
         │ Buscar usuario...        │
         ├─────────────────────────┤
         │ 👤 Ana López             │
         │ 👤 Carlos Ruiz           │
         │ 👤 María García          │
         └─────────────────────────┘
       
       → Click en usuario → confirmación breve
       → Avatar/iniciales del nuevo responsable aparecen junto al nodo
       → Nodo y descendencia: el nuevo responsable obtiene control
       → Responsable anterior: conserva control si es ancestro; si no, lo pierde
```

### 7.5 Asignar Ejecutores

```
Usuario (responsable) → Selecciona tarea → panel lateral → tab "Ejecutores"
       → Click en "+ Asignar"
       → Multi-select con búsqueda:
         ┌─────────────────────────┐
         │ Buscar...  [Ana]        │
         ├─────────────────────────┤
         │ ☑ Ana López              │
         │ ☐ Carlos Ruiz            │
         │ ☑ María García           │
         ├─────────────────────────┤
         │ [Asignar 2 usuarios]     │
         └─────────────────────────┘
       
       → Avatares asignados aparecen como chips en el panel lateral
       → Avatares también visibles en columna del grid o sobre la barra
       → Ejecutores ahora pueden reportar avance en esa tarea
```

### 7.6 Crear Dependencia

```
Usuario (responsable) → Hover sobre borde derecho de barra predecesora
       → Cursor cambia a ✦
       → Arrastra desde borde hacia barra sucesora
       → Línea de arrastre temporal (punteada)
       → Al soltar sobre sucesora → se crea flecha de dependencia (FS por defecto)
       
       → Autosave: persiste al backend
       → Si autoscheduling ON: sucesora se reubica automáticamente
       → Si autoscheduling OFF: se muestra la flecha, sin mover fechas
       
       → Tooltip en flecha: tipo de dependencia (FS/SS/FF/SF)
       → Click derecho en flecha → cambiar tipo de dependencia
       → Doble click en flecha → eliminar dependencia
```

### 7.7 Reportar Avance (Ejecutor)

```
Desktop:
  Ejecutor → Click en barra de su tarea
         → Popup "Quick Info" aparece
         → Click "Avance ▶"
         → Slider horizontal: [███░░░░░░░] 30%
         → Campo opcional: "Horas trabajadas: [___]"
         → Al soltar slider: autosave (500ms debounce)
         → Barra se rellena verde proporcionalmente
         
         Alternativa: marcar "✓ Completada" → slider va a 100%

Móvil:
  Lista "Mis tareas" → tap en tarea → se expande
  → Slider táctil o toggle "Completada"
  → Campo opcional "Horas"
```

### 7.8 Drag & Drop desde Backlog

```
Usuario → Abre Backlog panel (◀▶)
       → Identifica tarea sin fecha
       → Arrastra item del backlog hacia el área del timeline
       → Preview: barra semitransparente sigue al cursor en el timeline
       → Al soltar en una fecha del timeline:
           → start_date = fecha del drop
           → end_date = start_date + 1 día (duración default)
           → Tarea aparece como barra en el Gantt
           → Tarea desaparece del backlog
           → Autosave
       
       → Si se suelta sobre un nodo padre en el árbol (no timeline):
           → Se asigna al padre correspondiente, sin fechas
           → Solo reorganización jerárquica
```

### 7.9 Drag de Gantt a Backlog (desprogramar)

```
Usuario → Arrastra barra del timeline hacia el panel de backlog
       → Al soltar en el backlog:
           → start_date y end_date se ponen a null
           → Tarea desaparece del timeline
           → Tarea aparece en el backlog
           → Autosave
```

---

## 8. Estados por Componente

### 8.1 Gantt (zona central)

| Estado | Visual |
|---|---|
| **Cargando** | Skeleton: 5-8 filas grises en grid + barras fantasma en timeline. Spinner en overlay sutil. |
| **Vacío (primer uso)** | Ilustración central + mensaje + CTA "+ Proyecto" |
| **Vacío (filtros)** | "No hay resultados con los filtros actuales. [Limpiar filtros]" |
| **Error de carga** | "No se pudo cargar el Gantt. [Reintentar]" + icono de error |
| **Normal** | Grid con árbol + timeline con barras/hitos/flechas |
| **Actualizando** | Indicador sutil en esquina: "Actualizando..." (Realtime recibió cambios) |

### 8.2 Backlog Panel

| Estado | Visual |
|---|---|
| **Cerrado** | Solo toggle ◀▶ visible en borde izquierdo |
| **Cargando** | Skeleton de 3-4 items |
| **Vacío** | "No hay tareas sin programar" + breve explicación |
| **Con datos** | Lista de tareas agrupadas por padre |
| **Error** | "Error al cargar backlog. [Reintentar]" |

### 8.3 Detail Panel

| Estado | Visual |
|---|---|
| **Oculto** | No visible. Se abre al seleccionar un nodo. |
| **Abriendo** | Slide from right, 300ms |
| **Cargando detalle** | Skeleton del formulario (campos grises) |
| **Normal (con permiso)** | Campos editables, tabs navegables |
| **Normal (sin permiso)** | Campos en solo lectura, cursor not-allowed en inputs, tooltip explicativo |
| **Guardando** | Spinner + texto "Guardando..." en footer del panel |
| **Guardado** | Check verde "Guardado ✓" (2s, luego desaparece) |
| **Error al guardar** | Texto rojo + botón "Reintentar" |
| ** Conflicto** (otro usuario modificó) | Banner amarillo: "Este elemento fue modificado por otro usuario. [Recargar]" |

### 8.4 Indicadores de Autosave

```
Ubicación: esquina inferior derecha de la pantalla (toast)

Estados del toast de autosave:
┌────────────────────────────┐
│ ⏳ Guardando...             │  ← aparece inmediatamente al hacer cambio
└────────────────────────────┘
┌────────────────────────────┐
│ ✓ Guardado                 │  ← aparece al confirmar éxito, desaparece 2s
└────────────────────────────┘
┌────────────────────────────┐
│ ✕ Error al guardar         │  ← aparece en rojo, se queda hasta click
│   [Reintentar]              │
└────────────────────────────┘
```

---

## 9. Adaptación Móvil

### 9.1 Layout Móvil (≤ 768px)

```
┌─────────────────────────┐
│ [☰] ABAX Gantt    [👤]  │  ← header compacto
├─────────────────────────┤
│ [Mis Tareas] [Hoy]      │  ← toolbar reducido
├─────────────────────────┤
│                         │
│  ┌── Miembros ────────┐ │
│  │ ▼ Proyecto Alfa    │ │  ← lista expandible (no grid+timeline)
│  │   ▼ Etapa 1        │ │
│  │     ■ Tarea 1  [40%]│ │     barra de avance horizontal en miniatura
│  │       Inicio: 12/05 │ │
│  │       Fin: 20/05    │ │
│  │     ■ Tarea 2   [0%]│ │
│  │   ▶ Etapa 2         │ │
│  │ ▶ Proyecto Beta     │ │
│  └────────────────────┘ │
│                         │
│  [+ tarea rápida]       │  ← FAB o botón inferior
│                         │
├─────────────────────────┤
│ [🏠] [🔍] [📋] [⚙]     │  ← navegación inferior
└─────────────────────────┘
```

### 9.2 Comportamiento Móvil

| Acción | Desktop | Móvil |
|---|---|---|
| Ver Gantt | Grid + Timeline completo | Lista expandible con indicador de barra |
| Crear tarea | Enter en árbol | Botón "+" flotante → input modal |
| Ver detalle | Panel lateral derecho | Tap en tarea → pantalla completa o bottom sheet |
| Reportar avance | Slider en barra | Slider en detalle expandido |
| Filtrar | Filter bar superior | Bottom sheet de filtros |
| Navegar en tiempo | Zoom + pan en timeline | Gestos de pellizco en vista timeline (si aplica) |
| Exportar | Botón en toolbar | Opción en menú inferior |

### 9.3 Navegación Inferior Móvil

```
┌──────────┬──────────┬──────────┬──────────┐
│    🏠    │    🔍    │    📋    │    ⚙     │
│  Inicio  │  Buscar  │ Mis Tareas│  Más    │
└──────────┴──────────┴──────────┴──────────┘
```

| Tab | Descripción |
|---|---|
| **🏠 Inicio** | Gantt en modo lista expandible (vista principal) |
| **🔍 Buscar** | Búsqueda global de tareas/proyectos + filtros rápidos |
| **📋 Mis Tareas** | Lista filtrada de tareas del usuario con slider de avance |
| **⚙ Más** | Exportar, Admin (si aplica), Cerrar sesión |

**Nota:** El diseño móvil prioriza consulta, filtros, detalle y reporte de avance. La edición estructural (crear etapas, grupos, dependencias) es secundaria en móvil y puede requerir desktop. Sin embargo, el botón "+" flotante permite crear tareas rápidas en móvil.

---

## 10. Atajos de Teclado

| Atajo | Acción | Contexto |
|---|---|---|
| **Ctrl+Shift+N** | Crear proyecto | Global |
| **Enter** | Crear hijo (task/stage/group) bajo nodo seleccionado | Árbol WBS |
| **Insert** | Igual que Enter (crear hijo) | Árbol WBS |
| **F2** | Editar nombre del nodo seleccionado (inline) | Árbol WBS |
| **Supr / Delete** | Eliminar nodo seleccionado (con confirmación) | Árbol WBS |
| **Ctrl+Z** | Deshacer (undo DHTMLX) | Gantt |
| **Ctrl+Y** | Rehacer (redo DHTMLX) | Gantt |
| **Ctrl+Shift+E** | Agregar etapa bajo nodo seleccionado | Árbol WBS |
| **← →** | Navegar timeline horizontalmente | Timeline |
| **Ctrl+rueda** | Zoom in/out | Timeline |
| **+ / -** | Zoom in/out | Timeline |
| **Ctrl+F** | Foco en búsqueda de filtros | Global |
| **Escape** | Cerrar panel lateral / modal / popup | Global |
| **Ctrl+B** | Toggle Backlog panel | Global |
| **F11** | Toggle Fullscreen | Global |

---

## 11. Jerarquía Visual de Componentes WBS

```
┌──────────────────────────────────────────────────┐
│ NIVEL 0: PROYECTO                                │
│ 🟦 ▼ Proyecto Alfa          [JP]  ████████░░ 80% │  ← barra contenedora (ancho total hijos)
│                                                  │
│   NIVEL 1: ETAPA                                 │
│   🟪 ▼ Etapa 1               [—]  ██████░░░ 60% │  ← barra punteada contenedora
│                                                  │
│     NIVEL 2: GRUPO                               │
│     🟩 ▼ Grupo A             [—]  █████░░░░ 50%  │  ← barra delgada contenedora
│                                                  │
│       NIVEL 3: TAREA                             │
│       ■ Tarea 1.1          [MG]  ███░░░░░░ 30%  │  ← barra sólida + relleno verde avance
│       ■ Tarea 1.2          [AR]  ░░░░░░░░░  0%  │
│                                                  │
│     NIVEL 2: HITO                                │
│     ◆ Diseño aprobado              ◆             │  ← rombo en fecha
│                                                  │
│   NIVEL 1: ETAPA (colapsada)                     │
│   🟪 ▶ Etapa 2               [—]  ████░░░░ 40%  │
│                                                  │
│ NIVEL 0: PROYECTO (colapsado)                    │
│ 🟧 ▶ Proyecto Beta                               │
└──────────────────────────────────────────────────┘
```

**Indentación:** 24px por nivel. Máximo 5 niveles visibles simultáneos sin pérdida de legibilidad.

**Colores por tipo en el árbol:**
- `project`: ícono 🟦 + color del tipo de proyecto
- `stage`: ícono 🟪 + barra punteada en timeline
- `group`: ícono 🟩 + barra delgada en timeline
- `task`: ícono ■ + barra sólida
- `milestone`: ícono ◆ + rombo en timeline

---

## 12. Árboles de Decisión (Momentos Clave)

### 12.1 ¿Qué ve el usuario al abrir el panel lateral?

```
                      ┌── Nodo clickeado ──┐
                      │                    │
                 ¿Es responsable?    ¿Es ejecutor?
                      │                    │
                     SÍ                   NO (pero es ejecutor)
                      │                    │
              ┌───────┴───────┐            │
              │               │            │
        ¿Es proyecto?   ¿Es tarea?    Ver Info (solo lectura)
              │               │       + tab Avance (slider % + horas)
              │               │
         Tabs:          Tabs:
         Info           Info
         Responsables   Responsables
         Presupuesto    Ejecutores
         Adjuntos       Presupuesto
         Historial      Adjuntos
                        Historial
```

### 12.2 ¿Puede el usuario realizar esta acción?

```
Acción solicitada (crear, editar, eliminar, asignar...)
        │
        ▼
  ¿Es admin? ──SÍ──▶ PERMITIDO
        │
       NO
        │
        ▼
  ¿Es responsable del nodo
   o de algún ancestro? ──SÍ──▶ PERMITIDO
        │
       NO
        │
        ▼
  ¿Es ejecutor asignado? ──SÍ──▶ SOLO reportar avance y horas
        │
       NO
        │
        ▼
  DENEGADO → UI muestra control deshabilitado + tooltip "No tienes permisos"
```

### 12.3 ¿Qué pasa al mover una barra con dependencias?

```
Usuario arrastra barra a nueva posición
        │
        ▼
  ¿Tiene dependencias (predecesora o sucesora)?
        │
       NO ──▶ Mover sin restricciones → autosave
        │
       SÍ
        │
        ▼
  ¿Autoscheduling está ACTIVADO?
        │
       SÍ ──▶ Recalcular fechas de sucesoras
        │     → Mover barra
        │     → Ajustar sucesoras automáticamente
        │     → Notificación: "3 tareas reajustadas. [Deshacer]"
        │     → Autosave
        │
       NO ──▶ Verificar conflictos
              → ¿Nueva posición viola dependencias?
                 │
                SÍ ──▶ Advertencia: "Esta acción rompe la dependencia con X. [Cancelar] [Forzar]"
                │      → Si "Forzar": mueve igual, muestra ícono de advertencia en flecha
                │
                NO ──▶ Mover sin problemas → autosave
```

---

## 13. Flujo de Autenticación y Sesión

```
Usuario no autenticado
        │
        ▼
┌──────────────┐     ¿Token válido?    ┌─────────────────┐
│ Pantalla     │──────────────────────▶│ Gantt consolidado│
│ Login        │                       │ (vista principal)│
└──────────────┘                       └─────────────────┘
        │                                      │
        │ Login exitoso                        │ Sesión expira
        ▼                                      ▼
┌─────────────────┐                   ┌──────────────┐
│ Gantt consolidado│                   │ Pantalla     │
│ (vista principal)│                   │ Login        │
└─────────────────┘                   │ + mensaje:   │
        │                             │ "Sesión      │
        │ Logout                       │ expirada"    │
        ▼                             └──────────────┘
┌──────────────┐
│ Pantalla     │
│ Login        │
└──────────────┘
```

---

## 14. Notificaciones del Sistema

| Tipo | Ejemplo | Duración | Acción |
|---|---|---|---|
| **Éxito** | "Proyecto creado correctamente" | 3s, auto-dismiss | — |
| **Error** | "No se pudo guardar. Reintentar." | Persiste | Botón [Reintentar] |
| **Advertencia** | "Esta acción rompe una dependencia" | Persiste | Botones [Cancelar] [Forzar] |
| **Info** | "3 tareas reajustadas por autoscheduling" | 5s, auto-dismiss | Botón [Deshacer] |
| **Colaboración** | "Juan Pérez movió 'Diseñar mockup'" | 5s, auto-dismiss | — |

**Ubicación:** Toast en esquina inferior derecha (desktop) o inferior central (móvil). Stack vertical, máximo 3 visibles.

---

## 15. Principios de Micro-interacción

| Principio | Aplicación |
|---|---|
| **Feedback inmediato** | Toda acción tiene respuesta visual en < 100ms (aunque el guardado sea asíncrono). |
| **Optimistic UI** | Cambios locales se reflejan al instante; el backend confirma después. Si falla, se revierte con toast de error. |
| **Debounce en escritura** | Campos de texto: 500ms de inactividad antes de autosave. Sliders: al soltar (onMouseUp/onTouchEnd). |
| **Prevención de pérdida** | Si hay cambios sin guardar y el usuario intenta cerrar/recargar → confirmación del navegador. |
| **Cursor contextual** | `default` en solo lectura, `text` en inputs, `col-resize` en bordes de barra, `grab` en barras arrastrables, `not-allowed` en acciones sin permiso. |
| **Transiciones** | Paneles: slide 200-300ms. Modales: fade + scale 150ms. Hover: background 150ms ease. |
| **Tooltips** | Aparecen tras 500ms de hover. Máximo 2 líneas. Explican acción o razón de deshabilitación. |

---

## 16. Apéndice: Resumen de Pantallas y Modales

| # | Pantalla / Modal | Quién la ve | Gatillo | Prioridad |
|---|---|---|---|---|
| 1 | **Login** | No autenticado | URL raíz | MVP |
| 2 | **Establecer contraseña** | Usuario invitado | Magic link | MVP |
| 3 | **Gantt Consolidado** | Todos | Post-login | MVP |
| 4 | **Modal: Tipos de Proyecto** | Admin | Toolbar ⚙ | v1.1 |
| 5 | **Modal: Usuarios** | Admin | Toolbar ⚙ | MVP |
| 6 | **Panel: Backlog** | Responsable, Admin | Toggle ◀▶ | MVP |
| 7 | **Panel: Detalle / Info** | Todos | Click en nodo | MVP/v1.1 |
| 8 | **Panel: Detalle / Responsables** | Responsable, Admin | Tab en detail panel | MVP |
| 9 | **Panel: Detalle / Ejecutores** | Responsable, Admin | Tab en detail panel | MVP |
| 10 | **Panel: Detalle / Presupuesto** | Responsable, Admin | Tab en detail panel | v1.1 |
| 11 | **Panel: Detalle / Adjuntos** | Responsable, Admin | Tab en detail panel | v1.2 |
| 12 | **Panel: Detalle / Historial** | Admin | Tab en detail panel | v1.2 |
| 13 | **Popup: Quick Info** | Todos | Hover/click en barra | MVP |
| 14 | **Popup: Avance** | Ejecutor, Responsable, Admin | Click en barra → "Avance ▶" | v1.1 |
| 15 | **Confirmación: Eliminar** | Responsable, Admin | Supr / Click derecho > Eliminar | MVP |
| 16 | **KPI Bar** | Admin, Responsable | Siempre visible (colapsable) | v1.2 |
| 17 | **Móvil: Lista simplificada** | Todos (en móvil) | Viewport ≤ 768px | v1.2 |
| 18 | **Móvil: Bottom sheet filtros** | Todos (en móvil) | Tap en filtros | v1.2 |

---

**Fin del documento.**
