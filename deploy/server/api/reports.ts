import { assertCanManageProject, authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    const isProject = /^[0-9a-f-]{36}$/i.test(projectId || "");

    if (isProject) {
      const {rows: [project]} = await db.query<{id:string;name:string;budget_total:number;status:string}>(`SELECT id, name, budget_total, status FROM projects WHERE id = $1`, [projectId]);
      if (!project) throw new ApiError(404, "Proyecto no encontrado");
      if (!auth.isAdmin) await assertCanManageProject(auth.userId, projectId!);

      const {rows:tasks} = await db.query<{estimated_hours:number;estimated_cost:number;progress:number}>(`SELECT estimated_hours, estimated_cost, progress FROM wbs_nodes WHERE project_id = $1 AND type = 'task'`, [projectId]);
      const totalEstimatedHours = tasks.reduce((s:number,t:{estimated_hours:number}) => s + (t.estimated_hours||0), 0);
      const totalEstimatedCost = tasks.reduce((s:number,t:{estimated_cost:number}) => s + (t.estimated_cost||0), 0);
      const avgProgress = tasks.length > 0 ? Math.round(tasks.reduce((s:number,t:{progress:number}) => s + (t.progress||0), 0) / tasks.length * 100) : 0;

      const {rows:times} = await db.query<{hours:number;full_name:string}>(`SELECT te.hours, p.full_name FROM time_entries te JOIN profiles p ON p.id = te.user_id JOIN wbs_nodes wn ON wn.id = te.task_id WHERE wn.project_id = $1`, [projectId]);
      const totalRealHours = times.reduce((s:number,t:{hours:number}) => s + t.hours, 0);
      const hoursByPerson: Record<string, number> = {};
      for (const t of times) { hoursByPerson[t.full_name] = (hoursByPerson[t.full_name] || 0) + t.hours; }

      return okResponse({ data: { project: { id: project.id, name: project.name, status: project.status }, budget: { total: project.budget_total, estimated_cost: totalEstimatedCost, estimated_hours: totalEstimatedHours, real_hours: totalRealHours, deviation: (project.budget_total || 0) - totalEstimatedCost, consumed_pct: (project.budget_total || 0) > 0 ? Math.round((totalEstimatedCost / (project.budget_total || 1)) * 100) : 0 }, progress: avgProgress, hours_by_person: hoursByPerson, task_count: tasks.length } });
    }

    const summary = await db.query(`SELECT * FROM projects WHERE status = 'active' ORDER BY name`);
    return okResponse({ data: summary.rows, count: summary.rows.length });
  } catch (error) {
    return handleError(error);
  }
}
