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
  {
    id: 'EMP-003', name: 'Lisa Chen', email: 'lisa@rahbnb.com', phone: '+14325551003',
    role: 'manager', status: 'active', pay_type: 'salary', rate_cents: 520000,
    default_hours: null, hire_date: '2025-05-01',
    address: '102 E Missouri Ave, Midland, TX 79701',
    ssn_last4: '9104', w4_filing_status: 'single', w4_allowances: 1,
    created_at: '2025-05-01T00:00:00Z', updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'EMP-004', name: 'Carlos Ramirez', email: 'carlos@rahbnb.com', phone: '+14325551004',
    role: 'cleaner', status: 'inactive', pay_type: 'hourly', rate_cents: 1600,
    default_hours: 20, hire_date: '2025-09-01',
    address: '318 S Loraine St, Midland, TX 79701',
    ssn_last4: '2215', w4_filing_status: 'single', w4_allowances: 1,
    created_at: '2025-09-01T00:00:00Z', updated_at: '2026-02-28T00:00:00Z',
  },
];

// ── GET /api/payroll/employees ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const role = params.get('role');
    const status = params.get('status');

    let filtered = [...employees];
    if (role) {
      filtered = filtered.filter((e) => e.role === role);
    }
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }

    // Strip SSN for list view
    const safe = filtered.map(({ ssn_last4, ...rest }) => ({
      ...rest,
      ssn_masked: `***-**-${ssn_last4}`,
    }));

    return NextResponse.json({ employees: safe, total: safe.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list employees', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/payroll/employees ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['name', 'role', 'pay_type', 'rate_cents'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    if (!['hourly', 'salary'].includes(body.pay_type)) {
      return NextResponse.json(
        { error: 'pay_type must be "hourly" or "salary"' },
        { status: 400 },
      );
    }
    if (typeof body.rate_cents !== 'number' || body.rate_cents <= 0) {
      return NextResponse.json(
        { error: 'rate_cents must be a positive number' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const employee = {
      id: `EMP-${Date.now().toString(36).toUpperCase()}`,
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      role: body.role,
      status: 'active',
      pay_type: body.pay_type,
      rate_cents: body.rate_cents,
      default_hours: body.default_hours ?? (body.pay_type === 'hourly' ? 40 : null),
      hire_date: body.hire_date ?? now.split('T')[0],
      address: body.address ?? null,
      ssn_last4: body.ssn_last4 ?? null,
      w4_filing_status: body.w4_filing_status ?? 'single',
      w4_allowances: body.w4_allowances ?? 1,
      created_at: now,
      updated_at: now,
    };

    employees.push(employee);

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create employee', detail: error.message },
      { status: 500 },
    );
  }
}
