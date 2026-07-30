/**
 * The autonomy loop -- the scheduled sweep that watches for things needing action.
 *
 * This ran against four hardcoded arrays and REPORTED ACTIONS IT NEVER TOOK. It
 * announced "Lock code 4821 generated for Sarah Johnson" and "Cleaning
 * dispatched at 11:30" for bookings that did not exist, then mutated its own
 * in-memory array so the same booking would be "handled" again on the next cold
 * start. An operator trusting that output sends a guest to a door with no code
 * and an uncleaned house.
 *
 * Two rules now govern this file:
 *
 *   1. Every detection comes from a real row.
 *   2. An action is only reported as DONE if it actually completed. Work that
 *      failed, or that needs a system we are not wired to, is reported as
 *      PENDING with the real reason attached. "Detected" and "done" are
 *      different words here on purpose.
 *
 * Door codes ARE issued (the Tuya lock proxy is live in this deployment) --
 * an earlier revision refused to, arguing there was no path to the device. That
 * premise was false and Fable's review caught it.
 */

import { prisma } from '@/lib/prisma';
import { onHandByItem } from '@/lib/inventory';

export interface AutonomyAction {
  type: string;
  status: 'done' | 'pending';
  message: string;
  [key: string]: unknown;
}

/**
 * Timezone rules for this file. Two different things, deliberately handled
 * differently -- Fable's review flagged the timezone generally, but the fix is
 * not "convert everything".
 *
 *  - WHICH DAY IS IT: must be Midland local (America/Chicago). Using UTC meant
 *    that from ~7pm Central onward the loop believed it was already tomorrow and
 *    swept the wrong day's arrivals and departures.
 *
 *  - THE DATE RANGES: must stay UTC-midnight. Booking.checkIn/checkOut are
 *    stored as date-only values at exactly T00:00:00.000Z (verified against
 *    production). Shifting those windows into Chicago would move the boundary to
 *    05:00Z and mis-bucket every booking. Date-only data is correctly compared
 *    in the timezone it was stored in.
 *
 *  - A TIME OF DAY (the 11:30 cleaning slot) must be Midland local, or the
 *    cleaner is scheduled for 6:30am.
 */
const BUSINESS_TZ = 'America/Chicago';

/** The calendar date in Midland, not in UTC. */
const dayString = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/**
 * Render a STORED date-only column (checkIn/checkOut/dueDate), which lives at
 * exactly T00:00:00.000Z. These must be read back in UTC: formatting midnight
 * UTC in Chicago renders the PREVIOUS day, which would report a guest arriving
 * on the 30th as arriving on the 29th.
 */
const dateOnlyString = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Convert a wall-clock time on a given local date into the correct UTC instant,
 * honouring whichever of CST/CDT applies on that date.
 */
function localTimeToUtc(day: string, hour: number, minute: number): Date {
  // Start from the naive UTC reading, then subtract the zone's actual offset on
  // that date. Two passes are unnecessary here: the offset for a mid-morning
  // slot never lands on a DST transition boundary in this timezone.
  const naive = new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`);
  const asLocal = new Date(naive.toLocaleString('en-US', { timeZone: BUSINESS_TZ }));
  const asUtc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(naive.getTime() + (asUtc.getTime() - asLocal.getTime()));
}

/**
 * Statuses that mean "this stay is real and still happening".
 *
 * Bookings do NOT stay CONFIRMED. The transition map in
 * app/api/bookings/[id]/route.ts moves confirmed -> checked_in -> checked_out
 * -> completed, and the status domain is case-chaotic (smart-home-handlers
 * writes CHECKED_OUT upper-case, the bookings API writes checked_in lower).
 *
 * Filtering on CONFIRMED alone made the departure sweep blind to every guest
 * who had actually checked in -- precisely the set most likely to need a
 * turnover clean. It emitted no job AND no pending action, so the summary read
 * "nothing to do" for a house that needed cleaning. Caught by Fable in review.
 */
const ACTIVE_STAY = [
  'CONFIRMED', 'confirmed', 'Confirmed',
  'CHECKED_IN', 'checked_in', 'CheckedIn',
];

/** Departures additionally include stays already marked checked out. */
const DEPARTING = [
  ...ACTIVE_STAY,
  'CHECKED_OUT', 'checked_out', 'CheckedOut',
  'COMPLETED', 'completed',
];

function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00.000Z`);
  return {
    // Half-open interval. `lte 23:59:59.999` drops the final millisecond.
    gte: start,
    lt: new Date(start.getTime() + 86_400_000),
  };
}

