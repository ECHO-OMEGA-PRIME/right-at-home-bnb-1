/**
 * Twilio Integration for Right at Home BnB
 * AI Steven - Context-Aware Automated Phone Calls
 *
 * Features:
 * - FULL BUSINESS CONTEXT on every call
 * - Outbound calls for status updates
 * - Emergency notifications with context
 * - Cleaning job reminders
 * - Guest check-in/out notifications
 * - Late cleaner auto-calls
 *
 * AI Steven Personality:
 * - Business-minded and professional
 * - Customer-first mentality
 * - Personalized experience focus
 * - Warm but efficient communication
 */

// Dynamic import to prevent build errors when twilio is not installed
let twilioModule: any = null;

const getTwilioModule = async () => {
  if (!twilioModule) {
    try {
      twilioModule = await import('twilio');
    } catch (e) {
      console.warn('[Twilio] twilio package not installed, using mock');
      return null;
    }
  }
  return twilioModule?.default || twilioModule;
};

import { getBusinessContext, getVoiceContextSummary } from './business-context';
import {
  STEVEN_PERSONALITY,
  STEVEN_MESSAGES,
  generateContextMessage,
  getStevenTwiMLVoice
} from './steven-personality';

// Twilio credentials from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+14322248166';

// Steven's contact info
const STEVEN_PHONE = process.env.STEVEN_PHONE || '+14325591904';

// Initialize Twilio client
const getTwilioClient = async () => {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured');
  }
  const twilio = await getTwilioModule();
  if (!twilio) {
    throw new Error('Twilio package not installed');
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
};

// Call types
export type CallType =
  | 'status_update'      // General status update
  | 'cleaning_reminder'  // Reminder for upcoming cleaning job
  | 'cleaning_complete'  // Notification that cleaning is done
  | 'emergency'          // Emergency notification to Steven
  | 'guest_checkin'      // Guest check-in notification
  | 'guest_checkout'     // Guest check-out notification
  | 'maintenance'        // Maintenance alert
  | 'custom';            // Custom message

export interface CallRequest {
  to: string;
  type: CallType;
  propertyName?: string;
  propertyId?: string;
  cleanerName?: string;
  guestName?: string;
  message?: string;
  scheduledTime?: string;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  status?: string;
  error?: string;
}

