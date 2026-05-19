import {
  requireString,
  requireEmail,
  optionalString,
  optionalUuid,
  requireUuid,
  optionalDate,
  optionalColor,
  optionalNumber,
  optionalBoolean,
  parseNodeType,
  parseDependencyType,
  parseUserStatus,
  readJson,
  routeId,
} from "../validation.ts";
import { assertEquals, assertThrows, assertRejects } from "jsr:@std/assert@1";
import { ApiError } from "../errors.ts";

Deno.test("requireString - acepta string valido", () => {
  assertEquals(requireString("hello", "name"), "hello");
});

Deno.test("requireString - rechaza string vacio", () => {
  assertThrows(() => requireString("", "name"), ApiError, "name es requerido");
});

Deno.test("requireString - rechaza solo espacios", () => {
  assertThrows(() => requireString("   ", "name"), ApiError, "name es requerido");
});

Deno.test("requireString - rechaza undefined", () => {
  assertThrows(() => requireString(undefined, "name"), ApiError, "name es requerido");
});

Deno.test("requireString - rechaza null", () => {
  assertThrows(() => requireString(null, "name"), ApiError, "name es requerido");
});

Deno.test("requireString - rechaza numero", () => {
  assertThrows(() => requireString(123, "name"), ApiError, "name es requerido");
});

Deno.test("requireString - trim y valida longitud", () => {
  assertEquals(requireString("  hello  ", "name"), "hello");
});

Deno.test("requireString - rechaza string mayor a max", () => {
  const long = "a".repeat(301);
  assertThrows(() => requireString(long, "name"), ApiError, "name excede 300 caracteres");
});

Deno.test("requireString - max personalizado", () => {
  assertThrows(() => requireString("123456", "code", 5), ApiError, "code excede 5 caracteres");
});

Deno.test("requireEmail - acepta email valido", () => {
  assertEquals(requireEmail("test@example.com"), "test@example.com");
});

Deno.test("requireEmail - convierte a lowercase", () => {
  assertEquals(requireEmail("Test@Example.COM"), "test@example.com");
});

Deno.test("requireEmail - rechaza email sin @", () => {
  assertThrows(() => requireEmail("invalid"), ApiError, "email invalido");
});

Deno.test("requireEmail - rechaza email sin dominio", () => {
  assertThrows(() => requireEmail("test@"), ApiError, "email invalido");
});

Deno.test("optionalString - retorna null para undefined", () => {
  assertEquals(optionalString(undefined, "desc"), null);
});

Deno.test("optionalString - retorna null para null", () => {
  assertEquals(optionalString(null, "desc"), null);
});

Deno.test("optionalString - retorna null para string vacio", () => {
  assertEquals(optionalString("", "desc"), null);
});

Deno.test("optionalString - retorna valor valido", () => {
  assertEquals(optionalString("hello", "desc"), "hello");
});

Deno.test("optionalString - rechaza tipo incorrecto", () => {
  assertThrows(() => optionalString(123, "desc"), ApiError, "desc debe ser texto");
});

Deno.test("optionalString - rechaza max excedido", () => {
  const long = "a".repeat(2001);
  assertThrows(() => optionalString(long, "desc"), ApiError, "desc excede 2000 caracteres");
});

Deno.test("optionalUuid - retorna null para undefined", () => {
  assertEquals(optionalUuid(undefined, "id"), null);
});

Deno.test("optionalUuid - acepta UUID valido v4", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  assertEquals(optionalUuid(uuid, "id"), uuid);
});

Deno.test("optionalUuid - rechaza UUID invalido", () => {
  assertThrows(() => optionalUuid("not-a-uuid", "id"), ApiError, "id debe ser UUID");
});

Deno.test("requireUuid - acepta UUID valido", () => {
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  assertEquals(requireUuid(uuid, "id"), uuid);
});

Deno.test("requireUuid - rechaza undefined", () => {
  assertThrows(() => requireUuid(undefined, "id"), ApiError, "id es requerido");
});

Deno.test("requireUuid - rechaza formato invalido", () => {
  assertThrows(() => requireUuid("abc123", "id"), ApiError, "id debe ser UUID");
});

Deno.test("optionalDate - retorna null para undefined", () => {
  assertEquals(optionalDate(undefined, "start_date"), null);
});

Deno.test("optionalDate - acepta formato YYYY-MM-DD", () => {
  assertEquals(optionalDate("2024-01-15", "start_date"), "2024-01-15");
});

Deno.test("optionalDate - rechaza formato invalido", () => {
  assertThrows(() => optionalDate("01-15-2024", "start_date"), ApiError, "start_date debe usar formato YYYY-MM-DD");
});

Deno.test("optionalDate - rechaza string sin formato", () => {
  assertThrows(() => optionalDate("yesterday", "start_date"), ApiError, "start_date debe usar formato YYYY-MM-DD");
});

Deno.test("optionalColor - retorna null para undefined", () => {
  assertEquals(optionalColor(undefined), null);
});

Deno.test("optionalColor - acepta hex valido", () => {
  assertEquals(optionalColor("#ff0000"), "#ff0000");
});

Deno.test("optionalColor - rechaza hex invalido", () => {
  assertThrows(() => optionalColor("red"), ApiError, "color debe ser hexadecimal #RRGGBB");
});

Deno.test("optionalColor - rechaza sin #", () => {
  assertThrows(() => optionalColor("ff0000"), ApiError, "color debe ser hexadecimal #RRGGBB");
});

