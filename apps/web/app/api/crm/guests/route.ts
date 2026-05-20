import { NextRequest, NextResponse } from 'next/server';

// ── In-memory guest store ───────────────────────────────────────────────────
const guests: any[] = [
  {
    id: 'GUEST-001',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@email.com',
    phone: '+14325551234',
    segment: 'returning',
    is_vip: false,
    total_stays: 3,
    total_spent_cents: 210000,
    avg_rating_given: 4.7,
    last_stay_date: '2026-03-10',
    preferred_property: 'PROP-001',
    preferences: {
      early_check_in: true,
      extra_towels: true,
      pet_friendly: false,
      preferred_temp_f: 72,
    },
    notes: 'Oilfield crew lead. Usually books for 3-5 nights.',
    source: 'direct',
    created_at: '2025-06-15T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'GUEST-002',
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah.j@company.com',
    phone: '+14325559876',
    segment: 'business',
    is_vip: true,
    total_stays: 8,
    total_spent_cents: 890000,
    avg_rating_given: 5.0,
    last_stay_date: '2026-03-15',
    preferred_property: 'PROP-002',
    preferences: {
      early_check_in: false,
      extra_towels: false,
      pet_friendly: false,
      preferred_temp_f: 70,
    },
    notes: 'Corporate traveler. Stays monthly for Permian Basin work. VIP — always gets upgraded.',
    source: 'airbnb',
    created_at: '2025-08-01T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
  },
  {
    id: 'GUEST-003',
    first_name: 'Mike',
    last_name: 'Rodriguez',
    email: 'miker@gmail.com',
    phone: '+14325557777',
    segment: 'first_time',
    is_vip: false,
    total_stays: 1,
    total_spent_cents: 52500,
    avg_rating_given: 4.0,
    last_stay_date: '2026-02-20',
    preferred_property: null,
    preferences: {
      early_check_in: false,
      extra_towels: false,
      pet_friendly: true,
      preferred_temp_f: 68,
    },
    notes: 'First-time guest. Traveling with small dog.',
    source: 'vrbo',
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-02-20T00:00:00Z',
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/crm/guests ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const segment = params.get('segment');
    const isVip = params.get('is_vip');
    const search = params.get('search');
    const source = params.get('source');

    let filtered = [...guests];

    if (segment) {
      filtered = filtered.filter((g) => g.segment === segment);
    }
    if (isVip === 'true') {
      filtered = filtered.filter((g) => g.is_vip);
    }
    if (source) {
      filtered = filtered.filter((g) => g.source === source);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.first_name.toLowerCase().includes(q) ||
          g.last_name.toLowerCase().includes(q) ||
          g.email.toLowerCase().includes(q) ||
          g.phone.includes(q),
      );
    }

    const segments = {
      first_time: guests.filter((g) => g.segment === 'first_time').length,
      returning: guests.filter((g) => g.segment === 'returning').length,
      business: guests.filter((g) => g.segment === 'business').length,
      vip: guests.filter((g) => g.is_vip).length,
    };

    return NextResponse.json({
      guests: filtered,
      total: filtered.length,
      segments,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list guests', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/crm/guests ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['first_name', 'last_name', 'email'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    // Check duplicate email
    if (guests.find((g) => g.email.toLowerCase() === body.email.toLowerCase())) {
      return NextResponse.json(
        { error: 'A guest with this email already exists' },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const guest = {
      id: generateId('GUEST'),
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      phone: body.phone ?? null,
      segment: 'first_time',
      is_vip: false,
      total_stays: 0,
      total_spent_cents: 0,
      avg_rating_given: null,
      last_stay_date: null,
      preferred_property: null,
      preferences: body.preferences ?? {},
      notes: body.notes ?? '',
      source: body.source ?? 'direct',
      created_at: now,
      updated_at: now,
    };

    guests.push(guest);

    return NextResponse.json({ guest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create guest', detail: error.message },
      { status: 500 },
    );
  }
}
