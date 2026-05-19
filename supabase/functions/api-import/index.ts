import { authenticate } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, handleError, okResponse } from "../_shared/errors.ts";
import { readJson, requireUuid, requireString, optionalString, optionalDate } from "../_shared/validation.ts";

interface CsvRow {
  name?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  duration?: string;
  progress?: string;
  estimated_hours?: string;
  estimated_cost?: string;
  description?: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new ApiError(400, "CSV vacio o sin datos");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replaceAll('"', ""));
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replaceAll('"', ""));
    const row: CsvRow = {};
    headers.forEach((h, i) => { (row as Record<string, string>)[h] = cols[i] ?? ""; });
    return row;
  });
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const auth = await authenticate(req);
    const db = getServiceClient();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "";

    if (req.method !== "POST") throw new ApiError(405, "Metodo no permitido");

    if (type === "csv" || type === "excel") {
      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.includes("multipart/form-data")) {
        const body = await req.json();
        const projectId = requireUuid(body.project_id, "project_id");
        const csvText = requireString(body.data, "data", 5_000_000);
        const rows = parseCsv(csvText);

        const nodes = [];
        for (const row of rows) {
          const nodeId = crypto.randomUUID();
          nodes.push({
            id: nodeId,
            project_id: projectId,
            parent_id: optionalString(body.parent_id, "parent_id") ?? null,
            name: row.name ?? `Tarea ${nodes.length + 1}`,
            type: row.type ?? "task",
            start_date: optionalDate(row.start_date, "start_date"),
            end_date: optionalDate(row.end_date, "end_date"),
            progress: Math.min(1, Math.max(0, parseFloat(row.progress ?? "0") / 100)) || 0,
            estimated_hours: parseFloat(row.estimated_hours ?? "0") || null,
            estimated_cost: parseFloat(row.estimated_cost ?? "0") || null,
            description: optionalString(row.description, "description"),
            created_by: auth.userId,
            is_unscheduled: !row.start_date,
            path: `n_${nodeId.replaceAll("-", "_")}`,
          });
        }

        const { data, error } = await db.from("wbs_nodes").insert(nodes).select();
        if (error) throw new ApiError(400, error.message);
        return okResponse({ data, imported_count: nodes.length }, 201);
      }

      const form = await req.formData();
      const projectId = requireUuid(form.get("project_id"), "project_id");
      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "Archivo requerido");

      const text = await file.text();
      const rows = parseCsv(text);

      const nodes = [];
      for (const row of rows) {
        const nodeId = crypto.randomUUID();
        nodes.push({
          id: nodeId,
          project_id: projectId,
          name: row.name ?? `Tarea ${nodes.length + 1}`,
          type: row.type ?? "task",
          start_date: optionalDate(row.start_date, "start_date"),
          end_date: optionalDate(row.end_date, "end_date"),
          progress: Math.min(1, Math.max(0, parseFloat(row.progress ?? "0") / 100)) || 0,
          estimated_hours: parseFloat(row.estimated_hours ?? "0") || null,
          estimated_cost: parseFloat(row.estimated_cost ?? "0") || null,
          description: optionalString(row.description, "description"),
          created_by: auth.userId,
          is_unscheduled: !row.start_date,
          path: `n_${nodeId.replaceAll("-", "_")}`,
        });
      }

      const { data, error } = await db.from("wbs_nodes").insert(nodes).select();
      if (error) throw new ApiError(400, error.message);
      return okResponse({ data, imported_count: nodes.length }, 201);
    }

    if (type === "msproject") {
      throw new ApiError(501, "Importacion de MS Project XML no disponible en MVP. Usar CSV.");
    }

    throw new ApiError(400, "Indica ?type=csv para importar desde CSV o ?type=msproject para XML");
  } catch (error) {
    return handleError(error);
  }
});
