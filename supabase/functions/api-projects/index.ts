import { authenticate, assertCanManageProject } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalBoolean, optionalNumber, optionalString, optionalUuid, readJson, requireString } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();

    if (req.method === "GET") {
      // Rediseño Fase 9: incluimos el join `teams(id,name,color,lead_id)` para
      // que el frontend pueda agrupar el portafolio sin hacer un fetch adicional.
      const { data: projects, error } = await db
        .from("projects")
        .select("*, project_types(id,name,color), teams(id,name,color,lead_id)")
        .order("created_at", { ascending: false });
      if (error) throw new ApiError(500, error.message);

      const visibleProjects = [];
      for (const p of (projects ?? [])) {
        if (auth.isAdmin || p.created_by === auth.userId) {
          visibleProjects.push(p);
          continue;
        }
        const { data: assignmentNodes } = await db
          .from("task_assignees")
          .select("task_id, wbs_nodes!inner(project_id)")
          .eq("user_id", auth.userId);
        const assignedProjectIds = new Set((assignmentNodes ?? []).map((a: Record<string, unknown>) => (a.wbs_nodes as Record<string, unknown>)?.project_id));
        if (assignedProjectIds.has(p.id)) {
          visibleProjects.push(p);
          continue;
        }
        const { data: canManage } = await db
          .rpc("can_manage_project", { check_user_id: auth.userId, check_project_id: p.id });
        if (canManage) visibleProjects.push(p);
      }

      return okResponse({ data: visibleProjects, count: visibleProjects.length });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const name = requireString(body.name, "name");
      const projectId = crypto.randomUUID();
      const rootNodeId = crypto.randomUUID();
      const projectTypeId = optionalUuid(body.project_type_id, "project_type_id");
      // Rediseño Fase 9: team_id es opcional; null deja el proyecto en el bucket
      // "Sin equipo" cuando el usuario agrupa por equipo desde el portafolio.
      const teamId = optionalUuid(body.team_id, "team_id");
      const budgetTotal = optionalNumber(body.budget_total, "budget_total", 0);

      const { data: project, error: projectError } = await db
        .from("projects")
        .insert({
          id: projectId,
          name,
          description: optionalString(body.description, "description"),
          project_type_id: projectTypeId,
          team_id: teamId,
          autoscheduling_enabled: optionalBoolean(body.autoscheduling_enabled, "autoscheduling_enabled") ?? true,
          budget_total: budgetTotal,
          created_by: auth.userId,
        })
        .select()
        .single();
      if (projectError) throw new ApiError(400, projectError.message);

      const { data: rootNode, error: rootError } = await db
        .from("wbs_nodes")
        .insert({
          id: rootNodeId,
          project_id: projectId,
          parent_id: null,
          name,
          type: "project",
          responsible_id: auth.userId,
          created_by: auth.userId,
          is_unscheduled: false,
          path: `n_${rootNodeId.replaceAll("-", "_")}`,
        })
        .select()
        .single();
      if (rootError) {
        await db.from("projects").delete().eq("id", projectId);
        throw new ApiError(400, rootError.message);
      }

      return okResponse({ data: { ...project, root_node: rootNode } }, 201);
    }

    throw new ApiError(405, "Metodo no permitido");
  } catch (error) {
    return handleError(error);
  }
});
