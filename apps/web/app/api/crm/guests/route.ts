import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { listGuests, toGuestContract } from '@/lib/guest-crm';

// Backed by the real Guest table (494 rows in production). This route served a
// hardcoded array of invented guests while the actual CRM data sat unused in
// the database (queue #26855).

// ── GET /api/crm/guests ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    return NextResponse.json(
      await listGuests({
        segment: params.get('segment'),
        isVip: params.get('is_vip'),
        search: params.get('search'),
        source: params.get('source'),
      }),
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list guests', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/crm/guests ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    for (const field of ['first_name', 'last_name', 'email'] as const) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required: ${field}` }, { status: 400 });
      }
    }

    // email is @unique in the schema; check first so a duplicate returns 409
    // rather than surfacing a raw Prisma constraint error as a 500.
    const existing = await prisma.guest.findUnique({
      where: { email: String(body.email).toLowerCase() },
    });
    if (existing) {
      return NextResponse.json({ error: 'Guest with that email already exists' }, { status: 409 });
    }

    const created = await prisma.guest.create({
      data: {
        // The model stores one `name`; the contract sends first/last.
        name: `${body.first_name} ${body.last_name}`.trim(),
        email: String(body.email).toLowerCase(),
        phone: body.phone ?? null,
        platform: (body.source ?? 'DIRECT').toUpperCase(),
        isVip: body.is_vip ?? false,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        preferences: body.preferences ? JSON.stringify(body.preferences) : null,
        notes: body.notes ?? null,
      },
    });

    return NextResponse.json({ guest: toGuestContract(created as never) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create guest', detail: error.message },
      { status: 500 },
    );
  }
}
