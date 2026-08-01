/**
 * Right at Home BnB — server-side authentication and role enforcement.
 * Firebase ID tokens are verified with Firebase Admin. Unsigned development
 * tokens are accepted only during an explicitly enabled local development run.
 */

import { NextRequest, NextResponse } from 'next/server';

export type ApiUserRole = 'guest' | 'worker' | 'admin' | 'owner';

export interface ApiUser {
  uid: string;
  email: string | null;
  role: ApiUserRole;
  workerType: string | null;
  isDevMode: boolean;
}

interface AuthResult {
  user: ApiUser | null;
  error: NextResponse | null;
}

/**
 * Raised when the ID token verified successfully but the role store could not
 * be consulted (Firestore unavailable / quota exhausted / transport failure).
 *
 * This case MUST stay distinct from "the token is invalid". Collapsing the two
 * produced a real production incident: echo-prime-ai Firestore began returning
 * 429 RESOURCE_EXHAUSTED, the role read threw, the catch returned null, and
 * every correctly-authenticated user was told "Authentication required". The
 * outage looked exactly like broken login and hid its own cause.
 *
 * It must also never fail OPEN. We cannot distinguish "user has no role
 * document" (legitimately guest) from "cannot read the role document" while
 * the store is down, so we refuse the request with a typed 503 rather than
 * assuming any role.
 */
export class RoleStoreUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Role store unavailable');
    this.name = 'RoleStoreUnavailableError';
    this.cause = cause;
  }
}

function asRole(value: unknown): ApiUserRole | null {
  return typeof value === 'string' && VALID_ROLES.has(value as ApiUserRole)
    ? (value as ApiUserRole)
    : null;
}

const AUTH_COOKIE = 'rah-auth-token';
const VALID_ROLES = new Set<ApiUserRole>(['guest', 'worker', 'admin', 'owner']);

/**
 * Postgres `User.role` -> the app's ApiUserRole union.
 *
 * The DB vocabulary is wider than the union: CLEANER and MAINTENANCE are both
 * 'worker'. This is an explicit allowlist rather than a lower-casing shortcut,
 * so an unrecognised or newly added DB role falls through to 'guest' instead of
 * being coerced into whatever it happens to resemble.
 */
const DB_ROLE_MAP: Record<string, ApiUserRole> = {
  GUEST: 'guest',
  WORKER: 'worker',
  CLEANER: 'worker',
  MAINTENANCE: 'worker',
  ADMIN: 'admin',
  OWNER: 'owner',
};

function devLoginEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_LOGIN === 'true';
}

function isDevToken(token: string): boolean {
  return token.startsWith('dev_') || token.startsWith('dev-mode-');
}

function parseDevToken(token: string): ApiUser | null {
  if (!devLoginEnabled() || !isDevToken(token)) return null;

  const cleanToken = token.replace(/^dev-mode-/, '');
  const parts = cleanToken.split('_');
  const role = parts[1] as ApiUserRole | undefined;
  if (!role || !VALID_ROLES.has(role)) return null;

  const workerType = parts[2] && parts[2] !== 'general' ? parts[2] : null;
  return {
    uid: cleanToken,
    email: null,
    role,
    workerType,
    isDevMode: true,
  };
}

/**
 * The subset of a verified token this module consumes. Both issuers produce it:
 * echo-auth preserves the Firebase localId as its `uid`, so the same human gets
 * the same uid whichever path verified them.
 */
interface DecodedIdentity {
  uid: string;
  email?: string | null;
  role?: unknown;
  workerType?: unknown;
}

const ECHO_AUTH_ISSUER = process.env.ECHO_AUTH_ISSUER ?? 'https://auth.echo-op.com';
const ECHO_AUTH_AUDIENCE = process.env.ECHO_AUTH_AUDIENCE ?? 'echo-prime-ai';
const ECHO_AUTH_JWKS_URL =
  process.env.ECHO_AUTH_JWKS_URL ?? `${ECHO_AUTH_ISSUER}/.well-known/jwks.json`;

