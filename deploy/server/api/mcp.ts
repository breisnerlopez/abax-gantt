import { getClient } from "./_shared/db.ts";
import { handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { ApiError } from "./_shared/errors.ts";

const MCP_API_KEY = Deno.env.get("MCP_API_KEY") || "";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const apiKey = req.headers.get("X-API-Key");
    if (!MCP_API_KEY || apiKey !== MCP_API_KEY) {
      return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" } }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const body = await req.json();
    const { method, id, params } = body as { method: string; id: number; params?: { name?: string; arguments?: Record<string,unknown> } };

    const db = getClient();

    if (method === "initialize") {
      return okResponse({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "abax-gantt-mcp", version: "1.0.0" } } });
    }

    if (method === "tools/list") {
      return okResponse({ jsonrpc: "2.0", id, result: { tools: [
        { name: "list_projects", description: "Lista todos los proyectos visibles (admin)", inputSchema: { type: "object", properties: {}, required: [] } },
        { name: "get_project_wbs", description: "Obtiene el arbol WBS de un proyecto", inputSchema: { type: "object", properties: { project_id: { type: "string", description: "UUID del proyecto" } }, required: ["project_id"] } },
        { name: "get_summary", description: "Obtiene KPI consolidados del portafolio", inputSchema: { type: "object", properties: {}, required: [] } },
        { name: "create_task", description: "Crea una tarea en un proyecto", inputSchema: { type: "object", properties: { project_id: { type: "string" }, parent_id: { type: "string" }, name: { type: "string" }, type: { type: "string" } }, required: ["project_id","name"] } },
      ] } });
    }

    if (method === "tools/call" && params?.name) {
      const args = params.arguments || {};
      if (params.name === "list_projects") {
        const projs = await db.query(`SELECT id, name, status, budget_total, created_at FROM projects ORDER BY created_at DESC`);
        return okResponse({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(projs.rows) }] } });
      }
      if (params.name === "get_project_wbs" && args.project_id) {
        const nodes = await db.query(`SELECT * FROM wbs_nodes WHERE project_id = $1 ORDER BY path, sort_order`, [args.project_id]);
        return okResponse({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(nodes.rows) }] } });
      }
      if (params.name === "get_summary") {
        const projects = await db.query<{id:string;name:string;status:string;budget_total:number}>(`SELECT id, name, status, budget_total FROM projects WHERE status = 'active'`);
        const activeIds = projects.rows.map(p => p.id);
        let progress = 0, totalBudget = 0, delayed = 0;
        if (activeIds.length > 0) {
          const {rows:tasks} = await db.query<{progress:number;end_date:string}>(`SELECT progress, end_date FROM wbs_nodes WHERE project_id = ANY($1) AND type = 'task'`, [activeIds]);
          const scheduled = tasks.filter(t => t.end_date);
          if (scheduled.length > 0) {
            progress = Math.round(scheduled.reduce((s,t) => s + (t.progress||0), 0) / scheduled.length * 100);
            delayed = scheduled.filter(t => t.end_date && t.end_date < new Date().toISOString().slice(0,10) && t.progress < 1).length;
          }
          totalBudget = projects.rows.reduce((s,p) => s + (p.budget_total||0), 0);
        }
        return okResponse({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ active_projects: activeIds.length, total_budget: totalBudget, global_progress: progress, delayed_tasks: delayed }) }] } });
      }
      if (params.name === "create_task" && args.name && args.project_id) {
        const taskId = crypto.randomUUID();
        const parentId = args.parent_id as string || null;
        let path = `n_${taskId.replaceAll("-","_")}`;
        if (parentId) {
          const {rows: [parent]} = await db.query<{path:string}>(`SELECT path FROM wbs_nodes WHERE id = $1`, [parentId]);
          if (parent) path = `${parent.path}.${path}`;
        }
        await db.query(`INSERT INTO wbs_nodes (id, project_id, parent_id, name, type, is_unscheduled, path, created_by) VALUES ($1,$2,$3,$4,$5,true,$6,$7)`,
          [taskId, args.project_id, parentId, args.name, args.type || "task", path, "00000000-0000-0000-0000-000000000001"]);
        return okResponse({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ id: taskId, name: args.name }) }] } });
      }
      return okResponse({ jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${params.name}` } });
    }

    throw new ApiError(400, "Invalid request");
  } catch (error) {
    return handleError(error);
  }
}
