import { authenticate } from "./_shared/auth.ts";
import { getClient } from "./_shared/db.ts";
import { ApiError, handleCors, handleError, okResponse } from "./_shared/errors.ts";
import { routeId } from "./_shared/validation.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  try {
    await authenticate(req);
    const db = getClient();
    const id = routeId(req, "api-export");
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "json").toLowerCase();

    if (req.method !== "GET") throw new ApiError(405, "Metodo no permitido");
    if (format === "pdf" || format === "png") throw new ApiError(501, "Export PNG/PDF debe generarse en el cliente");

    const projectRes = await db.query<Record<string, unknown>>(`SELECT *, COALESCE((SELECT json_build_object('id',pt.id,'name',pt.name,'color',pt.color) FROM project_types pt WHERE pt.id = projects.project_type_id), null) AS project_types FROM projects WHERE id = $1`, [id]);
    const project = projectRes.rows[0];
    if (!project) throw new ApiError(404, "Proyecto no encontrado");

    const nodesRes = await db.query<Record<string, unknown>>(
      `SELECT wn.*, COALESCE((SELECT json_agg(json_build_object('user_id',ta.user_id,'profiles',json_build_object('full_name',p.full_name))) FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id WHERE ta.task_id = wn.id),'[]'::json) AS task_assignees FROM wbs_nodes wn WHERE wn.project_id = $1 ORDER BY wn.path, wn.sort_order`,
      [id],
    );
    const nodes = nodesRes.rows;

    const depsRes = await db.query<Record<string, unknown>>(
      `SELECT * FROM dependencies WHERE predecessor_id IN (SELECT id FROM wbs_nodes WHERE project_id = $1) OR successor_id IN (SELECT id FROM wbs_nodes WHERE project_id = $1)`,
      [id],
    );
    const deps = depsRes.rows;

    if (format === "html") {
      const html = renderHtml(project, nodes, deps);
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${String(project.name || "proyecto")}.html"`,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (format === "csv") {
      const headers = ["id","name","type","start_date","end_date","duration_days","progress","estimated_hours","estimated_cost","responsible_id","is_unscheduled","parent_id","project_id"];
      const csv = [
        headers.join(","),
        ...nodes.map((n) => headers.map((h) => {
          const v = String(n[h] ?? "");
          return v.includes(",") || v.includes('"') ? `"${v.replaceAll('"', '""')}"` : v;
        }).join(",")),
      ].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${String(project.name || "proyecto")}.csv"`, "Access-Control-Allow-Origin": "*" } });
    }

    return okResponse({ data: { project, wbs_nodes: nodes, dependencies: deps }, metadata: { exported_at: new Date().toISOString(), node_count: nodes.length, dependency_count: deps.length } });
  } catch (error) {
    return handleError(error);
  }
}

// ─── Renderer HTML ─────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

