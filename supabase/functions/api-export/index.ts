import { authenticate } from "../_shared/auth.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { routeId, optionalString } from "../_shared/validation.ts";

function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replaceAll('"', '""')}"`
      : s;
  };
  return [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const id = routeId(req, "api-export");
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();
    const db = getServiceClient();

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const { data: project, error: projError } = await db
      .from("projects")
      .select("*, project_types(id,name,color)")
      .eq("id", id)
      .single();
    if (projError || !project) throw new ApiError(404, "Proyecto no encontrado");

    const { data: nodes, error: nodesError } = await db
      .from("wbs_nodes")
      .select("*, task_assignees(user_id, profiles!task_assignees_user_id_fkey(full_name))")
      .eq("project_id", id)
      .order("path", { ascending: true })
      .order("sort_order", { ascending: true });
    if (nodesError) throw new ApiError(500, nodesError.message);

    const { data: deps, error: depsError } = await db
      .from("dependencies")
      .select("*")
      .or(`predecessor_id.in.(${(nodes ?? []).map((n) => n.id).join(",")}),successor_id.in.(${(nodes ?? []).map((n) => n.id).join(",")})`);
    if (depsError) throw new ApiError(500, depsError.message);

    if (format === "csv") {
      const headers = ["id", "name", "type", "start_date", "end_date", "duration_days", "progress", "estimated_hours", "estimated_cost", "responsible_id", "is_unscheduled", "parent_id", "project_id"];
      const csv = buildCsv(headers, nodes ?? []);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${optionalString(project.name, "project") ?? "proyecto"}.csv"`,
        },
      });
    }

    if (format === "json") {
      return okResponse({
        data: {
          project,
          wbs_nodes: nodes,
          dependencies: deps,
        },
        metadata: {
          exported_at: new Date().toISOString(),
          exported_by: auth.userId,
          node_count: nodes?.length ?? 0,
          dependency_count: deps?.length ?? 0,
        },
      });
    }

    if (format === "pdf" || format === "png") {
      throw new ApiError(501, "Export PNG/PDF no implementado en backend; usar export client-side de DHTMLX o implementar render headless");
    }

    throw new ApiError(400, "Format no soportado. Usar: json, csv, pdf, png");
  } catch (error) {
    return handleError(error);
  }
});
