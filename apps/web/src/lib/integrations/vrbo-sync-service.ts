/**
 * Right at Home BnB - VRBO Sync Service
 * Fetches iCal feeds from VRBO, parses bookings, and upserts into Supabase.
 * Runs every 15 minutes via Vercel cron. No PMS middleman needed.
 */

import prisma from '@/lib/prisma';
import { runNewBookingAutomations, runModifiedBookingAutomations, runCancelledBookingAutomations } from './booking-automations';
import type { NewBookingEvent, AutomationResult } from './booking-automations';

// ============================================
// VRBO PROPERTY MAP (15 VRBO-listed properties)
// ============================================

export const VRBO_PROPERTIES: Record<string, string> = {
  'castleford-5001': '2636389',
  'adobe-compound-gc': '3005111',
  'garfield-2702': '2634718',
  'douglas-4501': '3355618',
  'dentcrest-4707': '2638481',
  'safari-gameroom': '2638524',
  'storey-2103': '2643822',
  'chelsea-3210': '2643784',
  'oriole-6100': '4471713',
  'lanham-1426': '4437486',
  'humble-3106': '4700881',
  'daventry-1311': '4179271',
  'lincoln-green-5055': '4581977',
  'daventry-1309': '4750070',
  'monterrey-house': '3477668',
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
  const result: SyncResult = { propertyId, vrboId: vrboListingId, imported: 0, updated: 0, skipped: 0, errors: [] };

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
