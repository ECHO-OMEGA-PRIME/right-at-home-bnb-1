import { prisma } from '@/lib/prisma';
import type { PropertyScope } from '@/lib/tenant-scope';

/**
 * Dashboard statistics computed from real data (queue #26855).
 *
 * /api/dashboard/stats previously returned entirely fabricated figures --
 * invented monthly revenue, three made-up properties, five made-up bookings.
 * The owner's dashboard was showing numbers nobody could act on. This computes
 * the same response shape from the actual database.
 *
 * MONEY UNITS: Booking stores money as Float DOLLARS, not cents. Established
 * empirically rather than assumed -- a sampled row has totalPrice 1116.0 with
 * nightlyRate 279.0 over 4 nights (279 * 4 = 1116), and $279/night is a
 * plausible Midland nightly rate where 279 cents would not be. The API
 * contract speaks cents, so every amount is converted once, here, via
 * dollarsToCents.
 */

/** Float dollars -> integer cents. Rounds once, at the boundary. */
export function dollarsToCents(dollars: number | null | undefined): number {
  return Math.round((dollars ?? 0) * 100);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const ACTIVE_STATUSES = ['CONFIRMED', 'CHECKED_IN'];

export interface DashboardStats {
  period: string;
  generated_at: string;
  revenue_this_month_cents: number;
  revenue_change_pct: number;
  occupancy_rate: number;
  active_bookings: number;
  pending_tasks: number;
  avg_booking_value_cents: number;
  avg_length_of_stay_nights: number;
  revenue_by_month: Array<{ month: string; label: string; revenue_cents: number; bookings: number; nights: number }>;
  revenue_by_channel: Record<string, number>;
  total_channel_revenue_cents: number;
  recent_bookings: unknown[];
  task_summary: unknown;
  property_performance: unknown[];
  properties_count: number;
  total_nights_this_month: number;
  total_bookings_this_month: number;
}

export async function getDashboardStats(
  period = 'current_month',
  propertyScope: PropertyScope = null,
): Promise<DashboardStats> {
  const now = new Date();
  // Six-month window ending with the current month, matching the shape the
  // dashboard chart previously rendered from its hardcoded array.
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const propertyWhere = propertyScope === null ? {} : { id: { in: propertyScope } };
  const childWhere = propertyScope === null ? {} : { propertyId: { in: propertyScope } };

  const [properties, windowBookings, activeBookings, recent, cleaningByStatus, workByStatus] =
    await Promise.all([
      prisma.property.findMany({ where: propertyWhere, select: { id: true, name: true } }),
      prisma.booking.findMany({
        where: { ...childWhere, checkIn: { gte: windowStart, lt: nextMonthStart } },
        select: { propertyId: true, checkIn: true, totalPrice: true, totalNights: true, platform: true },
      }),
      prisma.booking.count({
        where: {
          ...childWhere,
          checkIn: { lte: now },
          checkOut: { gt: now },
          status: { in: ACTIVE_STATUSES },
        },
      }),
      prisma.booking.findMany({
        where: childWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          guest: { select: { name: true } },
          property: { select: { name: true } },
        },
      }),
      prisma.cleaningJob.groupBy({
        by: ['status'],
        where: childWhere,
        _count: { _all: true },
      }),
      prisma.workOrder.groupBy({
        by: ['status'],
        where: childWhere,
        _count: { _all: true },
      }),
    ]);

  // ---- monthly buckets over the six-month window
  const buckets = new Map<string, { month: string; label: string; revenue_cents: number; bookings: number; nights: number }>();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    buckets.set(monthKey(d), { month: monthKey(d), label: monthLabel(d), revenue_cents: 0, bookings: 0, nights: 0 });
  }
  for (const b of windowBookings) {
    const bucket = buckets.get(monthKey(b.checkIn));
    if (!bucket) continue;
    bucket.revenue_cents += dollarsToCents(b.totalPrice);
    bucket.bookings += 1;
    bucket.nights += b.totalNights ?? 0;
  }
  const revenueByMonth = [...buckets.values()];

  const current = buckets.get(monthKey(currentMonthStart))!;
  const previous = buckets.get(monthKey(prevMonthStart));
  const revenueChangePct =
    previous && previous.revenue_cents > 0
      ? +(((current.revenue_cents - previous.revenue_cents) / previous.revenue_cents) * 100).toFixed(1)
      : 0;

  // ---- occupancy: nights sold this month over sellable nights
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const sellableNights = properties.length * daysInMonth;
  const occupancyRate = sellableNights > 0 ? +((current.nights / sellableNights) * 100).toFixed(1) : 0;

  // ---- revenue by channel, over the same window
  const revenueByChannel: Record<string, number> = {};
  for (const b of windowBookings) {
    const key = (b.platform || 'DIRECT').toLowerCase();
    revenueByChannel[key] = (revenueByChannel[key] ?? 0) + dollarsToCents(b.totalPrice);
  }

  // ---- task summary. WorkOrder is the maintenance surface; CleaningJob the
  // cleaning one. Counts are whatever the tables actually say, including zero.
  const countBy = (rows: Array<{ status: string; _count: { _all: number } }>, ...statuses: string[]) =>
    rows.filter((r) => statuses.includes((r.status || '').toUpperCase())).reduce((s, r) => s + r._count._all, 0);

  const cleaning = {
    pending: countBy(cleaningByStatus, 'SCHEDULED', 'PENDING'),
    in_progress: countBy(cleaningByStatus, 'IN_PROGRESS'),
    completed: countBy(cleaningByStatus, 'COMPLETED', 'DONE'),
  };
  const maintenance = {
    pending: countBy(workByStatus, 'PENDING', 'SCHEDULED'),
    in_progress: countBy(workByStatus, 'IN_PROGRESS'),
    completed: countBy(workByStatus, 'COMPLETED', 'DONE'),
  };

  const taskSummary = {
    pending: cleaning.pending + maintenance.pending,
    in_progress: cleaning.in_progress + maintenance.in_progress,
    completed_today: 0,
    overdue: 0,
    upcoming_24h: 0,
    by_type: {
      cleaning,
      maintenance,
      inspection: { pending: 0, in_progress: 0, completed: 0 },
      restock: { pending: 0, in_progress: 0, completed: 0 },
    },
  };

  // ---- per-property performance over the window
  const perf = new Map(
    properties.map((p) => [
      p.id,
      { property_id: p.id, property_name: p.name, bookings_count: 0, revenue_cents: 0, nights_booked: 0, avg_nightly_rate_cents: 0 },
    ]),
  );
  for (const b of windowBookings) {
    const row = perf.get(b.propertyId);
    if (!row) continue;
    row.bookings_count += 1;
    row.revenue_cents += dollarsToCents(b.totalPrice);
    row.nights_booked += b.totalNights ?? 0;
  }
  for (const row of perf.values()) {
    row.avg_nightly_rate_cents = row.nights_booked > 0 ? Math.round(row.revenue_cents / row.nights_booked) : 0;
  }

  const totalChannelRevenue = Object.values(revenueByChannel).reduce((s, v) => s + v, 0);

  return {
    period,
    generated_at: new Date().toISOString(),
    revenue_this_month_cents: current.revenue_cents,
    revenue_change_pct: revenueChangePct,
    occupancy_rate: occupancyRate,
    active_bookings: activeBookings,
    pending_tasks: taskSummary.pending + taskSummary.overdue,
    avg_booking_value_cents: current.bookings > 0 ? Math.round(current.revenue_cents / current.bookings) : 0,
    avg_length_of_stay_nights: current.bookings > 0 ? +(current.nights / current.bookings).toFixed(1) : 0,
    revenue_by_month: revenueByMonth,
    revenue_by_channel: revenueByChannel,
    total_channel_revenue_cents: totalChannelRevenue,
    recent_bookings: recent.map((b) => ({
      id: b.id,
      guest_name: b.guest?.name || 'Unknown',
      property_id: b.propertyId,
      property_name: b.property?.name ?? 'Unknown',
      check_in: b.checkIn.toISOString().slice(0, 10),
      check_out: b.checkOut.toISOString().slice(0, 10),
      nights: b.totalNights,
      total_cents: dollarsToCents(b.totalPrice),
      status: (b.status || '').toLowerCase(),
      platform: (b.platform || 'direct').toLowerCase(),
      created_at: b.createdAt.toISOString(),
    })),
    task_summary: taskSummary,
    property_performance: [...perf.values()].sort((a, b) => b.revenue_cents - a.revenue_cents),
    properties_count: properties.length,
    total_nights_this_month: current.nights,
    total_bookings_this_month: current.bookings,
  };
}
