# Matriz de Trazabilidad — Historias de Usuario ABAX Gantt

**Última actualización:** 2026-05-19 · **Estado:** Producción · **Cobertura:** 51/51 checks UAT pasando contra deployment

Toda HU listada como **OK** está implementada en `deploy/server/api/*.ts` + `poc/src/` y verificada end-to-end por `ops/uat-smoke.sh` contra `https://demo.breisner.info/abax-gantt`.

## Matriz HU → componente → test

| HU | Descripción | Backend | Frontend | Test automatizado | Estado |
|----|-------------|---------|----------|-------------------|--------|
| US-01 | Tipos de proyecto | `admin-project-types.ts` POST/PUT | _diferida UI_ (endpoints expuestos) | UAT-47, UAT-48 | **OK backend** / UI diferida |
| US-02 | Gestión de usuarios | `admin-users.ts` GET/POST/PUT | `AdminPage.tsx` | UAT smoke §11 | **OK** |
| US-03 | Crear proyecto desde Gantt | `projects.ts` POST | `CreateDialog.tsx`, `Toolbar.tsx` | UAT smoke §3 | **OK** |
| US-04 | Editar proyecto inline | `projects.ts` PATCH/DELETE | `DetailPanel.tsx` | UAT smoke §3 + §6 (responsable 403) | **OK** |
| US-05 | Adjuntos al proyecto | `attachments.ts` POST/GET/DELETE | `DetailPanel.tsx` tab Adjuntos | UAT smoke §10 | **OK** |
| US-06 | Crear hitos | `wbs.ts` POST type=milestone | `GanttCanvas.tsx`, `CreateDialog.tsx` | UAT smoke §3 (paso "Crear hito") | **OK** |
| US-07 | Crear etapas | `wbs.ts` POST type=stage | mismo | UAT smoke §3 | **OK** |
| US-08 | Crear grupos | `wbs.ts` POST type=group | mismo | UAT smoke §3 (estructura WBS) | **OK** |
| US-09 | Crear tareas jerárquicas | `wbs.ts` POST type=task | mismo | UAT smoke §3 | **OK** |
| US-09B | Designar responsable | `wbs-node.ts` PATCH responsible_id | `DetailPanel.tsx` tab Responsables | UAT smoke §6 (designar + delegación) | **OK** |
| US-10 | Dependencias FS/SS/FF/SF | `dependencies.ts` POST/DELETE | `GanttCanvas.tsx` drag | UAT smoke §5 | **OK** |
| US-10B | Backlog | `wbs.ts` POST sin fechas + `schedule.ts` | `BacklogPanel.tsx` | UAT smoke §4 (programar + unschedule) | **OK** |
| US-11 | Asignar ejecutores | `assignees.ts` POST/DELETE | `DetailPanel.tsx` tab Ejecutores | UAT smoke §6 | **OK** |
| US-12 | Mis tareas (filtro) | `wbs.ts?my_tasks=true` (incluye ancestros) | `Toolbar.tsx`, `GanttPage.tsx` | UAT smoke §7 | **OK** |
| US-13 | Reportar avance | `progress.ts` PATCH | `DetailPanel.tsx` tab Avance | UAT smoke §6 (ejecutor reporta) | **OK** |
| US-14 | Foco en proyecto | `wbs.ts?project_id=` | `Toolbar.tsx`, `GanttPage.tsx` | UAT smoke §7 | **OK** |
| US-15 | Gantt consolidado multi-proyecto | `wbs.ts` GET sin filtro | `GanttPage.tsx`, `GanttCanvas.tsx` | UAT smoke §3 (GET /api/wbs sin filtro) | **OK** |
| US-16 | Filtros completos (10 controles) | `wbs.ts` con 10 query params | `FilterBar.tsx` | UAT smoke §7 + tests Vitest `FilterBar` | **OK** |
| US-17 | Navegación temporal | n/a (cliente) | `GanttCanvas.tsx` atajos | Vitest mock + manual | **OK** |
| US-18 | Drag & drop | `schedule.ts`, `move.ts`, warnings DEPENDENCY_VIOLATION | `GanttCanvas.tsx` | UAT smoke §4, §5 | **OK** |
| US-19 | Mobile responsive | n/a | CSS `@media ≤768px` + fallback lista | Manual viewport 375px | **Parcial** (aceptable) |
| US-20 | Costos / horas estimadas | `wbs.ts` PATCH estimated_* | `DetailPanel.tsx` tab Info | Vitest validation tests | **OK** |
| US-21 | Panel presupuesto | `reports.ts` GET con permisos | `DetailPanel.tsx` tab Presupuesto | UAT smoke §8 (admin OK, ejecutor 403) | **OK** |
| US-22 | Horas reales (timesheet) | `timesheet.ts` POST/GET | `TimesheetPanel.tsx` | UAT smoke §6 (ejecutor registra) | **OK** |
| US-23 | Panel indicadores (KPIs) | `kpi.ts`, `summary.ts` | `AppShell.tsx` topbar | UAT smoke §8 (incluye check numérico) | **OK** |
| US-24 | Export JSON/CSV (PNG/PDF diferido) | `export.ts` (501 para PDF/PNG) | `Toolbar.tsx`, `GanttPage.tsx` | UAT smoke §9 | **OK** (JSON/CSV) / PNG-PDF diferidos |

