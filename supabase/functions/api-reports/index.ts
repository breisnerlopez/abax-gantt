import { authenticate, assertCanManageProject } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { routeId } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const id = routeId(req, "api-reports");
    const db = getServiceClient();

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");

    const { data: project, error: projError } = await db
      .from("projects")
      .select("id, name, budget_total, status")
      .eq("id", id)
      .single();
    if (projError || !project) throw new ApiError(404, "Proyecto no encontrado");

    await assertCanManageProject(auth.userId, id);

    const { data: nodes, error: nodesError } = await db
      .from("wbs_nodes")
      .select("id, name, type, progress, estimated_hours, estimated_cost, task_assignees(user_id, profiles!task_assignees_user_id_fkey(full_name))")
      .eq("project_id", id)
      .order("path", { ascending: true });
    if (nodesError) throw new ApiError(500, nodesError.message);

    const tasks = (nodes ?? []).filter((n) => n.type === "task");
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + Number(t.estimated_hours ?? 0), 0);
    const totalEstimatedCost = tasks.reduce((sum, t) => sum + Number(t.estimated_cost ?? 0), 0);

    const { data: timeEntries, error: timeError } = await db
      .from("time_entries")
      .select("task_id, hours, user_id, profiles(full_name)")
      .in("task_id", tasks.map((t) => t.id));
    if (timeError) throw new ApiError(500, timeError.message);

    const hoursByTask = new Map<string, number>();
    for (const te of (timeEntries ?? [])) {
      hoursByTask.set(te.task_id, (hoursByTask.get(te.task_id) ?? 0) + Number(te.hours));
    }
    const totalActualHours = [...hoursByTask.values()].reduce((a, b) => a + b, 0);

    const taskBreakdown = tasks.map((t) => {
      const actualHours = hoursByTask.get(t.id) ?? 0;
      const estimatedHours = Number(t.estimated_hours ?? 0);
      const estimatedCost = Number(t.estimated_cost ?? 0);
      const assignees = ((t as Record<string, unknown>).task_assignees as Record<string, unknown>[] ?? [])
        .map((a: Record<string, unknown>) => (a.profiles as Record<string, unknown>)?.full_name)
        .filter(Boolean);
      return {
        id: t.id,
        name: t.name,
        progress: t.progress,
        estimated_hours: estimatedHours,
        actual_hours: actualHours,
        hours_variance: estimatedHours > 0 ? Math.round(((actualHours - estimatedHours) / estimatedHours) * 10000) / 100 : 0,
        estimated_cost: estimatedCost,
        assignees,
      };
    });

    const budgetTotal = Number(project.budget_total ?? 0);
    const progressWeighted = tasks
      .filter((t) => t.progress != null)
      .reduce((sum, t) => sum + (Number(t.progress ?? 0) * (Number(t.estimated_hours) || 1)), 0);
    const totalWeight = tasks
      .filter((t) => t.progress != null)
      .reduce((sum, t) => sum + (Number(t.estimated_hours) || 1), 0);
    const progressPct = totalWeight > 0 ? Math.round((progressWeighted / totalWeight) * 10000) / 100 : 0;

    return okResponse({
      data: {
        project: { id: project.id, name: project.name, status: project.status },
        budget: {
          total: budgetTotal,
          estimated_cost: totalEstimatedCost,
          consumed_pct: budgetTotal > 0 ? Math.round((totalEstimatedCost / budgetTotal) * 10000) / 100 : 0,
        },
        hours: {
          estimated: totalEstimatedHours,
          actual: totalActualHours,
          variance_pct: totalEstimatedHours > 0 ? Math.round(((totalActualHours - totalEstimatedHours) / totalEstimatedHours) * 10000) / 100 : 0,
        },
        progress: progressPct,
        task_count: tasks.length,
        task_breakdown: taskBreakdown,
        hours_by_person: [...new Set((timeEntries ?? []).map((t) => (t as Record<string, unknown>).user_id as string))]
          .map((uid) => {
            const te = (timeEntries ?? []).find((t) => (t as Record<string, unknown>).user_id === uid && (t as Record<string, unknown>).profiles) as Record<string, unknown> | undefined;
            const profile = te?.profiles as Record<string, unknown>[] | Record<string, unknown> | undefined;
            const fullName = Array.isArray(profile) ? profile[0]?.full_name : (profile as Record<string, unknown>)?.full_name;
            return {
              user_id: uid,
              full_name: (typeof fullName === "string" ? fullName : null) ?? "Desconocido",
              hours: (timeEntries ?? []).filter((t) => (t as Record<string, unknown>).user_id === uid).reduce((s, t) => s + Number(t.hours), 0),
            };
          }),
      },
    });
  } catch (error) {
    return handleError(error);
  }
});
