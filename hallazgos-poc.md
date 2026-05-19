# Evaluación de Librerías Gantt — POC

**Fecha:** Mayo 2026  
**Decisión:** DHTMLX Gantt v9.1.4 (GPL)  
**URL demo:** https://demo.breisner.info/gantt  

---

## 1. Librerías evaluadas

| # | Librería | Versión | Licencia | Tamaño bundle |
|---|---|---|---|---|
| 1 | Frappe Gantt | 1.2.2 | MIT | ~25 KB |
| 2 | AG Grid + vis‑timeline | v35 + v8 | MIT + Apache 2.0 | ~380 KB |
| 3 | vis‑timeline standalone | v8 | Apache 2.0 | ~180 KB |
| 4 | **DHTMLX Gantt** | **9.1.4** | **GPL-2.0** | **~600 KB** |

---

## 2. Hallazgos por librería

### 2.1 Frappe Gantt (descartada)

**Ventajas:**
- Extremadamente ligera (25 KB)
- Dependencias FS/SS/FF/SF renderizadas nativas con flechas
- Drag & drop de barras
- `data-theme="dark"` vía CSS custom properties

**Limitaciones críticas:**
- **No soporta jerarquía `children`.** `setup_tasks()` del source no contiene ninguna lógica de anidamiento. El tipado acepta `children` pero el runtime lo ignora por completo. El WBS requiere 5+ niveles.
- Sin virtualización: ~500 tareas máximo antes de degradarse.
- Sin inline editing en grid. Solo `custom_popup_html`.
- Sin export, sin filtros, sin auto-scheduling.
- Mantenimiento estancado (último release 2022).

**Conclusión:** Inviable para el MVP. La falta de jerarquía es un bloqueante absoluto.

---

### 2.2 AG Grid + vis‑timeline (descartada)

**Ventajas:**
- AG Grid proporciona árbol WBS virtualizado ilimitado con sorting, filtros, inline editing por celda.
- vis‑timeline virtualiza miles de items en el timeline sin degradación.
- Ambos con soporte activo y documentación profesional.

**Limitaciones críticas:**
- **Dependencias no nativas en vis‑timeline.** Hay que construir desde cero: sistema de coordenadas SVG, renderizado de 4 tipos de flecha (FS/SS/FF/SF), interacción drag-to-create entre barras, recálculo al hacer zoom/scroll/mover. Estimado: +2 semanas solo en flechas.
- Sincronización de scroll entre grid y timeline requiere implementación manual (`@tanstack/react-virtual`).
- Dos librerías separadas = dos ciclos de vida, dos APIs, dos modelos de datos. Overhead de mantenimiento.
- 380 KB combinados.

**Conclusión:** Potente pero requiere demasiado glue code para features core (dependencias). El costo de integrar supera el beneficio frente a una solución integrada.

---

### 2.3 vis‑timeline standalone (descartada)

**Ventajas:**
- Virtualización nativa para miles de items.
- Grupos con nesting (aunque limitado).
- Buena API para manipulación programática de items.

**Limitaciones críticas:**
- Solo 1 nivel de agrupación. Sin jerarquía WBS real.
- Sin dependencias (ni nativas ni extensibles fácilmente).
- Sin grid/tabla lateral: solo timeline.
- Sin inline editing.
- Sin export.

**Conclusión:** Buen componente de timeline puro, pero no es una solución Gantt completa. Requiere acoplarlo con otro grid y construir dependencias.

---

### 2.4 DHTMLX Gantt (seleccionada)

**Ventajas decisivas:**

