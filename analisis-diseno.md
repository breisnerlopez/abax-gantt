# Análisis de Diseño — ABAX Gantt (Handoff Bundle)

**Fuente:** Claude Design · `ejFEJwrGO6zXOHxZcjweSQ`  
**Referencia:** `flujo-navegacion-ux.md` · `especificacion-tecnica.md` · `historias-de-usuario.md`  
**Estructura del bundle:** 18 archivos (1 chat log, 1 README, 16 prototipos JSX/CSS)

---

## 1. Resumen del Diseño

El diseño cubre la totalidad del flujo UX documentado en 7 secciones con ~25 artboards hi-fi:

| Sección | Contenido | Cobertura vs doc UX |
|---|---|---|
| 0 · Auth | 5 pantallas (Login, Consent, Callback, Expired, Denied) | Excede el doc original |
| A · Vista principal | Admin, Responsable, Ejecutor lado a lado | §3, §4.1-4.4 |
| B · Estados | Vacío, colaboración, conflicto | §8, §3.1-3.2 |
| C · Panel detalle | 6 tabs individuales | §5.2, §6-7 |
| D · Backlog & Drag | Backlog abierto, drag→timeline, crear dep | §5.1, §7.8-7.9, §7.6 |
| E · Modales admin | Tipos, Usuarios, Invitar, Confirmar eliminar | §6.1-6.4 |
| F · Popups & Toasts | Quick info, avance, context menu, picker, toasts | §6.3, §8.4, §14 |
| G · Mobile | Home, Mis tareas, Detalle, Filtros, Crear rápida | §9 |

---

## 2. Design Tokens (Referencia para Implementación)

### 2.1 Tipografía
| Token | Valor |
|---|---|
| Font family | `'Inter', system-ui, -apple-system, sans-serif` |
| Font mono | `'JetBrains Mono', ui-monospace, monospace` |
| Base size | `13px` |
| Line height base | `1.45` |
| Letter spacing base | `-0.005em` |
| Feature settings | `'cv11','ss01','ss03'` |

### 2.2 Paleta de Color
```
Neutros (warm-leaning):
  --bg:            #FCFCFD     (fondo principal)
  --bg-soft:       #F6F7F9     (superficies secundarias)
  --bg-sunken:     #F1F2F5     (hundido / skeleton)
  --surface:       #FFFFFF     (tarjetas, paneles)
  --border:        #E5E6EB     (bordes suaves)
  --border-strong: #D2D4DB     (bordes activos)

Texto:
  --text:          #0E1116     (principal)
  --text-secondary:#5B6170     (etiquetas, descripciones)
  --text-tertiary: #8A8F9C     (metadatos, hints)
  --text-disabled: #BDC1CB     (deshabilitado)
  --text-inverse:  #FFFFFF

Acento (Indigo):
  --accent:        #4F5BD5     (primario)
  --accent-hover:  #4049BD     (hover)
  --accent-soft:   #EEF0FE     (fondos suaves)
  --accent-soft-2: #DCE0FC     (bordes suaves)
  --accent-text:   #2C36A8     (texto sobre soft)

Estados:
  --success: #16A36A    --success-soft: #DDF1E6
  --warning: #DC9A2A    --warning-soft: #FAEDD9
  --danger:  #DC3645    --danger-soft:  #FBE0E2
  --info:    #3D7CF0    --info-soft:    #E6EEFD
```

### 2.3 Paleta de Proyectos (6 colores)
```
  blue:   { bar:#3D7CF0, soft:#E6EEFD, dark:#1E54B8 }
  violet: { bar:#7C5CE0, soft:#EFEAFB, dark:#4F38A8 }
  amber:  { bar:#DD8A2E, soft:#FAEDD9, dark:#A05E15 }
  green:  { bar:#2BA577, soft:#DDF1E6, dark:#157048 }
  pink:   { bar:#D44B89, soft:#FCE5EE, dark:#9C2657 }
  teal:   { bar:#0EA5A5, soft:#DBF1F1, dark:#0A7373 }
```

### 2.4 Sombras
```
--shadow-xs:  0 1px 2px rgba(13,17,23,.04)
--shadow-sm:  0 1px 3px rgba(13,17,23,.06), 0 0 0 1px rgba(13,17,23,.04)
--shadow:     0 4px 16px rgba(13,17,23,.08), 0 0 0 1px rgba(13,17,23,.05)
--shadow-lg:  0 12px 32px rgba(13,17,23,.14), 0 0 0 1px rgba(13,17,23,.05)
```