// Generate TwiML message based on call type
// Uses Steven's personality for warm, professional, customer-first communication
const generateTwiML = (request: CallRequest): string => {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://rah-midland.com';

  // Voice settings from Steven's personality profile
  const voiceSettings = getStevenTwiMLVoice();

  let message = '';

  switch (request.type) {
    case 'status_update':
      message = `
        <Say ${voiceSettings}>
          ${STEVEN_MESSAGES.greetings.owner('there')}
          I'm calling with a status update about ${request.propertyName || 'your properties'}.
          ${request.message || 'Everything is running smoothly.'}
          If you have any questions, don't hesitate to reach out.
          ${STEVEN_MESSAGES.closings.professional()}
        </Say>
      `;
      break;

    case 'cleaning_reminder':
      message = `
        <Say ${voiceSettings}>
          ${STEVEN_MESSAGES.greetings.cleaner(request.cleanerName || 'there')}
          ${STEVEN_MESSAGES.cleaner.reminder(
            request.cleanerName || 'there',
            request.propertyName || 'the property',
            request.scheduledTime || 'your scheduled time'
          )}
          Please confirm by pressing 1, or press 2 if you need to reschedule.
        </Say>
        <Gather input="dtmf" numDigits="1" action="${baseUrl}/api/calls/gather" method="POST">
          <Say ${voiceSettings}>Press 1 to confirm, or 2 to reschedule.</Say>
        </Gather>
        <Say ${voiceSettings}>No worries, I'll follow up later. Take care!</Say>
      `;
      break;

    case 'cleaning_complete':
      message = `
        <Say ${voiceSettings}>
          ${STEVEN_MESSAGES.greetings.owner('there')}
          ${STEVEN_MESSAGES.cleaner.completed(
            request.cleanerName || 'Your cleaner',
            request.propertyName || 'the property'
          )}
          ${STEVEN_MESSAGES.closings.professional()}
        </Say>
      `;
      break;

    case 'emergency':
      message = `
        <Say ${voiceSettings}>
          Attention! This is an urgent message from Right at Home B and B.
          ${request.message || 'There is an emergency that requires your immediate attention.'}
          ${request.propertyName ? `This concerns ${request.propertyName}.` : ''}
          Please respond immediately. Press 1 to acknowledge this message.
        </Say>
        <Gather input="dtmf" numDigits="1" action="${baseUrl}/api/calls/emergency-ack" method="POST" timeout="10">
          <Say ${voiceSettings}>Press 1 to acknowledge.</Say>
        </Gather>
        <Say ${voiceSettings}>No response received. Calling again in 5 minutes.</Say>
      `;
      break;

    case 'guest_checkin':
      message = `
        <Say ${voiceSettings}>
          ${STEVEN_MESSAGES.greetings.owner('there')}
          ${STEVEN_MESSAGES.checkIn.toOwner(
            request.guestName || 'Your guest',
            request.propertyName || 'the property'
          )}
          ${STEVEN_MESSAGES.closings.professional()}
        </Say>
      `;
      break;

    case 'guest_checkout':
      message = `
        <Say ${voiceSettings}>
          ${STEVEN_MESSAGES.greetings.owner('there')}
          ${STEVEN_MESSAGES.checkOut.toOwner(
            request.guestName || 'The guest',
            request.propertyName || 'the property'
          )}
          ${STEVEN_MESSAGES.closings.professional()}
        </Say>
      `;
      break;

    case 'maintenance':
      message = `
        <Say ${voiceSettings}>
          Hello, this is Steven from Right at Home B and B.
          ${request.urgency === 'critical' ? 'URGENT: ' : ''}We have a maintenance ${request.urgency === 'critical' ? 'emergency' : 'issue'} at ${request.propertyName || 'one of our properties'}.
          ${request.message || 'Please check the app for details.'}
          Press 1 to acknowledge, or press 2 to request a callback.
        </Say>
        <Gather input="dtmf" numDigits="1" action="${baseUrl}/api/calls/gather" method="POST">
          <Say ${voiceSettings}>Press 1 to acknowledge, or 2 for a callback.</Say>
        </Gather>
      `;
      break;

    case 'custom':
    default:
      message = `
        <Say ${voiceSettings}>
          Hello, this is Steven from Right at Home B and B.
          ${request.message || 'I have an update for you. Please check the app for details.'}
          Thank you and have a great day!
        </Say>
      `;
      break;
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response>${message}</Response>`;
};

// Make an outbound call
export async function makeCall(request: CallRequest): Promise<CallResult> {
  try {
    const client = await getTwilioClient();
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://rightathomebnb.vercel.app';

    // Create the call
    const call = await client.calls.create({
      to: request.to,
      from: TWILIO_PHONE_NUMBER!,
      twiml: generateTwiML(request),
      statusCallback: `${baseUrl}/api/calls/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    console.log(`[Twilio] Call initiated: ${call.sid} to ${request.to}`);

    return {
      success: true,
      callSid: call.sid,
      status: call.status,
    };
  } catch (error) {
    console.error('[Twilio] Call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Send an SMS
export async function sendSMS(to: string, message: string): Promise<CallResult> {
  try {
    const client = await getTwilioClient();

    const sms = await client.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER!,
      body: `[Right at Home BnB] ${message}`,
    });

    console.log(`[Twilio] SMS sent: ${sms.sid} to ${to}`);

    return {
      success: true,
      callSid: sms.sid,
      status: sms.status,
    };
  } catch (error) {
    console.error('[Twilio] SMS failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Quick call helpers
export const callSteven = (request: Omit<CallRequest, 'to'>) =>
  makeCall({ ...request, to: STEVEN_PHONE });

export const emergencyCallSteven = (message: string, propertyName?: string) =>
  callSteven({
    type: 'emergency',
    message,
    propertyName,
    urgency: 'critical',
  });

export const notifyCleaningComplete = (to: string, propertyName: string, cleanerName?: string) =>
  makeCall({
    to,
    type: 'cleaning_complete',
    propertyName,
    cleanerName,
  });

export const remindCleaner = (to: string, propertyName: string, scheduledTime: string, cleanerName?: string) =>
  makeCall({
    to,
    type: 'cleaning_reminder',
    propertyName,
    scheduledTime,
    cleanerName,
  });

// Contact directory
export interface Contact {
  id: string;
  name: string;
  phone: string;
  role: 'owner' | 'cleaner' | 'maintenance' | 'guest' | 'other';
  propertyIds?: string[];
}

// Default contacts (can be extended from database)
export const DEFAULT_CONTACTS: Contact[] = [
  {
    id: 'steven',
    name: 'Steven Palma',
    phone: STEVEN_PHONE,
    role: 'owner',
  },
];

// Get formatted phone number
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return phone.startsWith('+') ? phone : `+${cleaned}`;
}

// Validate phone number
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ============ CONTEXT-AWARE CALLS ============

/**
 * Make a context-aware call that includes full business status
 * AI Steven will know: who's logged in, check-ins, check-outs, late cleaners, system health
 */
export async function makeContextAwareCall(
  to: string,
  reason: 'status_update' | 'emergency' | 'daily_briefing'
): Promise<CallResult> {
  console.log(`[Twilio] Making context-aware call to ${to} - Reason: ${reason}`);

  try {
    // Get full business context
    const context = await getBusinessContext();

    // Build context-rich message
    let contextMessage = '';

    // System health
    if (context.systemHealth.status !== 'healthy') {
      contextMessage += `System Status: ${context.systemHealth.status}. `;
    }

    // Active users
    if (context.activeUsers.length > 0) {
      const owners = context.activeUsers.filter(u => u.role === 'owner');
      const cleaners = context.activeUsers.filter(u => u.role === 'cleaner');
      if (owners.length > 0 || cleaners.length > 0) {
        contextMessage += `Currently active: ${owners.length} owner${owners.length !== 1 ? 's' : ''}, ${cleaners.length} cleaner${cleaners.length !== 1 ? 's' : ''}. `;
      }
    }

    // Today's check-ins
    if (context.todayCheckIns.length > 0) {
      contextMessage += `Today's check-ins: ${context.todayCheckIns.map(r => r.guestName).join(', ')}. `;
    }

    // Today's check-outs
    if (context.todayCheckOuts.length > 0) {
      contextMessage += `Today's check-outs: ${context.todayCheckOuts.map(r => r.guestName).join(', ')}. `;
    }

    // Late cleaners - CRITICAL
    if (context.lateCleaners.length > 0) {
      const lateInfo = context.lateCleaners
        .map(c => `${c.cleanerName} is ${c.hoursLate} hours late for ${c.propertyName}`)
        .join('. ');
      contextMessage += `ATTENTION - Late cleaners: ${lateInfo}. `;
    }

    // High priority alerts
    const criticalAlerts = context.alerts.filter(a => a.priority === 'critical' || a.priority === 'high');
    if (criticalAlerts.length > 0) {
      contextMessage += `${criticalAlerts.length} high priority alert${criticalAlerts.length !== 1 ? 's' : ''} need attention. `;
    }

    // Default if nothing notable
    if (!contextMessage) {
      contextMessage = 'All systems running smoothly. No issues to report.';
    }

    // Make the call
    return makeCall({
      to,
      type: reason === 'emergency' ? 'emergency' : 'status_update',
      message: contextMessage,
      urgency: reason === 'emergency' ? 'critical' : 'normal'
    });
  } catch (error) {
    console.error('[Twilio] Context-aware call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Call Steven with full business context
 */
export const contextCallSteven = (reason: 'status_update' | 'emergency' | 'daily_briefing' = 'status_update') =>
  makeContextAwareCall(STEVEN_PHONE, reason);

/**
 * Call Commander (Bob) with full business context
 */
export const contextCallCommander = (reason: 'status_update' | 'emergency' | 'daily_briefing' = 'status_update') =>
  makeContextAwareCall(process.env.COMMANDER_PHONE || '+14322693446', reason);

/**
 * Daily briefing call to Steven with complete status
 */
export async function dailyBriefingCall(): Promise<CallResult> {
  console.log('[Twilio] Making daily briefing call to Steven...');
  return contextCallSteven('daily_briefing');
}

/**
 * Alert Steven about a late cleaner with full context
 */
export async function alertLateCleanerCall(
  cleanerName: string,
  propertyName: string,
  hoursLate: number
): Promise<CallResult> {
  const context = await getBusinessContext();

  // Check if guest is checking in today at this property
  const checkInToday = context.todayCheckIns.find(
    r => r.propertyName.toLowerCase() === propertyName.toLowerCase()
  );

  let message = `${cleanerName} is ${hoursLate} hour${hoursLate === 1 ? '' : 's'} late for ${propertyName}. `;

  if (checkInToday) {
    message += `IMPORTANT: ${checkInToday.guestName} is checking in today at this property. `;
  }

  message += 'Press 1 to acknowledge, or press 0 to speak with someone now.';

  return callSteven({
    type: 'emergency',
    message,
    propertyName,
    urgency: hoursLate >= 2 ? 'critical' : 'high'
  });
}

export default {
  makeCall,
  sendSMS,
  callSteven,
  emergencyCallSteven,
  notifyCleaningComplete,
  remindCleaner,
  formatPhone,
  isValidPhone,
  DEFAULT_CONTACTS,
  // Context-aware calls
  makeContextAwareCall,
  contextCallSteven,
  contextCallCommander,
  dailyBriefingCall,
  alertLateCleanerCall,
};
