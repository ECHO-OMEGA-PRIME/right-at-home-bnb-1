/**
 * Refuse to seed a database that is not an empty development one.
 *
 * WHY THIS EXISTS
 * prisma/seed.ts creates 22 properties with `prisma.property.create` -- create,
 * not upsert. One `npx tsx prisma/seed.ts` with the production env loaded gives
 * Right at Home 44 properties, silently, in the database a real business runs
 * on. The script had no guard of any kind; its only process.exit was an error
 * handler.
 *
 * THE GUARD IS NOT A HOSTNAME ALLOWLIST
 * Checking for "supabase.com" would work until the day production moves, and
 * then fail open exactly when it matters. The load-bearing check here is a fact
 * that travels with the data instead: IF THE DATABASE ALREADY HAS PROPERTIES,
 * IT IS NOT AN EMPTY DEV DATABASE, so seeding is refused.
 *
 * The host check is kept as a second, independent reason to refuse -- belt and
 * braces, not the primary control.
 *
 * Both are backed by a required explicit opt-in, so nobody seeds by reflex.
 */

import { PrismaClient } from '@prisma/client';

/** Hosts known to serve production. Advisory only -- see the note above. */
const PRODUCTION_HOST_MARKERS = ['pooler.supabase.com', 'supabase.co'];

export class SeedRefused extends Error {
  constructor(reason: string) {
    super(`REFUSING TO SEED: ${reason}`);
    this.name = 'SeedRefused';
  }
}

/**
 * Throws unless this is safe to seed.
 *
 * Call it BEFORE the first write, not after — a guard that runs late has
 * already let some rows through.
 */
export async function assertSafeToSeed(prisma: PrismaClient): Promise<void> {
  // 1. Explicit opt-in. Deliberately a phrase, not "1" or "true", so it cannot
  //    be set absent-mindedly or inherited from an unrelated env.
  if (process.env.ALLOW_SEED !== 'yes-seed-this-database') {
    throw new SeedRefused(
      'ALLOW_SEED is not set to "yes-seed-this-database". ' +
        'Seeding creates rows; it must be asked for deliberately.',
    );
  }

  // 2. THE REAL CHECK. Existing data means this is not a fresh dev database,
  //    whatever its hostname says. This survives production moving hosts.
  const [properties, bookings, guests] = await Promise.all([
    prisma.property.count(),
    prisma.booking.count(),
    prisma.guest.count(),
  ]);

  if (properties > 0 || bookings > 0 || guests > 0) {
    throw new SeedRefused(
      `the target database already contains data ` +
        `(${properties} properties, ${bookings} bookings, ${guests} guests). ` +
        'seed.ts uses property.create, not upsert, so seeding here would ' +
        'DUPLICATE the portfolio. Point at an empty database, or clear it first ' +
        'if you genuinely intend to.',
    );
  }

  // 3. Independent second reason to refuse, in case an empty database is
  //    somehow a production one mid-provisioning.
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
  const marker = PRODUCTION_HOST_MARKERS.find((m) => url.includes(m));
  if (marker && process.env.SEED_ALLOW_PRODUCTION_HOST !== 'i-understand') {
    throw new SeedRefused(
      `the connection string points at "${marker}", which serves production. ` +
        'If this really is a scratch database on the same host, set ' +
        'SEED_ALLOW_PRODUCTION_HOST=i-understand.',
    );
  }

  console.log('   seed guard: target is empty and opt-in is present — proceeding');
}