Deno.test("optionalNumber - retorna null para undefined", () => {
  assertEquals(optionalNumber(undefined, "count"), null);
});

Deno.test("optionalNumber - acepta numero valido", () => {
  assertEquals(optionalNumber(42, "count"), 42);
});

Deno.test("optionalNumber - rechaza string", () => {
  assertThrows(() => optionalNumber("42", "count"), ApiError, "count debe ser numerico");
});

Deno.test("optionalNumber - valida minimo", () => {
  assertThrows(() => optionalNumber(-1, "count", 0), ApiError, "count debe ser >= 0");
});

Deno.test("optionalNumber - valida maximo", () => {
  assertThrows(() => optionalNumber(1.5, "progress", 0, 1), ApiError, "progress debe ser <= 1");
});

Deno.test("optionalNumber - acepta NaN como invalido", () => {
  assertThrows(() => optionalNumber(NaN, "count"), ApiError, "count debe ser numerico");
});

Deno.test("optionalNumber - acepta Infinity como invalido", () => {
  assertThrows(() => optionalNumber(Infinity, "count"), ApiError, "count debe ser numerico");
});

Deno.test("optionalBoolean - retorna null para undefined", () => {
  assertEquals(optionalBoolean(undefined, "flag"), null);
});

Deno.test("optionalBoolean - acepta true", () => {
  assertEquals(optionalBoolean(true, "flag"), true);
});

Deno.test("optionalBoolean - acepta false", () => {
  assertEquals(optionalBoolean(false, "flag"), false);
});

Deno.test("optionalBoolean - rechaza string", () => {
  assertThrows(() => optionalBoolean("true", "flag"), ApiError, "flag debe ser booleano");
});

Deno.test("optionalBoolean - rechaza numero", () => {
  assertThrows(() => optionalBoolean(1, "flag"), ApiError, "flag debe ser booleano");
});

Deno.test("parseNodeType - acepta tipos validos", () => {
  assertEquals(parseNodeType("project"), "project");
  assertEquals(parseNodeType("stage"), "stage");
  assertEquals(parseNodeType("group"), "group");
  assertEquals(parseNodeType("task"), "task");
  assertEquals(parseNodeType("milestone"), "milestone");
});

Deno.test("parseNodeType - default a task para undefined", () => {
  assertEquals(parseNodeType(undefined), "task");
});

Deno.test("parseNodeType - default a task para null", () => {
  assertEquals(parseNodeType(null), "task");
});

Deno.test("parseNodeType - rechaza tipo desconocido", () => {
  assertThrows(() => parseNodeType("invalid"), ApiError, "type no soportado");
});

Deno.test("parseDependencyType - acepta tipos validos", () => {
  assertEquals(parseDependencyType("FS"), "FS");
  assertEquals(parseDependencyType("SS"), "SS");
  assertEquals(parseDependencyType("FF"), "FF");
  assertEquals(parseDependencyType("SF"), "SF");
});

Deno.test("parseDependencyType - default a FS", () => {
  assertEquals(parseDependencyType(undefined), "FS");
});

Deno.test("parseDependencyType - rechaza tipo desconocido", () => {
  assertThrows(() => parseDependencyType("XX"), ApiError, "type de dependencia no soportado");
});

Deno.test("parseUserStatus - acepta status validos", () => {
  assertEquals(parseUserStatus("active"), "active");
  assertEquals(parseUserStatus("inactive"), "inactive");
  assertEquals(parseUserStatus("invited"), "invited");
});

Deno.test("parseUserStatus - rechaza status desconocido", () => {
  assertThrows(() => parseUserStatus("banned"), ApiError, "status no soportado");
});

Deno.test("parseUserStatus - rechaza numero", () => {
  assertThrows(() => parseUserStatus(1), ApiError, "status no soportado");
});

Deno.test("readJson - parsea JSON valido", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ name: "test" }),
    headers: { "Content-Type": "application/json" },
  });
  const result = await readJson(req);
  assertEquals(result, { name: "test" });
});

Deno.test("readJson - rechaza JSON invalido", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: "not json",
    headers: { "Content-Type": "application/json" },
  });
  await assertRejects(() => readJson(req), ApiError, "JSON invalido");
});

Deno.test("readJson - rechaza array como body", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify([1, 2, 3]),
    headers: { "Content-Type": "application/json" },
  });
  await assertRejects(() => readJson(req), ApiError, "JSON invalido");
});

Deno.test("readJson - rechaza null como body", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify(null),
    headers: { "Content-Type": "application/json" },
  });
  await assertRejects(() => readJson(req), ApiError, "JSON invalido");
});

Deno.test("routeId - extrae UUID de la ruta", () => {
  const req = new Request("http://localhost/api-projects/550e8400-e29b-41d4-a716-446655440000");
  assertEquals(routeId(req, "api-projects"), "550e8400-e29b-41d4-a716-446655440000");
});

Deno.test("routeId - rechaza ruta sin id", () => {
  const req = new Request("http://localhost/api-projects");
  assertThrows(() => routeId(req, "api-projects"), ApiError, "id requerido en la ruta");
});

Deno.test("routeId - rechaza id no UUID", () => {
  const req = new Request("http://localhost/api-projects/invalid");
  assertThrows(() => routeId(req, "api-projects"), ApiError, "id debe ser UUID");
});
