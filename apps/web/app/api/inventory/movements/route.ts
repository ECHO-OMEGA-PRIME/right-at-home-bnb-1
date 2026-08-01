import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { propertyScopeFor, scopeAllows, scopedWhere } from '@/lib/tenant-scope';
import { prisma } from '@/lib/prisma';

// Real InventoryMovement rows (queue #26855). Movements were pushed onto an
// in-memory array, so the stock ledger reset on every cold start.
//
// This log is the source of truth for quantity_on_hand (see @/lib/inventory),
// which is why it is append-only: correcting a mistake means recording an
// offsetting 'adjustment', not editing history.

const VALID_TYPES = ['purchase', 'usage', 'adjustment', 'damaged', 'returned', 'transfer'];

// ── GET /api/inventory/movements ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const itemId = params.get('item_id');
    const type = params.get('type');
    const propertyId = params.get('property_id');

    // Property-level isolation (#26919): stock movements reveal what is being
    // consumed at each house, so they scope like everything else.
    //
    // InventoryMovement.propertyId is NULLABLE -- general supplies are recorded
    // with no property. A restricted caller therefore does NOT see unattributed
    // movements, because `propertyId: { in: [...] }` excludes nulls. That is the
    // right way round: an unattributed movement is not evidence of entitlement.
    // Owners are unaffected (their scope is null, so no filter is applied).
    const scope = await propertyScopeFor(auth.user);

    const rows = await prisma.inventoryMovement.findMany({
      where: scopedWhere({
        ...(itemId ? { itemId } : {}),
        ...(type ? { reason: type } : {}),
        ...(propertyId ? { propertyId } : {}),
      }, scope),
      include: { item: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const movements = rows.map((m) => ({
      id: m.id,
      item_id: m.itemId,
      item_name: m.item?.name ?? '',
      type: m.reason,
      quantity: m.quantityDelta,
      property_id: m.propertyId,
      notes: m.reference,
      performed_by: m.createdById ?? 'System',
      created_at: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ movements, total: movements.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list movements', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/inventory/movements ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['worker', 'owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.item_id) {
      return NextResponse.json({ error: 'Missing required field: item_id' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (typeof body.quantity !== 'number' || body.quantity === 0 || !Number.isInteger(body.quantity)) {
      return NextResponse.json(
        { error: 'quantity must be a non-zero integer (positive for additions, negative for removals)' },
        { status: 400 },
      );
    }

    // Reject movements against an item that does not exist, rather than
    // recording stock history for nothing.
    const item = await prisma.inventoryItem.findUnique({
      where: { id: body.item_id },
      select: { id: true, name: true, propertyId: true },
    });
    // An item addressed by id skipped the scope, so a worker could record stock
    // movements against inventory at any property. Items with a NULL propertyId
    // are shared/general supplies -- those stay available to everyone, because
    // they belong to no property rather than to someone else's.
    const writeScope = await propertyScopeFor(auth.user);
    if (item && item.propertyId && !scopeAllows(writeScope, item.propertyId)) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    const created = await prisma.inventoryMovement.create({
      data: {
        itemId: item.id,
        propertyId: body.property_id ?? item.propertyId ?? null,
        quantityDelta: body.quantity,
        reason: body.type,
        reference: body.notes ?? null,
        createdById: body.performed_by ?? null,
      },
    });

    return NextResponse.json(
      {
        movement: {
          id: created.id,
          item_id: created.itemId,
          item_name: item.name,
          type: created.reason,
          quantity: created.quantityDelta,
          property_id: created.propertyId,
          notes: created.reference,
          performed_by: created.createdById ?? 'System',
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to record movement', detail: error.message },
      { status: 500 },
    );
  }
}
