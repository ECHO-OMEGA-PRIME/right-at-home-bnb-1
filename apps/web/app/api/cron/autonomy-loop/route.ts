import { NextRequest, NextResponse } from 'next/server';

// Mock data representing current state
const bookings: any[] = [
  {
    id: 'BK-001', property_id: 'PROP-001', guest_name: 'Sarah Johnson',
    check_in: '2026-03-20', check_out: '2026-03-23', status: 'confirmed',
    lock_code_generated: false,
  },
  {
    id: 'BK-030', property_id: 'PROP-002', guest_name: 'Jake Reynolds',
    check_in: '2026-03-17', check_out: '2026-03-19', status: 'confirmed',
    lock_code_generated: true,
  },
  {
    id: 'BK-031', property_id: 'PROP-001', guest_name: 'Lisa Park',
    check_in: '2026-03-25', check_out: '2026-03-28', status: 'confirmed',
    lock_code_generated: false,
  },
];

const invoices: any[] = [
  { id: 'INV-001', booking_id: 'BK-010', total_cents: 82000, balance_due_cents: 82000, status: 'sent', due_date: '2026-03-01' },
  { id: 'INV-002', booking_id: 'BK-020', total_cents: 196000, balance_due_cents: 0, status: 'paid', due_date: '2026-01-05' },
  { id: 'INV-003', booking_id: 'BK-025', total_cents: 70363, balance_due_cents: 70363, status: 'sent', due_date: '2026-03-10' },
];

const inventory: any[] = [
  { id: 'INV-001', name: 'Bath Towels (White)', current_stock: 48, reorder_point: 20 },
  { id: 'INV-002', name: 'Hand Towels (White)', current_stock: 36, reorder_point: 15 },
  { id: 'INV-003', name: 'Bed Sheet Set (Queen)', current_stock: 12, reorder_point: 8 },
  { id: 'INV-004', name: 'All-Purpose Cleaner (Gallon)', current_stock: 4, reorder_point: 3 },
  { id: 'INV-005', name: 'Toilet Paper (Case/96)', current_stock: 2, reorder_point: 3 },
  { id: 'INV-006', name: 'Coffee K-Cups (Box/80)', current_stock: 1, reorder_point: 2 },
  { id: 'INV-007', name: 'HVAC Filter 20x25x1', current_stock: 6, reorder_point: 4 },
];

const dispatchTasks: any[] = [];

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ── GET /api/cron/autonomy-loop ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const actions: any[] = [];

    // ── 1. CHECK-IN: Generate lock codes for today's arrivals ──────────
    const todayCheckins = bookings.filter(
      (b) => b.check_in === todayStr && b.status === 'confirmed' && !b.lock_code_generated,
    );

    for (const booking of todayCheckins) {
      const code = generateCode();
      booking.lock_code_generated = true;

      actions.push({
        type: 'lock_code_generated',
        booking_id: booking.id,
        property_id: booking.property_id,
        guest_name: booking.guest_name,
        code,
        valid_from: `${booking.check_in}T15:00:00Z`,
        valid_until: `${booking.check_out}T11:00:00Z`,
        message: `Lock code ${code} generated for ${booking.guest_name} at ${booking.property_id}`,
      });
    }

    // ── 2. CHECKOUT: Dispatch cleaning for today's departures ──────────
    const todayCheckouts = bookings.filter(
      (b) => b.check_out === todayStr && b.status === 'confirmed',
    );

    for (const booking of todayCheckouts) {
      const taskId = `TASK-${Date.now().toString(36).toUpperCase()}-${booking.id}`;

      const task = {
        id: taskId,
        type: 'cleaning',
        property_id: booking.property_id,
        booking_id: booking.id,
        status: 'pending',
        priority: 'high',
        title: `Turnover clean \u2014 ${booking.property_id} (${booking.guest_name} checkout)`,
        scheduled_date: todayStr,
        scheduled_time: '11:30',
        notes: `Post-checkout cleaning. Next check-in may be same day \u2014 prioritize.`,
        created_at: now.toISOString(),
      };

      dispatchTasks.push(task);

      actions.push({
        type: 'cleaning_dispatched',
        task_id: taskId,
        booking_id: booking.id,
        property_id: booking.property_id,
        guest_name: booking.guest_name,
        scheduled_time: '11:30',
        message: `Cleaning dispatched for ${booking.property_id} at 11:30 (${booking.guest_name} checkout)`,
      });
    }

    // ── 3. OVERDUE INVOICES: Flag and alert ────────────────────────────
    const overdueInvoices = invoices.filter(
      (inv) =>
        inv.status === 'sent' &&
        inv.balance_due_cents > 0 &&
        inv.due_date < todayStr,
    );

    for (const inv of overdueInvoices) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
      );

      actions.push({
        type: 'overdue_invoice',
        invoice_id: inv.id,
        booking_id: inv.booking_id,
        balance_due_cents: inv.balance_due_cents,
        due_date: inv.due_date,
        days_overdue: daysOverdue,
        severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium',
        message: `Invoice ${inv.id} is ${daysOverdue} days overdue ($${(inv.balance_due_cents / 100).toFixed(2)})`,
      });
    }

    // ── 4. LOW INVENTORY: Alert on items below reorder point ───────────
    const lowStockItems = inventory.filter(
      (item) => item.current_stock <= item.reorder_point,
    );

    for (const item of lowStockItems) {
      actions.push({
        type: 'low_inventory',
        item_id: item.id,
        item_name: item.name,
        current_stock: item.current_stock,
        reorder_point: item.reorder_point,
        urgency: item.current_stock === 0 ? 'critical' : item.current_stock <= Math.floor(item.reorder_point / 2) ? 'high' : 'medium',
        message: `Low stock: ${item.name} (${item.current_stock} remaining, reorder at ${item.reorder_point})`,
      });
    }

    // ── 5. UPCOMING CHECK-INS: Pre-arrival prep reminders ──────────────
    const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const tomorrowCheckins = bookings.filter(
      (b) => b.check_in === tomorrowStr && b.status === 'confirmed',
    );

    for (const booking of tomorrowCheckins) {
      actions.push({
        type: 'pre_arrival_reminder',
        booking_id: booking.id,
        property_id: booking.property_id,
        guest_name: booking.guest_name,
        check_in: booking.check_in,
        message: `Tomorrow: ${booking.guest_name} arrives at ${booking.property_id}. Verify property is ready.`,
      });
    }

    // Summary
    const summary = {
      lock_codes_generated: actions.filter((a) => a.type === 'lock_code_generated').length,
      cleaning_tasks_dispatched: actions.filter((a) => a.type === 'cleaning_dispatched').length,
      overdue_invoices: actions.filter((a) => a.type === 'overdue_invoice').length,
      low_inventory_alerts: actions.filter((a) => a.type === 'low_inventory').length,
      pre_arrival_reminders: actions.filter((a) => a.type === 'pre_arrival_reminder').length,
      total_actions: actions.length,
    };

    return NextResponse.json({
      ran_at: now.toISOString(),
      today: todayStr,
      summary,
      actions,
      next_run: 'in 5 minutes',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Autonomy loop failed', detail: error.message },
      { status: 500 },
    );
  }
}
