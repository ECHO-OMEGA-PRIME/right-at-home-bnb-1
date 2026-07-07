/**
 * Right at Home BnB - VRBO Sync Service
 * Fetches iCal feeds from VRBO, parses bookings, and upserts into Supabase.
 * Runs every 15 minutes via Vercel cron. No PMS middleman needed.
 */

import prisma from '@/lib/prisma';
import {
  parseICalFeed,
  fetchAndParseICal,
  type ICalBooking,
} from '@rightathome/shared/vrbo';
import { runNewBookingAutomations, runModifiedBookingAutomations, runCancelledBookingAutomations } from './booking-automations';
import type { AutomationResult } from './booking-automations';

// ============================================
// VRBO PROPERTY MAP — Corrected from Partner Central April 2026
// slug -> VRBO listing ID (18 active + 13 inactive = 31 total)
// ============================================

export const VRBO_PROPERTIES: Record<string, string> = {
  // ── ACTIVE (18) ──
  'castleford-5005': '2636389',       // Oasis with Pool & Billiards
  'golf-course-2309': '3005111',      // Adobe Compound w/Pool, Fire Pits, Billiards
  'garfield-2702': '2634718',         // Patio Home with Hot Tub
  'douglas-2000': '3355618',          // Old Midland Living
  'dentcrest-4707': '2638481',        // Hot Tub Delight
  'chelsea-3210': '2643784',          // Retreat with Covered Patio
  'storey-4801': '2643822',           // Destination Getaway
  'daventry-1309': '4750070',         // Saddle Club
  'daventry-1311': '4179271',         // Santiago Dreams
  'lincoln-green-5800': '4581977',    // Sprawling Ranch House
  'shandon-3528': '4894280',          // Groovy Times with Pool
  'monterrey-1605': '3477668',        // Monterrey House
  'gleneagles-4535': '2643808',       // Northtown Place
  'humble-3104': '4700881',           // Outdoor Dream
  'lanham-1426': '4437486',           // Posh & Private with Billiards
  'siesta-4217': '4135262',           // Cowboy Siesta Corner Lot
  'mogford-1408': '3724481',          // Clermont House w/Pool & Billiards
  'blazing-saddle-2501': '5103283',   // Mockingbird Ridge
  // ── INACTIVE (13) ──
  'haynes-2802': '2638524',           // Safari Gameroom
  'vanguard-6613': '3559249',         // Vanguard Velvet Lounge
  'oriole-6100': '4471713',           // Most Marvelous with Pool
  'gleneagles-4533': '4056016',       // Uptown Place (long-term renter)
  'haynes-2314': '4162037',           // Grand Encore
  'haynes-2312': '2641181',           // Grand Lodging
  'cuthbert-1702': '4255338',         // Sprawling Ranch (Cuthbert)
  'spring-meadow-4823': '2685503',    // Meadowpark
  'douglas-2800': '2635356',          // Park View
  'medina-6002': '2636694',           // Los Patios
  'boulder-4700': '2983233',          // Bungalow on Boulder
  'fenway-5705': '3764453',           // Chateau w/Sequestered Loft
  'blazing-saddle-dup': '5103284',    // Blazing Saddle (duplicate of Saddle Club)
};

type ParsedBooking = ICalBooking;

// ============================================
// SYNC ENGINE
// ============================================

export interface SyncResult {
  propertyId: string;
  vrboId: string;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
  automations?: AutomationResult[];
}

export interface FullSyncResult {
  properties: SyncResult[];
  totalImported: number;
  totalUpdated: number;
  totalErrors: number;
  durationMs: number;
  syncedAt: string;
}

/**
 * Sync a single property's iCal feed into the database.
 */
