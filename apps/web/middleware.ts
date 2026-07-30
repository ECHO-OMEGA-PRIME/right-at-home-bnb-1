import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = [
  '/admin',
  '/dashboard',
  '/owner',
  '/worker',
  '/guest/dashboard',
  '/bookings',
  '/calendar',
  '/cleaning',
  '/concierge',
  '/finance',
  '/guests',
  '/locks',
  '/maintenance',
  '/messages',
  '/notifications',
  '/settings',
  '/smart-home',
  '/steven',
  '/properties/new',
];

const PUBLIC_ROUTES = new Set([
  '/',
  '/properties',
  '/login',
  '/register',
  '/privacy-policy',
  '/terms-of-service',
  '/booking/success',
  '/booking/complete',
  '/booking/cancelled',
]);

const ADMIN_ONLY_PREFIXES = [
  '/admin',
  '/owner',
  '/properties/new',
  '/api/admin',
  '/api/payroll',
  '/api/accounting',
  '/api/integrations/paypal',
  '/api/expenses',
  '/api/invoices',
  '/api/taxes',
  '/api/settings',
  '/api/properties/new',
];

const PUBLIC_API_PREFIXES = [
  '/api/webhooks/stripe',
  '/api/webhooks/vrbo',
  '/api/integrations/vrbo/webhook',
  '/api/integrations/ical',
  '/api/cron',
  '/api/calls',
  '/api/concierge',
  '/api/bookings/checkout',
  '/api/bookings/capture',
];

// Defense in depth: these listings are visible for portfolio/history purposes,
// but their direct-booking forms must not be reachable while inactive.
const INACTIVE_PROPERTY_SLUGS = new Set([
  'haynes-2802',
  'vanguard-6613',
  'oriole-6100',
  'gleneagles-4533',
]);

const AUTH_COOKIE_NAME = 'rah-auth-token';
type TokenRole = 'guest' | 'worker' | 'admin' | 'owner';
const VALID_ROLES = new Set<TokenRole>(['guest', 'worker', 'admin', 'owner']);

function devLoginEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_LOGIN === 'true';
}

function isDevToken(token: string): boolean {
  return token.startsWith('dev_') || token.startsWith('dev-mode-');
}

function extractRoleFromToken(token: string): TokenRole | null {
  if (!devLoginEnabled() || !isDevToken(token)) return null;
  const clean = token.replace(/^dev-mode-/, '');
  const role = clean.split('_')[1] as TokenRole | undefined;
  return role && VALID_ROLES.has(role) ? role : null;
}

/**
 * Constant-time string compare.
 *
 * Edge runtime has no `crypto.timingSafeEqual`, so do it by hand. Length is
 * allowed to leak (it always does via the compare loop); the value is not.
 */
function secretMatches(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Structural validation of a Firebase ID token.
 *
 * Middleware runs on the Edge runtime and cannot load firebase-admin, so it
 * cannot verify the RSA signature -- `verifyAuthToken` in the route handlers
 * does that. What middleware CAN do is reject anything that is not even a
 * plausible, unexpired token for our project, which is what stops an attacker
 * simply setting `rah-auth-token=anything`.
 *
 * This is a gate, not the authorization decision. Route handlers still verify.
 */
function looksLikeLiveIdToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')));
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return false;
    if (projectId && payload.aud !== projectId) return false;
    if (projectId && payload.iss !== `https://securetoken.google.com/${projectId}`) return false;
    return typeof payload.sub === 'string' && payload.sub.length > 0;
  } catch {
    return false;
  }
}

function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

function rejectDevApiToken(): NextResponse {
  return clearAuthCookie(
    NextResponse.json(
      { error: 'Development credentials are not accepted', code: 'UNAUTHORIZED' },
      { status: 401 },
    ),
  );
}

function rejectDevPageToken(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'invalid_session');
  return clearAuthCookie(NextResponse.redirect(loginUrl));
}

function inactiveBookingSlug(pathname: string): string | null {
  const match = pathname.match(/^\/properties\/([^/]+)\/book\/?$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return INACTIVE_PROPERTY_SLUGS.has(slug.toLowerCase()) ? slug : null;
}

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/properties/') && pathname !== '/properties/new') return true;
  return false;
}

