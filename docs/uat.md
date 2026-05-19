# UAT — ABAX Gantt MVP

**URL:** `https://demo.breisner.info/abax-gantt`  
**Fecha:** Mayo 2026  
**Entorno:** Producción (shared PostgreSQL + Authentik real + Cloudflare Tunnel)  

---

## 1. Preparación

### 1.1 Usuarios de prueba

| Usuario | Rol | Cómo login |
|---------|-----|------------|
| `akadmin` | Admin | Login vía Authentik con `root@example.com` + contraseña configurada en Authentik |
| Responsable | Responsable | Crear un segundo usuario en Authentik, asignarlo al grupo `abax-admins` para que sea admin, o usarlo sin grupo para rol `responsable` |
| Ejecutor | Ejecutor | Crear un tercer usuario en Authentik, SIN grupo `abax-admins` |

Si no hay más usuarios en Authentik, crearlos desde **Authentik Admin** (`https://auth.breisner.info`) → Directory → Users → Create.

### 1.2 Setup de datos inicial

1. Entrar como **akadmin**.
2. Crear un proyecto de prueba: `UAT Demo`.
3. Crear WBS básico:
   - Etapa: `Fase 1`
   - Tarea: `Tarea A` (con fechas)
   - Tarea: `Tarea B` (sin fechas → backlog)
   - Hito: `Revisión`
4. Asignar el usuario **Ejecutor** a `Tarea A`.
5. Designar al usuario **Responsable** como responsable de `Fase 1`.

---

## 2. Flujos críticos (Must Have)

### 2.1 Login OIDC

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Abrir `https://demo.breisner.info/abax-gantt` | Redirige a `/login` |
| 2 | Clic "Continuar con Authentik" | Redirige a pantalla de login de Authentik |
| 3 | Ingresar credenciales de akadmin | Redirige al Gantt principal |
| 4 | Verificar que el Gantt carga con el proyecto `UAT Demo` | WBS visible en árbol |
| 5 | Cerrar sesión (botón Salir) | Redirige a `/login` |
| 6 | Login como Ejecutor | Gantt visible, controles estructurales deshabilitados |

### 2.2 Gestión de proyectos (US-03, US-14)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Botón "+ Proyecto" en toolbar | Modal crear proyecto |
| 2 | Ingresar nombre "Proyecto QA", Enter | Aparece en el Gantt como nodo raíz |
| 3 | Hacer clic en el proyecto → "Enfocar proyecto" | Solo se ve ese proyecto, otros se ocultan |
| 4 | "Volver a portafolio" | Se ven todos los proyectos de nuevo |

### 2.3 WBS: etapas, grupos, tareas, hitos (US-06 a US-09)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Seleccionar proyecto, botón "+" → tipo Etapa | Aparece bajo el proyecto |
| 2 | Seleccionar etapa, botón "+" → tipo Grupo | Aparece bajo la etapa |
| 3 | Seleccionar grupo, botón "+" → tipo Tarea, sin fechas | Aparece en BACKLOG, no en timeline |
| 4 | Seleccionar proyecto/etapa, botón "+" → tipo Hito | Aparece como rombo en timeline |
| 5 | Doble clic en nombre de tarea | Editar inline |
| 6 | Enter en nodo seleccionado | Crea tarea hija |

### 2.4 Backlog (US-10B)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Abrir panel Backlog (botón lateral o `Ctrl+K`) | Lista de tareas sin fecha |
| 2 | Seleccionar tarea en backlog → "Programar" | Asignar fechas, desaparece del backlog |
| 3 | Tarea programada → "Enviar a backlog" (`Ctrl+Backspace`) | Pierde fechas, vuelve al backlog |

### 2.5 Dependencias (US-10)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Arrastrar borde de una barra a otra barra | Flecha de dependencia creada |
| 2 | Mover tarea predecesora más allá de la sucesora | Advertencia "Dependencia violada" |
| 3 | Eliminar dependencia (clic en flecha → eliminar) | Flecha desaparece |

### 2.6 Asignación y permisos (US-09B, US-11)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Panel detalle → tab Responsables → asignar usuario | Nombre aparece en columna "Resp." |
| 2 | Panel detalle → tab Ejecutores → asignar Ejecutor | Nombre aparece en la barra |
| 3 | Login como Ejecutor | Ve las tareas asignadas con "Mis tareas" |
| 4 | Ejecutor: intentar editar nombre/fechas de tarea | Campos deshabilitados (solo lectura) |
| 5 | Ejecutor: reportar avance | Slider de % funciona |
| 6 | Login como Responsable | Puede editar estructura de su etapa/tareas |

### 2.7 Reportar avance (US-13)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Panel detalle → tab Avance | Slider 0-100% |
| 2 | Mover slider a 50% | Barra en Gantt se actualiza |
| 3 | Completar tarea (100%) | Barra verde con check |

