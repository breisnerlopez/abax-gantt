export interface RuntimeConfig {
  publicBasePath: string;
  apiBaseUrl: string;
  authentikAuthority: string;
  authentikClientId: string;
  authentikRedirectUri: string;
  authentikPostLogoutRedirectUri: string;
  devAuthToken: string;
}

declare global {
  interface Window {
    __ABAX_CONFIG__?: Partial<RuntimeConfig>;
  }
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

function stripTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/$/, '') : value;
}

const runtimeConfig = window.__ABAX_CONFIG__ ?? {};
const publicBasePath = normalizeBasePath(runtimeConfig.publicBasePath);
const basePrefix = publicBasePath === '/' ? '' : stripTrailingSlash(publicBasePath);

export const config: RuntimeConfig = {
  publicBasePath,
  apiBaseUrl: runtimeConfig.apiBaseUrl ?? basePrefix,
  authentikAuthority: runtimeConfig.authentikAuthority ?? '',
  authentikClientId: runtimeConfig.authentikClientId ?? '',
  authentikRedirectUri: runtimeConfig.authentikRedirectUri ?? `${window.location.origin}${basePrefix}/auth/callback`,
  authentikPostLogoutRedirectUri: runtimeConfig.authentikPostLogoutRedirectUri ?? `${window.location.origin}${basePrefix}/login`,
  devAuthToken: runtimeConfig.devAuthToken ?? '',
};
