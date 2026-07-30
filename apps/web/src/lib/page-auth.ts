import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiUser, ApiUserRole, verifyAuthToken } from '@/lib/api-auth';

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
  const user = await verifyAuthToken(token);

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent('/properties/new')}`);
  }

  if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
    redirect(user.role === 'worker' ? '/worker' : user.role === 'guest' ? '/properties' : '/dashboard');
  }

  return user;
}
