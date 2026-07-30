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
 *      needs a system we are not wired to is reported as PENDING, with the
 *      reason. "Detected" and "done" are different words here on purpose.
 */

import { prisma } from '@/lib/prisma';
import { onHandByItem } from '@/lib/inventory';

export interface AutonomyAction {
  type: string;
  status: 'done' | 'pending';
  message: string;
  [key: string]: unknown;
}

const dayString = (d: Date) => d.toISOString().slice(0, 10);

/** Booking.status is stored UPPER-case; never compare it raw. */
const CONFIRMED = ['CONFIRMED', 'confirmed', 'Confirmed'];

function dayRange(day: string) {
  return {
    gte: new Date(`${day}T00:00:00.000Z`),
    lt: new Date(`${day}T23:59:59.999Z`),
  };
}

/**
 * Arrivals today that have no usable door code.
 *
 * Reported as PENDING, never as done. The code has to reach the physical lock
 * to be worth anything, and pushing to the device is a separate integration
 * that does not exist yet. Writing a generated code into the database would
 * simply move the original lie somewhere more convincing: the record would say
 * a code exists while the door disagrees.
 */
async function detectArrivalsNeedingCodes(today: string): Promise<AutonomyAction[]> {
  const arrivals = await prisma.booking.findMany({
    where: { checkIn: dayRange(today), status: { in: CONFIRMED } },
    include: {
      guest: { select: { name: true } },
      property: { select: { id: true, name: true, smartLock: true } },
    },
  });

  const now = new Date();
  return arrivals
    .filter((b) => {
      const lock = b.property.smartLock;
      // Already covered if the lock holds a code that outlasts the stay.
      return !lock?.currentCode || !lock.codeExpiresAt || lock.codeExpiresAt < now;
    })
    .map((b) => {
      const lock = b.property.smartLock;
      return {
        type: 'lock_code_needed',
        status: 'pending' as const,
        booking_id: b.id,
        property_id: b.propertyId,
        property_name: b.property.name,
        guest_name: b.guest?.name ?? 'Unknown',
        check_in: dayString(b.checkIn),
        check_out: dayString(b.checkOut),
        lock_device_id: lock?.deviceId ?? null,
        lock_online: lock?.isOnline ?? null,
        blocked_by: lock
          ? 'No device integration: codes cannot be pushed to the lock yet.'
          : 'No smart lock is registered for this property.',
        message: lock
          ? `${b.guest?.name ?? 'Guest'} arrives today at ${b.property.name} and the lock has no valid code. Issue one manually.`
          : `${b.guest?.name ?? 'Guest'} arrives today at ${b.property.name}, which has no smart lock on record.`,
      };
    });
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
    where: { checkOut: dayRange(today), status: { in: CONFIRMED } },
    include: {
      guest: { select: { name: true } },
      property: { select: { name: true } },
      cleaningJob: { select: { id: true } },
    },
  });

  const out: AutonomyAction[] = [];
  for (const b of departures) {
    if (b.cleaningJob) continue; // already dispatched on an earlier run

    const scheduledAt = new Date(`${today}T11:30:00.000Z`);
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
      } catch {
        // A lost race against a concurrent run is not a failure: the unique
        // constraint did its job and the booking already has its cleaning.
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
        due_date: dayString(inv.dueDate!),
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
    where: { checkIn: dayRange(tomorrow), status: { in: CONFIRMED } },
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
    check_in: dayString(b.checkIn),
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
    detectArrivalsNeedingCodes(today),
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
