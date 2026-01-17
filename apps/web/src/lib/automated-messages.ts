/**
 * Right at Home BnB - Automated 4-Message Flow System
 * Pre-arrival, Check-in, Mid-stay, and Checkout automated messages
 * Tone: Warm, professional, Texas hospitality (Steven Palma style)
 * @author ECHO OMEGA PRIME
 */

import { properties, PropertyDetails } from './property-knowledge';

// ============================================================================
// TYPES
// ============================================================================

export type MessageType = 'pre_arrival' | 'checkin' | 'mid_stay' | 'checkout';
export type MessageChannel = 'sms' | 'email' | 'platform' | 'whatsapp';
export type MessageStatus = 'pending' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface GuestInfo {
  name: string;
  firstName: string;
  email: string;
  phone: string;
  platform: 'airbnb' | 'vrbo' | 'direct' | 'booking';
}

export interface BookingInfo {
  confirmationCode: string;
  propertyId: string;
  propertyName: string;
  checkInDate: Date;
  checkOutDate: Date;
  checkInTime: string;
  checkOutTime: string;
  numberOfGuests: number;
  numberOfNights: number;
  totalAmount?: number;
  specialRequests?: string;
}

export interface PropertyAccessInfo {
  doorCode: string;
  wifiName: string;
  wifiPassword: string;
  address: string;
  parkingInfo: string;
  emergencyContact: string;
  specialInstructions?: string;
}

export interface AutomatedMessage {
  id: string;
  bookingId: string;
  type: MessageType;
  channel: MessageChannel;
  status: MessageStatus;
  scheduledFor: Date;
  sentAt?: Date;
  content: string;
  subject?: string; // For emails
  guest: GuestInfo;
  booking: BookingInfo;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTemplate {
  type: MessageType;
  subject?: string;
  body: string;
  smsBody?: string; // Shorter version for SMS
  timing: {
    daysBeforeCheckIn?: number;
    daysAfterCheckIn?: number;
    hoursBeforeCheckOut?: number;
  };
}

// ============================================================================
// MESSAGE TEMPLATES - STEVEN'S STYLE
// ============================================================================

/**
 * Generate personalized message templates matching Steven's warm Texas hospitality style
 */
export function getMessageTemplates(
  guest: GuestInfo,
  booking: BookingInfo,
  access: PropertyAccessInfo
): Record<MessageType, MessageTemplate> {
  const checkInDateStr = formatDate(booking.checkInDate);
  const checkOutDateStr = formatDate(booking.checkOutDate);
  const daysUntilArrival = getDaysUntil(booking.checkInDate);
  const googleMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(access.address)}`;

  return {
    // ========================================================================
    // PRE-ARRIVAL MESSAGE (3 days before)
    // ========================================================================
    pre_arrival: {
      type: 'pre_arrival',
      subject: `We're excited to host you at ${booking.propertyName}! 🏠`,
      body: `Hi ${guest.firstName}!

This is Steven from Right at Home BnB. I wanted to reach out personally because your stay at ${booking.propertyName} is coming up in just ${daysUntilArrival} days!

📅 **Your Reservation Details:**
- Property: ${booking.propertyName}
- Check-In: ${checkInDateStr} at ${booking.checkInTime}
- Check-Out: ${checkOutDateStr} at ${booking.checkOutTime}
- Guests: ${booking.numberOfGuests}
- Confirmation: ${booking.confirmationCode}

🗺️ **Property Address:**
${access.address}
[Get Directions](${googleMapsUrl})

**What to Expect:**
You'll receive your check-in instructions with door code and WiFi details the morning of your arrival. We use smart locks, so check-in is easy and contactless!

**A Few Quick Tips:**
• The property will be ready by ${booking.checkInTime}
• Free parking is available on-site
• Feel free to reach out if you have any questions before arrival

We're here to make your stay exceptional. If there's anything special you need or if you have any questions, just reply to this message or call me at ${access.emergencyContact}.

Looking forward to hosting you!

Warm regards,
**Steven Palma**
Right at Home BnB
*"Making you feel right at home in Midland, Texas"*`,

