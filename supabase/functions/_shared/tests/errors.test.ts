import { ApiError, errorResponse, handleError, okResponse } from "../errors.ts";
import { assertEquals } from "jsr:@std/assert@1";

Deno.test("ApiError - crea error con status y mensaje", () => {
  const err = new ApiError(404, "Not found");
  assertEquals(err.status, 404);
  assertEquals(err.message, "Not found");
});

Deno.test("ApiError - extiende Error", () => {
  const err = new ApiError(500, "Server error");
  assertEquals(err instanceof Error, true);
});

Deno.test("okResponse - retorna 200 por defecto", () => {
  const res = okResponse({ data: "test" });
  assertEquals(res.status, 200);
});

Deno.test("okResponse - retorna status personalizado", () => {
  const res = okResponse({ data: "created" }, 201);
  assertEquals(res.status, 201);
});

Deno.test("okResponse - Content-Type es application/json", () => {
  const res = okResponse({ data: "test" });
  assertEquals(res.headers.get("Content-Type"), "application/json");
});

Deno.test("okResponse - incluye CORS headers", () => {
  const res = okResponse({ data: "test" });
  assertEquals(res.headers.has("Access-Control-Allow-Origin"), true);
});

Deno.test("okResponse - serializa datos correctamente", async () => {
  const res = okResponse({ data: { id: 1 } });
  const body = await res.json();
  assertEquals(body, { data: { id: 1 } });
});

Deno.test("errorResponse - retorna status y mensaje", () => {
  const res = errorResponse(400, "Bad request");
  assertEquals(res.status, 400);
});

Deno.test("errorResponse - serializa error", async () => {
  const res = errorResponse(403, "Forbidden");
  const body = await res.json();
  assertEquals(body, { error: "Forbidden" });
});

Deno.test("errorResponse - Content-Type es application/json", () => {
  const res = errorResponse(500, "Error");
  assertEquals(res.headers.get("Content-Type"), "application/json");
});

Deno.test("handleError - maneja ApiError", () => {
  const err = new ApiError(401, "Unauthorized");
  const res = handleError(err);
  assertEquals(res.status, 401);
});

Deno.test("handleError - ApiError serializa mensaje", async () => {
  const err = new ApiError(404, "Not found");
  const res = handleError(err);
  const body = await res.json();
  assertEquals(body, { error: "Not found" });
});

Deno.test("handleError - error generico retorna 500", () => {
  const err = new Error("Unexpected error");
  const res = handleError(err);
  assertEquals(res.status, 500);
});

Deno.test("handleError - error generico retorna mensaje generico", async () => {
  const err = new Error("Unexpected error");
  const res = handleError(err);
  const body = await res.json();
  assertEquals(body, { error: "Error interno del servidor" });
});

Deno.test("handleError - string como error retorna 500", () => {
  const res = handleError("something went wrong");
  assertEquals(res.status, 500);
});

Deno.test("handleError - null como error retorna 500", () => {
  const res = handleError(null);
  assertEquals(res.status, 500);
});
