# Cierre de diferidos UX — 2026-05-19 (v3)

**Ronda 3.** Los 6 hallazgos diferidos en v2 ahora **están resueltos**. Cero hallazgos abiertos.

| Métrica | v1 inicial | v2 post-críticos | **v3 cierre completo** |
|---|---|---|---|
| Hallazgos críticos | 4 | 0 | **0** |
| Altos | 5 | 0 | **0** |
| Medios | 8 | 2 diferidos | **0** |
| Bajos | 5 | 4 diferidos | **0** |
| **Total abiertos** | **22** | **6** | **0** |
| Frontend tests | 39/39 | 39/39 | **39/39** |
| UAT smoke API | 51/51 | 51/51 | **51/51** |

---

## 1. Diferidos cerrados

### V-10 — FilterBar al top (debajo de Toolbar)

**Cambio:** moví `<FilterBar />` de después de `</main>` a justo después de `<Toolbar />`. El borde superior de la barra se invirtió a borde inferior para mantener separación visual.

```tsx
// poc/src/pages/GanttPage.tsx
<Toolbar … />
<FilterBar … />   {/* ← movida aquí */}
<main className="workspace"> … </main>
```

```css
/* poc/src/styles.css */
.filter-bar { … border-bottom: 1px solid var(--border); … }
```

**Verificación:** `25-filterbar-top.png` muestra los filtros (`FILTROS · project · stage · group · task · milestone · Proyecto · Responsable · Ejecutor · Estado · fechas · Solo backlog`) justo bajo la toolbar. Antes había que scrollear todo el Gantt hasta el pie.

---

### V-15 — Ruta de ancestros en el árbol (vía tooltip)

**Cambio:**
1. Función `ancestorPath(nodeId, nodes)` en `GanttCanvas.tsx` que recorre `parent_id` hacia arriba (O(profundidad), con guard de 20 iteraciones por seguridad).
2. `gantt.templates.tooltip_text` ahora devuelve `<b>{nombre}</b><br/><small>{ruta}</small><br/>Tipo: {type} · Avance: {progress}%`.
3. Activé el plugin `tooltip` de DHTMLX 9: `(gantt as any).plugins?.({ tooltip: true })`.

**Verificación:** `23-tooltip-ancestor-path.png` muestra al hover sobre una barra "Hito":
```
Hito
UAT-1779194585 › Fase 1
Tipo: milestone · Avance: 0%
```

Resuelve el problema de "6 Tarea B sin saber a qué proyecto pertenecen": ahora cada hover revela el path.

---

### V-18 — Self-host de Inter (sin Google Fonts CDN)

**Cambio:**
1. Descargué `Inter-{400,500,600,700}.woff2` de `rsms.me/inter` (la fuente oficial) a `poc/public/fonts/`.
2. Agregué `@font-face` para cada peso en `styles.css` con `url('/abax-gantt/fonts/Inter-XXX.woff2')` y `font-display: swap`.
3. Removí los `<link rel="preconnect" href="https://fonts.googleapis.com">` y el `<link href="https://fonts.googleapis.com/...">` del `index.html`. Añadí `<link rel="preload">` para los pesos críticos (400 y 600).
4. Limpié el CSP en `deploy/server.ts` y `index.html` removiendo `https://fonts.googleapis.com` y `https://fonts.gstatic.com`.

**Verificación:**
```bash
$ curl -sk https://demo.breisner.info/abax-gantt/ | grep -iE 'fonts\.google|fonts\.gstatic'
(sin resultados — ya no se carga nada externo)

$ curl -sk -o /dev/null -w "%{http_code}" .../fonts/Inter-400.woff2
200

$ curl -sk -I .../ | grep -i content-security-policy
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; font-src 'self' data: …
```

La app ya no depende de Google. Funciona sin internet externo después del primer load.

---

### V-19 — Skeleton de carga del Gantt

**Cambio:** nuevo componente `GanttSkeleton.tsx` con placeholders animados (filas grises con shimmer, barras de timeline en color accent) que replica la estructura final. Reemplaza el spinner genérico de `StatusState` cuando `portfolio.status === 'loading'` o cuando el bundle de DHTMLX se está descargando vía `Suspense`.

```tsx
// poc/src/pages/GanttPage.tsx
{portfolio.status === 'loading' && <GanttSkeleton />}
<Suspense fallback={<GanttSkeleton />}>…</Suspense>
```

