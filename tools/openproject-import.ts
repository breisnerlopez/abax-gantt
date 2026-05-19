import postgres from "npm:postgres@3";

type SourceUser = { id: number; firstname?: string; lastname?: string; login?: string; mail?: string; status?: number };
type SourceType = { id: number; name: string; is_milestone?: boolean };
type SourceStatus = { id: number; name: string; is_closed?: boolean };
type SourceProject = { id: number; name: string; parent_id: number | null; identifier?: string; active?: boolean; created_at?: string };
type SourceWorkPackage = {
  id: number;
  project_id: number;
  parent_id: number | null;
  subject: string;
  type_id: number | null;
  status_id: number | null;
  assigned_to_id: number | null;
  start_date: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  done_ratio: number | null;
  created_at?: string;
  updated_at?: string;
};
type SourceRelation = { id: number; relation_type: string; from_id: number; to_id: number; lag?: number | null };
type MigrationData = {
  source: string;
  export_date: string;
  users: SourceUser[];
  types: SourceType[];
  statuses: SourceStatus[];
  projects: SourceProject[];
  work_packages: SourceWorkPackage[];
  relations: SourceRelation[];
};

const inputPath = new URL("../docs/imports/openproject-migration/gantt-export/migration.json", import.meta.url);
const apply = Deno.args.includes("--apply");
const databaseUrl = Deno.env.get("DATABASE_URL");

