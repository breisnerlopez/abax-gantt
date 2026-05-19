import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, okResponse } from "../_shared/errors.ts";

interface McpRequest {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: string;
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

function verifyApiKey(req: Request): boolean {
  const key = req.headers.get("X-API-Key");
  const expected = Deno.env.get("MCP_API_KEY");
  if (!expected) return false;
  return key === expected;
}

async function listProjects(): Promise<McpResponse["result"]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("projects")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new ApiError(500, error.message);
  return { projects: data, count: data?.length ?? 0 };
}

async function getProjectWbs(projectId: string): Promise<McpResponse["result"]> {
  const db = getServiceClient();
  const { data: project, error: projError } = await db
    .from("projects")
    .select("id, name, status, budget_total")
    .eq("id", projectId)
    .single();
  if (projError || !project) throw new ApiError(404, "Proyecto no encontrado");

  const { data: nodes, error: nodesError } = await db
    .from("wbs_nodes")
    .select("id, name, type, start_date, end_date, progress, estimated_hours, estimated_cost, responsible_id, is_unscheduled, parent_id, path")
    .eq("project_id", projectId)
    .order("path", { ascending: true });
  if (nodesError) throw new ApiError(500, nodesError.message);

  const { data: deps, error: depsError } = await db
    .from("dependencies")
    .select("*")
    .or(nodes && nodes.length > 0
      ? `predecessor_id.in.(${nodes.map((n) => n.id).join(",")}),successor_id.in.(${nodes.map((n) => n.id).join(",")})`
      : "id.is.null");
  if (depsError) throw new ApiError(500, depsError.message);

  return {
    project,
    wbs_nodes: nodes,
    dependencies: deps,
    node_count: nodes?.length ?? 0,
    dependency_count: deps?.length ?? 0,
  };
}

async function getSummary(): Promise<McpResponse["result"]> {
  const db = getServiceClient();
  const { data: projects, error: projError } = await db
    .from("projects")
    .select("id, name, status, budget_total");
  if (projError) throw new ApiError(500, projError.message);

  const activeProjects = (projects ?? []).filter((p) => p.status === "active");

  const { data: milestones, error: msError } = await db
    .from("wbs_nodes")
    .select("id, name, project_id, start_date")
    .eq("type", "milestone")
    .gte("start_date", new Date().toISOString().slice(0, 10))
    .lte("start_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(10);
  if (msError) throw new ApiError(500, msError.message);

  const { count: taskCount, error: countError } = await db
    .from("wbs_nodes")
    .select("*", { count: "exact", head: true })
    .eq("type", "task");
  if (countError) throw new ApiError(500, countError.message);

  return {
    active_projects: activeProjects.length,
    total_projects: projects?.length ?? 0,
    total_tasks: taskCount ?? 0,
    upcoming_milestones: milestones ?? [],
  };
}

async function createTask(params: Record<string, unknown>): Promise<McpResponse["result"]> {
  const db = getServiceClient();
  const projectId = params.project_id as string;
  const name = params.name as string;

  if (!projectId || !name) throw new ApiError(400, "project_id y name son requeridos");

  const nodeId = crypto.randomUUID();
  const { data, error } = await db
    .from("wbs_nodes")
    .insert({
      id: nodeId,
      project_id: projectId,
      name,
      type: (params.type as string) ?? "task",
      description: params.description,
      start_date: params.start_date ?? null,
      end_date: params.end_date ?? null,
      is_unscheduled: !params.start_date,
      created_by: params.created_by ?? null,
      path: `n_${nodeId.replaceAll("-", "_")}`,
    })
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);
  return data;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (!verifyApiKey(req)) {
      return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "API Key invalida" } }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: McpRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.method === "initialize") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "abax-gantt-mcp", version: "0.1.0" },
        },
      }, { headers: corsHeaders });
    }

    if (body.method === "tools/list") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "list_projects",
              description: "Lista todos los proyectos del portafolio",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "get_project_wbs",
              description: "Obtiene el WBS completo de un proyecto con dependencias",
              inputSchema: {
                type: "object",
                properties: { project_id: { type: "string", description: "UUID del proyecto" } },
                required: ["project_id"],
              },
            },
            {
              name: "get_summary",
              description: "Obtiene un resumen ejecutivo del portafolio",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "create_task",
              description: "Crea una tarea en un proyecto",
              inputSchema: {
                type: "object",
                properties: {
                  project_id: { type: "string", description: "UUID del proyecto" },
                  name: { type: "string", description: "Nombre de la tarea" },
                  type: { type: "string", description: "Tipo: task, milestone, stage, group" },
                  start_date: { type: "string", description: "Fecha inicio YYYY-MM-DD" },
                  end_date: { type: "string", description: "Fecha fin YYYY-MM-DD" },
                  description: { type: "string", description: "Descripcion" },
                },
                required: ["project_id", "name"],
              },
            },
          ],
        },
      }, { headers: corsHeaders });
    }

    if (body.method === "tools/call") {
      const params = body.params as { name: string; arguments?: Record<string, unknown> };
      let result: McpResponse["result"];

      switch (params?.name) {
        case "list_projects":
          result = await listProjects();
          break;
        case "get_project_wbs":
          result = await getProjectWbs(params.arguments?.project_id as string);
          break;
        case "get_summary":
          result = await getSummary();
          break;
        case "create_task":
          result = await createTask(params.arguments ?? {});
          break;
        default:
          return Response.json({
            jsonrpc: "2.0", id: body.id,
            error: { code: -32601, message: `Tool desconocida: ${params?.name}` },
          }, { headers: corsHeaders });
      }

      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: JSON.stringify(result) }] },
      }, { headers: corsHeaders });
    }

    return Response.json({
      jsonrpc: "2.0", id: body.id,
      error: { code: -32601, message: `Metodo no soportado: ${body.method}` },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("MCP error:", error);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32603, message: "Error interno MCP" },
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