### 2.5 Radios y Dimensiones
```
Radius:         3, 4, 6, 8, 12, 16 px
Row height:     32px
Header height:  48px
KPI Bar height: 78px
Toolbar height: 44px
Panel lateral:  ~360px (detalle), ~280px (backlog)
```

---

## 3. Tratamiento Visual por Tipo WBS

| Tipo | Árbol (glyph) | Timeline (barra) |
|---|---|---|
| **Project** | Badge "P" sobre color sólido | Barra gradiente, nombre + % sobre ella |
| **Stage** | Caja borde punteado, fondo suave | Patrón diagonal repetido, borde punteado |
| **Group** | Caja sólida fina, fondo suave | Barra delgada sólida, relleno progreso |
| **Task** | Cuadrado pequeño sólido (10×10) | Barra redondeada con relleno progreso + avatares ejecutores |
| **Milestone** | Rombo rotado 45° (11×11) | Rombo rotado 45° en la fecha |

---

## 4. Inconsistencias Detectadas

### RESUELTA — Sistema de Autenticación

La decisión está cerrada: ABAX Gantt usa Authentik (OIDC + PKCE). El frontend no debe autenticar contra Supabase Auth y las Edge Functions validan JWT Authentik mediante JWKS.

| Aspecto | Decisión vigente |
|---|---|
| Login | Botón "Continuar con Authentik" |
| Alta/gestión de identidad | Authentik gestiona credenciales, MFA, recuperación y grupos |
| Perfil interno | `profiles.authentik_sub` guarda el claim `sub` |
| Admin | Grupo OIDC `abax-admins` sincroniza `profiles.is_admin` |
| Autorización de negocio | Edge Functions con service role y validaciones programáticas |

### ALTA — Modal "Invitar usuario" contradice Authentik

El modal "Invitar usuario" no debe enviar enlaces mágicos desde ABAX. Debe crear/mostrar perfiles internos y remitir la gestión de credenciales, invitaciones y grupos a Authentik.

### MEDIA — Modal "Usuarios" muestra roles internos

El diseño muestra chips de rol (`admin`, `responsable`, `ejecutor`) en el modal de usuarios. Esto es coherente con Supabase (`profiles.is_admin`). Con Authentik, estos roles serían solo lectura desde los grupos OIDC.

### MEDIA — KPI Bar tiene 5 widgets, el doc UX pide 4

El diseño agrega "Tareas retrasadas" como widget adicional. Es una buena adición, solo documentar el cambio.

### BAJA — Botón "Importar desde Excel" en estado vacío

No está en los requerimientos. Evaluar si se incluye o se elimina.

### BAJA — Diseño no incluye estado "Cargando" (skeleton)

El documento UX pide skeletons para Gantt, Backlog y Detail Panel. El diseño muestra estados vacío, normal, conflicto y colaborativo, pero no loading skeletons.

---

## 5. Alineaciones Correctas (Bien Resueltas)

| Aspecto | Cómo lo resuelve el diseño |
|---|---|
| Vista única consolidada | GanttScreen como orchestrator único, sin páginas separadas |
| 3 roles con permisos visuales | `role` prop controla: KPI visibility, admin menu, panel readOnly, tabs ocultos, filtro Mis Tareas |
| Backlog contextual | Panel colapsable izquierdo, agrupa por proyecto con filtro "Todos los proyectos" |
| Autosaving explícito | SaveIndicator con 3 estados (saving/saved/error) en footer de panel |
| Breadcrumb en panel detalle | Path completo: Proyecto → Etapa → Grupo → Tarea |
| Estados de colaboración | Banners: "X modificó esta tarea" (realtime) + "Conflicto" con botón recargar |
| Filtros con chips | FilterBar con 6 dropdowns + chips removibles + "Limpiar filtros" + contador "14 de 27" |
| Quick info en hover | Popup posicionado con: tipo, fechas, duración, responsable, ejecutores, avance |
| Context menu árbol | Opciones: Agregar etapa/grupo/tarea/hito, Renombrar, Designar responsable, Asignar ejecutores, Crear dependencia, Duplicar, Eliminar. Con atajos de teclado visibles. |
| Slider de avance | Popup con slider 0-100%, presets (0/25/50/75/100), checkbox "Completada", campo horas, fecha |
| Confirmación destructiva | Detalle de impacto: sub-tareas, dependencias, asignaciones, horas. Botón rojo, texto "no se puede deshacer" |
| Mobile: Home, Mis tareas, Detalle, Filtros, Crear | 5 pantallas con bottom nav, FAB, bottom sheets. Layout 393×852. |
| Mobile: ejecutor reporta avance | Slider táctil grande (42px fuente), campo horas, botón "Completada" |

