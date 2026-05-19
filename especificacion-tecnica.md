# Especificación Técnica — Sistema de Gestión de Proyectos con Gantt

**Fecha:** Mayo 2026  
**Versión:** 2.1  
**Stack:** React 19 + TypeScript + Vite + DHTMLX Gantt 9.1.4 + Authentik (OAuth2/OIDC) + Supabase (PostgreSQL + Edge Functions + Storage) + TailwindCSS + shadcn/ui + Zustand + TanStack Query  
**Licencia Gantt:** DHTMLX Gantt 9.1.4 GPL  
**Runtime Backend:** Supabase Edge Functions (Deno, TypeScript, desplegadas globalmente)

**Stack UI definido:** React 19 + TypeScript + Vite + TailwindCSS v4 + shadcn/ui + Radix UI + DHTMLX Gantt + TanStack Query + Zustand + React Router + React Hook Form + Zod

---

## 0. Principios Arquitectónicos

1. **Vista única principal: el Gantt.** No existen pantallas de detalle separadas. Todo panel lateral, modal o inline opera sobre la misma vista sin perder contexto.
2. **Permisos heredados hacia abajo.** Quien es responsable de un nodo controla toda su descendencia. El creador del proyecto es responsable raíz automático.
3. **Simplicidad extrema.** Solo el nombre es obligatorio en cualquier entidad. Todo lo demás es opcional.
4. **Autosave.** Todo cambio se persiste automáticamente al perder foco o después de un debounce de 500ms.
5. **Autoscheduling por defecto.** Las dependencias reprograman sucesoras automáticamente salvo que el usuario lo desactive; con autoscheduling apagado, el sistema solo advierte conflictos.
6. **Móvil como consulta operativa.** La app es web responsive/PWA; en móvil se prioriza consulta, filtros, detalle y reporte de avance, no edición estructural compleja.
7. **Identity-first con Authentik.** Authentik es el proveedor de identidad único vía OAuth2/OIDC Authorization Code + PKCE. El frontend nunca autentica contra Supabase Auth; envía el access token de Authentik a las Edge Functions.
8. **RLS defensivo + autorización en API.** La seguridad efectiva se aplica en Edge Functions validando JWT de Authentik + reglas de negocio. RLS queda como defensa secundaria y no como mecanismo principal de sesión.
9. **API-first con Edge Functions.** Toda operación de negocio pasa por Supabase Edge Functions (Deno), que actúan como API REST. Esto protege la lógica de negocio, permite validaciones server-side, expone endpoints para integraciones externas (MCP, webhooks), y mantiene al frontend como consumidor de una API documentada — no como cliente directo de base de datos.

---

## 1. Arquitectura General

### 1.0 Stack de interfaz de usuario

El frontend será una SPA React sobre Vite. Las plantillas entregadas se integrarán como componentes React, conservando su estructura visual y migrando estilos a tokens Tailwind cuando aplique.

| Área | Tecnología | Uso |
|------|------------|-----|
| Framework UI | **React 19 + TypeScript** | Aplicación SPA, componentes, hooks y tipado estricto |
| Build tool | **Vite** | Desarrollo rápido, bundling y code splitting |
| Routing | **React Router** | Rutas mínimas: `/login`, `/auth/callback`, `/gantt` |
| Estilos | **TailwindCSS v4** | Layout, spacing, responsive, temas y design tokens |
| Componentes base | **shadcn/ui + Radix UI** | Dialogs, dropdowns, popovers, tabs, selects, tooltips, drawers |
| Iconografía | **lucide-react** | Íconos consistentes para toolbar, filtros, acciones y estados |
| Gantt | **DHTMLX Gantt** | Vista principal: grid WBS + timeline + dependencias + drag & drop |
| Server state | **TanStack Query** | Carga, caché, invalidación y mutations contra Edge Functions |
| UI state | **Zustand** | Paneles, filtros activos, nodo seleccionado, fullscreen, preferencias |
| Formularios | **React Hook Form + Zod** | Formularios del panel lateral, validación y errores tipados |
| Drag externo | **@dnd-kit** | Backlog lateral → Gantt, reordenamiento visual cuando aplique |
| Auth frontend | **oidc-client-ts** | Login/logout OIDC con Authentik, token refresh, callback PKCE |
| Notificaciones | **sonner** | Toasts de autosave, errores, confirmaciones y advertencias |
| Fechas | **date-fns** | Formato de fechas, cálculos simples y localización ES |

**Reglas de integración de plantillas:**

1. Si las plantillas vienen en HTML/Tailwind, se convertirán a componentes React preservando clases Tailwind y estructura visual.
2. Si las plantillas vienen en React, se adaptarán a TypeScript estricto y al sistema de rutas/layout del proyecto.
3. No se introducirá otro UI kit paralelo; cualquier componente visual nuevo debe construirse sobre shadcn/ui/Radix o sobre los tokens de la plantilla.
4. El Gantt no se reimplementa con componentes de plantilla: DHTMLX sigue siendo el componente central y las plantillas se usan para toolbar, paneles, filtros, login, menús y dashboard compacto.
5. Toda personalización visual de DHTMLX se hará con CSS scoped y variables Tailwind/CSS, evitando estilos inline salvo configuración dinámica necesaria.

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Browser (React 19 SPA + PWA)                    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     Zustand Store (global)                      │   │
│  │   auth · projects · wbs · filters · ui · notifications          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                  TanStack Query (server state)                  │   │
│  │   useProjects · useWbsTree · useTasks · useUsers · useBudget    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌───────┬─────────────────────────────────────┬──────────┐           │
│  │Backlog│           DHTMLX Gantt              │ Detail   │           │
│  │Panel  │  ┌──────────┬────────────────────┐  │ Panel    │           │
│  │(L)    │  │ Grid     │ Timeline           │  │ (R)      │           │
│  │React  │  │ (árbol   │ (barras, flechas,  │  │ React    │           │
│  │+dnd-  │  │ WBS)     │  hitos, markers)   │  │ +shadcn  │           │
│  │kit    │  └──────────┴────────────────────┘  │          │           │
│  └───────┴─────────────────────────────────────┴──────────┘           │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  Toolbar: [+Proyecto] [Escala] [Filtros] [Mis Tareas] [...]   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  KPI Bar: [Proyectos activos] [Avance%] [Hitos 30d] [Budget]  │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │  ┌──────────────┐   │
                  │  │ Authentik    │   │  ┌─────────────────┐
                  │  │ OIDC Client  │   │  │ HTTP fetch()    │
                  │  │ (PKCE login, │   │  │ (Edge Functions │
                  │  │  tokens)     │   │  │  + MCP server)  │
                  │  └──────┬───────┘   │  └────────┬────────┘
                  └─────────┼───────────┘           │
                            │                       │