function fmtDate(d: unknown): string {
  if (!d) return "—";
  const date = new Date(String(d));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function renderHtml(project: Record<string, unknown>, nodes: Record<string, unknown>[], deps: Record<string, unknown>[]): string {
  const projectName = escapeHtml(String(project.name ?? "Proyecto"));
  const projectDesc = project.description ? escapeHtml(String(project.description)) : "";
  const exportedAt = new Date().toLocaleString("es", { dateStyle: "long", timeStyle: "short" });

  const allDates = nodes.flatMap((n) => [n.start_date, n.end_date]).filter(Boolean).map((d) => new Date(String(d)).getTime()).filter((t) => !Number.isNaN(t));
  const minDate = allDates.length ? new Date(Math.min(...allDates)) : new Date();
  const maxDate = allDates.length ? new Date(Math.max(...allDates)) : new Date();
  const totalDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000) + 1);
  const pxPerDay = Math.max(2, Math.min(8, 800 / totalDays));
  const timelineWidth = totalDays * pxPerDay;

  // Indent por nivel (cuenta puntos en path)
  const depthOf = (path: unknown) => String(path ?? "").split(".").length - 1;

  const rows = nodes.map((n) => {
    const start = n.start_date ? new Date(String(n.start_date)) : null;
    const end = n.end_date ? new Date(String(n.end_date)) : start;
    const left = start ? Math.round(((start.getTime() - minDate.getTime()) / 86400000) * pxPerDay) : 0;
    const width = start && end ? Math.max(2, Math.round(((end.getTime() - start.getTime()) / 86400000 + 1) * pxPerDay)) : 0;
    const progress = Math.round(Number(n.progress ?? 0) * 100);
    const type = String(n.type ?? "task");
    const indent = depthOf(n.path) * 16;
    const typeColor: Record<string, string> = { project: "#4f5bd5", stage: "#7c5ce0", group: "#0ea5a5", task: "#3d7cf0", milestone: "#dc8a2e" };
    const color = typeColor[type] ?? "#3d7cf0";
    const bar = start && end
      ? type === "milestone"
        ? `<span class="bar bar--milestone" style="left:${left}px;background:${color}" title="${escapeHtml(String(n.name))}"></span>`
        : `<span class="bar" style="left:${left}px;width:${width}px;background:${color}">
             <span class="bar-progress" style="width:${progress}%"></span>
           </span>`
      : "";
    const typeLabel: Record<string, string> = { project: "Proyecto", stage: "Etapa", group: "Grupo", task: "Tarea", milestone: "Hito" };
    return `<tr>
      <td class="cell-name" style="padding-left:${10 + indent}px"><span class="dot" style="background:${color}"></span>${escapeHtml(String(n.name ?? ""))}<small>${typeLabel[type] ?? type}</small></td>
      <td>${fmtDate(n.start_date)}</td>
      <td>${fmtDate(n.end_date)}</td>
      <td>${progress}%</td>
      <td class="cell-tl"><div class="tl-wrap">${bar}</div></td>
    </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${projectName} — Export ABAX Gantt</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #0e1116; background: #fcfcfd; font-size: 13px; }
    header { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #e5e6eb; }
    header h1 { margin: 0; font-size: 24px; letter-spacing: -.02em; }
    header p { margin: 4px 0 0; color: #5b6170; font-size: 13px; }
    .meta { margin-top: 8px; color: #8a8f9c; font-size: 11.5px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; color: #5b6170; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e5e6eb; background: #f6f7f9; }
    td { padding: 8px 10px; border-bottom: 1px solid #edeef1; vertical-align: middle; }
    .cell-name { white-space: nowrap; }
    .cell-name small { display: block; color: #8a8f9c; font-size: 10.5px; font-weight: 500; margin-top: 1px; }
    .dot { display: inline-block; width: 10px; height: 10px; margin-right: 8px; border-radius: 2px; vertical-align: -1px; }
    .cell-tl { width: ${timelineWidth + 20}px; min-width: ${timelineWidth + 20}px; padding: 0; }
    .tl-wrap { position: relative; width: ${timelineWidth}px; height: 28px; margin: 4px 0; }
    .bar { position: absolute; top: 6px; height: 16px; border-radius: 3px; overflow: hidden; box-shadow: 0 1px 1px rgba(0,0,0,.08); }
    .bar-progress { display: block; height: 100%; background: rgba(0,0,0,.18); }
    .bar--milestone { width: 12px !important; height: 12px !important; top: 8px; transform: rotate(45deg); border-radius: 2px; }
    footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e6eb; color: #8a8f9c; font-size: 11px; }
    .deps { margin-top: 14px; font-size: 12px; color: #5b6170; }
    .deps b { color: #0e1116; }
    @media print { body { padding: 0; background: #fff; } }
  </style>
</head>
<body>
  <header>
    <h1>${projectName}</h1>
    ${projectDesc ? `<p>${projectDesc}</p>` : ""}
    <div class="meta">Exportado: ${escapeHtml(exportedAt)} · ${nodes.length} nodos · ${deps.length} dependencias</div>
  </header>
  <table>
    <thead><tr><th>Nombre</th><th>Inicio</th><th>Fin</th><th>%</th><th>Timeline</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${deps.length > 0 ? `<div class="deps"><b>Dependencias:</b> ${deps.length} relaciones entre nodos.</div>` : ""}
  <footer>Generado con ABAX Gantt · ${escapeHtml(exportedAt)}</footer>
</body>
</html>`;
}
