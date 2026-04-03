/**
 * Booking Automations — Triggered when new bookings are detected via iCal sync.
 * Replaces the webhook-based triggers with sync-driven automation.
 *
 * Actions on NEW booking:
 *  1. Create cleaning job (turnover at checkout)
 *  2. Generate smart lock code (valid check-in to check-out)
 *  3. Schedule welcome message
 *  4. Log automation event
 *
 * Actions on MODIFIED booking (dates changed):
 *  1. Update cleaning job schedule
 *  2. Update lock code validity window
 *
 * Actions on CANCELLED booking:
 *  1. Cancel cleaning job
 *  2. Expire lock code
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
    welcomeMessage: { success: boolean; id?: string; error?: string };
  };
}

// ============================================
// LOCK CODE GENERATOR
// ============================================

/**
 * Generate a 4-digit lock code based on booking dates.
 * Uses last 4 digits of check-in date + property hash for uniqueness.
 */
function generateLockCodeForBooking(checkIn: Date, propertyId: string): string {
  const month = String(checkIn.getMonth() + 1).padStart(2, '0');
  const day = String(checkIn.getDate()).padStart(2, '0');
  // Add property hash for uniqueness across properties on same date
  const hash = propertyId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100;
  const suffix = String(hash).padStart(2, '0');
  // 4-6 digit code: MMDD + hash suffix
  const code = `${month}${day}${suffix}`;
  // Ensure it's not a trivial code
  if (['0000', '1234', '1111', '9999'].includes(code.slice(0, 4))) {
    return `${day}${month}${suffix}`;
  }
  return code;
}

// ============================================
// AUTOMATION: CREATE CLEANING JOB
// ============================================

async function createCleaningJobForBooking(event: NewBookingEvent): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Check if cleaning job already exists for this booking
    const existing = await prisma.cleaningJob.findUnique({
      where: { bookingId: event.bookingId },
    });
    if (existing) {
      return { success: true, id: existing.id, error: 'already_exists' };
    }

    const job = await prisma.cleaningJob.create({
      data: {
        propertyId: event.propertyId,
        bookingId: event.bookingId,
        scheduledAt: event.checkOut,
        jobType: 'TURNOVER',
        status: 'SCHEDULED',
        notes: `Auto-created for ${event.guestName} (${event.platform}) checkout. Confirm: ${event.confirmCode}`,
      },
    });

    console.log(`[automation] Cleaning job created: ${job.id} for ${event.propertyName} @ ${event.checkOut.toISOString()}`);
    return { success: true, id: job.id };
  } catch (err: any) {
    console.error(`[automation] Cleaning job failed for ${event.propertyName}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ============================================
// AUTOMATION: GENERATE LOCK CODE
// ============================================

async function setLockCodeForBooking(event: NewBookingEvent): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    // Find the smart lock for this property
    const lock = await prisma.smartLock.findUnique({
      where: { propertyId: event.propertyId },
    });

    const code = generateLockCodeForBooking(event.checkIn, event.propertyId);

    if (lock) {
      // Update existing lock with new code
      await prisma.smartLock.update({
        where: { id: lock.id },
        data: {
          currentCode: code,
          codeExpiresAt: event.checkOut,
          lastActivity: new Date(),
        },
      });
      console.log(`[automation] Lock code set: ${code} for ${event.propertyName} (${event.checkIn.toLocaleDateString()} - ${event.checkOut.toLocaleDateString()})`);
    } else {
      // No smart lock configured — just log the code for manual entry
      console.log(`[automation] Lock code generated (no smart lock): ${code} for ${event.propertyName}`);
    }

    return { success: true, code };
  } catch (err: any) {
    console.error(`[automation] Lock code failed for ${event.propertyName}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ============================================
// AUTOMATION: SCHEDULE WELCOME MESSAGE
// ============================================

async function scheduleWelcomeMessage(event: NewBookingEvent): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Check if welcome message already exists for this booking
    const existing = await prisma.message.findFirst({
      where: { bookingId: event.bookingId, type: 'WELCOME' },
    });
    if (existing) {
      return { success: true, id: existing.id, error: 'already_exists' };
    }

    // Schedule welcome message 24 hours before check-in
    const sendAt = new Date(event.checkIn.getTime() - 24 * 60 * 60 * 1000);
    // If check-in is less than 24h away, schedule for now
    const scheduledFor = sendAt < new Date() ? new Date() : sendAt;

    const property = await prisma.property.findUnique({
      where: { id: event.propertyId },
      select: { name: true, address: true },
    });

    const msg = await prisma.message.create({
      data: {
        guestId: event.guestId,
        bookingId: event.bookingId,
        type: 'WELCOME',
        channel: 'VRBO',
        subject: `Welcome to ${property?.name || 'your rental'}!`,
        body: buildWelcomeMessage(event.guestName, property?.name || '', event.checkIn, property?.address || ''),
        status: 'SCHEDULED',
        scheduledFor,
      },
    });

    console.log(`[automation] Welcome message scheduled: ${msg.id} for ${event.guestName} @ ${scheduledFor.toISOString()}`);
    return { success: true, id: msg.id };
  } catch (err: any) {
    console.error(`[automation] Welcome message failed for ${event.propertyName}:`, err.message);
    return { success: false, error: err.message };
  }
}

