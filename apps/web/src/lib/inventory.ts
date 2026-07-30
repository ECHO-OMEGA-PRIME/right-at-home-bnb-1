import { prisma } from '@/lib/prisma';

/**
 * Inventory service (queue #26855).
 *
 * quantity_on_hand is DERIVED by summing InventoryMovement.quantityDelta, never
 * stored. A stored count and an append-only movement log are two sources of
 * truth for the same number, and they drift the moment one write succeeds and
 * the other does not -- the same class of bug as Guest.totalStays, which reads
 * 0 for all 494 guests while their bookings say otherwise.
 *
 * The trade-off is a groupBy on every read. That is the right trade for stock
 * levels that drive reorder decisions.
 */

export interface InventoryItemContract {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  quantity_on_hand: number;
  reorder_level: number;
  reorder_quantity: number;
  unit_cost_cents: number;
  storage_location: string | null;
  supplier: string | null;
  property_id: string | null;
  last_counted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  unit: string;
  parLevel: number;
  reorderQuantity: number;
  unitCostCents: number;
  supplier: string | null;
  storageLocation: string | null;
  lastCountedAt: Date | null;
  propertyId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toContract(i: ItemRow, onHand: number): InventoryItemContract {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    sku: i.sku,
    quantity_on_hand: onHand,
    reorder_level: i.parLevel,
    reorder_quantity: i.reorderQuantity,
    unit_cost_cents: i.unitCostCents,
    storage_location: i.storageLocation,
    supplier: i.supplier,
    property_id: i.propertyId,
    last_counted_at: i.lastCountedAt ? i.lastCountedAt.toISOString() : null,
    created_at: i.createdAt.toISOString(),
    updated_at: i.updatedAt.toISOString(),
  };
}

/** Net quantity per item, from the append-only movement log. */
export async function onHandByItem(): Promise<Map<string, number>> {
  const sums = await prisma.inventoryMovement.groupBy({
    by: ['itemId'],
    _sum: { quantityDelta: true },
  });
  return new Map(sums.map((s) => [s.itemId, s._sum.quantityDelta ?? 0]));
}

export async function listInventory(opts: {
  category?: string | null;
  lowStock?: string | null;
  search?: string | null;
  propertyId?: string | null;
}) {
  const items = (await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.propertyId ? { propertyId: opts.propertyId } : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: 'insensitive' as const } },
              { sku: { contains: opts.search, mode: 'insensitive' as const } },
              { supplier: { contains: opts.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })) as ItemRow[];

  const onHand = await onHandByItem();
  let mapped = items.map((i) => toContract(i, onHand.get(i.id) ?? 0));

  // Low stock is derived from the derived quantity, so it must be applied after
  // mapping rather than pushed into SQL.
  const lowStockItems = mapped.filter((i) => i.quantity_on_hand <= i.reorder_level);
  if (opts.lowStock === 'true') mapped = lowStockItems;

  return {
    inventory: mapped,
    total: mapped.length,
    low_stock_alerts: lowStockItems.map((i) => ({
      id: i.id,
      name: i.name,
      quantity_on_hand: i.quantity_on_hand,
      reorder_level: i.reorder_level,
      reorder_quantity: i.reorder_quantity,
      supplier: i.supplier,
    })),
    low_stock_count: lowStockItems.length,
    total_value_cents: mapped.reduce(
      (s, i) => s + i.quantity_on_hand * i.unit_cost_cents,
      0,
    ),
  };
}

export async function getInventoryItem(id: string) {
  const item = (await prisma.inventoryItem.findUnique({ where: { id } })) as ItemRow | null;
  if (!item) return null;
  const agg = await prisma.inventoryMovement.aggregate({
    where: { itemId: id },
    _sum: { quantityDelta: true },
  });
  return toContract(item, agg._sum.quantityDelta ?? 0);
}

/**
 * Create an item, recording any opening quantity as an explicit movement rather
 * than as a stored starting count -- so the very first number is auditable too.
 */
export async function createInventoryItem(input: {
  name: string;
  category: string;
  sku?: string | null;
  quantityOnHand?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  unitCostCents?: number;
  storageLocation?: string | null;
  supplier?: string | null;
  propertyId?: string | null;
}) {
  const item = (await prisma.inventoryItem.create({
    data: {
      name: input.name,
      category: input.category,
      sku: input.sku || null,
      parLevel: input.reorderLevel ?? 5,
      reorderQuantity: input.reorderQuantity ?? 10,
      unitCostCents: input.unitCostCents ?? 0,
      storageLocation: input.storageLocation ?? null,
      supplier: input.supplier ?? null,
      propertyId: input.propertyId ?? null,
    },
  })) as ItemRow;

  const opening = input.quantityOnHand ?? 0;
  if (opening > 0) {
    await prisma.inventoryMovement.create({
      data: {
        itemId: item.id,
        propertyId: item.propertyId,
        quantityDelta: opening,
        reason: 'opening_balance',
        reference: `item:${item.id}`,
      },
    });
  }

  return toContract(item, opening);
}
