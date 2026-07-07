/**
 * VRBO Partner Central reservation CSV import parser.
 * Accepts CSV exports from Partner Central (column names vary by export version).
 */

export interface VrboReservationRow {
  vrboListingId: string;
  confirmCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  totalPrice: number | null;
  status: string;
  raw: Record<string, string>;
}

const LISTING_ID_HEADERS = [
  'listing id', 'listingid', 'property id', 'vrbo listing id', 'expedia listing id',
];
const CONFIRM_HEADERS = [
  'confirmation', 'confirmation code', 'confirmation number', 'reservation id',
  'booking id', 'reservation number',
];
const GUEST_NAME_HEADERS = ['guest name', 'traveler name', 'renter name', 'guest'];
const GUEST_EMAIL_HEADERS = ['guest email', 'email', 'traveler email'];
const GUEST_PHONE_HEADERS = ['guest phone', 'phone', 'traveler phone'];
const CHECKIN_HEADERS = ['check in', 'check-in', 'arrival', 'start date', 'checkin'];
const CHECKOUT_HEADERS = ['check out', 'check-out', 'departure', 'end date', 'checkout'];
const GUEST_COUNT_HEADERS = ['guests', 'guest count', 'number of guests', 'adults'];
const TOTAL_HEADERS = ['total', 'total amount', 'payout', 'booking amount', 'revenue'];
const STATUS_HEADERS = ['status', 'reservation status', 'booking status'];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < normalized.length; i++) {
    for (const candidate of candidates) {
      if (normalized[i].includes(candidate)) return i;
    }
  }
  return -1;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();

  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) return iso;

  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? 2000 + parseInt(mdy[3], 10) : parseInt(mdy[3], 10);
    return new Date(year, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10));
  }

  return null;
}

function parseMoney(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function normalizeStatus(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.includes('cancel')) return 'CANCELLED';
  if (v.includes('confirm') || v.includes('booked') || v.includes('active')) return 'CONFIRMED';
  if (v.includes('pending') || v.includes('inquiry')) return 'PENDING';
  return value.trim().toUpperCase() || 'CONFIRMED';
}

/**
 * Parse Partner Central CSV text into structured reservation rows.
 */
export function parseVrboReservationsCsv(csvText: string): VrboReservationRow[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const listingIdx = findColumn(headers, LISTING_ID_HEADERS);
  const confirmIdx = findColumn(headers, CONFIRM_HEADERS);
  const nameIdx = findColumn(headers, GUEST_NAME_HEADERS);
  const emailIdx = findColumn(headers, GUEST_EMAIL_HEADERS);
  const phoneIdx = findColumn(headers, GUEST_PHONE_HEADERS);
  const checkInIdx = findColumn(headers, CHECKIN_HEADERS);
  const checkOutIdx = findColumn(headers, CHECKOUT_HEADERS);
  const guestCountIdx = findColumn(headers, GUEST_COUNT_HEADERS);
  const totalIdx = findColumn(headers, TOTAL_HEADERS);
  const statusIdx = findColumn(headers, STATUS_HEADERS);

  const rows: VrboReservationRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.every((f) => !f)) continue;

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = fields[idx] ?? '';
    });

    const checkIn = checkInIdx >= 0 ? parseDate(fields[checkInIdx]) : null;
    const checkOut = checkOutIdx >= 0 ? parseDate(fields[checkOutIdx]) : null;
    if (!checkIn || !checkOut) continue;

    const listingId = listingIdx >= 0 ? fields[listingIdx]?.trim() : '';
    const confirmCode =
      (confirmIdx >= 0 ? fields[confirmIdx]?.trim() : '') ||
      `CSV-${i}-${checkIn.toISOString().slice(0, 10)}`;

    rows.push({
      vrboListingId: listingId,
      confirmCode,
      guestName: nameIdx >= 0 ? fields[nameIdx]?.trim() || 'VRBO Guest' : 'VRBO Guest',
      guestEmail: emailIdx >= 0 ? fields[emailIdx]?.trim() || '' : '',
      guestPhone: phoneIdx >= 0 ? fields[phoneIdx]?.trim() || '' : '',
      checkIn,
      checkOut,
      guestCount: guestCountIdx >= 0 ? parseInt(fields[guestCountIdx], 10) || 1 : 1,
      totalPrice: totalIdx >= 0 ? parseMoney(fields[totalIdx]) : null,
      status: statusIdx >= 0 ? normalizeStatus(fields[statusIdx]) : 'CONFIRMED',
      raw,
    });
  }

  return rows;
}