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

import { db, isConfigurationIssue } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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
  const isFirebaseConfigIssue = isConfigurationIssue();

  // Check Firebase connection
  let dbHealthy = false;
  let authHealthy = false;
  let storageHealthy = false;

  try {
    // Test database connection
    if (db) {
      const testRef = db.collection('system_health').limit(1);
      await testRef.get();
      dbHealthy = true;
    } else if (isFirebaseConfigIssue) {
      // Firebase not configured - this is expected, not an error
      console.log('[BusinessContext] Firebase not configured (expected on Vercel without env vars)');
    }
  } catch (e) {
    // Only log as error if Firebase WAS configured but failed
    if (!isFirebaseConfigIssue) {
      errors.push({
        timestamp: now,
        type: 'database',
        message: `Database connection error: ${e instanceof Error ? e.message : 'Unknown'}`,
        resolved: false
      });
    }
  }

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

  if (isFirebaseConfigIssue) {
    // Firebase not configured - mark as degraded, not critical
    // This prevents emergency calls for missing env vars
    status = twilioHealthy ? 'degraded' : 'degraded';
  } else {
    // Firebase was configured - check if it's working
    if (!dbHealthy && errors.some(e => e.type === 'database')) {
      // Was configured but failing = critical
      status = 'critical';
    } else if (!dbHealthy || !twilioHealthy) {
      status = 'degraded';
    }
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
  if (!db) return [];

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const snapshot = await db.collection('users')
      .where('lastActive', '>=', Timestamp.fromDate(fiveMinutesAgo))
      .orderBy('lastActive', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email || '',
        displayName: data.displayName || data.name || 'Unknown',
        role: data.role || 'guest',
        lastActive: data.lastActive?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    });
  } catch (e) {
    console.error('[BusinessContext] Error getting active users:', e);
    return [];
  }
}

/**
 * Get today's check-ins
 */
export async function getTodayCheckIns(): Promise<Reservation[]> {
  if (!db) return [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const snapshot = await db.collection('reservations')
      .where('checkIn', '>=', Timestamp.fromDate(today))
      .where('checkIn', '<', Timestamp.fromDate(tomorrow))
      .orderBy('checkIn', 'asc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        guestName: data.guestName || 'Unknown Guest',
        guestEmail: data.guestEmail || '',
        guestPhone: data.guestPhone || '',
        propertyId: data.propertyId || '',
        propertyName: data.propertyName || 'Unknown Property',
        checkIn: data.checkIn?.toDate?.()?.toISOString() || '',
        checkOut: data.checkOut?.toDate?.()?.toISOString() || '',
        status: data.status || 'confirmed',
        numGuests: data.numGuests || 1,
        notes: data.notes
      };
    });
  } catch (e) {
    console.error('[BusinessContext] Error getting check-ins:', e);
    return [];
  }
}

/**
 * Get today's check-outs
 */
export async function getTodayCheckOuts(): Promise<Reservation[]> {
  if (!db) return [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const snapshot = await db.collection('reservations')
      .where('checkOut', '>=', Timestamp.fromDate(today))
      .where('checkOut', '<', Timestamp.fromDate(tomorrow))
      .orderBy('checkOut', 'asc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        guestName: data.guestName || 'Unknown Guest',
        guestEmail: data.guestEmail || '',
        guestPhone: data.guestPhone || '',
        propertyId: data.propertyId || '',
        propertyName: data.propertyName || 'Unknown Property',
        checkIn: data.checkIn?.toDate?.()?.toISOString() || '',
        checkOut: data.checkOut?.toDate?.()?.toISOString() || '',
        status: data.status || 'confirmed',
        numGuests: data.numGuests || 1,
        notes: data.notes
      };
    });
  } catch (e) {
    console.error('[BusinessContext] Error getting check-outs:', e);
    return [];
  }
}

/**
 * Get today's cleaner schedules
 */
export async function getCleanerSchedules(): Promise<CleanerSchedule[]> {
  if (!db) return [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const snapshot = await db.collection('cleaning_schedules')
      .where('scheduledTime', '>=', Timestamp.fromDate(today))
      .where('scheduledTime', '<', Timestamp.fromDate(tomorrow))
      .orderBy('scheduledTime', 'asc')
      .get();

    const now = new Date();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const scheduledTime = data.scheduledTime?.toDate?.() || new Date();
      const status = data.status || 'scheduled';

      // Calculate if late
      let hoursLate = 0;
      if (status === 'scheduled' && scheduledTime < now) {
        hoursLate = Math.floor((now.getTime() - scheduledTime.getTime()) / (1000 * 60 * 60));
      }

      return {
        id: doc.id,
        cleanerId: data.cleanerId || '',
        cleanerName: data.cleanerName || 'Unknown Cleaner',
        cleanerPhone: data.cleanerPhone || '',
        propertyId: data.propertyId || '',
        propertyName: data.propertyName || 'Unknown Property',
        scheduledTime: scheduledTime.toISOString(),
        status: hoursLate >= 1 ? 'late' : status,
        startedAt: data.startedAt?.toDate?.()?.toISOString(),
        completedAt: data.completedAt?.toDate?.()?.toISOString(),
        hoursLate: hoursLate > 0 ? hoursLate : undefined
      };
    });
  } catch (e) {
    console.error('[BusinessContext] Error getting cleaner schedules:', e);
    return [];
  }
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
  if (!db) return [];

  try {
    const snapshot = await db.collection('properties')
      .orderBy('name', 'asc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unknown Property',
        address: data.address || '',
        status: data.status || 'available',
        currentGuest: data.currentGuest,
        nextCheckIn: data.nextCheckIn?.toDate?.()?.toISOString(),
        nextCheckOut: data.nextCheckOut?.toDate?.()?.toISOString(),
        lastCleaned: data.lastCleaned?.toDate?.()?.toISOString(),
        issues: data.issues || []
      };
    });
  } catch (e) {
    console.error('[BusinessContext] Error getting property statuses:', e);
    return [];
  }
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  if (!db) return [];

  try {
    const snapshot = await db.collection('alerts')
      .where('acknowledged', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type || 'system',
        priority: data.priority || 'medium',
        message: data.message || '',
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
        acknowledged: data.acknowledged || false,
        propertyId: data.propertyId,
        propertyName: data.propertyName
      };
    });
  } catch (e) {
    console.error('[BusinessContext] Error getting alerts:', e);
    return [];
  }
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

  // Gather all context in parallel
  const [
    systemHealth,
    activeUsers,
    todayCheckIns,
    todayCheckOuts,
    cleanerSchedules,
    propertyStatuses,
    alerts
  ] = await Promise.all([
    getSystemHealth(),
    getActiveUsers(),
    getTodayCheckIns(),
    getTodayCheckOuts(),
    getCleanerSchedules(),
    getPropertyStatuses(),
    getActiveAlerts()
  ]);

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
