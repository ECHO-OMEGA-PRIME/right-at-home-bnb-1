import { prisma } from '@/lib/prisma';
import {
  assertCodePresent,
  createGuestCode,
  deleteCode,
  generateSecurePin,
  isTuyaConfigured,
} from '@/lib/integrations/tuya-client';
import {
  guestAccessCandidateDateBounds,
  guestAccessWindowForBooking,
} from '@/lib/guest-access-time';
import {
  ALERT_LOOKUP_UNKNOWN,
  createAlert,
  findOpenAlert,
} from '@/lib/operational-alerts';
import { deliverSensitiveGuestMessage } from '@/lib/secure-notifications';

const DEFAULT_LEAD_HOURS = 3;
const DEFAULT_EARLY_ACCESS_MINUTES = 30;
const DEFAULT_CHECKOUT_GRACE_MINUTES = 30;
const ELIGIBLE_BOOKING_STATUSES = [
  'CONFIRMED', 'confirmed', 'Confirmed',
  'CHECKED_IN', 'checked_in', 'CheckedIn',
];
const REVOCABLE_GRANT_STATUSES = ['ACTIVE', 'DELIVERED', 'PENDING', 'REVOCATION_FAILED'];

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function guestAccessWindow(checkIn: Date, checkOut: Date) {
  const earlyMinutes = envInt('GUEST_ACCESS_EARLY_MINUTES', DEFAULT_EARLY_ACCESS_MINUTES);
  const graceMinutes = envInt('GUEST_ACCESS_CHECKOUT_GRACE_MINUTES', DEFAULT_CHECKOUT_GRACE_MINUTES);
  return guestAccessWindowForBooking(checkIn, checkOut, earlyMinutes, graceMinutes);
}

async function createAlertOnce(input: Parameters<typeof createAlert>[0]): Promise<void> {
  if (!input.dedupeKey) return;
  const existing = await findOpenAlert(input.dedupeKey);
  if (existing === ALERT_LOOKUP_UNKNOWN || existing) return;
  await createAlert(input);
}

function externalGrantId(result: any): string {
  const raw = result?.id ?? result?.password_id ?? result?.passwordId;
  if (raw === undefined || raw === null || String(raw).length === 0) {
    throw new Error('Tuya did not return a temporary-password identifier');
  }
  return String(raw);
}

export interface AccessProvisionResult {
  accessGrantId: string;
  bookingId: string;
  propertyId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  deliveryChannel: string | null;
  deliveryReceiptRef: string | null;
  alreadyProvisioned: boolean;
}

/**
 * Creates and delivers a guest code without persisting the plaintext PIN.
 * If delivery fails, the physical code is revoked before the error is returned.
 */