function isPublicPropertiesRead(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/properties') return true;
  return /^\/api\/properties\/[^/]+$/.test(pathname) && pathname !== '/api/properties/new';
}

function isPublicApi(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/health') return true;
  if (isPublicPropertiesRead(request)) return true;
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function roleRedirect(request: NextRequest, role: TokenRole | null): NextResponse | null {
  if (!role) return null;
  const pathname = request.nextUrl.pathname;
  if ((pathname === '/owner' || pathname.startsWith('/owner/')) && !['owner', 'admin'].includes(role)) {
    return NextResponse.redirect(new URL(role === 'worker' ? '/worker' : '/guest/dashboard', request.url));
  }
  if ((pathname === '/worker' || pathname.startsWith('/worker/')) && role === 'guest') {
    return NextResponse.redirect(new URL('/guest/dashboard', request.url));
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The legacy client-side role impersonation route is permanently disabled.
  if (pathname === '/dev-login' || pathname.startsWith('/dev-login/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const blockedBookingSlug = inactiveBookingSlug(pathname);
  if (blockedBookingSlug) {
    const propertyUrl = new URL(`/properties/${encodeURIComponent(blockedBookingSlug)}`, request.url);
    propertyUrl.searchParams.set('booking', 'unavailable');
    return NextResponse.redirect(propertyUrl);
  }

  if (isPublicPage(pathname)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(request)) return NextResponse.next();

    // SECURITY: this previously accepted ANY x-api-secret header value and
    // returned next(), deferring validation to "the route handler" -- but most
    // API routes have no session guard of their own, so
    //     curl -H 'x-api-secret: anything' /api/bookings
    // returned 200 with live guest PII. Verified against production on
    // 2026-07-30. The header must be checked here, against the real secret.
    const apiSecret = request.headers.get('x-api-secret');
    if (apiSecret) {
      if (secretMatches(apiSecret, process.env.ADMIN_API_SECRET ?? '')) {
        return NextResponse.next();
      }
      return NextResponse.json(
        { error: 'Invalid API secret', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }
    if (isDevToken(authToken) && !devLoginEnabled()) return rejectDevApiToken();

    // SECURITY: presence of a cookie was previously treated as authentication.
    // Any value passed -- `rah-auth-token=x` returned 200 with live guest PII on
    // production (verified 2026-07-30) -- because the unguarded route handlers
    // never looked at it. Reject anything that is not a structurally valid,
    // unexpired token for this Firebase project. Signature verification still
    // happens in the route handlers via verifyAuthToken.
    if (!isDevToken(authToken) && !looksLikeLiveIdToken(authToken)) {
      return clearAuthCookie(
        NextResponse.json(
          { error: 'Authentication required', code: 'UNAUTHORIZED' },
          { status: 401 },
        ),
      );
    }

    if (isAdminOnly(pathname)) {
      const role = extractRoleFromToken(authToken);
      if (role && !['admin', 'owner'].includes(role)) {
        return NextResponse.json(
          { error: 'Owner access required', code: 'FORBIDDEN' },
          { status: 403 },
        );
      }
    }
    return NextResponse.next();
  }

  if (isProtectedPage(pathname)) {
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (isDevToken(authToken) && !devLoginEnabled()) return rejectDevPageToken(request);

    const role = extractRoleFromToken(authToken);
    const redirect = roleRedirect(request, role);
    if (redirect) return redirect;

    if (isAdminOnly(pathname) && role && !['admin', 'owner'].includes(role)) {
      return NextResponse.redirect(new URL(role === 'worker' ? '/worker' : '/properties', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Exposed for the regression tests in src/lib/__tests__/middleware-auth.test.ts.
// These two predicates are what closed the 2026-07-30 production auth bypass,
// so they are worth testing directly rather than only through a full request.
export const __testing__ = { secretMatches, looksLikeLiveIdToken };

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.woff2?$|.*\\.ttf$|.*\\.eot$).*)',
  ],
};
