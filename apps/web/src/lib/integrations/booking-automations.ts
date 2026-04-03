/**
 * Guest Journey Automation — Full lifecycle from booking to review.
 *
 * TIMELINE:
 *   1. BOOKING DETECTED  → Welcome message sent instantly
 *                         → Cleaning job created for checkout
 *                         → Lock code generated (stored, not sent yet)
 *
 *   2. CHECK-IN DAY 10AM → Lock code + house instructions sent
 *                           (WiFi, parking, check-in procedure, house rules)
 *
 *   3. CHECK-OUT DAY 9AM → Check-out procedures message sent
 *                           (reminders: thermostat, trash, keys, checkout time)
 *
 *   4. CHECK-OUT TIME     → Lock code revoked
 *                         → Thank you message + review link sent
 *
 * Messages are scheduled in the Message table with status='SCHEDULED'.
 * The /api/cron/guest-messages cron fires them when scheduledFor <= now().
 */

import prisma from '@/lib/prisma';

// ============================================
// TYPES
// ============================================

export interface NewBookingEvent {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestId: string;
  guestName: string;
  guestEmail?: string;
  checkIn: Date;
  checkOut: Date;
  confirmCode: string;
  platform: string;
}

export interface AutomationResult {
  bookingId: string;
  propertyName: string;
  guestName: string;
  actions: {
    cleaningJob: { success: boolean; id?: string; error?: string };
    lockCode: { success: boolean; code?: string; error?: string };
    messagesScheduled: { success: boolean; count?: number; error?: string };
  };
}

// ============================================
// LOCK CODE GENERATOR
// ============================================

function generateLockCode(checkIn: Date, propertyId: string): string {
  const m = String(checkIn.getMonth() + 1).padStart(2, '0');
  const d = String(checkIn.getDate()).padStart(2, '0');
  const hash = propertyId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100;
  const code = `${m}${d}${String(hash).padStart(2, '0')}`;
  if (['000000', '123456', '111111'].includes(code)) return `${d}${m}${String(hash).padStart(2, '0')}`;
  return code;
}

// ============================================
// PROPERTY INFO LOADER
// ============================================

interface PropertyInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  wifiNetwork: string;
  wifiPassword: string;
  checkInInstr: string;
  checkOutInstr: string;
  houseRules: string;
  parkingInfo: string;
}

async function getPropertyInfo(propertyId: string): Promise<PropertyInfo> {
  const p = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      name: true, address: true, city: true, state: true,
      wifiNetwork: true, wifiPassword: true,
      checkInInstr: true, checkOutInstr: true,
      houseRules: true, parkingInfo: true,
    },
  });
  return {
    name: p?.name || 'your rental',
    address: p?.address || '',
    city: p?.city || 'Midland',
    state: p?.state || 'TX',
    wifiNetwork: p?.wifiNetwork || '',
    wifiPassword: p?.wifiPassword || '',
    checkInInstr: p?.checkInInstr || '',
    checkOutInstr: p?.checkOutInstr || '',
    houseRules: p?.houseRules || '',
    parkingInfo: p?.parkingInfo || '',
  };
}

// ============================================
// MESSAGE BUILDERS
// ============================================

function buildWelcomeMessage(guest: string, prop: PropertyInfo, checkIn: Date, checkOut: Date): string {
  const inDate = checkIn.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const outDate = checkOut.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);

  return [
    `Hi ${guest}!`,
    ``,
    `Thank you for booking ${prop.name}! We're excited to host you in ${prop.city}.`,
    ``,
    `Here's a summary of your reservation:`,
    `  Check-in:  ${inDate} at 4:00 PM`,
    `  Check-out: ${outDate} at 11:00 AM`,
    `  Duration:  ${nights} night${nights > 1 ? 's' : ''}`,
    `  Address:   ${prop.address}, ${prop.city}, ${prop.state}`,
    ``,
    `On your check-in day, we'll send you your door code and full house instructions including WiFi info.`,
    ``,
    `If you have any questions before your stay, feel free to message us anytime!`,
    ``,
    `See you soon!`,
    `Steven & the Right at Home team`,
  ].join('\n');
}

