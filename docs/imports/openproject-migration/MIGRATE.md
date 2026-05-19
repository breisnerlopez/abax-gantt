# Migracion de Gantts desde OpenProject

**Fecha de extraccion:** 2026-05-15
**Origen:** OpenProject 15.5.0 (Docker)
**Contenido:** solo datos de Gantt -- sin adjuntos, sin binarios, sin configs del SO

---

## Archivos incluidos

| Archivo                         | Formato | Peso    | Descripcion                        |
|---------------------------------|---------|---------|-------------------------------------|
| `gantt-export/migration.json`   | JSON    | 862 KB  | Datos completos correlacionados     |
| `gantt-export/projects.csv`     | CSV     | 12 KB   | 99 proyectos con jerarquia          |
| `gantt-export/work_packages.csv`| CSV     | 257 KB  | 1857 tareas con fechas              |
| `gantt-export/relations.csv`    | CSV     | 3.5 KB  | 150 dependencias entre tareas       |
| `gantt-export/users.csv`        | CSV     | 1.8 KB  | 27 usuarios (asignables)            |
| `gantt-export/types.csv`        | CSV     | 0.2 KB  | 7 tipos de tarea                    |
| `gantt-export/statuses.csv`     | CSV     | 0.4 KB  | 14 estados                          |
| `gantt-export/versions.csv`     | CSV     | 0.7 KB  | 8 versiones/milestones              |

---

## Modelo de datos para el Gantt

```
projects
  |-- id, name, parent_id           <-- jerarquia de carpetas/proyectos

work_packages                       <-- cada barra del Gantt
  |-- id, project_id                <-- a que proyecto pertenece
  |-- parent_id                     <-- jerarquia WP padre/hijo
  |-- subject                       <-- titulo de la tarea
  |-- type_id    -> types.id        <-- tipo (Task, Milestone, Phase, Epic...)
  |-- status_id  -> statuses.id     <-- estado (New, In Progress, Done...)
  |-- assigned_to_id -> users.id    <-- responsable
  |-- start_date                    <-- inicio de la barra
  |-- due_date                      <-- fin de la barra
  |-- estimated_hours               <-- horas estimadas
  |-- done_ratio                    <-- % completado (0-100)
  |-- created_at, updated_at

relations                           <-- flechas del Gantt
  |-- relation_type: precedes | follows | blocks | includes | relates
  |-- from_id    -> work_packages.id
  |-- to_id      -> work_packages.id
  |-- lag                           <-- dias de retraso
  |-- description

versions                            <-- milestones en el Gantt
  |-- id, name, project_id
  |-- start_date, effective_date
  |-- status
```

---

## Como importar los datos

### Opcion 1: Usar migration.json (recomendado)

Escribe un script en tu lenguaje que lea el JSON y cree los objetos en la
herramienta destino. El orden de importacion debe ser:

1. `users`      -- crear usuarios/asignables
2. `types`      -- crear tipos de tarea
3. `statuses`   -- crear estados/flujos
4. `projects`   -- crear proyectos respetando `parent_id`
5. `versions`   -- crear milestones vinculados a `project_id`
6. `work_packages` -- crear tareas con fechas, asignados, `parent_id`
7. `relations`  -- crear dependencias entre WPs ya creados

### Opcion 2: Usar CSVs individuales

Cada CSV se puede abrir con Excel/LibreOffice/Google Sheets o importar
directamente si la herramienta destino soporta CSV. Las columnas con `_id`
son claves foraneas que referencian los IDs de otras tablas.

### Mapeo de tipos de relacion

| OpenProject      | Significado Gantt                          |
|------------------|-------------------------------------------|
| `precedes`       | Tarea A debe terminar antes que B empiece |
| `follows`        | Tarea A debe empezar despues que B        |
| `blocks`         | Tarea A bloquea a B                       |
| `includes`       | Tarea A contiene a B                      |
| `relates`        | Relacion generica, sin impacto en fechas  |

---

## Lista completa de proyectos (99)

La jerarquia se muestra con indentacion. Incluye conteo de tareas y rango de fechas.

