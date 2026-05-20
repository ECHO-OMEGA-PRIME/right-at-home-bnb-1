import { NextRequest, NextResponse } from 'next/server';

// ── Mock data for a realistic Midland TX short-term rental operation ────────

const properties = [
  { id: 'PROP-001', name: 'Midland Executive Suite' },
  { id: 'PROP-002', name: 'West Texas Retreat' },
  { id: 'PROP-003', name: 'Oil Country Lodge' },
];

const monthlyRevenue = [
  { month: '2025-10', label: 'Oct 2025', revenue_cents: 682500, bookings: 9, nights: 42 },
  { month: '2025-11', label: 'Nov 2025', revenue_cents: 715000, bookings: 8, nights: 39 },
  { month: '2025-12', label: 'Dec 2025', revenue_cents: 893200, bookings: 12, nights: 55 },
  { month: '2026-01', label: 'Jan 2026', revenue_cents: 1024500, bookings: 14, nights: 62 },
  { month: '2026-02', label: 'Feb 2026', revenue_cents: 876300, bookings: 11, nights: 48 },
  { month: '2026-03', label: 'Mar 2026', revenue_cents: 945800, bookings: 13, nights: 51 },
];

const recentBookings = [
  {
    id: 'BK-089', guest_name: 'James Patterson', property_id: 'PROP-001',
    property_name: 'Midland Executive Suite', check_in: '2026-03-25',
    check_out: '2026-03-29', nights: 4, total_cents: 82000, status: 'confirmed',
    platform: 'vrbo', created_at: '2026-03-14T09:00:00Z',
  },
  {
    id: 'BK-088', guest_name: 'Lisa Rodriguez', property_id: 'PROP-002',
    property_name: 'West Texas Retreat', check_in: '2026-03-22',
    check_out: '2026-04-05', nights: 14, total_cents: 238000, status: 'confirmed',
    platform: 'direct', created_at: '2026-03-12T15:30:00Z',
  },
  {
    id: 'BK-087', guest_name: 'Robert Haines', property_id: 'PROP-003',
    property_name: 'Oil Country Lodge', check_in: '2026-03-20',
    check_out: '2026-03-23', nights: 3, total_cents: 52500, status: 'checked_in',
    platform: 'airbnb', created_at: '2026-03-10T11:00:00Z',
  },
  {
    id: 'BK-086', guest_name: 'Karen Mitchell', property_id: 'PROP-001',
    property_name: 'Midland Executive Suite', check_in: '2026-03-18',
    check_out: '2026-03-20', nights: 2, total_cents: 41000, status: 'checked_out',
    platform: 'vrbo', created_at: '2026-03-08T14:20:00Z',
  },
  {
    id: 'BK-085', guest_name: 'Tommy Nguyen', property_id: 'PROP-002',
    property_name: 'West Texas Retreat', check_in: '2026-03-15',
    check_out: '2026-03-22', nights: 7, total_cents: 122500, status: 'checked_out',
    platform: 'vrbo', created_at: '2026-03-05T10:00:00Z',
  },
];

const channelRevenue: Record<string, number> = {
  vrbo: 485200,
  direct: 268000,
  airbnb: 142600,
  'booking.com': 50000,
};

const taskSummary = {
  pending: 4,
  in_progress: 2,
  completed_today: 3,
  overdue: 1,
  upcoming_24h: 5,
  by_type: {
    cleaning: { pending: 2, in_progress: 1, completed: 2 },
    maintenance: { pending: 1, in_progress: 1, completed: 0 },
    inspection: { pending: 0, in_progress: 0, completed: 1 },
    restock: { pending: 1, in_progress: 0, completed: 0 },
  },
};

function getCurrentMonthData() {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthlyRevenue.find((m) => m.month === currentMonthKey) ?? monthlyRevenue[monthlyRevenue.length - 1];
}

function calculateOccupancyRate(): number {
  const currentMonth = getCurrentMonthData();
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).getDate();
  const totalAvailableNights = properties.length * daysInMonth;
  return totalAvailableNights > 0
    ? +((currentMonth.nights / totalAvailableNights) * 100).toFixed(1)
    : 0;
}

function calculateActiveBookings(): number {
  const today = new Date().toISOString().split('T')[0];
  return recentBookings.filter(
    (b) =>
      b.check_in <= today &&
      b.check_out > today &&
      ['confirmed', 'checked_in'].includes(b.status),
  ).length;
}

function getPropertyPerformance() {
  return properties.map((p) => {
    const propBookings = recentBookings.filter((b) => b.property_id === p.id);
    const revenueCents = propBookings.reduce((sum, b) => sum + b.total_cents, 0);
    const nights = propBookings.reduce((sum, b) => sum + b.nights, 0);
    return {
      property_id: p.id,
      property_name: p.name,
      bookings_count: propBookings.length,
      revenue_cents: revenueCents,
      nights_booked: nights,
      avg_nightly_rate_cents: nights > 0 ? Math.round(revenueCents / nights) : 0,
    };
  });
}

// ── GET /api/dashboard/stats ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const period = params.get('period') ?? 'current_month';

    const currentMonth = getCurrentMonthData();
    const previousMonth = monthlyRevenue.length >= 2
      ? monthlyRevenue[monthlyRevenue.length - 2]
      : null;

    const revenueChangePct = previousMonth && previousMonth.revenue_cents > 0
      ? +(
          ((currentMonth.revenue_cents - previousMonth.revenue_cents) /
            previousMonth.revenue_cents) *
          100
        ).toFixed(1)
      : 0;

    const occupancyRate = calculateOccupancyRate();
    const activeBookings = calculateActiveBookings();

    const totalRevenueCents = Object.values(channelRevenue).reduce(
      (sum, v) => sum + v,
      0,
    );

    const avgBookingValueCents =
      currentMonth.bookings > 0
        ? Math.round(currentMonth.revenue_cents / currentMonth.bookings)
        : 0;

    const avgLengthOfStay =
      currentMonth.bookings > 0
        ? +(currentMonth.nights / currentMonth.bookings).toFixed(1)
        : 0;

    return NextResponse.json({
      period,
      generated_at: new Date().toISOString(),

      // Top-line KPIs
      revenue_this_month_cents: currentMonth.revenue_cents,
      revenue_change_pct: revenueChangePct,
      occupancy_rate: occupancyRate,
      active_bookings: activeBookings,
      pending_tasks: taskSummary.pending + taskSummary.overdue,
      avg_booking_value_cents: avgBookingValueCents,
      avg_length_of_stay_nights: avgLengthOfStay,

      // Revenue breakdown
      revenue_by_month: monthlyRevenue.map((m) => ({
        month: m.month,
        label: m.label,
        revenue_cents: m.revenue_cents,
        bookings: m.bookings,
        nights: m.nights,
      })),
      revenue_by_channel: channelRevenue,
      total_channel_revenue_cents: totalRevenueCents,

      // Recent activity
      recent_bookings: recentBookings,

      // Task summary
      task_summary: taskSummary,

      // Property performance
      property_performance: getPropertyPerformance(),

      // Quick metrics
      properties_count: properties.length,
      total_nights_this_month: currentMonth.nights,
      total_bookings_this_month: currentMonth.bookings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate dashboard stats', detail: error.message },
      { status: 500 },
    );
  }
}
