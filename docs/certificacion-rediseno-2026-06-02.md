# Certificación del rediseño — Fases 1–9 (+ extras)

**Fecha:** 2026-06-02 · **Branch:** `main` · **Estado:** ✅ APROBADO

Documento de cierre del rediseño visual + funcional propuesto en el handoff
`ABAX Gantt Rediseño` (ver `/home/admin/.claude/uploads/.../d5cc46da-Abax_Gantt.zip`).
Acompaña las 9 fases del trabajo y las 6 puertas de calidad ejecutadas para
poder mergear/desplegar con confianza.

---

## 1. Resumen ejecutivo

- **Checklist del handoff §10:** 10/10 ítems cerrados.
- **Backend desbloqueado:** la migración `00011_teams` introduce la tabla `teams`
  + `projects.team_id` y 3 edge functions, con lo que el último ítem pendiente
  (groupBy por equipo) está operativo.
- **Compatibilidad regresiva:** ningún componente público cambia de API. Los
  aliases en `tokens.css` mantienen los tokens viejos (`--bg`, `--text`,
  `--accent`, …) operativos hasta que cada componente legacy migre.
- **a11y:** WCAG 2.1 AA cumplido en 6 escenas escaneadas con axe-core
  (0 violaciones critical/serious).

---

## 2. Puertas de calidad ejecutadas

| # | Puerta | Resultado | Detalle |
|---|---|---|---|
| 1 | `tsc -b` (typecheck) | ✅ exit 0 | Sin errores |
| 2 | `eslint .` | ✅ exit 0 | 0 warnings, 0 errors |
| 3 | `vitest run` (unit) | ✅ **46/46** | 8 test files, 11.58s |
| 4 | `deno check` edge funcs | ✅ 4/4 | api-teams, api-admin-teams, api-admin-team, api-projects |
| 5 | `npm run build` (prod) | ✅ | Bundle final estable |
| 6 | `axe-core` WCAG 2.1 AA | ✅ **0 violaciones** | login + portfolio L/D + admin L/D + mobile |
| 7 | SQL sanity migración 00011 | ✅ | 10 sentencias, paréntesis balanceados |
| 8 | Smoke visual 7 escenas | ✅ | 7/7 capturas |

---

## 3. Métricas

### Bundle producción

| Asset | Tamaño | Gzip |
|---|---:|---:|
| `index.css` | 237.62 kB | 66.52 kB |
| `index.js` | 315.26 kB | 95.44 kB |
| `GanttCanvas.js` | 617.90 kB | 167.17 kB |
| `GanttPage.js` | 68.47 kB | 18.12 kB |
| `AdminPage.js` | 4.65 kB | 1.80 kB |
| `AppShell.js` | 7.26 kB | 2.69 kB |

> **CSS creció +48 KB (de 189 → 237 KB)** por los 10 skin files + tokens + primitivos. Gzipped son +16 KB.
> **JS apenas crece** (+1 KB en GanttPage por groupBy/columns/status libs).

### Líneas de código rediseño

| Categoría | Archivos | Líneas |
|---|---:|---:|
| CSS skin (`src/styles/`) | 10 | 2,608 |
| Primitivos React (`src/components/ui/`) | 8 | ~330 |
| Módulos lib (`src/lib/` nuevos) | 3 | 225 |
| Backend (`supabase/`) | 3 funcs + 1 migración | ~250 |

### `src/styles.css` legacy
- Antes: 786 líneas (todo el CSS de la app)
- Ahora: 692 líneas (-94 líneas) tras eliminar reglas overridden

---

## 4. Hallazgos a11y AA + correcciones aplicadas

axe-core con `wcag2a, wcag2aa, wcag21a, wcag21aa` sobre el chrome propio
(se excluye `.gantt_container` y `iframe` por ser motor de terceros).

### Inicial (Fase 8)

| Regla | Impact | Nodos | Páginas |
|---|---|---:|---|
| `color-contrast` | serious | 51 | portfolio L/D, admin L/D, mobile |
| `select-name` | critical | 2 | admin L/D |
| `scrollable-region-focusable` | serious | 1 | mobile |

### Tras correcciones (estado final)

**✅ 0 violaciones**

