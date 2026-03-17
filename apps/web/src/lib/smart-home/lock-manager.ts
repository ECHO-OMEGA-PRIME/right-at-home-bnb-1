/**
 * Right at Home BnB - Smart Lock Manager
 * Manages lock code lifecycle: generate, set, expire, and revoke
 * access codes for guest stays. Integrates with the SmartLock model.
 */

import prisma from '../../src/lib/prisma';
import { addDays, startOfDay, endOfDay, nowCST } from '../utils/dates';

// ============================================
// TYPES
// ============================================

export interface LockCode {
  code: string;
  propertyId: string;
  bookingId?: string;
  purpose: 'guest' | 'cleaner' | 'maintenance' | 'master';
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
}

export interface LockStatus {
  propertyId: string;
  brand: string;
  model: string | null;
  isOnline: boolean;
  batteryLevel: number | null;
  currentCode: string | null;
  codeExpiresAt: Date | null;
  lastActivity: Date | null;
}

export interface AccessLogEntry {
  timestamp: string;
  action: 'lock' | 'unlock' | 'code_set' | 'code_expired' | 'code_revoked' | 'battery_low';
  code?: string;
  source: string;
  details?: string;
}

// ============================================
// CODE GENERATION
// ============================================

/**
 * Generate a random numeric access code.
 * Default 6 digits. Avoids obvious patterns (000000, 123456, etc.).
 */
export function generateAccessCode(length: number = 6): string {
  const BANNED_CODES = new Set([
    '000000', '111111', '222222', '333333', '444444',
    '555555', '666666', '777777', '888888', '999999',
    '123456', '654321', '112233', '001122', '121212',
    '696969', '420420',
  ]);

  let code: string;
  do {
    const digits: string[] = [];
    for (let i = 0; i < length; i++) {
      digits.push(String(Math.floor(Math.random() * 10)));
    }
    code = digits.join('');
  } while (BANNED_CODES.has(code));

  return code;
}

/**
 * Generate a unique code that doesn't conflict with any active codes across all properties.
 */
async function generateUniqueCode(length: number = 6): Promise<string> {
  // Fetch all active codes
  const activeLocks = await prisma.smartLock.findMany({
    where: {
      currentCode: { not: null },
      codeExpiresAt: { gt: new Date() },
    },
    select: { currentCode: true },
  });

  const activeCodes = new Set(activeLocks.map((l) => l.currentCode).filter(Boolean));
  let attempts = 0;
  const maxAttempts = 100;

  let code = generateAccessCode(length);
  while (activeCodes.has(code) && attempts < maxAttempts) {
    code = generateAccessCode(length);
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate a unique access code after maximum attempts');
  }

  return code;
}

// ============================================
// LOCK OPERATIONS
// ============================================

/**
 * Get the current status of a property's smart lock.
 */
export async function getLockStatus(propertyId: string): Promise<LockStatus | null> {
  const lock = await prisma.smartLock.findUnique({
    where: { propertyId },
  });

  if (!lock) return null;

  return {
    propertyId: lock.propertyId,
    brand: lock.brand,
    model: lock.model,
    isOnline: lock.isOnline,
    batteryLevel: lock.batteryLevel,
    currentCode: lock.currentCode,
    codeExpiresAt: lock.codeExpiresAt,
    lastActivity: lock.lastActivity,
  };
}

/**
 * Set a new access code for a property's smart lock.
 *
 * @param propertyId - The property to set the code for
 * @param validFrom - When the code becomes active
 * @param validUntil - When the code expires
 * @param bookingId - Optional booking ID to link this code to
 * @param customCode - Optional specific code (auto-generated if not provided)
 * @returns The generated/set lock code
 */
