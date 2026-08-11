/**
 * Bind a pre-provisioned RAH user row to the caller's verified identity.
 *
 * This is deliberately separate from token verification: authentication must
 * be read-only. The only mutation here is a one-time compare-and-set from NULL
 * to the verified token uid; it never overwrites a link or edits role/profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const AUTH_COOKIE_NAME = 'rah-auth-token';

function rejectedLink(
  body: Record<string, unknown>,
  init: { status: number; headers?: Record<string, string> },
) {
  const response = NextResponse.json(body, init);
  // Linking is part of sign-in. A rejected/ambiguous link must invalidate the
  // just-created HttpOnly session even if the browser's follow-up logout call
  // is interrupted. The public, idempotent logout route remains a second line.
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const caller = auth.user!;

  try {
    // An already-linked preserved Firebase localId remains valid even when the
    // legacy import recorded email_verified=false. Verification is required
    // only to CLAIM a row by email, never to use an exact existing UID link.
    const exact = await prisma.user.findFirst({
      where: { authUid: caller.uid, isActive: true },
      select: { id: true },
    });
    if (exact) return NextResponse.json({ ok: true, linked: true });

    if (!caller.email || !caller.emailVerified) {
      return rejectedLink(
        { error: 'A verified email is required', code: 'VERIFIED_EMAIL_REQUIRED' },
        { status: 403 },
      );
    }

    const candidates = await prisma.user.findMany({
      where: { email: { equals: caller.email, mode: 'insensitive' } },
      select: { id: true, authUid: true, isActive: true },
      take: 2,
    });

    // Do not reveal whether an unrelated address is provisioned.
    if (candidates.length === 0) return NextResponse.json({ ok: true, linked: false });
    if (candidates.length !== 1) {
      return rejectedLink(
        { error: 'Identity link is ambiguous', code: 'IDENTITY_LINK_CONFLICT' },
        { status: 409 },
      );
    }
    const [candidate] = candidates;
    if (!candidate.isActive) {
      return rejectedLink(
        { error: 'This account is inactive', code: 'ACCOUNT_INACTIVE' },
        { status: 403 },
      );
    }
    if (candidate.authUid && candidate.authUid !== caller.uid) {
      return rejectedLink(
        { error: 'This account is linked to another identity', code: 'IDENTITY_LINK_CONFLICT' },
        { status: 409 },
      );
    }
    if (candidate.authUid === caller.uid) {
      return NextResponse.json({ ok: true, linked: true });
    }

    const claimed = await prisma.user.updateMany({
      where: { id: candidate.id, authUid: null, isActive: true },
      data: { authUid: caller.uid },
    });
    if (claimed.count === 1) {
      return NextResponse.json({ ok: true, linked: true });
    }

    const winner = await prisma.user.findUnique({
      where: { id: candidate.id },
      select: { authUid: true },
    });
    if (winner?.authUid === caller.uid) {
      return NextResponse.json({ ok: true, linked: true });
    }
    return rejectedLink(
      { error: 'This account is linked to another identity', code: 'IDENTITY_LINK_CONFLICT' },
      { status: 409 },
    );
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error('[auth/link] failed', { incidentId, error });
    return rejectedLink(
      { error: 'Identity linking is temporarily unavailable', code: 'AUTH_BACKEND_UNAVAILABLE', incidentId },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }
}
