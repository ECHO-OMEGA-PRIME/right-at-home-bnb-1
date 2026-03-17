import { NextRequest, NextResponse } from 'next/server';

// ── In-memory movements store ───────────────────────────────────────────────
const movements: any[] = [
  {
    id: 'MOV-001',
    item_id: 'INV-002',
    item_name: 'Toilet Paper (12-pack)',
    type: 'usage',
    quantity: -2,
    property_id: 'PROP-001',
    notes: 'Restocked Sunset Retreat after checkout',
    performed_by: 'Maria Garcia',
    created_at: '2026-03-15T14:00:00Z',
  },
  {
    id: 'MOV-002',
    item_id: 'INV-001',
    item_name: 'Bath Towels (White)',
    type: 'purchase',
    quantity: 20,
    property_id: null,
    notes: 'Bulk order from Midland Wholesale Linens',
    performed_by: 'Bobby McWilliams',
    created_at: '2026-03-10T09:00:00Z',
  },
  {
    id: 'MOV-003',
    item_id: 'INV-005',
    item_name: 'Coffee Pods (K-Cup 50ct)',
    type: 'usage',
    quantity: -1,
    property_id: 'PROP-002',
    notes: 'Restocked Oilfield Oasis kitchen',
    performed_by: 'Rosa Martinez',
    created_at: '2026-03-14T11:00:00Z',
  },
  {
    id: 'MOV-004',
    item_id: 'INV-001',
    item_name: 'Bath Towels (White)',
    type: 'damaged',
    quantity: -2,
    property_id: 'PROP-001',
    notes: 'Stained beyond cleaning — disposed',
    performed_by: 'Maria Garcia',
    created_at: '2026-03-12T16:00:00Z',
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/inventory/movements ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const itemId = params.get('item_id');
    const type = params.get('type');
    const propertyId = params.get('property_id');

    let filtered = [...movements];

    if (itemId) {
      filtered = filtered.filter((m) => m.item_id === itemId);
    }
    if (type) {
      filtered = filtered.filter((m) => m.type === type);
    }
    if (propertyId) {
      filtered = filtered.filter((m) => m.property_id === propertyId);
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      movements: filtered,
      total: filtered.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list movements', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/inventory/movements ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['item_id', 'type', 'quantity'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    const validTypes = ['purchase', 'usage', 'adjustment', 'damaged', 'returned', 'transfer'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },
      );
    }

    if (typeof body.quantity !== 'number' || body.quantity === 0) {
      return NextResponse.json(
        { error: 'quantity must be a non-zero number (positive for additions, negative for removals)' },
        { status: 400 },
      );
    }

    const movement = {
      id: generateId('MOV'),
      item_id: body.item_id,
      item_name: body.item_name ?? '',
      type: body.type,
      quantity: body.quantity,
      property_id: body.property_id ?? null,
      notes: body.notes ?? '',
      performed_by: body.performed_by ?? 'System',
      created_at: new Date().toISOString(),
    };

    movements.push(movement);

    return NextResponse.json({ movement }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to record movement', detail: error.message },
      { status: 500 },
    );
  }
}
