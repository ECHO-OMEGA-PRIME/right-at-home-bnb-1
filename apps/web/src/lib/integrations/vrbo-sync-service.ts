/**
 * Right at Home BnB - VRBO Sync Service
 * Fetches iCal feeds from VRBO, parses bookings, and upserts into Supabase.
 * Runs every 15 minutes via Vercel cron. No PMS middleman needed.
 */

import prisma from '@/lib/prisma';
import { runNewBookingAutomations, runModifiedBookingAutomations, runCancelledBookingAutomations } from './booking-automations';
import type { NewBookingEvent, AutomationResult } from './booking-automations';

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

// ============================================
// iCAL PARSER
// ============================================

interface ParsedBooking {
  uid: string;
  guestName: string;
  confirmCode: string;
  checkIn: Date;
  checkOut: Date;
  summary: string;
  description: string;
  status: string;
}

function parseICalFeed(icalText: string): ParsedBooking[] {
  const bookings: ParsedBooking[] = [];
  const lines = icalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');

  let inEvent = false;
  let current: Partial<ParsedBooking> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = { status: 'CONFIRMED', summary: '', description: '', guestName: '', confirmCode: '' };
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      if (current.uid && current.checkIn && current.checkOut) {
        bookings.push(current as ParsedBooking);
      }
      current = {};
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = findUnquotedColon(trimmed);
    if (colonIdx === -1) continue;
    const nameAndParams = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const name = nameAndParams.split(';')[0].toUpperCase();

    switch (name) {
      case 'UID':
        current.uid = value;
        break;
      case 'SUMMARY':
        current.summary = value;
        current.guestName = current.guestName || extractGuestName(value);
        break;
      case 'DESCRIPTION':
        current.description = value;
        if (!current.guestName) current.guestName = extractGuestName(value);
        if (!current.confirmCode) current.confirmCode = extractConfirmCode(value);
        break;
      case 'DTSTART':
        current.checkIn = parseICalDate(value);
        break;
      case 'DTEND':
        current.checkOut = parseICalDate(value);
        break;
      case 'STATUS':
        current.status = value;
        break;
    }
  }

  return bookings;
}

function findUnquotedColon(line: string): number {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ':' && !inQuotes) return i;
  }
  return -1;
}

function parseICalDate(value: string): Date {
  const clean = value.replace(/[^0-9TZ]/g, '');
  if (clean.length === 8) {
    return new Date(parseInt(clean.slice(0, 4)), parseInt(clean.slice(4, 6)) - 1, parseInt(clean.slice(6, 8)));
  }
  const digits = clean.replace('T', '').replace('Z', '');
  const y = parseInt(digits.slice(0, 4));
  const mo = parseInt(digits.slice(4, 6)) - 1;
  const d = parseInt(digits.slice(6, 8));
  const h = parseInt(digits.slice(8, 10)) || 0;
  const mi = parseInt(digits.slice(10, 12)) || 0;
  return clean.endsWith('Z') ? new Date(Date.UTC(y, mo, d, h, mi)) : new Date(y, mo, d, h, mi);
}

/**
 * Summaries VRBO (and the other channels feeding the same iCal) use for an owner
 * hold rather than a guest reservation. Deliberately broad: a real reservation
 * misfiled as a hold still occupies its dates -- availability filters exclude
 * only CANCELLED and DECLINED -- whereas a hold misfiled as a reservation
 * fabricates a guest, fires the welcome/door-code automations at nobody, and
 * becomes a row someone may later "clean up", which is how a hold turns into a
 * double booking.
 */
const OWNER_HOLD_RE = /\b(block(ed)?|not\s*available|unavailable|owner|maintenance|hold|do\s*not\s*book|closed)\b/i;

