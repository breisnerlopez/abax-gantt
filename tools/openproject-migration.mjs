import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INPUT = resolve(ROOT, 'docs/imports/openproject-migration/gantt-export/migration.json');
const DEFAULT_OUTPUT = resolve(ROOT, 'docs/imports/openproject-migration/abax-preview.json');

const args = new Set(process.argv.slice(2));
const inputArg = process.argv.find((arg) => arg.startsWith('--input='));
const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
const inputPath = inputArg ? resolve(inputArg.slice('--input='.length)) : DEFAULT_INPUT;
const outputPath = outputArg ? resolve(outputArg.slice('--output='.length)) : DEFAULT_OUTPUT;

function stableUuid(scope, id) {
  const hash = createHash('sha1').update(`${scope}:${id}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function nodeType(type) {
  if (!type) return 'task';
  if (type.is_milestone || type.name === 'Milestone') return 'milestone';
  if (['Epic', 'Feature', 'Summary task'].includes(type.name)) return 'group';
  return 'task';
}

function depMapping(relation) {
  if (relation.relation_type === 'precedes' || relation.relation_type === 'blocks') {
    return { predecessor_id: stableUuid('wp', relation.from_id), successor_id: stableUuid('wp', relation.to_id), type: 'FS' };
  }
  if (relation.relation_type === 'follows') {
    return { predecessor_id: stableUuid('wp', relation.to_id), successor_id: stableUuid('wp', relation.from_id), type: 'FS' };
  }
  return null;
}

function validate(data) {
  const projectIds = new Set(data.projects.map((p) => p.id));
  const workPackageIds = new Set(data.work_packages.map((wp) => wp.id));
  const userIds = new Set(data.users.map((u) => u.id));
  const typeIds = new Set(data.types.map((t) => t.id));
  const statusIds = new Set(data.statuses.map((s) => s.id));

  return {
    project_parent_orphans: data.projects.filter((p) => p.parent_id && !projectIds.has(p.parent_id)).map((p) => p.id),
    work_package_project_orphans: data.work_packages.filter((wp) => !projectIds.has(wp.project_id)).map((wp) => wp.id),
    work_package_parent_orphans: data.work_packages.filter((wp) => wp.parent_id && !workPackageIds.has(wp.parent_id)).map((wp) => wp.id),
    work_package_type_orphans: data.work_packages.filter((wp) => wp.type_id && !typeIds.has(wp.type_id)).map((wp) => wp.id),
    work_package_status_orphans: data.work_packages.filter((wp) => wp.status_id && !statusIds.has(wp.status_id)).map((wp) => wp.id),
    work_package_assignee_orphans: data.work_packages.filter((wp) => wp.assigned_to_id && !userIds.has(wp.assigned_to_id)).map((wp) => wp.id),
    relation_orphans: data.relations
      .filter((rel) => !workPackageIds.has(rel.from_id) || !workPackageIds.has(rel.to_id))
      .map((rel) => rel.id),
  };
}

function buildPreview(data) {
  const typesById = new Map(data.types.map((type) => [type.id, type]));
  const statusesById = new Map(data.statuses.map((status) => [status.id, status]));
  const projectsById = new Map(data.projects.map((project) => [project.id, project]));
  const workPackagesById = new Map(data.work_packages.map((wp) => [wp.id, wp]));

  const projects = data.projects.map((project) => ({
    source_id: project.id,
    id: stableUuid('project', project.id),
    name: project.name,
    status: project.active ? 'active' : 'archived',
    source_parent_id: project.parent_id,
    source_identifier: project.identifier,
  }));

  const rootNodes = data.projects.map((project) => ({
    source_id: `project:${project.id}`,
    id: stableUuid('project-root', project.id),
    project_id: stableUuid('project', project.id),
    parent_id: null,
    name: project.name,
    type: 'project',
    start_date: null,
    end_date: null,
    progress: 0,
    estimated_hours: null,
    source: 'project_root',
  }));

  const workPackageNodes = data.work_packages.map((wp) => {
    const type = typesById.get(wp.type_id);
    const status = statusesById.get(wp.status_id);
    const parent = wp.parent_id ? workPackagesById.get(wp.parent_id) : null;
    const parentId = parent && parent.project_id === wp.project_id
      ? stableUuid('wp', wp.parent_id)
      : stableUuid('project-root', wp.project_id);

    return {
      source_id: wp.id,
      id: stableUuid('wp', wp.id),
      project_id: stableUuid('project', wp.project_id),
      parent_id: parentId,
      name: wp.subject,
      type: nodeType(type),
      start_date: wp.start_date,
      end_date: wp.due_date,
      progress: typeof wp.done_ratio === 'number' ? wp.done_ratio / 100 : 0,
      estimated_hours: wp.estimated_hours,
      source_type: type?.name ?? null,
      source_status: status?.name ?? null,
      source_assigned_to_id: wp.assigned_to_id,
      source: 'work_package',
    };
  });

  const dependencies = data.relations
    .map((relation) => ({ relation, mapped: depMapping(relation) }))
    .filter(({ mapped }) => mapped)
    .map(({ relation, mapped }) => ({
      source_id: relation.id,
      ...mapped,
      source_type: relation.relation_type,
      lag: relation.lag ?? null,
    }));

  return {
    source: data.source,
    export_date: data.export_date,
    counts: {
      users: data.users.length,
      projects: projects.length,
      root_nodes: rootNodes.length,
      work_package_nodes: workPackageNodes.length,
      dependencies: dependencies.length,
      skipped_relations: data.relations.length - dependencies.length,
    },
    mappings: {
      types: data.types.map((type) => ({ source_id: type.id, source_name: type.name, abax_type: nodeType(type) })),
      statuses: data.statuses.map((status) => ({ source_id: status.id, source_name: status.name, closed: status.is_closed })),
    },
    projects,
    nodes: [...rootNodes, ...workPackageNodes],
    dependencies,
  };
}

const data = JSON.parse(await readFile(inputPath, 'utf8'));
const issues = validate(data);
const preview = buildPreview(data);
const issueCount = Object.values(issues).reduce((sum, values) => sum + values.length, 0);

const report = {
  input: inputPath,
  source: data.source,
  export_date: data.export_date,
  raw_counts: {
    users: data.users.length,
    types: data.types.length,
    statuses: data.statuses.length,
    versions: data.versions.length,
    projects: data.projects.length,
    work_packages: data.work_packages.length,
    relations: data.relations.length,
  },
  preview_counts: preview.counts,
  validation: issues,
  issue_count: issueCount,
};

console.log(JSON.stringify(report, null, 2));

if (args.has('--write')) {
  await writeFile(outputPath, `${JSON.stringify(preview, null, 2)}\n`);
  console.log(`\nPreview escrito en ${outputPath}`);
}
