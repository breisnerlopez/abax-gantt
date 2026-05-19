import { ApiError } from "./errors.ts";

export function requireString(value: unknown, name: string, max = 300): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `${name} es requerido`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ApiError(400, `${name} debe tener max ${max} caracteres`);
  return trimmed;
}

export function optionalString(value: unknown, _name: string, max = 2000): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ApiError(400, `${_name} debe ser texto`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new ApiError(400, `${_name} debe tener max ${max} caracteres`);
  return trimmed;
}

export function requireUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, `${name} debe ser un UUID valido`);
  }
  return value;
}

export function optionalUuid(value: unknown, _name: string): string | null {
  if (value === undefined || value === null) return null;
  return requireUuid(value, _name);
}

export function optionalDate(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${name} debe ser fecha YYYY-MM-DD`);
  }
  return value;
}

export function optionalNumber(value: unknown, name: string, min?: number, max?: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || isNaN(value) || !isFinite(value)) {
    throw new ApiError(400, `${name} debe ser un numero`);
  }
  if (min !== undefined && value < min) throw new ApiError(400, `${name} debe ser >= ${min}`);
  if (max !== undefined && value > max) throw new ApiError(400, `${name} debe ser <= ${max}`);
  return value;
}

export function optionalColor(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new ApiError(400, "color debe ser formato #RRGGBB");
  }
  return value;
}

const NODE_TYPES = new Set(["project", "stage", "group", "task", "milestone"]);

export function parseNodeType(value: unknown): string {
  if (value === undefined || value === null) return "task";
  if (typeof value === "string" && NODE_TYPES.has(value)) return value;
  throw new ApiError(400, "type no soportado");
}

const DEP_TYPES = new Set(["FS", "SS", "FF", "SF"]);

export function parseDepType(value: unknown): string {
  if (value === undefined || value === null) return "FS";
  if (typeof value === "string" && DEP_TYPES.has(value)) return value;
  throw new ApiError(400, "Tipo de dependencia no soportado");
}

export function routeId(req: Request, _prefix: string): string {
  const parts = new URL(req.url).pathname.split("/");
  const id = parts[parts.length - 1] || parts[parts.length - 2];
  return requireUuid(id, "id");
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ApiError(400, "Body debe ser un objeto JSON");
    }
    return parsed;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, "Body JSON invalido");
  }
}

export function optionalBoolean(value: unknown, _name: string): boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  throw new ApiError(400, `${_name} debe ser booleano`);
}
