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

import { db } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
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
async function getExistingAlert(scheduleId: string): Promise<CleanerAlert | null> {
  if (!db) return null;

  try {
    const snapshot = await db.collection('cleaner_alerts')
      .where('cleanerScheduleId', '==', scheduleId)
      .where('resolved', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as CleanerAlert;
  } catch (e) {
    console.error('[CleanerMonitor] Error checking existing alert:', e);
    return null;
  }
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

  if (!db) return alert;

  try {
    const docRef = await db.collection('cleaner_alerts').add({
      ...alert,
      cleanerScheduleId: cleaner.id
    });
    alert.id = docRef.id;
    console.log(`[CleanerMonitor] Created alert ${docRef.id} for ${cleaner.cleanerName}`);
  } catch (e) {
    console.error('[CleanerMonitor] Error creating alert:', e);
  }

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

  if (!db) return;

  try {
    if (alert.id) {
      await db.collection('cleaner_alerts').doc(alert.id).update({
        alertType: 'very_late',
        hoursLate,
        escalatedAt: new Date().toISOString()
      });
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
      if (alert.id && db) {
        await db.collection('cleaner_alerts').doc(alert.id).update({
          callMade: true,
          callSid: callResult.callSid,
          callTime: new Date().toISOString()
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
  if (!db) return false;

  try {
    await db.collection('cleaner_alerts').doc(alertId).update({
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
      notes
    });
    console.log(`[CleanerMonitor] Alert ${alertId} resolved by ${resolvedBy}`);
    return true;
  } catch (e) {
    console.error('[CleanerMonitor] Error resolving alert:', e);
    return false;
  }
}

/**
 * Get all active (unresolved) cleaner alerts
 */
export async function getActiveCleanerAlerts(): Promise<CleanerAlert[]> {
  if (!db) return [];

  try {
    const snapshot = await db.collection('cleaner_alerts')
      .where('resolved', '==', false)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CleanerAlert[];
  } catch (e) {
    console.error('[CleanerMonitor] Error getting active alerts:', e);
    return [];
  }
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
