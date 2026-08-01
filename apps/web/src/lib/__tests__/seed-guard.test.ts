/**
 * Seed-guard tests.
 *
 * prisma/seed.ts creates 22 properties with `property.create` — create, not
 * upsert. One run against production would have given Right at Home 44
 * properties, silently. The script had no guard of any kind.
 *
 * The test that matters most is the ALLOW case. A guard that refuses
 * everything passes every "it refused" test while being useless, and the way
 * you find that out is when someone deletes it for getting in the way.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SeedRefused, assertSafeToSeed } from '../../../prisma/seed-guard';

/** Minimal stand-in — the guard only ever calls these three counts. */
function fakePrisma(counts: { properties?: number; bookings?: number; guests?: number } = {}) {
  return {
    property: { count: async () => counts.properties ?? 0 },
    booking: { count: async () => counts.bookings ?? 0 },
    guest: { count: async () => counts.guests ?? 0 },
  } as never;
}

const OPT_IN = 'yes-seed-this-database';
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    ALLOW_SEED: process.env.ALLOW_SEED,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SEED_ALLOW_PRODUCTION_HOST: process.env.SEED_ALLOW_PRODUCTION_HOST,
  };
  delete process.env.ALLOW_SEED;
  delete process.env.SEED_ALLOW_PRODUCTION_HOST;
  process.env.DATABASE_URL = 'postgresql://dev:dev@localhost:5432/devdb';
  process.env.DIRECT_URL = process.env.DATABASE_URL;
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('the ALLOW path — the control that proves this is a guard, not a wall', () => {
  it('allows an empty dev database with the opt-in present', async () => {
    process.env.ALLOW_SEED = OPT_IN;
    await expect(assertSafeToSeed(fakePrisma())).resolves.toBeUndefined();
  });
});

describe('refusals', () => {
  it('refuses without the opt-in, even on an empty database', async () => {
    await expect(assertSafeToSeed(fakePrisma())).rejects.toThrow(SeedRefused);
  });

  it('refuses a near-miss opt-in value', async () => {
    // Not "true", not "1", not "yes" — the phrase is the point.
    for (const v of ['1', 'true', 'yes', 'YES-SEED-THIS-DATABASE']) {
      process.env.ALLOW_SEED = v;
      await expect(assertSafeToSeed(fakePrisma())).rejects.toThrow(SeedRefused);
    }
  });

  it('refuses when ANY of the three tables already has rows', async () => {
    process.env.ALLOW_SEED = OPT_IN;
    for (const counts of [{ properties: 1 }, { bookings: 1 }, { guests: 1 }]) {
      await expect(assertSafeToSeed(fakePrisma(counts))).rejects.toThrow(/already contains data/);
    }
  });

  it('names the real counts so the refusal is actionable', async () => {
    process.env.ALLOW_SEED = OPT_IN;
    await expect(
      assertSafeToSeed(fakePrisma({ properties: 22, bookings: 762, guests: 494 })),
    ).rejects.toThrow(/22 properties, 762 bookings, 494 guests/);
  });

  it('refuses a production HOST even when the database is empty', async () => {
    // The data check is primary, but an empty production database mid-provision
    // must still be refused.
    process.env.ALLOW_SEED = OPT_IN;
    process.env.DIRECT_URL =
      'postgresql://u:p@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
    await expect(assertSafeToSeed(fakePrisma())).rejects.toThrow(/serves production/);
  });

  it('lets a scratch database on a production host through with a second opt-in', async () => {
    process.env.ALLOW_SEED = OPT_IN;
    process.env.DIRECT_URL =
      'postgresql://u:p@aws-1-us-east-1.pooler.supabase.com:5432/scratch';
    process.env.SEED_ALLOW_PRODUCTION_HOST = 'i-understand';
    await expect(assertSafeToSeed(fakePrisma())).resolves.toBeUndefined();
  });

  it('data wins over the host override — a populated db is refused regardless', async () => {
    process.env.ALLOW_SEED = OPT_IN;
    process.env.SEED_ALLOW_PRODUCTION_HOST = 'i-understand';
    await expect(assertSafeToSeed(fakePrisma({ properties: 22 }))).rejects.toThrow(
      /already contains data/,
    );
  });
});
