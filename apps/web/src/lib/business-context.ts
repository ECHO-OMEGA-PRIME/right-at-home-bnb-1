/**
 * Business Context Service for AI Steven
 * Provides complete situational awareness for intelligent calls
 *
 * Context includes:
 * - Website/system health status
 * - Active logged-in users
 * - Today's check-ins and check-outs
 * - Cleaner schedules and status
 * - Property status overview
 * - Recent alerts and issues
 */

import prisma from './prisma';
import { listOpenAlerts } from './operational-alerts';

/** Booking row -> the Reservation shape callers already consume. */
function toReservation(booking: {
  id: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  status: string;
  specialReqs: string | null;
  guest: { name: string; email: string; phone: string | null } | null;
  property: { id: string; name: string } | null;
}): Reservation {
  return {
    id: booking.id,
    guestName: booking.guest?.name || 'Unknown Guest',
    guestEmail: booking.guest?.email || '',
    guestPhone: booking.guest?.phone || '',
    propertyId: booking.property?.id || '',
    propertyName: booking.property?.name || 'Unknown Property',
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    status: (booking.status || 'confirmed').toLowerCase() as Reservation['status'],
    numGuests: booking.guestCount || 1,
    notes: booking.specialReqs ?? undefined,
  };
}

/** Local midnight to next midnight — the window every "today" query shares. */
function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// ============ Types ============

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: string;
  lastCheck: string;
  services: {
    database: boolean;
    auth: boolean;
    storage: boolean;
    twilio: boolean;
  };
  recentErrors: ErrorLog[];
}

export interface ErrorLog {
  timestamp: string;
  type: string;
  message: string;
  resolved: boolean;
}

export interface ActiveUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'cleaner' | 'admin' | 'guest';
  lastActive: string;
}

export interface Reservation {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'pending' | 'checked_in' | 'checked_out' | 'cancelled';
  numGuests: number;
  notes?: string;
}

export interface CleanerSchedule {
  id: string;
  cleanerId: string;
  cleanerName: string;
  cleanerPhone: string;
  propertyId: string;
  propertyName: string;
  scheduledTime: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'late' | 'no_show';
  startedAt?: string;
  completedAt?: string;
  hoursLate?: number;
}

export interface PropertyStatus {
  id: string;
  name: string;
  address: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'blocked';
  currentGuest?: string;
  nextCheckIn?: string;
  nextCheckOut?: string;
  lastCleaned?: string;
  issues: string[];
}

export interface BusinessContext {
  generatedAt: string;
  systemHealth: SystemHealth;
  activeUsers: ActiveUser[];
  todayCheckIns: Reservation[];
  todayCheckOuts: Reservation[];
  cleanerSchedules: CleanerSchedule[];
  lateCleaners: CleanerSchedule[];
  propertyStatuses: PropertyStatus[];
  alerts: Alert[];
  summary: string;
}

export interface Alert {
  id: string;
  type: 'cleaner_late' | 'guest_issue' | 'maintenance' | 'system' | 'urgent';
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  propertyId?: string;
  propertyName?: string;
}

// ============ Service Functions ============

/**
 * Get current system health status
 * NOTE: Missing configuration is NOT a critical status - only actual failures
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const now = new Date().toISOString();
  const errors: ErrorLog[] = [];

  // Probe the store this app actually depends on.
  //
  // This used to read a Firestore `system_health` collection, so the health
  // check reported on a database the product had largely stopped using -- and
  // the whole "is it a config issue or a real outage?" branch existed because
  // Firebase was frequently unconfigured on Vercel. Postgres has no such
  // ambiguity: the query either answers or it does not.
  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (e) {
    errors.push({
      timestamp: now,
      type: 'database',
      message: `Database connection error: ${e instanceof Error ? e.message : 'Unknown'}`,
      resolved: false
    });
  }

  // Auth and storage are no longer Firebase services: identity is echo-auth
  // (verified against its JWKS, which needs no live call here) and property
  // photos are served from our own origin out of Postgres. Both therefore ride
  // on the same database probe rather than pretending to be separately checked.
  const authHealthy = dbHealthy;
  const storageHealthy = dbHealthy;

  // Check Twilio (via env vars) - missing config is not an error
  const twilioHealthy = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );

  // Don't log Twilio as error - it's optional
  // Only log actual Twilio failures, not missing config

  // Determine overall status
  // If services are not configured, don't mark as critical
  // Critical = WAS configured but now failing
  // Degraded = some services missing
  // Healthy = all configured services working

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

  if (!dbHealthy) {
    // The system of record is unreachable. There is no "maybe it just isn't
    // configured" reading of that any more, so it is critical without
    // qualification -- which is the point of moving off a store whose absence
    // was indistinguishable from its failure.
    status = 'critical';
  } else if (!twilioHealthy) {
    // Twilio is optional; missing credentials degrade, never page.
    status = 'degraded';
  }

  return {
    status,
    uptime: '99.9%', // Would come from monitoring service
    lastCheck: now,
    services: {
      database: dbHealthy,
      auth: authHealthy,
      storage: storageHealthy,
      twilio: twilioHealthy
    },
    recentErrors: errors
  };
}

/**
 * Get currently active/logged-in users
 */
