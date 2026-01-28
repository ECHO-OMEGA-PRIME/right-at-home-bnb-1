/**
 * CRASH ALERTING SYSTEM - Right at Home BnB
 * Calls Commander when website crashes/errors detected
 * 
 * Features:
 * - Twilio phone call on critical errors
 * - Silence option until fixed
 * - Cooldown to prevent spam
 * - Error tracking and categorization
 * 
 * @author ECHO OMEGA PRIME | Authority 11.0
 */

import { makeCall, sendSMS } from './twilio';

// Commander's alert phone number
const COMMANDER_ALERT_PHONE = process.env.COMMANDER_ALERT_PHONE || '+14329006300';
const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';

// Alert state management (in-memory, would be better in Redis/DB for production)
interface AlertState {
  silencedUntil: number | null;  // Timestamp when silence expires
  lastAlertTime: number;
  alertCount: number;
  errors: ErrorRecord[];
}

interface ErrorRecord {
  timestamp: number;
  type: string;
  message: string;
  stack?: string;
  url?: string;
  acknowledged: boolean;
}

// Global state
let alertState: AlertState = {
  silencedUntil: null,
  lastAlertTime: 0,
  alertCount: 0,
  errors: []
};

// Cooldown between calls (5 minutes)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

// Error severity levels
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface CrashAlertOptions {
  severity?: ErrorSeverity;
  errorType: string;
  message: string;
  stack?: string;
  url?: string;
  component?: string;
  callCommander?: boolean;
  callSteven?: boolean;
  sendSMSAlert?: boolean;
}

/**
 * Check if alerts are currently silenced
 */
export function isAlertsSilenced(): boolean {
  if (!alertState.silencedUntil) return false;
  if (Date.now() > alertState.silencedUntil) {
    alertState.silencedUntil = null;
    return false;
  }
  return true;
}

/**
 * Silence alerts until issue is fixed
 * @param durationMinutes How long to silence (default 60 minutes)
 */
export function silenceAlerts(durationMinutes: number = 60): void {
  alertState.silencedUntil = Date.now() + (durationMinutes * 60 * 1000);
  console.log(`[CrashAlert] Alerts silenced for ${durationMinutes} minutes`);
}

/**
 * Unsilence alerts (when issue is fixed)
 */
export function unsilenceAlerts(): void {
  alertState.silencedUntil = null;
  console.log('[CrashAlert] Alerts unsilenced');
}

/**
 * Get current alert state
 */
export function getAlertState(): AlertState {
  return { ...alertState };
}

/**
 * Clear error history
 */
export function clearErrors(): void {
  alertState.errors = [];
  alertState.alertCount = 0;
}

/**
 * Acknowledge an error (marks it as seen)
 */
export function acknowledgeError(index: number): boolean {
  if (alertState.errors[index]) {
    alertState.errors[index].acknowledged = true;
    return true;
  }
  return false;
}

/**
 * Main crash alert function - call when critical error occurs
 */