┌───────────────────────────┼───────────────────────┼──────────────────┐
│               Docker self-hosted + PostgreSQL + Authentik             │
│                           │                        │                  │
│  ┌──────────┐  ┌──────────┴──────────┐  ┌─────────┴──────────┐      │
│  │Authentik │  │  Deno HTTP API      │  │  PostgreSQL         │      │
│  │ OIDC IdP │  │  (deploy/server)    │  │  + ltree            │      │
│  │          │  │                     │  │                     │      │
│  │ • login  │  │  /api/wbs/*         │  │  • Tablas            │      │
│  │ • groups │  │  /api/projects/*    │  │  • Políticas defensa │      │
│  │ • claims │  │  /api/dependencies/*│  │  • Funciones PL/pgSQL│      │
│  │ • MFA    │  │  /api/assignees/*   │  │  • Índices GIST      │      │
│  └──────────┘  │  /api/timesheet/*   │  └─────────────────────┘      │
│                │  /api/reports/*     │                                │
│  ┌──────────┐  │  /api/admin/*       │  ┌─────────────────────┐      │
│  │ Storage  │  │  /api/kpi/*         │  │  Realtime/SSE       │      │
│  │ (S3)     │  │  /api/import/*      │  │  (WebSocket)        │      │
│  │          │  │  /api/export/*      │  │                     │      │
│  │ • adjuntos│ │  /api/mcp/*   ← MCP │  │  • Broadcast/SSE    │      │
│  │ • avatars │ │                     │  │  • Presence         │      │
│  └──────────┘  │  + service-role     │  │  • Colaboración     │      │
│                │    (bypass RLS)      │  └─────────────────────┘      │
│                └─────────────────────┘                                │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.1 Decisiones de capa de acceso

| Capa | Accede vía | Autenticación | Acceso a BD |
|------|-----------|---------------|-------------|
| **Frontend → Authentik** | `oidc-client-ts` | OAuth2/OIDC Authorization Code + PKCE | No aplica |
| **Frontend → Edge Functions** | `fetch()` HTTP | Access token de Authentik en `Authorization` header | No directo |
| **Frontend → Storage** | `fetch()` a `/api/attachments` | Access token de Authentik | No directo |
| **Frontend → Realtime** | SSE/WebSocket vía Edge Function o polling | Access token de Authentik | No directo |
| **Edge Functions → Authentik** | JWKS / introspection | Validación de firma, issuer, audience, exp | No aplica |
| **Edge Functions → PostgreSQL** | `supabase-js` admin | Service Role Key (bypass RLS) | Total |
| **Agente MCP → Edge Functions** | `fetch()` HTTP | API Key + HMAC | No directo |

**¿Por qué Edge Functions con service-role en vez de acceso directo frontend→DB?**

1. **Lógica de negocio protegida:** Las validaciones complejas (ej. "no puedes crear una dependencia circular", "el presupuesto no puede exceder el global") viven en el backend, no en el cliente.
2. **Auditabilidad centralizada:** Cada mutación se registra en un log estructurado desde el Edge Function, sin depender de triggers PG solamente.
3. **API documentada y versionada:** Los endpoints REST (`/api/wbs`, `/api/projects`) tienen contrato explícito. Cambiar la base de datos no rompe el frontend si la API mantiene compatibilidad.
4. **MCP e integraciones externas:** Un agente MCP o un webhook de terceros no puede hablar directamente con PostgreSQL. La API REST es la interfaz canónica.
5. **Caché y rate limiting:** Las Edge Functions permiten cache en CDN de Supabase (lecturas) y rate limiting por usuario.
6. **Compatibilidad con Authentik:** Los tokens OIDC de Authentik se validan en Edge Functions usando JWKS. No dependemos de Supabase Auth ni de `auth.uid()` para operar la aplicación.

### 1.2 Principios de comunicación

- El Gantt es un componente React que encapsula la instancia DHTMLX vía `useRef` + `useEffect`. DHTMLX mantiene su propio DOM.
- **Login:** el frontend redirige a Authentik usando Authorization Code + PKCE. Al volver, guarda access token/refresh token en memoria segura manejada por `oidc-client-ts`.
- **Lecturas:** `TanStack Query` → `fetch(GET /api/wbs)` → Edge Function → `supabase-js (service-role)` → PostgreSQL → datos → Edge Function formatea respuesta → JSON al frontend.
- **Escrituras:** `TanStack Query mutation` → `fetch(POST /api/wbs)` con access token de Authentik → Edge Function valida identidad y permisos → PostgreSQL → respuesta → invalidate queries.
- **Storage:** el frontend nunca sube directo a Supabase Storage. Usa `/api/attachments`, que valida permisos y genera subida/descarga con service-role o signed URLs.
- **Tiempo real:** para MVP se permite polling/invalidate por mutations; para colaboración en vivo se agrega SSE/WebSocket desde Edge Functions validando Authentik.
- DHTMLX se actualiza vía `gantt.parse()` (carga inicial) y `gantt.updateTask()` / `gantt.addTask()` / `gantt.deleteTask()` para cambios incrementales.
- DHTMLX emite eventos locales (`onAfterTaskUpdate`, `onAfterTaskAdd`, etc.) que disparan mutations hacia Edge Functions.

### 1.3 Configuración Authentik

En Authentik se debe crear una aplicación/proveedor OAuth2/OIDC para la SPA:

| Campo | Valor recomendado |
|-------|-------------------|
| Grant type | Authorization Code |
| PKCE | Requerido, `S256` |
| Client type | Public client (SPA) |
| Redirect URI local | `http://localhost:5173/auth/callback` |
| Redirect URI producción | `https://app.dominio.com/auth/callback` |
| Scopes | `openid email profile groups` |
| Claims requeridos | `sub`, `email`, `name`, `groups` |
| Admin mapping | Grupo Authentik `abax-admins` → `profiles.is_admin = true` |

El sistema no crea contraseñas ni sesiones propias. La gestión de MFA, recuperación de contraseña, bloqueo de usuario, políticas de acceso y SSO queda completamente en Authentik.

---

## 2. API Layer — Supabase Edge Functions (Deno + TypeScript)

### 2.0 Estructura de Edge Functions

```
supabase/
├── migrations/                          # SQL versionado
│   ├── 00001_schema.sql
│   ├── 00002_rls.sql
│   └── 00003_functions.sql
├── seed.sql
├── config.toml                          # Config local de Supabase
└── functions/
    ├── _shared/                         # Código compartido entre functions
    │   ├── cors.ts                      # Headers CORS + preflight
    │   ├── auth.ts                      # Verificar JWT, extraer user_id, check is_admin
    │   ├── db.ts                        # Cliente supabase-js con service-role
    │   ├── validation.ts                # Zod schemas compartidos
    │   └── errors.ts                    # Tipos de error + formateadores de respuesta
    │
    ├── api-wbs/                         # GET/POST wbs_nodes
    │   └── index.ts
    ├── api-wbs-node/                    # GET/PUT/DELETE /api/wbs/:id
    │   └── index.ts
    ├── api-projects/                    # GET/POST projects
    │   └── index.ts
    ├── api-projects-project/            # GET/PUT/DELETE /api/projects/:id
    │   └── index.ts
    ├── api-dependencies/                # GET/POST dependencies
    │   └── index.ts
    ├── api-dependencies-dependency/     # DELETE /api/dependencies/:id
    │   └── index.ts
    ├── api-assignees/                   # GET/POST/DELETE task_assignees
    │   └── index.ts
    ├── api-timesheet/                   # GET/POST time_entries
    │   └── index.ts
    ├── api-reports/                     # Agregaciones, resúmenes
    │   └── index.ts
    ├── api-kpi/                         # Dashboard KPIs
    │   └── index.ts
    ├── api-admin-users/                 # Admin: CRUD usuarios
    │   └── index.ts
    ├── api-admin-project-types/         # Admin: CRUD tipos de proyecto
    │   └── index.ts
    ├── api-import/                      # Importar MS Project, Excel
    │   └── index.ts
    ├── api-export/                      # Exportar a formatos
    │   └── index.ts
    ├── api-mcp/                         # MCP Server endpoint
    │   └── index.ts
    └── api-attachments/                 # GET/POST/DELETE adjuntos
        └── index.ts
```

### 2.1 Shared utilities (`_shared/`)

```typescript
// supabase/functions/_shared/auth.ts
import { createRemoteJWKSet, jwtVerify } from "npm:jose";
import { getServiceClient } from "./db.ts";

interface AuthContext {
  userId: string;
  authentikSub: string;
  email: string;
  groups: string[];
  isAdmin: boolean;
}

const jwks = createRemoteJWKSet(new URL(Deno.env.get("AUTHENTIK_JWKS_URL")!));

export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Token requerido");
  }
  const token = authHeader.slice(7);

  const { payload } = await jwtVerify(token, jwks, {
    issuer: Deno.env.get("AUTHENTIK_ISSUER")!,
    audience: Deno.env.get("AUTHENTIK_CLIENT_ID")!,
  });

  const authentikSub = String(payload.sub);
  const email = String(payload.email ?? "");
  const groups = Array.isArray(payload.groups) ? payload.groups.map(String) : [];

  const db = getServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, is_admin")
    .eq("authentik_sub", authentikSub)
    .single();

  if (!profile) {
    throw new ApiError(403, "Usuario no provisionado en el sistema");
  }

  return { userId: profile.id, authentikSub, email, groups, isAdmin: profile.is_admin };
}

// supabase/functions/_shared/db.ts
export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // bypassea RLS
  );
}

// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

// supabase/functions/_shared/errors.ts
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function okResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 2.2 Ejemplo de Edge Function: `api-wbs/index.ts`

```typescript
// supabase/functions/api-wbs/index.ts
// Endpoint: GET /api/wbs  →  listar árbol WBS (filtrado por proyecto, responsable, etc.)
// Endpoint: POST /api/wbs →  crear nodo WBS

import { authenticate, ApiError, errorResponse, okResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/db.ts";
import { handleCors } from "../_shared/cors.ts";
import { z } from "npm:zod";

const createWbsSchema = z.object({
  project_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(300),
  type: z.enum(["project", "stage", "group", "task", "milestone"]),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  description: z.string().max(2000).optional(),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
});

Deno.serve(async (req: Request) => {
  // CORS preflight
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();

    const url = new URL(req.url);
    const method = req.method;

    // ───── GET ─────
    if (method === "GET") {
      const projectId = url.searchParams.get("project_id");
      const unscheduled = url.searchParams.get("unscheduled");

      let query = db.from("wbs_nodes").select(`
        *,
        task_assignees(user_id, profiles(full_name, avatar_url)),
        dependencies!dependencies_successor_id_fkey(*,
          predecessor:wbs_nodes!dependencies_predecessor_id_fkey(id, name, type)
        )
      `);

      if (projectId) query = query.eq("project_id", projectId);
      if (unscheduled === "true") query = query.eq("is_unscheduled", true);
      if (unscheduled === "false") query = query.eq("is_unscheduled", false);

      // Filtros adicionales
      const responsibleId = url.searchParams.get("responsible_id");
      if (responsibleId) query = query.eq("responsible_id", responsibleId);

      const myTasks = url.searchParams.get("my_tasks");
      if (myTasks === "true") {
        query = query.filter("task_assignees", "user_id", "eq", auth.userId);
      }

      const { data, error } = await query.order("sort_order");

      if (error) throw new ApiError(500, error.message);
      return okResponse({ data, count: data?.length ?? 0 });
    }

    // ───── POST ─────
    if (method === "POST") {
      const body = createWbsSchema.parse(await req.json());

      // Regla de negocio: verificar que el usuario puede crear bajo ese parent
      if (body.parent_id) {
        const { data: parent } = await db
          .from("wbs_nodes")
          .select("project_id, path")
          .eq("id", body.parent_id)
          .single();

        if (!parent) throw new ApiError(404, "Nodo padre no encontrado");
        body.project_id = parent.project_id;
      }

      // Construir path con ltree
      let path: string;
      if (body.parent_id) {
        const { data: parent } = await db
          .from("wbs_nodes")
          .select("path")
          .eq("id", body.parent_id)
          .single();
        path = `${parent!.path}.${body.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      } else {
        path = body.name.replace(/[^a-zA-Z0-9]/g, "_");
      }

      const { data, error } = await db.from("wbs_nodes").insert({
        ...body,
        path,
        created_by: auth.userId,
        responsible_id: body.parent_id ? null : auth.userId, // hereda de ancestro si tiene padre
        is_unscheduled: !body.start_date,
      }).select().single();

      if (error) throw new ApiError(400, error.message);

      // Broadcast cambio por Realtime
      await db.channel("wbs-changes").send({
        type: "broadcast",
        event: "wbs_created",
        payload: { id: data.id, project_id: data.project_id },
      });

      return okResponse(data, 201);
    }

    throw new ApiError(405, "Método no permitido");
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err.status, err.message);
    }
    if (err instanceof z.ZodError) {
      return errorResponse(400, `Validación: ${err.errors.map(e => e.message).join(", ")}`);
    }
    console.error("Unhandled error:", err);
    return errorResponse(500, "Error interno del servidor");
  }
});
```

### 2.3 Catálogo completo de Endpoints Edge Functions

| Método | Ruta | Descripción | Auth | US |
|--------|------|-------------|------|-----|
| `GET` | `/api/wbs` | Listar árbol WBS con filtros (`?project_id=`, `?my_tasks=true`, `?unscheduled=true`) | JWT Authentik | US-14/15/16 |
| `POST` | `/api/wbs` | Crear nodo WBS (tarea, etapa, grupo, hito) | JWT Authentik | US-06/07/08/09 |
| `GET` | `/api/wbs/:id` | Obtener un nodo con sus dependencias y ejecutores | JWT Authentik | US-04 |
| `PUT` | `/api/wbs/:id` | Actualizar nodo (nombre, fechas, progreso, color, responsable) | JWT Authentik | US-04/09B/13 |
| `PATCH` | `/api/wbs/:id/progress` | Reportar avance (ejecutor o responsable) | JWT Authentik | US-13 |
| `PATCH` | `/api/wbs/:id/schedule` | Programar/desprogramar tarea (backlog ↔ Gantt) | JWT Authentik | US-10B/18 |
| `DELETE` | `/api/wbs/:id` | Eliminar nodo (en cascada a hijos) | JWT Authentik | — |
| `GET` | `/api/projects` | Listar proyectos visibles para el usuario | JWT Authentik | US-14/15 |
| `POST` | `/api/projects` | Crear proyecto (asigna responsible_id = currentUser) | JWT Authentik | US-03 |
| `GET` | `/api/projects/:id` | Detalle del proyecto + presupuesto consolidado | JWT Authentik | US-04/21 |
| `PUT` | `/api/projects/:id` | Actualizar proyecto | JWT Authentik | US-04 |
| `DELETE` | `/api/projects/:id` | Archivar proyecto (soft delete) | JWT Authentik | — |
| `GET` | `/api/dependencies` | Listar dependencias por proyecto | JWT Authentik | US-10 |
| `POST` | `/api/dependencies` | Crear dependencia (con validación: sin ciclos, ancestro común) | JWT Authentik | US-10 |
| `DELETE` | `/api/dependencies/:id` | Eliminar dependencia | JWT Authentik | US-10 |
| `GET` | `/api/assignees?task_id=` | Listar ejecutores de una tarea | JWT Authentik | US-11 |
| `POST` | `/api/assignees` | Asignar ejecutor a tarea | JWT Authentik | US-11 |
| `DELETE` | `/api/assignees/:id` | Desasignar ejecutor | JWT Authentik | US-11 |
| `GET` | `/api/timesheet?task_id=&user_id=` | Listar time entries | JWT Authentik | US-22 |
| `POST` | `/api/timesheet` | Registrar horas trabajadas | JWT Authentik (solo propio) | US-22 |
| `POST` | `/api/attachments` | Subir adjunto (multipart form) | JWT Authentik | US-05 |
| `GET` | `/api/attachments?project_id=` | Listar adjuntos de proyecto | JWT Authentik | US-05 |
| `DELETE` | `/api/attachments/:id` | Eliminar adjunto | JWT Authentik | US-05 |
| `GET` | `/api/kpi` | Indicadores globales (proyectos activos, avance%, hitos 30d, presupuesto) | JWT Authentik | US-23 |
| `GET` | `/api/reports/project/:id/budget` | Reporte presupuestario detallado | JWT Authentik | US-20/21 |
| `GET` | `/api/admin/users` | Listar todos los usuarios | JWT Authentik + admin | US-02 |
| `POST` | `/api/admin/users` | Invitar nuevo usuario | JWT Authentik + admin | US-02 |
| `PUT` | `/api/admin/users/:id` | Activar/desactivar usuario | JWT Authentik + admin | US-02 |
| `GET` | `/api/admin/project-types` | Listar tipos de proyecto | JWT Authentik | US-01 |
| `POST` | `/api/admin/project-types` | Crear tipo de proyecto | JWT Authentik + admin | US-01 |
| `PUT` | `/api/admin/project-types/:id` | Actualizar tipo | JWT Authentik + admin | US-01 |
| `POST` | `/api/import/msproject` | Importar archivo MS Project (.xml) | JWT Authentik | — |
| `POST` | `/api/import/excel` | Importar planilla Excel | JWT Authentik | — |
| `GET` | `/api/export/project/:id/json` | Exportar proyecto a JSON | JWT Authentik | US-24 |
| `GET` | `/api/export/project/:id/excel` | Exportar proyecto a Excel (server-side) | JWT Authentik | US-24 |

### 2.4 MCP Server (`api-mcp/index.ts`)

El MCP server se implementa como una Edge Function que expone recursos y tools del protocolo MCP vía HTTP/SSE (Streamable HTTP). Permite que un agente IA consulte y modifique proyectos a través de la API.

```typescript
// supabase/functions/api-mcp/index.ts
// Transporte: HTTP/SSE (Streamable HTTP) — compatible con MCP 2024-11-05+

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Autenticación: API Key + HMAC (no JWT de usuario)
  const apiKey = req.headers.get("X-API-Key");
  if (!apiKey || !verifyApiKey(apiKey)) {
    return errorResponse(401, "API Key inválida");
  }

  const url = new URL(req.url);
  const method = req.method;

  // ───── MCP JSON-RPC ─────
  if (method === "POST" || method === "GET") {
    // Si es GET: retorna Server-Sent Events endpoint
    if (method === "GET" && req.headers.get("Accept")?.includes("text/event-stream")) {
      return handleSSEConnection(req, apiKey);
    }

    // Si es POST: procesa JSON-RPC message
    const body = await req.json();
    const result = await handleMCPMessage(body, apiKey);
    return okResponse(result);
  }

  return errorResponse(405, "Method not allowed");
});

// Recursos MCP expuestos:
// mcp://abax-gantt/projects          → lista de proyectos
// mcp://abax-gantt/projects/:id      → detalle de proyecto
// mcp://abax-gantt/projects/:id/wbs  → árbol WBS del proyecto
// mcp://abax-gantt/projects/:id/kpi  → KPIs del proyecto
// mcp://abax-gantt/tasks/:id         → detalle de tarea
// mcp://abax-gantt/tasks/:id/deps    → dependencias de una tarea
// mcp://abax-gantt/reports/portfolio → reporte consolidado de portafolio
// mcp://abax-gantt/reports/budget    → reporte presupuestario global
// mcp://abax-gantt/users/:id/tasks   → tareas asignadas a un usuario

// Tools MCP expuestas:
// create_task        — crear tarea en un proyecto
// update_task        — modificar nombre, fechas, progreso
// assign_user        — asignar ejecutor a tarea
// add_dependency     — crear dependencia entre tareas
// search_tasks       — buscar tareas por nombre/responsable/estado
// get_portfolio_report — generar reporte PDF/JSON del portafolio
```

### 2.5 Patrón de llamada desde el frontend

```typescript
// src/lib/api.ts — cliente tipado para Edge Functions
const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const oidcUser = await authManager.getUser(); // oidc-client-ts / Authentik
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(oidcUser?.access_token
        ? { Authorization: `Bearer ${oidcUser.access_token}` }
        : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiClientError(res.status, err.error || "Error desconocido");
  }
  return res.json();
}

// Tipos exportados para TanStack Query
export const wbsApi = {
  list: (params?: WbsQueryParams) =>
    apiFetch<PaginatedResponse<WbsNode>>(
      `/wbs?${new URLSearchParams(params as Record<string, string>)}`
    ),
  get: (id: string) => apiFetch<WbsNode>(`/wbs/${id}`),
  create: (data: CreateWbsInput) =>
    apiFetch<WbsNode>("/wbs", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<WbsNode>) =>
    apiFetch<WbsNode>(`/wbs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/wbs/${id}`, { method: "DELETE" }),
  schedule: (id: string, dates: { start_date: string; end_date: string }) =>
    apiFetch<WbsNode>(`/wbs/${id}/schedule`, { method: "PATCH", body: JSON.stringify(dates) }),
  unschedule: (id: string) =>
    apiFetch<WbsNode>(`/wbs/${id}/schedule`, { method: "PATCH", body: JSON.stringify({ unschedule: true }) }),
};

// ... mismo patrón para projectsApi, dependenciesApi, assigneesApi, etc.
```

### 2.6 Ventajas de esta arquitectura para el futuro

| Necesidad futura | Cómo se resuelve |
|------------------|------------------|
| **MCP server** para agentes IA | Edge Function `api-mcp` ya expone recursos y tools MCP. Solo se agregan más resources/tools. |
| **Webhooks salientes** (notificar a Slack, Jira, Teams) | Edge Function con `fetch()` a la URL del webhook. Se dispara desde triggers DB o desde la API. |
| **Integración con MS Project / Jira** | Edge Functions `api-import` / `api-export` manejan transformación de formatos. |
| **Automatizaciones** (si tarea X se completa → crear tarea Y) | Edge Function con lógica de reglas. Se ejecuta en respuesta a eventos Realtime o triggers DB. |
| **Rate limiting / protección DDoS** | Supabase provee rate limiting en Edge Functions (configurable por proyecto). |
| **Caché de lecturas** | Edge Functions en Supabase tienen cache CDN automático para respuestas GET con headers adecuados. |
| **Auditoría / compliance** | Cada Edge Function registra operación en tabla `audit_log` (service-role, sin exponer al frontend). |
| **Migración a microservicios** | Los Edge Functions ya son funciones independientes. Migrar una a un servicio dedicado es trivial: mismo contrato HTTP, distinto deploy. |

---

## 3. Modelo de Datos (PostgreSQL + Supabase)

### 3.1 Esquema de tablas

```sql
-- ============================================================
-- Extensión ltree para herencia de permisos en WBS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS ltree;

-- ============================================================
-- Enumeraciones
-- ============================================================
CREATE TYPE node_type AS ENUM ('project', 'stage', 'group', 'task', 'milestone');
CREATE TYPE dep_type AS ENUM ('FS', 'SS', 'FF', 'SF');
CREATE TYPE project_status AS ENUM ('active', 'archived');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'invited');

-- ============================================================
-- profiles (usuarios provisionados desde Authentik/OIDC)
-- ============================================================
CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authentik_sub TEXT NOT NULL UNIQUE,                 -- claim sub de Authentik
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  groups        TEXT[] NOT NULL DEFAULT '{}',         -- grupos recibidos/provisionados desde Authentik
  status        user_status NOT NULL DEFAULT 'invited',
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- project_types (US-01)
-- ============================================================
CREATE TABLE project_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  color         TEXT NOT NULL DEFAULT '#6366f1',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- projects (raíz del WBS por proyecto)
-- ============================================================
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  project_type_id UUID REFERENCES project_types(id) ON DELETE SET NULL,
  status          project_status NOT NULL DEFAULT 'active',
  autoscheduling_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  budget_total    NUMERIC(12,2),                     -- presupuesto global del proyecto (US-21)
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- wbs_nodes (árbol completo del WBS: proyectos↔etapas↔grupos↔tareas↔hitos)
-- ============================================================
CREATE TABLE wbs_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES wbs_nodes(id) ON DELETE CASCADE,

  -- Identidad
  name            TEXT NOT NULL,                     -- único campo obligatorio
  type            node_type NOT NULL DEFAULT 'task',
  description     TEXT,

  -- Temporalidad
  start_date      DATE,
  end_date        DATE,
  duration_days   INT GENERATED ALWAYS AS (
                    CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL
                      AND type != 'milestone'
                      THEN (end_date - start_date)::INT
                      ELSE NULL
                    END
                  ) STORED,
  progress        REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  estimated_hours NUMERIC(10,2),                     -- horas estimadas (US-20)
  estimated_cost  NUMERIC(12,2),                     -- costo estimado (US-20)

  -- Visualización
  color           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,

  -- Responsable (permisos heredados hacia abajo)
  responsible_id  UUID REFERENCES profiles(id),     -- NULL = hereda del ancestro
  created_by      UUID NOT NULL REFERENCES profiles(id),

  -- Metadatos
  is_unscheduled  BOOLEAN NOT NULL DEFAULT TRUE,    -- TRUE = en backlog, FALSE = en Gantt
  is_collapsed    BOOLEAN NOT NULL DEFAULT FALSE,    -- estado expandir/colapsar preferido
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ltree para consultas jerárquicas eficientes
  path            LTREE NOT NULL                     -- ej: 'proj1.stage1.group1.task1'
);

-- Índices
CREATE INDEX idx_wbs_project ON wbs_nodes(project_id);
CREATE INDEX idx_wbs_parent ON wbs_nodes(parent_id);
CREATE INDEX idx_wbs_type ON wbs_nodes(type);
CREATE INDEX idx_wbs_path ON wbs_nodes USING GIST(path);
CREATE INDEX idx_wbs_responsible ON wbs_nodes(responsible_id);
CREATE INDEX idx_wbs_unscheduled ON wbs_nodes(project_id, is_unscheduled) WHERE is_unscheduled = TRUE;

-- ============================================================
-- dependencies (US-10)
-- ============================================================
CREATE TABLE dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id  UUID NOT NULL REFERENCES wbs_nodes(id) ON DELETE CASCADE,
  successor_id    UUID NOT NULL REFERENCES wbs_nodes(id) ON DELETE CASCADE,
  type            dep_type NOT NULL DEFAULT 'FS',
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dependency UNIQUE(predecessor_id, successor_id),
  CONSTRAINT chk_no_self_dep CHECK (predecessor_id != successor_id)
);

CREATE INDEX idx_dep_predecessor ON dependencies(predecessor_id);
CREATE INDEX idx_dep_successor ON dependencies(successor_id);

-- ============================================================
-- task_assignees (ejecutores, US-11)
-- ============================================================
CREATE TABLE task_assignees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES wbs_nodes(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by     UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_task_assignee UNIQUE(task_id, user_id)
);

CREATE INDEX idx_assignee_user ON task_assignees(user_id);
CREATE INDEX idx_assignee_task ON task_assignees(task_id);

-- ============================================================
-- time_entries (horas reales, US-22)
-- ============================================================
CREATE TABLE time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES wbs_nodes(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  hours           REAL NOT NULL CHECK (hours > 0),
  notes           TEXT,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_task ON time_entries(task_id);
CREATE INDEX idx_time_user ON time_entries(user_id);

-- ============================================================
-- attachments (US-05, Supabase Storage)
-- ============================================================
CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,                     -- path en Supabase Storage
  file_size       INT NOT NULL CHECK (file_size <= 5242880), -- 5MB max
  mime_type       TEXT NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attach_project ON attachments(project_id);
```

### 3.2 Mapeo WBS → DHTMLX Gantt

DHTMLX GPL se usa con un solo tipo base operativo y una propiedad de negocio `type`. La diferenciación visual se logra con templates/CSS:

| Concepto WBS  | `type` negocio      | Comportamiento                                              |
|---------------|---------------------|-------------------------------------------------------------|
| Proyecto      | `"project"`         | Barra contenedora, duración = rango de hijos, color sólido  |
| Etapa         | `"stage"`           | Barra contenedora, visualmente distinta (borde punteado)    |
| Grupo         | `"group"`           | Barra contenedora, sin fechas propias (calculadas)          |
| Tarea         | `"task"`            | Barra arrastrable, fechas editables                         |
| Hito          | `"milestone"`       | Rombo, duración = 0, solo fecha                             |

**Transformación en el adaptador (`src/lib/gantt-adapter.ts`):**

```typescript
interface GanttRow {
  id: number;                              // numérico secuencial para DHTMLX
  parent: number;                          // 0 para raíz (proyectos)
  text: string;                            // nombre del nodo
  type: 'project' | 'milestone' | 'task' | 'stage' | 'group';
  start_date: string | null;               // ISO date o null si unscheduled
  duration: number;                        // días entre start-end (0 para milestones)
  progress: number;                        // 0.0 a 1.0
  color?: string;
  responsible_name?: string;               // custom property para el grid
  assignee_names?: string;                 // custom property para el grid
  estimated_hours?: number;                // custom property
  actual_hours?: number;                   // custom property
  unscheduled: boolean;                    // custom property
  wbs_id: string;                          // UUID real del nodo (para mutations)
  project_id: string;                      // UUID del proyecto
}

interface GanttLink {
  id: number;
  source: number;                          // ID numérico del predecesor
  target: number;                          // ID numérico del sucesor
  type: '0' | '1' | '2' | '3';           // FS, SS, FF, SF
}
```

---

## 4. Políticas de Seguridad (RLS en Supabase)

Con Authentik, la autorización operativa se ejecuta en Edge Functions usando el usuario interno `profiles.id` resuelto desde el claim `sub`. Las políticas RLS se mantienen como defensa adicional y para herramientas internas, pero el frontend no depende de `auth.uid()` ni accede directamente a tablas.

Para habilitar RLS con Authentik en consultas directas internas, las Edge Functions pueden ejecutar `SET LOCAL app.current_user_id = '<profiles.id>'` y las políticas pueden leer `current_setting('app.current_user_id', true)::uuid`. En el MVP, como las Edge Functions usan service-role, la validación se hace explícitamente en código antes de cada operación.

### 4.1 Función auxiliar: determinar si un usuario tiene permiso sobre un nodo

```sql
-- Edge Functions pueden fijar este valor por request:
-- SELECT set_config('app.current_user_id', '<profiles.id>', true);
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Dado un user_id y un wbs_node_id, determina si el usuario es:
-- (a) admin, o
-- (b) responsible_id del nodo, o
-- (c) responsible_id de algún ancestro del nodo
CREATE OR REPLACE FUNCTION can_manage_node(check_user_id UUID, node_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
  node_path LTREE;
BEGIN
  -- Verificar si es admin
  SELECT p.is_admin INTO is_admin FROM profiles p WHERE p.id = check_user_id;
  IF is_admin THEN RETURN TRUE; END IF;

  -- Obtener el path del nodo
  SELECT wn.path INTO node_path FROM wbs_nodes wn WHERE wn.id = node_id;
  IF node_path IS NULL THEN RETURN FALSE; END IF;

  -- Verificar si el usuario es responsible_id en el nodo o cualquier ancestro
  RETURN EXISTS (
    SELECT 1 FROM wbs_nodes wn
    WHERE wn.path @> node_path                    -- ancestro o el mismo nodo
      AND wn.responsible_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Determinar el responsible_id efectivo de un nodo (hereda del ancestro)
CREATE OR REPLACE FUNCTION effective_responsible(node_id UUID)
RETURNS UUID AS $$
  SELECT wn.responsible_id
  FROM wbs_nodes wn
  WHERE wn.id = node_id
    AND wn.path @> (SELECT path FROM wbs_nodes WHERE id = node_id)
    AND wn.responsible_id IS NOT NULL
  ORDER BY nlevel(wn.path) DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Lectura efectiva de un nodo: administrable, asignado directamente,
-- o ancestro de una tarea asignada para conservar contexto en "Mis tareas".
CREATE OR REPLACE FUNCTION can_read_node(check_user_id UUID, node_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
  node_path LTREE;
BEGIN
  SELECT p.is_admin INTO is_admin FROM profiles p WHERE p.id = check_user_id AND p.status = 'active';
  IF COALESCE(is_admin, FALSE) THEN RETURN TRUE; END IF;

  IF can_manage_node(check_user_id, node_id) THEN RETURN TRUE; END IF;

  SELECT wn.path INTO node_path FROM wbs_nodes wn WHERE wn.id = node_id;
  IF node_path IS NULL THEN RETURN FALSE; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM wbs_nodes assigned
    JOIN task_assignees ta ON ta.task_id = assigned.id
    WHERE ta.user_id = check_user_id
      AND node_path @> assigned.path
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Una dependencia solo se puede crear si el usuario administra algún ancestro común
-- de predecesora y sucesora, o si es admin.
CREATE OR REPLACE FUNCTION can_manage_dependency(check_user_id UUID, predecessor UUID, successor UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
  predecessor_path LTREE;
  successor_path LTREE;
BEGIN
  SELECT p.is_admin INTO is_admin FROM profiles p WHERE p.id = check_user_id AND p.status = 'active';
  IF COALESCE(is_admin, FALSE) THEN RETURN TRUE; END IF;

  SELECT path INTO predecessor_path FROM wbs_nodes WHERE id = predecessor;
  SELECT path INTO successor_path FROM wbs_nodes WHERE id = successor;
  IF predecessor_path IS NULL OR successor_path IS NULL THEN RETURN FALSE; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM wbs_nodes ancestor
    WHERE ancestor.path @> predecessor_path
      AND ancestor.path @> successor_path
      AND ancestor.responsible_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 4.2 Políticas RLS por tabla

```sql
-- ============ wbs_nodes ============
ALTER TABLE wbs_nodes ENABLE ROW LEVEL SECURITY;

-- Lectura: visible si administras el nodo, si eres ejecutor asignado,
-- o si el nodo es ancestro de una tarea asignada (solo lectura contextual)
CREATE POLICY wbs_select ON wbs_nodes FOR SELECT USING (
  can_read_node(app_current_user_id(), id)
);

-- Escritura: solo responsable del ancestro o admin
CREATE POLICY wbs_insert ON wbs_nodes FOR INSERT WITH CHECK (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
  OR can_manage_node(app_current_user_id(), parent_id)
);

CREATE POLICY wbs_update ON wbs_nodes FOR UPDATE USING (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
  OR can_manage_node(app_current_user_id(), id)
);

CREATE POLICY wbs_delete ON wbs_nodes FOR DELETE USING (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
  OR can_manage_node(app_current_user_id(), parent_id)  -- quien controla el padre puede eliminar hijos
);

-- ============ dependencies ============
ALTER TABLE dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY dep_select ON dependencies FOR SELECT USING (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
  OR can_manage_node(app_current_user_id(), predecessor_id)
  OR can_manage_node(app_current_user_id(), successor_id)
);

CREATE POLICY dep_insert ON dependencies FOR INSERT WITH CHECK (
  can_manage_dependency(app_current_user_id(), predecessor_id, successor_id)
);

CREATE POLICY dep_delete ON dependencies FOR DELETE USING (
  can_manage_dependency(app_current_user_id(), predecessor_id, successor_id)
);

-- ============ task_assignees ============
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignee_select ON task_assignees FOR SELECT USING (TRUE); -- visibles para todos

CREATE POLICY assignee_insert ON task_assignees FOR INSERT WITH CHECK (
  can_manage_node(app_current_user_id(), task_id)  -- solo el responsable del padre puede asignar
);

CREATE POLICY assignee_delete ON task_assignees FOR DELETE USING (
  can_manage_node(app_current_user_id(), task_id)
);

-- ============ time_entries ============
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_select ON time_entries FOR SELECT USING (
  user_id = app_current_user_id()
  OR can_manage_node(app_current_user_id(), task_id)
);

CREATE POLICY time_insert ON time_entries FOR INSERT WITH CHECK (
  user_id = app_current_user_id()          -- solo el propio ejecutor puede reportar
  AND EXISTS (
    SELECT 1 FROM task_assignees ta WHERE ta.task_id = time_entries.task_id AND ta.user_id = app_current_user_id()
  )
);

-- ============ projects ============
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY proj_select ON projects FOR SELECT USING (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
  OR created_by = app_current_user_id()
  OR EXISTS (
    SELECT 1 FROM wbs_nodes wn
    WHERE wn.project_id = projects.id
      AND EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = wn.id AND ta.user_id = app_current_user_id())
  )
);

CREATE POLICY proj_insert ON projects FOR INSERT WITH CHECK (app_current_user_id() IS NOT NULL);

CREATE POLICY proj_update ON projects FOR UPDATE USING (
  created_by = app_current_user_id()
  OR (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
);

-- ============ profiles ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY prof_select ON profiles FOR SELECT USING (TRUE);  -- visibles para asignación

CREATE POLICY prof_update_admin ON profiles FOR UPDATE USING (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
);

-- ============ project_types ============
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY ptype_select ON project_types FOR SELECT USING (TRUE);

CREATE POLICY ptype_insert ON project_types FOR INSERT WITH CHECK (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
);

CREATE POLICY ptype_update ON project_types FOR UPDATE USING (
  (SELECT is_admin FROM profiles WHERE id = app_current_user_id())
);
```

---

## 5. Estructura del Proyecto

```
abax-gantt/
├── public/
│   ├── favicon.svg
│   ├── manifest.json                  # PWA manifest
│   └── sw.js                          # Service Worker (PWA)
├── supabase/
│   ├── config.toml
│   ├── migrations/                    # Migraciones SQL versionadas
│   │   ├── 00001_schema.sql
│   │   ├── 00002_rls.sql
│   │   └── 00003_functions.sql
│   ├── seed.sql                       # Datos de prueba
│   └── functions/                     # Edge Functions (Deno + TypeScript)
│       ├── _shared/                   # Utilidades compartidas
│       │   ├── cors.ts
│       │   ├── auth.ts
│       │   ├── db.ts
│       │   ├── validation.ts
│       │   └── errors.ts
│       ├── api-wbs/
│       │   └── index.ts
│       ├── api-wbs-node/
│       │   └── index.ts
│       ├── api-projects/
│       │   └── index.ts
│       ├── api-projects-project/
│       │   └── index.ts
│       ├── api-dependencies/
│       │   └── index.ts
│       ├── api-dependencies-dependency/
│       │   └── index.ts
│       ├── api-assignees/
│       │   └── index.ts
│       ├── api-timesheet/
│       │   └── index.ts
│       ├── api-reports/
│       │   └── index.ts
│       ├── api-kpi/
│       │   └── index.ts
│       ├── api-admin-users/
│       │   └── index.ts
│       ├── api-admin-project-types/
│       │   └── index.ts
│       ├── api-import/
│       │   └── index.ts
│       ├── api-export/
│       │   └── index.ts
│       ├── api-attachments/
│       │   └── index.ts
│       └── api-mcp/
│           └── index.ts
├── src/
│   ├── main.tsx                       # Entry point
│   ├── App.tsx                        # Auth guard + layout raíz
│   ├── vite-env.d.ts
│   ├── index.css                      # TailwindCSS directives + CSS variables
│   │
│   ├── lib/                           # Utilidades y configuración
│   │   ├── api.ts                     # Cliente HTTP tipado para Edge Functions
│   │   ├── auth.ts                    # Cliente OIDC Authentik (oidc-client-ts)
│   │   ├── supabase.ts                # Cliente Supabase solo para service helpers no sensibles
│   │   ├── gantt-adapter.ts           # WBS → DHTMLX data transformer
│   │   ├── gantt-config.ts            # Configuración base de DHTMLX
│   │   ├── gantt-types.ts             # Tipos extendidos para custom properties
│   │   ├── permissions.ts             # Funciones helper de permisos (frontend)
│   │   └── utils.ts                   # date helpers, cn(), formatCurrency, etc.
│   │
│   ├── hooks/                         # Hooks personalizados
│   │   ├── useGantt.ts                # useRef + useEffect para DHTMLX singleton
│   │   ├── useGanttEvents.ts          # Binding de eventos DHTMLX → API mutations
│   │   ├── useWbsTree.ts              # TanStack Query → GET /api/wbs
│   │   ├── useProjects.ts             # TanStack Query → GET /api/projects
│   │   ├── useUsers.ts                # TanStack Query → GET /api/admin/users
│   │   ├── useTaskMutations.ts        # Mutations → POST/PUT/DELETE /api/wbs
│   │   ├── useDependencies.ts         # Mutations → POST/DELETE /api/dependencies
│   │   ├── useTaskAssignees.ts        # Mutations → POST/DELETE /api/assignees
│   │   ├── useProgress.ts             # Mutation → PATCH /api/wbs/:id/progress
│   │   ├── useBudget.ts               # TanStack Query → GET /api/reports
│   │   └── useAuth.ts                 # Auth state (Zustand + Supabase listener)
│   │
│   ├── store/                         # Zustand stores (UI state, NO server state)
│   │   ├── filters.ts                 # Filtros activos en el Gantt
│   │   ├── ui.ts                      # Panel lateral, sidebar, tema
│   │   └── notifications.ts           # Toast/alertas
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx          # Shell principal: toolbar + gantt + paneles
│   │   │   ├── Toolbar.tsx            # Botones de acción principal
│   │   │   ├── KpiBar.tsx             # Indicadores colapsables (US-23)
│   │   │   └── FilterBar.tsx          # Chips de filtro + buscador (US-16)
│   │   │
│   │   ├── gantt/
│   │   │   ├── GanttContainer.tsx     # Wrapper: inyecta datos en DHTMLX
│   │   │   ├── GanttToolbar.tsx       # Zoom, escala, export, fullscreen
│   │   │   └── GanttKeyboardHint.tsx  # Atajos de teclado (footer)
│   │   │
│   │   ├── backlog/
│   │   │   ├── BacklogPanel.tsx       # Panel lateral izquierdo colapsable
│   │   │   ├── BacklogItem.tsx        # Item draggable individual
│   │   │   └── BacklogCreate.tsx      # Input inline para crear en backlog
│   │   │
│   │   ├── detail/
│   │   │   ├── DetailPanel.tsx        # Panel lateral derecho (pestañas)
│   │   │   ├── NodeDetailTab.tsx      # Info general: nombre, fechas, desc
│   │   │   ├── BudgetTab.tsx          # Horas/costo estimado + real (US-20/21)
│   │   │   ├── AssigneesTab.tsx       # Ejecutores asignados (US-11)
│   │   │   ├── DependenciesTab.tsx    # Lista de dependencias
│   │   │   ├── AttachmentsTab.tsx     # Adjuntos (US-05)
│   │   │   └── HistoryTab.tsx         # Historial de cambios (opcional)
│   │   │
│   │   ├── modals/
│   │   │   ├── ProjectTypeModal.tsx   # CRUD tipos de proyecto (US-01, admin)
│   │   │   ├── UserModal.tsx          # Invitar/gestionar usuario (US-02, admin)
│   │   │   ├── NewProjectModal.tsx    # Crear proyecto inline (US-03)
│   │   │   └── AssignResponsible.tsx  # Designar responsable (US-09B)
│   │   │
│   │   └── ui/                        # shadcn/ui componentes base
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── tooltip.tsx
│   │       ├── badge.tsx
│   │       ├── chip.tsx               # Chip de filtro removible
│   │       ├── progress.tsx
│   │       └── avatar.tsx
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx              # Authentik OAuth2/OIDC redirect
│   │   └── GanttPage.tsx             # Vista principal (única pantalla post-login)
│   │
│   └── types/
│       ├── database.ts                # Tipos generados: supabase gen types
│       ├── api.ts                     # Tipos de request/response de Edge Functions
│       ├── wbs.ts                     # WbsNode, NodeType, DepType
│       ├── gantt.ts                   # Tipos de DHTMLX extendidos
│       └── user.ts                    # Profile, UserRole
│
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile
├── nginx.conf
└── README.md
```

---

## 6. Componentes Core — Diseño Detallado

### 6.1 `useGantt` Hook (Singleton DHTMLX)

```typescript
// src/hooks/useGantt.ts
// Responsabilidad: inicializar y destruir la instancia singleton de DHTMLX.
// DHTMLX usa APIs globales (gantt.init, gantt.parse, gantt.clearAll).
// Solo puede haber UNA instancia viva a la vez por contrato de DHTMLX.

import { useEffect, useRef, useCallback } from 'react';
import { gantt } from 'dhtmlx-gantt';

export function useGantt(containerRef: RefObject<HTMLDivElement>) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;

    gantt.init(containerRef.current);
    // Aplicar configuración base desde gantt-config.ts
    applyGanttConfig();
    initialized.current = true;

    return () => {
      gantt.clearAll();
      initialized.current = false;
    };
  }, [containerRef]);

  // ... retornar helpers: parseData, updateTask, addTask, etc.
}
```

### 6.2 `GanttContainer.tsx` (Orquestador principal)

```typescript
// src/components/gantt/GanttContainer.tsx
// Responsabilidad: recibir datos filtrados de TanStack Query y pasarlos a DHTMLX.
// Cuando cambian los datos (filtros, nueva creación), llama gantt.parse().
// Escucha eventos de DHTMLX y dispara mutations a la API (Edge Functions).

interface Props {
  tasks: GanttRow[];
  links: GanttLink[];
}

// Flujo:
// 1. useWbsTree(filters) → TanStack Query → fetch(GET /api/wbs) → Edge Function → PostgreSQL → data
// 2. GanttContainer recibe data, llama gantt.parse({ data: data.tasks, links: data.links })
// 3. Eventos DHTMLX (onAfterTaskUpdate, etc.) → adapter → Api mutation (POST/PUT /api/wbs)
// 4. Mutation exitosa → invalidate TanStack Query → re-fetch → gantt.parse()
```

### 6.3 `BacklogPanel.tsx` (US-10B)

```typescript
// Panel lateral izquierdo. Se abre/colapsa con un botón en la toolbar.
// Muestra solo wbs_nodes con is_unscheduled = TRUE para el proyecto activo.
// Drag & drop con @dnd-kit (NO usa DHTMLX interno, es React puro).

// Al soltar una tarea del backlog en el área del Gantt:
// 1. Calcular start_date basado en la posición X del drop (relativa al timeline)
// 2. Calcular end_date = start_date + duración por defecto (ej. 5 días)
// 3. Mutation: update wbs_node SET is_unscheduled=FALSE, start_date=X, end_date=Y
// 4. Invalidar query → gantt.parse() → la tarea aparece en el Gantt

// Al arrastrar una tarea del Gantt al backlog:
// 1. DHTMLX no soporta drag-out nativo → custom implementation
// 2. Click derecho > "Mover al backlog"
// 3. O shortcut: seleccionar tarea en Gantt + tecla "B"
// 4. Mutation: update wbs_node SET is_unscheduled=TRUE, start_date=NULL, end_date=NULL
```

### 6.4 `DetailPanel.tsx` (US-04, US-20, US-21)

```typescript
// Panel lateral derecho (ancho ~380px). Se abre al:
// - Hacer clic en una fila del grid (selección simple)
// - Hacer clic en una barra del timeline
// - Usar quick info de DHTMLX como fallback en mobile

// Escucha el evento onTaskClick de DHTMLX:
gantt.attachEvent('onTaskClick', (id, e) => {
  const wbsId = gantt.getTask(id).wbs_id; // custom property
  setSelectedNodeId(wbsId);
  openDetailPanel();
});

// Pestañas internas:
// - Información: nombre, descripción, tipo, fechas (editable)
// - Presupuesto: horas estimadas, costo estimado, horas reales
// - Ejecutores: lista de asignados + botón agregar/quitar
// - Dependencias: lista predecesoras/sucesoras
// - Adjuntos: lista de archivos + upload (solo en proyecto)
```

### 6.5 `FilterBar.tsx` + `filters.ts` (Store Zustand)

```typescript
// src/store/filters.ts
interface GanttFilters {
  projectIds: string[];           // UUIDs de proyectos visibles
  projectTypeIds: string[];       // US-01
  responsibleIds: string[];       // Filtrar por responsable
  assigneeIds: string[];          // Filtrar por ejecutor asignado
  status: ('pending' | 'in_progress' | 'completed' | 'delayed')[];
  dateRange: { from: Date; to: Date } | null;
  searchQuery: string;            // Búsqueda por nombre
  myTasksOnly: boolean;           // US-12: toggle "Mis Tareas"
}

// Los filtros se sincronizan con la URL (search params):
// ?projects=id1,id2&responsible=id3&status=in_progress&myTasks=true
// → Al compartir el link, se aplican los mismos filtros.

// Los filtros activos se muestran como chips removibles en FilterBar.
// "Limpiar filtros" resetea todo al default (todos los proyectos visibles).
```

---

## 7. Flujo de Datos por Historia de Usuario

### MVP (Must Have) — 13 historias

| US | Flujo de datos |
|----|----------------|
| **US-02** Gestión usuarios | Admin → modal → `fetch(POST /api/admin/users)` → Edge Function → API SCIM/Admin de Authentik o provisioning manual → upsert `profiles` con `authentik_sub` → invitación/activación desde Authentik |
| **US-03** Crear proyecto | Toolbar "+ Proyecto" → input inline → Enter → `gantt.addTask({...})` → evento `onAfterTaskAdd` → `fetch(POST /api/projects)` → Edge Function → INSERT `projects` + `wbs_nodes` → broadcast Realtime → invalidate query |
| **US-06** Hitos | Click derecho timeline → "Agregar hito" → `gantt.addTask({type:'milestone', ...})` → `onAfterTaskAdd` → `fetch(POST /api/wbs)` |
| **US-07** Etapas | Click derecho proyecto → "Agregar etapa" → `gantt.addTask({type:'stage', ...})` → `fetch(POST /api/wbs)` |
| **US-08** Grupos | Click derecho etapa/grupo → "Agregar grupo" → `gantt.addTask({type:'group', ...})` → `fetch(POST /api/wbs)` |
| **US-09** Tareas | Seleccionar nodo → Enter → input inline → Enter → `gantt.addTask({type:'task', ...})` → `fetch(POST /api/wbs)` |
| **US-09B** Designar responsable | Panel lateral → buscar usuario → seleccionar → `fetch(PUT /api/wbs/:id)` → Edge Function actualiza `responsible_id` |
| **US-10** Dependencias | Drag borde barra → otra barra → DHTMLX crea link → evento `onAfterLinkAdd` → `fetch(POST /api/dependencies)` → Edge Function valida (sin ciclos, ancestro común) → autoscheduling por defecto o alerta si está desactivado |
| **US-10B** Backlog | Panel izquierdo → si hay proyecto enfocado filtra por proyecto; si no agrupa por proyecto → drag item al timeline → calcular fechas → `fetch(PATCH /api/wbs/:id/schedule)` |
| **US-11** Asignar ejecutores | Panel lateral → multi-select usuarios → `fetch(POST /api/assignees)` |
| **US-14/15** Gantt consolidado | Carga inicial: `fetch(GET /api/wbs)` → Edge Function → PostgreSQL → gantt.parse() |
| **US-16** Filtros | Zustand store → al cambiar filtros → TanStack Query refetch con query params → `fetch(GET /api/wbs?project_id=...&responsible_id=...)` → gantt.parse(datosFiltrados) |

### Should Have (v1.1) — 8 historias

| US | Flujo de datos |
|----|----------------|
| **US-01** Tipos proyecto | Admin → modal CRUD → `fetch(POST|PUT /api/admin/project-types)` |
| **US-04** Editar proyecto | Panel lateral → editar campos → onBlur debounced 500ms → `fetch(PUT /api/wbs/:id)` |
| **US-12** Mis tareas | Filtro rápido → Zustand `myTasksOnly = true` → query con `?my_tasks=true&include_ancestors=true` para contexto de solo lectura |
| **US-13** Reportar avance | Ejecutor → clic barra/lista móvil → slider % → `fetch(PATCH /api/wbs/:id/progress)`; endpoint solo acepta `progress` y horas reportadas |
| **US-17** Navegación temporal | DHTMLX zoom nativo (6 niveles) + botón "Hoy" |
| **US-18** Drag & drop | DHTMLX nativo: drag barra entera/drag borde + backlog drag: custom @dnd-kit |
| **US-20** Horas/costo estimado | Panel lateral → campos numéricos → `fetch(PUT /api/wbs/:id)` (campos `estimated_hours`, `estimated_cost`) |
| **US-21** Panel presupuesto | Panel lateral → tab "Presupuesto" → `fetch(GET /api/reports/project/:id/budget)` |

### Could Have (v1.2) — 5 historias

| US | Flujo de datos |
|----|----------------|
| **US-05** Adjuntos | Panel lateral → drag file → `fetch(POST /api/attachments)` (multipart) → Edge Function sube a Supabase Storage |
| **US-19** Vista móvil | CSS media queries + DHTMLX `responsive` config |
| **US-22** Horas reales | Al reportar avance → campo opcional "Horas trabajadas" → `fetch(POST /api/timesheet)` |
| **US-23** KPI bar | Barra superior colapsable → `fetch(GET /api/kpi)` |
| **US-24** Export | DHTMLX nativo: `gantt.exportToPDF()`, `gantt.exportToPNG()`. También `fetch(GET /api/export/project/:id/json)` para server-side. |

---

## 8. Estrategia de Integración DHTMLX ↔ React

### 8.1 Patrón de integración

DHTMLX Gantt **no es un componente React**. Maneja su propio DOM dentro de un `div` contenedor. La integración sigue el patrón:

```
React (estado, ruteo, UI panels)  ←→  DHTMLX Gantt (DOM nativo, estado interno)
         │                                        │
         │  gantt.parse(data)                     │  Eventos (onAfterTaskUpdate,
         │  gantt.updateTask(id, changes)         │           onAfterLinkAdd,
         │  gantt.addTask(obj, parent)            │           onTaskClick, etc.)
         │  gantt.deleteTask(id)                  │
         └────────────────────────────────────────┘
```

### 8.2 Sincronización de datos

```
┌─────────────────┐     ┌──────────────┐     ┌──────────┐
│ TanStack Query  │────▶│ GanttAdapter │────▶│ DHTMLX   │
│ (server state)  │     │ (transform)  │     │ gantt.   │
│                 │     │              │     │ parse()  │
└─────────────────┘     └──────────────┘     └──────────┘
        ▲                                            │
        │         ┌──────────────┐                   │
        │         │ TanStack     │                   │ eventos
        └─────────│ Mutation     │◀──────────────────┘
                  │ (persist)    │  onAfterTaskUpdate
                  └──────┬───────┘  onAfterLinkAdd
                         │           onAfterTaskAdd
                    Edge Function     onAfterTaskDelete
                  (api-wbs, api-     │
                   dependencies)     │
                         │           │
                    PostgreSQL        │
                    (service-role)    │
                         │           │
                    Realtime ────────┘
                    Broadcast
```

### 8.3 Custom properties en DHTMLX

DHTMLX permite propiedades arbitrarias en los objetos `task`. Las usamos para mantener la trazabilidad con la DB:

```typescript
// Propiedades custom que DHTMLX preserva (no las renderiza, pero las almacena):
interface DHTMLXTaskExtended extends DHTMLXTask {
  wbs_id: string;          // UUID real en PostgreSQL
  project_id: string;      // UUID del proyecto al que pertenece
  responsible_name: string; // Para mostrar en el grid
  assignee_names: string;   // Para mostrar en el grid
  estimated_hours: number;
  actual_hours: number;
}
```

### 8.4 Tipos visuales con DHTMLX GPL

```typescript
// DHTMLX GPL usa el tipo base de task y propiedades custom de negocio.
// La diferenciación visual vive en templates/CSS, no en custom task types PRO.
type BusinessNodeType = 'project' | 'stage' | 'group' | 'task' | 'milestone';

// Templates visuales por tipo:
gantt.templates.task_class = (_start, _end, task) => {
  if (task.type === 'milestone') return 'gantt_milestone';
  if (task.type === 'stage') return 'gantt_stage';
  if (task.type === 'group') return 'gantt_group';
  if (task.type === 'project') return 'gantt_project';
  return '';
};

gantt.templates.grid_row_class = (_start, _end, task) => {
  if (task.type === 'project') return 'gantt_row_project';
  if (task.type === 'stage') return 'gantt_row_stage';
  if (task.type === 'group') return 'gantt_row_group';
  return '';
};
```

### 8.5 Undo/Redo con sincronización al backend

DHTMLX tiene undo/redo nativo que opera sobre su estado interno. Al deshacer/rehacer, los eventos `onAfterUndo`/`onAfterRedo` se disparan:

```typescript
gantt.attachEvent('onAfterUndo', () => {
  // DHTMLX ya revirtió el cambio en su estado interno.
  // Opción: invalidar la query y re-parse desde la API.
  queryClient.invalidateQueries({ queryKey: ['wbsTree'] });
});
```

**Decisión arquitectónica:** Para el MVP, Undo/Redo operará solo del lado DHTMLX. Al hacer undo/redo, se invalida la query y se re-parsea desde la API (Edge Functions), descartando el estado local de DHTMLX. En v1.1 se puede implementar un sistema de comandos reversible con mutations optimistas.

---

## 9. Estado Global (Zustand Stores)

### 9.1 `authStore`

```typescript
interface AuthState {
  user: Profile | null;
  oidcUser: OidcUser | null;
  accessToken: string | null;
  groups: string[];
  isLoading: boolean;
  isAdmin: boolean;
  setOidcUser: (user: OidcUser | null) => void;
  setProfile: (profile: Profile | null) => void;
}
```

Inicializado en `App.tsx` con `oidc-client-ts` (`UserManager.events.addUserLoaded`, `addUserUnloaded`, `signinRedirect`, `signoutRedirect`). El store conserva el perfil local de la app (`profiles`) y los claims OIDC necesarios (`sub`, `email`, `groups`, `exp`).

### 9.2 `filterStore`

```typescript
interface FilterState {
  projectIds: string[];
  projectTypeIds: string[];
  responsibleIds: string[];
  assigneeIds: string[];
  statusFilter: string[];
  dateRange: { from: string; to: string } | null;
  searchQuery: string;
  myTasksOnly: boolean;

  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
  toggleMyTasks: () => void;
  syncFromUrl: () => void;
  syncToUrl: () => void;
}
```

Los filtros se serializan a URL search params para compartir vistas. Al cargar la página, se restauran desde la URL.

### 9.3 `uiStore`

```typescript
interface UIState {
  isBacklogOpen: boolean;
  isDetailOpen: boolean;
  selectedNodeId: string | null;
  detailTab: 'info' | 'budget' | 'assignees' | 'dependencies' | 'attachments' | 'history';
  isKpiBarOpen: boolean;
  isFullscreen: boolean;

  toggleBacklog: () => void;
  openDetail: (nodeId: string, tab?: string) => void;
  closeDetail: () => void;
  toggleKpiBar: () => void;
}
```

---

## 10. TanStack Query — Hooks Principales

### 10.1 `useWbsTree`

```typescript
// Query key: ['wbsTree', filters]
// Query fn: GET /api/wbs?project_id=...&my_tasks=true&unscheduled=false
// Stale time: 5 minutos
// Refetch on window focus: false (Realtime se encarga de actualizaciones)

function useWbsTree(filters: GanttFilters) {
  return useQuery({
    queryKey: ['wbsTree', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.projectIds.length) params.set('project_id', filters.projectIds.join(','));
      if (filters.responsibleIds.length) params.set('responsible_id', filters.responsibleIds.join(','));
      if (filters.myTasksOnly) params.set('my_tasks', 'true');
      if (filters.dateRange) {
        params.set('from', filters.dateRange.from.toISOString());
        params.set('to', filters.dateRange.to.toISOString());
      }
      if (filters.searchQuery) params.set('search', filters.searchQuery);
      // Edge Function aplica RLS + service-role para filtrado server-side
      const data = await wbsApi.list(params);
      return transformToGanttData(data); // adaptador → GanttRow[] + GanttLink[]
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### 10.2 `useTaskMutations`

```typescript
function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWbsInput) => wbsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wbsTree'] }),
  });
}

function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<WbsNode> }) =>
      wbsApi.update(id, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wbsTree'] }),
  });
}

function useScheduleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dates }: { id: string; dates: { start_date: string; end_date: string } }) =>
      wbsApi.schedule(id, dates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wbsTree'] }),
  });
}

// Patrón de uso con DHTMLX:
// 1. DHTMLX emite onAfterTaskUpdate(id, changes)
// 2. Extraemos wbs_id de gantt.getTask(id).wbs_id
// 3. Llamamos updateTask({ id: wbs_id, changes: mapearCambios(changes) })
// 4. La Edge Function valida en server-side y persiste
```

### 10.3 `useDependencies`

```typescript
function useAddDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dep: { predecessor_id: string; successor_id: string; type: DepType }) =>
      dependenciesApi.create(dep),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wbsTree'] }),
    onError: (error) => {
      // La Edge Function valida reglas de negocio (no ciclos, ancestro común)
      toast.error(error.message);
    },
  });
}

function useDeleteDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dependenciesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wbsTree'] }),
  });
}
```

---

## 11. Configuración de DHTMLX Gantt (detallada)

### 11.1 Configuración base (`src/lib/gantt-config.ts`)

```typescript
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

export function applyGanttConfig() {
  // ── Formato de fechas ──
  gantt.config.date_format = '%Y-%m-%d';
  gantt.config.duration_unit = 'day';
  gantt.config.work_time = true;          // solo días hábiles (lun-vie)
  gantt.config.skip_off_time = true;
  gantt.config.duration_step = 1;

  // ── Layout ──
  gantt.config.layout = {
    css: 'gantt_container',
    cols: [
      { name: 'grid', width: 55, min_width: 300, max_width: 600, scrollable: true },
      { name: 'timeline', width: '*', scrollable: true },
    ],
  };

  // ── Grid ──
  gantt.config.grid_width = 450;
  gantt.config.min_grid_column_width = 50;
  gantt.config.row_height = 36;
  gantt.config.scale_height = 60;
  gantt.config.fit_tasks = true;

  // ── Columnas del grid ──
  gantt.config.columns = [
    { name: 'text',       label: 'Nombre',  tree: true, width: 280, resize: true },
    { name: 'start_date', label: 'Inicio',  width: 100, align: 'center', resize: true },
    { name: 'duration',   label: 'Días',    width: 60,  align: 'center', resize: true },
    { name: 'progress',   label: '%',       width: 60,  align: 'center', resize: true,
      template: (t: { progress?: number }) => `${Math.round((t.progress || 0) * 100)}%` },
    { name: 'add',        label: '',        width: 36,  resize: false },
  ];

  // ── Auto-scheduling ──
  gantt.config.auto_scheduling = true;
  gantt.config.auto_scheduling_strict = true;
  gantt.config.auto_scheduling_initial = false;
  gantt.config.auto_scheduling_move_projects = true;
  gantt.config.auto_scheduling_descendant_links = true;

  // ── Dependencias ──
  gantt.config.drag_links = true;
  gantt.config.show_links = true;
  gantt.config.links_drag_in_band = true;   // drag desde cualquier punto de la barra

  // ── Undo ──
  gantt.config.undo = true;
  gantt.config.undo_steps = 50;
  gantt.config.undo_types = { link: 'link', task: 'task' };
  gantt.config.undo_actions = { update: 'update', remove: 'remove', add: 'add' };

  // ── Critical path ──
  gantt.config.highlight_critical_path = true;

  // ── Marcadores ──
  gantt.config.show_markers = true;
  // Agregar marcador "Hoy":
  gantt.addMarker({
    start_date: new Date(),
    css: 'today',
    text: 'Hoy',
    title: 'Fecha actual',
  });

  // ── Quick info ──
  gantt.config.show_quick_info = true;
  gantt.config.quick_info_detached = false;

  // ── Keyboard ──
  gantt.config.keyboard_navigation = true;
  gantt.config.keyboard_navigation_cells = true;

  // ── Touch para mobile ──
  gantt.config.touch = true;
  gantt.config.touch_drag = 500;

  // ── Tipos visuales GPL ──
  // No se usan custom task types PRO. El campo task.type se mantiene como
  // propiedad de negocio y los templates/CSS definen la apariencia.

  // ── Zoom extension ──
  gantt.ext.zoom.init({
    levels: [
      {
        name: 'Hora',
        scale_height: 50,
        min_column_width: 60,
        scales: [
          { unit: 'day', step: 1, format: '%d %M %Y' },
          { unit: 'hour', step: 2, format: '%H:00' },
        ],
      },
      {
        name: 'Día',
        scale_height: 50,
        min_column_width: 40,
        scales: [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'day', step: 1, format: '%d' },
        ],
      },
      {
        name: 'Semana',
        scale_height: 50,
        min_column_width: 28,
        scales: [
          { unit: 'month', step: 1, format: '%F %Y' },
          { unit: 'week', step: 1, format: 'Sem %W' },
        ],
      },
      {
        name: 'Mes',
        scale_height: 60,
        min_column_width: 60,
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 1, format: '%F' },
        ],
      },
      {
        name: 'Trimestre',
        scale_height: 60,
        min_column_width: 30,
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 3, format: '%F' },
        ],
      },
      {
        name: 'Año',
        scale_height: 60,
        min_column_width: 80,
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
        ],
      },
    ],
  });

  // ── Templates visuales ──
  gantt.templates.task_class = (_start, _end, task) => {
    if (task.type === 'milestone') return 'gantt_milestone';
    if (task.type === 'stage') return 'gantt_stage';
    if (task.type === 'group') return 'gantt_group';
    if (task.type === 'project') return 'gantt_project';
    return '';
  };

  gantt.templates.grid_row_class = (_start, _end, task) => {
    if (task.type === 'project') return 'gantt_row_project';
    if (task.type === 'stage') return 'gantt_row_stage';
    if (task.type === 'group') return 'gantt_row_group';
    return '';
  };

  gantt.templates.rightside_text = () => '';

  // ── Tooltip ──
  gantt.templates.tooltip_text = (_start, _end, task) => {
    const tipo = {
      project: 'Proyecto', milestone: 'Hito', task: 'Tarea',
      stage: 'Etapa', group: 'Grupo',
    }[task.type] || 'Tarea';
    return `<b>${task.text}</b><br/>Tipo: ${tipo}<br/>Duración: ${task.duration || 0}d<br/>Progreso: ${Math.round((task.progress || 0) * 100)}%`;
  };

  // ── Progress template: auto-cálculo de progreso para padres ──
  gantt.templates.progress = (task) => {
    if (task.type === 'project' || task.type === 'stage' || task.type === 'group') {
      // Calcular progreso como promedio ponderado de hijos
      const children = gantt.getChildren(task.id);
      if (children.length === 0) return task.progress || 0;
      let totalDuration = 0;
      let weightedProgress = 0;
      children.forEach((childId: string) => {
        const child = gantt.getTask(childId);
        const dur = child.duration || 1;
        totalDuration += dur;
        weightedProgress += (child.progress || 0) * dur;
      });
      return totalDuration > 0 ? weightedProgress / totalDuration : 0;
    }
    return task.progress || 0;
  };
}
```

---

## 12. Plan de Implementación Detallado

### Fase 0 — Setup (Semana 1-2)

| Tarea | Descripción | Output |
|-------|-------------|--------|
| 0.1 | Inicializar proyecto Vite + React + TypeScript | `package.json`, `vite.config.ts`, `tsconfig.json` |
| 0.2 | Instalar dependencias: dhtmlx-gantt, @supabase/supabase-js, zustand, @tanstack/react-query, tailwindcss, shadcn/ui, @dnd-kit | `node_modules` |
| 0.3 | Configurar TailwindCSS + shadcn/ui con dark theme (CSS variables) | `tailwind.config.ts`, `index.css` |
| 0.4 | Crear proyecto Supabase + ejecutar migraciones schema.sql | Tablas: profiles, projects, wbs_nodes, dependencies, task_assignees, time_entries, attachments, project_types |
| 0.5 | Implementar políticas RLS completas | Seguridad activa |
| 0.6 | Configurar Authentik OAuth2/OIDC (Authorization Code + PKCE): provider, client_id, redirect URI, scopes `openid email profile groups` | Login funcional |
| 0.7 | Configurar Supabase CLI local (`supabase init`, `supabase start`) | Entorno local con DB + Edge Functions |
| 0.8 | Implementar `_shared/` (cors, auth, db, validation, errors) | Base para todas las Edge Functions |
| 0.9 | Implementar `src/lib/api.ts` — cliente HTTP tipado para Edge Functions | `apiFetch`, `wbsApi`, `projectsApi`, etc. |
| 0.10 | Implementar `gantt-config.ts` con configuración base | Config lista |
| 0.11 | Layout base: `AppLayout.tsx` con toolbar + contenedor Gantt vacío | Shell visible |
| 0.12 | `useAuth` hook + Zustand `authStore` funcionando | Auth state global |

### Fase 1 — API Core (Semanas 2-3)

| Tarea | Descripción | Output |
|-------|-------------|--------|
| 1.1 | Edge Function `api-projects`: GET/POST proyectos | CRUD proyectos vía API |
| 1.2 | Edge Function `api-wbs`: GET/POST nodos WBS | CRUD WBS vía API |
| 1.3 | Edge Function `api-wbs-node`: GET/PUT/DELETE nodo individual | Operaciones sobre un nodo |
| 1.4 | Edge Function `api-dependencies`: GET/POST/DELETE dependencias | Gestión de dependencias vía API |
| 1.5 | Edge Function `api-assignees`: POST/DELETE ejecutores | Asignación vía API |
| 1.6 | `useWbsTree` + `useProjects` hooks conectados a API (no a Supabase directo) | Hooks funcionales |
| 1.7 | Verificar que todas las Edge Functions validan JWT de Authentik vía JWKS y aplican service-role para DB | Auth en API verificado |

### Fase 2 — Proyectos y Gantt (Semanas 3-4)

| Tarea | US | Output |
|-------|----|--------|
| 2.1 | US-03: Botón "+ Proyecto" → input inline → crear proyecto vía API | `useCreateProject` mutation → `POST /api/projects` |
| 2.2 | US-03: El creador queda como responsible_id automáticamente | Lógica en Edge Function `api-projects` |
| 2.3 | US-14/15: Carga inicial del Gantt consolidado vía API | `useWbsTree` → `GET /api/wbs` |
| 2.4 | `gantt-adapter.ts`: transformación WBS → DHTMLX | Adaptador completo con custom types |
| 2.5 | Wrapper React: `GanttContainer.tsx` con `useGantt` hook | Componente funcional |
| 2.6 | Sincronización de eventos DHTMLX → API mutations | `useGanttEvents` hook |

### Fase 3 — WBS (Semanas 5-7)

| Tarea | US | Output |
|-------|----|--------|
| 2.1 | US-09: Insert/Enter para crear tarea → `gantt.addTask()` | Atajos de teclado + mutation |
| 2.2 | US-09: Input inline de nombre (ya lo da DHTMLX con F2/doble clic) | Nativo |
| 2.3 | US-07: Click derecho → "Agregar etapa" → custom context menu | Context menu handler |
| 2.4 | US-08: Click derecho → "Agregar grupo" | Context menu handler |
| 2.5 | US-06: Click derecho en timeline → "Agregar hito" | Context menu en timeline |
| 2.6 | US-09B: Panel lateral → buscar usuario → designar responsable | `AssignResponsible.tsx` modal |
| 2.7 | US-09B: Lógica de herencia de permisos (frontend + backend) | `effective_responsible()` SQL + helper frontend |
| 2.8 | US-10: Dependencias nativas DHTMLX (drag-to-create) | Ya funciona nativo con `drag_links: true` |
| 2.9 | US-10: Persistir dependencias vía `onAfterLinkAdd` | Mutation vía `POST /api/dependencies` |
| 2.10 | US-10B: `BacklogPanel.tsx` con lista de tareas unscheduled → `GET /api/wbs?unscheduled=true` | Componente React + @dnd-kit |
| 2.11 | US-10B: Drag backlog → Gantt → programar fechas → `PATCH /api/wbs/:id/schedule` | Calcular fecha desde coordenada de drop |
| 2.12 | US-10B: Drag Gantt → backlog → desprogramar → `PATCH /api/wbs/:id/schedule` | Botón derecho "Mover al backlog" |

### Fase 4 — Detalle y Asignación (Semanas 8-9)

| Tarea | US | Output |
|-------|----|--------|
| 3.1 | US-04: `DetailPanel.tsx` con tabs (info, presupuesto, asignados, dependencias) | Panel lateral React |
| 3.2 | US-04: Sincronización selección Gantt → panel detalle | `onTaskClick` → `uiStore.openDetail()` |
| 3.3 | US-04: Edición inline de campos en el panel lateral (autosave 500ms) | Debounced mutations |
| 3.4 | US-11: Tab "Ejecutores" en panel lateral → multi-select usuarios | `AssigneesTab.tsx` + mutation |
| 3.5 | US-11: Mostrar nombre/avatar de ejecutor en grid/barra del Gantt | Template custom en columnas |
| 3.6 | US-13: Slider de progreso en panel lateral (ejecutor o responsable) | Slider 0-100 → mutation progress |

### Fase 5 — Filtros y Navegación (Semanas 10-11)

| Tarea | US | Output |
|-------|----|--------|
| 4.1 | US-16: `FilterBar.tsx` con chips de filtro | Componente React |
| 4.2 | US-16: `filterStore.ts` (Zustand) + sincronización URL | Estado + URL search params |
| 4.3 | US-16: Re-query vía API al cambiar filtros → `GET /api/wbs?project_id=...&responsible_id=...` | `useWbsTree` con query key dinámica |
| 4.4 | US-12: Toggle "Mis tareas" | `myTasksOnly` en filterStore |
| 4.5 | US-17: Zoom y navegación (DHTMLX nativo) | Ya implementado en gantt-config |
| 4.6 | US-18: Drag & drop de barras (DHTMLX nativo) | Ya funciona con `drag_resize`, `drag_move` |
| 4.7 | US-18: Validación de dependencias al mover | Advertencia si se viola dependencia |

### Fase 6 — Admin, Presupuesto y MCP (Semanas 12-13)

| Tarea | US | Output |
|-------|----|--------|
| 5.1 | US-01: CRUD tipos de proyecto (admin) → `GET/POST/PUT /api/admin/project-types` | `ProjectTypeModal.tsx` |
| 5.2 | US-02: CRUD usuarios (admin) → `GET/POST/PUT /api/admin/users` | `UserModal.tsx` |
| 5.3 | US-20: Campos horas/costo estimado en panel lateral → `PUT /api/wbs/:id` | `BudgetTab.tsx` |
| 5.4 | US-21: Panel presupuesto con totales y desviación → `GET /api/reports/project/:id/budget` | Edge Function `api-reports` |
| 5.5 | US-22: Campo "Horas trabajadas" al reportar avance → `POST /api/timesheet` | Edge Function `api-timesheet` |
| 5.6 | MCP: Edge Function `api-mcp` con recursos y tools | `api-mcp/index.ts` funcional |

### Fase 7 — KPIs, Export, Móvil, Adjuntos (Semanas 14-15)

| Tarea | US | Output |
|-------|----|--------|
| 6.1 | US-23: `KpiBar.tsx` con widgets cliqueables | Componente colapsable |
| 6.2 | US-24: Botón Export en toolbar (PDF, PNG nativos DHTMLX) | Handler export |
| 6.3 | US-19: Media queries + layout responsive | CSS responsive |
| 6.4 | US-19: Reducir columnas grid en mobile | Config condicional por viewport |
| 6.5 | US-05: Subida de archivos a Supabase Storage | `AttachmentsTab.tsx` |
| 6.6 | PWA: manifest.json + service worker | Instalable en mobile |

---

## 13. Dependencias NPM

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "dhtmlx-gantt": "^9.1.4",
    "@supabase/supabase-js": "^2.86.0",
    "oidc-client-ts": "^3.0.0",
    "jose": "^5.0.0",
    "react-router": "^7.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^5.0.0",
    "zod": "^4.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^5.0.0",
    "@dnd-kit/core": "^6.0.0",
    "@dnd-kit/sortable": "^8.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "lucide-react": "^0.500.0",
    "date-fns": "^4.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^3.0.0",
    "sonner": "^2.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~5.8.0",
    "vite": "^7.0.0",
    "tailwindcss": "^4.0.0",
    "supabase": "^2.0.0"
  }
}
```

---

## 14. Riesgos Técnicos y Mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|------------|
| DHTMLX GPL no cubre una interacción avanzada esperada | Media | Medio | Diseñar el MVP sobre capacidades GPL verificadas. Resolver diferencias con templates/CSS, paneles React y lógica server-side mínima; no depender de Resource Management ni custom task types PRO. |
| Configuración incorrecta de Authentik/OIDC | Media | Alto | Validar issuer, audience, redirect URI y JWKS desde Fase 0. Agregar test de Edge Function que rechace tokens con issuer/audience inválidos. |
| Cold start de Edge Functions | Alta | Bajo | Supabase Edge Functions tienen cold start ~200ms en el peor caso. Usar `staleTime` agresivo (5 min) en TanStack Query para minimizar llamadas. Warm-up via health check desde el frontend al montar. |
| ltree en PostgreSQL no soportado por Supabase | Baja | Alto | Alternativa: CTE recursivo para calcular árbol en lugar de ltree. Más lento pero funcional. Supabase sí soporta ltree. |
| DHTMLX eventos asíncronos vs React render cycle | Media | Medio | Usar `gantt.batchUpdate()` para cambios múltiples. Evitar `gantt.parse()` en cada mutación pequeña; preferir `gantt.updateTask()`. |
| Bundle size (DHTMLX ~600KB gzip) | Alta | Medio | Code-splitting: lazy load del Gantt. La página de login no carga DHTMLX. Preload con `<link rel="modulepreload">`. |
| Rendimiento con >1000 tareas | Media | Medio | DHTMLX virtualiza filas del grid. Paginar/filtrar proyectos grandes. Cargar solo proyectos expandidos. |
| Colisiones en edición concurrente | Baja | Alto | Supabase Realtime para broadcast de cambios. Optimistic updates con TanStack Query. Último en escribir gana (last-write-wins). |
| Edge Function excede timeout (10s en plan free) | Baja | Medio | Operaciones pesadas (import, export) se procesan asíncronamente con webhooks de callback. |
| Curva de aprendizaje DHTMLX para el equipo | Alta | Medio | Documentación extensa + API consistente. El POC actual ya tiene ejemplos funcionales para todas las features core. |

---

## 15. Convenciones de Código

### 15.1 Nombrado
- **Archivos:** PascalCase para componentes (`GanttContainer.tsx`), camelCase para hooks/utilidades (`useGantt.ts`, `gantt-adapter.ts`)
- **Funciones:** camelCase (`transformToGanttData`, `handleTaskUpdate`)
- **Interfaces/Tipos:** PascalCase (`WbsNode`, `GanttRow`, `FilterState`)
- **Variables de estado:** camelCase (`selectedNodeId`, `isBacklogOpen`)

### 15.2 Estructura de componentes
```typescript
// 1. Imports (React, libs, locales)
// 2. Tipos/Interfaces locales
// 3. Constantes
// 4. Componente principal (export default function)
//    - Hooks (Zustand, TanStack Query, useState, useRef)
//    - Efectos (useEffect para DHTMLX)
//    - Handlers (handleXxx)
//    - JSX (return)
// 5. Sub-componentes (si son pequeños y privados)
```

### 15.3 Mutations (TanStack Query)

```typescript
// Todas las mutations siguen este patrón:
// 1. mutationFn: llamada al cliente api.ts (→ Edge Function → PostgreSQL)
// 2. onSuccess: invalidateQueries + toast success
// 3. onError: toast error con mensaje descriptivo (la Edge Function retorna errores estructurados)
// 4. onSettled: limpiar estado de loading
```

### 15.4 CSS
- TailwindCSS para layout, espaciado, tipografía, colores base
- CSS Modules o `style` inline para overrides específicos de DHTMLX (que requiere selectores de clase específicos)
- Variables CSS para theming (`--bg`, `--text`, `--border`, etc.) desde Tailwind config

---

## 16. Testing

### 16.1 Unit Tests (Vitest)

- `gantt-adapter.ts`: transformación de datos WBS → DHTMLX (entrada/salida)
- `api.ts`: funciones de fetch con mock de Edge Functions
- `permissions.ts`: lógica de cálculo de `effectiveResponsible`
- Stores de Zustand: filtros, UI state
- Edge Functions `_shared/`: auth, validation con Deno test (`deno test`)

### 16.2 Integration Tests

- **Edge Functions:** `deno test` con Supabase local + seed data
- **Frontend:** Playwright — flujo auth → ver Gantt consolidado → crear proyecto vía API → crear tarea → asignar ejecutor
- Flujo de permisos: usuario sin permiso recibe 403 de la Edge Function

### 16.3 E2E Tests (Playwright)

- Happy path completo: auth → proyecto → WBS completo → backlog → drag → dependencias → reportar avance → export
- Mobile responsive: verificar que la vista móvil funciona en viewport de 375px

---

## 17. Despliegue

### 17.1 Entornos

| Entorno | URL | Rama | Supabase | Edge Functions |
|---------|-----|------|----------|----------------|
| Development | localhost:5173 | `main` | Supabase Local (Docker) | Local (`supabase functions serve`) |
| Staging | staging.app.dominio.com | `staging` | Supabase Staging Project | Deploy staging |
| Production | app.dominio.com | `production` | Supabase Production Project | Deploy production |

### 17.2 CI/CD (GitHub Actions)

1. Push a `main` → lint + typecheck + test (frontend + Edge Functions)
2. Push a `staging` → `supabase functions deploy` (staging) + build frontend + deploy Vercel/Netlify staging
3. Tag `v*` → `supabase functions deploy` (production) + build frontend + deploy Vercel/Netlify production

### 17.3 Comandos de desarrollo

```bash
# Desarrollo local completo
supabase start                          # PostgreSQL + Storage locales (Supabase Auth no se usa)
supabase functions serve                # Edge Functions en localhost:54321
npm run dev                             # Vite dev server

# Deploy de Edge Functions
supabase functions deploy api-wbs
supabase functions deploy api-projects
# ... o todas juntas:
supabase functions deploy

# Deploy de migraciones
supabase db push
```

### 17.4 Variables de entorno Authentik

Frontend (`.env`):

```bash
VITE_AUTHENTIK_ISSUER=https://auth.example.com/application/o/abax-gantt/
VITE_AUTHENTIK_CLIENT_ID=abax-gantt-spa
VITE_AUTHENTIK_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/login
VITE_SUPABASE_URL=https://<project>.supabase.co
```

Edge Functions (`supabase secrets set`):

```bash
AUTHENTIK_ISSUER=https://auth.example.com/application/o/abax-gantt/
AUTHENTIK_CLIENT_ID=abax-gantt-spa
AUTHENTIK_JWKS_URL=https://auth.example.com/application/o/abax-gantt/jwks/
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### 17.5 Docker (para self-hosting opcional)

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## 18. Glosario Técnico

| Término | Definición |
|---------|------------|
| **WBS** | Work Breakdown Structure — estructura jerárquica proyecto→etapa→grupo→tarea→sub-tarea |
| **RLS** | Row Level Security — seguridad a nivel de fila en PostgreSQL/Supabase |
| **Authentik** | Proveedor de identidad self-hosted que expone OAuth2/OIDC, grupos, MFA y políticas de acceso. Es la fuente de verdad de autenticación del sistema. |
| **OIDC** | OpenID Connect — capa de identidad sobre OAuth2. La app usa Authorization Code + PKCE para login seguro en SPA. |
| **ltree** | Extensión PostgreSQL para almacenar y consultar paths jerárquicos (ej. `a.b.c.d`) |
| **DHTMLX** | Librería comercial de diagramas Gantt en JavaScript |
| **Backlog** | Lista de tareas sin fechas asignadas, esperando ser programadas en el Gantt |
| **Responsable** | Usuario que administra un nodo del WBS y toda su descendencia |
| **Ejecutor** | Usuario asignado para realizar el trabajo de una tarea (no tiene permisos de administración) |
| **Auto-scheduling** | Reajuste automático de fechas de tareas dependientes cuando se mueve una predecesora |
| **Critical path** | Ruta más larga de tareas dependientes que determina la duración total del proyecto |
| **TanStack Query** | Librería de gestión de estado servidor (caching, re-fetching, mutations) |
| **Zustand** | Librería de estado global para React (UI state, filtros, preferencias) |
| **Edge Function** | Función serverless en Supabase que corre sobre Deno, distribuida globalmente. Actúa como API REST entre el frontend y PostgreSQL. |
| **Service Role Key** | Clave de Supabase con acceso total a la base de datos, bypassea RLS. Solo se usa en Edge Functions (nunca en el frontend). |
| **MCP** | Model Context Protocol — protocolo estándar para que agentes de IA interactúen con herramientas y datos. La Edge Function `api-mcp` expone recursos y tools del proyecto vía MCP. |
| **JWT** | JSON Web Token — token de autenticación que el frontend envía a las Edge Functions en el header `Authorization: Bearer <token>`. |
| **PWA** | Progressive Web App — app web instalable con capacidades offline vía service worker |

---

*Documento elaborado como referencia técnica completa para el equipo de desarrollo. Cubre todas las 24 historias de usuario, los hallazgos del POC, y define la arquitectura, modelos de datos, componentes, flujos de datos, seguridad, testing y despliegue.*
