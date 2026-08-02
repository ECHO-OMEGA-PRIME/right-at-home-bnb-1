const BUSINESS_TIME_ZONE = 'America/Chicago';
const DEFAULT_CHECK_IN_TIME = '16:00';
const DEFAULT_CHECK_OUT_TIME = '11:00';

function parseLocalTime(value: string | undefined, fallback: string): [number, number] {
  const raw = value || fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!match) return parseLocalTime(fallback, fallback);

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return parseLocalTime(fallback, fallback);
  return [hour, minute];
}

function partsInZone(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

/** Convert an unambiguous Midland wall-clock time to its UTC instant. */
export function midlandLocalTimeToUtc(
  dateOnly: string,
  hour: number,
  minute: number,
): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (!year || !month || !day || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Invalid guest-access local date/time');
  }

  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = desiredAsUtc;

  // Iterating the observed offset converges for both CST and CDT without
  // relying on the host process timezone. Check-in/out defaults are well away
  // from the skipped/repeated DST transition hour.
  for (let pass = 0; pass < 3; pass += 1) {
    const observed = partsInZone(new Date(candidate));
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
      0,
    );
    const correction = desiredAsUtc - observedAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }

  return new Date(candidate);
}

export function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function midlandDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface GuestAccessWindow {
  checkInAt: Date;
  checkOutAt: Date;
  startsAt: Date;
  endsAt: Date;
}

/** Resolve date-only booking columns to the business's real local arrival window. */
export function guestAccessWindowForBooking(
  checkIn: Date,
  checkOut: Date,
  earlyMinutes: number,
  graceMinutes: number,
): GuestAccessWindow {
  const [checkInHour, checkInMinute] = parseLocalTime(
    process.env.GUEST_ACCESS_CHECKIN_LOCAL_TIME,
    DEFAULT_CHECK_IN_TIME,
  );
  const [checkOutHour, checkOutMinute] = parseLocalTime(
    process.env.GUEST_ACCESS_CHECKOUT_LOCAL_TIME,
    DEFAULT_CHECK_OUT_TIME,
  );
  const checkInAt = midlandLocalTimeToUtc(dateOnlyUtc(checkIn), checkInHour, checkInMinute);
  const checkOutAt = midlandLocalTimeToUtc(dateOnlyUtc(checkOut), checkOutHour, checkOutMinute);

  return {
    checkInAt,
    checkOutAt,
    startsAt: new Date(checkInAt.getTime() - earlyMinutes * 60_000),
    endsAt: new Date(checkOutAt.getTime() + graceMinutes * 60_000),
  };
}

/** Broad date-only DB bounds; callers apply exact wall-clock filtering in JS. */
export function guestAccessCandidateDateBounds(now: Date, provisionThrough: Date) {
  const today = midlandDay(now);
  const finalDay = midlandDay(provisionThrough);
  return {
    checkOutGte: new Date(`${today}T00:00:00.000Z`),
    checkInLte: new Date(`${finalDay}T00:00:00.000Z`),
  };
}

export { BUSINESS_TIME_ZONE };
