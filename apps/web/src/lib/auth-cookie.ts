'use client';

/**
 * The browser side of the `rah-auth-token` cookie.
 *
 * This lives in its own module because TWO flows must write it and they must
 * write it identically. `AuthProvider` sets it from its `onAuthChange`
 * listener, which is fine for navigation but is NOT a synchronisation point:
 * registration creates the account and immediately POSTs to `/api/register`,
 * and `middleware.ts` rejects any `/api/*` request whose cookie is absent or
 * structurally invalid. Racing the provider's listener therefore produced a
 * 401 on a request that was, in fact, perfectly authenticated.
 *
 * The register flow now sets the cookie itself, before it calls the API. Two
 * writers of one security-relevant cookie is only safe if they agree on every
 * attribute, hence one module rather than two copies of the template string.
 */

const AUTH_COOKIE_NAME = 'rah-auth-token';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secureAttribute(): string {
  return typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
}

export function setAuthCookie(token: string): void {
  if (typeof document === 'undefined') return;
  document.cookie =
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; ` +
    `max-age=${MAX_AGE_SECONDS}; SameSite=Strict${secureAttribute()}`;
}

export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict${secureAttribute()}`;
}

export function readAuthCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const row = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!row) return null;
  return decodeURIComponent(row.slice(`${AUTH_COOKIE_NAME}=`.length));
}

export function isDevCookiePresent(): boolean {
  const value = readAuthCookie();
  return value !== null && (value.startsWith('dev_') || value.startsWith('dev-mode-'));
}
