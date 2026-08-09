import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace install contract', () => {
  it('generates the web Prisma client last so fresh installs run the web tests deterministically', () => {
    const rootPackage = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../../package.json'), 'utf8'),
    ) as { scripts: { postinstall: string } };

    expect(rootPackage.scripts.postinstall).toMatch(/apps\/web/);
    expect(rootPackage.scripts.postinstall).toMatch(/apps\/web[^&]*prisma generate[^&]*schema\.prisma\s*$/);
  });
});
