export const OCCUPYING_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'BLOCKED',
] as const;

const GUEST_RESERVATION_STATUSES = new Set(['PENDING', 'CONFIRMED', 'CHECKED_IN']);
const DEFAULT_STALE_AFTER_MS = 15 * 60_000;

export type AvailabilityBooking = {
  id: string;
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  platform: string;
  status: string;
};

export type AvailabilityProperty = {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  vrboSync: {
    syncEnabled: boolean;
    lastIcalSync: Date | null;
  } | null;
};

export type BookingConflict = {
  propertyId: string;
  booking1Id: string;
  booking2Id: string;
  platform1: string;
  platform2: string;
  start1: string;
  end1: string;
  start2: string;
  end2: string;
  overlapStart: string;
  overlapEnd: string;
};

function rangesOverlap(left: AvailabilityBooking, right: AvailabilityBooking): boolean {
  return left.checkIn < right.checkOut && right.checkIn < left.checkOut;
}

function isConflict(left: AvailabilityBooking, right: AvailabilityBooking): boolean {
  if (!rangesOverlap(left, right)) return false;
  return GUEST_RESERVATION_STATUSES.has(left.status) || GUEST_RESERVATION_STATUSES.has(right.status);
}

export function buildBookingConflicts(bookings: AvailabilityBooking[]): BookingConflict[] {
  const byProperty = new Map<string, AvailabilityBooking[]>();
  for (const booking of bookings) {
    const rows = byProperty.get(booking.propertyId) || [];
    rows.push(booking);
    byProperty.set(booking.propertyId, rows);
  }

  const conflicts: BookingConflict[] = [];
  for (const [propertyId, rows] of byProperty) {
    rows.sort((left, right) => left.checkIn.getTime() - right.checkIn.getTime());
    for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
      const left = rows[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
        const right = rows[rightIndex];
        if (right.checkIn >= left.checkOut) break;
        if (!isConflict(left, right)) continue;
        const overlapStart = new Date(Math.max(left.checkIn.getTime(), right.checkIn.getTime()));
        const overlapEnd = new Date(Math.min(left.checkOut.getTime(), right.checkOut.getTime()));
        conflicts.push({
          propertyId,
          booking1Id: left.id,
          booking2Id: right.id,
          platform1: left.platform,
          platform2: right.platform,
          start1: left.checkIn.toISOString(),
          end1: left.checkOut.toISOString(),
          start2: right.checkIn.toISOString(),
          end2: right.checkOut.toISOString(),
          overlapStart: overlapStart.toISOString(),
          overlapEnd: overlapEnd.toISOString(),
        });
      }
    }
  }
  return conflicts;
}

function staySummary(booking: AvailabilityBooking | undefined) {
  if (!booking) return null;
  return {
    bookingId: booking.id,
    platform: booking.platform,
    status: booking.status,
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
  };
}

export function summarizePortfolioAvailability({
  properties,
  bookings,
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
}: {
  properties: AvailabilityProperty[];
  bookings: AvailabilityBooking[];
  now?: Date;
  staleAfterMs?: number;
}) {
  const conflicts = buildBookingConflicts(bookings);
  const conflictCounts = new Map<string, number>();
  for (const conflict of conflicts) {
    conflictCounts.set(conflict.propertyId, (conflictCounts.get(conflict.propertyId) || 0) + 1);
  }

  const rows = properties.map((property) => {
    const propertyBookings = bookings
      .filter((booking) => booking.propertyId === property.id)
      .sort((left, right) => left.checkIn.getTime() - right.checkIn.getTime());
    const current = propertyBookings.find(
      (booking) => booking.checkIn <= now && booking.checkOut > now,
    );
    const next = propertyBookings.find((booking) => booking.checkIn > now);
    const lastSync = property.vrboSync?.lastIcalSync || null;
    const syncAgeMs = lastSync ? Math.max(0, now.getTime() - lastSync.getTime()) : null;
    const sourceState = !property.vrboSync || !property.vrboSync.syncEnabled || !lastSync
      ? 'missing'
      : syncAgeMs! <= staleAfterMs
        ? 'fresh'
        : 'stale';
    const availability = current?.status === 'BLOCKED'
      ? 'blocked'
      : current
        ? 'occupied'
        : 'available';

    return {
      propertyId: property.id,
      slug: property.slug,
      name: property.name,
      address: property.address,
      availability,
      conflictCount: conflictCounts.get(property.id) || 0,
      sourceState,
      sourceAgeSeconds: syncAgeMs === null ? null : Math.floor(syncAgeMs / 1000),
      lastIcalSync: lastSync?.toISOString() || null,
      currentStay: staySummary(current),
      nextStay: staySummary(next),
    };
  });

  return {
    generatedAt: now.toISOString(),
    staleAfterSeconds: Math.floor(staleAfterMs / 1000),
    summary: {
      total: rows.length,
      occupied: rows.filter((row) => row.availability === 'occupied').length,
      blocked: rows.filter((row) => row.availability === 'blocked').length,
      available: rows.filter((row) => row.availability === 'available').length,
      conflicts: conflicts.length,
      staleSources: rows.filter((row) => row.sourceState !== 'fresh').length,
    },
    properties: rows,
  };
}
