import { handleCors, corsHeaders } from "../cors.ts";
import { assertEquals } from "jsr:@std/assert@1";

Deno.test("handleCors - retorna null para metodo GET", () => {
  const req = new Request("http://localhost", { method: "GET" });
  assertEquals(handleCors(req), null);
});

Deno.test("handleCors - retorna null para metodo POST", () => {
  const req = new Request("http://localhost", { method: "POST" });
  assertEquals(handleCors(req), null);
});

Deno.test("handleCors - retorna response para OPTIONS", () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const res = handleCors(req);
  assertEquals(res instanceof Response, true);
});

Deno.test("handleCors - OPTIONS retorna 204", () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const res = handleCors(req)!;
  assertEquals(res.status, 204);
});

Deno.test("handleCors - OPTIONS incluye Access-Control-Allow-Methods", () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const res = handleCors(req)!;
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods"),
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
});

Deno.test("handleCors - OPTIONS incluye Access-Control-Allow-Headers", () => {
  const req = new Request("http://localhost", { method: "OPTIONS" });
  const res = handleCors(req)!;
  assertEquals(
    res.headers.get("Access-Control-Allow-Headers"),
    "Authorization, Content-Type, X-API-Key, X-Signature",
  );
});

Deno.test("corsHeaders - default origin localhost:5173", () => {
  assertEquals(corsHeaders["Access-Control-Allow-Origin"], "http://localhost:5173");
});

Deno.test("corsHeaders - incluye Max-Age", () => {
  assertEquals(corsHeaders["Access-Control-Max-Age"], "86400");
});
