import { NextRequest, NextResponse } from 'next/server';

const notes: any[] = [
  {
    id: 'NOTE-001',
    type: 'property',
    property_id: 'PROP-001',
    booking_id: null,
    guest_id: null,
    title: 'Gate code updated',
    content: 'Front gate code changed to 4821 as of March 1. Update lock code generator.',
    pinned: true,
    author: 'bobby',
    tags: ['access', 'security'],
    created_at: '2026-03-01T09:00:00Z',
    updated_at: '2026-03-01T09:00:00Z',
  },
  {
    id: 'NOTE-002',
    type: 'booking',
    property_id: 'PROP-001',
    booking_id: 'BK-001',
    guest_id: 'GUEST-001',
    title: 'Guest preference — Sarah Johnson',
    content: 'Sarah prefers extra pillows and decaf coffee. Has 2 kids (ages 8 and 11). Husband is allergic to feather pillows — use hypoallergenic.',
    pinned: false,
    author: 'bree',
    tags: ['guest-preference', 'vip'],
    created_at: '2026-03-18T08:00:00Z',
    updated_at: '2026-03-18T08:00:00Z',
  },
  {
    id: 'NOTE-003',
    type: 'maintenance',
    property_id: 'PROP-002',
    booking_id: null,
    guest_id: null,
    title: 'Water heater inspection due',
    content: 'Water heater at Oilfield Oasis is 8 years old. Schedule inspection before April. Last serviced 2025-09-15.',
    pinned: true,
    author: 'system',
    tags: ['maintenance', 'urgent'],
    created_at: '2026-03-10T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'NOTE-004',
    type: 'general',
    property_id: null,
    booking_id: null,
    guest_id: null,
    title: 'Insurance renewal reminder',
    content: 'Proper Insurance policy renews April 1. Review coverage limits — may need to increase for Permian Basin Pad renovation.',
    pinned: false,
    author: 'bobby',
    tags: ['insurance', 'reminder'],
    created_at: '2026-03-05T14:00:00Z',
    updated_at: '2026-03-05T14:00:00Z',
  },
];

// ── GET /api/notes ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get('type');
    const propertyId = params.get('property_id');
    const bookingId = params.get('booking_id');
    const guestId = params.get('guest_id');
    const pinned = params.get('pinned');
    const search = params.get('search');
    const tag = params.get('tag');

    let filtered = [...notes];

    if (type) {
      filtered = filtered.filter((n) => n.type === type);
    }
    if (propertyId) {
      filtered = filtered.filter((n) => n.property_id === propertyId);
    }
    if (bookingId) {
      filtered = filtered.filter((n) => n.booking_id === bookingId);
    }
    if (guestId) {
      filtered = filtered.filter((n) => n.guest_id === guestId);
    }
    if (pinned !== null && pinned !== undefined) {
      filtered = filtered.filter((n) => n.pinned === (pinned === 'true'));
    }
    if (tag) {
      filtered = filtered.filter((n) => n.tags.includes(tag));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t: string) => t.toLowerCase().includes(q)),
      );
    }

    // Sort: pinned first, then by date desc
    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({
      notes: filtered,
      total: filtered.length,
      pinned_count: filtered.filter((n) => n.pinned).length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list notes', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/notes ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !body.content) {
      return NextResponse.json(
        { error: 'Missing required: title, content' },
        { status: 400 },
      );
    }

    const validTypes = ['property', 'booking', 'maintenance', 'guest', 'general', 'financial'];
    const noteType = body.type ?? 'general';
    if (!validTypes.includes(noteType)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const note = {
      id: `NOTE-${Date.now().toString(36).toUpperCase()}`,
      type: noteType,
      property_id: body.property_id ?? null,
      booking_id: body.booking_id ?? null,
      guest_id: body.guest_id ?? null,
      title: body.title,
      content: body.content,
      pinned: body.pinned ?? false,
      author: body.author ?? 'system',
      tags: body.tags ?? [],
      created_at: now,
      updated_at: now,
    };

    notes.push(note);

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create note', detail: error.message },
      { status: 500 },
    );
  }
}
