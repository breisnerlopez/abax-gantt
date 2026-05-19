import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { optionalNumber, optionalUuid } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    const auth = await authenticate(req);
    const db = getClient();
    const url = new URL(req.url);

    const days = optionalNumber(url.searchParams.get("days") ? parseInt(url.searchParams.get("days")!) : undefined, "days") ?? 30;
    const projectTypeId = optionalUuid(url.searchParams.get("project_type_id"), "project_type_id");
    const projectId = optionalUuid(url.searchParams.get("project_id"), "project_id");

    let projQ = `SELECT id, name, status, budget_total FROM projects WHERE 1=1`;
    const params: (string|number)[] = []; let i = 1;
    if (projectTypeId) { projQ += ` AND project_type_id = $${i++}`; params.push(projectTypeId); }
    if (projectId) { projQ += ` AND id = $${i++}`; params.push(projectId); }

    const {rows:projects} = await db.query<{id:string;name:string;status:string;budget_total:number}>(projQ, params);
    const activeProjects = projects.filter(p => p.status === "active");
    const activeIds = activeProjects.map(p => p.id);

    let globalProgress = 0; let totalBudget = 0; let totalEstimatedCost = 0; let totalEstimatedHours = 0; let totalRealHours = 0; let totalTasks = 0; let unscheduledTasks = 0;
    if (activeIds.length > 0) {
      const ids = activeIds.map((_,i) => `$${i+1}`).join(",");
      const {rows:nodes} = await db.query<{progress:number;estimated_cost:number;estimated_hours:number;type:string;is_unscheduled:boolean}>(`SELECT progress, estimated_cost, estimated_hours, type, is_unscheduled FROM wbs_nodes WHERE project_id IN (${ids}) AND type = 'task'`, activeIds);
      const tasks = nodes;
      totalTasks = tasks.length;
      unscheduledTasks = tasks.filter(n => n.is_unscheduled).length;
      let totalDur = 0; let weightedP = 0;
      for (const t of tasks) { totalDur += 1; weightedP += Number(t.progress||0); }
      globalProgress = totalDur > 0 ? weightedP / totalDur : 0;
      totalEstimatedCost = tasks.reduce((s,t) => s + Number(t.estimated_cost||0), 0);
      totalEstimatedHours = tasks.reduce((s,t) => s + Number(t.estimated_hours||0), 0);
      totalBudget = activeProjects.reduce((s,p) => s + Number(p.budget_total||0), 0);

      const {rows:times} = await db.query<{hours:number}>(`SELECT hours FROM time_entries te JOIN wbs_nodes wn ON wn.id = te.task_id WHERE wn.project_id IN (${ids})`, activeIds);
      totalRealHours = times.reduce((s,t) => s + Number(t.hours||0), 0);
    }

    const upcoming = activeIds.length > 0 ? await db.query<{c:string}>(`SELECT COUNT(*)::text AS c FROM wbs_nodes WHERE project_id = ANY($1) AND type = 'milestone' AND end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $2::integer)`, [activeIds, days]) : {rows:[{c:"0"}]};
    const delayed = activeIds.length > 0 ? await db.query<{c:string}>(`SELECT COUNT(*)::text AS c FROM wbs_nodes WHERE project_id = ANY($1) AND type = 'task' AND end_date < CURRENT_DATE AND progress < 1`, [activeIds]) : {rows:[{c:"0"}]};

    return okResponse({
      data: {
        active_projects: activeProjects.length,
        total_projects: projects.length,
        global_progress: Math.round(globalProgress * 100),
        upcoming_milestones_count: parseInt(upcoming.rows[0].c),
        total_budget: totalBudget,
        total_estimated_cost: totalEstimatedCost,
        budget_consumed_pct: totalBudget > 0 ? Math.round((totalEstimatedCost / totalBudget) * 100) : 0,
        total_tasks: totalTasks,
        unscheduled_tasks: unscheduledTasks,
        projects: { active: activeProjects.length, total: projects.length },
        progress: Math.round(globalProgress * 100),
        budget: { total: totalBudget, estimated_cost: totalEstimatedCost, real_hours: totalRealHours, estimated_hours: totalEstimatedHours, consumed_pct: totalBudget > 0 ? Math.round((totalEstimatedCost / totalBudget) * 100) : 0 },
        milestones: { upcoming_in_days: days, count: parseInt(upcoming.rows[0].c) },
        tasks: { total: totalTasks, unscheduled: unscheduledTasks, delayed: parseInt(delayed.rows[0].c) },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
