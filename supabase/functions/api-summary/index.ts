import { authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const { data: projects, error: projectsError } = await db
      .from("projects")
      .select("id, name, status, created_at, budget_total");
    if (projectsError) throw new ApiError(500, projectsError.message);

    const activeProjects = projects?.filter((p) => p.status === "active") ?? [];

    const { data: milestones, error: milestonesError } = await db
      .from("wbs_nodes")
      .select("id, name, project_id, start_date")
      .eq("type", "milestone")
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .lte("start_date", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order("start_date", { ascending: true });
    if (milestonesError) throw new ApiError(500, milestonesError.message);

    let totalProgress = 0;
    let progressCount = 0;
    if (projects?.length) {
      for (const project of projects) {
        const { data: nodes } = await db
          .from("wbs_nodes")
          .select("progress, duration_days")
          .eq("project_id", project.id)
          .eq("type", "task");
        if (nodes) {
          for (const node of nodes) {
            const weight = node.duration_days ?? 1;
            totalProgress += (node.progress ?? 0) * weight;
            progressCount += weight;
          }
        }
      }
    }
    const globalProgress = progressCount > 0 ? totalProgress / progressCount : 0;

    let totalBudget = 0;
    let totalEstimatedCost = 0;
    if (projects?.length) {
      for (const project of projects) {
        if (project.status === "active" && (project as Record<string, unknown>).budget_total) {
          totalBudget += Number((project as Record<string, unknown>).budget_total);
        }
        const { data: nodes } = await db
          .from("wbs_nodes")
          .select("estimated_cost")
          .eq("project_id", project.id);
        if (nodes) {
          for (const n of nodes) {
            if (n.estimated_cost) totalEstimatedCost += Number(n.estimated_cost);
          }
        }
      }
    }

    const { count: totalTasksCount } = await db
      .from("wbs_nodes")
      .select("*", { count: "exact", head: true })
      .eq("type", "task");

    const { count: unscheduledCount } = await db
      .from("wbs_nodes")
      .select("*", { count: "exact", head: true })
      .eq("is_unscheduled", true);

    return okResponse({
      data: {
        active_projects: activeProjects.length,
        total_projects: projects?.length ?? 0,
        global_progress: Math.round(globalProgress * 10000) / 100,
        upcoming_milestones: milestones?.slice(0, 10) ?? [],
        upcoming_milestones_count: milestones?.length ?? 0,
        total_budget: totalBudget,
        total_estimated_cost: totalEstimatedCost,
        budget_consumed_pct: totalBudget > 0 ? Math.round((totalEstimatedCost / totalBudget) * 10000) / 100 : 0,
        total_tasks: totalTasksCount ?? 0,
        unscheduled_tasks: unscheduledCount ?? 0,
      },
    });
  } catch (error) {
    return handleError(error);
  }
});
