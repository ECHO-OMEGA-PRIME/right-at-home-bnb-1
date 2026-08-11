import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiUser, requireAuth, requireOneOfRoles } from '@/lib/api-auth';

export async function resolveDatabaseUser(apiUser: ApiUser) {
  if (!apiUser.uid) return null;
  return prisma.user.findFirst({
    // Authorization follows the durable identity link only. Falling back to an
    // email (or treating the auth uid as a database cuid) could resolve a
    // disabled or differently-bound worker after a token/account mismatch.
    where: { authUid: apiUser.uid, isActive: true },
    include: { workerProfile: true },
  });
}

export async function requireOwnerActor(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return { ...auth, dbUser: null };
  const dbUser = await resolveDatabaseUser(auth.user!);
  return { ...auth, dbUser };
}

export async function requireWorkerActor(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return { ...auth, dbUser: null, workerProfile: null };

  const dbUser = await resolveDatabaseUser(auth.user!);
  const workerProfile = dbUser?.workerProfile || null;

  if (auth.user!.role === 'worker' && !workerProfile) {
    return {
      user: auth.user,
      dbUser,
      workerProfile: null,
      error: NextResponse.json(
        { error: 'Worker profile is not configured', code: 'WORKER_PROFILE_REQUIRED' },
        { status: 403 },
      ),
    };
  }

  return { user: auth.user, dbUser, workerProfile, error: null };
}

export async function requireGuestActor(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;
  return auth;
}

export function canManageAllWorkOrders(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export function canAccessWorkerProfile(
  role: string,
  actorWorkerProfileId: string | null | undefined,
  targetWorkerProfileId: string | null | undefined,
): boolean {
  if (canManageAllWorkOrders(role)) return true;
  return Boolean(actorWorkerProfileId && targetWorkerProfileId && actorWorkerProfileId === targetWorkerProfileId);
}
