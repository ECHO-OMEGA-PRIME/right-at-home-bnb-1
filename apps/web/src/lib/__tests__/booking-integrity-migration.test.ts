import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(__dirname, '../../../prisma/migrations/20260802000000_booking_integrity/migration.sql'),
  'utf8',
);

describe('booking integrity migration', () => {
  it('retires superseded legacy VRBO rows before enabling the guard', () => {
    expect(migration).toMatch(/legacy[^]*externalRef[^]*IS NULL[^]*status[^]*CANCELLED/i);
    expect(migration).toMatch(/tsrange\([^]*\)\s*&&\s*tsrange/i);
  });

  it('quarantines only historical unidentified VRBO overlaps before adding the constraint', () => {
    expect(migration).toContain('_legacy_overlap_quarantine');
    expect(migration).toMatch(/candidate\."externalRef"\s+IS\s+NULL/i);
    expect(migration).toMatch(/keeper\."externalRef"\s+IS\s+NULL/i);
    expect(migration).toMatch(/candidate\."checkOut"\s*<\s*CURRENT_TIMESTAMP/i);
    expect(migration).toMatch(/Retired by booking-integrity migration; historical unidentified overlap/i);
  });

  it('uses an advisory-lock trigger to close concurrent insert races', () => {
    expect(migration).toMatch(/pg_advisory_xact_lock\s*\(\s*hashtext\s*\(\s*NEW\."propertyId"/i);
    expect(migration).toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"booking_prevent_overlap"/i);
    expect(migration).toMatch(/CREATE\s+TRIGGER\s+"booking_prevent_overlap"/i);
  });

  it('protects guest reservations while allowing overlapping inventory blocks', () => {
    expect(migration).toMatch(/NEW\."status"\s*=\s*'BLOCKED'[^]*existing\."status"\s*=\s*'BLOCKED'/i);
    expect(migration).toMatch(/WHERE\s+\("status"\s+IN\s+\('PENDING',\s*'CONFIRMED',\s*'CHECKED_IN'\)\)/i);
    expect(migration).not.toMatch(/WHERE\s+\("status"\s*<>\s*'CANCELLED'\)/i);
  });
});