## Resumen por prioridad

| Prioridad | OK | Diferido / Parcial |
|-----------|----|----|
| Must Have (12 HU) | 12 | 0 |
| Should Have | 8 | 0 |
| Could Have | 4 | 2 (US-19 mobile polish, US-24 PNG/PDF, US-01 UI tipos) |

## Cobertura de tests

| Capa | Comando | Tests | Estado |
|------|---------|-------|--------|
| Frontend unit (Vitest) | `npm --prefix poc test` | 39 | OK |
| Backend deploy/ unit (Deno) | `deno test deploy/server/api/_shared/tests/` | 41 | OK (nuevo) |
| Backend supabase/ unit (Deno) | `npm run test:unit` | 86 | OK |
| UAT smoke producción (bash + curl) | `./ops/uat-smoke.sh` | 51 | OK (nuevo) |
| **Total** | | **217** | **0 fallos** |

## Hallazgos del UAT 2026-05-19

Ver `docs/bugs-uat.md` para detalle de los 14 bugs encontrados y arreglados durante la sesión:
- 2 bugs críticos de routing (frontend usaba paths Supabase contra deploy router)
- 4 bugs de seguridad (handlers sin enforce de permisos)
- 1 bug crítico de serialización numérica
- 7 bugs medios/bajos (PATCH, invite, etc.)

Todos fixed y re-verificados.

## Diferidos / aceptados (no bloquean producción)

| Item | Razón |
|------|-------|
| US-19 mobile completo | CSS responsive funciona ≤768px; falta polish de gestos touch en el Gantt (limitación de DHTMLX GPL). |
| US-24 Export PNG/PDF | Requiere módulo DHTMLX Export (licencia comercial) o Playwright server-side. Backend devuelve 501. |
| US-01 UI tipos de proyecto | Endpoints `admin-project-types` existen y pasan UAT; falta página admin en frontend para CRUD visual. |

## Resultado de UAT (51 checks)

```
▶ 0. Health                                          ✓
▶ 1. Auth (token inválido, sin token)                ✓✓
▶ 2. Perfiles registrados                            ✓✓
▶ 3. CRUD Proyecto / WBS                             ✓✓✓✓✓✓
▶ 4. Backlog y schedule                              ✓✓✓
▶ 5. Dependencias                                    ✓✓✓✓
▶ 6. Asignaciones y permisos (3 roles cruzados)      ✓✓✓✓✓✓✓✓✓
▶ 7. Filtros WBS (5 filtros)                         ✓✓✓✓✓
▶ 8. KPI / Summary / Reports                         ✓✓✓✓✓
▶ 9. Export JSON / CSV / PDF-501                     ✓✓✓
▶10. Adjuntos (subir/listar/403/eliminar)            ✓✓✓✓
▶11. Admin: usuarios + tipos de proyecto             ✓✓✓✓✓
▶12. DELETE WBS / archivar proyecto                  ✓✓

TODOS LOS CHECKS PASARON (51/51)
```