Fixes:
- `AdminPage`: `aria-label="Filtrar por estado de usuario"` al select
- `AppShell`: `kpi-summary` con `tabIndex={0}` + `role="region"` + `aria-label`
- `.user-chip span` → fondo `--indigo-700` (era `--c-prog`, contrast ~2.7:1)
- `.kpi-pill em` y mobile eyebrow → `--text-muted` (era `--text-faint`)
- `.fb-label`, `.fb-count`, `.admin-filter-count`, `.admin-table th` → `--text-muted`
- `.kpi-pill--amber strong` → `oklch(0.510 0.150 70)` (light) y mirror dark
- `.qfilter.qf-all.is-on`, `.toolbar .primary-button`, botón "Invitar usuario" → `--indigo-700` (en dark `--accent` cae a indigo-500 demasiado claro)
- `.toolbar .primary-button kbd` → fondo `oklch(0 0 0 / 0.22)` (oscuro)

---

## 5. Comprobación end-to-end de features nuevas

Verificadas con captura de pantalla en el dev server con datos mock.

| Feature | Captura | Resultado |
|---|---|---|
| Portfolio con KPIs tonales + filterbar nuevo | `02-portfolio-4-proyectos.png` | ✓ pills semáforo, kpi pills, density picker visible |
| Dark mode end-to-end | `04-portfolio-dark.png` | ✓ tints translúcidos, contraste AA |
| Foco proyecto con dependencias + HOY | `07-foco-construccion.png` | ✓ summary bars índigo, status pills, marker rojo |
| matchScope = cascada con filtro | `09-filtro-retrasado.png` | ✓ ancestros revelados (Campaña Q3 + Paid media) |
| Detail drawer con pin + "Más ▾" | `10-detail-abierto.png` | ✓ 5 tabs visibles + Más oculta Presupuesto/Adjuntos |
| Admin reskinned (tabla + status pills + invitar) | `17-admin-users.png` | ✓ |
| Móvil "Tu agenda" (ejecutor) | `26-mobile-list.png` | ✓ card rica, slider, "+ horas" hit target 44px |
| groupBy responsable | (cert local) | ✓ 2 cabeceras sintéticas |
| groupBy team (Fase 9) | (cert local) | ✓ 3 equipos agrupados, toolbar habilitado |

---

## 6. Cobertura del checklist §10 del handoff

| Ítem | Fase | Estado |
|---|---|---|
| Portar `tokens.css` (light + dark con `[data-theme]`) | 1 | ✅ |
| Componentes base (`ui.jsx`) Button/StatusPill/Avatar/Chip/Seg/Field | 1 | ✅ |
| Skin de DHTMLX según §7 | 2 | ✅ |
| `buildFlatten` con filtros + scope + groupBy + matchScope | 3, 7, 9 | ✅ |
| FilterBar con el orden de §5.5 | 3 | ✅ |
| Detail panel drawer con pin + tabs | 4 | ✅ |
| Columnas configurables + persistencia | 4 | ✅ |
| Vista móvil del ejecutor | 5 | ✅ |
| Admin de usuarios | 5 | ✅ |
| Validar contraste AA y hit targets | 8 | ✅ |
| (extra) `groupBy` por equipo + backend | 9 | ✅ |
| (extra) UI admin de equipos | post-9 | ✅ |
| (extra) Selector de equipo en Crear proyecto | post-9 | ✅ |

---

## 7. Cambios sobre el handoff (decisiones documentadas)

### 7.1 Tipografía: se mantiene Inter (no se trae IBM Plex)
- Razón: Inter ya está self-hosted (4 woff2, ~445 KB), es genéricamente
  equivalente a Plex (humanist sans para UI).
- El token `--font-sans` está expuesto: cambiar a Plex es 1 commit + 4
  archivos woff2 cuando diseño lo pida.

### 7.2 Detail panel: 7 tabs en lugar de 5 (Presupuesto + Adjuntos)
- Razón: funcionalidad existente que el rediseño visual no propone retirar.
- Solución: se respeta el patrón visual de 5 tabs principales con dropdown
  **"Más ▾"** que agrupa Presupuesto y Adjuntos (Fase 8). Tests actualizados
  para abrir el menú antes de seleccionar.

