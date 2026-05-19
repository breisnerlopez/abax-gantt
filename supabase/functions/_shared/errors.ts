import { corsHeaders } from "./cors.ts";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function okResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleError(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error.status, error.message);
  console.error("Unhandled error", error);
  return errorResponse(500, "Error interno del servidor");
}