export async function setAccessCode(
  propertyId: string,
  validFrom: Date,
  validUntil: Date,
  bookingId?: string,
  customCode?: string
): Promise<LockCode> {
  const lock = await prisma.smartLock.findUnique({
    where: { propertyId },
  });

  if (!lock) {
    throw new Error(`No smart lock found for property: ${propertyId}`);
  }

  if (!lock.isOnline) {
    throw new Error(`Smart lock for property ${propertyId} is offline`);
  }

  const code = customCode || await generateUniqueCode();

  // Update the lock's current code
  await prisma.smartLock.update({
    where: { propertyId },
    data: {
      currentCode: code,
      codeExpiresAt: validUntil,
      lastActivity: new Date(),
      accessLog: appendAccessLog(lock.accessLog, {
        timestamp: new Date().toISOString(),
        action: 'code_set',
        code: maskCode(code),
        source: 'system',
        details: bookingId ? `Booking: ${bookingId}` : 'Manual code set',
      }),
    },
  });

  // If linked to a booking, update the booking's access code
  if (bookingId) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        accessCode: code,
        codeExpiresAt: validUntil,
      },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'SET_CODE',
      entity: 'SmartLock',
      entityId: lock.id,
      newValues: JSON.stringify({
        propertyId,
        bookingId,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        codeMasked: maskCode(code),
      }),
    },
  });

  return {
    code,
    propertyId,
    bookingId,
    purpose: bookingId ? 'guest' : 'master',
    validFrom,
    validUntil,
    isActive: true,
  };
}

/**
 * Generate and set a guest access code for a booking.
 * The code is valid from check-in day (start of day) to checkout day (end of day + 2 hours buffer).
 */
export async function setGuestCode(bookingId: string): Promise<LockCode> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: true },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  // Code valid from start of check-in day to end of checkout day + 2 hour buffer
  const validFrom = startOfDay(booking.checkIn);
  const checkOutEnd = endOfDay(booking.checkOut);
  const validUntil = new Date(checkOutEnd.getTime() + 2 * 60 * 60 * 1000);

  return setAccessCode(
    booking.propertyId,
    validFrom,
    validUntil,
    bookingId
  );
}

/**
 * Generate a temporary cleaner code valid for a specific cleaning window.
 * Default: valid for 4 hours from the scheduled cleaning time.
 */
export async function setCleanerCode(
  propertyId: string,
  scheduledAt: Date,
  durationHours: number = 4
): Promise<LockCode> {
  const validFrom = new Date(scheduledAt.getTime() - 15 * 60 * 1000); // 15 min early buffer
  const validUntil = new Date(scheduledAt.getTime() + durationHours * 60 * 60 * 1000);

  const code = await generateUniqueCode(4); // 4-digit for cleaner convenience

  const lock = await prisma.smartLock.findUnique({
    where: { propertyId },
  });

  if (!lock) {
    throw new Error(`No smart lock found for property: ${propertyId}`);
  }

  // Store the cleaner code in a Setting (separate from the main guest code)
  await prisma.setting.upsert({
    where: { key: `cleaner_code:${propertyId}` },
    create: {
      key: `cleaner_code:${propertyId}`,
      value: JSON.stringify({
        code,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        purpose: 'cleaner',
      }),
      description: `Cleaner access code for property ${propertyId}`,
    },
    update: {
      value: JSON.stringify({
        code,
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        purpose: 'cleaner',
      }),
    },
  });

  return {
    code,
    propertyId,
    purpose: 'cleaner',
    validFrom,
    validUntil,
    isActive: true,
  };
}

/**
 * Revoke the current access code for a property.
 * Used when a guest checks out early, a booking is cancelled, or for security reasons.
 */
export async function revokeAccessCode(propertyId: string, reason: string = 'manual'): Promise<void> {
  const lock = await prisma.smartLock.findUnique({
    where: { propertyId },
  });

  if (!lock) {
    throw new Error(`No smart lock found for property: ${propertyId}`);
  }

  await prisma.smartLock.update({
    where: { propertyId },
    data: {
      currentCode: null,
      codeExpiresAt: null,
      lastActivity: new Date(),
      accessLog: appendAccessLog(lock.accessLog, {
        timestamp: new Date().toISOString(),
        action: 'code_revoked',
        source: 'system',
        details: `Reason: ${reason}`,
      }),
    },
  });

  // Clear the code from any linked bookings
  await prisma.booking.updateMany({
    where: {
      propertyId,
      accessCode: lock.currentCode,
    },
    data: {
      accessCode: null,
      codeExpiresAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'REVOKE_CODE',
      entity: 'SmartLock',
      entityId: lock.id,
      newValues: JSON.stringify({ propertyId, reason }),
    },
  });
}

