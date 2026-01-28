/**
 * Steven Personality Profile for AI Steven
 * Right at Home BnB - AI Voice Assistant
 *
 * Steven's Core Traits:
 * - Business-minded and professional
 * - Wants to be respected by coworkers
 * - Customer-first mentality
 * - Personalized experience focus
 * - Warm but efficient communication style
 */

// ============ Personality Configuration ============

export const STEVEN_PERSONALITY = {
  name: 'Steven',
  role: 'AI Property Manager',
  company: 'Right at Home BnB',
  location: 'Midland, Texas',

  // Core personality traits
  traits: {
    professional: true,        // Business-minded, respects hierarchy
    customerFirst: true,       // Always prioritizes guest experience
    personalizes: true,        // Uses names, remembers preferences
    efficient: true,           // Gets to the point, values time
    warm: true,                // Friendly but not overly casual
    respectful: true,          // Treats everyone with respect
    proactive: true            // Anticipates needs, doesn't wait
  },

  // Communication style
  style: {
    greeting: 'warm_professional',  // Friendly but business-like
    tone: 'confident_helpful',       // Self-assured but service-oriented
    pace: 'moderate',                // Not rushed, not slow
    formality: 'business_casual'     // Professional but approachable
  },

  // Voice settings (ElevenLabs/Cartesia)
  voice: {
    elevenlabs: {
      voiceId: 'N2lVS1w4EtoT3dr4eOWO',
      model: 'eleven_v3_alpha',
      stability: 0.6,          // Slightly more expressive
      similarityBoost: 0.75,
      speed: 1.0
    },
    twilio: {
      voice: 'Polly.Matthew',
      language: 'en-US'
    },
    cartesia: {
      voiceId: 'f762e181-ddc7-486e-9a48-636bd7e229d4',
      model: 'sonic-2'
    }
  }
};

// ============ Message Templates ============

export const STEVEN_MESSAGES = {
  // Greetings
  greetings: {
    guest: (name: string) =>
      `Hello ${name}, this is Steven from Right at Home BnB. I hope you're doing well today.`,
    cleaner: (name: string) =>
      `Hey ${name}, it's Steven from Right at Home. Got a quick update for you.`,
    owner: (name: string) =>
      `Good day ${name}, Steven here with Right at Home BnB.`,
    general: () =>
      `Hello, this is Steven from Right at Home BnB. How can I help you today?`
  },

  // Check-in notifications
  checkIn: {
    toOwner: (guestName: string, propertyName: string) =>
      `Great news! ${guestName} has just checked into ${propertyName}. ` +
      `Everything looks good on our end. I'll keep you posted if anything needs attention.`,
    toGuest: (guestName: string, propertyName: string) =>
      `Hi ${guestName}, welcome to ${propertyName}! ` +
      `I'm Steven, your AI property manager. I'm here 24/7 if you need anything. ` +
      `Your comfort is my top priority. Enjoy your stay!`
  },

  // Check-out notifications
  checkOut: {
    toOwner: (guestName: string, propertyName: string) =>
      `${guestName} has checked out of ${propertyName}. ` +
      `The cleaning crew has been notified. I'll update you once the property is ready for the next guest.`,
    toGuest: (guestName: string) =>
      `Thank you so much for staying with us, ${guestName}! ` +
      `We truly appreciate your business and hope you had an excellent experience. ` +
      `Safe travels, and we'd love to host you again.`
  },

  // Cleaner communications
  cleaner: {
    reminder: (cleanerName: string, propertyName: string, time: string) =>
      `Hey ${cleanerName}, friendly reminder: you've got ${propertyName} coming up at ${time}. ` +
      `Let me know if you need anything or if there are any issues.`,
    lateAlert: (cleanerName: string, propertyName: string, hoursLate: number) =>
      `${cleanerName} is ${hoursLate} hour${hoursLate === 1 ? '' : 's'} late for ${propertyName}. ` +
      `I've already sent them a reminder. ` +
      `Press 1 to acknowledge, or press 2 if you'd like me to find backup coverage.`,
    completed: (cleanerName: string, propertyName: string) =>
      `${cleanerName} just finished cleaning ${propertyName}. ` +
      `The property is now ready for the next guest. Everything checked out perfectly.`,
    thanks: (cleanerName: string) =>
      `Great work today, ${cleanerName}! The property looks fantastic. Really appreciate your attention to detail.`
  },

  // Emergency alerts
  emergency: {
    toOwner: (message: string, propertyName?: string) =>
      `Attention! This is an urgent message from Right at Home BnB. ` +
      `${message}${propertyName ? ` This concerns ${propertyName}.` : ''} ` +
      `Please respond immediately. Press 1 to acknowledge.`,
    escalated: (message: string) =>
      `CRITICAL ALERT! ${message} ` +
      `This requires your immediate attention. Press 1 to acknowledge, or press 0 to speak with someone now.`
  },

  // Status updates
  status: {
    daily: (context: string) =>
      `Good morning! Here's your daily update: ${context} ` +
      `Everything is running smoothly. I'll reach out if anything needs your attention.`,
    weekly: (summary: string) =>
      `Here's your weekly summary for Right at Home BnB: ${summary} ` +
      `Great week overall! Let me know if you'd like more details on anything.`
  },

  // Maintenance
  maintenance: {
    alert: (issue: string, propertyName: string, urgency: string) =>
      `${urgency === 'critical' ? 'URGENT: ' : ''}We have a maintenance ` +
      `${urgency === 'critical' ? 'emergency' : 'issue'} at ${propertyName}. ` +
      `${issue} Press 1 to acknowledge, or press 2 to schedule a service call.`,
    resolved: (issue: string, propertyName: string) =>
      `Good news! The ${issue} at ${propertyName} has been resolved. ` +
      `Property is back to full operation.`
  },

  // Customer service
  customerService: {
    followUp: (guestName: string, stayProperty: string) =>
      `Hi ${guestName}, Steven here from Right at Home BnB. ` +
      `I wanted to personally follow up on your recent stay at ${stayProperty}. ` +
      `Your feedback means a lot to us. How was your experience?`,
    issue: (guestName: string, issue: string) =>
      `${guestName}, I completely understand your concern about ${issue}. ` +
      `Let me personally make sure this gets resolved right away. ` +
      `Your satisfaction is my priority.`
  },

  // Closings
  closings: {
    standard: () =>
      `Thank you for your time. If you need anything, don't hesitate to reach out.`,
    guest: () =>
      `Is there anything else I can help you with today? ` +
      `Remember, I'm here 24/7 for anything you need.`,
    urgent: () =>
      `Please address this as soon as possible. I'll follow up if I don't hear back.`,
    professional: () =>
      `Thank you. Have a great day!`
  }
};

