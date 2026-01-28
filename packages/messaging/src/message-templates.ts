/**
 * Right at Home BnB - Message Templates
 * Pre-built message templates for guest communications
 */

import type { MessageTemplate, MessageType, MessageChannel, MessageTiming } from './types';

/**
 * Default message timing configurations
 */
const MESSAGE_TIMINGS: Record<MessageType, MessageTiming> = {
  BOOKING_CONFIRMED: {
    triggerType: 'relative',
    relativeTo: 'booking',
    offsetDays: 0,
    offsetHours: 0,
  },
  PRE_ARRIVAL: {
    triggerType: 'relative',
    relativeTo: 'checkIn',
    offsetDays: -3,
    preferredHour: 10,
  },
  CHECK_IN_INSTRUCTIONS: {
    triggerType: 'relative',
    relativeTo: 'checkIn',
    offsetDays: -1,
    preferredHour: 14,
  },
  WELCOME: {
    triggerType: 'relative',
    relativeTo: 'checkIn',
    offsetDays: 0,
    offsetHours: 3,
  },
  MID_STAY: {
    triggerType: 'relative',
    relativeTo: 'checkIn',
    offsetDays: 2,
    preferredHour: 11,
  },
  PRE_CHECKOUT: {
    triggerType: 'relative',
    relativeTo: 'checkOut',
    offsetDays: -1,
    preferredHour: 18,
  },
  CHECKOUT_REMINDER: {
    triggerType: 'relative',
    relativeTo: 'checkOut',
    offsetDays: 0,
    offsetHours: -3,
  },
  POST_CHECKOUT: {
    triggerType: 'relative',
    relativeTo: 'checkOut',
    offsetDays: 0,
    offsetHours: 4,
  },
  REVIEW_REQUEST: {
    triggerType: 'relative',
    relativeTo: 'checkOut',
    offsetDays: 2,
    preferredHour: 10,
  },
  CUSTOM: {
    triggerType: 'manual',
  },
  MAINTENANCE_UPDATE: {
    triggerType: 'manual',
  },
  SPECIAL_OFFER: {
    triggerType: 'manual',
  },
  BIRTHDAY: {
    triggerType: 'absolute',
    preferredHour: 9,
  },
  ANNIVERSARY: {
    triggerType: 'absolute',
    preferredHour: 9,
  },
  RETURN_GUEST: {
    triggerType: 'manual',
  },
};

/**
 * Default email templates
 */