/**
 * Expire all outdated lock codes across all properties.
 * Should be called on a cron schedule (e.g., every hour).
 */
export async function expireOutdatedCodes(): Promise<number> {
  const now = new Date();
  const expiredLocks = await prisma.smartLock.findMany({
    where: {
      currentCode: { not: null },
      codeExpiresAt: { lt: now },
    },
  });

  let expiredCount = 0;
  for (const lock of expiredLocks) {
    await prisma.smartLock.update({
      where: { id: lock.id },
      data: {
        currentCode: null,
        codeExpiresAt: null,
        lastActivity: now,
        accessLog: appendAccessLog(lock.accessLog, {
          timestamp: now.toISOString(),
          action: 'code_expired',
          source: 'cron',
          details: 'Automatic expiration',
        }),
      },
    });
    expiredCount++;
  }

  // Also clean up expired cleaner codes from Settings
  const cleanerCodeSettings = await prisma.setting.findMany({
    where: { key: { startsWith: 'cleaner_code:' } },
  });
  for (const setting of cleanerCodeSettings) {
    try {
      const data = JSON.parse(setting.value) as { validUntil: string };
      if (new Date(data.validUntil) < now) {
        await prisma.setting.delete({ where: { id: setting.id } });
      }
    } catch {
      // Malformed, clean it up
      await prisma.setting.delete({ where: { id: setting.id } });
    }
  }

  return expiredCount;
}

/**
 * Get all locks with low battery (below threshold).
 * Used for proactive maintenance alerts.
 */
export async function getLowBatteryLocks(threshold: number = 20): Promise<LockStatus[]> {
  const locks = await prisma.smartLock.findMany({
    where: {
      batteryLevel: { lt: threshold },
      batteryLevel: { not: null },
    },
  });

  return locks.map((lock) => ({
    propertyId: lock.propertyId,
    brand: lock.brand,
    model: lock.model,
    isOnline: lock.isOnline,
    batteryLevel: lock.batteryLevel,
    currentCode: lock.currentCode,
    codeExpiresAt: lock.codeExpiresAt,
    lastActivity: lock.lastActivity,
  }));
}

/**
 * Get the access log for a property's lock.
 */
export async function getAccessLog(propertyId: string, limit: number = 50): Promise<AccessLogEntry[]> {
  const lock = await prisma.smartLock.findUnique({
    where: { propertyId },
    select: { accessLog: true },
  });

  if (!lock || !lock.accessLog) return [];

  try {
    const entries = JSON.parse(lock.accessLog) as AccessLogEntry[];
    return entries.slice(-limit);
  } catch {
    return [];
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Mask a code for logging purposes (show first and last digits only).
 * "123456" => "1****6"
 */
function maskCode(code: string): string {
  if (code.length <= 2) return '**';
  return code[0] + '*'.repeat(code.length - 2) + code[code.length - 1];
}

/**
 * Append an entry to the access log JSON string.
 * Keeps the log capped at 200 entries to prevent unbounded growth.
 */
function appendAccessLog(existingLog: string | null, entry: AccessLogEntry): string {
  let entries: AccessLogEntry[] = [];
  if (existingLog) {
    try {
      entries = JSON.parse(existingLog) as AccessLogEntry[];
    } catch {
      entries = [];
    }
  }

  entries.push(entry);

  // Cap at 200 entries (remove oldest)
  if (entries.length > 200) {
    entries = entries.slice(-200);
  }

  return JSON.stringify(entries);
}
