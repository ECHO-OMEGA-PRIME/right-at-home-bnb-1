/**
 * Cleaner Monitoring Service for Right at Home BnB
 * AI Steven's proactive monitoring system
 *
 * Features:
 * - Monitor cleaner schedules for lateness
 * - Auto-call Steven when cleaners are 1+ hours late
 * - Track cleaner status and history
 * - Send alerts and notifications
 */

import {
  ALERT_LOOKUP_UNKNOWN,
  createAlert,
  escalateAlert as escalateStoredAlert,
  findOpenAlert,
  listOpenAlerts,
  markNotified,
  resolveAlert,
  type StoredAlert,
} from './operational-alerts';
import { makeCall, sendSMS, CallType } from './twilio';
import { getBusinessContext, CleanerSchedule } from './business-context';

// ============ Configuration ============

const LATE_THRESHOLD_HOURS = 1; // Hours late before auto-calling Steven
const VERY_LATE_THRESHOLD_HOURS = 2; // Hours for escalated alert

const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';
const COMMANDER_PHONE = process.env.COMMANDER_PHONE || '+14322693446';

// ============ Types ============

export interface CleanerAlert {
  id?: string;
  cleanerId: string;
  cleanerName: string;
  cleanerPhone: string;
  propertyId: string;
  propertyName: string;
  scheduledTime: string;
  hoursLate: number;
  alertType: 'late' | 'very_late' | 'no_show';
  callMade: boolean;
  callSid?: string;
  smsSent: boolean;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface MonitorResult {
  checkedAt: string;
  lateCleaners: CleanerSchedule[];
  alertsCreated: number;
  callsMade: number;
  smsSent: number;
  errors: string[];
}

// ============ Monitoring Functions ============

/**
 * Check for late cleaners and take action
 */
export async function checkForLateCleaners(): Promise<MonitorResult> {
  console.log('[CleanerMonitor] Running late cleaner check...');

  const result: MonitorResult = {
    checkedAt: new Date().toISOString(),
    lateCleaners: [],
    alertsCreated: 0,
    callsMade: 0,
    smsSent: 0,
    errors: []
  };

  try {
    // Get business context (includes late cleaners)
    const context = await getBusinessContext();
    result.lateCleaners = context.lateCleaners;

    console.log(`[CleanerMonitor] Found ${result.lateCleaners.length} late cleaners`);

    // Process each late cleaner
    for (const cleaner of result.lateCleaners) {
      try {
        await processLateCleaner(cleaner, result);
      } catch (e) {
        const error = `Error processing ${cleaner.cleanerName}: ${e instanceof Error ? e.message : 'Unknown'}`;
        result.errors.push(error);
        console.error(`[CleanerMonitor] ${error}`);
      }
    }
  } catch (e) {
    const error = `Monitor check failed: ${e instanceof Error ? e.message : 'Unknown'}`;
    result.errors.push(error);
    console.error(`[CleanerMonitor] ${error}`);
  }

  console.log('[CleanerMonitor] Check complete:', {
    lateCleaners: result.lateCleaners.length,
    alertsCreated: result.alertsCreated,
    callsMade: result.callsMade
  });

  return result;
}

/**
 * Process a single late cleaner
 */
async function processLateCleaner(
  cleaner: CleanerSchedule,
  result: MonitorResult
): Promise<void> {
  const hoursLate = cleaner.hoursLate || 0;

  // Check if we've already alerted for this cleaner today
  const existingAlert = await getExistingAlert(cleaner.id);

  // We could not read the alert store, so we cannot tell whether Steven has
  // already been called about this. Record it and stop: a missed call is
  // recoverable on the next run once the store is readable, whereas a repeated
  // call cannot be un-made and lands on a real phone.
  if (existingAlert === ALERT_LOOKUP_UNKNOWN) {
    const msg =
      `Alert store unreadable for ${cleaner.cleanerName} at ${cleaner.propertyName} ` +
      `(${hoursLate}h late). Skipped calling Steven because a previous alert cannot be ruled out.`;
    result.errors.push(msg);
    console.error(`[CleanerMonitor] ${msg}`);
    return;
  }

  if (existingAlert && !existingAlert.resolved) {
    console.log(`[CleanerMonitor] Alert already exists for ${cleaner.cleanerName}`);

    // Escalate if they're now very late
    if (hoursLate >= VERY_LATE_THRESHOLD_HOURS && existingAlert.alertType === 'late') {
      await escalateAlert(existingAlert, hoursLate, result);
    }
    return;
  }

  // Create new alert
  const alertType = hoursLate >= VERY_LATE_THRESHOLD_HOURS ? 'very_late' : 'late';
  const alert = await createCleanerAlert(cleaner, alertType);
  result.alertsCreated++;

  // Auto-call Steven if cleaner is 1+ hours late
  if (hoursLate >= LATE_THRESHOLD_HOURS) {
    await callStevenAboutLateCleaner(cleaner, hoursLate, alert, result);
  }

  // Send SMS to cleaner as reminder
  if (cleaner.cleanerPhone) {
    await sendCleanerReminder(cleaner, result);
  }
}

/**
 * Check for existing unresolved alert for this cleaner schedule
 */
/**
 * Look up an unresolved alert for this schedule.
 *
 * Returns the alert, `null` for "confirmed none", or the UNKNOWN sentinel when
 * the store could not be read.
 *
 * That third case is the whole point. This used to return null both when there
 * was genuinely no prior alert AND when Firestore was unreachable or
 * quota-limited — and the caller treats null as "not alerted yet, go call
 * Steven". The alert it then creates cannot be persisted either (createAlert
 * no-ops without `db`), so the next run finds nothing again. That is a call to
 * a real phone every 15 minutes, per late cleaner, for as long as the outage
 * lasts, with no record that any of it happened.
 *
 * De-duplication that fails open is not de-duplication.
 */
export { ALERT_LOOKUP_UNKNOWN };
type AlertLookup = CleanerAlert | null | typeof ALERT_LOOKUP_UNKNOWN;

/** The alert store keys de-duplication on this; one namespace per monitor. */
function dedupeKeyFor(scheduleId: string): string {
  return `cleaner-schedule:${scheduleId}`;
}

function toCleanerAlert(stored: StoredAlert): CleanerAlert {
  const meta = stored.metadata as Partial<CleanerAlert>;
  return {
    id: stored.id,
    cleanerId: String(meta.cleanerId ?? ''),
    cleanerName: String(meta.cleanerName ?? ''),
    cleanerPhone: String(meta.cleanerPhone ?? ''),
    propertyId: stored.propertyId ?? String(meta.propertyId ?? ''),
    propertyName: String(meta.propertyName ?? ''),
    scheduledTime: String(meta.scheduledTime ?? ''),
    hoursLate: Number(meta.hoursLate ?? 0),
    alertType: (meta.alertType as CleanerAlert['alertType']) ?? 'late',
    callMade: Boolean(meta.callMade),
    callSid: meta.callSid,
    smsSent: Boolean(meta.smsSent),
    createdAt: stored.createdAt.toISOString(),
    resolved: stored.status === 'RESOLVED',
    resolvedAt: stored.resolvedAt?.toISOString(),
  };
}

async function getExistingAlert(scheduleId: string): Promise<AlertLookup> {
  // findOpenAlert returns null ONLY for a successful query that matched
  // nothing, and the UNKNOWN sentinel for any failure. That distinction is the
  // whole contract -- see the comment above.
  const found = await findOpenAlert(dedupeKeyFor(scheduleId));
  if (found === ALERT_LOOKUP_UNKNOWN) return ALERT_LOOKUP_UNKNOWN;
  return found ? toCleanerAlert(found) : null;
}

/**
 * Create a new cleaner alert in the database
 */
async function createCleanerAlert(
  cleaner: CleanerSchedule,
  alertType: 'late' | 'very_late' | 'no_show'
): Promise<CleanerAlert> {
  const alert: CleanerAlert = {
    cleanerId: cleaner.cleanerId,
    cleanerName: cleaner.cleanerName,
    cleanerPhone: cleaner.cleanerPhone,
    propertyId: cleaner.propertyId,
    propertyName: cleaner.propertyName,
    scheduledTime: cleaner.scheduledTime,
    hoursLate: cleaner.hoursLate || 0,
    alertType,
    callMade: false,
    smsSent: false,
    createdAt: new Date().toISOString(),
    resolved: false
  };

  // Deliberately NOT wrapped in a try/catch that swallows the failure. The
  // Firestore version returned this unsaved object when the write failed, so
  // the caller phoned somebody about an alert that existed nowhere -- and the
  // next run, finding nothing, phoned again. A failed write must stop the
  // sweep for this cleaner, and processLateCleaner records it as an error.
  const stored = await createAlert({
    alertType: 'LATE_CLEANER',
    severity: alertType === 'no_show' ? 'CRITICAL' : alertType === 'very_late' ? 'HIGH' : 'NORMAL',
    title: `${cleaner.cleanerName} is ${alertType.replace('_', ' ')} at ${cleaner.propertyName}`,
    message:
      `${cleaner.cleanerName} was scheduled at ${cleaner.scheduledTime} for ` +
      `${cleaner.propertyName} and is ${alert.hoursLate} hour(s) late.`,
    dedupeKey: dedupeKeyFor(cleaner.id),
    propertyId: cleaner.propertyId || null,
    metadata: {
      cleanerId: alert.cleanerId,
      cleanerName: alert.cleanerName,
      cleanerPhone: alert.cleanerPhone,
      propertyName: alert.propertyName,
      scheduledTime: alert.scheduledTime,
      hoursLate: alert.hoursLate,
      alertType,
      callMade: false,
      smsSent: false,
    },
  });

  alert.id = stored.id;
  console.log(`[CleanerMonitor] Created alert ${stored.id} for ${cleaner.cleanerName}`);
  return alert;
}

/**
 * Escalate an existing alert to very_late
 */
async function escalateAlert(
  alert: CleanerAlert,
  hoursLate: number,
  result: MonitorResult
): Promise<void> {
  console.log(`[CleanerMonitor] Escalating alert for ${alert.cleanerName} (${hoursLate} hours late)`);

  try {
    if (alert.id) {
      await escalateStoredAlert(alert.id, 'HIGH', { alertType: 'very_late', hoursLate });
    }

    // Make another call since it's now very late
    await callStevenAboutLateCleaner(
      {
        id: alert.id || '',
        cleanerId: alert.cleanerId,
        cleanerName: alert.cleanerName,
        cleanerPhone: alert.cleanerPhone,
        propertyId: alert.propertyId,
        propertyName: alert.propertyName,
        scheduledTime: alert.scheduledTime,
        status: 'late',
        hoursLate
      },
      hoursLate,
      alert,
      result
    );
  } catch (e) {
    console.error('[CleanerMonitor] Error escalating alert:', e);
  }
}

/**
 * Call Steven about a late cleaner with full context
 */
async function callStevenAboutLateCleaner(
  cleaner: CleanerSchedule,
  hoursLate: number,
  alert: CleanerAlert,
  result: MonitorResult
): Promise<void> {
  console.log(`[CleanerMonitor] Calling Steven about ${cleaner.cleanerName}`);

  // Get full business context for the call
  const context = await getBusinessContext();

  // Build context-aware message
  const message = buildLateCleanerMessage(cleaner, hoursLate, context);

  try {
    const callResult = await makeCall({
      to: STEVEN_PHONE,
      type: 'emergency' as CallType,
      message,
      propertyName: cleaner.propertyName,
      urgency: hoursLate >= VERY_LATE_THRESHOLD_HOURS ? 'critical' : 'high'
    });

    if (callResult.success) {
      result.callsMade++;

      // Update alert with call info
      if (alert.id) {
        await markNotified(alert.id, {
          callMade: true,
          callSid: callResult.callSid,
          callTime: new Date().toISOString(),
        });
      }

      console.log(`[CleanerMonitor] Call to Steven successful: ${callResult.callSid}`);
    } else {
      result.errors.push(`Call failed: ${callResult.error}`);
      console.error(`[CleanerMonitor] Call failed: ${callResult.error}`);
    }
  } catch (e) {
    result.errors.push(`Call exception: ${e instanceof Error ? e.message : 'Unknown'}`);
    console.error('[CleanerMonitor] Call exception:', e);
  }
}

/**
 * Build a context-aware message for Steven about a late cleaner
 */
function buildLateCleanerMessage(
  cleaner: CleanerSchedule,
  hoursLate: number,
  context: Awaited<ReturnType<typeof getBusinessContext>>
): string {
  const lines: string[] = [];

  // Main alert
  if (hoursLate >= VERY_LATE_THRESHOLD_HOURS) {
    lines.push(`URGENT: ${cleaner.cleanerName} is now ${hoursLate} hours late for ${cleaner.propertyName}.`);
  } else {
    lines.push(`${cleaner.cleanerName} is ${hoursLate} hour${hoursLate === 1 ? '' : 's'} late for ${cleaner.propertyName}.`);
  }

  // Check if there's a check-in today at this property
  const checkInAtProperty = context.todayCheckIns.find(
    r => r.propertyId === cleaner.propertyId
  );
  if (checkInAtProperty) {
    lines.push(`Important: ${checkInAtProperty.guestName} is checking in today at this property.`);
  }

  // Add overall context
  if (context.todayCheckIns.length > 0) {
    lines.push(`Today's check-ins: ${context.todayCheckIns.length}.`);
  }

  if (context.lateCleaners.length > 1) {
    lines.push(`Note: ${context.lateCleaners.length} cleaners are currently late across all properties.`);
  }

  // System status
  if (context.systemHealth.status !== 'healthy') {
    lines.push(`System status: ${context.systemHealth.status}.`);
  }

  return lines.join(' ');
}

/**
 * Send SMS reminder to the cleaner
 */
async function sendCleanerReminder(
  cleaner: CleanerSchedule,
  result: MonitorResult
): Promise<void> {
  if (!cleaner.cleanerPhone) return;

  const message = `Hi ${cleaner.cleanerName}, this is AI Steven from Right at Home BnB. ` +
    `You're scheduled to clean ${cleaner.propertyName} but haven't checked in yet. ` +
    `Please update your status or call us if you need assistance.`;

  try {
    const smsResult = await sendSMS(cleaner.cleanerPhone, message);
    if (smsResult.success) {
      result.smsSent++;
      console.log(`[CleanerMonitor] SMS sent to ${cleaner.cleanerName}`);
    }
  } catch (e) {
    console.error('[CleanerMonitor] SMS failed:', e);
  }
}

/**
 * Resolve a cleaner alert
 */
export async function resolveCleanerAlert(
  alertId: string,
  resolvedBy: string,
  notes?: string
): Promise<boolean> {
  const resolved = await resolveAlert(alertId, resolvedBy, notes);
  if (resolved) console.log(`[CleanerMonitor] Alert ${alertId} resolved by ${resolvedBy}`);
  return resolved;
}

/**
 * Get all active (unresolved) cleaner alerts.
 *
 * A store failure now THROWS instead of returning []. An empty list rendered
 * during an outage says "no cleaners are late", which is the most dangerous
 * sentence an operations alert screen can produce -- it is indistinguishable
 * from a genuinely quiet morning. The caller decides how to surface it; this
 * function refuses to invent good news.
 */
export async function getActiveCleanerAlerts(): Promise<CleanerAlert[]> {
  const stored = await listOpenAlerts('LATE_CLEANER');
  return stored.map(toCleanerAlert);
}

/**
 * Manual trigger to call Steven with current status
 */
export async function callStevenWithFullContext(
  reason: string = 'status_update'
): Promise<{ success: boolean; callSid?: string; error?: string }> {
  console.log(`[CleanerMonitor] Manual call to Steven: ${reason}`);

  const context = await getBusinessContext();

  const message = `Hello Steven, this is AI Steven with your daily update. ${context.summary}`;

  return makeCall({
    to: STEVEN_PHONE,
    type: reason === 'emergency' ? 'emergency' : 'status_update',
    message,
    urgency: reason === 'emergency' ? 'critical' : 'normal'
  });
}

/**
 * Call the Commander (Bob) with full context
 */
export async function callCommanderWithContext(
  reason: string = 'status_update'
): Promise<{ success: boolean; callSid?: string; error?: string }> {
  console.log(`[CleanerMonitor] Calling Commander: ${reason}`);

  const context = await getBusinessContext();

  const message = `Hello Commander, this is AI Steven from Right at Home B and B. ${context.summary}`;

  return makeCall({
    to: COMMANDER_PHONE,
    type: reason === 'emergency' ? 'emergency' : 'status_update',
    message,
    urgency: reason === 'emergency' ? 'critical' : 'normal'
  });
}

export default {
  checkForLateCleaners,
  resolveCleanerAlert,
  getActiveCleanerAlerts,
  callStevenWithFullContext,
  callCommanderWithContext
};