export async function triggerCrashAlert(options: CrashAlertOptions): Promise<{
  success: boolean;
  called: boolean;
  silenced: boolean;
  error?: string;
}> {
  const {
    severity = 'critical',
    errorType,
    message,
    stack,
    url,
    component,
    callCommander = true,
    callSteven = false,
    sendSMSAlert = true
  } = options;

  // Record error
  alertState.errors.push({
    timestamp: Date.now(),
    type: errorType,
    message,
    stack,
    url,
    acknowledged: false
  });

  // Trim errors to last 100
  if (alertState.errors.length > 100) {
    alertState.errors = alertState.errors.slice(-100);
  }

  console.error(`[CrashAlert] ${severity.toUpperCase()}: ${errorType} - ${message}`);

  // Check if silenced
  if (isAlertsSilenced()) {
    console.log('[CrashAlert] Alerts are silenced, skipping call');
    return { success: true, called: false, silenced: true };
  }

  // Check cooldown
  const timeSinceLastAlert = Date.now() - alertState.lastAlertTime;
  if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((ALERT_COOLDOWN_MS - timeSinceLastAlert) / 1000);
    console.log(`[CrashAlert] Cooldown active, ${waitSeconds}s remaining`);
    
    // Still send SMS even on cooldown for critical
    if (severity === 'critical' && sendSMSAlert) {
      await sendSMS(COMMANDER_ALERT_PHONE, `⚠️ CRITICAL ERROR: ${errorType} - ${message.substring(0, 100)}`);
    }
    
    return { success: true, called: false, silenced: false };
  }

  // Only call for critical/high severity
  if (severity !== 'critical' && severity !== 'high') {
    if (sendSMSAlert) {
      await sendSMS(COMMANDER_ALERT_PHONE, `⚠️ ${severity.toUpperCase()}: ${errorType} - ${message.substring(0, 100)}`);
    }
    return { success: true, called: false, silenced: false };
  }

  // Build call message
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://rah-midland.com';
  const voiceMessage = buildVoiceMessage(severity, errorType, message, component, url);

  try {
    alertState.lastAlertTime = Date.now();
    alertState.alertCount++;

    // Call Commander
    if (callCommander) {
      const result = await makeCall({
        to: COMMANDER_ALERT_PHONE,
        type: 'custom',
        message: voiceMessage,
        urgency: severity === 'critical' ? 'critical' : 'high'
      });

      if (!result.success) {
        console.error('[CrashAlert] Failed to call Commander:', result.error);
      }
    }

    // Optionally call Steven too
    if (callSteven) {
      await makeCall({
        to: STEVEN_PHONE,
        type: 'custom',
        message: voiceMessage,
        urgency: severity === 'critical' ? 'critical' : 'high'
      });
    }

    // Send SMS backup
    if (sendSMSAlert) {
      await sendSMS(COMMANDER_ALERT_PHONE, `🚨 RAH-MIDLAND CRASH: ${errorType} - ${message.substring(0, 120)}\n\nPress 1 to silence alerts.`);
    }

    return { success: true, called: true, silenced: false };
  } catch (error) {
    console.error('[CrashAlert] Failed to trigger alert:', error);
    return { 
      success: false, 
      called: false, 
      silenced: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Build voice message for TwiML call
 */
function buildVoiceMessage(
  severity: ErrorSeverity,
  errorType: string,
  message: string,
  component?: string,
  url?: string
): string {
  let msg = '';

  if (severity === 'critical') {
    msg = 'CRITICAL ALERT! Right at Home B and B website has encountered a critical error. ';
  } else {
    msg = 'Alert from Right at Home B and B. ';
  }

  msg += `Error type: ${errorType}. `;
  msg += `${message.substring(0, 200)}. `;

  if (component) {
    msg += `Affected component: ${component}. `;
  }

  if (url) {
    msg += `On page: ${url}. `;
  }

  msg += 'Press 1 to acknowledge and silence alerts for one hour. ';
  msg += 'Press 2 to silence alerts until fixed. ';
  msg += 'Press 3 to escalate to Steven.';

  return msg;
}

/**
 * Website health check - call periodically
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {};

  try {
    // Check main site
    const mainSite = await fetch(process.env.NEXT_PUBLIC_URL || 'https://rah-midland.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });
    checks.mainSite = mainSite.ok;
  } catch {
    checks.mainSite = false;
  }

  try {
    // Check Sentinel API
    const sentinel = await fetch('https://sentinel-omni-249995513427.us-central1.run.app/health', {
      signal: AbortSignal.timeout(10000)
    });
    checks.sentinelApi = sentinel.ok;
  } catch {
    checks.sentinelApi = false;
  }

  try {
    // Check Audio Intel API
    const audioIntel = await fetch('https://audio-intel-249995513427.us-central1.run.app/health', {
      signal: AbortSignal.timeout(10000)
    });
    checks.audioIntelApi = audioIntel.ok;
  } catch {
    checks.audioIntelApi = false;
  }

  const healthy = Object.values(checks).every(v => v);

  // Alert if unhealthy
  if (!healthy) {
    const failedChecks = Object.entries(checks)
      .filter(([_, ok]) => !ok)
      .map(([name]) => name);

    await triggerCrashAlert({
      severity: 'critical',
      errorType: 'HEALTH_CHECK_FAILED',
      message: `Services down: ${failedChecks.join(', ')}`,
      callCommander: true,
      callSteven: false
    });
  }

  return { healthy, checks };
}

/**
 * Error boundary handler - use in React error boundaries
 */
export function handleReactError(error: Error, errorInfo: React.ErrorInfo): void {
  triggerCrashAlert({
    severity: 'critical',
    errorType: 'REACT_ERROR_BOUNDARY',
    message: error.message,
    stack: error.stack,
    component: errorInfo.componentStack?.split('\n')[1]?.trim()
  });
}

/**
 * Global window error handler
 */
export function setupGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    triggerCrashAlert({
      severity: 'high',
      errorType: 'WINDOW_ERROR',
      message: String(message),
      stack: error?.stack,
      url: source || window.location.href
    });
    return false;
  };

  window.onunhandledrejection = (event) => {
    triggerCrashAlert({
      severity: 'high',
      errorType: 'UNHANDLED_PROMISE_REJECTION',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      url: window.location.href
    });
  };
}

export default {
  triggerCrashAlert,
  silenceAlerts,
  unsilenceAlerts,
  isAlertsSilenced,
  getAlertState,
  clearErrors,
  acknowledgeError,
  healthCheck,
  handleReactError,
  setupGlobalErrorHandler
};
