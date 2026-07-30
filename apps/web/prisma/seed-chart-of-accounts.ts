/**
 * Seed the chart of accounts (P1 objective 3 groundwork).
 *
 * This seeds REFERENCE DATA ONLY -- account names and codes, all at zero
 * balance. It deliberately does NOT seed transactions: fabricated journal
 * entries would recreate the exact problem being fixed, where the finance
 * endpoints returned confident numbers that were never real.
 *
 * The 27 accounts are lifted from the codes the accounting routes already
 * assumed (4xxx revenue, 5xxx/6xxx expense, 1000-1020 cash, 1100 AR), so the
 * routes' existing logic keeps working against real rows.
 *
 * Idempotent: upsert by unique code, safe to re-run against any environment.
 *
 *   pnpm exec tsx prisma/seed-chart-of-accounts.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import accounts from './chart-of-accounts.json';

// Prisma auto-loads .env for its own CLI, but a standalone tsx run does not, so
// the connection string has to be resolved here. Kept dependency-free rather
// than pulling in dotenv for one file.
function loadEnvFile(): void {
  if (process.env.DATABASE_URL) return;
  for (const candidate of [join(__dirname, '..', '.env'), join(__dirname, '..', '..', '..', '.env')]) {
    try {
      for (const line of readFileSync(candidate, 'utf-8').split('\n')) {
        const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
        }
      }
      if (process.env.DATABASE_URL) return;
    } catch {
      // try the next candidate
    }
  }
}

loadEnvFile();

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const a of accounts as Array<{
    code: string;
    name: string;
    type: string;
    normalSide: string;
  }>) {
    const existing = await prisma.ledgerAccount.findUnique({ where: { code: a.code } });
    await prisma.ledgerAccount.upsert({
      where: { code: a.code },
      create: { code: a.code, name: a.name, type: a.type, normalSide: a.normalSide },
      // Never touch balances here -- balances are derived from journal lines,
      // not stored, so there is nothing to clobber.
      update: { name: a.name, type: a.type, normalSide: a.normalSide },
    });
    existing ? (updated += 1) : (created += 1);
  }

  const total = await prisma.ledgerAccount.count();
  console.log(`chart of accounts seeded: ${created} created, ${updated} updated, ${total} total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
