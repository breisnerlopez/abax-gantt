import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

const authority = import.meta.env.VITE_AUTHENTIK_AUTHORITY ?? '';
const clientId = import.meta.env.VITE_AUTHENTIK_CLIENT_ID ?? '';
const redirectUri = import.meta.env.VITE_AUTHENTIK_REDIRECT_URI ?? `${window.location.origin}/abax-gantt/auth/callback`;
const postLogoutRedirectUri = import.meta.env.VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI ?? `${window.location.origin}/abax-gantt/login`;

export const isOidcConfigured = Boolean(authority && clientId);

export const authManager = isOidcConfigured
  ? new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      post_logout_redirect_uri: postLogoutRedirectUri,
      response_type: 'code',
      scope: 'openid email profile groups',
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      metadata: (() => {
        const base = authority.split('/application/')[0];
        return {
          issuer: authority.replace(/\/$/, ''),
          authorization_endpoint: `${base}/application/o/authorize/`,
          token_endpoint: `${base}/application/o/token/`,
          userinfo_endpoint: `${base}/application/o/userinfo/`,
          end_session_endpoint: `${authority}end-session/`,
          jwks_uri: `${authority}jwks/`,
        };
      })(),
    })
  : null;

export async function getOidcUser(): Promise<User | null> {
  if (!authManager) return null;
  const user = await authManager.getUser();
  if (!user || user.expired) return null;
  return user;
}

export async function loginWithAuthentik() {
  if (!authManager) throw new Error('Authentik no está configurado');
  await authManager.signinRedirect();
}

export async function completeSignin() {
  if (!authManager) throw new Error('Authentik no está configurado');
  return authManager.signinRedirectCallback();
}

export async function logoutFromAuthentik() {
  if (!authManager) return;
  await authManager.signoutRedirect();
}

export function getDisplayName(user: User | null) {
  const profile = user?.profile;
  return String(profile?.name || profile?.preferred_username || profile?.email || 'Usuario');
}

export function getEmail(user: User | null): string | null {
  const email = user?.profile?.email;
  return typeof email === 'string' && email.length > 0 ? email : null;
}

export function getRole(user: User | null) {
  const groups = user?.profile.groups;
  const groupList = Array.isArray(groups) ? groups.map(String) : [];
  if (groupList.includes('abax-admins')) return 'admin';
  return 'responsable';
}