export async function getActiveUsers(): Promise<ActiveUser[]> {
  // PRESENCE IS NOT TRACKED, and this deliberately does not pretend otherwise.
  //
  // The Firestore version filtered `users` on `lastActive >= 5 minutes ago`.
  // The Postgres `User` table has no such column and nothing writes one -- the
  // closest available field is `updatedAt`, which changes when an admin edits a
  // role, not when somebody signs in. Reporting those users as "active" would
  // put a fabricated number into a voice summary the Commander hears and into
  // the health dashboard.
  //
  // Returning empty is the accurate answer to "who is online": we do not know.
  // Making it real needs a `lastActiveAt` column written on authenticated
  // requests, which is a product decision rather than a migration detail.
  return [];
}

/**
 * Get today's check-ins
 */
export async function getTodayCheckIns(): Promise<Reservation[]> {
  const { start, end } = todayRange();

  const bookings = await prisma.booking.findMany({
    where: { checkIn: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
    orderBy: { checkIn: 'asc' },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        guestCount: true,
        status: true,
        specialReqs: true,
        guest: { select: { name: true, email: true, phone: true } },
        property: { select: { id: true, name: true } },
      },
  });

  return bookings.map(toReservation);
}

/**
 * Get today's check-outs
 */
export async function getTodayCheckOuts(): Promise<Reservation[]> {
  const { start, end } = todayRange();

  const bookings = await prisma.booking.findMany({
    where: { checkOut: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
    orderBy: { checkOut: 'asc' },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        guestCount: true,
        status: true,
        specialReqs: true,
        guest: { select: { name: true, email: true, phone: true } },
        property: { select: { id: true, name: true } },
      },
  });

  return bookings.map(toReservation);
}

/**
 * Get today's cleaner schedules
 */
export async function getCleanerSchedules(): Promise<CleanerSchedule[]> {
  const { start, end } = todayRange();

  // CleaningJob is the real cleaning schedule -- the same rows /api/cleaning
  // creates and the crew completes. The Firestore `cleaning_schedules`
  // collection was a parallel copy that nothing else in the product wrote to,
  // so the late-cleaner monitor was watching a shadow of the actual schedule.
  const jobs = await prisma.cleaningJob.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    orderBy: { scheduledAt: 'asc' },
    select: {
      id: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      status: true,
      cleanerId: true,
      cleaner: { select: { name: true, phone: true } },
      property: { select: { id: true, name: true } },
    },
  });

  const now = new Date();

  return jobs.map((job) => {
    const status = (job.status || 'SCHEDULED').toLowerCase();

    // Late only applies to work that never started.
    let hoursLate = 0;
    if (status === 'scheduled' && job.scheduledAt < now) {
      hoursLate = Math.floor((now.getTime() - job.scheduledAt.getTime()) / (1000 * 60 * 60));
    }

    return {
      id: job.id,
      cleanerId: job.cleanerId || '',
      cleanerName: job.cleaner?.name || 'Unknown Cleaner',
      cleanerPhone: job.cleaner?.phone || '',
      propertyId: job.property?.id || '',
      propertyName: job.property?.name || 'Unknown Property',
      scheduledTime: job.scheduledAt.toISOString(),
      status: (hoursLate >= 1 ? 'late' : status) as CleanerSchedule['status'],
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      hoursLate: hoursLate > 0 ? hoursLate : undefined,
    };
  });
}

/**
 * Get late cleaners (1+ hours late)
 */