function buildWelcomeMessage(guestName: string, propertyName: string, checkIn: Date, address: string): string {
  const checkInDate = checkIn.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return [
    `Hi ${guestName || 'there'}!`,
    '',
    `We're excited to host you at ${propertyName}! Here are your check-in details:`,
    '',
    `📅 Check-in: ${checkInDate} at 4:00 PM`,
    `📍 Address: ${address}`,
    `🔑 Your door code will be sent the day of check-in.`,
    '',
    `A few reminders:`,
    `• Check-out is at 11:00 AM`,
    `• Please keep noise levels down after 10 PM`,
    `• No smoking inside the property`,
    `• No parties or events`,
    '',
    `If you need anything during your stay, just message us here!`,
    '',
    `Welcome to Midland! 🏡`,
    `- Steven & the Right at Home team`,
  ].join('\n');
}

// ============================================
// MAIN: RUN ALL AUTOMATIONS FOR A NEW BOOKING
// ============================================

export async function runNewBookingAutomations(event: NewBookingEvent): Promise<AutomationResult> {
  console.log(`[automation] ▶ New booking: ${event.guestName} @ ${event.propertyName} (${event.checkIn.toLocaleDateString()} - ${event.checkOut.toLocaleDateString()})`);

  const [cleaningJob, lockCode, welcomeMessage] = await Promise.all([
    createCleaningJobForBooking(event),
    setLockCodeForBooking(event),
    scheduleWelcomeMessage(event),
  ]);

  // Log the automation run
  try {
    await prisma.syncLog.create({
      data: {
        propertyId: event.propertyId,
        syncType: 'booking_automation',
        source: event.platform.toLowerCase(),
        status: [cleaningJob, lockCode, welcomeMessage].every(a => a.success) ? 'success' : 'partial',
        itemsProcessed: 3,
        itemsCreated: [cleaningJob, lockCode, welcomeMessage].filter(a => a.success && a.error !== 'already_exists').length,
        errorMessage: [cleaningJob, lockCode, welcomeMessage].filter(a => !a.success).map(a => a.error).join('; ') || null,
        durationMs: 0,
      },
    });
  } catch {}

  return {
    bookingId: event.bookingId,
    propertyName: event.propertyName,
    guestName: event.guestName,
    actions: { cleaningJob, lockCode, welcomeMessage },
  };
}

// ============================================
// HANDLE MODIFIED BOOKING (dates changed)
// ============================================

export async function runModifiedBookingAutomations(event: NewBookingEvent): Promise<AutomationResult> {
  console.log(`[automation] ✏ Modified booking: ${event.guestName} @ ${event.propertyName}`);

  // Update cleaning job date
  const cleaningJob = await (async () => {
    try {
      const existing = await prisma.cleaningJob.findUnique({ where: { bookingId: event.bookingId } });
      if (existing) {
        await prisma.cleaningJob.update({
          where: { id: existing.id },
          data: { scheduledAt: event.checkOut },
        });
        return { success: true, id: existing.id };
      }
      return createCleaningJobForBooking(event);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  })();

  // Update lock code window
  const lockCode = await setLockCodeForBooking(event);

  return {
    bookingId: event.bookingId,
    propertyName: event.propertyName,
    guestName: event.guestName,
    actions: { cleaningJob, lockCode, welcomeMessage: { success: true, error: 'no_update_needed' } },
  };
}

// ============================================
// HANDLE CANCELLED BOOKING
// ============================================

export async function runCancelledBookingAutomations(bookingId: string, propertyId: string): Promise<void> {
  console.log(`[automation] ✖ Cancelled booking: ${bookingId}`);

  // Cancel cleaning job
  try {
    const job = await prisma.cleaningJob.findUnique({ where: { bookingId } });
    if (job) {
      await prisma.cleaningJob.update({
        where: { id: job.id },
        data: { status: 'CANCELLED' },
      });
    }
  } catch {}

  // Clear lock code
  try {
    const lock = await prisma.smartLock.findUnique({ where: { propertyId } });
    if (lock && lock.currentCode) {
      await prisma.smartLock.update({
        where: { id: lock.id },
        data: { currentCode: null, codeExpiresAt: null },
      });
    }
  } catch {}

  // Cancel scheduled messages
  try {
    await prisma.message.updateMany({
      where: { bookingId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
  } catch {}
}
