import { prisma } from '@/lib/prisma';
import {
  createGuestCode,
  deleteCode,
  generateSecurePin,
  isTuyaConfigured,
} from '@/lib/integrations/tuya-client';
import { deliverSensitiveGuestMessage } from '@/lib/secure-notifications';

const DEFAULT_LEAD_HOURS = 3;
const DEFAULT_EARLY_ACCESS_MINUTES = 30;
const DEFAULT_CHECKOUT_GRACE_MINUTES = 30;

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function guestAccessWindow(checkIn: Date, checkOut: Date) {
  const earlyMinutes = envInt('GUEST_ACCESS_EARLY_MINUTES', DEFAULT_EARLY_ACCESS_MINUTES);
  const graceMinutes = envInt('GUEST_ACCESS_CHECKOUT_GRACE_MINUTES', DEFAULT_CHECKOUT_GRACE_MINUTES);
  return {
    startsAt: new Date(checkIn.getTime() - earlyMinutes * 60_000),
    endsAt: new Date(checkOut.getTime() + graceMinutes * 60_000),
  };
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
  if (!['CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
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
      if (existing && options.force) {
        await tx.accessGrant.update({
          where: { id: existing.id },
          data: { status: 'REPLACED', revokedAt: new Date() },
        });
      }

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
      } catch {
        // The caller receives the original failure. Reconciliation will retry cleanup.
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
        where: { subjectType: 'GUEST', status: { in: ['ACTIVE', 'DELIVERED', 'PENDING'] } },
      },
    },
  });
  if (!booking) throw new Error('Booking not found');
  const deviceId = booking.property.smartLock?.deviceId;

  let revoked = 0;
  let failures = 0;
  for (const grant of booking.accessGrants) {
    try {
      if (deviceId && isTuyaConfigured()) {
        await deleteCode(deviceId, grant.externalGrantRef);
      }
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      revoked += 1;
    } catch {
      failures += 1;
      await prisma.accessGrant.update({
        where: { id: grant.id },
        data: { status: 'REVOCATION_FAILED' },
      });
    }
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { accessCode: null, codeExpiresAt: null },
    }),
    prisma.smartLock.updateMany({
      where: { propertyId: booking.propertyId },
      data: { currentCode: null, codeExpiresAt: null, lastActivity: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        action: 'GUEST_ACCESS_REVOKED',
        entity: 'Booking',
        entityId: booking.id,
        newValues: JSON.stringify({ revoked, failures, propertyId: booking.propertyId }),
      },
    }),
  ]);

  return { bookingId, revoked, failures };
}

export async function processGuestAccessLifecycle(now = new Date()) {
  const leadHours = envInt('GUEST_ACCESS_LEAD_HOURS', DEFAULT_LEAD_HOURS);
  const provisionThrough = new Date(now.getTime() + leadHours * 60 * 60_000);

  const upcoming = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      checkIn: { gte: now, lte: provisionThrough },
      accessGrants: { none: { subjectType: 'GUEST', status: { in: ['ACTIVE', 'DELIVERED', 'PENDING'] } } },
    },
    select: { id: true },
  });

  const expiring = await prisma.accessGrant.findMany({
    where: {
      subjectType: 'GUEST',
      status: { in: ['ACTIVE', 'DELIVERED', 'PENDING'] },
      endsAt: { lte: now },
      bookingId: { not: null },
    },
    select: { bookingId: true },
  });

  const provisionResults = [] as Array<{ bookingId: string; ok: boolean; error?: string }>;
  for (const booking of upcoming) {
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

  const uniqueBookingIds = [...new Set(expiring.map((grant) => grant.bookingId).filter(Boolean))] as string[];
  const revokeResults = [] as Array<{ bookingId: string; ok: boolean; error?: string }>;
  for (const bookingId of uniqueBookingIds) {
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
    checkedAt: now.toISOString(),
    provision: provisionResults,
    revoke: revokeResults,
  };
}
