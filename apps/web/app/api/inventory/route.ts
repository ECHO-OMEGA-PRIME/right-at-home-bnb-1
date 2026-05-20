import { NextRequest, NextResponse } from 'next/server';

// ── In-memory inventory store ───────────────────────────────────────────────
const inventory: any[] = [
  {
    id: 'INV-001',
    name: 'Bath Towels (White)',
    category: 'linens',
    sku: 'LIN-TOWEL-WHT',
    quantity_on_hand: 24,
    reorder_level: 10,
    reorder_quantity: 20,
    unit_cost_cents: 1200,
    storage_location: 'Main Storage - Shelf A2',
    supplier: 'Midland Wholesale Linens',
    property_id: null,
    last_counted_at: '2026-03-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
  },
  {
    id: 'INV-002',
    name: 'Toilet Paper (12-pack)',
    category: 'toiletries',
    sku: 'TOI-TP-12PK',
    quantity_on_hand: 8,
    reorder_level: 10,
    reorder_quantity: 24,
    unit_cost_cents: 1499,
    storage_location: 'Main Storage - Shelf B1',
    supplier: 'Costco Business',
    property_id: null,
    last_counted_at: '2026-03-01T00:00:00Z',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
  {
    id: 'INV-003',
    name: 'All-Purpose Cleaner (1 gal)',
    category: 'cleaning',
    sku: 'CLN-APC-1GAL',
    quantity_on_hand: 5,
    reorder_level: 3,
    reorder_quantity: 6,
    unit_cost_cents: 1899,
    storage_location: 'Cleaning Closet',
    supplier: 'Home Depot',
    property_id: null,
    last_counted_at: '2026-03-01T00:00:00Z',
    created_at: '2025-08-01T00:00:00Z',
    updated_at: '2026-03-12T00:00:00Z',
  },
  {
    id: 'INV-004',
    name: 'Smart Lock Batteries (AA 8-pack)',
    category: 'hardware',
    sku: 'HW-BATT-AA8',
    quantity_on_hand: 3,
    reorder_level: 4,
    reorder_quantity: 10,
    unit_cost_cents: 899,
    storage_location: 'Maintenance Closet',
    supplier: 'Amazon Business',
    property_id: null,
    last_counted_at: '2026-03-01T00:00:00Z',
    created_at: '2025-09-01T00:00:00Z',
    updated_at: '2026-03-05T00:00:00Z',
  },
  {
    id: 'INV-005',
    name: 'Coffee Pods (K-Cup 50ct)',
    category: 'amenities',
    sku: 'AMN-KCUP-50',
    quantity_on_hand: 2,
    reorder_level: 3,
    reorder_quantity: 6,
    unit_cost_cents: 2499,
    storage_location: 'Main Storage - Shelf C1',
    supplier: 'Costco Business',
    property_id: null,
    last_counted_at: '2026-03-01T00:00:00Z',
    created_at: '2025-10-01T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ── GET /api/inventory ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const category = params.get('category');
    const lowStock = params.get('low_stock');
    const search = params.get('search');

    let filtered = [...inventory];

    if (category) {
      filtered = filtered.filter((i) => i.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q),
      );
    }
    if (lowStock === 'true') {
      filtered = filtered.filter((i) => i.quantity_on_hand <= i.reorder_level);
    }

    const lowStockItems = inventory.filter((i) => i.quantity_on_hand <= i.reorder_level);

    return NextResponse.json({
      inventory: filtered,
      total: filtered.length,
      low_stock_alerts: lowStockItems.map((i) => ({
        id: i.id,
        name: i.name,
        quantity_on_hand: i.quantity_on_hand,
        reorder_level: i.reorder_level,
        reorder_quantity: i.reorder_quantity,
        supplier: i.supplier,
      })),
      low_stock_count: lowStockItems.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list inventory', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/inventory ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const required = ['name', 'category', 'quantity_on_hand'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }

    if (typeof body.quantity_on_hand !== 'number' || body.quantity_on_hand < 0) {
      return NextResponse.json(
        { error: 'quantity_on_hand must be a non-negative number' },
        { status: 400 },
      );
    }

    const validCategories = ['linens', 'toiletries', 'cleaning', 'hardware', 'amenities', 'kitchen', 'outdoor', 'other'];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const item = {
      id: generateId('INV'),
      name: body.name,
      category: body.category,
      sku: body.sku ?? null,
      quantity_on_hand: body.quantity_on_hand,
      reorder_level: body.reorder_level ?? 5,
      reorder_quantity: body.reorder_quantity ?? 10,
      unit_cost_cents: body.unit_cost_cents ?? 0,
      storage_location: body.storage_location ?? '',
      supplier: body.supplier ?? '',
      property_id: body.property_id ?? null,
      last_counted_at: now,
      created_at: now,
      updated_at: now,
    };

    inventory.push(item);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create inventory item', detail: error.message },
      { status: 500 },
    );
  }
}
