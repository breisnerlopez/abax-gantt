import { serveDir } from "jsr:@std/http@1/file-server";
import { router as apiRouter } from "./server/api/router.ts";
import { runMigrations } from "./server/db/migrate.ts";
import { ensureStorageDir } from "./server/storage/init.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");
const STORAGE_PATH = Deno.env.get("STORAGE_PATH") || "./data/attachments";

console.log("[abax] Iniciando servidor...");
console.log(`[abax] Puerto: ${PORT}`);
console.log(`[abax] Storage: ${STORAGE_PATH}`);

await runMigrations();
await ensureStorageDir(STORAGE_PATH);

// Security headers aplicados a respuestas no-API. `frame-ancestors` debe ir aquí
// (no en <meta>) o el browser lo ignora. `data:` en font-src permite fuentes
// inlineadas por DHTMLX/Vite sin warnings de CSP.
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

const isApiPath = (pathname: string) => pathname.startsWith("/api/");
const isStoragePath = (pathname: string) => pathname.startsWith("/storage/");
const isHealthPath = (pathname: string) => pathname === "/api/health";

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

Deno.serve({ port: PORT }, async (req: Request) => {
  const url = new URL(req.url);

  try {
    if (isHealthPath(url.pathname)) {
      return new Response(
        JSON.stringify({ status: "ok", db: "connected", timestamp: new Date().toISOString() }),
        { headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } },
      );
    }

    if (isApiPath(url.pathname)) {
      return apiRouter(req);
    }

    if (isStoragePath(url.pathname)) {
      return serveDir(req, {
        fsRoot: STORAGE_PATH,
        urlRoot: "/storage/",
        quiet: true,
      });
    }

    const response = await serveDir(req, {
      fsRoot: "./public",
      urlRoot: "",
      showIndex: true,
      quiet: true,
    });

    if (response.status === 404) {
      // Para assets hashed que ya no existen (porque el cliente tiene un SW viejo
      // cacheando el index.html anterior), NO devolver el shell HTML — el browser
      // lo intentaría parsear como JS/CSS y rompería todo. Mejor un 404 real.
      const isAssetPath = /\.(js|mjs|css|woff2?|ttf|png|svg|jpg|jpeg|gif|ico|map|json)$/i.test(url.pathname);
      if (isAssetPath) {
        return new Response("Asset no encontrado", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      // SPA fallback: cualquier otra ruta sirve el shell y deja que React Router resuelva.
      const html = Deno.readTextFileSync("./public/index.html");
      return withSecurityHeaders(new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          // HTML shell nunca debe quedar pegado en CDN/proxy — los assets son
          // hashed, pero el HTML referencia los hashes y debe revalidar.
          "Cache-Control": "no-cache, must-revalidate",
        },
      }));
    }

    // Service worker: nunca cachear en CDN/proxy. Si Cloudflare cachea v4 con
    // max-age=14400, los usuarios siguen registrando el SW viejo durante horas
    // aunque ya hayamos desplegado v5.
    if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("/index.html")) {
      response.headers.set("Cache-Control", "no-cache, must-revalidate");
    }

    return withSecurityHeaders(response);
  } catch (err) {
    console.error("[abax] Error no manejado:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