      smsBody: `Hi ${guest.firstName}! Steven from Right at Home BnB here. Your stay at ${booking.propertyName} is in ${daysUntilArrival} days! Check-in: ${checkInDateStr} at ${booking.checkInTime}. You'll get door codes on arrival day. Questions? Text me anytime! - Steven`,

      timing: { daysBeforeCheckIn: 3 },
    },

    // ========================================================================
    // CHECK-IN MESSAGE (Day of arrival - morning)
    // ========================================================================
    checkin: {
      type: 'checkin',
      subject: `Your Check-In Details for Today! 🔑 ${booking.propertyName}`,
      body: `Good morning, ${guest.firstName}!

Today's the day! Your home away from home at ${booking.propertyName} is ready and waiting for you.

🔑 **DOOR CODE:** **${access.doorCode}**
*(Enter this on the keypad to unlock)*

📶 **WiFi:**
- Network: **${access.wifiName}**
- Password: **${access.wifiPassword}**

📍 **Address:**
${access.address}
[Open in Google Maps](${googleMapsUrl})

🚗 **Parking:**
${access.parkingInfo}

⏰ **Check-In Time:** ${booking.checkInTime} (Your door code activates at this time)

**When You Arrive:**
1. Park in the designated area
2. Walk to the front door
3. Enter your door code: ${access.doorCode}
4. Make yourself at home!

${access.specialInstructions ? `**Special Notes:**\n${access.specialInstructions}\n\n` : ''}**House Guide:**
You'll find a welcome binder inside with everything you need to know about the property, local restaurants, and attractions.

**Need Anything?**
I'm just a call or text away: ${access.emergencyContact}

Have a wonderful stay!

**Steven Palma**
Right at Home BnB`,

      smsBody: `Welcome! ${booking.propertyName} is ready! 🔑 DOOR CODE: ${access.doorCode} | WiFi: ${access.wifiName} / ${access.wifiPassword} | Address: ${access.address} | Check-in: ${booking.checkInTime}. Call if you need anything: ${access.emergencyContact} - Steven`,

      timing: { daysBeforeCheckIn: 0 },
    },

    // ========================================================================
    // MID-STAY CHECK-IN (Day 2 or 3)
    // ========================================================================
    mid_stay: {
      type: 'mid_stay',
      subject: `How's your stay going, ${guest.firstName}? 😊`,
      body: `Hi ${guest.firstName}!

Just wanted to check in and make sure everything is going great at ${booking.propertyName}!

**Quick questions:**
- Is everything working properly?
- Do you need anything to make your stay better?
- Any questions about the house or area?

${booking.numberOfNights >= 4 ? `**Local Recommendations:**
Since you're here for a few days, here are some local favorites:
🍽️ **Dining:** Gerardo's Casita, Cork & Pig Tavern, Saltgrass Steak House
☕ **Coffee:** Cultivar Coffee, i-Roast Coffee
🛒 **Shopping:** Midland Park Mall, Tumbleweed Trading Co.
🏛️ **Attractions:** George W. Bush Childhood Home, Permian Basin Petroleum Museum

` : ''}If something isn't right or you need anything at all, please don't hesitate to reach out. Your comfort is my priority!

Enjoy the rest of your stay!

**Steven**
${access.emergencyContact}`,

      smsBody: `Hi ${guest.firstName}! Steven here - just checking in on your stay at ${booking.propertyName}. Everything going well? Let me know if you need anything! - Steven ${access.emergencyContact}`,

      timing: { daysAfterCheckIn: 2 },
    },

    // ========================================================================
    // CHECKOUT REMINDER (Morning of departure)
    // ========================================================================
    checkout: {
      type: 'checkout',
      subject: `Checkout Today - Thank You for Staying with Us! 💙`,
      body: `Good morning, ${guest.firstName}!

Today is your checkout day from ${booking.propertyName}. We hope you had an amazing stay!

⏰ **Checkout Time:** ${booking.checkOutTime}

**Before You Go - Quick Checkout Checklist:**
✅ Gather all personal belongings (check closets, drawers, under beds!)
✅ Place used towels in the bathtub or bathroom floor
✅ Put dishes in dishwasher (no need to run it)
✅ Take out any trash to the bins outside
✅ Turn off lights and AC/heat
✅ Lock all doors and windows
✅ Make sure the front door locks behind you

**Don't Worry About:**
❌ Stripping beds - we've got it!
❌ Deep cleaning - our team handles that
❌ Rearranging furniture

**Leaving Feedback:**
If you had a great stay, we'd love a review on ${guest.platform === 'airbnb' ? 'Airbnb' : guest.platform === 'vrbo' ? 'VRBO' : 'Google'}! It really helps other travelers find us.

**Something Missing?**
If you accidentally leave something behind, let us know ASAP and we'll do our best to get it back to you!

Thank you for choosing Right at Home BnB. We truly appreciate you, and we hope to host you again on your next visit to Midland!

Safe travels!

**Steven Palma**
Right at Home BnB
${access.emergencyContact}

*P.S. - Planning another trip to Midland? Book direct with us for the best rates!*`,

      smsBody: `Good morning ${guest.firstName}! Checkout is by ${booking.checkOutTime} today. Quick reminder: gather belongings, take trash out, lock up. Thanks for staying with us - safe travels! 🙏 If you enjoyed your stay, we'd love a review! - Steven`,

      timing: { hoursBeforeCheckOut: 4 },
    },
  };
}

