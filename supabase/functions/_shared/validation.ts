import { ApiError } from "./errors.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const colorPattern = /^#[0-9a-f]{6}$/i;
const nodeTypes = new Set(["project", "stage", "group", "task", "milestone"]);
const dependencyTypes = new Set(["FS", "SS", "FF", "SF"]);
const userStatuses = new Set(["active", "inactive", "invited"]);

export function requireString(value: unknown, field: string, max = 300): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `${field} es requerido`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ApiError(400, `${field} excede ${max} caracteres`);
  return trimmed;
}

export function requireEmail(value: unknown): string {
  const email = requireString(value, "email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "email invalido");
  return email;
}

export function optionalString(value: unknown, field: string, max = 2000): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, `${field} debe ser texto`);
  if (value.length > max) throw new ApiError(400, `${field} excede ${max} caracteres`);
  return value;
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new ApiError(400, `${field} debe ser UUID`);
  return value;
}

export function requireUuid(value: unknown, field: string): string {
  const uuid = optionalUuid(value, field);
  if (!uuid) throw new ApiError(400, `${field} es requerido`);
  return uuid;
}

export function optionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${field} debe usar formato YYYY-MM-DD`);
  }
  return value;
}

export function optionalColor(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !colorPattern.test(value)) throw new ApiError(400, "color debe ser hexadecimal #RRGGBB");
  return value;
}

export function optionalNumber(value: unknown, field: string, min?: number, max?: number): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiError(400, `${field} debe ser numerico`);
  if (min !== undefined && value < min) throw new ApiError(400, `${field} debe ser >= ${min}`);
  if (max !== undefined && value > max) throw new ApiError(400, `${field} debe ser <= ${max}`);
  return value;
}

export function optionalBoolean(value: unknown, field: string): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "boolean") throw new ApiError(400, `${field} debe ser booleano`);
  return value;
}

export function parseNodeType(value: unknown): string {
  const type = typeof value === "string" ? value : "task";
  if (!nodeTypes.has(type)) throw new ApiError(400, "type no soportado");
  return type;
}

export function parseDependencyType(value: unknown): string {
  const type = typeof value === "string" ? value : "FS";
  if (!dependencyTypes.has(type)) throw new ApiError(400, "type de dependencia no soportado");
  return type;
}

export function parseUserStatus(value: unknown): string {
  if (typeof value !== "string" || !userStatuses.has(value)) throw new ApiError(400, "status no soportado");
  return value;
}

export function routeId(req: Request, functionName: string): string {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const id = parts.at(-1);
  if (!id || id === functionName) throw new ApiError(400, "id requerido en la ruta");
  return requireUuid(id, "id");
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "JSON invalido");
  }
}