/**
 * Raised when a token CLAIMS to be from echo-auth but we could not check it --
 * JWKS unreachable, key rotation not yet fetched, clock skew on the endpoint.
 *
 * This is deliberately NOT the same as "the token is invalid". The law is
 * explicit: an unreachable upstream must produce a 503, never a login, and
 * never a silent downgrade to anonymous. Falling through to the Firebase path
 * here would be worse than useless -- Firebase cannot verify an echo-auth
 * token, so the request would surface as a plain 401 and an outage would be
 * indistinguishable from a bad password.
 */
export class IdentityProviderUnavailableError extends Error {
  constructor(cause: unknown) {
    super('identity provider unavailable', { cause });
    this.name = 'IdentityProviderUnavailableError';
  }
}

// createRemoteJWKSet caches keys and only refetches on an unknown kid, so this
// costs one network call per key rotation rather than one per request.
let jwks: ReturnType<typeof import('jose').createRemoteJWKSet> | null = null;

/**
 * Verify an echo-auth RS256 token, or return null if the token is not one.
 *
 * Routing is by `iss`, read from the UNVERIFIED payload. That is safe here
 * precisely because it decides only WHICH verifier runs -- a forged `iss` sends
 * the token to a verifier that will reject it, it never skips verification.
 * Doing it this way keeps "this token is not ours" distinguishable from "we
 * could not check it", which is what makes the fail-closed branch above
 * possible.
 */
async function verifyEchoAuthToken(token: string): Promise<DecodedIdentity | null> {
  const { createRemoteJWKSet, jwtVerify, decodeJwt } = await import('jose');

  let issuer: string | undefined;
  try {
    issuer = decodeJwt(token).iss;
  } catch {
    return null; // not a well-formed JWT; let the legacy path judge it
  }
  if (issuer !== ECHO_AUTH_ISSUER) return null;

  if (!jwks) jwks = createRemoteJWKSet(new URL(ECHO_AUTH_JWKS_URL));

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ECHO_AUTH_ISSUER,
      audience: ECHO_AUTH_AUDIENCE,
      algorithms: ['RS256'],
    });

    const uid = typeof payload.sub === 'string' ? payload.sub : (payload.uid as string);
    if (!uid) return null;

    return {
      uid,
      email: typeof payload.email === 'string' ? payload.email : null,
      role: payload.role,
      workerType: (payload as Record<string, unknown>).workerType,
    };
  } catch (error) {
    // Distinguish "this token is bad" from "we could not reach the keys".
    // jose tags signature/claim failures with a stable `code`; anything without
    // one is a transport or configuration failure and must fail CLOSED.
    const code = (error as { code?: string }).code;
    if (typeof code === 'string' && code.startsWith('ERR_JW')) return null;
    throw new IdentityProviderUnavailableError(error);
  }
}

