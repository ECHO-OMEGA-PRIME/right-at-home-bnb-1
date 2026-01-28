/**
 * Right at Home BnB - Guest Communication Templates
 * Pre-built message templates with variable substitution
 */

import type { Booking, Property, Guest, SmartLock, AccessCode } from '@shared/types';
import { format, parseISO, differenceInDays, addHours } from 'date-fns';

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory =
  | 'booking_confirmation'
  | 'pre_arrival'
  | 'check_in'
  | 'during_stay'
  | 'check_out'
  | 'post_stay'
  | 'review_request'
  | 'cleaning'
  | 'maintenance'
  | 'general';

export interface TemplateContext {
  guest?: Guest;
  property?: Property;
  booking?: Booking;
  lock?: SmartLock;
  accessCode?: AccessCode;
  ownerName?: string;
  customFields?: Record<string, string>;
}

// Default templates for Right at Home BnB
const DEFAULT_TEMPLATES: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Booking Confirmation',
    category: 'booking_confirmation',
    subject: 'Booking Confirmed - {{property.name}} | Right at Home BnB',
    body: `Hi {{guest.firstName}},

Thank you for booking with Right at Home BnB! We're excited to host you.

**Booking Details:**
- Property: {{property.name}}
- Address: {{property.address}}, {{property.city}}, {{property.state}}
- Check-in: {{booking.checkIn}} (3:00 PM)
- Check-out: {{booking.checkOut}} (11:00 AM)
- Guests: {{booking.guests}}
- Total: ${{booking.totalPrice}}

We'll send you check-in instructions closer to your arrival date.

If you have any questions, please don't hesitate to reach out!

Best regards,
{{owner.name}}
Right at Home BnB

Gig 'Em Aggies! 👍`,
    variables: ['guest.firstName', 'property.name', 'property.address', 'property.city', 'property.state', 'booking.checkIn', 'booking.checkOut', 'booking.guests', 'booking.totalPrice', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Pre-Arrival Instructions',
    category: 'pre_arrival',
    subject: 'Check-in Instructions - {{property.name}} | Right at Home BnB',
    body: `Hi {{guest.firstName}},

Your stay at {{property.name}} is just around the corner! Here's everything you need to know.

**Check-in Information:**
📍 Address: {{property.address}}, {{property.city}}, {{property.state}} {{property.zipCode}}
📅 Check-in: {{booking.checkIn}} at 3:00 PM
🔑 Door Code: {{accessCode.code}}

**Getting There:**
- The property is located in the heart of {{property.city}}
- Parking is available on-site

**House Rules:**
- No smoking inside the property
- No parties or events
- Quiet hours: 10 PM - 8 AM
- Maximum {{property.maxGuests}} guests

**WiFi:**
- Network: RightAtHome-{{property.id}}
- Password: WelcomeHome2024

**Amenities:**
{{property.amenities}}

**Emergency Contact:**
Steven Palma: (432) 555-0000

We hope you have a wonderful stay!

Best regards,
{{owner.name}}
Right at Home BnB`,
    variables: ['guest.firstName', 'property.name', 'property.address', 'property.city', 'property.state', 'property.zipCode', 'property.maxGuests', 'property.amenities', 'property.id', 'booking.checkIn', 'accessCode.code', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Check-in Day',
    category: 'check_in',
    subject: 'Welcome to {{property.name}}! 🏠',
    body: `Hi {{guest.firstName}},

Today's the day! Welcome to {{property.name}}.

Your check-in time is 3:00 PM. The door code is: **{{accessCode.code}}**

If you arrive early, you're welcome to leave your luggage in the lockbox near the front door.

A few reminders:
- WiFi password is on the fridge
- Thermostat instructions are in the house manual
- Local restaurant recommendations are in the welcome book

Need anything? Just text me!

Enjoy your stay!
{{owner.name}}`,
    variables: ['guest.firstName', 'property.name', 'accessCode.code', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Mid-Stay Check-in',
    category: 'during_stay',
    subject: 'How\'s your stay going? | Right at Home BnB',
    body: `Hi {{guest.firstName}},

Hope you're enjoying your stay at {{property.name}}!

Just checking in to make sure everything is going smoothly. Is there anything you need or any way I can make your stay better?

If you're looking for local recommendations:
🍽️ Restaurants: The Garlic Press, Cork & Pig
☕ Coffee: Elegante Coffee
🎯 Activities: I-20 Wildlife Preserve, Museum of the Southwest

Let me know if you need anything!

Best,
{{owner.name}}`,
    variables: ['guest.firstName', 'property.name', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Check-out Reminder',
    category: 'check_out',
    subject: 'Check-out Tomorrow - {{property.name}}',
    body: `Hi {{guest.firstName}},

Your checkout at {{property.name}} is tomorrow at 11:00 AM.

**Check-out Checklist:**
- [ ] Take out any trash to the bins outside
- [ ] Load and start the dishwasher
- [ ] Leave towels in the bathroom
- [ ] Turn off all lights and fans
- [ ] Lock all doors and windows
- [ ] Return all keys/remotes to where you found them

That's it! You don't need to strip the beds or do any deep cleaning.

Safe travels home, and thank you for staying with Right at Home BnB!

Best regards,
{{owner.name}}`,
    variables: ['guest.firstName', 'property.name', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Thank You + Review Request',
    category: 'review_request',
    subject: 'Thanks for staying! | Right at Home BnB',
    body: `Hi {{guest.firstName}},

Thank you so much for staying at {{property.name}}! It was a pleasure hosting you.

If you enjoyed your stay, I would really appreciate if you could leave a review. It helps other travelers find us and helps us continue to improve.

{{#if booking.source == 'airbnb'}}
Leave a review on Airbnb: [Your Airbnb Review Link]
{{/if}}

We'd love to host you again! As a returning guest, you'll get 10% off your next booking when you book direct.

Safe travels!

Best regards,
{{owner.name}}
Right at Home BnB

P.S. - Gig 'Em! 👍`,
    variables: ['guest.firstName', 'property.name', 'booking.source', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Cleaner Assignment',
    category: 'cleaning',
    subject: 'Cleaning Job Assigned - {{property.name}}',
    body: `Hi {{cleaner.name}},

A new cleaning job has been assigned to you:

**Property:** {{property.name}}
**Address:** {{property.address}}, {{property.city}}, {{property.state}}
**Date:** {{cleaning.date}}
**Time:** {{cleaning.time}}
**Type:** {{cleaning.type}}
**Duration:** {{cleaning.duration}} minutes

**Checklist:**
{{cleaning.checklist}}

**Access Code:** {{accessCode.code}}

Please confirm receipt of this message.

Thanks!
{{owner.name}}`,
    variables: ['cleaner.name', 'property.name', 'property.address', 'property.city', 'property.state', 'cleaning.date', 'cleaning.time', 'cleaning.type', 'cleaning.duration', 'cleaning.checklist', 'accessCode.code', 'owner.name'],
    isActive: true,
  },
  {
    name: 'Maintenance Alert',
    category: 'maintenance',
    subject: 'Maintenance Required - {{property.name}}',
    body: `Hi {{maintenance.contact}},

A maintenance issue has been reported at {{property.name}}:

**Property:** {{property.address}}, {{property.city}}, {{property.state}}
**Issue:** {{maintenance.issue}}
**Priority:** {{maintenance.priority}}
**Reported:** {{maintenance.reportedAt}}
**Guest Present:** {{maintenance.guestPresent}}

**Access Code:** {{accessCode.code}}

Please respond with your availability to address this issue.

Thanks,
{{owner.name}}`,
    variables: ['maintenance.contact', 'property.name', 'property.address', 'property.city', 'property.state', 'maintenance.issue', 'maintenance.priority', 'maintenance.reportedAt', 'maintenance.guestPresent', 'accessCode.code', 'owner.name'],
    isActive: true,
  },
];

class TemplateService {
  private templates: MessageTemplate[] = [];
  private ownerName: string = 'Steven Palma';

  constructor() {
    this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<MessageTemplate[]>('messageTemplates');
      if (stored && stored.length > 0) {
        this.templates = stored;
      } else {
        // Initialize with defaults
        this.templates = DEFAULT_TEMPLATES.map((t, index) => ({
          ...t,
          id: `template-${index + 1}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        await this.saveTemplates();
      }

      const ownerName = await window.electronAPI.store.get<string>('ownerName');
      if (ownerName) {
        this.ownerName = ownerName;
      }
    } catch (error) {
      console.error('[Templates] Failed to load templates:', error);
      // Use defaults
      this.templates = DEFAULT_TEMPLATES.map((t, index) => ({
        ...t,
        id: `template-${index + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
  }

  private async saveTemplates(): Promise<void> {
    await window.electronAPI.store.set('messageTemplates', this.templates);
  }

  getTemplates(category?: TemplateCategory): MessageTemplate[] {
    if (category) {
      return this.templates.filter((t) => t.category === category && t.isActive);
    }
    return this.templates.filter((t) => t.isActive);
  }

  getTemplate(id: string): MessageTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  async createTemplate(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> {
    const newTemplate: MessageTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.templates.push(newTemplate);
    await this.saveTemplates();
    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<MessageTemplate>): Promise<MessageTemplate | undefined> {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) return undefined;

    this.templates[index] = {
      ...this.templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveTemplates();
    return this.templates[index];
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const index = this.templates.findIndex((t) => t.id === id);
    if (index === -1) return false;

    this.templates.splice(index, 1);
    await this.saveTemplates();
    return true;
  }

  // Render template with context
  renderTemplate(template: MessageTemplate, context: TemplateContext): { subject: string; body: string } {
    const data = this.buildTemplateData(context);
    return {
      subject: this.replaceVariables(template.subject, data),
      body: this.replaceVariables(template.body, data),
    };
  }

  private buildTemplateData(context: TemplateContext): Record<string, unknown> {
    const data: Record<string, unknown> = {
      owner: {
        name: context.ownerName || this.ownerName,
      },
    };

    if (context.guest) {
      data.guest = {
        firstName: context.guest.firstName,
        lastName: context.guest.lastName,
        email: context.guest.email,
        phone: context.guest.phone,
        fullName: `${context.guest.firstName} ${context.guest.lastName}`,
      };
    }

    if (context.property) {
      data.property = {
        id: context.property.id,
        name: context.property.name,
        address: context.property.address,
        city: context.property.city,
        state: context.property.state,
        zipCode: context.property.zipCode,
        bedrooms: context.property.bedrooms,
        bathrooms: context.property.bathrooms,
        maxGuests: context.property.maxGuests,
        amenities: context.property.amenities.join(', '),
      };
    }

    if (context.booking) {
      data.booking = {
        id: context.booking.id,
        checkIn: format(parseISO(context.booking.checkIn), 'EEEE, MMMM d, yyyy'),
        checkOut: format(parseISO(context.booking.checkOut), 'EEEE, MMMM d, yyyy'),
        guests: context.booking.guests,
        totalPrice: context.booking.totalPrice.toFixed(2),
        nights: differenceInDays(parseISO(context.booking.checkOut), parseISO(context.booking.checkIn)),
        source: context.booking.source,
      };
    }

    if (context.lock) {
      data.lock = {
        name: context.lock.name,
        status: context.lock.status,
        battery: context.lock.batteryLevel,
      };
    }

    if (context.accessCode) {
      data.accessCode = {
        code: context.accessCode.code,
        name: context.accessCode.name,
        type: context.accessCode.type,
      };
    }

    if (context.customFields) {
      Object.entries(context.customFields).forEach(([key, value]) => {
        data[key] = value;
      });
    }

    return data;
  }

  private replaceVariables(text: string, data: Record<string, unknown>): string {
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  // Get suggested template based on booking state
  getSuggestedTemplate(context: TemplateContext): MessageTemplate | undefined {
    if (!context.booking) return undefined;

    const now = new Date();
    const checkIn = parseISO(context.booking.checkIn);
    const checkOut = parseISO(context.booking.checkOut);
    const daysUntilCheckIn = differenceInDays(checkIn, now);
    const daysUntilCheckOut = differenceInDays(checkOut, now);

    // Just booked
    if (context.booking.status === 'pending') {
      return this.templates.find((t) => t.category === 'booking_confirmation');
    }

    // 2-3 days before check-in
    if (daysUntilCheckIn >= 1 && daysUntilCheckIn <= 3) {
      return this.templates.find((t) => t.category === 'pre_arrival');
    }

    // Day of check-in
    if (daysUntilCheckIn === 0) {
      return this.templates.find((t) => t.category === 'check_in');
    }

    // During stay (2nd night)
    if (daysUntilCheckIn < 0 && daysUntilCheckOut > 1) {
      return this.templates.find((t) => t.category === 'during_stay');
    }

    // Day before checkout
    if (daysUntilCheckOut === 1) {
      return this.templates.find((t) => t.category === 'check_out');
    }

    // After checkout
    if (daysUntilCheckOut < 0 && daysUntilCheckOut >= -2) {
      return this.templates.find((t) => t.category === 'review_request');
    }

    return undefined;
  }

  // Copy to clipboard
  async copyToClipboard(text: string): Promise<void> {
    await window.electronAPI.clipboard.write(text);
  }

  // Send via email
  async sendViaEmail(email: string, subject: string, body: string): Promise<void> {
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await window.electronAPI.shell.openExternal(mailtoUrl);
  }

  // Send via SMS (opens default SMS app on mobile or web-based SMS)
  async sendViaSMS(phone: string, body: string): Promise<void> {
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(body)}`;
    await window.electronAPI.shell.openExternal(smsUrl);
  }

  // Reset to default templates
  async resetToDefaults(): Promise<void> {
    this.templates = DEFAULT_TEMPLATES.map((t, index) => ({
      ...t,
      id: `template-${index + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await this.saveTemplates();
  }
}

export const templateService = new TemplateService();
