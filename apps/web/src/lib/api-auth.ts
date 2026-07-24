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

  try {
    const [{ getAuth }, firebaseAdminModule] = await Promise.all([
      import('firebase-admin/auth'),
      import('@/lib/firebase-admin'),
    ]);

    const adminApp = firebaseAdminModule.default;
    const db = firebaseAdminModule.db;
    if (!adminApp || !db) return null;

    const decodedToken = await getAuth(adminApp).verifyIdToken(token, true);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const data = userDoc.exists ? userDoc.data() : undefined;
    const candidateRole = data?.role as ApiUserRole | undefined;
    const role = candidateRole && VALID_ROLES.has(candidateRole) ? candidateRole : 'guest';

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role,
      workerType: typeof data?.workerType === 'string' ? data.workerType : null,
      isDevMode: false,
    };
  } catch {
    return null;
  }
}

async function parseAuthToken(request: NextRequest): Promise<ApiUser | null> {
  return verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await parseAuthToken(request);
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