### 2.8 Filtros (US-16)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Buscar por nombre en FilterBar | Filtra nodos que coinciden |
| 2 | Filtrar por tipo (stage/task/milestone) | Solo muestra ese tipo |
| 3 | "Solo backlog" | Solo tareas sin programar |
| 4 | "Mis tareas" | Solo tareas del usuario actual |
| 5 | Botón "Limpiar filtros" | Muestra todo de nuevo |
| 6 | Recargar página con filtros aplicados | Filtros persisten en URL |

---

## 3. Flujos secundarios (Should Have)

### 3.1 Panel de detalle (US-04)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Seleccionar tarea → panel lateral derecho | Muestra tabs: Info, Responsables, Ejecutores, Avance, Horas, Presupuesto, Adjuntos |
| 2 | Editar nombre → esperar 500ms (autosave) | Cambio persiste al recargar |
| 3 | Cambiar fechas en panel Info | Barra en Gantt se actualiza |

### 3.2 Horas y presupuesto (US-20, US-21, US-22)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Tab Horas → registrar 4h | Time entry creado |
| 2 | Tab Presupuesto → ver métricas | Total estimado vs real, avance |
| 3 | Asignar horas estimadas a una tarea | Campo guardado |

### 3.3 Navegación temporal (US-17)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Botón "Hoy" | Timeline centrado en fecha actual |
| 2 | Tecla `+` | Zoom in |
| 3 | Tecla `-` | Zoom out |
| 4 | Flechas izquierda/derecha | Navegación temporal |

### 3.4 Drag & drop (US-18)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Arrastrar barra completa a nueva fecha | Fecha cambia, toast "Movimiento guardado" |
| 2 | Arrastrar borde izquierdo/derecho | Cambia inicio/fin |

### 3.5 Admin (US-01, US-02)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Ir a `/admin` | Lista de usuarios del sistema |
| 2 | Invitar nuevo usuario (nombre + email) | Usuario creado con status "invited" |
| 3 | Activar/desactivar usuario | Toggle funcional |

---

## 4. Flujos opcionales (Could Have)

### 4.1 Adjuntos (US-05)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Tab Adjuntos → subir PDF < 5MB | Archivo listado |
| 2 | Intentar subir archivo > 5MB | Error |
| 3 | Descargar adjunto | Archivo correcto |
| 4 | Eliminar adjunto | Confirmación modal → eliminado |

### 4.2 Export (US-24)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Botón Exportar → JSON | Descarga archivo .json |
| 2 | Botón Exportar → CSV | Descarga archivo .csv |
| 3 | PNG/PDF | No disponible (diferido), no aparece opción o muestra mensaje |

### 4.3 KPIs (US-23)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Barra superior KPIs | Proyectos activos, avance global, hitos próximos, presupuesto |

### 4.4 Mobile responsive (US-19)

| # | Paso | Resultado esperado |
|---|------|-------------------|
| 1 | Abrir en viewport 375px | Layout adaptado, navegable |
| 2 | Filtros y panel detalle en móvil | Funcionales |

---

## 5. Reporte de bugs

Usar esta plantilla:

```
BUG-###: [Título breve]

Severidad: Crítica | Alta | Media | Baja
Rol: Admin | Responsable | Ejecutor

Pasos para reproducir:
1.
2.
3.

Resultado esperado:

Resultado obtenido:

Captura/Log:
```

---

## 6. Criterios de aceptación UAT

| Criterio | Estado |
|----------|--------|
| Login OIDC funciona con los 3 roles | ⬜ |
| CRUD proyectos/tareas/etapas/grupos/hitos sin errores | ⬜ |
| Backlog: programar/desprogramar sin errores | ⬜ |
| Dependencias: crear, visualizar, warning al violar | ⬜ |
| Permisos: ejecutor no edita estructura, admin edita todo | ⬜ |
| Filtros funcionales y URL sync | ⬜ |
| Panel detalle con todos los tabs funcionales | ⬜ |
| Horas y presupuesto consistentes | ⬜ |
| Adjuntos: subir/descargar/eliminar | ⬜ |
| Export JSON/CSV | ⬜ |
| Navegación temporal (zoom, Hoy, flechas) | ⬜ |
| Admin: invitar/activar/desactivar usuarios | ⬜ |
| Sin errores 500 en consola del navegador | ⬜ |
| Sin errores en logs del servidor | ⬜ |

**Resultado final:** ⬜ Aprobado / ⬜ Aprobado con observaciones / ⬜ Rechazado

---

## 7. Credenciales y accesos

| Recurso | URL / Dato |
|---------|-----------|
| ABAX Gantt | `https://demo.breisner.info/abax-gantt` |
| Authentik Admin | `https://auth.breisner.info` |
| Admin user | `akadmin` / `root@example.com` |
| Logs servidor | `docker logs abax-gantt -f` |
| Logs Authentik | `docker logs authentik-server -f` |
