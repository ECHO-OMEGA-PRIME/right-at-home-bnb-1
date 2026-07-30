import { prisma } from '@/lib/prisma';

/**
 * Guest CRM mapping (queue #26855).
 *
 * /api/crm/guests served a hardcoded array while 494 real Guest rows sat in the
 * database. This maps the real model onto the existing API contract.
 *
 * Two honesty notes about fields the model cannot supply:
 *  - Guest has a single `name`, not first/last. It is split on the first space,
 *    which is a lossy guess for names that do not follow that shape, so the
 *    full name is preserved verbatim in `name` as well.
 *  - `segment` is DERIVED from stay count (first_time vs returning) and from a
 *    'business' tag when present. There is no business-travel flag in the
 *    model, so a guest is only 'business' if explicitly tagged -- never
 *    invented from a guess.
 */

export const dollarsToCents = (d: number | null | undefined) => Math.round((d ?? 0) * 100);

export type GuestSegment = 'first_time' | 'returning' | 'business';

interface GuestRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  platform: string;
  firstStay: Date | null;
  lastStay: Date | null;
  totalStays: number;
  totalSpent: number;
  avgRating: number | null;
  tags: string | null;
  notes: string | null;
  preferences: string | null;
  isVip: boolean;
  vipTier: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Tags are stored as a JSON string, but tolerate a plain comma list rather
    // than dropping the data on the floor.
    return raw.split(',').map((t) => t.trim()).filter(Boolean);
  }
}

function parsePreferences(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function segmentOf(g: Pick<GuestRow, 'totalStays' | 'tags'>): GuestSegment {
  if (parseTags(g.tags).some((t) => t.toLowerCase() === 'business')) return 'business';
  return g.totalStays > 1 ? 'returning' : 'first_time';
}

export function toGuestContract(g: GuestRow) {
  const [first, ...rest] = (g.name || '').trim().split(/\s+/);
  return {
    id: g.id,
    first_name: first || '',
    last_name: rest.join(' '),
    name: g.name,
    email: g.email,
    phone: g.phone,
    segment: segmentOf(g),
    is_vip: g.isVip,
    vip_tier: g.vipTier,
    total_stays: g.totalStays,
    total_spent_cents: dollarsToCents(g.totalSpent),
    avg_rating_given: g.avgRating,
    first_stay_date: g.firstStay ? g.firstStay.toISOString().slice(0, 10) : null,
    last_stay_date: g.lastStay ? g.lastStay.toISOString().slice(0, 10) : null,
    preferences: parsePreferences(g.preferences),
    tags: parseTags(g.tags),
    notes: g.notes,
    source: (g.platform || 'direct').toLowerCase(),
    created_at: g.createdAt.toISOString(),
    updated_at: g.updatedAt.toISOString(),
  };
}

export async function listGuests(opts: {
  segment?: string | null;
  isVip?: string | null;
  search?: string | null;
  source?: string | null;
}) {
  const rows = (await prisma.guest.findMany({
    where: {
      ...(opts.isVip !== null && opts.isVip !== undefined ? { isVip: opts.isVip === 'true' } : {}),
      ...(opts.source ? { platform: { equals: opts.source, mode: 'insensitive' as const } } : {}),
      ...(opts.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: 'insensitive' as const } },
              { email: { contains: opts.search, mode: 'insensitive' as const } },
              { phone: { contains: opts.search } },
            ],
          }
        : {}),
    },
    orderBy: { lastStay: 'desc' },
  })) as GuestRow[];

  const mapped = rows.map(toGuestContract);
  // Segment is derived, so it cannot be filtered in SQL without duplicating the
  // rule. Filtering after mapping keeps one definition of what a segment means.
  const filtered = opts.segment ? mapped.filter((g) => g.segment === opts.segment) : mapped;

  const segments = {
    first_time: mapped.filter((g) => g.segment === 'first_time').length,
    returning: mapped.filter((g) => g.segment === 'returning').length,
    business: mapped.filter((g) => g.segment === 'business').length,
    vip: mapped.filter((g) => g.is_vip).length,
  };

  return { guests: filtered, total: filtered.length, segments };
}

export async function getGuest(id: string) {
  const g = (await prisma.guest.findUnique({ where: { id } })) as GuestRow | null;
  return g ? toGuestContract(g) : null;
}
