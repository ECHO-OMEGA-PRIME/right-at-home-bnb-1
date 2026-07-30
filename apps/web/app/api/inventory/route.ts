import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { createInventoryItem, listInventory } from '@/lib/inventory';

// Real InventoryItem / InventoryMovement rows (queue #26855). This route served
// a hardcoded array, so stock levels, low-stock alerts and reorder decisions
// were all driven by numbers nobody had ever counted.
//
// quantity_on_hand is DERIVED from the movement log rather than stored, so the
// count cannot drift away from the movements that produced it.

const VALID_CATEGORIES = [
  'linens', 'toiletries', 'cleaning', 'hardware',
  'amenities', 'kitchen', 'outdoor', 'other',
];

// ── GET /api/inventory ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const result = await listInventory({
      category: params.get('category'),
      lowStock: params.get('low_stock'),
      search: params.get('search'),
      propertyId: params.get('property_id'),
    });

    // Exactly the contract's four keys.
    return NextResponse.json({
      inventory: result.inventory,
      total: result.total,
      low_stock_alerts: result.low_stock_alerts,
      low_stock_count: result.low_stock_count,
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
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    for (const field of ['name', 'category'] as const) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }
    if (typeof body.quantity_on_hand !== 'number' || body.quantity_on_hand < 0) {
      return NextResponse.json(
        { error: 'quantity_on_hand must be a non-negative number' },
        { status: 400 },
      );
    }
    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    const item = await createInventoryItem({
      name: body.name,
      category: body.category,
      sku: body.sku ?? null,
      quantityOnHand: body.quantity_on_hand,
      reorderLevel: body.reorder_level,
      reorderQuantity: body.reorder_quantity,
      unitCostCents: body.unit_cost_cents,
      storageLocation: body.storage_location ?? null,
      supplier: body.supplier ?? null,
      propertyId: body.property_id ?? null,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    // A duplicate SKU is a client error, not a server fault.
    if (String(error.message).includes('Unique constraint')) {
      return NextResponse.json({ error: 'An item with that SKU already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create inventory item', detail: error.message },
      { status: 500 },
    );
  }
}
