import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = path.resolve(__dirname, '../../..');
const repoRoot = path.resolve(webRoot, '../..');

const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('administrative service credential contract', () => {
  it('never retains the retired published fallback credential', () => {
    const retiredCredential = ['rah', 'vrbo', 'sync', '2026'].join('-');
    const files = [
      'apps/web/app/api/admin/vrbo-messages/route.ts',
      'apps/web/app/api/admin/property-info/route.ts',
      'tools/vrbo_availability_push.py',
      'tools/vrbo_message_scraper.py',
      'tools/vrbo_pricing_updater.py',
      'tools/vrbo_review_scraper.py',
      'tools/property-questionnaire/worker.js',
    ];

    for (const file of files) {
      expect(read(file), file).not.toContain(retiredCredential);
    }
  });

  it('requires a verified owner/admin session when no service secret is supplied', () => {
    for (const file of [
      'apps/web/app/api/admin/vrbo-messages/route.ts',
      'apps/web/app/api/admin/property-info/route.ts',
    ]) {
      const source = read(file);
      expect(source, file).toContain('adminSecretMatches');
      expect(source, file).toContain('requireOneOfRoles');
      expect(source, file).not.toMatch(/if\s*\(\s*!cookie\s*\)/);
    }
  });
});