```
 3  Liquidacion de convenios                                   9 tareas  2025-04-28 -> 2025-05-12
 4  App digitalizacion documentos sustentos convenios          3 tareas
 5  Implementacion de Seguridad - Servicios Digital            4 tareas  2025-04-22 -> 2025-05-01
 6  Mejoras Impresion de Sticker                               9 tareas  2025-05-06 -> 2025-05-15
 7  Concurso Millon                                           16 tareas  2025-05-07 -> 2025-05-26
 8  Solicitudes Administrador Temporal                         6 tareas  2025-05-07 -> 2025-05-15
10  [B2B] Apoyo Proyecto                                       5 tareas  2025-05-05 -> 2025-05-12
26    Migracion Micro Servicios                               17 tareas  2025-06-02 -> 2025-06-05
11    Drogueria                                                7 tareas  2025-06-18 -> 2025-07-09
12      [B2B] DC Cappa/Surquillo - Fase 1                    51 tareas  2025-04-09 -> 2025-07-25
37      Q3 SPRING 3 - LOS 6 CAMINOS                            8 tareas  2025-07-14 -> 2025-07-18
58      [B2B] DC Cappa/Surquillo - Fase 2                    47 tareas  2025-09-18 -> 2025-12-25
60      [B2B] DC Cappa/Surquillo - Fase 2 - DESARROLLO       63 tareas  2025-09-15 -> 2025-12-03
100     B2B - LI - Recall                                     21 tareas  2026-03-25 -> 2026-04-17
14  Token para Redencion                                       1 tarea   2025-04-21 -> 2025-05-09
15  Surcharge                                                  1 tarea   2025-05-08 -> 2025-05-09
16  Capon Presencial                                          11 tareas  2025-05-13 -> 2025-05-28
17  Rappi                                                      3 tareas  2025-05-08 -> 2025-05-09
18  AbaxWMS                                                    0 tareas
22  Proyecto Drogueria                                        34 tareas  2025-05-12 -> 2025-06-02
23  Dialog Nota de Credito 2B2                                 0 tareas
24  B2B NC Devolucion Dinero                                   0 tareas
25  Verificacion Integridad Binarios vs Codigo Versionado      9 tareas  2025-05-28 -> 2025-06-03
27  [Correccion] Acumulacion de puntos                         6 tareas  2025-06-10 -> 2025-06-12
28    [CAPON] [ABAX POSU] Toma de Pedido flujo presencial     18 tareas  2025-06-12 -> 2025-07-11
29  [RPA] Instalador PinPad                                    5 tareas  2025-06-11 -> 2025-06-16
30  Titan                                                     29 tareas  2025-06-10 -> 2025-06-20
31  Cuadratura Orvees - Millon                                 0 tareas
32  Diseno de Modulo de Cambio de Precios                     15 tareas  2025-06-26 -> 2025-07-11
40    [Mejoras] Modulo de Stickers                             4 tareas  2025-07-21 -> 2025-08-08
33  Requerimientos EXPRESS                                     6 tareas  2025-06-26 -> 2025-06-27
34  Update HGateway 6.5                                       18 tareas  2025-06-19 -> 2025-08-08
35  [POSU] Reporte de Anulaciones                             10 tareas  2025-07-21 -> 2025-08-08
51    [FILTRO] Personalizacion Search                          2 tareas  2025-08-18 -> 2025-08-19
36    [ABAX POSU] Mejoras en Carga de Servicios               17 tareas  2025-07-15 -> 2025-08-05
38  Implementar Limites Cash In/Cash Out                      13 tareas  2025-08-18 -> 2025-08-28
39  SAP HANA                                                  34 tareas  2025-07-10 -> 2025-08-22
41  [B2B] Consulta Comprobantes                               15 tareas  2025-07-18 -> 2025-08-08
42  Los 6 Caminos                                              0 tareas
43    Q3-Sprint 4                                             12 tareas  2025-07-30 -> 2025-08-15
52    Q4-Sprint 1                                             17 tareas  2025-08-18 -> 2025-09-01
55    Convenios                                                6 tareas  2025-08-25 -> 2025-09-05
62    Q3-Sprint 6                                             17 tareas  2025-09-15 -> 2025-09-29
66    Q4-Sprint 2                                             19 tareas  2025-10-13 -> 2025-10-24
68    Q4-sprint 3                                             14 tareas  2025-10-27 -> 2025-11-07
70    Q4-Sprint 4                                             94 tareas  2025-11-11 -> 2025-12-12
83    2026 - Estandar - Q1 - Spring 04                        19 tareas  2025-12-29 -> 2026-03-05
93    [Q1 Sprint 06] NC Matriz DC + Salud mental AMED         13 tareas  2026-03-09 -> 2026-03-19
99    Convenios Amed Pacifico + mejoras Titan                 11 tareas  2026-03-20 -> 2026-04-01
102   Logistica inversa (Creacion de lotes)                   15 tareas  2026-04-01 -> 2026-04-22
109   Sorteo del millon 2026 e IA convenios                   11 tareas  2026-05-04 -> 2026-05-13
44  [Operaciones] - Implementar pre-boleta                     5 tareas  2025-08-11 -> 2025-08-14
45  [Parametro] Omnicanal                                      4 tareas  2025-08-12 -> 2025-08-13
47  [DEMONIO MILLON] REVISION REGULARIZACION                   1 tarea   2025-08-12 -> 2025-12-19
48  Quality Assurance (QA)                                   106 tareas  2025-08-04 -> 2027-01-05
50  [DINO] Nueva Marca Beauty                                  3 tareas  2025-08-20 -> 2025-08-22
53    [ABAX POSU] TOMADOR DE PEDIDO POSU                       0 tareas
54    [ABAX POSU] MEJORAS E INICIATIVAS                       66 tareas  2025-09-01 -> 2026-03-27
71    ABAX POSU - Refactorizar FRONT                           8 tareas  2025-11-24 -> 2025-12-10
73    [MIA] POSU ABAX                                          8 tareas  2025-12-01 -> 2025-12-01
56  TICKETS GLPI                                              27 tareas  2025-08-14 -> 2025-10-17
57  REPORTE DE VENTA POR CATEGORIA                             6 tareas  2025-09-02 -> 2025-09-05
59  Team Halcones Blancos                                      0 tareas
80    Ticket Resumido                                          0 tareas
81      Ticket Resumido V1                                    47 tareas  2026-02-02 -> 2026-03-06
86    Modulo de impresion de stickers                          30 tareas  2026-02-02 -> 2026-03-16
96    Implementaciones priorizadas - Varios                    0 tareas
97      Implementaciones priorizadas - Varios                  7 tareas  2026-03-16 -> 2026-03-20
61  [POSU - PROYECTO] Proyecto Monroe                         23 tareas  2025-09-17 -> 2025-10-09
65    Programa de Lealtad !                                   25 tareas  2025-10-13 -> 2025-11-11
63  SKYNET 2026                                                6 tareas  2026-04-13 -> 2026-04-14
64    Automatizacion IA                                       31 tareas  2025-09-15 -> 2025-11-21
84    [Skynet] Automatizaciones IA - Febrero 2026             83 tareas  2026-01-19 -> 2026-05-11
103   Abax web - v. Tableta                                   15 tareas  2026-03-30 -> 2026-04-20
104   Web de Despliegues POS                                  24 tareas  2026-04-07 -> 2026-04-22
105   ROADMAP BASE DE DATOS                                   18 tareas  2026-04-13 -> 2026-05-15
67  Omnicanal Flujo RAD - Cambio de Direccion                 14 tareas  2025-10-20 -> 2025-10-23
69  Integracion & Despliegues                                 67 tareas  2025-10-29 -> 2026-04-30
72  [Observaciones] Omnicanal                                 12 tareas  2025-11-25 -> 2025-12-16
74  Reduccion de Tickets y Llamadas                            0 tareas
75    N1                                                      17 tareas  2026-01-19 -> 2026-02-27
76    N2                                                      42 tareas  2026-01-19 -> 2026-02-20
77  Mantenimiento POS - CQ                                    40 tareas  2026-01-19 -> 2026-05-12
78    [Omnicanal Pruebas y Despliegue 2026]                   20 tareas  2026-01-21 -> 2026-03-31
79    [ES7] Regularizar Pedidos                               13 tareas  2026-01-27 -> 2026-03-06
82  TEAM - JEDIS                                               0 tareas
85    Cambio de Logo SIP                                      16 tareas  2026-02-17 -> 2026-03-24
94    [FIX] REDONDEO RAPPI                                    10 tareas  2026-03-06 -> 2026-03-23
98    INICIATIVAS Y REQUERIMIENTOS TEAM JEDIS                 13 tareas  2026-03-24 -> 2026-03-31
101   Q4-Sprint 6                                             15 tareas  2026-04-06 -> 2026-05-13
106   Q4 -Sprint 7                                             3 tareas  2026-04-23 -> 2026-04-27
108   Q4-Sprint 8                                             25 tareas  2026-05-07 -> 2026-05-26
88  Lentitud 2026                                             83 tareas  2026-02-12 -> 2026-05-08
89  Eficiencia Operativa MDA - Reduccion de Tickets           38 tareas
90  Programa MDA: Reduccion de Operatividad y Tickets          0 tareas
91  MDA: Autoservicio y Automatizacion para Reducir Tickets   34 tareas  2026-03-05 -> 2026-03-05
92  Automatizacion MDA: Reduccion de Operatividad y Tickets   59 tareas  2026-03-09 -> 2026-04-14
95  Web de Administracion de Despliegues                      28 tareas  2025-12-15 -> 2026-04-24
107 Atencion al cliet                                           0 tareas
```

---

## Verificacion de integridad

-  99 proyectos (2 sin tareas)
- 1857 work packages
-  150 relaciones de dependencia
-   27 usuarios
-    8 versiones/milestones
-    7 tipos de tarea
-   14 estados

---

## Notas

- Este backup NO contiene archivos adjuntos, binarios, configuraciones del
  sistema operativo, claves SSH, certificados ni credenciales de servicio.
- Las credenciales listadas en los CSVs (ej. emails de usuarios) son datos
  de aplicacion, no secretos de infraestructura.
- El servidor de origen fue vulnerado. Aunque este es un dump logico de BD
  (solo datos), revisa los usuarios y permisos al importar en la nueva
  herramienta. Hay 27 usuarios, de los cuales 4 son admin.