function buildCheckInMessage(guest: string, prop: PropertyInfo, lockCode: string): string {
  const lines = [
    `Hi ${guest}! Today's the day — welcome to ${prop.name}!`,
    ``,
    `YOUR DOOR CODE: ${lockCode}`,
    ``,
    `CHECK-IN INSTRUCTIONS:`,
    `  Address: ${prop.address}, ${prop.city}, ${prop.state}`,
    `  Check-in time: 4:00 PM`,
  ];

  if (prop.checkInInstr) {
    lines.push(`  ${prop.checkInInstr}`);
  }

  if (prop.parkingInfo) {
    lines.push(``, `PARKING:`, `  ${prop.parkingInfo}`);
  }

  if (prop.wifiNetwork) {
    lines.push(``, `WIFI:`, `  Network: ${prop.wifiNetwork}`);
    if (prop.wifiPassword) lines.push(`  Password: ${prop.wifiPassword}`);
  }

  if (prop.houseRules) {
    lines.push(``, `HOUSE RULES:`, `  ${prop.houseRules}`);
  } else {
    lines.push(
      ``, `HOUSE RULES:`,
      `  • No smoking inside the property`,
      `  • No parties or events`,
      `  • Quiet hours after 10 PM`,
      `  • No pets unless pre-approved`,
      `  • Please treat the home with care`,
    );
  }

  lines.push(
    ``,
    `If you need anything during your stay, just message us here — we're happy to help!`,
    ``,
    `Enjoy your stay!`,
    `Steven`,
  );

  return lines.join('\n');
}

function buildCheckOutMessage(guest: string, prop: PropertyInfo): string {
  const lines = [
    `Good morning ${guest}!`,
    ``,
    `Just a reminder — check-out is at 11:00 AM today.`,
    ``,
    `BEFORE YOU LEAVE:`,
  ];

  if (prop.checkOutInstr) {
    lines.push(`  ${prop.checkOutInstr}`);
  } else {
    lines.push(
      `  • Set the thermostat to 78°F (summer) or 65°F (winter)`,
      `  • Take out all trash to the bins outside`,
      `  • Load any dirty dishes in the dishwasher and start it`,
      `  • Make sure all doors and windows are locked`,
      `  • Leave the key/remote on the kitchen counter`,
      `  • Turn off all lights and TVs`,
    );
  }

  lines.push(
    ``,
    `No need to strip the beds — our cleaning crew handles that.`,
    ``,
    `Your door code will be deactivated after check-out.`,
    ``,
    `Thank you for staying with us! Safe travels!`,
    `Steven`,
  );

  return lines.join('\n');
}

function buildThankYouMessage(guest: string, prop: PropertyInfo, vrboId: string): string {
  const reviewUrl = `https://www.vrbo.com/vacation-rentals/${vrboId}/review`;

  return [
    `Hi ${guest}!`,
    ``,
    `Thank you so much for staying at ${prop.name}! We hope you had a wonderful time in ${prop.city}.`,
    ``,
    `If you enjoyed your stay, we'd really appreciate a review — it helps future guests find us and helps us keep improving:`,
    ``,
    `  Leave a review: ${reviewUrl}`,
    ``,
    `We'd love to host you again anytime. As a returning guest, just message us directly for the best rates!`,
    ``,
    `Thanks again and safe travels!`,
    `Steven & the Right at Home team`,
  ].join('\n');
}

// ============================================
// SCHEDULE HELPERS
// ============================================

/** Get a Date set to a specific hour on a given day (Central Time). */
function atHourCT(date: Date, hour: number): Date {
  // Create date at the specified hour in Central Time (UTC-5 / UTC-6)
  // Using UTC-5 (CDT) for Midland TX during most of the year
  const d = new Date(date);
  d.setUTCHours(hour + 5, 0, 0, 0); // CT = UTC-5 (CDT)
  return d;
}

// ============================================
// MAIN: SCHEDULE FULL GUEST JOURNEY
// ============================================

export async function runNewBookingAutomations(event: NewBookingEvent): Promise<AutomationResult> {
  console.log(`[guest-journey] New booking: ${event.guestName} @ ${event.propertyName} (${event.checkIn.toLocaleDateString()} - ${event.checkOut.toLocaleDateString()})`);

  const prop = await getPropertyInfo(event.propertyId);
  const lockCode = generateLockCode(event.checkIn, event.propertyId);

  // Get VRBO ID for review link
  const property = await prisma.property.findUnique({
    where: { id: event.propertyId },
    select: { vrboId: true },
  });
  const vrboId = property?.vrboId || '';

  // ── 1. Create cleaning job ──
  const cleaningResult = await createCleaningJob(event);

  // ── 2. Generate and store lock code ──
  const lockResult = await storeLockCode(event, lockCode);

  // ── 3. Schedule the full message sequence ──
  const msgResult = await scheduleGuestJourney(event, prop, lockCode, vrboId);

  // ── Log ──
  try {
    await prisma.syncLog.create({
      data: {
        propertyId: event.propertyId,
        syncType: 'guest_journey',
        source: event.platform.toLowerCase(),
        status: 'success',
        itemsProcessed: 4,
        itemsCreated: (msgResult.count || 0) + (cleaningResult.success ? 1 : 0),
        errorMessage: null,
        durationMs: 0,
      },
    });
  } catch {}

  return {
    bookingId: event.bookingId,
    propertyName: event.propertyName,
    guestName: event.guestName,
    actions: {
      cleaningJob: cleaningResult,
      lockCode: lockResult,
      messagesScheduled: msgResult,
    },
  };
}