export async function getLateCleaners(minHoursLate: number = 1): Promise<CleanerSchedule[]> {
  const schedules = await getCleanerSchedules();
  return schedules.filter(s =>
    s.status === 'late' &&
    s.hoursLate &&
    s.hoursLate >= minHoursLate
  );
}

/**
 * Get property statuses
 */
export async function getPropertyStatuses(): Promise<PropertyStatus[]> {
  const now = new Date();

  // currentGuest / nextCheckIn / nextCheckOut / lastCleaned were stored fields
  // in Firestore, kept up to date by nothing in particular. They are DERIVED
  // here from the bookings and cleaning jobs that actually exist, so they
  // cannot drift from reality the way a denormalised copy does.
  const properties = await prisma.property.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      status: true,
      bookings: {
        where: { checkOut: { gte: now }, status: { not: 'CANCELLED' } },
        orderBy: { checkIn: 'asc' },
        take: 2,
        select: {
          checkIn: true,
          checkOut: true,
          guest: { select: { name: true } },
        },
      },
      cleaningJobs: {
        where: { completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: { completedAt: true },
      },
    },
  });

  return properties.map((property) => {
    const inHouse = property.bookings.find((b) => b.checkIn <= now && b.checkOut >= now);
    const upcoming = property.bookings.find((b) => b.checkIn > now);

    return {
      id: property.id,
      name: property.name || 'Unknown Property',
      address: property.address || '',
      status: (property.status || 'available').toLowerCase() as PropertyStatus['status'],
      currentGuest: inHouse?.guest?.name,
      nextCheckIn: upcoming?.checkIn.toISOString(),
      nextCheckOut: inHouse?.checkOut.toISOString(),
      lastCleaned: property.cleaningJobs[0]?.completedAt?.toISOString(),
      // Open issues live in OperationalAlert now; getActiveAlerts carries them
      // with their own severity rather than as bare strings on the property.
      issues: [],
    };
  });
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  // One alert table for the whole product now -- the same rows the cleaner and
  // system monitors write. The Firestore `alerts` collection was a third
  // alert store that only this file read.
  const stored = await listOpenAlerts();

  return stored.slice(0, 20).map((row) => ({
    id: row.id,
    type: (row.alertType === 'LATE_CLEANER' ? 'cleaner_late' : 'system') as Alert['type'],
    priority: (row.severity === 'CRITICAL'
      ? 'critical'
      : row.severity === 'HIGH'
        ? 'high'
        : 'medium') as Alert['priority'],
    message: row.message,
    timestamp: row.createdAt.toISOString(),
    acknowledged: row.status === 'ACKNOWLEDGED',
    propertyId: row.propertyId ?? undefined,
    propertyName: row.metadata.propertyName ? String(row.metadata.propertyName) : undefined,
  }));
}

/**
 * Generate human-readable summary for AI Steven
 */
function generateSummary(context: Omit<BusinessContext, 'summary'>): string {
  const lines: string[] = [];

  // System status
  if (context.systemHealth.status === 'healthy') {
    lines.push('All systems are running smoothly.');
  } else if (context.systemHealth.status === 'degraded') {
    lines.push('Some systems are experiencing issues.');
  } else {
    lines.push('CRITICAL: Major system issues detected.');
  }

  // Active users
  if (context.activeUsers.length > 0) {
    const owners = context.activeUsers.filter(u => u.role === 'owner').length;
    const cleaners = context.activeUsers.filter(u => u.role === 'cleaner').length;
    lines.push(`${context.activeUsers.length} users active (${owners} owners, ${cleaners} cleaners).`);
  } else {
    lines.push('No users currently active on the website.');
  }

  // Check-ins
  if (context.todayCheckIns.length > 0) {
    lines.push(`${context.todayCheckIns.length} check-ins today: ${context.todayCheckIns.map(r => r.guestName).join(', ')}.`);
  } else {
    lines.push('No check-ins scheduled for today.');
  }

  // Check-outs
  if (context.todayCheckOuts.length > 0) {
    lines.push(`${context.todayCheckOuts.length} check-outs today: ${context.todayCheckOuts.map(r => r.guestName).join(', ')}.`);
  } else {
    lines.push('No check-outs scheduled for today.');
  }

  // Late cleaners - CRITICAL
  if (context.lateCleaners.length > 0) {
    const lateList = context.lateCleaners
      .map(c => `${c.cleanerName} is ${c.hoursLate} hours late for ${c.propertyName}`)
      .join('. ');
    lines.push(`ATTENTION: ${context.lateCleaners.length} late cleaners! ${lateList}.`);
  } else {
    lines.push('All cleaners are on schedule.');
  }

  // High priority alerts
  const criticalAlerts = context.alerts.filter(a => a.priority === 'critical' || a.priority === 'high');
  if (criticalAlerts.length > 0) {
    lines.push(`${criticalAlerts.length} high priority alerts need attention.`);
  }

  return lines.join(' ');
}