/** Verify one raw RAH auth token and return its authoritative user identity. */
export async function verifyAuthToken(token: string | undefined): Promise<ApiUser | null> {
  if (!token) return null;

  if (isDevToken(token)) {
    return parseDevToken(token);
  }

  // Stage 1 - identity.
  //
  // echo-auth (https://auth.echo-op.com) is the fleet's ONE identity runtime
  // (LAW 2026-07-31: never wire a site straight to Firebase again). Its tokens
  // are RS256 and verify against its published JWKS, so this path needs no
  // Google project, no service account and no billing.
  //
  // Legacy Firebase ID tokens are still accepted, mirroring echo-auth's own
  // dual-accept design so cutover is zero-downtime. echo-auth preserves the
  // Firebase localId as its uid, so BOTH paths yield the same uid for the same
  // human and nothing downstream has to care which one issued the token.
  let decodedToken = await verifyEchoAuthToken(token);

  if (!decodedToken) {
    const [{ getAuth }, firebaseAdminModule] = await Promise.all([
      import('firebase-admin/auth'),
      import('@/lib/firebase-admin'),
    ]);

    const adminApp = firebaseAdminModule.default;
    if (!adminApp) return null;

    try {
      decodedToken = (await getAuth(adminApp).verifyIdToken(
        token,
        true
      )) as unknown as DecodedIdentity;
    } catch {
      // A failure here genuinely means "not authenticated".
      return null;
    }
  }

  // Stage 2 - authorization. The identity is already proven; only the role is
  // outstanding. Prefer the claim, which travels inside the verified token and
  // needs no external read, so authorization survives an outage of the role
  // store entirely. Both issuers carry it in the same place.
  const claimRole = asRole(decodedToken.role);
  if (claimRole) {
    const claimWorkerType = decodedToken.workerType;
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role: claimRole,
      workerType: typeof claimWorkerType === 'string' ? claimWorkerType : null,
      isDevMode: false,
    };
  }

  // No claim on the token. Fall back to the POSTGRES role store, not Firestore.
  //
  // Firestore was the original fallback, and it made authorization depend on a
  // Google project whose billing state can wall it: when every billing account
  // on the org closed, Firestore returned 429 RESOURCE_EXHAUSTED on every read
  // and production login went down with it. Postgres is already this app's
  // system of record (46 routes use @/lib/prisma) and is hosted off GCP, so a
  // Google billing lapse can no longer decide whether anyone can sign in.
  //
  // The never-fail-open property is kept and is now actually stronger. A read
  // FAILURE still raises RoleStoreUnavailableError (typed 503, retryable) and
  // never assumes a role. A read that SUCCEEDS but matches no row is no longer
  // ambiguous the way an unreadable Firestore document was -- it is a positive
  // statement that this uid has no elevated role -- so 'guest' there is a fact
  // rather than a guess.
  // Imported lazily, mirroring how firebase-admin is loaded above, so the
  // common path -- a token that already carries its role claim -- never pulls
  // the Prisma client into the request at all.
  let userRow: { role: string } | null;
  try {
    const { prisma } = await import('@/lib/prisma');
    userRow = await prisma.user.findFirst({
      where: { authUid: decodedToken.uid, isActive: true },
      select: { role: true },
    });
  } catch (error) {
    throw new RoleStoreUnavailableError(error);
  }

  // Postgres stores roles upper-case, and its vocabulary is wider than the
  // app's ApiUserRole union: CLEANER and MAINTENANCE are both 'worker'. Map
  // explicitly -- an unrecognised value must fall to 'guest', never be
  // coerced into something more privileged.
  const role = asRole(DB_ROLE_MAP[(userRow?.role ?? '').toUpperCase()]) ?? 'guest';

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    role,
    // workerType lives on WorkerProfile, not User. The custom-claim path above
    // carries it, which is the path every provisioned account uses; a
    // DB-sourced role therefore reports null rather than inventing one.
    workerType: null,
    isDevMode: false,
  };
}

async function parseAuthToken(request: NextRequest): Promise<ApiUser | null> {
  return verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  let user: ApiUser | null;
  try {
    user = await parseAuthToken(request);
  } catch (error) {
    if (
      error instanceof RoleStoreUnavailableError ||
      error instanceof IdentityProviderUnavailableError
    ) {
      // Either we could not determine authorization (role store down), or we
      // could not verify identity at all (echo-auth JWKS unreachable). Both are
      // outages, and both must report the real condition -- a retryable 503 --
      // rather than claiming the caller is anonymous. A 401 here would make an
      // outage indistinguishable from a bad credential, which is exactly the
      // failure that hid the Firestore incident for 16 hours.
      return {
        user: null,
        error: NextResponse.json(
          {
            error: 'Authorization store temporarily unavailable',
            code: 'AUTH_BACKEND_UNAVAILABLE',
          },
          { status: 503, headers: { 'Retry-After': '30' } },
        ),
      };
    }
    throw error;
  }

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 },
      ),
    };
  }
  return { user, error: null };
}

const ROLE_HIERARCHY: Record<ApiUserRole, number> = {
  guest: 0,
  worker: 1,
  admin: 2,
  owner: 3,
};

export async function requireRole(
  request: NextRequest,
  minimumRole: ApiUserRole,
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  if (ROLE_HIERARCHY[auth.user!.role] < ROLE_HIERARCHY[minimumRole]) {
    return {
      user: auth.user,
      error: NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN', required: minimumRole },
        { status: 403 },
      ),
    };
  }

  return auth;
}

export async function requireOneOfRoles(
  request: NextRequest,
  allowedRoles: ApiUserRole[],
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  if (!allowedRoles.includes(auth.user!.role)) {
    return {
      user: auth.user,
      error: NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN', allowed: allowedRoles },
        { status: 403 },
      ),
    };
  }

  return auth;
}
