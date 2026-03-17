import { NextRequest, NextResponse } from 'next/server';

// ── In-memory employee store ───────────────────────────────────────────────

const employees: any[] = [
  {
    id: 'EMP-001',
    name: 'Maria Garcia',
    role: 'cleaning',
    phone: '+14325551001',
    email: 'maria@rahbnb.com',
    skills: ['deep_clean', 'turnover', 'laundry', 'restock', 'inspection'],
    hourly_rate_cents: 1800,
    status: 'active',
    availability: 'available',
    current_tasks: [
      {
        id: 'TASK-010',
        type: 'cleaning',
        property_name: 'Midland Executive Suite',
        status: 'in_progress',
        scheduled_date: '2026-03-17',
      },
    ],
    schedule: {
      monday: { start: '08:00', end: '16:00' },
      tuesday: { start: '08:00', end: '16:00' },
      wednesday: { start: '08:00', end: '16:00' },
      thursday: { start: '08:00', end: '16:00' },
      friday: { start: '08:00', end: '14:00' },
      saturday: null,
      sunday: null,
    },
    ytd_hours: 412,
    ytd_gross_cents: 741600,
    hire_date: '2025-06-15',
    address: '220 N Big Spring St, Midland, TX 79701',
    emergency_contact: { name: 'Carlos Garcia', phone: '+14325559010' },
    performance_rating: 4.8,
    tasks_completed_this_month: 18,
    avg_task_minutes: 145,
    created_at: '2025-06-15T00:00:00Z',
    updated_at: '2026-03-17T08:00:00Z',
  },
  {
    id: 'EMP-002',
    name: 'Carlos Ramirez',
    role: 'outdoor',
    phone: '+14325551002',
    email: 'carlos@rahbnb.com',
    skills: ['lawn_care', 'pool_maintenance', 'landscaping', 'pressure_wash', 'pest_control'],
    hourly_rate_cents: 2000,
    status: 'active',
    availability: 'available',
    current_tasks: [],
    schedule: {
      monday: { start: '07:00', end: '15:00' },
      tuesday: { start: '07:00', end: '15:00' },
      wednesday: { start: '07:00', end: '15:00' },
      thursday: { start: '07:00', end: '15:00' },
      friday: { start: '07:00', end: '12:00' },
      saturday: null,
      sunday: null,
    },
    ytd_hours: 380,
    ytd_gross_cents: 760000,
    hire_date: '2025-08-01',
    address: '505 S Marienfeld St, Midland, TX 79701',
    emergency_contact: { name: 'Rosa Ramirez', phone: '+14325559020' },
    performance_rating: 4.6,
    tasks_completed_this_month: 12,
    avg_task_minutes: 90,
    created_at: '2025-08-01T00:00:00Z',
    updated_at: '2026-03-16T15:00:00Z',
  },
  {
    id: 'EMP-003',
    name: 'Jake Morrison',
    role: 'maintenance',
    phone: '+14325551003',
    email: 'jake@rahbnb.com',
    skills: ['plumbing', 'electrical', 'hvac', 'appliance_repair', 'carpentry', 'drywall'],
    hourly_rate_cents: 2500,
    status: 'active',
    availability: 'on_task',
    current_tasks: [
      {
        id: 'TASK-012',
        type: 'maintenance',
        property_name: 'West Texas Retreat',
        status: 'in_progress',
        scheduled_date: '2026-03-17',
      },
    ],
    schedule: {
      monday: { start: '08:00', end: '17:00' },
      tuesday: { start: '08:00', end: '17:00' },
      wednesday: { start: '08:00', end: '17:00' },
      thursday: { start: '08:00', end: '17:00' },
      friday: { start: '08:00', end: '17:00' },
      saturday: null,
      sunday: null,
    },
    ytd_hours: 445,
    ytd_gross_cents: 1112500,
    hire_date: '2025-07-01',
    address: '102 E Wall St, Midland, TX 79701',
    emergency_contact: { name: 'Kelly Morrison', phone: '+14325559030' },
    performance_rating: 4.9,
    tasks_completed_this_month: 8,
    avg_task_minutes: 180,
    created_at: '2025-07-01T00:00:00Z',
    updated_at: '2026-03-17T09:30:00Z',
  },
  {
    id: 'EMP-004',
    name: 'Sarah Kim',
    role: 'cleaning',
    phone: '+14325551004',
    email: 'sarah.k@rahbnb.com',
    skills: ['deep_clean', 'turnover', 'laundry', 'restock'],
    hourly_rate_cents: 1700,
    status: 'active',
    availability: 'available',
    current_tasks: [],
    schedule: {
      monday: null,
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: { start: '09:00', end: '13:00' },
      sunday: null,
    },
    ytd_hours: 320,
    ytd_gross_cents: 544000,
    hire_date: '2025-10-15',
    address: '318 S Loraine St, Midland, TX 79701',
    emergency_contact: { name: 'David Kim', phone: '+14325559040' },
    performance_rating: 4.5,
    tasks_completed_this_month: 14,
    avg_task_minutes: 155,
    created_at: '2025-10-15T00:00:00Z',
    updated_at: '2026-03-15T16:00:00Z',
  },
  {
    id: 'EMP-005',
    name: 'Mike Davis',
    role: 'general',
    phone: '+14325551005',
    email: 'mike.d@rahbnb.com',
    skills: ['cleaning', 'restock', 'inspection', 'guest_checkin', 'errand_runner', 'photography'],
    hourly_rate_cents: 1900,
    status: 'active',
    availability: 'off_duty',
    current_tasks: [],
    schedule: {
      monday: null,
      tuesday: null,
      wednesday: { start: '10:00', end: '18:00' },
      thursday: { start: '10:00', end: '18:00' },
      friday: { start: '10:00', end: '18:00' },
      saturday: { start: '08:00', end: '16:00' },
      sunday: { start: '08:00', end: '16:00' },
    },
    ytd_hours: 290,
    ytd_gross_cents: 551000,
    hire_date: '2025-11-01',
    address: '411 W Texas Ave, Midland, TX 79701',
    emergency_contact: { name: 'Jennifer Davis', phone: '+14325559050' },
    performance_rating: 4.3,
    tasks_completed_this_month: 10,
    avg_task_minutes: 120,
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2026-03-14T12:00:00Z',
  },
];

