import { serveDir } from "jsr:@std/http@1/file-server";
import { router as apiRouter } from "./server/api/router.ts";
import { runMigrations } from "./server/db/migrate.ts";
import { ensureStorageDir } from "./server/storage/init.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");
const STORAGE_PATH = Deno.env.get("STORAGE_PATH") || "./data/attachments";
const APP_VERSION = Deno.env.get("APP_VERSION") || new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');

function envPublic(name: string, fallbackName?: string, fallback = ""): string {
  return Deno.env.get(name) ?? (fallbackName ? Deno.env.get(fallbackName) : undefined) ?? fallback;
}

function normalizeBasePath(value: string): string {
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}

const PUBLIC_BASE_PATH = normalizeBasePath(envPublic("PUBLIC_BASE_PATH", "VITE_BASE_PATH", "/"));
const PUBLIC_BASE_PREFIX = PUBLIC_BASE_PATH === "/" ? "" : PUBLIC_BASE_PATH.replace(/\/$/, "");
const PUBLIC_API_BASE_URL = envPublic("PUBLIC_API_BASE_URL", "VITE_API_BASE_URL", PUBLIC_BASE_PREFIX);
const PUBLIC_AUTHENTIK_AUTHORITY = envPublic("PUBLIC_AUTHENTIK_AUTHORITY", "VITE_AUTHENTIK_AUTHORITY");
const PUBLIC_AUTHENTIK_CLIENT_ID = envPublic("PUBLIC_AUTHENTIK_CLIENT_ID", "VITE_AUTHENTIK_CLIENT_ID");
const PUBLIC_AUTHENTIK_REDIRECT_URI = envPublic("PUBLIC_AUTHENTIK_REDIRECT_URI", "VITE_AUTHENTIK_REDIRECT_URI");
const PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI = envPublic("PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI", "VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI");
const PUBLIC_DEV_AUTH_TOKEN = envPublic("PUBLIC_DEV_AUTH_TOKEN", "VITE_DEV_AUTH_TOKEN");

console.log("[abax] Iniciando servidor...");
console.log(`[abax] Puerto: ${PORT}`);
console.log(`[abax] Storage: ${STORAGE_PATH}`);
console.log(`[abax] Public base path: ${PUBLIC_BASE_PATH}`);

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
const isRuntimeConfigPath = (pathname: string) => pathname === "/config.js";
const isServiceWorkerPath = (pathname: string) => pathname === "/sw.js";
const isAssetPath = (pathname: string) => /\.(js|mjs|css|woff2?|ttf|png|svg|jpg|jpeg|gif|ico|map|json)$/i.test(pathname);

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function runtimeConfigResponse(): Response {
  const config = {
    publicBasePath: PUBLIC_BASE_PATH,
    apiBaseUrl: PUBLIC_API_BASE_URL,
    authentikAuthority: PUBLIC_AUTHENTIK_AUTHORITY,
    authentikClientId: PUBLIC_AUTHENTIK_CLIENT_ID,
    authentikRedirectUri: PUBLIC_AUTHENTIK_REDIRECT_URI || undefined,
    authentikPostLogoutRedirectUri: PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI || undefined,
    devAuthToken: PUBLIC_DEV_AUTH_TOKEN,
  };

  return withSecurityHeaders(new Response(`window.__ABAX_CONFIG__ = ${jsonForScript(config)};\n`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  }));
}

function serviceWorkerResponse(): Response {
  const shellUrls = [
    PUBLIC_BASE_PATH,
    `${PUBLIC_BASE_PREFIX}/login` || "/login",
    `${PUBLIC_BASE_PREFIX}/gantt` || "/gantt",
  ];

  // El SW lo construimos línea por línea y unimos con join("\n") para evitar
  // el bug del template literal donde "\/" se colapsa a "/" y rompe regex
  // como `/\/assets\//`. Reemplazamos con doble backslash literal ("\\/"
  // serializa a "\/"). Bumpeamos APP_VERSION en CACHE_NAME para invalidar el
  // cache del SW antiguo en cada deploy.
  const body = [
    `const CACHE_NAME = 'abax-${APP_VERSION}';`,
    `const SHELL_URLS = ${jsonForScript(shellUrls)};`,
    ``,
    `self.addEventListener('install', (event) => {`,
    `  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => {})));`,
    `  self.skipWaiting();`,
    `});`,
    ``,
    `self.addEventListener('activate', (event) => {`,
    `  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));`,
    `  self.clients.claim();`,
    `});`,
    ``,
    `// Estrategia:`,
    `// - /api/* nunca se cachea (always network)`,
    `// - /assets/* con hash de Vite: cache-first (el hash invalida solo)`,
    `// - Resto (HTML shell): network-first con fallback offline`,
    `self.addEventListener('fetch', (event) => {`,
    `  if (event.request.method !== 'GET') return;`,
    `  const url = new URL(event.request.url);`,
    `  if (url.pathname.indexOf('/api/') !== -1) return;`,
    `  const isHashedAsset = /\\/assets\\/.+\\.(js|css|woff2|woff|ttf|png|svg|jpg)$/.test(url.pathname);`,
    `  const isFont = /\\/fonts\\/.+\\.(woff2|woff|ttf)$/.test(url.pathname);`,
    `  if (isHashedAsset || isFont) {`,
    `    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {`,
    `      if (response.ok && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));`,
    `      return response;`,
    `    })));`,
    `    return;`,
    `  }`,
    `  event.respondWith(fetch(event.request).then((response) => {`,
    `    if (response.ok && response.type === 'basic') caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));`,
    `    return response;`,
    `  }).catch(() => caches.match(event.request).then((cached) => cached || Response.error())));`,
    `});`,
    ``,
    `// Mensaje para forzar update desde el client (Ctrl+Shift+R o nuevo deploy).`,
    `self.addEventListener('message', (event) => {`,
    `  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();`,
    `});`,
  ].join("\n");

  return withSecurityHeaders(new Response(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Cache-Control + CDN-Cache-Control (Cloudflare): el SW debe revalidarse
      // SIEMPRE para que el browser detecte nuevas versiones tras un deploy.
      // Si CF cachea max-age=14400, los usuarios siguen registrando el SW viejo
      // durante horas. CDN-Cache-Control sobreescribe Cache-Control en Cloudflare.
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  }));
}

function htmlShellResponse(): Response {
  const html = Deno.readTextFileSync("./public/index.html")
    .replace(
      "<head>",
      `<head>\n    <base href="${PUBLIC_BASE_PATH}">`,
    )
    .replace(
      'src="./config.js"',
      `src="./config.js?v=${APP_VERSION}"`,
    )
    .replace(
      'register(swUrl)',
      `register(\`\${swUrl}?v=${APP_VERSION}\`)`,
    );

  return withSecurityHeaders(new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, must-revalidate",
    },
  }));
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

    if (isRuntimeConfigPath(url.pathname)) {
      return runtimeConfigResponse();
    }

    if (isServiceWorkerPath(url.pathname)) {
      return serviceWorkerResponse();
    }

    if (isStoragePath(url.pathname)) {
      return serveDir(req, {
        fsRoot: STORAGE_PATH,
        urlRoot: "/storage/",
        quiet: true,
      });
    }

    if (!isAssetPath(url.pathname)) {
      return htmlShellResponse();
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
      return new Response("Asset no encontrado", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
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
