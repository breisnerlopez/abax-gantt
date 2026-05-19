import { authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { optionalUuid } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const projectTypeId = optionalUuid(url.searchParams.get("project_type_id"), "project_type_id");
    const days = parseInt(url.searchParams.get("days") ?? "30", 10);

    let projectQuery = db.from("projects").select("id, name, status, budget_total, project_type_id");
    if (projectTypeId) projectQuery = projectQuery.eq("project_type_id", projectTypeId);

    const { data: projects, error: projError } = await projectQuery;
    if (projError) throw new ApiError(500, projError.message);

    const activeProjects = (projects ?? []).filter((p) => p.status === "active");

    let milestonesQuery = db
      .from("wbs_nodes")
      .select("id, name, project_id, start_date")
      .eq("type", "milestone")
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .lte("start_date", new Date(Date.now() + days * 86400000).toISOString().slice(0, 10))
      .order("start_date", { ascending: true });
    if (projectTypeId && projects && projects.length > 0) {
      const projectIds = projects.map((p) => p.id);
      milestonesQuery = milestonesQuery.in("project_id", projectIds);
    }

    const { data: milestones, error: milestonesError } = await milestonesQuery;
    if (milestonesError) throw new ApiError(500, milestonesError.message);

    let progressWeighted = 0;
    let totalWeight = 0;
    let totalBudget = 0;
    let totalEstimatedCost = 0;
    let totalEstimatedHours = 0;
    let totalActualHours = 0;
    let taskCount = 0;
    let unscheduledCount = 0;
    const projectStats: unknown[] = [];
    const delayedTasks: unknown[] = [];

    for (const project of activeProjects) {
      const { data: nodes } = await db
        .from("wbs_nodes")
        .select("id, type, progress, duration_days, estimated_hours, estimated_cost, is_unscheduled")
        .eq("project_id", project.id);

      if (!nodes) continue;
      const projectTasks = nodes.filter((n) => n.type === "task");
      taskCount += projectTasks.length;
      unscheduledCount += nodes.filter((n) => n.is_unscheduled).length;

      for (const n of projectTasks) {
        const weight = n.duration_days ?? 1;
        progressWeighted += (n.progress ?? 0) * weight;
        totalWeight += weight;
        totalEstimatedHours += Number(n.estimated_hours ?? 0);
        totalEstimatedCost += Number(n.estimated_cost ?? 0);
      }

      totalBudget += Number(project.budget_total ?? 0);

      const { data: timeEntries } = await db
        .from("time_entries")
        .select("hours")
        .in("task_id", projectTasks.map((t) => t.id));
      if (timeEntries) {
        totalActualHours += timeEntries.reduce((s, t) => s + Number(t.hours), 0);
      }

      const projectProgress = projectTasks.filter((t) => t.progress != null).length > 0
        ? projectTasks.filter((t) => t.progress != null).reduce((s, t) => s + Number(t.progress ?? 0) * (t.duration_days ?? 1), 0) /
          projectTasks.filter((t) => t.progress != null).reduce((s, t) => s + (t.duration_days ?? 1), 0)
        : 0;

      projectStats.push({
        id: project.id,
        name: project.name,
        task_count: projectTasks.length,
        progress: Math.round(projectProgress * 10000) / 100,
        unscheduled: nodes.filter((n) => n.is_unscheduled).length,
      });

      const { data: delayed } = await db
        .from("wbs_nodes")
        .select("id, name, project_id, type, end_date, progress")
        .eq("project_id", project.id)
        .eq("type", "task")
        .lt("end_date", new Date().toISOString().slice(0, 10))
        .lt("progress", 1)
        .order("end_date", { ascending: true })
        .limit(5);
      if (delayed) delayedTasks.push(...delayed);
    }

    return okResponse({
      data: {
        projects: {
          active: activeProjects.length,
          total: projects?.length ?? 0,
          breakdown: projectStats,
        },
        progress: {
          global_pct: totalWeight > 0 ? Math.round((progressWeighted / totalWeight) * 10000) / 100 : 0,
          total_tasks: taskCount,
          unscheduled: unscheduledCount,
        },
        budget: {
          total: totalBudget,
          estimated_cost: totalEstimatedCost,
          consumed_pct: totalBudget > 0 ? Math.round((totalEstimatedCost / totalBudget) * 10000) / 100 : 0,
        },
        hours: {
          estimated: totalEstimatedHours,
          actual: totalActualHours,
          variance_pct: totalEstimatedHours > 0 ? Math.round(((totalActualHours - totalEstimatedHours) / totalEstimatedHours) * 10000) / 100 : 0,
        },
        milestones_upcoming: milestones?.slice(0, 15) ?? [],
        milestones_count: milestones?.length ?? 0,
        delayed_tasks: delayedTasks.slice(0, 10),
        delayed_count: delayedTasks.length,
      },
    });
  } catch (error) {
    return handleError(error);
  }
});