---

## 6. Recomendaciones para Implementación

### 6.1 Decisiones previas a implementar

1. **Modal de usuarios** — Definir si ABAX solo muestra perfiles provisionados o además crea perfiles pendientes mientras Authentik gestiona la identidad.
2. **Skeleton states** — Agregar al diseño: Gantt skeleton (8 filas grises + barras fantasma), Backlog skeleton (3 items), Detail Panel skeleton (formulario gris).
3. **"Importar desde Excel"** — Confirmar si va en MVP o se elimina.

### 6.2 Tokens a extraer para Tailwind

```js
// tailwind.config extend
colors: {
  accent: { DEFAULT: '#4F5BD5', hover: '#4049BD', soft: '#EEF0FE', text: '#2C36A8' },
  proj: {
    blue:   { bar: '#3D7CF0', soft: '#E6EEFD', dark: '#1E54B8' },
    violet: { bar: '#7C5CE0', soft: '#EFEAFB', dark: '#4F38A8' },
    amber:  { bar: '#DD8A2E', soft: '#FAEDD9', dark: '#A05E15' },
    green:  { bar: '#2BA577', soft: '#DDF1E6', dark: '#157048' },
    pink:   { bar: '#D44B89', soft: '#FCE5EE', dark: '#9C2657' },
    teal:   { bar: '#0EA5A5', soft: '#DBF1F1', dark: '#0A7373' },
  },
},
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
},
```

### 6.3 Componentes a construir (orden sugerido)

1. **Primitives** — Icon, Avatar, AvatarStack, StatusPill → `components/primitives.jsx`
2. **Topbar** — Logo, workspace breadcrumb, búsqueda global, notificaciones, admin menu, avatar → `components/layout/topbar.tsx`
3. **KPIBar** — Widgets colapsables → `components/layout/kpi-bar.tsx`
4. **Toolbar** — Acciones globales, escala, Mis Tareas, Hoy, Exportar → `components/layout/toolbar.tsx`
5. **FilterBar** — Dropdowns + chips → `components/layout/filter-bar.tsx`
6. **TreeGrid** — TreeHeader + TreeRow con glyphs por tipo → `components/gantt/tree-grid.tsx`
7. **Timeline** — TimelineHeader, TimelineBg, Barras por tipo, DepArrows → `components/gantt/timeline.tsx`
8. **BacklogPanel** — Panel colapsable, agrupado por proyecto, drag source → `components/backlog/backlog-panel.tsx`
9. **DetailPanel** — 6 tabs (Info, Responsables, Ejecutores, Presupuesto, Adjuntos, Historial) → `components/detail/detail-panel.tsx`
10. **Modals** — TiposProyecto, Usuarios, InvitarUsuario, ConfirmDelete → `components/modals/`
11. **Popups** — QuickInfo, AvancePopup, ContextMenu, UserPicker → `components/popups/`
12. **Toasts** — Sistema de notificaciones → `components/ui/toast.tsx`
13. **Mobile** — Home, MyTasks, TaskDetail, FiltersSheet, QuickCreate → `components/mobile/`
14. **Auth** — Login, SetPassword, ForgotPassword → `components/auth/`

### 6.4 Lo que YA está implementado en el proyecto

| Capa | Estado |
|---|---|
| Schema PostgreSQL | ✅ `00001_schema.sql` — tablas, tipos enum, índices, constraints |
| RLS + funciones permisos | ✅ `00002_functions_rls.sql` — `can_manage_node`, `can_read_node`, `can_manage_dependency` |
| Auth (Supabase) | ✅ GoTrue integrado, trigger `handle_new_user` |
| Edge Functions | ✅ `api-projects`, `api-wbs` (básicos) |
| Seed data | ✅ 3 tipos de proyecto |

---

## 7. Veredicto

El diseño es **completo, coherente y listo para implementar** con una excepción: **la decisión de Auth (Authentik vs Supabase) debe cerrarse antes de empezar**. Todo lo demás —tokens, componentes, flujos, estados, mobile— está resuelto con precisión y es directamente trasladable a React + TailwindCSS + shadcn/ui.

El diseño respeta los principios del documento UX (vista única, simplicidad extrema, autosave, permisos heredados) y los enriquece con detalles de micro-interacción (breadcrumbs, atajos visibles, banners colaborativos, toasts contextuales) que elevan la calidad percibida.