export async function provisionGuestAccess(
  bookingId: string,
  options: { force?: boolean } = {},
): Promise<AccessProvisionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      property: { include: { smartLock: true } },
      accessGrants: {
        where: { subjectType: 'GUEST', status: { in: ['ACTIVE', 'DELIVERED', 'PENDING'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!booking) throw new Error('Booking not found');
  if (!ELIGIBLE_BOOKING_STATUSES.includes(booking.status)) {
    throw new Error(`Booking status ${booking.status} is not eligible for access provisioning`);
  }

  const existing = booking.accessGrants[0];
  if (existing && !options.force) {
    return {
      accessGrantId: existing.id,
      bookingId,
      propertyId: booking.propertyId,
      status: existing.status,
      startsAt: existing.startsAt.toISOString(),
      endsAt: existing.endsAt.toISOString(),
      deliveryChannel: existing.deliveryChannel,
      deliveryReceiptRef: existing.deliveryReceiptRef,
      alreadyProvisioned: true,
    };
  }

  if (existing && options.force) {
    const revocation = await revokeGuestAccess(bookingId);
    if (revocation.failures > 0) {
      throw new Error('Existing guest access could not be safely revoked');
    }
    return provisionGuestAccess(bookingId);
  }

  const lock = booking.property.smartLock;
  if (!lock?.deviceId) throw new Error('Property has no configured smart lock');
  if (!isTuyaConfigured()) throw new Error('Tuya integration is not configured');

  const { startsAt, endsAt } = guestAccessWindow(booking.checkIn, booking.checkOut);
  const pin = generateSecurePin();
  let tuyaRef: string | null = null;

  try {
    const result = await createGuestCode(
      lock.deviceId,
      booking.guest.name,
      pin,
      startsAt,
      endsAt,
    );
    tuyaRef = externalGrantId(result);
    await assertCodePresent(lock.deviceId, tuyaRef);

    const message = [
      `Your Right at Home BnB door code is ${pin}.`,
      `It activates ${startsAt.toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
      `and expires ${endsAt.toLocaleString('en-US', { timeZone: 'America/Chicago' })}.`,
      'Do not share this code. Contact us immediately if you have trouble entering the property.',
    ].join(' ');

    const receipt = await deliverSensitiveGuestMessage({
      email: booking.guest.email,
      phone: booking.guest.phone,
      subject: `Your access instructions for ${booking.property.name}`,
      message,
    });

    const grant = await prisma.$transaction(async (tx) => {
      const created = await tx.accessGrant.create({
        data: {
          propertyId: booking.propertyId,
          bookingId: booking.id,
          subjectType: 'GUEST',
          provider: 'TUYA',
          externalGrantRef: tuyaRef!,
          status: 'DELIVERED',
          startsAt,
          endsAt,
          deliveredAt: new Date(receipt.deliveredAt),
          deliveryChannel: receipt.channel,
          deliveryReceiptRef: receipt.receiptId,
        },
      });

      // Remove any legacy plaintext copies. New access grants store references only.
      await tx.booking.update({
        where: { id: booking.id },
        data: { accessCode: null, codeExpiresAt: endsAt },
      });
      await tx.smartLock.update({
        where: { propertyId: booking.propertyId },
        data: { currentCode: null, codeExpiresAt: endsAt, lastActivity: new Date() },
      });
      await tx.auditLog.create({
        data: {
          action: 'GUEST_ACCESS_PROVISIONED',
          entity: 'AccessGrant',
          entityId: created.id,
          newValues: JSON.stringify({
            bookingId: booking.id,
            propertyId: booking.propertyId,
            provider: 'TUYA',
            deliveryChannel: receipt.channel,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          }),
        },
      });
      return created;
    });

    return {
      accessGrantId: grant.id,
      bookingId,
      propertyId: booking.propertyId,
      status: grant.status,
      startsAt: grant.startsAt.toISOString(),
      endsAt: grant.endsAt.toISOString(),
      deliveryChannel: grant.deliveryChannel,
      deliveryReceiptRef: grant.deliveryReceiptRef,
      alreadyProvisioned: false,
    };
  } catch (error) {
    if (tuyaRef) {
      try {
        await deleteCode(lock.deviceId, tuyaRef);
      } catch (cleanupError) {
        try {
          await createAlertOnce({
            alertType: 'SMART_LOCK_ORPHANED_GRANT',
            severity: 'CRITICAL',
            title: 'Untracked guest door code requires cleanup',
            message:
              'Guest access setup failed after the provider created a code, and verified rollback also failed.',
            propertyId: booking.propertyId,
            bookingId: booking.id,
            dedupeKey: `smart-lock-orphan:${tuyaRef}`,
            metadata: {
              externalGrantRef: tuyaRef,
              reason: cleanupError instanceof Error ? cleanupError.name : 'unknown',
            },
          });
        } catch {
          // Preserve the original provisioning error; the provider reference is
          // intentionally not written to logs or returned to an unauthenticated caller.
        }
      }
    }
    throw error;
  } finally {
    // Best-effort overwrite of the local binding; plaintext is never persisted or logged.
    // JavaScript strings cannot be guaranteed zeroized, so the value is kept in the
    // narrowest possible scope and never returned.
  }
}

export async function revokeGuestAccess(bookingId: string): Promise<{
  bookingId: string;
  revoked: number;
  failures: number;
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { include: { smartLock: true } },
      accessGrants: {
        where: { subjectType: 'GUEST', status: { in: REVOCABLE_GRANT_STATUSES } },
      },
    },
  });
  if (!booking) throw new Error('Booking not found');
  const deviceId = booking.property.smartLock?.deviceId;

  let revoked = 0;
  let failures = 0;
  const markRevocationFailed = async (grantId: string, reason: string) => {
    await prisma.accessGrant.update({
      where: { id: grantId },
      data: { status: 'REVOCATION_FAILED' },
    });

    try {
      await createAlertOnce({
        alertType: 'SMART_LOCK_REVOCATION_FAILED',
        severity: 'CRITICAL',
        title: 'Guest door-code revocation failed',
        message:
          'A guest access code could not be verified as removed and requires operational follow-up.',
        propertyId: booking.propertyId,
        bookingId: booking.id,
        dedupeKey: `smart-lock-revocation:${grantId}`,
        metadata: { accessGrantId: grantId, reason },
      });
    } catch {
      // The grant remains failed even when the alert store is unavailable.
    }
  };

  for (const grant of booking.accessGrants) {
    try {
      if (grant.provider === 'TUYA') {
        if (!deviceId) throw new Error('SMART_LOCK_MAPPING_MISSING');
        if (!isTuyaConfigured()) throw new Error('TUYA_NOT_CONFIGURED');
        await deleteCode(deviceId, grant.externalGrantRef);
      } else {
        throw new Error('UNSUPPORTED_ACCESS_PROVIDER');
      }
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      revoked += 1;
    } catch (error) {
      failures += 1;
      await markRevocationFailed(
        grant.id,
        error instanceof Error ? error.message : 'TUYA_DELETE_FAILED',
      );
    }
  }

  const cleanup = failures === 0
    ? [
        prisma.booking.update({
          where: { id: booking.id },
          data: { accessCode: null, codeExpiresAt: null },
        }),
        prisma.smartLock.updateMany({
          where: { propertyId: booking.propertyId },
          data: { currentCode: null, codeExpiresAt: null, lastActivity: new Date() },
        }),
      ]
    : [];
  await prisma.$transaction([
    ...cleanup,
    prisma.auditLog.create({
      data: {
        action: failures === 0 ? 'GUEST_ACCESS_REVOKED' : 'GUEST_ACCESS_REVOCATION_FAILED',
        entity: 'Booking',
        entityId: booking.id,
        newValues: JSON.stringify({ revoked, failures, propertyId: booking.propertyId }),
      },
    }),
  ]);

  return { bookingId, revoked, failures };
}

async function selectGuestAccessLifecycle(now: Date) {
  const leadHours = envInt('GUEST_ACCESS_LEAD_HOURS', DEFAULT_LEAD_HOURS);
  const provisionThrough = new Date(now.getTime() + leadHours * 60 * 60_000);
  const bounds = guestAccessCandidateDateBounds(now, provisionThrough);

  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ELIGIBLE_BOOKING_STATUSES },
      checkIn: { lte: bounds.checkInLte },
      checkOut: { gte: bounds.checkOutGte },
      accessGrants: { none: { subjectType: 'GUEST', status: { in: REVOCABLE_GRANT_STATUSES } } },
    },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      property: { select: { smartLock: { select: { deviceId: true } } } },
    },
    orderBy: { checkIn: 'asc' },
    take: 100,
  });

  const eligible = candidates.filter((booking) => {
    const window = guestAccessWindow(booking.checkIn, booking.checkOut);
    return window.checkInAt <= provisionThrough && window.endsAt > now;
  });
  const upcoming = eligible.filter((booking) => Boolean(booking.property.smartLock?.deviceId));
  const skippedNoLock = eligible.length - upcoming.length;

  const revocationCandidates = await prisma.accessGrant.findMany({
    where: {
      subjectType: 'GUEST',
      status: { in: REVOCABLE_GRANT_STATUSES },
      bookingId: { not: null },
      OR: [
        { endsAt: { lte: now } },
        { booking: { is: { status: { notIn: ELIGIBLE_BOOKING_STATUSES } } } },
      ],
    },
    select: { bookingId: true, endsAt: true, booking: { select: { status: true } } },
    orderBy: [{ updatedAt: 'asc' }, { endsAt: 'asc' }],
    take: 100,
  });

  const uniqueBookingIds = [
    ...new Set(revocationCandidates.map((grant) => grant.bookingId).filter(Boolean)),
  ] as string[];

  return {
    checkedAt: now.toISOString(),
    provisionThrough: provisionThrough.toISOString(),
    upcoming,
    skippedNoLock,
    revokeBookingIds: uniqueBookingIds,
    scanned: {
      provisionCandidates: candidates.length,
      revocationCandidates: revocationCandidates.length,
    },
  };
}

/** Read-only lifecycle forecast. It never generates a PIN, calls a provider, writes, or notifies. */
export async function previewGuestAccessLifecycle(now = new Date()) {
  const selection = await selectGuestAccessLifecycle(now);
  return {
    checkedAt: selection.checkedAt,
    provisionThrough: selection.provisionThrough,
    provision: {
      eligible: selection.upcoming.length,
      skippedNoLock: selection.skippedNoLock,
    },
    revoke: { eligibleBookings: selection.revokeBookingIds.length },
    scanned: selection.scanned,
  };
}

async function processGuestAccessLifecycleUnlocked(now: Date) {
  const selection = await selectGuestAccessLifecycle(now);
  const batchSize = Math.min(Math.max(envInt('GUEST_ACCESS_BATCH_SIZE', 3), 1), 10);

  const provisionResults = [] as Array<{ bookingId: string; ok: boolean; error?: string }>;
  for (const booking of selection.upcoming.slice(0, batchSize)) {
    try {
      await provisionGuestAccess(booking.id);
      provisionResults.push({ bookingId: booking.id, ok: true });
    } catch (error) {
      provisionResults.push({
        bookingId: booking.id,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown provisioning failure',
      });
    }
  }

  const revokeResults = [] as Array<{ bookingId: string; ok: boolean; error?: string }>;
  for (const bookingId of selection.revokeBookingIds.slice(0, batchSize)) {
    try {
      const result = await revokeGuestAccess(bookingId);
      revokeResults.push({ bookingId, ok: result.failures === 0 });
    } catch (error) {
      revokeResults.push({
        bookingId,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown revocation failure',
      });
    }
  }

  return {
    checkedAt: selection.checkedAt,
    provision: provisionResults,
    revoke: revokeResults,
    skippedNoLock: selection.skippedNoLock,
    remaining: {
      provision: Math.max(0, selection.upcoming.length - provisionResults.length),
      revoke: Math.max(0, selection.revokeBookingIds.length - revokeResults.length),
    },
  };
}

/** Serialized, bounded mutation runner for cron/manual invocations. */
export async function processGuestAccessLifecycle(now = new Date()) {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(704602925438635313::bigint) AS acquired
      `;
      if (!rows[0]?.acquired) {
        return {
          checkedAt: now.toISOString(),
          provision: [],
          revoke: [],
          skippedNoLock: 0,
          remaining: { provision: 0, revoke: 0 },
          skippedBecauseLeaseHeld: true,
        };
      }
      return processGuestAccessLifecycleUnlocked(now);
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
}