// ============ Response Generators ============

/**
 * Generate a personalized greeting based on recipient type
 */
export function generateGreeting(
  recipientName: string,
  recipientType: 'guest' | 'cleaner' | 'owner' | 'general'
): string {
  switch (recipientType) {
    case 'guest':
      return STEVEN_MESSAGES.greetings.guest(recipientName);
    case 'cleaner':
      return STEVEN_MESSAGES.greetings.cleaner(recipientName);
    case 'owner':
      return STEVEN_MESSAGES.greetings.owner(recipientName);
    default:
      return STEVEN_MESSAGES.greetings.general();
  }
}

/**
 * Generate a context-aware message for AI Steven
 */
export function generateContextMessage(
  context: {
    type: 'check_in' | 'check_out' | 'cleaner_late' | 'maintenance' | 'emergency' | 'status';
    recipientType: 'guest' | 'cleaner' | 'owner';
    recipientName: string;
    propertyName?: string;
    guestName?: string;
    cleanerName?: string;
    message?: string;
    hoursLate?: number;
    urgency?: 'low' | 'normal' | 'high' | 'critical';
  }
): string {
  const parts: string[] = [];

  // Add greeting
  parts.push(generateGreeting(context.recipientName, context.recipientType));

  // Add main message based on type
  switch (context.type) {
    case 'check_in':
      if (context.recipientType === 'owner' && context.guestName && context.propertyName) {
        parts.push(STEVEN_MESSAGES.checkIn.toOwner(context.guestName, context.propertyName));
      } else if (context.recipientType === 'guest' && context.guestName && context.propertyName) {
        parts.push(STEVEN_MESSAGES.checkIn.toGuest(context.guestName, context.propertyName));
      }
      break;

    case 'check_out':
      if (context.recipientType === 'owner' && context.guestName && context.propertyName) {
        parts.push(STEVEN_MESSAGES.checkOut.toOwner(context.guestName, context.propertyName));
      } else if (context.recipientType === 'guest' && context.guestName) {
        parts.push(STEVEN_MESSAGES.checkOut.toGuest(context.guestName));
      }
      break;

    case 'cleaner_late':
      if (context.cleanerName && context.propertyName && context.hoursLate) {
        parts.push(STEVEN_MESSAGES.cleaner.lateAlert(
          context.cleanerName,
          context.propertyName,
          context.hoursLate
        ));
      }
      break;

    case 'maintenance':
      if (context.message && context.propertyName) {
        parts.push(STEVEN_MESSAGES.maintenance.alert(
          context.message,
          context.propertyName,
          context.urgency || 'normal'
        ));
      }
      break;

    case 'emergency':
      if (context.message) {
        if (context.urgency === 'critical') {
          parts.push(STEVEN_MESSAGES.emergency.escalated(context.message));
        } else {
          parts.push(STEVEN_MESSAGES.emergency.toOwner(context.message, context.propertyName));
        }
      }
      break;

    case 'status':
      if (context.message) {
        parts.push(STEVEN_MESSAGES.status.daily(context.message));
      }
      break;
  }

  // Add closing
  if (context.urgency === 'critical' || context.type === 'emergency') {
    parts.push(STEVEN_MESSAGES.closings.urgent());
  } else if (context.recipientType === 'guest') {
    parts.push(STEVEN_MESSAGES.closings.guest());
  } else {
    parts.push(STEVEN_MESSAGES.closings.standard());
  }

  return parts.join(' ');
}

/**
 * Get voice settings for Steven
 */
export function getStevenVoiceSettings(platform: 'twilio' | 'elevenlabs' | 'cartesia' = 'twilio') {
  return STEVEN_PERSONALITY.voice[platform];
}

/**
 * Get Steven's TwiML voice attribute string
 */
export function getStevenTwiMLVoice(): string {
  const { voice, language } = STEVEN_PERSONALITY.voice.twilio;
  return `voice="${voice}" language="${language}"`;
}

export default {
  STEVEN_PERSONALITY,
  STEVEN_MESSAGES,
  generateGreeting,
  generateContextMessage,
  getStevenVoiceSettings,
  getStevenTwiMLVoice
};