// ============================================================================
// SCHEDULING FUNCTIONS
// ============================================================================

/**
 * Calculate when each message should be sent based on booking dates
 */
export function calculateMessageSchedule(booking: BookingInfo): Record<MessageType, Date> {
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = booking.numberOfNights;

  // Pre-arrival: 3 days before (at 10 AM local time)
  const preArrival = new Date(checkIn);
  preArrival.setDate(preArrival.getDate() - 3);
  preArrival.setHours(10, 0, 0, 0);

  // Check-in: Day of arrival (at 8 AM local time)
  const checkinMsg = new Date(checkIn);
  checkinMsg.setHours(8, 0, 0, 0);

  // Mid-stay: Day 2 or 3 of stay (at 2 PM local time)
  // For short stays (1-2 nights), skip mid-stay message
  const midStay = new Date(checkIn);
  if (nights >= 3) {
    midStay.setDate(midStay.getDate() + 2);
  } else if (nights >= 2) {
    midStay.setDate(midStay.getDate() + 1);
  }
  midStay.setHours(14, 0, 0, 0);

  // Checkout: Morning of departure (4 hours before checkout time, minimum 7 AM)
  const checkout = new Date(checkOut);
  const checkoutHour = parseInt(booking.checkOutTime.split(':')[0]) || 11;
  const reminderHour = Math.max(7, checkoutHour - 4);
  checkout.setHours(reminderHour, 0, 0, 0);

  return {
    pre_arrival: preArrival,
    checkin: checkinMsg,
    mid_stay: midStay,
    checkout: checkout,
  };
}

/**
 * Determine if mid-stay message should be sent based on stay length
 */
export function shouldSendMidStayMessage(nights: number): boolean {
  return nights >= 2; // Only send mid-stay for 2+ night stays
}

/**
 * Create all scheduled messages for a booking
 */
