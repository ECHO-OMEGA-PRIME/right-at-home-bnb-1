import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Real Note rows (queue #26855). Notes lived in an in-memory array, so every
// note was discarded on the next cold start -- including entries like "front
// gate code changed to 4821", which is precisely the sort of note whose loss
// causes an operational failure rather than a cosmetic one.

const VALID_TYPES = ['general', 'property', 'booking', 'guest', 'maintenance'];

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(',').map((t) => t.trim()).filter(Boolean);
  }
}

function toContract(n: any) {
  return {
    id: n.id,
    type: n.type,
    property_id: n.propertyId,
    booking_id: n.bookingId,
    guest_id: n.guestId,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
    author: n.author,
    tags: parseTags(n.tags),
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  };
}

// ── GET /api/notes ────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get('type');
    const propertyId = params.get('property_id');
    const bookingId = params.get('booking_id');
    const guestId = params.get('guest_id');
    const pinned = params.get('pinned');
    const search = params.get('search');
    const tag = params.get('tag');

    const rows = await prisma.note.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(propertyId ? { propertyId } : {}),
        ...(bookingId ? { bookingId } : {}),
        ...(guestId ? { guestId } : {}),
        ...(pinned !== null ? { pinned: pinned === 'true' } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { content: { contains: search, mode: 'insensitive' as const } },
                { tags: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      // Pinned first, then newest -- the same ordering the route promised.
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });

    let notes = rows.map(toContract);
    // Tags are stored as a JSON string, so an exact tag match is applied after
    // parsing; a SQL `contains` would also match 'access-code' for 'access'.
    if (tag) notes = notes.filter((n) => n.tags.includes(tag));

    return NextResponse.json({
      notes,
      total: notes.length,
      pinned_count: notes.filter((n) => n.pinned).length,
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
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.title || !body.content) {
      return NextResponse.json({ error: 'Required: title, content' }, { status: 400 });
    }

    const noteType = body.type ?? 'general';
    if (!VALID_TYPES.includes(noteType)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const created = await prisma.note.create({
      data: {
        type: noteType,
        propertyId: body.property_id ?? null,
        bookingId: body.booking_id ?? null,
        guestId: body.guest_id ?? null,
        title: body.title,
        content: body.content,
        pinned: body.pinned ?? false,
        // Attribute to the signed-in user when the caller does not say.
        author: body.author ?? auth.user?.email ?? 'system',
        tags: body.tags ? JSON.stringify(body.tags) : null,
      },
    });

    return NextResponse.json({ note: toContract(created) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create note', detail: error.message },
      { status: 500 },
    );
  }
}