/**
 * Issue door codes for today's arrivals.
 *
 * An earlier version of this only DETECTED and refused to write, on the grounds
 * that a code in the database with no way to reach the lock is a lie. That
 * reasoning was sound but the premise was false, and Fable's review caught it:
 * the Tuya path is live in this deployment (RAH_API_TOKEN is set, the lock proxy
 * answers, and setGuestCode() is the app's canonical issuance path, already used
 * by booking-automations). Refusing to issue was leaving real guests without a
 * code and emitting a manual-intervention nag every five minutes.
 *
 * So it issues. But it only reports 'done' when the write actually succeeded --
 * a failed push is reported 'pending' with the real error attached, never
 * swallowed.
 */
async function issueArrivalCodes(
  today: string,
  dryRun: boolean,
): Promise<AutonomyAction[]> {
  const arrivals = await prisma.booking.findMany({
    where: { checkIn: dayRange(today), status: { in: ACTIVE_STAY } },
    include: {
      guest: { select: { name: true } },
      property: { select: { id: true, name: true, smartLock: true } },
    },
  });

  const out: AutonomyAction[] = [];

  for (const b of arrivals) {
    const lock = b.property.smartLock;
    const guest = b.guest?.name ?? 'Guest';

    // Covered means covered FOR THE WHOLE STAY, not merely "not expired yet".
    // Checking against `now` let a code expiring tomorrow satisfy a three-night
    // booking: covered today, out of the arrivals window tomorrow, and the guest
    // is locked out mid-stay with the loop reporting everything fine.
    const lockCovers =
      !!lock?.currentCode && !!lock.codeExpiresAt && lock.codeExpiresAt >= b.checkOut;
    // The booking's own code is what the guest-facing assistant quotes, so a
    // code set that way must not raise a false alarm either.
    const bookingCovers =
      !!b.accessCode && (!b.codeExpiresAt || b.codeExpiresAt >= b.checkOut);

    if (lockCovers || bookingCovers) continue;

    const base = {
      booking_id: b.id,
      property_id: b.propertyId,
      property_name: b.property.name,
      guest_name: guest,
      check_in: dateOnlyString(b.checkIn),
      check_out: dateOnlyString(b.checkOut),
      lock_device_id: lock?.deviceId ?? null,
    };

    // No lock registered means there is genuinely nothing to program. Say so;
    // do not manufacture a code that opens nothing.
    if (!lock) {
      out.push({
        ...base,
        type: 'lock_code_needed',
        status: 'pending',
        blocked_by: 'No smart lock is registered for this property.',
        message: `${guest} arrives today at ${b.property.name}, which has no smart lock on record. Let them in manually.`,
      });
      continue;
    }

    if (dryRun) {
      out.push({
        ...base,
        type: 'lock_code_needed',
        status: 'pending',
        message: `Would issue a door code for ${guest} at ${b.property.name}.`,
      });
      continue;
    }

    try {
      const { setGuestCode } = await import('@/lib/smart-home/lock-manager');
      const issued = await setGuestCode(b.id);
      out.push({
        ...base,
        type: 'lock_code_issued',
        status: 'done',
        // The code itself is deliberately NOT echoed into the cron's response.
        // It is a door key; it belongs on the booking and in the guest message,
        // not in a log line that gets pasted into chats and dashboards.
        code_set: true,
        valid_until: issued?.validUntil ? new Date(issued.validUntil).toISOString() : null,
        message: `Door code issued for ${guest} at ${b.property.name}.`,
      });
    } catch (e: any) {
      out.push({
        ...base,
        type: 'lock_code_needed',
        status: 'pending',
        blocked_by: e?.message ?? String(e),
        message: `Could not issue a door code for ${guest} at ${b.property.name}: ${e?.message ?? e}. Issue one manually.`,
      });
    }
  }

  return out;
}

