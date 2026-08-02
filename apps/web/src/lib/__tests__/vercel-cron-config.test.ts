import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('guest-access cron registration', () => {
  it('registers only the dedicated guest-access route every fifteen minutes', () => {
    const config = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as { crons?: Array<{ path: string; schedule: string }> };

    const guestAccess = (config.crons || []).filter((cron) => cron.path === '/api/cron/guest-access');
    const combinedOperations = (config.crons || []).filter((cron) => cron.path === '/api/cron/operations');

    expect(guestAccess).toEqual([{ path: '/api/cron/guest-access', schedule: '*/15 * * * *' }]);
    expect(combinedOperations).toEqual([]);
  });
});
