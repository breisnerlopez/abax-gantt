import { ApiError, corsHeaders, errorResponse, handleCors, handleError, okResponse } from "../errors.ts";
import { assertEquals } from "jsr:@std/assert@1";

Deno.test("ApiError - tiene status y message", () => {
  const err = new ApiError(404, "no encontrado");
  assertEquals(err.status, 404);
  assertEquals(err.message, "no encontrado");
});

Deno.test("okResponse - 200 por defecto + JSON", async () => {
  const res = okResponse({ data: { id: 1 } });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  const body = await res.json();
  assertEquals(body.data.id, 1);
});

Deno.test("okResponse - acepta status custom", () => {
  const res = okResponse({ data: 1 }, 201);
  assertEquals(res.status, 201);
});

Deno.test("errorResponse - body {error: msg}", async () => {
  const res = errorResponse(400, "validacion");
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "validacion");
});

Deno.test("handleError - ApiError mantiene status", async () => {
  const res = handleError(new ApiError(403, "prohibido"));
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error, "prohibido");
});

Deno.test("handleError - error normal -> 500", async () => {
  const res = handleError(new Error("boom"));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "Error interno del servidor");
});

Deno.test("handleError - desconocido -> 500", async () => {
  const res = handleError("string error");
  assertEquals(res.status, 500);
});

Deno.test("handleCors - OPTIONS retorna 204", () => {
  const req = new Request("https://x.test/x", { method: "OPTIONS" });
  const res = handleCors(req);
  assertEquals(res?.status, 204);
  assertEquals(res?.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("handleCors - GET retorna null", () => {
  const req = new Request("https://x.test/x", { method: "GET" });
  assertEquals(handleCors(req), null);
});

Deno.test("corsHeaders incluye PATCH y DELETE", () => {
  const methods = String(corsHeaders["Access-Control-Allow-Methods"]);
  assertEquals(methods.includes("PATCH"), true);
  assertEquals(methods.includes("DELETE"), true);
  assertEquals(methods.includes("OPTIONS"), true);
});