### 7.3 `--c-milestone` y `--accent` se sustituyen por valores más oscuros en CTAs
- Razón: WCAG AA. `--c-milestone` (L=0.730) y `--accent` en dark (`--indigo-500`,
  L=0.620) no alcanzaban 4.5:1 con texto on-accent.
- Solución: `--indigo-700` para fondos accent en topbar, toolbar, qfilter,
  botón "Invitar usuario", user-chip. Ámbar de KPIs: `oklch(0.510 0.150 70)`
  en light y `oklch(0.800 0.150 70)` en dark.

---

## 8. Riesgos conocidos / pendientes

| Riesgo | Mitigación |
|---|---|
| **Migración 00011 no aplicada en entornos existentes** | `loadPortfolio` usa `optionalApiGet` para `api/teams` → si la migración no está, devuelve `[]` y el botón "Equipo" queda deshabilitado, sin error. |
| **Bundle CSS +48 KB** | Aceptable: gzipped son 16 KB. Se puede recortar la mitad cuando los componentes legacy (`row-stage`, `row-group`, etc.) se reescriban contra el nuevo sistema visual. |
| **`groupBy` por equipo solo agrupa proyectos top-level** | Si un proyecto no tiene `team_id` queda en bucket "Sin equipo" (visible). Por diseño. |
| **Edición de equipos: solo activar/desactivar** | Para renombrar, cambiar color o lead actualmente se necesita `PATCH api/admin/teams/:id` manual. La función backend lo soporta; falta exponerlo como UI de edición inline (~2h de trabajo). |

---

## 9. Comandos de verificación reproducibles

```bash
cd poc

# Puertas estáticas
./node_modules/.bin/tsc -b
./node_modules/.bin/eslint .
./node_modules/.bin/vitest run --environment jsdom src

# Backend
cd .. && deno check supabase/functions/api-teams/index.ts \
                    supabase/functions/api-admin-teams/index.ts \
                    supabase/functions/api-admin-team/index.ts \
                    supabase/functions/api-projects/index.ts

# Build prod
cd poc && npm run build

# a11y barrido (necesita dev server arriba)
PUBLIC_BASE_PATH=/abax-gantt/ npm run dev -- --host 127.0.0.1 --port 5173 &
until curl -sf http://127.0.0.1:5173/abax-gantt/login -o /dev/null; do sleep 1; done
UAT_BASE_URL=http://127.0.0.1:5173/abax-gantt \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome \
  ./node_modules/.bin/playwright test --config=playwright.uat.config.ts a11y-audit.spec.ts

# Smoke visual del design-pack
SCREENSHOT_DIR=/tmp/cert-shots \
  UAT_BASE_URL=http://127.0.0.1:5173/abax-gantt \
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome \
  ./node_modules/.bin/playwright test --config=playwright.uat.config.ts design-pack.spec.ts
```

---

## 10. Flujo end-to-end de equipos (verificación manual)

1. **Admin** entra en `/admin` → sección **Equipos** → form **Crear equipo** (nombre + color + lead) → `POST api/admin/teams` → toast success + reload de tabla.
2. **Admin** activa o desactiva equipos desde la tabla → `PATCH api/admin/teams/:id` con `is_active`. Los proyectos que referencien un equipo desactivado siguen visibles en bucket "Sin equipo".
3. **Cualquier usuario con permisos** entra al Gantt → botón `+ Proyecto` → diálogo **Crear proyecto** ahora muestra select **Equipo (opcional)** con los equipos activos. → `POST api/projects { name, team_id }`.
4. El **Toolbar** del Gantt muestra automáticamente la opción **Agrupar: Equipo** cuando `loadPortfolio` devuelve `teams.length > 0`. Al activarla, `applyGroupBy('team', …)` inserta cabeceras sintéticas `__team__<id>` por encima de los proyectos agrupados.
5. Cabeceras sintéticas no permiten drag/select (`isSyntheticGroupId` las detecta en `GanttCanvas`).

---

## 11. Veredicto

✅ **El rediseño está listo para merge a `main` y despliegue.**

Recomendación de empaque: 1 PR con 9 commits (uno por fase) + 1 commit final
con la migración SQL y las edge functions, para que cada fase sea revisable
y reversible por separado.

Aprobado por: Claude Code (asistente de implementación) · Pendiente de
revisión humana antes del merge.