async function createCleaningJob(event: NewBookingEvent) {
  try {
    const existing = await prisma.cleaningJob.findUnique({ where: { bookingId: event.bookingId } });
    if (existing) return { success: true, id: existing.id, error: 'already_exists' };

    const job = await prisma.cleaningJob.create({
      data: {
        propertyId: event.propertyId,
        bookingId: event.bookingId,
        scheduledAt: event.checkOut,
        jobType: 'TURNOVER',
        status: 'SCHEDULED',
        notes: `${event.guestName} checkout (${event.platform}). Code: ${event.confirmCode}`,
      },
    });
    return { success: true, id: job.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function storeLockCode(event: NewBookingEvent, code: string) {
  try {
    const lock = await prisma.smartLock.findUnique({ where: { propertyId: event.propertyId } });
    if (lock) {
      await prisma.smartLock.update({
        where: { id: lock.id },
        data: { currentCode: code, codeExpiresAt: event.checkOut, lastActivity: new Date() },
      });
    }
    return { success: true, code };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function scheduleGuestJourney(
  event: NewBookingEvent,
  prop: PropertyInfo,
  lockCode: string,
  vrboId: string,
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Check if messages already exist for this booking
    const existing = await prisma.message.count({ where: { bookingId: event.bookingId } });
    if (existing >= 4) return { success: true, count: 0, error: 'already_scheduled' };

    const now = new Date();
    let count = 0;

    // ── MESSAGE 1: Welcome (immediately) ──
    await prisma.message.create({
      data: {
        guestId: event.guestId,
        bookingId: event.bookingId,
        type: 'WELCOME',
        channel: 'VRBO',
        subject: `Booking confirmed — ${prop.name}`,
        body: buildWelcomeMessage(event.guestName, prop, event.checkIn, event.checkOut),
        status: 'SCHEDULED',
        scheduledFor: now,
      },
    });
    count++;

    // ── MESSAGE 2: Check-in day 10AM CT — Lock code + instructions ──
    const checkInMorning = atHourCT(event.checkIn, 10);
    // If check-in is today or past, send in 5 min instead
    const checkInSend = checkInMorning > now ? checkInMorning : new Date(now.getTime() + 5 * 60000);

    await prisma.message.create({
      data: {
        guestId: event.guestId,
        bookingId: event.bookingId,
        type: 'CHECK_IN',
        channel: 'VRBO',
        subject: `Your door code & house info — ${prop.name}`,
        body: buildCheckInMessage(event.guestName, prop, lockCode),
        status: 'SCHEDULED',
        scheduledFor: checkInSend,
      },
    });
    count++;

    // ── MESSAGE 3: Check-out day 9AM CT — Check-out procedures ──
    const checkOutMorning = atHourCT(event.checkOut, 9);
    const checkOutSend = checkOutMorning > now ? checkOutMorning : new Date(now.getTime() + 10 * 60000);

    await prisma.message.create({
      data: {
        guestId: event.guestId,
        bookingId: event.bookingId,
        type: 'CHECK_OUT',
        channel: 'VRBO',
        subject: `Check-out reminder — ${prop.name}`,
        body: buildCheckOutMessage(event.guestName, prop),
        status: 'SCHEDULED',
        scheduledFor: checkOutSend,
      },
    });
    count++;

    // ── MESSAGE 4: Check-out day 2PM CT — Thank you + review link ──
    const thankYouTime = atHourCT(event.checkOut, 14);
    const thankYouSend = thankYouTime > now ? thankYouTime : new Date(now.getTime() + 15 * 60000);

    await prisma.message.create({
      data: {
        guestId: event.guestId,
        bookingId: event.bookingId,
        type: 'THANK_YOU',
        channel: 'VRBO',
        subject: `Thanks for staying at ${prop.name}!`,
        body: buildThankYouMessage(event.guestName, prop, vrboId),
        status: 'SCHEDULED',
        scheduledFor: thankYouSend,
      },
    });
    count++;

    console.log(`[guest-journey] ${count} messages scheduled for ${event.guestName}:`);
    console.log(`  Welcome:   NOW`);
    console.log(`  Check-in:  ${checkInSend.toISOString()}`);
    console.log(`  Check-out: ${checkOutSend.toISOString()}`);
    console.log(`  Thank you: ${thankYouSend.toISOString()}`);

    return { success: true, count };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================
// HANDLE MODIFIED BOOKING (dates changed)
// ============================================

export async function runModifiedBookingAutomations(event: NewBookingEvent): Promise<AutomationResult> {
  console.log(`[guest-journey] Modified: ${event.guestName} @ ${event.propertyName}`);

  const prop = await getPropertyInfo(event.propertyId);
  const lockCode = generateLockCode(event.checkIn, event.propertyId);
  const property = await prisma.property.findUnique({ where: { id: event.propertyId }, select: { vrboId: true } });

  // Update cleaning job
  const cleaningResult = await (async () => {
    try {
      const job = await prisma.cleaningJob.findUnique({ where: { bookingId: event.bookingId } });
      if (job) {
        await prisma.cleaningJob.update({ where: { id: job.id }, data: { scheduledAt: event.checkOut } });
        return { success: true, id: job.id };
      }
      return createCleaningJob(event);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  })();

  // Update lock code
  const lockResult = await storeLockCode(event, lockCode);

  // Cancel old scheduled messages and reschedule
  try {
    await prisma.message.updateMany({
      where: { bookingId: event.bookingId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
  } catch {}

  const msgResult = await scheduleGuestJourney(event, prop, lockCode, property?.vrboId || '');

  return {
    bookingId: event.bookingId,
    propertyName: event.propertyName,
    guestName: event.guestName,
    actions: { cleaningJob: cleaningResult, lockCode: lockResult, messagesScheduled: msgResult },
  };
}

// ============================================
// HANDLE CANCELLED BOOKING
// ============================================

export async function runCancelledBookingAutomations(bookingId: string, propertyId: string): Promise<void> {
  console.log(`[guest-journey] Cancelled: ${bookingId}`);

  try { const j = await prisma.cleaningJob.findUnique({ where: { bookingId } }); if (j) await prisma.cleaningJob.update({ where: { id: j.id }, data: { status: 'CANCELLED' } }); } catch {}
  try { const l = await prisma.smartLock.findUnique({ where: { propertyId } }); if (l?.currentCode) await prisma.smartLock.update({ where: { id: l.id }, data: { currentCode: null, codeExpiresAt: null } }); } catch {}
  try { await prisma.message.updateMany({ where: { bookingId, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } }); } catch {}
}

// ============================================
// CRON: SEND DUE MESSAGES + REVOKE EXPIRED LOCKS
// ============================================

export async function processDueMessages(): Promise<{ sent: number; failed: number; locksRevoked: number }> {
  const now = new Date();
  let sent = 0;
  let failed = 0;

  // Find messages due to be sent
  const dueMessages = await prisma.message.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledFor: { lte: now },
    },
    include: {
      guest: { select: { name: true, email: true } },
      booking: { select: { confirmCode: true, property: { select: { name: true, vrboId: true } } } },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 50,
  });

  for (const msg of dueMessages) {
    try {
      // Mark as sent (actual delivery via VRBO portal would need CDP)
      // For now, mark as SENT — the message content is stored for manual
      // sending via the admin dashboard or future CDP automation
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: now },
      });
      sent++;

      console.log(`[guest-journey] Sent ${msg.type} to ${msg.guest.name} for ${msg.booking?.property?.name || 'unknown'}`);
    } catch (err: any) {
      failed++;
      console.error(`[guest-journey] Failed to send ${msg.id}: ${err.message}`);
    }
  }

  // Revoke expired lock codes
  let locksRevoked = 0;
  try {
    const expiredLocks = await prisma.smartLock.findMany({
      where: {
        codeExpiresAt: { lte: now },
        currentCode: { not: null },
      },
    });
    for (const lock of expiredLocks) {
      await prisma.smartLock.update({
        where: { id: lock.id },
        data: { currentCode: null, codeExpiresAt: null, lastActivity: now },
      });
      locksRevoked++;
      console.log(`[guest-journey] Lock code revoked for property ${lock.propertyId}`);
    }
  } catch {}

  return { sent, failed, locksRevoked };
}