/**
 * Turnover cleaning for today's departures.
 *
 * This one genuinely completes: a CleaningJob is an internal work record and
 * needs no external system. CleaningJob.bookingId is @unique, so re-running the
 * loop cannot create a second job for the same checkout -- which is what makes
 * a five-minute cron safe to run.
 */
async function dispatchTurnoverCleaning(
  today: string,
  dryRun: boolean,
): Promise<AutonomyAction[]> {
  const departures = await prisma.booking.findMany({
    where: { checkOut: dayRange(today), status: { in: DEPARTING } },
    include: {
      guest: { select: { name: true } },
      property: { select: { name: true } },
      cleaningJob: { select: { id: true } },
    },
  });

  const out: AutonomyAction[] = [];
  for (const b of departures) {
    if (b.cleaningJob) continue; // already dispatched on an earlier run

    // 11:30 in MIDLAND, not 11:30Z (which is 6:30am local in summer).
    const scheduledAt = localTimeToUtc(today, 11, 30);
    let jobId: string | null = null;

    if (!dryRun) {
      try {
        const job = await prisma.cleaningJob.create({
          data: {
            propertyId: b.propertyId,
            bookingId: b.id,
            scheduledAt,
            jobType: 'TURNOVER',
            status: 'SCHEDULED',
            notes:
              `Post-checkout turnover for ${b.guest?.name ?? 'guest'}. ` +
              'A same-day arrival is possible; treat as high priority.',
          },
        });
        jobId = job.id;
      } catch (e: any) {
        // ONLY a unique-constraint collision is benign: the constraint did its
        // job and a concurrent run already made this booking's cleaning.
        // A bare `catch { continue }` swallowed FK violations, schema drift and
        // pool exhaustion too, so a systematic failure looped silently forever
        // while the summary reported a clean sweep. Caught by Fable in review.
        if (e?.code === 'P2002') continue;
        out.push({
          type: 'cleaning_dispatch_failed',
          status: 'pending',
          booking_id: b.id,
          property_id: b.propertyId,
          property_name: b.property.name,
          blocked_by: e?.message ?? String(e),
          message: `Could not schedule the turnover clean at ${b.property.name}: ${e?.message ?? e}`,
        });
        continue;
      }
    }

    out.push({
      type: 'cleaning_dispatched',
      status: dryRun ? 'pending' : 'done',
      cleaning_job_id: jobId,
      booking_id: b.id,
      property_id: b.propertyId,
      property_name: b.property.name,
      guest_name: b.guest?.name ?? 'Unknown',
      scheduled_at: scheduledAt.toISOString(),
      message: dryRun
        ? `Would schedule a turnover clean at ${b.property.name} for 11:30.`
        : `Turnover clean scheduled at ${b.property.name} for 11:30 (${b.guest?.name ?? 'guest'} checkout).`,
    });
  }
  return out;
}

/** Invoices past due with a real outstanding balance. */
async function detectOverdueInvoices(today: string): Promise<AutonomyAction[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: new Date(`${today}T00:00:00.000Z`) },
      status: { notIn: ['paid', 'void', 'cancelled', 'draft'] },
    },
  });

  const now = new Date(`${today}T00:00:00.000Z`);
  return invoices
    .map((inv) => ({ inv, balance: inv.totalCents - inv.paidCents }))
    .filter(({ balance }) => balance > 0)
    .map(({ inv, balance }) => {
      const daysOverdue = Math.floor(
        (now.getTime() - inv.dueDate!.getTime()) / 86_400_000,
      );
      return {
        type: 'overdue_invoice',
        status: 'pending' as const,
        invoice_id: inv.id,
        balance_due_cents: balance,
        due_date: dateOnlyString(inv.dueDate!),
        days_overdue: daysOverdue,
        severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium',
        message: `Invoice ${inv.id} is ${daysOverdue} days overdue ($${(balance / 100).toFixed(2)} outstanding).`,
      };
    });
}