export const EMAIL_TEMPLATES: MessageTemplate[] = [
  {
    id: 'email_booking_confirmed',
    name: 'Booking Confirmation',
    type: 'BOOKING_CONFIRMED',
    channel: 'EMAIL',
    subject: 'Booking Confirmed - {{propertyName}}',
    body: `Hi {{guestFirstName}},

Thank you for choosing Right at Home BnB! Your booking is confirmed.

**Booking Details:**
- Property: {{propertyName}}
- Address: {{propertyAddress}}
- Check-in: {{checkInDate}} at 3:00 PM
- Check-out: {{checkOutDate}} at 11:00 AM
- Guests: {{guestCount}}
- Confirmation Code: {{confirmCode}}

We'll send you detailed check-in instructions a few days before your arrival.

If you have any questions, feel free to reach out!

Best regards,
{{hostName}}
Right at Home BnB`,
    variables: [
      'guestFirstName',
      'propertyName',
      'propertyAddress',
      'checkInDate',
      'checkOutDate',
      'guestCount',
      'confirmCode',
      'hostName',
    ],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.BOOKING_CONFIRMED,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_pre_arrival',
    name: 'Pre-Arrival Information',
    type: 'PRE_ARRIVAL',
    channel: 'EMAIL',
    subject: 'Getting Ready for Your Stay - {{propertyName}}',
    body: `Hi {{guestFirstName}},

Your stay at {{propertyName}} is just 3 days away! We're excited to host you.

**Quick Reminders:**
- Check-in: {{checkInDate}} at 3:00 PM
- Check-out: {{checkOutDate}} at 11:00 AM
- Address: {{propertyAddress}}

**What to Expect:**
- Self check-in with keypad access
- Your unique access code will be sent the day before
- Free parking available

**Nearby Essentials:**
- Grocery: H-E-B (5 min drive)
- Restaurants: Multiple options within 10 min
- Gas: Several stations nearby

Let us know if you need anything before your arrival!

See you soon,
{{hostName}}`,
    variables: [
      'guestFirstName',
      'propertyName',
      'propertyAddress',
      'checkInDate',
      'checkOutDate',
      'hostName',
    ],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.PRE_ARRIVAL,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_checkin_instructions',
    name: 'Check-in Instructions',
    type: 'CHECK_IN_INSTRUCTIONS',
    channel: 'EMAIL',
    subject: 'Your Check-in Details - {{propertyName}}',
    body: `Hi {{guestFirstName}},

You're all set for tomorrow! Here are your check-in details:

**Access Information:**
- Address: {{propertyAddress}}
- Door Code: {{accessCode}}
- Check-in Time: 3:00 PM or later

**How to Enter:**
1. Go to the front door
2. Enter your code {{accessCode}} on the keypad
3. Turn the handle and you're in!

**WiFi:**
- Network: {{wifiNetwork}}
- Password: {{wifiPassword}}

**Parking:**
{{parkingInfo}}

**House Rules:**
{{houseRules}}

**Emergency Contact:** {{hostPhone}}

We hope you have a wonderful stay!

{{hostName}}
Right at Home BnB`,
    variables: [
      'guestFirstName',
      'propertyName',
      'propertyAddress',
      'accessCode',
      'wifiNetwork',
      'wifiPassword',
      'parkingInfo',
      'houseRules',
      'hostPhone',
      'hostName',
    ],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.CHECK_IN_INSTRUCTIONS,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_welcome',
    name: 'Welcome Message',
    type: 'WELCOME',
    channel: 'EMAIL',
    subject: 'Welcome to {{propertyName}}!',
    body: `Hi {{guestFirstName}},

Welcome to {{propertyName}}! We hope you arrived safely.

**Quick Reference:**
- WiFi: {{wifiNetwork}} / {{wifiPassword}}
- Check-out: {{checkOutDate}} at 11:00 AM

**Local Recommendations:**
- Best dinner nearby: The Garlic Press or Wall Street Bar & Grill
- Quick breakfast: Rosa's Cafe (amazing breakfast tacos!)
- Coffee: Brew St. Bakery

**Need Anything?**
Text or call {{hostPhone}} anytime. We're here to help!

Enjoy your stay,
{{hostName}}`,
    variables: [
      'guestFirstName',
      'propertyName',
      'wifiNetwork',
      'wifiPassword',
      'checkOutDate',
      'hostPhone',
      'hostName',
    ],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.WELCOME,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_mid_stay',
    name: 'Mid-Stay Check-in',
    type: 'MID_STAY',
    channel: 'EMAIL',
    subject: 'How\'s Everything Going?',
    body: `Hi {{guestFirstName}},

Just checking in to make sure everything is going well at {{propertyName}}!

Is there anything you need? Any questions about the area?

We want to make sure you have the best possible stay.

Cheers,
{{hostName}}`,
    variables: ['guestFirstName', 'propertyName', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.MID_STAY,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_pre_checkout',
    name: 'Pre-Checkout Reminder',
    type: 'PRE_CHECKOUT',
    channel: 'EMAIL',
    subject: 'Checkout Tomorrow - Quick Reminders',
    body: `Hi {{guestFirstName}},

We hope you've had a wonderful stay! A quick reminder that checkout is tomorrow.

**Checkout Details:**
- Time: {{checkOutDate}} by 11:00 AM
- Door: Just close the door behind you (it will lock automatically)

**Before You Leave:**
- Gather all used towels and place in bathroom
- Run the dishwasher if dishes are used
- Check all rooms for personal belongings
- Set thermostat to 72
- Turn off all lights

No need to make the beds or take out trash - our team will handle that!

Thank you for staying with us!

{{hostName}}`,
    variables: ['guestFirstName', 'checkOutDate', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.PRE_CHECKOUT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_post_checkout',
    name: 'Thank You',
    type: 'POST_CHECKOUT',
    channel: 'EMAIL',
    subject: 'Thank You for Staying with Us!',
    body: `Hi {{guestFirstName}},

Thank you for staying at {{propertyName}}! We hope you had a wonderful time in Midland.

We'd love to host you again! As a returning guest, you'll always get our best rates.

Safe travels,
{{hostName}}
Right at Home BnB`,
    variables: ['guestFirstName', 'propertyName', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.POST_CHECKOUT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_review_request',
    name: 'Review Request',
    type: 'REVIEW_REQUEST',
    channel: 'EMAIL',
    subject: 'How Was Your Stay?',
    body: `Hi {{guestFirstName}},

We hope you made it home safely after your stay at {{propertyName}}!

If you have a moment, we'd really appreciate a review. It helps other travelers find us and helps us continue improving.

Thank you again for choosing Right at Home BnB!

Warm regards,
{{hostName}}`,
    variables: ['guestFirstName', 'propertyName', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.REVIEW_REQUEST,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'email_return_guest',
    name: 'Welcome Back Offer',
    type: 'RETURN_GUEST',
    channel: 'EMAIL',
    subject: 'We Miss You! Special Offer Inside',
    body: `Hi {{guestFirstName}},

It's been a while since your last stay with us, and we'd love to welcome you back!

As a valued returning guest, here's a special offer just for you:

**10% OFF your next booking at any Right at Home BnB property**

Use code: WELCOME10

This offer is valid for the next 30 days.

We hope to see you soon!

Best,
{{hostName}}
Right at Home BnB`,
    variables: ['guestFirstName', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.RETURN_GUEST,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Default SMS templates (shorter versions)
 */
export const SMS_TEMPLATES: MessageTemplate[] = [
  {
    id: 'sms_booking_confirmed',
    name: 'Booking Confirmation SMS',
    type: 'BOOKING_CONFIRMED',
    channel: 'SMS',
    body: `Booking confirmed! {{propertyName}} {{checkInDate}}-{{checkOutDate}}. Code: {{confirmCode}}. Details via email. -Right at Home BnB`,
    variables: ['propertyName', 'checkInDate', 'checkOutDate', 'confirmCode'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.BOOKING_CONFIRMED,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sms_checkin_code',
    name: 'Check-in Code SMS',
    type: 'CHECK_IN_INSTRUCTIONS',
    channel: 'SMS',
    body: `Your door code for {{propertyName}}: {{accessCode}}. Check-in after 3PM. WiFi: {{wifiNetwork}}/{{wifiPassword}}. Questions? Call {{hostPhone}}`,
    variables: ['propertyName', 'accessCode', 'wifiNetwork', 'wifiPassword', 'hostPhone'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.CHECK_IN_INSTRUCTIONS,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sms_welcome',
    name: 'Welcome SMS',
    type: 'WELCOME',
    channel: 'SMS',
    body: `Welcome to {{propertyName}}! Hope you arrived safely. Need anything? Text/call {{hostPhone}}. Enjoy your stay! -{{hostName}}`,
    variables: ['propertyName', 'hostPhone', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.WELCOME,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sms_checkout_reminder',
    name: 'Checkout Reminder SMS',
    type: 'CHECKOUT_REMINDER',
    channel: 'SMS',
    body: `Reminder: Checkout is at 11AM today. Just close the door behind you. Thanks for staying! -Right at Home BnB`,
    variables: [],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.CHECKOUT_REMINDER,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sms_thanks',
    name: 'Thank You SMS',
    type: 'POST_CHECKOUT',
    channel: 'SMS',
    body: `Thanks for staying at {{propertyName}}! We'd love a review when you have a moment. Safe travels! -{{hostName}}`,
    variables: ['propertyName', 'hostName'],
    isActive: true,
    sendTiming: MESSAGE_TIMINGS.POST_CHECKOUT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Message templates manager
 */
export class MessageTemplatesManager {
  private templates: Map<string, MessageTemplate>;

  constructor() {
    this.templates = new Map();
    this.loadDefaults();
  }

  /**
   * Load default templates
   */
  private loadDefaults(): void {
    for (const template of [...EMAIL_TEMPLATES, ...SMS_TEMPLATES]) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): MessageTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: MessageType): MessageTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.type === type);
  }

  /**
   * Get templates by channel
   */
  getTemplatesByChannel(channel: MessageChannel): MessageTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.channel === channel);
  }

  /**
   * Get active templates for a message type and channel
   */
  getActiveTemplate(type: MessageType, channel: MessageChannel): MessageTemplate | undefined {
    return Array.from(this.templates.values()).find(
      (t) => t.type === type && t.channel === channel && t.isActive
    );
  }

  /**
   * Add custom template
   */
  addTemplate(template: MessageTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Update template
   */
  updateTemplate(id: string, updates: Partial<MessageTemplate>): boolean {
    const existing = this.templates.get(id);
    if (!existing) return false;

    this.templates.set(id, {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    });
    return true;
  }

  /**
   * Delete template
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): MessageTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get default timing for message type
   */
  getDefaultTiming(type: MessageType): MessageTiming {
    return MESSAGE_TIMINGS[type];
  }

  /**
   * Validate template variables
   */
  validateTemplate(template: MessageTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for undefined variables in body
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = variablePattern.exec(template.body)) !== null) {
      if (!template.variables.includes(match[1])) {
        errors.push(`Variable {{${match[1]}}} not declared in variables array`);
      }
    }

    // Check subject for email templates
    if (template.channel === 'EMAIL' && !template.subject) {
      errors.push('Email templates require a subject');
    }

    // Check SMS length
    if (template.channel === 'SMS' && template.body.length > 320) {
      errors.push('SMS template exceeds 320 characters (may split into multiple messages)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export templates as JSON
   */
  exportTemplates(): string {
    return JSON.stringify(Array.from(this.templates.values()), null, 2);
  }

  /**
   * Import templates from JSON
   */
  importTemplates(json: string): number {
    const templates = JSON.parse(json) as MessageTemplate[];
    let imported = 0;

    for (const template of templates) {
      template.createdAt = new Date(template.createdAt);
      template.updatedAt = new Date(template.updatedAt);
      this.templates.set(template.id, template);
      imported++;
    }

    return imported;
  }
}

export const messageTemplatesManager = new MessageTemplatesManager();
