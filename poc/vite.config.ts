import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

function runtimeConfigDevPlugin() {
  return {
    name: 'abax-runtime-config-dev',
    apply: 'serve',
    transformIndexHtml(html: string) {
      const publicBasePath = process.env.PUBLIC_BASE_PATH ?? process.env.VITE_BASE_PATH ?? '/abax-gantt/';
      return html.replace('<head>', `<head>\n    <base href="${publicBasePath}">`);
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.endsWith('/config.js')) return next();
        const publicBasePath = process.env.PUBLIC_BASE_PATH ?? process.env.VITE_BASE_PATH ?? '/abax-gantt/';
        const config = {
          publicBasePath,
          apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? publicBasePath.replace(/\/$/, ''),
          authentikAuthority: process.env.PUBLIC_AUTHENTIK_AUTHORITY ?? process.env.VITE_AUTHENTIK_AUTHORITY ?? '',
          authentikClientId: process.env.PUBLIC_AUTHENTIK_CLIENT_ID ?? process.env.VITE_AUTHENTIK_CLIENT_ID ?? '',
          authentikRedirectUri: process.env.PUBLIC_AUTHENTIK_REDIRECT_URI ?? process.env.VITE_AUTHENTIK_REDIRECT_URI,
          authentikPostLogoutRedirectUri: process.env.PUBLIC_AUTHENTIK_POST_LOGOUT_REDIRECT_URI ?? process.env.VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI,
          devAuthToken: process.env.PUBLIC_DEV_AUTH_TOKEN ?? process.env.VITE_DEV_AUTH_TOKEN ?? '',
        };
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.end(`window.__ABAX_CONFIG__ = ${JSON.stringify(config).replace(/</g, '\\u003c')};\n`);
      });
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [runtimeConfigDevPlugin(), react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 700,
  },
})