/**
 * Items at or below their par level.
 *
 * On-hand is DERIVED from InventoryMovement rows, not stored on the item, so
 * this reads the same figure the inventory screen shows rather than a second
 * counter that could drift from it.
 */
async function detectLowInventory(): Promise<AutonomyAction[]> {
  const [items, onHand] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { isActive: true } }),
    onHandByItem(),
  ]);

  return items
    .map((item) => ({ item, stock: onHand.get(item.id) ?? 0 }))
    .filter(({ item, stock }) => item.parLevel > 0 && stock <= item.parLevel)
    .map(({ item, stock }) => ({
      type: 'low_inventory',
      status: 'pending' as const,
      item_id: item.id,
      item_name: item.name,
      current_stock: stock,
      reorder_point: item.parLevel,
      reorder_quantity: item.reorderQuantity,
      supplier: item.supplier,
      urgency:
        stock === 0 ? 'critical' : stock <= Math.floor(item.parLevel / 2) ? 'high' : 'medium',
      message: `Low stock: ${item.name} (${stock} on hand, par level ${item.parLevel}).`,
    }));
}

/** Tomorrow's arrivals, so a property can be checked before the guest lands. */
async function detectUpcomingArrivals(tomorrow: string): Promise<AutonomyAction[]> {
  const arrivals = await prisma.booking.findMany({
    where: { checkIn: dayRange(tomorrow), status: { in: ACTIVE_STAY } },
    include: {
      guest: { select: { name: true } },
      property: { select: { name: true } },
    },
  });

  return arrivals.map((b) => ({
    type: 'pre_arrival_reminder',
    status: 'pending' as const,
    booking_id: b.id,
    property_id: b.propertyId,
    property_name: b.property.name,
    guest_name: b.guest?.name ?? 'Unknown',
    check_in: dateOnlyString(b.checkIn),
    message: `Tomorrow: ${b.guest?.name ?? 'Guest'} arrives at ${b.property.name}. Verify the property is ready.`,
  }));
}

export async function runAutonomyLoop(opts: { now?: Date; dryRun?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun ?? false;
  const today = dayString(now);
  const tomorrow = dayString(new Date(now.getTime() + 86_400_000));

  // Detections are independent; the write step runs alongside them because a
  // cleaning job for a departure cannot conflict with any of the reads.
  const [lockCodes, cleaning, overdue, lowStock, upcoming] = await Promise.all([
    issueArrivalCodes(today, dryRun),
    dispatchTurnoverCleaning(today, dryRun),
    detectOverdueInvoices(today),
    detectLowInventory(),
    detectUpcomingArrivals(tomorrow),
  ]);

  const actions = [...lockCodes, ...cleaning, ...overdue, ...lowStock, ...upcoming];

  return {
    ran_at: now.toISOString(),
    today,
    dry_run: dryRun,
    summary: {
      // Named for what it is. The old key was lock_codes_generated, which
      // reported a number of codes that had been generated nowhere.
      lock_codes_needed: lockCodes.length,
      cleaning_tasks_dispatched: cleaning.length,
      overdue_invoices: overdue.length,
      low_inventory_alerts: lowStock.length,
      pre_arrival_reminders: upcoming.length,
      total_actions: actions.length,
      actions_completed: actions.filter((a) => a.status === 'done').length,
      actions_pending: actions.filter((a) => a.status === 'pending').length,
    },
    actions,
    next_run: 'in 5 minutes',
  };
}
