import { NextRequest, NextResponse } from 'next/server';

const employees: any[] = [
  {
    id: 'EMP-001', name: 'Maria Garcia', email: 'maria@rahbnb.com', phone: '+14325551001',
    role: 'cleaner', status: 'active', pay_type: 'hourly', rate_cents: 1800,
    default_hours: 30, hire_date: '2025-06-15',
    address: '220 N Big Spring St, Midland, TX 79701',
    ssn_last4: '4521', w4_filing_status: 'single', w4_allowances: 1,
    created_at: '2025-06-15T00:00:00Z', updated_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'EMP-002', name: 'James Wilson', email: 'james@rahbnb.com', phone: '+14325551002',
    role: 'maintenance', status: 'active', pay_type: 'hourly', rate_cents: 2200,
    default_hours: 40, hire_date: '2025-07-01',
    address: '505 W Wall St, Midland, TX 79701',
    ssn_last4: '7832', w4_filing_status: 'married', w4_allowances: 3,
    created_at: '2025-07-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
  },
];

const payrollHistory = [
  { run_id: 'PR-001', pay_date: '2026-03-18', gross_cents: 54000, net_cents: 43200, employee_id: 'EMP-001' },
  { run_id: 'PR-001', pay_date: '2026-03-18', gross_cents: 88000, net_cents: 67690, employee_id: 'EMP-002' },
  { run_id: 'PR-002', pay_date: '2026-03-04', gross_cents: 54000, net_cents: 43200, employee_id: 'EMP-001' },
  { run_id: 'PR-002', pay_date: '2026-03-04', gross_cents: 88000, net_cents: 67690, employee_id: 'EMP-002' },
];

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/payroll/employees/[id] ──────────────────────────────────────
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const employee = employees.find((e) => e.id === id);

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const history = payrollHistory
      .filter((h) => h.employee_id === id)
      .sort((a, b) => b.pay_date.localeCompare(a.pay_date));

    const ytdGrossCents = history.reduce((s, h) => s + h.gross_cents, 0);
    const ytdNetCents = history.reduce((s, h) => s + h.net_cents, 0);

    return NextResponse.json({
      employee: {
        ...employee,
        ssn_masked: `***-**-${employee.ssn_last4}`,
      },
      pay_history: history,
      ytd_gross_cents: ytdGrossCents,
      ytd_net_cents: ytdNetCents,
      pay_periods_count: history.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get employee', detail: error.message },
      { status: 500 },
    );
  }
}

// ── PATCH /api/payroll/employees/[id] ────────────────────────────────────
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const idx = employees.findIndex((e) => e.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'name', 'email', 'phone', 'role', 'status', 'pay_type',
      'rate_cents', 'default_hours', 'address',
      'w4_filing_status', 'w4_allowances',
    ];

    const updated = { ...employees[idx] };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updated[field] = body[field];
      }
    }

    if (body.status && !['active', 'inactive', 'terminated'].includes(body.status)) {
      return NextResponse.json(
        { error: 'status must be active, inactive, or terminated' },
        { status: 400 },
      );
    }

    updated.updated_at = new Date().toISOString();
    employees[idx] = updated;

    return NextResponse.json({ employee: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update employee', detail: error.message },
      { status: 500 },
    );
  }
}
