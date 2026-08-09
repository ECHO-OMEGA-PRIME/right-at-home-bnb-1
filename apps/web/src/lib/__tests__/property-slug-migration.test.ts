import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../prisma/migrations/20260809223000_property_slug_backfill/migration.sql'),
  'utf8',
);

describe('property slug backfill migration', () => {
  it('moves the retired duplicate listing off the canonical public slug first', () => {
    const release = migration.indexOf("'blazing-saddle-dup'");
    const canonical = migration.indexOf("('blazing-saddle-2501', '5103283')");

    expect(release).toBeGreaterThanOrEqual(0);
    expect(canonical).toBeGreaterThan(release);
    expect(migration).toMatch(/"vrboId"\s*=\s*'5103284'/);
  });
});
