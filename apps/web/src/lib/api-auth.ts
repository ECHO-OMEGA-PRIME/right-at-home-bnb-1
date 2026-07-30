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

/** Verify one raw RAH auth token and return its authoritative user identity. */
export async function verifyAuthToken(token: string | undefined): Promise<ApiUser | null> {
  if (!token) return null;

  if (isDevToken(token)) {
    return parseDevToken(token);
  }

  const [{ getAuth }, firebaseAdminModule] = await Promise.all([
    import('firebase-admin/auth'),
    import('@/lib/firebase-admin'),
  ]);

  const adminApp = firebaseAdminModule.default;
  if (!adminApp) return null;

  // Stage 1 - identity. A failure here genuinely means "not authenticated".
  let decodedToken;
  try {
    decodedToken = await getAuth(adminApp).verifyIdToken(token, true);
  } catch {
    return null;
  }

  // Stage 2 - authorization. The identity is already proven; only the role is
  // outstanding. Prefer the custom claim, which travels inside the verified
  // token and needs no external read, so authorization survives a Firestore
  // outage entirely.
  const claimRole = asRole((decodedToken as Record<string, unknown>).role);
  if (claimRole) {
    const claimWorkerType = (decodedToken as Record<string, unknown>).workerType;
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role: claimRole,
      workerType: typeof claimWorkerType === 'string' ? claimWorkerType : null,
      isDevMode: false,
    };
  }

  const db = firebaseAdminModule.db;
  if (!db) throw new RoleStoreUnavailableError('firestore client unavailable');

  let userDoc;
  try {
    userDoc = await db.collection('users').doc(decodedToken.uid).get();
  } catch (error) {
    // Do NOT downgrade to 'guest' here: a read failure is indistinguishable
    // from an absent document, and silently guessing either way is wrong.
    throw new RoleStoreUnavailableError(error);
  }

  const data = userDoc.exists ? userDoc.data() : undefined;
  const role = asRole(data?.role) ?? 'guest';

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || null,
    role,
    workerType: typeof data?.workerType === 'string' ? data.workerType : null,
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
    if (error instanceof RoleStoreUnavailableError) {
      // Authenticated, but we cannot determine authorization. Report the real
      // condition (503, retryable) instead of claiming the caller is anonymous.
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
