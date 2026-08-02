/**
 * Right at Home BnB - POST /api/register
 *
 * Server-side registration side effects for the authenticated caller.
 *
 * The browser still creates the auth session. This route owns the database
 * writes that used to happen in Firestore from the client, so the user's
 * identity comes from the verified token and not from the request body.
 *
 * TWO RULES GOVERN EVERYTHING BELOW, and both exist because the flow this
 * replaces broke them:
 *
 *  1. WHO the caller is comes only from the verified token. The old client
 *     wrote a Firestore document keyed on whatever email sat in a form field.
 *     Reading `body.email` here -- even as a fallback for a token that carries
 *     no email -- would let a caller name any existing account and have this
 *     route rebind that row's `authUid` to their own uid. A pre-provisioned
 *     administrator row with a NULL `authUid` would make that fallback a
 *     one-request path to admin.
 *
 *  2. WHAT the caller may become never comes from the request at all. The form
 *     posts `accountType: 'staff'` with a `staffType`; the old code wrote that
 *     choice into the role store and displayed a "pending approval" toast that
 *     nothing enforced. `CLEANER` maps to the `worker` role in `api-auth.ts`,
 *     so a self-registered "cleaner" immediately satisfied
 *     `requireRole(request, 'worker')`. A staff request is now recorded as a
 *     StaffApplication, which grants nothing and awaits an admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type RegisterAccountType = 'guest' | 'staff';
type StaffType = 'cleaner' | 'yard_crew' | 'handyman';

const STAFF_TYPES = new Set<StaffType>(['cleaner', 'yard_crew', 'handyman']);

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeAccountType(value: unknown): RegisterAccountType {
  return value === 'staff' ? 'staff' : 'guest';
}

/** Allowlist, not a cast: an unknown staffType must not reach the database. */
function normalizeStaffType(value: unknown): StaffType | null {
  return typeof value === 'string' && STAFF_TYPES.has(value as StaffType)
    ? (value as StaffType)
    : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const caller = auth.user;
  if (!caller) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const firstName = normalizeName(body.firstName);
    const lastName = normalizeName(body.lastName);
    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const accountType = normalizeAccountType(body.accountType);

    if (!firstName || !lastName || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName' },
        { status: 400 },
      );
    }

    const staffType = accountType === 'staff' ? normalizeStaffType(body.staffType) : null;
    if (accountType === 'staff' && !staffType) {
      return NextResponse.json(
        { error: 'Unrecognised staffType', code: 'INVALID_STAFF_TYPE' },
        { status: 400 },
      );
    }

    // Rule 1. The token is the ONLY source of the email. No body fallback.
    const email = caller.email?.trim().toLowerCase();
    if (!email || !caller.emailVerified) {
      return NextResponse.json(
        {
          error:
            'Your sign-in does not carry a verified email address, so an account cannot be created.',
          code: 'VERIFIED_EMAIL_REQUIRED',
        },
        { status: 400 },
      );
    }

    const phone = normalizePhone(body.phone);

    // An existing row may only be claimed when it is unclaimed. Rebinding a row
    // that already belongs to a different uid would be an account takeover even
    // with a verified email, because two auth providers can vouch for the same
    // address with different uids. Claiming a NULL row is the legitimate case
    // and the one that matters in practice: RAH's admin was seeded into
    // Postgres with no auth account at all and cannot otherwise sign in.
    const exactIdentity = await prisma.user.findFirst({
      where: { authUid: caller.uid },
      select: { id: true, authUid: true, isActive: true },
    });

    const candidates = exactIdentity
      ? []
      : await prisma.user.findMany({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, authUid: true, isActive: true },
          take: 2,
        });
    if (!exactIdentity && candidates.length > 1) {
      return NextResponse.json(
        { error: 'Account identity is ambiguous.', code: 'EMAIL_ALREADY_REGISTERED' },
        { status: 409 },
      );
    }
    const existing = exactIdentity ?? candidates[0] ?? null;

    if (existing && !existing.isActive) {
      return NextResponse.json(
        { error: 'This account is inactive.', code: 'ACCOUNT_INACTIVE' },
        { status: 403 },
      );
    }

    if (existing?.authUid && existing.authUid !== caller.uid) {
      return NextResponse.json(
        {
          error: 'An account already exists for this email address.',
          code: 'EMAIL_ALREADY_REGISTERED',
        },
        { status: 409 },
      );
    }

    let user: { id: string; email: string; role: string; name: string };
    if (existing) {
      if (existing.authUid === null) {
        const claimed = await prisma.user.updateMany({
          where: { id: existing.id, authUid: null, isActive: true },
          data: { authUid: caller.uid },
        });
        if (claimed.count !== 1) {
          const winner = await prisma.user.findUnique({
            where: { id: existing.id },
            select: { authUid: true },
          });
          if (winner?.authUid !== caller.uid) {
            return NextResponse.json(
              { error: 'An account already exists for this email address.', code: 'EMAIL_ALREADY_REGISTERED' },
              { status: 409 },
            );
          }
        }
      }

      // A seeded/privileged row keeps all administrator-managed profile fields.
      // Registration proves identity linkage; it is not a profile-edit route.
      user = await prisma.user.findUniqueOrThrow({
        where: { id: existing.id },
        select: { id: true, email: true, role: true, name: true },
      });
    } else {
      // Rule 2. A brand-new self-service account starts at least privilege.
      user = await prisma.user.create({
        data: {
          email,
          authUid: caller.uid,
          name: displayName,
          phone,
          role: 'GUEST',
          isActive: true,
        },
        select: { id: true, email: true, role: true, name: true },
      });
    }

    if (staffType) {
      await prisma.staffApplication.create({
        data: { userId: user.id, requestedType: staffType, status: 'PENDING' },
      });
    }

    // The CRM guest record exists for guests. Writing one for a staff signup
    // was not merely noise: the old update nulled `notes`, `tags` and
    // `preferences` for a non-guest, which erases real CRM history from an
    // existing Guest row that happens to share the email.
    let guest: { id: string; email: string; name: string } | null = null;
    if (accountType === 'guest') {
      guest = await prisma.guest.upsert({
        where: { email },
        update: {
          name: displayName,
          phone,
          platform: 'DIRECT',
          platformId: caller.uid,
        },
        create: {
          email,
          name: displayName,
          phone,
          platform: 'DIRECT',
          platformId: caller.uid,
          tags: '["registered_user"]',
          notes: 'Registered through the website signup flow.',
          preferences: '{}',
        },
        select: { id: true, email: true, name: true },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
        guest,
        // Reports the state of the REQUEST, not a grant. A staff applicant is
        // an active GUEST with a pending application, which is exactly what the
        // signup screen tells them.
        status: staffType ? 'PENDING_APPROVAL' : 'ACTIVE',
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    const incidentId = crypto.randomUUID();
    console.error('[register] failed', { incidentId, error });
    return NextResponse.json(
      {
        error: 'Failed to register account',
        code: 'REGISTRATION_UNAVAILABLE',
        incidentId,
      },
      { status: 500 },
    );
  }
}
