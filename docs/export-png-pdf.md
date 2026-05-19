# Decision Tecnica: Export PNG/PDF

## Estado

US-24 queda fuera del instalable inicial para PNG/PDF backend.

El backend actual implementa exportacion `json` y `csv` en `api-export`. Eso no cumple por si solo la exportacion visual PNG/PDF solicitada por US-24.

## Decision Para MVP

Se mantiene `api-export` con JSON/CSV y se declara explicitamente `pdf`/`png` como no implementado (`501`). La opcion recomendada para una siguiente iteracion es usar export client-side de DHTMLX si la licencia/paquete disponible lo permite.

## Opciones Evaluadas

| Opcion | Descripcion | Estado |
|---|---|---|
| A | DHTMLX export client-side desde el frontend | Recomendada para MVP si esta disponible en la edicion usada |
| B | Backend `api-export-pdf` / `api-export-png` con Playwright/headless | Pendiente; requiere navegador headless, plantilla de render y coste operativo mayor |
| Actual | `api-export/:id?format=json/csv` | Implementado, no cumple PNG/PDF |

## Contrato Actual

| Request | Resultado |
|---|---|
| `GET api-export/:id?format=json` | 200 con proyecto, WBS y dependencias |
| `GET api-export/:id?format=csv` | 200 con CSV de WBS |
| `GET api-export/:id?format=pdf` | 501 |
| `GET api-export/:id?format=png` | 501 |

## Pendiente Si Se Elige Backend Headless

- Crear `api-export-pdf` y `api-export-png`.
- Definir HTML de render Gantt estable para captura.
- Incorporar Playwright/Chromium al entorno de funciones o usar servicio dedicado.
- Agregar tests de contrato para PDF/PNG y limites de tiempo.