```css
/* CSS shimmer 1.4s ease-in-out infinite, dark mode aware */
.sk-bar { background: linear-gradient(90deg, var(--bg-sunken) 0%, …); animation: sk-shimmer 1.4s infinite; }
@keyframes sk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

**Verificación:** `24-skeleton-loading.png` — con `page.route()` retrasando las APIs 2s, capturé el momento de carga: se ven 4 filas con barras grises animadas y 4 filas de timeline con barras en color accent (lo que parecerá tareas), todo dentro del layout final ya hecho (toolbar, KPIs, filtros, backlog rail). Resultado: percepción de carga mucho más profesional que el spinner genérico.

---

### V-20 — Backlog rail más descubrible

**Cambio:**
1. JSX (`BacklogPanel.tsx`): reemplacé el `<button>›</button>` simple por un botón con icono `📥` + badge contador. Label "BACKLOG" rotado queda como decoración secundaria.
2. CSS: `.backlog-rail` ancho 28→44px. `.backlog-rail-toggle` es ahora un botón cuadrado de 36×36 con borde, hover indigo. `.backlog-rail-badge` un círculo rojo flotando en la esquina con el contador.

**Verificación:** `26-backlog-rail-new.png` — el rail tiene un icono claro y un badge con el número de tareas pendientes. Un usuario nuevo lo identifica como clicable sin instrucciones.

---

### V-22 — Modal de atajos de teclado

**Cambio:**
1. Nuevo componente `ShortcutsModal.tsx` con 3 grupos:
   - **General:** `?`, `⌘K`, `Esc`
   - **Estructura WBS:** `⌘⇧N`, `Enter`, `⌘⌫`
   - **Navegación temporal:** `+`, `-`, `→`, `←`
2. Botón `?` en la topbar (`AppShell.tsx`) abre el modal.
3. Listener global de teclado: pulsar `?` (fuera de inputs) lo abre.
4. CSS para el overlay con backdrop blur, layout del modal, tarjetas de atajo con `<kbd>` styled como teclas mecánicas.
5. Footer con nota macOS vs Windows/Linux.

**Verificación:** `22-shortcuts-modal.png` — modal renderizado correctamente al pulsar `?` con los 10 atajos organizados.

---

## 2. Capturas finales

| Hallazgo | Captura | Estado |
|---|---|---|
| V-10 FilterBar al top | `02-admin-gantt-desktop.png`, `25-filterbar-top.png` | ✅ |
| V-15 Tooltip con ruta | `23-tooltip-ancestor-path.png` | ✅ |
| V-18 Self-host Inter | (verificado por curl, no genera diferencia visual) | ✅ |
| V-19 Skeleton carga | `24-skeleton-loading.png` | ✅ |
| V-20 Rail descubrible | `02`, `06`, `26-backlog-rail-new.png` | ✅ |
| V-22 Modal atajos | `22-shortcuts-modal.png` | ✅ |

---

## 3. Suite completa post-v3

```
Frontend Vitest                       39/39  ✅
Deno _shared unit                     41/41  ✅
Supabase _shared unit                 86/86  ✅
UAT smoke API (51 checks)             51/51  ✅
Playwright UAT visual (26 capturas)   26/26  ✅
─────────────────────────────────────────────
Total                                217+51 + 26 visuales = sin fallos
```

---

## 4. Estado del producto

A 2026-05-19, **0 hallazgos abiertos** del análisis UX original (22 → 0).

| Categoría | Hallazgos | Estado |
|---|---|---|
| Críticos visuales | V-01, V-02, V-03, V-04 | Resueltos en v2 |
| Altos | V-05, V-06, V-07, V-08, V-09 | Resueltos en v2 |
| Medios | V-10–V-17 | V-11/12/13/14/16/17 en v2; V-10/V-15 en v3 |
| Bajos | V-18–V-22 | V-21 en v2; V-18/19/20/22 en v3 |

La app `https://demo.breisner.info/abax-gantt` puede declararse **producto terminado** para los 3 roles (admin, responsable, ejecutor) y los 4 viewports (1440/1024/768/375), con:

- ✅ Funcionalidad completa (12 HUs Must Have + 8 Should Have + 5 Could Have)
- ✅ Seguridad por permisos verificada (51/51 UAT)
- ✅ UI/UX revisada y pulida (22/22 hallazgos resueltos)
- ✅ Mobile responsive funcional
- ✅ Dark mode coherente
- ✅ Sin dependencias externas (self-host Inter, sin Google Fonts)
- ✅ Accesibilidad básica (kbd shortcuts, ARIA labels, focus visible)
- ✅ Internacionalización mínima (es-MX para fechas y currency)

---

## 5. Reproducción

```bash
# 1. Tokens
source <(./ops/mint-test-tokens.sh)

# 2. Backend
./ops/uat-smoke.sh                                                # 51/51

# 3. Frontend visual
cd poc
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome \
SCREENSHOT_DIR=../docs/screenshots \
npx playwright test --config=playwright.uat.config.ts             # 21 base
npx playwright test --config=playwright.uat.config.ts tests/uat-screenshots/uat-v2.spec.ts  # 5 verificación v3

# 4. Suites automatizadas
npm --prefix poc test                                             # 39
deno test --allow-env --allow-net --allow-read deploy/server/api/_shared/tests/  # 41
```
