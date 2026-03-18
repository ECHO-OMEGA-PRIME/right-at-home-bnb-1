/**
 * Right at Home BnB — Server-side API Route Authentication
 * Validates auth tokens and extracts user role for API route protection.
 *
 * Usage in any API route:
 *   import { requireAuth, requireRole } from '@/lib/api-auth';
 *
 *   export async function GET(request: NextRequest) {
 *     const auth = await requireAuth(request);
 *     if (auth.error) return auth.error; // Returns 401 NextResponse
 *     // auth.user is available with uid, role, email
 *   }
 *
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

/**
 * Parse the auth cookie and extract user info.
 * In production, this verifies Firebase ID tokens via firebase-admin.
 * In dev mode (NODE_ENV !== 'production'), it also accepts dev tokens.
 */
async function parseAuthToken(request: NextRequest): Promise<ApiUser | null> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  // Dev mode tokens: "dev_role_workerType" (only in non-production)
  if (token.startsWith('dev_') || token.startsWith('dev-mode-')) {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_LOGIN) {
      return null; // Reject dev tokens in production
    }

    // Parse dev token format: "dev_role_workerType" or "dev-mode-dev_role_..."
    const cleanToken = token.replace('dev-mode-', '');
    const parts = cleanToken.split('_');
    // Format: dev_role_workerType_timestamp
    const role = (parts[1] || 'guest') as ApiUserRole;
    const workerType = parts[2] && parts[2] !== 'general' ? parts[2] : null;

    return {
      uid: cleanToken,
      email: null,
      role,
      workerType,
      isDevMode: true,
    };
  }

  // Firebase ID token verification
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const { default: adminApp } = await import('@/lib/firebase-admin');

    if (!adminApp) {
      // Firebase Admin not configured — allow through in development
      if (process.env.NODE_ENV !== 'production') {
        return {
          uid: 'unverified',
          email: null,
          role: 'guest',
          workerType: null,
          isDevMode: false,
        };
      }
      return null;
    }

    const auth = getAuth(adminApp);
    const decodedToken = await auth.verifyIdToken(token);

    // Look up user role from Firestore
    const { db } = await import('@/lib/firebase-admin');
    let role: ApiUserRole = 'guest';
    let workerType: string | null = null;

    if (db) {
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        role = (data?.role as ApiUserRole) || 'guest';
        workerType = data?.workerType || null;
      }
    }

    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role,
      workerType,
      isDevMode: false,
    };
  } catch (err) {
    // Token verification failed
    return null;
  }
}

/**
 * Require authentication for an API route.
 * Returns { user, error } — check error first.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await parseAuthToken(request);

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}

/**
 * Require a specific role (or higher) for an API route.
 * Role hierarchy: owner > admin > worker > guest
 */
const ROLE_HIERARCHY: Record<ApiUserRole, number> = {
  guest: 0,
  worker: 1,
  admin: 2,
  owner: 3,
};

export async function requireRole(
  request: NextRequest,
  minimumRole: ApiUserRole
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const userLevel = ROLE_HIERARCHY[auth.user!.role];
  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  if (userLevel < requiredLevel) {
    return {
      user: auth.user,
      error: NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN', required: minimumRole },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Require one of specific roles.
 */
export async function requireOneOfRoles(
  request: NextRequest,
  allowedRoles: ApiUserRole[]
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  if (!allowedRoles.includes(auth.user!.role)) {
    return {
      user: auth.user,
      error: NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN', allowed: allowedRoles },
        { status: 403 }
      ),
    };
  }

  return auth;
}