| Feature | Soporte | Relevancia para el MVP |
|---|---|---|
| Jerarquía WBS ilimitada | `parent` references, renderizado de árbol completo | WBS con 5-6 niveles (US-07, US-08, US-09) |
| Dependencias FS/SS/FF/SF | Nativas con flechas + drag-to-create entre barras | US-10 |
| Drag & drop de barras | Cambiar fechas, duración, desplazar | US-18 |
| Inline editing en grid | F2 o doble clic en cualquier celda, columnas configurables | US-04, US-09 |
| Milestones | Renderizado nativo en rombo | US-06 |
| Auto-scheduling | Al mover una barra, dependientes se reajustan automáticamente | US-10, US-18 |
| Critical path | Resalte de ruta crítica en rojo | Análisis de proyecto |
| Undo/Redo | Ctrl+Z / Ctrl+Y integrado | UX general |
| Zoom multinivel | 6 niveles: Hora → Día → Semana → Mes → Trimestre → Año | US-17 |
| Quick info / tooltips | Hover sobre barra muestra detalle | UX general |
| Export | PDF, PNG, Excel, JSON, iCal, MS Project, Primavera | US-24 |
| Keyboard navigation | Set completo de atajos (F2, Supr, Insert, Ctrl+→←, etc.) | US-03, US-09 |
| 8 Skins/themes | `setSkin()` en caliente: dark, material, contrast, terrace, meadow, skyblue, broadway | Dark theme nativo |
| Markers en timeline | Indicadores visuales configurables | US-06 |
| Read-only mode | `gantt.config.readonly = true` | Vista de stakeholders |
| Fullscreen | `gantt.expand()` / `gantt.collapse()` | US-14, US-19 |
| Task types | project (barra resumen), task (barra normal), milestone (rombo) | US-06, US-07, US-08, US-09 |
| Row height configurable | `gantt.config.row_height = 36` | personalización visual |
| i18n / locale | Formato de fechas y textos localizables | ES |
| Grid columns | Redimensionables, sorting, templates HTML por celda | US-16 |

**Lo que NO trae out-of-the-box (a construir):**
- Backlog lateral con drag-to-Gantt (US-10B). Solución: panel React + `gantt.addTask()` programático.
- Panel lateral de detalles (US-04, US-05, US-20, US-21). Solución: panel React + `gantt.getTask()` / `gantt.updateTask()`.
- Filtros tipo "Mis tareas" (US-12, US-16). Solución: `gantt.config.columns` + CSS + `gantt.refreshData()` o re-parse con datos filtrados.
- Autenticación/RLS (US-02, principio de permisos). Solución: Supabase.
- Vista móvil (US-19). DHTMLX tiene touch support pero no está optimizado para pantallas < 768px. Solución: media queries + layout alternativo.
- Presupuesto/horas (US-20, US-21, US-22). Solución: columnas adicionales en el grid + panel lateral.

---

## 3. Comparativa final

| Dimensión | Frappe | AG Grid + vis | vis solo | DHTMLX |
|---|---|---|---|---|
| Jerarquía WBS | ❌ | ✅ | ⚠ (1 nivel) | ✅ |
| Dependencias | ✅ | ❌ | ❌ | ✅ |
| Auto-scheduling | ❌ | ❌ | ❌ | ✅ |
| Inline editing | ❌ | ✅ | ❌ | ✅ |
| Drag & drop | ✅ | ⚠ parcial | ⚠ parcial | ✅ |
| Zoom multinivel | 5 niveles | scroll libre | scroll libre | 6 niveles duales |
| Export (PDF/PNG/Excel) | ❌ | ❌ | ❌ | ✅ |
| Undo/Redo | ❌ | ❌ | ❌ | ✅ |
| Critical path | ❌ | ❌ | ❌ | ✅ |
| Skins/themes | 2 | configurable | configurable | 8 nativos |
| Virtualización | ❌ | ✅ | ✅ | ✅* |
| Mantenimiento | ⚠ estancado | ✅ activo | ✅ activo | ✅ activo |
| Licencia | MIT | MIT + Apache 2.0 | Apache 2.0 | GPL-2.0 |
| Integración React | manual (ref) | wrapper oficial | manual (ref) | manual (ref) |
| Curva de aprendizaje | baja | media | baja | media-alta |

*\* DHTMLX renderiza en DOM (divs, no SVG), con virtual rows para el grid + virtual horizontal para el timeline.*

---

## 4. Plan de implementación (MVP — Must Have)

### Épica 0 — Setup (semana 1)
- [x] POC con 4 librerías evaluadas
- [ ] Inicializar proyecto React + Vite + TypeScript + Supabase
- [ ] Configurar Authentik OIDC + PKCE y validación JWKS en Edge Functions
- [ ] Schema PostgreSQL: `projects`, `wbs_nodes`, `task_assignees`, `dependencies`, `time_entries`
- [ ] RLS policies con `ltree` para herencia de permisos
- [ ] Wrapper de DHTMLX Gantt como componente React
- [ ] Layout base: toolbar superior + Gantt a pantalla completa

