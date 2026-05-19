import { handler as wbs } from "./wbs.ts";
import { handler as wbsNode } from "./wbs-node.ts";
import { handler as projects } from "./projects.ts";
import { handler as dependencies } from "./dependencies.ts";
import { handler as assignees } from "./assignees.ts";
import { handler as backlog } from "./backlog.ts";
import { handler as schedule } from "./schedule.ts";
import { handler as progress } from "./progress.ts";
import { handler as move } from "./move.ts";
import { handler as timesheet } from "./timesheet.ts";
import { handler as attachments } from "./attachments.ts";
import { handler as exp } from "./export.ts";
import { handler as kpi } from "./kpi.ts";
import { handler as reports } from "./reports.ts";
import { handler as summary } from "./summary.ts";
import { handler as adminUsers } from "./admin-users.ts";
import { handler as users } from "./users.ts";
import { handler as adminProjectTypes } from "./admin-project-types.ts";
import { handler as imp } from "./import.ts";
import { handler as mcp } from "./mcp.ts";
import { handleCors, errorResponse } from "./_shared/errors.ts";

const ROUTES: { pattern: RegExp; handler: (req: Request) => Promise<Response> }[] = [
  { pattern: /^\/api\/wbs\/schedule\//, handler: schedule },
  { pattern: /^\/api\/wbs\/progress\//, handler: progress },
  { pattern: /^\/api\/wbs\/move\//, handler: move },
  { pattern: /^\/api\/wbs\/[^/]+$/, handler: wbsNode },
  { pattern: /^\/api\/wbs(\/|$)/, handler: wbs },
  { pattern: /^\/api\/projects\/[^/]+$/, handler: projects },
  { pattern: /^\/api\/projects(\/|$)/, handler: projects },
  { pattern: /^\/api\/dependencies/, handler: dependencies },
  { pattern: /^\/api\/assignees/, handler: assignees },
  { pattern: /^\/api\/backlog/, handler: backlog },
  { pattern: /^\/api\/timesheet/, handler: timesheet },
  { pattern: /^\/api\/attachments/, handler: attachments },
  { pattern: /^\/api\/export/, handler: exp },
  { pattern: /^\/api\/kpi/, handler: kpi },
  { pattern: /^\/api\/reports/, handler: reports },
  { pattern: /^\/api\/summary/, handler: summary },
  { pattern: /^\/api\/admin\/users/, handler: adminUsers },
  { pattern: /^\/api\/admin\/project-types/, handler: adminProjectTypes },
  { pattern: /^\/api\/users/, handler: users },
  { pattern: /^\/api\/import/, handler: imp },
  { pattern: /^\/api\/mcp/, handler: mcp },
];

export function router(req: Request): Response | Promise<Response> {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const pathname = new URL(req.url).pathname;

  for (const route of ROUTES) {
    if (route.pattern.test(pathname)) {
      return route.handler(req);
    }
  }

  return errorResponse(404, `Ruta no encontrada: ${pathname}`);
}
