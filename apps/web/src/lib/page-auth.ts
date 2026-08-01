import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ApiUser,
  ApiUserRole,
  RoleStoreUnavailableError,
  verifyAuthToken,
} from '@/lib/api-auth';

const ROLE_HIERARCHY: Record<ApiUserRole, number> = {
  guest: 0,
  worker: 1,
  admin: 2,
  owner: 3,
};

/**
 * Verify the Firebase ID token stored in the RAH auth cookie and enforce a
 * minimum role before rendering a server route or layout.
 */
export async function requirePageRole(minimumRole: ApiUserRole): Promise<ApiUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get('rah-auth-token')?.value;

  let user: ApiUser | null;
  try {
    user = await verifyAuthToken(token);
  } catch (error) {
    if (error instanceof RoleStoreUnavailableError) {
      // Bouncing an authenticated operator to /login during a role-store outage
      // is what made the incident look like "login is broken". Surface the real
      // fault instead so it is diagnosable from the error boundary and logs.
      throw new Error(
        'Authorization store temporarily unavailable - signed-in session is valid but ' +
          'the role lookup failed. This is a backend outage, not a sign-in problem.',
        { cause: error },
      );
    }
    throw error;
  }

  if (!user) {
    // `redirect` throws rather than returning; returning it also lets control
    // flow analysis narrow `user` to non-null below.
    return redirect(`/login?callbackUrl=${encodeURIComponent('/properties/new')}`);
  }

  if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
    redirect(user.role === 'worker' ? '/worker' : user.role === 'guest' ? '/properties' : '/dashboard');
  }

  return user;
}
