import { createRemoteJWKSet, jwtVerify } from "npm:jose";

const TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6InFhLXRlc3Qta2V5LTAxIn0.eyJzdWIiOiJ0ZXN0IiwiZ3JvdXBzIjpbImFiYXgtYWRtaW5zIl0sImlhdCI6MTc3ODk5OTk5OSwiZXhwIjoxNzc5MDA3MTk5LCJpc3MiOiJodHRwczovL3FhLWF1dGhlbnRpay5sb2NhbC9hcHBsaWNhdGlvbi9vL2FiYXgtZ2FudHQvIiwiYXVkIjoiYWJheC1nYW50dCJ9.testsig";

Deno.serve(async (_req: Request) => {
  const jwksUrl = Deno.env.get("AUTHENTIK_JWKS_URL") ?? "NOT_SET";
  const result: Record<string,string> = { jwks_url: jwksUrl };
  try {
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    const res = await fetch(jwksUrl + "/");
    result.fetch_status = String(res.status);
    result.fetch_body = (await res.text()).substring(0, 100);
  } catch(e) {
    result.fetch_error = e instanceof Error ? e.message : String(e);
  }
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
