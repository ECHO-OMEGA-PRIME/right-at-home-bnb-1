/**
 * System Monitor for Right at Home BnB
 * Auto-calls Commander when something breaks or needs attention
 *
 * Monitors:
 * - System health (database, auth, Twilio)
 * - Service availability
 * - Critical alerts
 * - Error rates
 * - Unacknowledged issues
 */

import { db, getFirebaseAdminStatus, isConfigurationIssue } from './firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { makeCall, sendSMS, CallType } from './twilio';
import { getBusinessContext, SystemHealth, Alert } from './business-context';

// ============ Configuration ============

const COMMANDER_PHONE = process.env.COMMANDER_PHONE || '+14322693446';
const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';

// How long before re-alerting about the same issue (in hours)
const ALERT_COOLDOWN_HOURS = 2;

// ============ Types ============

export interface SystemAlert {
  id?: string;
  type: 'system_down' | 'service_degraded' | 'critical_error' | 'unacknowledged_alert' | 'update_needed';
  severity: 'warning' | 'critical' | 'emergency';
  service?: string;
  message: string;
  details?: string;
  createdAt: string;
  callMade: boolean;
  callSid?: string;
  smsSent: boolean;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface SystemMonitorResult {
  checkedAt: string;
  systemHealth: SystemHealth;
  issues: SystemAlert[];
  callsMade: number;
  smsSent: number;
  errors: string[];
}

// ============ Last Alert Tracking ============

// In-memory cache of last alerts to prevent spam (would be better in Redis)
const lastAlertTimes: Map<string, Date> = new Map();

function shouldAlert(alertKey: string): boolean {
  const lastAlert = lastAlertTimes.get(alertKey);
  if (!lastAlert) return true;

  const hoursSinceLastAlert = (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastAlert >= ALERT_COOLDOWN_HOURS;
}

function markAlerted(alertKey: string): void {
  lastAlertTimes.set(alertKey, new Date());
}

// ============ Monitoring Functions ============

/**
 * Run full system health check and alert if issues found
 */
export async function runSystemHealthCheck(): Promise<SystemMonitorResult> {
  console.log('[SystemMonitor] Running system health check...');

  const result: SystemMonitorResult = {
    checkedAt: new Date().toISOString(),
    systemHealth: {
      status: 'healthy',
      uptime: '99.9%',
      lastCheck: new Date().toISOString(),
      services: { database: false, auth: false, storage: false, twilio: false },
      recentErrors: []
    },
    issues: [],
    callsMade: 0,
    smsSent: 0,
    errors: []
  };

  try {
    // Get business context (includes system health)
    const context = await getBusinessContext();
    result.systemHealth = context.systemHealth;

    // Check for system health issues
    await checkSystemHealth(result);

    // Check for critical/high alerts that haven't been acknowledged
    await checkUnacknowledgedAlerts(context.alerts, result);

    // Check for services that need updates (configurable)
    await checkForUpdates(result);

    // Process any issues found
    for (const issue of result.issues) {
      await processSystemIssue(issue, result);
    }

  } catch (e) {
    const error = `System health check failed: ${e instanceof Error ? e.message : 'Unknown'}`;
    result.errors.push(error);
    console.error(`[SystemMonitor] ${error}`);

    // If the check itself fails, that's a critical issue!
    const criticalIssue: SystemAlert = {
      type: 'critical_error',
      severity: 'emergency',
      message: 'System health check itself failed - potential major issue',
      details: error,
      createdAt: new Date().toISOString(),
      callMade: false,
      smsSent: false,
      acknowledged: false
    };
    result.issues.push(criticalIssue);
    await processSystemIssue(criticalIssue, result);
  }

  console.log('[SystemMonitor] Check complete:', {
    status: result.systemHealth.status,
    issues: result.issues.length,
    callsMade: result.callsMade
  });

  return result;
}

/**
 * Check system health for service outages
 * NOTE: Configuration issues (missing env vars) are NOT emergencies
 *       Only actual outages when properly configured should trigger calls
 */
async function checkSystemHealth(result: SystemMonitorResult): Promise<void> {
  const health = result.systemHealth;
  const firebaseStatus = getFirebaseAdminStatus();
  const isFirebaseConfigIssue = isConfigurationIssue();

  // Check overall status - but consider if it's just missing config
  if (health.status === 'critical') {
    // If it's just a config issue, don't treat as emergency
    if (isFirebaseConfigIssue) {
      result.issues.push({
        type: 'update_needed',
        severity: 'warning',  // Downgraded from emergency
        message: 'Firebase not configured - set FIREBASE_SERVICE_ACCOUNT in Vercel',
        details: firebaseStatus.error,
        createdAt: new Date().toISOString(),
        callMade: false,
        smsSent: false,
        acknowledged: false
      });
    } else {
      result.issues.push({
        type: 'system_down',
        severity: 'emergency',
        message: 'CRITICAL: System is in critical state - multiple services may be down',
        createdAt: new Date().toISOString(),
        callMade: false,
        smsSent: false,
        acknowledged: false
      });
    }
  } else if (health.status === 'degraded') {
    result.issues.push({
      type: 'service_degraded',
      severity: 'warning',
      message: 'System is degraded - some services are experiencing issues',
      createdAt: new Date().toISOString(),
      callMade: false,
      smsSent: false,
      acknowledged: false
    });
  }

  // Check individual services - but don't alert on config issues
  if (!health.services.database) {
    // Only treat as emergency if Firebase WAS configured but failed
    // If it's just missing config, that's a setup issue, not an outage
    if (isFirebaseConfigIssue) {
      console.log('[SystemMonitor] Database unavailable due to missing configuration (not an outage)');
      // Don't add an issue - this is expected when not configured
    } else {
      result.issues.push({
        type: 'system_down',
        severity: 'emergency',
        service: 'database',
        message: 'DATABASE DOWN: Firebase/Firestore connection failed',
        details: firebaseStatus.error,
        createdAt: new Date().toISOString(),
        callMade: false,
        smsSent: false,
        acknowledged: false
      });
    }
  }

  // Twilio not configured is expected on many deployments
  if (!health.services.twilio) {
    // This is just a warning, not an emergency (can't call without Twilio anyway)
    console.log('[SystemMonitor] Twilio not configured - phone/SMS unavailable');
    // Don't push an issue for this - it's expected when not configured
  }

  // Check for recent errors
  const criticalErrors = health.recentErrors.filter(e => !e.resolved);
  if (criticalErrors.length > 0) {
    result.issues.push({
      type: 'critical_error',
      severity: 'critical',
      message: `${criticalErrors.length} unresolved error(s) in the system`,
      details: criticalErrors.map(e => e.message).join('; '),
      createdAt: new Date().toISOString(),
      callMade: false,
      smsSent: false,
      acknowledged: false
    });
  }
}

/**
 * Check for critical/high alerts that haven't been acknowledged
 */
async function checkUnacknowledgedAlerts(alerts: Alert[], result: SystemMonitorResult): Promise<void> {
  const criticalAlerts = alerts.filter(
    a => !a.acknowledged && (a.priority === 'critical' || a.priority === 'high')
  );

  // Check how old the alerts are
  for (const alert of criticalAlerts) {
    const alertTime = new Date(alert.timestamp);
    const hoursOld = (Date.now() - alertTime.getTime()) / (1000 * 60 * 60);

    // If critical alert is more than 30 minutes old and unacknowledged
    if (alert.priority === 'critical' && hoursOld > 0.5) {
      result.issues.push({
        type: 'unacknowledged_alert',
        severity: 'emergency',
        message: `CRITICAL ALERT UNACKNOWLEDGED for ${Math.round(hoursOld * 60)} minutes: ${alert.message}`,
        details: alert.propertyName ? `Property: ${alert.propertyName}` : undefined,
        createdAt: new Date().toISOString(),
        callMade: false,
        smsSent: false,
        acknowledged: false
      });
    }
    // If high priority alert is more than 1 hour old and unacknowledged
    else if (alert.priority === 'high' && hoursOld > 1) {
      result.issues.push({
        type: 'unacknowledged_alert',
        severity: 'critical',
        message: `HIGH PRIORITY ALERT UNACKNOWLEDGED for ${Math.round(hoursOld)} hour(s): ${alert.message}`,
        details: alert.propertyName ? `Property: ${alert.propertyName}` : undefined,
        createdAt: new Date().toISOString(),
        callMade: false,
        smsSent: false,
        acknowledged: false
      });
    }
  }
}

/**
 * Check if any services need updates (can be configured in database)
 */
async function checkForUpdates(result: SystemMonitorResult): Promise<void> {
  if (!db) return;

  try {
    // Check for any update flags in the system_config collection
    const configDoc = await db.collection('system_config').doc('updates').get();

    if (configDoc.exists) {
      const data = configDoc.data();

      if (data?.pendingUpdates && data.pendingUpdates.length > 0) {
        result.issues.push({
          type: 'update_needed',
          severity: 'warning',
          message: `${data.pendingUpdates.length} update(s) pending: ${data.pendingUpdates.join(', ')}`,
          createdAt: new Date().toISOString(),
          callMade: false,
          smsSent: false,
          acknowledged: false
        });
      }

      if (data?.criticalUpdate) {
        result.issues.push({
          type: 'update_needed',
          severity: 'critical',
          message: `CRITICAL UPDATE NEEDED: ${data.criticalUpdate}`,
          createdAt: new Date().toISOString(),
          callMade: false,
          smsSent: false,
          acknowledged: false
        });
      }
    }
  } catch (e) {
    console.error('[SystemMonitor] Error checking for updates:', e);
  }
}

/**
 * Process a system issue - call Commander if necessary
 */
async function processSystemIssue(issue: SystemAlert, result: SystemMonitorResult): Promise<void> {
  const alertKey = `${issue.type}_${issue.service || 'general'}`;

  // Check if we should alert (cooldown period)
  if (!shouldAlert(alertKey)) {
    console.log(`[SystemMonitor] Skipping alert for ${alertKey} - in cooldown period`);
    return;
  }

  // Only call for critical and emergency severity
  if (issue.severity === 'emergency' || issue.severity === 'critical') {
    await callCommanderAboutIssue(issue, result);
    markAlerted(alertKey);
  }

  // Also send SMS for all severities
  await sendSMSAboutIssue(issue, result);

  // Store the alert in database
  await storeSystemAlert(issue);
}

/**
 * Call the Commander about a system issue
 */
async function callCommanderAboutIssue(issue: SystemAlert, result: SystemMonitorResult): Promise<void> {
  console.log(`[SystemMonitor] Calling Commander about: ${issue.message}`);

  const urgencyWord = issue.severity === 'emergency' ? 'EMERGENCY' : 'CRITICAL';
  const message = `${urgencyWord} at Right at Home B and B. ${issue.message}. ${issue.details || ''} Press 1 to acknowledge.`;

  try {
    const callResult = await makeCall({
      to: COMMANDER_PHONE,
      type: 'emergency' as CallType,
      message,
      urgency: issue.severity === 'emergency' ? 'critical' : 'high'
    });

    if (callResult.success) {
      result.callsMade++;
      issue.callMade = true;
      issue.callSid = callResult.callSid;
      console.log(`[SystemMonitor] Call to Commander successful: ${callResult.callSid}`);
    } else {
      result.errors.push(`Call to Commander failed: ${callResult.error}`);

      // If we can't reach Commander, try Steven as backup
      console.log('[SystemMonitor] Trying Steven as backup...');
      const backupCall = await makeCall({
        to: STEVEN_PHONE,
        type: 'emergency' as CallType,
        message: `Backup alert: Could not reach Commander. ${message}`,
        urgency: 'critical'
      });

      if (backupCall.success) {
        result.callsMade++;
        console.log(`[SystemMonitor] Backup call to Steven successful: ${backupCall.callSid}`);
      }
    }
  } catch (e) {
    result.errors.push(`Call exception: ${e instanceof Error ? e.message : 'Unknown'}`);
    console.error('[SystemMonitor] Call exception:', e);
  }
}

/**
 * Send SMS about a system issue
 */
async function sendSMSAboutIssue(issue: SystemAlert, result: SystemMonitorResult): Promise<void> {
  const message = `[${issue.severity.toUpperCase()}] ${issue.message}${issue.details ? ` - ${issue.details}` : ''}`;

  try {
    const smsResult = await sendSMS(COMMANDER_PHONE, message);
    if (smsResult.success) {
      result.smsSent++;
      issue.smsSent = true;
      console.log(`[SystemMonitor] SMS sent to Commander`);
    }
  } catch (e) {
    console.error('[SystemMonitor] SMS failed:', e);
  }
}

/**
 * Store system alert in database
 */
async function storeSystemAlert(alert: SystemAlert): Promise<void> {
  if (!db) return;

  try {
    const docRef = await db.collection('system_alerts').add(alert);
    alert.id = docRef.id;
    console.log(`[SystemMonitor] Stored alert: ${docRef.id}`);
  } catch (e) {
    console.error('[SystemMonitor] Error storing alert:', e);
  }
}

/**
 * Acknowledge a system alert
 */
export async function acknowledgeSystemAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<boolean> {
  if (!db) return false;

  try {
    await db.collection('system_alerts').doc(alertId).update({
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy
    });
    console.log(`[SystemMonitor] Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    return true;
  } catch (e) {
    console.error('[SystemMonitor] Error acknowledging alert:', e);
    return false;
  }
}

/**
 * Get active (unacknowledged) system alerts
 */
export async function getActiveSystemAlerts(): Promise<SystemAlert[]> {
  if (!db) return [];

  try {
    const snapshot = await db.collection('system_alerts')
      .where('acknowledged', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SystemAlert[];
  } catch (e) {
    console.error('[SystemMonitor] Error getting active alerts:', e);
    return [];
  }
}

/**
 * Manual trigger to call Commander with current system status
 */
export async function callCommanderWithSystemStatus(): Promise<{ success: boolean; callSid?: string; error?: string }> {
  console.log('[SystemMonitor] Manual call to Commander with system status');

  const context = await getBusinessContext();

  let message = 'Hello Commander, this is AI Steven with a system status report. ';
  message += context.summary;

  return makeCall({
    to: COMMANDER_PHONE,
    type: 'status_update',
    message,
    urgency: context.systemHealth.status !== 'healthy' ? 'high' : 'normal'
  });
}

/**
 * Force flag an update needed (can be called from admin panel)
 */
export async function flagUpdateNeeded(updateMessage: string, critical: boolean = false): Promise<boolean> {
  if (!db) return false;

  try {
    const configRef = db.collection('system_config').doc('updates');
    const doc = await configRef.get();

    if (critical) {
      await configRef.set({
        criticalUpdate: updateMessage,
        flaggedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      const existing = doc.exists ? (doc.data()?.pendingUpdates || []) : [];
      await configRef.set({
        pendingUpdates: [...existing, updateMessage],
        flaggedAt: new Date().toISOString()
      }, { merge: true });
    }

    console.log(`[SystemMonitor] Update flagged: ${updateMessage}`);
    return true;
  } catch (e) {
    console.error('[SystemMonitor] Error flagging update:', e);
    return false;
  }
}

export default {
  runSystemHealthCheck,
  acknowledgeSystemAlert,
  getActiveSystemAlerts,
  callCommanderWithSystemStatus,
  flagUpdateNeeded
};
