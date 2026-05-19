import {
  optionalBoolean,
  optionalColor,
  optionalDate,
  optionalNumber,
  optionalString,
  optionalUuid,
  parseDepType,
  parseNodeType,
  readJson,
  requireString,
  requireUuid,
  routeId,
} from "../validation.ts";
import { ApiError } from "../errors.ts";
import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";

const UUID_OK = "9b555f85-0be5-416a-8805-c3c96aa53802";
const UUID_BAD = "no-es-uuid";

Deno.test("requireString - valido", () => {
  assertEquals(requireString("hola", "n"), "hola");
});

Deno.test("requireString - trim", () => {
  assertEquals(requireString("  hola  ", "n"), "hola");
});

Deno.test("requireString - rechaza vacio", () => {
  assertThrows(() => requireString("", "n"), ApiError);
  assertThrows(() => requireString("   ", "n"), ApiError);
  assertThrows(() => requireString(undefined, "n"), ApiError);
  assertThrows(() => requireString(123, "n"), ApiError);
});

Deno.test("requireString - max length", () => {
  assertThrows(() => requireString("a".repeat(301), "n", 300), ApiError);
});

Deno.test("optionalString - null/undefined OK", () => {
  assertEquals(optionalString(null, "n"), null);
  assertEquals(optionalString(undefined, "n"), null);
  assertEquals(optionalString("", "n"), null);
  assertEquals(optionalString("   ", "n"), null);
});

Deno.test("optionalString - valor real", () => {
  assertEquals(optionalString("texto", "n"), "texto");
});

Deno.test("requireUuid - valido", () => {
  assertEquals(requireUuid(UUID_OK, "id"), UUID_OK);
});

Deno.test("requireUuid - invalidos", () => {
  assertThrows(() => requireUuid(UUID_BAD, "id"), ApiError);
  assertThrows(() => requireUuid(null, "id"), ApiError);
  assertThrows(() => requireUuid(123, "id"), ApiError);
});

Deno.test("optionalUuid - null/undefined OK", () => {
  assertEquals(optionalUuid(null, "id"), null);
  assertEquals(optionalUuid(undefined, "id"), null);
});

Deno.test("optionalUuid - valido", () => {
  assertEquals(optionalUuid(UUID_OK, "id"), UUID_OK);
});

Deno.test("optionalDate - YYYY-MM-DD", () => {
  assertEquals(optionalDate("2026-05-19", "d"), "2026-05-19");
});

Deno.test("optionalDate - rechaza formato malo", () => {
  assertThrows(() => optionalDate("19/05/2026", "d"), ApiError);
  assertThrows(() => optionalDate("2026-5-19", "d"), ApiError);
});

Deno.test("optionalDate - null OK", () => {
  assertEquals(optionalDate(null, "d"), null);
});

Deno.test("optionalNumber - valido con rango", () => {
  assertEquals(optionalNumber(5, "n", 0, 10), 5);
  assertEquals(optionalNumber(0, "n", 0, 10), 0);
});

Deno.test("optionalNumber - rechaza fuera de rango", () => {
  assertThrows(() => optionalNumber(11, "n", 0, 10), ApiError);
  assertThrows(() => optionalNumber(-1, "n", 0, 10), ApiError);
});

Deno.test("optionalNumber - rechaza no numerico", () => {
  assertThrows(() => optionalNumber("5", "n"), ApiError);
  assertThrows(() => optionalNumber(NaN, "n"), ApiError);
  assertThrows(() => optionalNumber(Infinity, "n"), ApiError);
});

Deno.test("optionalColor - valido #RRGGBB", () => {
  assertEquals(optionalColor("#6366f1"), "#6366f1");
  assertEquals(optionalColor("#FFFFFF"), "#FFFFFF");
});

Deno.test("optionalColor - rechaza inválido", () => {
  assertThrows(() => optionalColor("#abc"), ApiError);
  assertThrows(() => optionalColor("red"), ApiError);
  assertThrows(() => optionalColor("rgb(0,0,0)"), ApiError);
});

Deno.test("parseNodeType - tipos validos", () => {
  for (const t of ["project", "stage", "group", "task", "milestone"]) {
    assertEquals(parseNodeType(t), t);
  }
});

Deno.test("parseNodeType - default 'task' si null", () => {
  assertEquals(parseNodeType(undefined), "task");
  assertEquals(parseNodeType(null), "task");
});

Deno.test("parseNodeType - rechaza desconocido", () => {
  assertThrows(() => parseNodeType("foo"), ApiError);
});

Deno.test("parseDepType - tipos validos", () => {
  for (const t of ["FS", "SS", "FF", "SF"]) {
    assertEquals(parseDepType(t), t);
  }
});

Deno.test("parseDepType - default 'FS' si null", () => {
  assertEquals(parseDepType(undefined), "FS");
  assertEquals(parseDepType(null), "FS");
});

Deno.test("optionalBoolean - valores", () => {
  assertEquals(optionalBoolean(true, "b"), true);
  assertEquals(optionalBoolean(false, "b"), false);
  assertEquals(optionalBoolean(null, "b"), null);
  assertEquals(optionalBoolean(undefined, "b"), null);
});

Deno.test("optionalBoolean - rechaza tipo invalido", () => {
  assertThrows(() => optionalBoolean("true", "b"), ApiError);
  assertThrows(() => optionalBoolean(1, "b"), ApiError);
});

Deno.test("routeId - extrae ultimo segmento UUID", () => {
  const req = new Request(`https://x.test/api/wbs/${UUID_OK}`);
  assertEquals(routeId(req, "wbs"), UUID_OK);
});

Deno.test("routeId - rechaza si no es UUID", () => {
  const req = new Request("https://x.test/api/wbs/foo");
  assertThrows(() => routeId(req, "wbs"), ApiError);
});

Deno.test("readJson - parsea objeto valido", async () => {
  const req = new Request("https://x.test/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
  const parsed = await readJson(req);
  assertEquals(parsed.a, 1);
});

Deno.test("readJson - rechaza JSON invalido", async () => {
  const req = new Request("https://x.test/x", { method: "POST", body: "{ bad json" });
  await assertRejects(() => readJson(req), ApiError);
});

Deno.test("readJson - rechaza arrays", async () => {
  const req = new Request("https://x.test/x", { method: "POST", body: "[1,2]" });
  await assertRejects(() => readJson(req), ApiError);
});

Deno.test("readJson - rechaza null", async () => {
  const req = new Request("https://x.test/x", { method: "POST", body: "null" });
  await assertRejects(() => readJson(req), ApiError);
});