/**
 * Get complete business context
 * This is what AI Steven uses for intelligent, context-aware calls
 */
export async function getBusinessContext(): Promise<BusinessContext> {
  console.log('[BusinessContext] Gathering complete business context...');

  // allSettled, not all.
  //
  // Each getter now THROWS on a store failure instead of quietly returning [],
  // and this object feeds both the monitors that decide whether to phone
  // somebody and the summary Steven reads aloud. One rejected section must
  // therefore neither take down the whole context nor silently become "nothing
  // to report" -- a failed read of today's check-ins looks exactly like a day
  // with no arrivals. Failures are recorded as errors ON the health object and
  // downgrade its status, so the degradation is stated rather than inferred.
  const settled = await Promise.allSettled([
    getSystemHealth(),
    getActiveUsers(),
    getTodayCheckIns(),
    getTodayCheckOuts(),
    getCleanerSchedules(),
    getPropertyStatuses(),
    getActiveAlerts()
  ]);

  const failures: ErrorLog[] = [];
  const at = new Date().toISOString();

  function section<T>(index: number, name: string, fallback: T): T {
    const outcome = settled[index];
    if (outcome.status === 'fulfilled') return outcome.value as T;

    const reason = outcome.reason;
    console.error(`[BusinessContext] ${name} unavailable:`, reason);
    failures.push({
      timestamp: at,
      type: name,
      message: `${name} unavailable: ${reason instanceof Error ? reason.message : 'Unknown'}`,
      resolved: false
    });
    return fallback;
  }

  const health = section<SystemHealth>(0, 'system_health', {
    status: 'critical',
    uptime: 'unknown',
    lastCheck: at,
    services: { database: false, auth: false, storage: false, twilio: false },
    recentErrors: []
  });
  const activeUsers = section<ActiveUser[]>(1, 'active_users', []);
  const todayCheckIns = section<Reservation[]>(2, 'today_check_ins', []);
  const todayCheckOuts = section<Reservation[]>(3, 'today_check_outs', []);
  const cleanerSchedules = section<CleanerSchedule[]>(4, 'cleaner_schedules', []);
  const propertyStatuses = section<PropertyStatus[]>(5, 'property_statuses', []);
  const alerts = section<Alert[]>(6, 'alerts', []);

  const systemHealth: SystemHealth = failures.length
    ? {
        ...health,
        // A section we could not read is a real degradation, and saying
        // "healthy" next to a list of unreadable sections would be a lie.
        status: health.status === 'critical' ? 'critical' : 'degraded',
        recentErrors: [...health.recentErrors, ...failures]
      }
    : health;

  // Filter late cleaners
  const lateCleaners = cleanerSchedules.filter(s =>
    s.status === 'late' &&
    s.hoursLate &&
    s.hoursLate >= 1
  );

  const contextWithoutSummary = {
    generatedAt: new Date().toISOString(),
    systemHealth,
    activeUsers,
    todayCheckIns,
    todayCheckOuts,
    cleanerSchedules,
    lateCleaners,
    propertyStatuses,
    alerts
  };

  const summary = generateSummary(contextWithoutSummary);

  console.log('[BusinessContext] Context gathered:', {
    activeUsers: activeUsers.length,
    checkIns: todayCheckIns.length,
    checkOuts: todayCheckOuts.length,
    lateCleaners: lateCleaners.length,
    alerts: alerts.length
  });

  return {
    ...contextWithoutSummary,
    summary
  };
}

/**
 * Get context summary for voice calls (shorter, voice-optimized)
 */
export async function getVoiceContextSummary(): Promise<string> {
  const context = await getBusinessContext();
  return context.summary;
}

export default {
  getBusinessContext,
  getVoiceContextSummary,
  getSystemHealth,
  getActiveUsers,
  getTodayCheckIns,
  getTodayCheckOuts,
  getCleanerSchedules,
  getLateCleaners,
  getPropertyStatuses,
  getActiveAlerts
};
