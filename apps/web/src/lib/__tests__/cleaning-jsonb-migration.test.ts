import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../../..');
const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('cleaning evidence storage contract', () => {
  it('stores checklist, photos, and issues as validated JSONB arrays', () => {
    const schema = read('prisma/schema.prisma');
    const appSchema = read('apps/web/prisma/schema.prisma');

    for (const source of [schema, appSchema]) {
      expect(source).toMatch(/checklistProgress\s+Json\?/);
      expect(source).toMatch(/photos\s+Json\?/);
      expect(source).toMatch(/issues\s+Json\?/);
    }

    const migration = read(
      'apps/web/prisma/migrations/20260809230000_cleaning_evidence_jsonb/migration.sql',
    );
    expect(migration).toContain('TYPE JSONB');
    expect(migration).toContain('jsonb_typeof');
    expect(migration).toContain('CleaningJob_checklistProgress_array_check');
    expect(migration).toContain('CleaningJob_photos_array_check');
    expect(migration).toContain('CleaningJob_issues_array_check');
  });

  it('writes typed arrays instead of serializing evidence back into strings', () => {
    const route = read('apps/web/app/api/cleaning/route.ts');

    expect(route).not.toMatch(/checklistProgress:\s*JSON\.stringify/);
    expect(route).not.toMatch(/photos:\s*JSON\.stringify/);
    expect(route).not.toMatch(/issues:\s*JSON\.stringify/);
  });
});