function extractGuestName(text: string): string {
  if (!text) return '';
  const patterns = [
    /Reserved\s*[-:]\s*(.+)/i,
    /(?:airbnb|vrbo|booking)\s*\((.+?)\)/i,
    /Guest:\s*(.+)/i,
    /Booked by\s*[-:]\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

function extractConfirmCode(text: string): string {
  if (!text) return '';
  const patterns = [
    /Reservation\s*(?:ID|#|:)\s*([A-Z0-9-]+)/i,
    /Confirmation\s*(?:Code|#|:)\s*([A-Z0-9-]+)/i,
    /Booking\s*(?:ID|#|:)\s*([A-Z0-9-]+)/i,
    /(HA-[A-Z0-9]+)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1] || m[0];
  }
  return '';
}

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
  const result: SyncResult = { propertyId, vrboId: vrboListingId, imported: 0, updated: 0, skipped: 0, errors: [], durationMs: 0 };

  try {
    // Fetch iCal feed
    const response = await fetch(icalUrl, {
      headers: { 'User-Agent': 'RightAtHomeBnB/1.0 Calendar-Sync' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`iCal fetch failed: ${response.status} ${response.statusText}`);
    }
    const icalText = await response.text();
    if (!icalText.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid iCal response');
    }

    // Parse bookings from iCal
    const parsedBookings = parseICalFeed(icalText);

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
        // An owner hold is not a guest reservation, and it must be recognised
        // BEFORE we invent a guest for it. The previous guard required an empty
        // guestName AND the word "block" in the summary -- but extractGuestName
        // matches /Reserved\s*[-:]\s*(.+)/i and VRBO labels holds "Reserved - X",
        // so guestName was never empty and the branch was dead: every hold was
        // imported as a CONFIRMED reservation with a fabricated guest. (Proof:
        // 0 of 494 Guest rows ever used the blocked- placeholder, while rows like
        // 2026-06-01 -> 2026-12-31, 213 nights, sat in the calendar as CONFIRMED.)
        // That is why deleting a "block" would CREATE a double booking.
        //
        // Erring toward BLOCKED is the safe direction: availability, pricing and
        // the calendar all filter with `notIn: ['CANCELLED','DECLINED']`, so a
        // BLOCKED row still occupies the dates -- it just stops impersonating a
        // guest and stops triggering guest-facing automations.
        const isOwnerBlock = !booking.guestName || OWNER_HOLD_RE.test(booking.summary ?? '');

        const totalNights = Math.max(1, Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86400000));

        // Guest identity is keyed on the channel's own reservation id, never on
        // the name. Matching by name collapsed every guest sharing a first name
        // into ONE record -- "Jacqueline" carried 25 separate stays by different
        // people, all sharing a single synthesized mailbox that door codes, guest
        // messages and the lifecycle automations were then addressed to.
        //
        // The email is derived from the FULL key: the old `uid.slice(0, 8)` was a
        // truncation collision on a UNIQUE column, and it threw in production
        // ("Unique constraint failed on the fields: (email)"), aborting that
        // booking's import entirely.
        //
        // Tradeoff, deliberate: VRBO gives us no guest email, so a returning guest
        // books a new reservation id and gets a new Guest row. That loses CRM
        // continuity we never actually had -- and it is strictly better than
        // merging strangers who share a first name.
        const guestKey = booking.confirmCode || booking.uid;
        const guestEmail = isOwnerBlock
          ? `owner-hold-${property.id}@rah-midland.com`
          : `vrbo-${guestKey}@rah-midland.com`;

        const guest = await prisma.guest.upsert({
          where: { email: guestEmail },
          update: {},
          create: {
            email: guestEmail,
            name: isOwnerBlock ? `${property.name} — owner hold` : booking.guestName,
            platform: 'VRBO',
            platformId: isOwnerBlock ? `owner-hold:${property.id}` : guestKey,
          },
        });

        // externalRef is the channel's own id, and the ONLY column the
        // @@unique([platform, externalRef]) index can act on. The importer never
        // wrote it, so all 762 VRBO rows held NULL and the index was inert --
        // Postgres does not conflict NULLs, so it deduplicated nothing. Match on
        // it first; fall back to the legacy confirmCode probe and backfill the
        // ref onto whatever that finds.
        const existingBooking =
          (await prisma.booking.findFirst({
            where: { platform: 'VRBO', externalRef: booking.uid },
          })) ??
          (await prisma.booking.findFirst({
            where: {
              propertyId: property.id,
              OR: [
                { confirmCode: booking.uid },
                ...(booking.confirmCode ? [{ confirmCode: booking.confirmCode }] : []),
              ],
            },
          }));

        if (existingBooking) {
          // Update if dates changed
          const datesChanged = existingBooking.checkIn.getTime() !== booking.checkIn.getTime() ||
                               existingBooking.checkOut.getTime() !== booking.checkOut.getTime();
          const wasCancelled = booking.status === 'CANCELLED' && existingBooking.status !== 'CANCELLED';
          // Repair passes for rows written by the old importer. Without these the
          // fix would only ever apply to bookings imported from here on, and the
          // 762 rows already carrying NULL refs (and the holds already mislabelled
          // CONFIRMED) would stay broken forever.
          const needsRefBackfill = existingBooking.externalRef === null;
          const needsBlockReclass = isOwnerBlock && existingBooking.status !== 'BLOCKED'
                                                 && existingBooking.status !== 'CANCELLED';

          if (datesChanged || wasCancelled || needsRefBackfill || needsBlockReclass) {
            await prisma.booking.update({
              where: { id: existingBooking.id },
              data: {
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                totalNights,
                externalRef: booking.uid,
                status: booking.status === 'CANCELLED'
                  ? 'CANCELLED'
                  : isOwnerBlock
                    ? 'BLOCKED'
                    : existingBooking.status,
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
              externalRef: booking.uid,
              nightlyRate: property.nightlyRate,
              totalNights,
              subtotal: property.nightlyRate * totalNights,
              cleaningFee: property.cleaningFee || 0,
              totalPrice: (property.nightlyRate * totalNights) + (property.cleaningFee || 0),
              status: booking.status === 'CANCELLED'
                ? 'CANCELLED'
                : isOwnerBlock
                  ? 'BLOCKED'
                  : 'CONFIRMED',
              specialReqs: booking.description || null,
            },
          });
          result.imported++;

          // 🔥 FIRE AUTOMATIONS for new booking -- never for an owner hold, which
          // has no guest to welcome, no door code to issue and no one to email.
          if (booking.status !== 'CANCELLED' && !isOwnerBlock) {
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