function getDayOfWeek(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

function isEmployeeOnSchedule(emp: any): boolean {
  const today = getDayOfWeek();
  const shift = emp.schedule[today];
  if (!shift) return false;
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= shift.start && currentTime <= shift.end;
}

// ── GET /api/dispatch/employees ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const role = params.get('role');
    const status = params.get('status');
    const availability = params.get('availability');
    const skill = params.get('skill');

    let filtered = [...employees];

    if (role) {
      filtered = filtered.filter((e) => e.role === role);
    }
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }
    if (availability) {
      filtered = filtered.filter((e) => e.availability === availability);
    }
    if (skill) {
      filtered = filtered.filter((e) => e.skills.includes(skill));
    }

    const enriched = filtered.map((emp) => ({
      ...emp,
      on_schedule_now: isEmployeeOnSchedule(emp),
      active_task_count: emp.current_tasks.length,
    }));

    const availableCount = enriched.filter(
      (e) => e.availability === 'available' && e.status === 'active',
    ).length;

    const onTaskCount = enriched.filter(
      (e) => e.availability === 'on_task',
    ).length;

    return NextResponse.json({
      employees: enriched,
      total: enriched.length,
      available_count: availableCount,
      on_task_count: onTaskCount,
      roles: [...new Set(employees.map((e) => e.role))],
      all_skills: [...new Set(employees.flatMap((e) => e.skills))].sort(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list employees', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/dispatch/employees ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['name', 'role', 'phone'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    const validRoles = ['cleaning', 'maintenance', 'outdoor', 'general', 'manager'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: `role must be one of: ${validRoles.join(', ')}` },
        { status: 400 },
      );
    }

    if (body.hourly_rate_cents !== undefined && (typeof body.hourly_rate_cents !== 'number' || body.hourly_rate_cents <= 0)) {
      return NextResponse.json(
        { error: 'hourly_rate_cents must be a positive number' },
        { status: 400 },
      );
    }

    // Check for duplicate email
    if (body.email) {
      const existing = employees.find(
        (e) => e.email && e.email.toLowerCase() === body.email.toLowerCase(),
      );
      if (existing) {
        return NextResponse.json(
          { error: 'Employee with this email already exists', existing_id: existing.id },
          { status: 409 },
        );
      }
    }

    const defaultRates: Record<string, number> = {
      cleaning: 1700,
      maintenance: 2500,
      outdoor: 2000,
      general: 1900,
      manager: 3000,
    };

    const now = new Date().toISOString();
    const employee = {
      id: `EMP-${Date.now().toString(36).toUpperCase()}`,
      name: body.name,
      role: body.role,
      phone: body.phone,
      email: body.email ?? null,
      skills: body.skills ?? [],
      hourly_rate_cents: body.hourly_rate_cents ?? defaultRates[body.role] ?? 1800,
      status: 'active',
      availability: 'available',
      current_tasks: [],
      schedule: body.schedule ?? {
        monday: { start: '08:00', end: '16:00' },
        tuesday: { start: '08:00', end: '16:00' },
        wednesday: { start: '08:00', end: '16:00' },
        thursday: { start: '08:00', end: '16:00' },
        friday: { start: '08:00', end: '16:00' },
        saturday: null,
        sunday: null,
      },
      ytd_hours: 0,
      ytd_gross_cents: 0,
      hire_date: body.hire_date ?? now.split('T')[0],
      address: body.address ?? null,
      emergency_contact: body.emergency_contact ?? null,
      performance_rating: null,
      tasks_completed_this_month: 0,
      avg_task_minutes: null,
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
