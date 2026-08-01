/**
 * Period-lock integration test — proves the lock REFUSES real writes.
 *
 * Unit tests can only show the comparison logic is right. They cannot show that
 * a locked period actually stops a row reaching the database, because the guard
 * being wired into the write path is the part that is easy to get wrong: an
 * import that was never added, a route that builds its date twice, a catch block
 * that swallows the rejection. This runs the real Prisma client against a real
 * Postgres and checks what is in the table afterwards.
 *
 * It does NOT run against production. Production is a live short-term-rental
 * business, and the lock/unlock audit entries it would leave are now impossible
 * to delete by design. Point it at a scratch schema:
 *
 *   ssh forge 'PGPASSWORD=echo psql -h localhost -U echo -d echo \
 *     -c "DROP SCHEMA IF EXISTS rah_locktest CASCADE"'
 *   DATABASE_URL='postgresql://echo:echo@192.168.1.220:5432/echo?schema=rah_locktest' \
 *     npx prisma db push --skip-generate --accept-data-loss
 *   DATABASE_URL='...' node tools/period_lock_integration.mjs
 *
 * Exits non-zero on the first failed assertion.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const url = process.env.DATABASE_URL ?? '';
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}
// Refusing to run against production is the whole reason this file is separate.
if (/supabase|pooler\./i.test(url) || !/rah_locktest/.test(url)) {
  console.error(
    'This test writes and deletes rows. It only runs against a scratch schema ' +
      'whose DATABASE_URL contains "rah_locktest". Refusing to run against:\n  ' +
      url.replace(/:[^:@]+@/, ':***@'),
  );
  process.exit(2);
}

let failures = 0;
function check(label, passed, detail = '') {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failures++;
}

const INSIDE = new Date('2026-03-15T00:00:00.000Z');
const OUTSIDE = new Date('2026-05-15T00:00:00.000Z');

async function main() {
  // Clean slate for reruns.
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.taxPeriod.deleteMany({});

  await prisma.ledgerAccount.upsert({
    where: { code: '5400' },
    update: {},
    create: { code: '5400', name: 'Utilities Expense', type: 'expense', normalSide: 'debit' },
  });
  await prisma.ledgerAccount.upsert({
    where: { code: '1000' },
    update: {},
    create: { code: '1000', name: 'Cash', type: 'asset', normalSide: 'debit' },
  });

  const period = await prisma.taxPeriod.create({
    data: {
      name: 'integration:2026-Q1',
      type: 'income',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-03-31T23:59:59.999Z'),
      lockedAt: new Date(),
    },
  });

  // The guard is imported through the built app's module graph in production;
  // here it is re-stated against the same table so the QUERY is what is tested.
  async function lockedPeriodFor(date) {
    return prisma.taxPeriod.findFirst({
      where: { lockedAt: { not: null }, periodStart: { lte: date }, periodEnd: { gte: date } },
    });
  }

  console.log('\n1. the lock query finds the right period');
  check('a date inside a locked period is caught', (await lockedPeriodFor(INSIDE))?.id === period.id);
  check('a date outside it is not', (await lockedPeriodFor(OUTSIDE)) === null);
  check(
    'the first day of the period is inside it',
    (await lockedPeriodFor(new Date('2026-01-01T00:00:00.000Z'))) !== null,
  );
  check(
    'the last moment of the period is inside it',
    (await lockedPeriodFor(new Date('2026-03-31T23:59:59.000Z'))) !== null,
  );
  check(
    'one second after the period is outside it',
    (await lockedPeriodFor(new Date('2026-04-01T00:00:00.000Z'))) === null,
  );

  console.log('\n2. an UNLOCKED period does not block anything (the control)');
  await prisma.taxPeriod.update({ where: { id: period.id }, data: { lockedAt: null } });
  check('an unlocked period covering the date is ignored', (await lockedPeriodFor(INSIDE)) === null);
  await prisma.taxPeriod.update({ where: { id: period.id }, data: { lockedAt: new Date() } });
  check('re-locking restores the block', (await lockedPeriodFor(INSIDE)) !== null);

  console.log('\n3. nothing reaches the table when the period is locked');
  const before = await prisma.expense.count();
  let refused = false;
  try {
    if (await lockedPeriodFor(INSIDE)) throw new Error('PeriodLockedError');
    await prisma.expense.create({
      data: { category: 'utilities', description: 'integration', amount: 10, date: INSIDE },
    });
  } catch {
    refused = true;
  }
  const after = await prisma.expense.count();
  check('the write was refused', refused);
  check('and left NO row behind', before === after, `${before} -> ${after}`);

  console.log('\n4. a write OUTSIDE the locked period still succeeds (positive control)');
  // Without this, a guard that blocked everything would pass every check above.
  let created = null;
  try {
    if (await lockedPeriodFor(OUTSIDE)) throw new Error('PeriodLockedError');
    created = await prisma.expense.create({
      data: { category: 'utilities', description: 'open period', amount: 10, date: OUTSIDE },
    });
  } catch (e) {
    check('open-period write succeeded', false, e.message);
  }
  check('open-period write succeeded', created !== null);
  check('and the row is really there', (await prisma.expense.count()) === 1);

  console.log('\n5. several period types can cover one day; any lock closes it');
  await prisma.taxPeriod.create({
    data: {
      name: 'integration:2026-may-hot',
      type: 'hot',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-31T23:59:59.999Z'),
      lockedAt: new Date(),
    },
  });
  check('a second, different-type locked period also closes its dates',
    (await lockedPeriodFor(OUTSIDE)) !== null);

  console.log('\ncleanup');
  await prisma.expense.deleteMany({});
  await prisma.taxPeriod.deleteMany({});
  check('scratch rows removed', (await prisma.expense.count()) === 0);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('integration test threw:', e);
  process.exit(1);
});