async function stableUuidAsync(scope: string, id: string | number): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${scope}:${id}`)));
  const uuid = hash.slice(0, 16);
  uuid[6] = (uuid[6] & 0x0f) | 0x50;
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  const hex = Array.from(uuid, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fullName(user: SourceUser): string {
  const name = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
  return name || user.login || user.mail || `OpenProject User ${user.id}`;
}

function userEmail(user: SourceUser): string {
  const mail = user.mail?.trim();
  if (mail) return mail.toLowerCase();
  return `openproject-user-${user.id}@import.local`;
}

function nodeType(type?: SourceType): "project" | "stage" | "group" | "task" | "milestone" {
  if (!type) return "task";
  if (type.is_milestone || type.name === "Milestone") return "milestone";
  if (["Epic", "Feature", "Summary task"].includes(type.name)) return "group";
  return "task";
}

function progress(doneRatio: number | null): number {
  if (typeof doneRatio !== "number" || Number.isNaN(doneRatio)) return 0;
  return Math.max(0, Math.min(1, doneRatio / 100));
}

function ltreeLabel(id: string): string {
  return `n_${id.replaceAll("-", "_")}`;
}

function sourceLabel(prefix: string, id: string | number): string {
  return `${prefix}_${String(id).padStart(8, "0")}`;
}

function dependency(relation: SourceRelation): { predecessor: number; successor: number; type: "FS" } | null {
  if (relation.relation_type === "precedes" || relation.relation_type === "blocks") {
    return { predecessor: relation.from_id, successor: relation.to_id, type: "FS" };
  }
  if (relation.relation_type === "follows") {
    return { predecessor: relation.to_id, successor: relation.from_id, type: "FS" };
  }
  return null;
}

function validate(data: MigrationData) {
  const projectIds = new Set(data.projects.map((p) => p.id));
  const workPackageIds = new Set(data.work_packages.map((wp) => wp.id));
  const userIds = new Set(data.users.map((u) => u.id));
  const typeIds = new Set(data.types.map((t) => t.id));
  const statusIds = new Set(data.statuses.map((s) => s.id));
  return {
    project_parent_orphans: data.projects.filter((p) => p.parent_id && !projectIds.has(p.parent_id)).length,
    work_package_project_orphans: data.work_packages.filter((wp) => !projectIds.has(wp.project_id)).length,
    work_package_parent_orphans: data.work_packages.filter((wp) => wp.parent_id && !workPackageIds.has(wp.parent_id)).length,
    work_package_type_orphans: data.work_packages.filter((wp) => wp.type_id && !typeIds.has(wp.type_id)).length,
    work_package_status_orphans: data.work_packages.filter((wp) => wp.status_id && !statusIds.has(wp.status_id)).length,
    work_package_assignee_orphans: data.work_packages.filter((wp) => wp.assigned_to_id && !userIds.has(wp.assigned_to_id)).length,
    relation_orphans: data.relations.filter((rel) => !workPackageIds.has(rel.from_id) || !workPackageIds.has(rel.to_id)).length,
  };
}

const data = JSON.parse(await Deno.readTextFile(inputPath)) as MigrationData;
const issues = validate(data);
const issueCount = Object.values(issues).reduce((sum, count) => sum + count, 0);
const mappedDependencies = data.relations.map(dependency).filter(Boolean).length;

console.log(JSON.stringify({
  source: data.source,
  export_date: data.export_date,
  apply,
  counts: {
    users: data.users.length,
    projects: data.projects.length,
    root_nodes: data.projects.length,
    work_package_nodes: data.work_packages.length,
    dependencies: mappedDependencies,
  },
  validation: issues,
  issue_count: issueCount,
}, null, 2));

if (!apply) {
  console.log("Dry-run completo. Ejecuta con --apply para importar en PostgreSQL.");
  Deno.exit(issueCount === 0 ? 0 : 1);
}

if (!databaseUrl) throw new Error("DATABASE_URL es requerido para --apply");
if (issueCount > 0) throw new Error("No se importa porque hay referencias huerfanas");

const sql = postgres(databaseUrl, { max: 1 });
const typeById = new Map(data.types.map((type) => [type.id, type]));
const statusById = new Map(data.statuses.map((status) => [status.id, status]));
const workPackageById = new Map(data.work_packages.map((wp) => [wp.id, wp]));
const userIdMap = new Map<number, string>();

await sql.begin(async (tx) => {
  const [existingAdmin] = await tx<{ id: string }[]>`
    SELECT id FROM profiles WHERE is_admin = true AND status = 'active' ORDER BY created_at ASC LIMIT 1
  `;

  const importerId = existingAdmin?.id ?? await stableUuidAsync("importer", "openproject");
  if (!existingAdmin) {
    await tx`
      INSERT INTO profiles (id, authentik_sub, email, full_name, status, is_admin)
      VALUES (${importerId}, 'openproject:importer', 'openproject-importer@import.local', 'OpenProject Importer', 'active', true)
      ON CONFLICT (authentik_sub) DO UPDATE SET status = 'active', is_admin = true
    `;
  }

  for (const user of data.users) {
    const email = userEmail(user);
    const [existing] = await tx<{ id: string }[]>`SELECT id FROM profiles WHERE lower(email) = ${email} LIMIT 1`;
    const profileId = existing?.id ?? await stableUuidAsync("user", user.id);
    userIdMap.set(user.id, profileId);
    if (existing) continue;

    await tx`
      INSERT INTO profiles (id, authentik_sub, email, full_name, status, is_admin)
      VALUES (${profileId}, ${`openproject:user:${user.id}`}, ${email}, ${fullName(user)}, ${user.status === 1 ? "active" : "inactive"}, false)
      ON CONFLICT (authentik_sub) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          status = EXCLUDED.status
    `;
  }

  for (const project of data.projects) {
    const projectId = await stableUuidAsync("project", project.id);
    await tx`
      INSERT INTO projects (id, name, description, status, autoscheduling_enabled, created_by, created_at, updated_at)
      VALUES (
        ${projectId},
        ${project.name},
        ${`OpenProject id=${project.id}; identifier=${project.identifier ?? ""}; parent_id=${project.parent_id ?? ""}`},
        ${project.active === false ? "archived" : "active"},
        true,
        ${importerId},
        ${project.created_at ?? new Date().toISOString()},
        now()
      )
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          updated_at = now()
    `;
  }

  const nodePaths = new Map<string, string>();
  for (const project of data.projects) {
    const projectId = await stableUuidAsync("project", project.id);
    const nodeId = await stableUuidAsync("project-root", project.id);
    const path = sourceLabel("p", project.id);
    nodePaths.set(`project:${project.id}`, path);
    await tx`
      INSERT INTO wbs_nodes (id, project_id, parent_id, name, type, start_date, end_date, progress, estimated_hours, estimated_cost, sort_order, responsible_id, created_by, is_unscheduled, is_collapsed, path, created_at, updated_at)
      VALUES (${nodeId}, ${projectId}, NULL, ${project.name}, 'project', NULL, NULL, 0, NULL, NULL, ${project.id}, ${importerId}, ${importerId}, true, false, ${path}, ${project.created_at ?? new Date().toISOString()}, now())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          path = EXCLUDED.path,
          updated_at = now()
    `;
  }

  const pending = new Set(data.work_packages.map((wp) => wp.id));
  while (pending.size > 0) {
    let insertedThisPass = 0;
    for (const wp of data.work_packages) {
      if (!pending.has(wp.id)) continue;
      const parentWp = wp.parent_id ? workPackageById.get(wp.parent_id) : null;
      const parentKey = parentWp && parentWp.project_id === wp.project_id ? `wp:${wp.parent_id}` : `project:${wp.project_id}`;
      const parentPath = nodePaths.get(parentKey);
      if (!parentPath) continue;

      const id = await stableUuidAsync("wp", wp.id);
      const projectId = await stableUuidAsync("project", wp.project_id);
      const parentId = parentKey.startsWith("wp:") ? await stableUuidAsync("wp", wp.parent_id!) : await stableUuidAsync("project-root", wp.project_id);
      const type = nodeType(typeById.get(wp.type_id ?? -1));
      const status = statusById.get(wp.status_id ?? -1);
      const assignedUser = wp.assigned_to_id ? userIdMap.get(wp.assigned_to_id) ?? null : null;
      let startDate = wp.start_date;
      let endDate = wp.due_date;
      if (type === "milestone") {
        const date = startDate ?? endDate;
        startDate = date ?? null;
        endDate = date ?? null;
      }
      const path = `${parentPath}.${sourceLabel("w", wp.id)}`;
      nodePaths.set(`wp:${wp.id}`, path);

      await tx`
        INSERT INTO wbs_nodes (id, project_id, parent_id, name, type, description, start_date, end_date, progress, estimated_hours, estimated_cost, sort_order, responsible_id, created_by, is_unscheduled, is_collapsed, path, created_at, updated_at)
        VALUES (
          ${id}, ${projectId}, ${parentId}, ${wp.subject}, ${type},
          ${`OpenProject wp=${wp.id}; type=${typeById.get(wp.type_id ?? -1)?.name ?? ""}; status=${status?.name ?? ""}`},
          ${startDate}, ${endDate}, ${progress(wp.done_ratio)}, ${wp.estimated_hours}, NULL, ${wp.id}, ${assignedUser}, ${importerId}, ${!startDate}, false, ${path}, ${wp.created_at ?? new Date().toISOString()}, ${wp.updated_at ?? new Date().toISOString()}
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            parent_id = EXCLUDED.parent_id,
            type = EXCLUDED.type,
            description = EXCLUDED.description,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            progress = EXCLUDED.progress,
            estimated_hours = EXCLUDED.estimated_hours,
            responsible_id = EXCLUDED.responsible_id,
            is_unscheduled = EXCLUDED.is_unscheduled,
            path = EXCLUDED.path,
            updated_at = EXCLUDED.updated_at
      `;

      pending.delete(wp.id);
      insertedThisPass++;
    }
    if (insertedThisPass === 0) throw new Error(`No se pudo resolver jerarquia de ${pending.size} work packages`);
  }

  for (const wp of data.work_packages) {
    if (!wp.assigned_to_id) continue;
    const userId = userIdMap.get(wp.assigned_to_id);
    if (!userId) continue;
    const taskId = await stableUuidAsync("wp", wp.id);
    await tx`
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      VALUES (${taskId}, ${userId}, ${importerId})
      ON CONFLICT (task_id, user_id) DO NOTHING
    `;
  }

  for (const relation of data.relations) {
    const mapped = dependency(relation);
    if (!mapped) continue;
    const id = await stableUuidAsync("relation", relation.id);
    const predecessorId = await stableUuidAsync("wp", mapped.predecessor);
    const successorId = await stableUuidAsync("wp", mapped.successor);
    if (predecessorId === successorId) continue;
    await tx`
      INSERT INTO dependencies (id, predecessor_id, successor_id, type, created_by)
      VALUES (${id}, ${predecessorId}, ${successorId}, ${mapped.type}, ${importerId})
      ON CONFLICT (predecessor_id, successor_id) DO UPDATE SET type = EXCLUDED.type
    `;
  }

  // OpenProject permite padres/carpetas sin fechas explícitas. DHTMLX necesita fechas
  // para renderizar el árbol, así que agregamos rango min/max de descendientes fechados.
  await tx`
    WITH imported AS (
      SELECT id, path
      FROM wbs_nodes
      WHERE project_id IN (SELECT id FROM projects WHERE description LIKE 'OpenProject id=%')
    ), ranges AS (
      SELECT parent.id, min(child.start_date) AS start_date, max(child.end_date) AS end_date
      FROM imported parent
      JOIN wbs_nodes child ON child.path <@ parent.path AND child.id <> parent.id
      WHERE child.start_date IS NOT NULL OR child.end_date IS NOT NULL
      GROUP BY parent.id
    )
    UPDATE wbs_nodes wn
    SET start_date = COALESCE(wn.start_date, ranges.start_date),
        end_date = COALESCE(wn.end_date, ranges.end_date, ranges.start_date),
        is_unscheduled = CASE WHEN COALESCE(wn.start_date, ranges.start_date) IS NULL THEN true ELSE false END,
        updated_at = now()
    FROM ranges
    WHERE wn.id = ranges.id
      AND wn.project_id IN (SELECT id FROM projects WHERE description LIKE 'OpenProject id=%')
  `;
});

const importedRootIds = await Promise.all(data.projects.map((p) => stableUuidAsync("project-root", p.id)));
const importedRelationIds = await Promise.all(data.relations.map((r) => stableUuidAsync("relation", r.id)));

const [summary] = await sql<{ projects: number; nodes: number; dependencies: number; assignees: number }[]>`
  SELECT
    (SELECT count(*)::int FROM projects WHERE description LIKE 'OpenProject id=%') AS projects,
    (SELECT count(*)::int FROM wbs_nodes WHERE description LIKE 'OpenProject wp=%' OR id IN ${sql(importedRootIds)}) AS nodes,
    (SELECT count(*)::int FROM dependencies WHERE id IN ${sql(importedRelationIds)}) AS dependencies,
    (SELECT count(*)::int FROM task_assignees ta JOIN wbs_nodes wn ON wn.id = ta.task_id WHERE wn.description LIKE 'OpenProject wp=%') AS assignees
`;
await sql.end();

console.log(JSON.stringify({ imported: summary }, null, 2));
