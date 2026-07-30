import { prisma } from '@/lib/prisma';

/**
 * Payroll / employee records (queue #26855).
 *
 * /api/payroll/employees served fabricated employees carrying invented SSN
 * fragments, home addresses and pay rates. Real employee data now lives in
 * WorkerProfile joined to User.
 *
 * ── SSN POLICY ───────────────────────────────────────────────────────────
 * Only the LAST FOUR DIGITS are stored. The full SSN is deliberately absent
 * from this system: the sole consumer is a masked display, and data that is
 * never held cannot be leaked, subpoenaed, or mishandled.
 *
 * `normaliseSsnLast4` therefore REJECTS anything that is not exactly four
 * digits. That is not merely input validation -- it is the control that stops
 * a full nine-digit SSN being quietly written into this column by a caller who
 * assumed the field would take one. If full-SSN storage is ever genuinely
 * required (W-2 filing), it needs its own decision: application-level
 * encryption, key management, retention limits and an access log -- not a
 * widened column.
 *
 * The value is never logged and never returned to a non-owner/admin caller.
 */

export class SsnPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsnPolicyError';
  }
}

/**
 * Accepts exactly four digits. Rejects a full SSN outright rather than
 * truncating it: silently keeping the last four of a submitted full SSN would
 * mean the full value still travelled through logs, request bodies and error
 * traces on the way here.
 */
export function normaliseSsnLast4(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;
  const raw = String(input).trim();
  const digitsOnly = raw.replace(/\D/g, '');

  if (digitsOnly.length > 4) {
    throw new SsnPolicyError(
      'Refusing to store more than the last 4 digits of an SSN. Send exactly 4 digits; ' +
        'this system does not store full SSNs.',
    );
  }
  if (!/^\d{4}$/.test(digitsOnly)) {
    throw new SsnPolicyError('ssn_last4 must be exactly 4 digits');
  }
  return digitsOnly;
}

const VALID_W4 = ['single', 'married', 'married_separate', 'head_of_household'];

export function normaliseW4Status(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;
  const v = String(input).trim().toLowerCase();
  if (!VALID_W4.includes(v)) {
    throw new SsnPolicyError(`w4_filing_status must be one of: ${VALID_W4.join(', ')}`);
  }
  return v;
}

interface ProfileRow {
  id: string;
  userId: string;
  workerType: string;
  employmentClass: string;
  defaultPayType: string;
  hourlyRateCents: number | null;
  paymentMethod: string | null;
  isAvailable: boolean;
  hireDate: Date | null;
  defaultHours: number | null;
  addressLine: string | null;
  ssnLast4: string | null;
  w4FilingStatus: string | null;
  w4Allowances: number | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string; email: string; phone: string | null; isActive: boolean } | null;
}

/**
 * @param includeSensitive owner/admin only. When false, SSN and address are
 * omitted entirely rather than blanked, so a lower-privileged consumer cannot
 * even tell whether a value exists.
 */
export function toEmployeeContract(p: ProfileRow, includeSensitive: boolean) {
  const base = {
    id: p.id,
    user_id: p.userId,
    name: p.user?.name ?? 'Unknown',
    email: p.user?.email ?? null,
    phone: p.user?.phone ?? null,
    role: (p.workerType || '').toLowerCase(),
    employment_class: p.employmentClass,
    status: p.user?.isActive === false ? 'inactive' : p.isAvailable ? 'active' : 'unavailable',
    pay_type: (p.defaultPayType || '').toLowerCase(),
    rate_cents: p.hourlyRateCents ?? 0,
    default_hours: p.defaultHours,
    hire_date: p.hireDate ? p.hireDate.toISOString().slice(0, 10) : null,
    payment_method: p.paymentMethod,
    w4_filing_status: p.w4FilingStatus,
    w4_allowances: p.w4Allowances,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
  if (!includeSensitive) return base;
  return { ...base, address: p.addressLine, ssn_last4: p.ssnLast4 };
}

export async function listEmployees(opts: {
  role?: string | null;
  status?: string | null;
  includeSensitive: boolean;
}) {
  const rows = (await prisma.workerProfile.findMany({
    where: {
      ...(opts.role ? { workerType: { equals: opts.role, mode: 'insensitive' as const } } : {}),
      ...(opts.status === 'active' ? { isAvailable: true } : {}),
      ...(opts.status === 'inactive' ? { isAvailable: false } : {}),
    },
    include: { user: { select: { name: true, email: true, phone: true, isActive: true } } },
    orderBy: { createdAt: 'asc' },
  })) as ProfileRow[];

  return rows.map((r) => toEmployeeContract(r, opts.includeSensitive));
}

export async function getEmployee(id: string, includeSensitive: boolean) {
  const row = (await prisma.workerProfile.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true, phone: true, isActive: true } } },
  })) as ProfileRow | null;
  return row ? toEmployeeContract(row, includeSensitive) : null;
}

/**
 * Record that someone read employee PII. Payroll data is the most sensitive
 * surface in this system, so access leaves a trail. Failure to audit must not
 * fail the request, but it is surfaced to the caller's logs.
 */
export async function auditPiiAccess(actorUid: string | null, action: string, entityId: string) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity: 'WorkerProfile',
        entityId,
        userId: actorUid ?? null,
        // Records THAT sensitive access happened, never the values read.
        // oldValues/newValues stay empty on purpose: an audit trail that
        // copies the PII it is auditing just creates a second place to leak it.
        newValues: JSON.stringify({ sensitive: true }),
      },
    });
  } catch (e) {
    console.error('[payroll] failed to write PII access audit row', e);
  }
}