export async function syncPropertyIcal(propertyId: string, vrboListingId: string, icalUrl: string): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = { propertyId, vrboId: vrboListingId, imported: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const parsedBookings = await fetchAndParseICal(icalUrl);

    // Find the internal property record
    const property = await prisma.property.findFirst({
      where: { OR: [{ vrboId: vrboListingId }, { id: propertyId }] },
    });
    if (!property) {
      throw new Error(`Property not found: ${propertyId} / vrbo:${vrboListingId}`);
    }

    // Upsert each booking
    for (const booking of parsedBookings) {
      try {
        // Skip blocked/unavailable dates (no guest)
        if (!booking.guestName && booking.summary?.toLowerCase().includes('block')) {
          result.skipped++;
          continue;
        }

        const totalNights = Math.max(1, Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86400000));

        // Find or create guest
        let guest = await prisma.guest.findFirst({
          where: booking.guestName ? { name: booking.guestName, platform: 'VRBO' } : undefined,
        });
        if (!guest && booking.guestName) {
          guest = await prisma.guest.create({
            data: {
              email: `vrbo-${booking.uid.slice(0, 8)}@rah-midland.com`,
              name: booking.guestName,
              platform: 'VRBO',
              platformId: booking.confirmCode || booking.uid,
            },
          });
        }
        if (!guest) {
          // Create placeholder guest for blocked dates
          guest = await prisma.guest.create({
            data: {
              email: `blocked-${booking.uid.slice(0, 8)}@rah-midland.com`,
              name: booking.summary || 'VRBO Booking',
              platform: 'VRBO',
              platformId: booking.uid,
            },
          });
        }

        // Check if booking already exists (by UID or confirm code)
        const existingBooking = await prisma.booking.findFirst({
          where: {
            propertyId: property.id,
            OR: [
              { confirmCode: booking.uid },
              ...(booking.confirmCode ? [{ confirmCode: booking.confirmCode }] : []),
            ],
          },
        });

        if (existingBooking) {
          // Update if dates changed
          const datesChanged = existingBooking.checkIn.getTime() !== booking.checkIn.getTime() ||
                               existingBooking.checkOut.getTime() !== booking.checkOut.getTime();
          const wasCancelled = booking.status === 'CANCELLED' && existingBooking.status !== 'CANCELLED';

          if (datesChanged || wasCancelled) {
            await prisma.booking.update({
              where: { id: existingBooking.id },
              data: {
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                totalNights,
                status: booking.status === 'CANCELLED' ? 'CANCELLED' : existingBooking.status,
              },
            });
            result.updated++;

            // Fire automations on date change or cancellation
            if (wasCancelled) {
              try {
                await runCancelledBookingAutomations(existingBooking.id, property.id);
              } catch {}
            } else if (datesChanged) {
              try {
                const autoResult = await runModifiedBookingAutomations({
                  bookingId: existingBooking.id,
                  propertyId: property.id,
                  propertyName: property.name,
                  guestId: guest.id,
                  guestName: booking.guestName || guest.name,
                  checkIn: booking.checkIn,
                  checkOut: booking.checkOut,
                  confirmCode: booking.confirmCode || booking.uid,
                  platform: 'VRBO',
                });
                if (!result.automations) result.automations = [];
                result.automations.push(autoResult);
              } catch {}
            }
          } else {
            result.skipped++;
          }
        } else {
          // Create new booking
          const newBooking = await prisma.booking.create({
            data: {
              propertyId: property.id,
              guestId: guest.id,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              guestCount: 1,
              platform: 'VRBO',
              confirmCode: booking.confirmCode || booking.uid,
              nightlyRate: property.nightlyRate,
              totalNights,
              subtotal: property.nightlyRate * totalNights,
              cleaningFee: property.cleaningFee || 0,
              totalPrice: (property.nightlyRate * totalNights) + (property.cleaningFee || 0),
              status: booking.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
              specialReqs: booking.description || null,
            },
          });
          result.imported++;

          // 🔥 FIRE AUTOMATIONS for new booking
          if (booking.status !== 'CANCELLED') {
            try {
              const autoResult = await runNewBookingAutomations({
                bookingId: newBooking.id,
                propertyId: property.id,
                propertyName: property.name,
                guestId: guest.id,
                guestName: booking.guestName || guest.name,
                guestEmail: guest.email,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                confirmCode: booking.confirmCode || booking.uid,
                platform: 'VRBO',
              });
              if (!result.automations) result.automations = [];
              result.automations.push(autoResult);
            } catch (autoErr: any) {
              console.error(`[vrbo-sync] Automation error: ${autoErr.message}`);
            }
          }
        }
      } catch (err: any) {
        result.errors.push(`Booking ${booking.uid}: ${err.message}`);
      }
    }

    // Update sync timestamp
    await prisma.vrboSync.upsert({
      where: { propertyId: property.id },
      update: { lastIcalSync: new Date() },
      create: {
        propertyId: property.id,
        vrboListingId,
        icalUrl,
        lastIcalSync: new Date(),
      },
    });

  } catch (err: any) {
    result.errors.push(err.message);
  }

  result.durationMs = Date.now() - start;

  // Log sync result
  try {
    await prisma.syncLog.create({
      data: {
        propertyId,
        syncType: 'ical_import',
        source: 'vrbo',
        status: result.errors.length > 0 ? (result.imported > 0 ? 'partial' : 'failed') : 'success',
        itemsProcessed: result.imported + result.updated + result.skipped,
        itemsCreated: result.imported,
        itemsUpdated: result.updated,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
        durationMs: result.durationMs,
      },
    });
  } catch {}

  return result;
}

/**
 * Sync all VRBO properties via iCal feeds.
 * Called by the /api/cron/vrbo-sync endpoint every 15 minutes.
 */
export async function syncAllProperties(): Promise<FullSyncResult> {
  const start = Date.now();
  const results: SyncResult[] = [];

  // Get all properties with VRBO IDs from the database
  const properties = await prisma.property.findMany({
    where: { vrboId: { not: null }, status: 'ACTIVE' },
    include: { vrboSync: true },
  });

  for (const property of properties) {
    if (!property.vrboId) continue;

    // iCal URL must be the owner-specific export URL from Partner Central
    // Format: https://www.vrbo.com/icalendar/{uniqueHash}.ics
    // These are set per-property in the VrboSync table after scraping Partner Central
    const icalUrl = property.vrboSync?.icalUrl;
    if (!icalUrl || icalUrl.includes('/ical/')) {
      // Skip properties without proper iCal export URL
      results.push({ propertyId: property.id, vrboId: property.vrboId!, imported: 0, updated: 0, skipped: 0, errors: ['No iCal export URL set — need to scrape from Partner Central'], durationMs: 0 });
      continue;
    }

    const result = await syncPropertyIcal(property.id, property.vrboId, icalUrl);
    results.push(result);

    // Small delay between properties to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  return {
    properties: results,
    totalImported,
    totalUpdated,
    totalErrors,
    durationMs: Date.now() - start,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Initialize VrboSync records for all properties that have VRBO IDs.
 * Run once to seed the mapping table.
 */
export async function initializeVrboMappings(): Promise<number> {
  const properties = await prisma.property.findMany({
    where: { vrboId: { not: null } },
  });

  let created = 0;
  for (const property of properties) {
    if (!property.vrboId) continue;
    const existing = await prisma.vrboSync.findUnique({ where: { propertyId: property.id } });
    if (!existing) {
      await prisma.vrboSync.create({
        data: {
          propertyId: property.id,
          vrboListingId: property.vrboId,
          icalUrl: `https://www.vrbo.com/ical/${property.vrboId}`,
          syncEnabled: true,
        },
      });
      created++;
    }
  }
  return created;
}