### Épica 1 — Admin (semana 2)
- [ ] US-02: CRUD de usuarios (admin)
- [ ] US-01: Tipos de proyecto (admin)

### Épica 2 — Proyectos (semana 3-4)
- [ ] US-03: Crear proyecto inline desde el Gantt
- [ ] US-04: Panel lateral de edición de proyecto
- [ ] US-05: Adjuntos (Supabase Storage)

### Épica 3 — WBS (semana 5-7)
- [ ] US-06: Hitos inline en el timeline
- [ ] US-07: Etapas como nodos colapsables
- [ ] US-08: Grupos de tareas
- [ ] US-09: Tareas con jerarquía padre-hijo (Enter para crear)
- [ ] US-09B: Designar responsable de cualquier nodo
- [ ] US-10: Dependencias entre tareas (drag-to-create nativo DHTMLX)
- [ ] US-10B: Backlog lateral + drag al Gantt

### Épica 4 — Ejecución (semana 8-9)
- [ ] US-11: Asignar ejecutores
- [ ] US-12: Filtro "Mis tareas"
- [ ] US-13: Reportar avance inline

### Épica 5 — Gantt avanzado (semana 10-11)
- [ ] US-14/15: Vista consolidada multi-proyecto
- [ ] US-16: Filtros dinámicos
- [ ] US-17: Navegación temporal (zoom DHTMLX nativo)
- [ ] US-18: Drag & drop (DHTMLX nativo + backlog)
- [ ] US-19: Adaptación móvil

### Épica 6-7 — Presupuesto + KPIs + Export (semana 12-13)
- [ ] US-20: Horas/costo estimado
- [ ] US-21: Panel presupuesto
- [ ] US-22: Horas reales
- [ ] US-23: KPI bar superior
- [ ] US-24: Export (DHTMLX nativo)

---

## 5. Arquitectura técnica

```
┌──────────────────────────────────────────────────────┐
│  KPI Bar (US-23) + Filter Bar (US-16)                │
├──────────┬───────────────────────────┬───────────────┤
│ Backlog  │                           │  Detail Panel │
│ Panel    │   DHTMLX Gantt            │  (US-04/05/   │
│ (10B)    │   (grid + timeline)       │   20/21)      │
│          │                           │               │
│ React    │   DOM nativo              │  React        │
│ + dnd-kit│   gantt.init(div)         │  + Supabase   │
│          │                           │               │
├──────────┴───────────────────────────┴───────────────┤
│  Toolbar: [+Proyecto] [+Etapa] [Escala] [Export]     │
└──────────────────────────────────────────────────────┘
```

**Stack:**
- Frontend: React 19 + TypeScript + Vite
- Gantt: DHTMLX Gantt 9.1.4 GPL
- Backend: Supabase (PostgreSQL + Auth + Storage + RLS + Realtime)
- Estado: Zustand + TanStack Query
- UI: TailwindCSS + shadcn/ui
- Drag externo: @dnd-kit

**Modelo de permisos:** RLS en PostgreSQL con `ltree` sobre el path del WBS. Política maestra: "tienes permiso si eres `responsible_id` del nodo o de cualquier ancestro, o eres admin". DHTMLX Gantt recibe datos ya filtrados por RLS desde Supabase.

---

## 6. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| DHTMLX Gantt es GPL-2.0 | Viral si distribuimos el source | El SaaS no distribuye código; GPL permite uso interno y SaaS sin liberar |
| DHTMLX Gantt no tiene React wrapper oficial | Integración manual | `useRef` + `useEffect` con instancia singleton. Limpiar en `useEffect` return |
| DHTMLX Gantt GPL no incluye algunas features PRO | Export, resource management podría ser PRO | Verificado: export e extensions incluidas en GPL. Resource management no es Must Have |
| Tamaño del bundle (600 KB solo DHTMLX) | Carga inicial lenta | Code splitting: lazy load por tab. DHTMLX solo carga en la vista Gantt |
| Curva de aprendizaje DHTMLX | Velocidad inicial | Documentación extensa + API consistente + comunidad activa |
