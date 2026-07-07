/**
 * VRBO Partner Central CSV reservation import + calendar reconciliation.
 */

import prisma from '@/lib/prisma';
import { parseVrboReservationsCsv, type VrboReservationRow } from '@rightathome/shared/vrbo';

export interface CsvImportResult {
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function upsertReservation(row: VrboReservationRow): Promise<'imported' | 'updated' | 'skipped' | 'error'> {
  const property = row.vrboListingId
    ? await prisma.property.findFirst({ where: { vrboId: row.vrboListingId } })
    : null;

  if (!property) {
    return 'skipped';
  }

  const totalNights = Math.max(
    1,
    Math.ceil((row.checkOut.getTime() - row.checkIn.getTime()) / 86400000)
  );

  let guest = await prisma.guest.findFirst({
    where: row.guestEmail
      ? { email: row.guestEmail }
      : { platform: 'VRBO', platformId: row.confirmCode },
  });

  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        email: row.guestEmail || `vrbo-csv-${row.confirmCode}@rah-midland.com`,
        name: row.guestName,
        phone: row.guestPhone || null,
        platform: 'VRBO',
        platformId: row.confirmCode,
      },
    });
  }

  const existing = await prisma.booking.findFirst({
    where: {
      propertyId: property.id,
      OR: [{ confirmCode: row.confirmCode }, { confirmCode: `CSV-${row.confirmCode}` }],
    },
  });

  if (existing) {
    const changed =
      existing.checkIn.getTime() !== row.checkIn.getTime() ||
      existing.checkOut.getTime() !== row.checkOut.getTime() ||
      existing.status !== row.status;

    if (changed) {
      await prisma.booking.update({
        where: { id: existing.id },
        data: {
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          totalNights,
          status: row.status,
          guestCount: row.guestCount,
          totalPrice: row.totalPrice ?? existing.totalPrice,
        },
      });
      return 'updated';
    }
    return 'skipped';
  }

  await prisma.booking.create({
    data: {
      propertyId: property.id,
      guestId: guest.id,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      guestCount: row.guestCount,
      platform: 'VRBO',
      confirmCode: row.confirmCode,
      nightlyRate: property.nightlyRate,
      totalNights,
      subtotal: property.nightlyRate * totalNights,
      cleaningFee: property.cleaningFee ?? 0,
      totalPrice: row.totalPrice ?? property.nightlyRate * totalNights + (property.cleaningFee ?? 0),
      status: row.status,
    },
  });

  return 'imported';
}

export async function importVrboReservationsCsv(csvText: string): Promise<CsvImportResult> {
  const rows = parseVrboReservationsCsv(csvText);
  const result: CsvImportResult = {
    processed: rows.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      const action = await upsertReservation(row);
      if (action === 'imported') result.imported++;
      else if (action === 'updated') result.updated++;
      else if (action === 'skipped') result.skipped++;
      else result.errors.push(`Row ${row.confirmCode}: property not found for listing ${row.vrboListingId}`);
    } catch (err) {
      result.errors.push(
        `Row ${row.confirmCode}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  await prisma.syncLog.create({
    data: {
      syncType: 'csv_import',
      source: 'vrbo',
      status: result.errors.length > 0 ? 'partial' : 'success',
      itemsProcessed: result.processed,
      itemsCreated: result.imported,
      itemsUpdated: result.updated,
      errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
    },
  });

  return result;
}