export function createScheduledMessages(
  bookingId: string,
  guest: GuestInfo,
  booking: BookingInfo,
  access: PropertyAccessInfo,
  channel: MessageChannel = 'email'
): AutomatedMessage[] {
  const schedule = calculateMessageSchedule(booking);
  const templates = getMessageTemplates(guest, booking, access);
  const messages: AutomatedMessage[] = [];
  const now = new Date();

  const messageTypes: MessageType[] = ['pre_arrival', 'checkin', 'mid_stay', 'checkout'];

  for (const type of messageTypes) {
    // Skip mid-stay for short stays
    if (type === 'mid_stay' && !shouldSendMidStayMessage(booking.numberOfNights)) {
      continue;
    }

    const scheduledTime = schedule[type];
    const template = templates[type];

    // Don't schedule messages in the past
    if (scheduledTime < now) {
      continue;
    }

    const message: AutomatedMessage = {
      id: generateMessageId(),
      bookingId,
      type,
      channel,
      status: 'scheduled',
      scheduledFor: scheduledTime,
      content: channel === 'sms' ? (template.smsBody || template.body) : template.body,
      subject: template.subject,
      guest,
      booking,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    messages.push(message);
  }

  return messages;
}

// ============================================================================
// PROPERTY HELPER FUNCTIONS
// ============================================================================

/**
 * Get property access info from property ID
 */
export function getPropertyAccessInfo(propertyId: string): PropertyAccessInfo | null {
  const property = properties.find((p) => p.id === propertyId);
  if (!property) return null;

  return {
    doorCode: property.doorCode,
    wifiName: property.wifiName,
    wifiPassword: property.wifiPassword,
    address: property.address,
    parkingInfo: property.parkingInfo,
    emergencyContact: property.emergencyContact,
    specialInstructions: property.houseRules.join(' | '),
  };
}

/**
 * Get a single message by type
 */
export function getSingleMessage(
  type: MessageType,
  guest: GuestInfo,
  booking: BookingInfo,
  access: PropertyAccessInfo,
  channel: MessageChannel = 'email'
): { subject?: string; body: string; smsBody?: string } {
  const templates = getMessageTemplates(guest, booking, access);
  const template = templates[type];

  return {
    subject: template.subject,
    body: template.body,
    smsBody: template.smsBody,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getDaysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// MESSAGE QUEUE PROCESSOR
// ============================================================================

export interface MessageQueueItem {
  message: AutomatedMessage;
  sendFunction: (message: AutomatedMessage) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Process pending messages that are due to be sent
 */
export async function processMessageQueue(
  messages: AutomatedMessage[],
  sendFunction: (message: AutomatedMessage) => Promise<{ success: boolean; error?: string }>
): Promise<{ sent: number; failed: number; results: Array<{ id: string; success: boolean; error?: string }> }> {
  const now = new Date();
  const dueMessages = messages.filter(
    (m) => m.status === 'scheduled' && m.scheduledFor <= now
  );

  let sent = 0;
  let failed = 0;
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const message of dueMessages) {
    try {
      message.status = 'pending';
      message.attempts += 1;
      message.updatedAt = new Date();

      const result = await sendFunction(message);

      if (result.success) {
        message.status = 'sent';
        message.sentAt = new Date();
        sent++;
      } else {
        message.status = message.attempts >= 3 ? 'failed' : 'scheduled';
        message.lastError = result.error;
        failed++;
      }

      results.push({ id: message.id, success: result.success, error: result.error });
    } catch (error: any) {
      message.status = message.attempts >= 3 ? 'failed' : 'scheduled';
      message.lastError = error.message;
      failed++;
      results.push({ id: message.id, success: false, error: error.message });
    }

    message.updatedAt = new Date();
  }

  return { sent, failed, results };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const AutomatedMessaging = {
  getTemplates: getMessageTemplates,
  calculateSchedule: calculateMessageSchedule,
  createScheduledMessages,
  getPropertyAccess: getPropertyAccessInfo,
  getSingleMessage,
  processQueue: processMessageQueue,
  shouldSendMidStay: shouldSendMidStayMessage,
};

export default AutomatedMessaging;
