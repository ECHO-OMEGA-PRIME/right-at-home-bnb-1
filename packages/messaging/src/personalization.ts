/**
 * Right at Home BnB - Message Personalization
 * Customize messages for guest history and preferences
 */

import type {
  Guest,
  Booking,
  Property,
  MessageContext,
  PersonalizationData,
  MessageTemplate,
} from './types';

/**
 * Personalization rules for different guest segments
 */
interface PersonalizationRule {
  name: string;
  condition: (context: MessageContext) => boolean;
  modifications: {
    prepend?: string;
    append?: string;
    replacements?: Record<string, string>;
    tone?: 'formal' | 'casual' | 'friendly';
  };
}

const PERSONALIZATION_RULES: PersonalizationRule[] = [
  {
    name: 'Return Guest Welcome',
    condition: (ctx) => ctx.guest.previousStays > 0,
    modifications: {
      prepend: 'Welcome back! ',
      tone: 'friendly',
    },
  },
  {
    name: 'VIP Guest Treatment',
    condition: (ctx) => ctx.guest.isVip,
    modifications: {
      prepend: 'As a valued VIP guest, ',
      append: '\n\nAs always, we\'re here to make your stay exceptional.',
      tone: 'formal',
    },
  },
  {
    name: 'First Time Guest',
    condition: (ctx) => ctx.guest.previousStays === 0,
    modifications: {
      append: '\n\nSince this is your first stay with us, don\'t hesitate to reach out with any questions!',
    },
  },
  {
    name: 'Long Stay Guest',
    condition: (ctx) => {
      const nights = Math.ceil(
        (ctx.booking.checkOut.getTime() - ctx.booking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      return nights >= 7;
    },
    modifications: {
      append: '\n\nFor longer stays like yours, we offer mid-week cleaning. Just let us know if you\'d like to schedule one!',
    },
  },
  {
    name: 'Business Traveler',
    condition: (ctx) => {
      const dayOfWeek = ctx.booking.checkIn.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 4;
    },
    modifications: {
      append: '\n\nNeed anything for work during your stay? We have a desk area with good WiFi.',
      tone: 'formal',
    },
  },
];

/**
 * Message Personalizer
 */
export class MessagePersonalizer {
  private rules: PersonalizationRule[];

  constructor(customRules?: PersonalizationRule[]) {
    this.rules = customRules || PERSONALIZATION_RULES;
  }

  /**
   * Build personalization data from context
   */
  buildPersonalizationData(context: MessageContext): PersonalizationData {
    const { guest, booking, property, accessCode, customData } = context;
    const nights = Math.ceil(
      (booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    const nameParts = guest.name.split(' ');
    const firstName = nameParts[0];

    return {
      guestFirstName: firstName,
      guestFullName: guest.name,
      propertyName: property.name,
      propertyAddress: property.address,
      checkInDate: this.formatDate(booking.checkIn),
      checkInTime: '3:00 PM',
      checkOutDate: this.formatDate(booking.checkOut),
      checkOutTime: '11:00 AM',
      nights,
      guestCount: booking.guestCount,
      wifiNetwork: property.wifiNetwork || 'See property guide',
      wifiPassword: property.wifiPassword || 'See property guide',
      accessCode: accessCode || booking.accessCode || 'Will be sent separately',
      parkingInfo: property.parkingInfo || 'Driveway parking available',
      hostName: property.hostName,
      hostPhone: property.hostPhone,
      confirmCode: booking.confirmCode || booking.id.slice(-8).toUpperCase(),
      specialRequests: booking.specialRequests || 'None',
      previousStays: guest.previousStays,
      amenitiesList: property.amenities.join(', ') || 'Standard amenities',
      ...customData,
    };
  }

  /**
   * Format date for messages
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Apply variable substitution to a message
   */
  substituteVariables(template: string, data: PersonalizationData): string {
    let result = template;

    // Replace all {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    result = result.replace(variablePattern, (match, variable) => {
      const value = data[variable as keyof PersonalizationData];
      if (value !== undefined) {
        return String(value);
      }
      return match;
    });

    return result;
  }

  /**
   * Personalize a message based on context
   */
  personalizeMessage(
    template: MessageTemplate,
    context: MessageContext
  ): { subject?: string; body: string } {
    const data = this.buildPersonalizationData(context);

    // Start with variable substitution
    let body = this.substituteVariables(template.body, data);
    let subject = template.subject ? this.substituteVariables(template.subject, data) : undefined;

    // Apply personalization rules
    const applicableRules = this.rules.filter((rule) => rule.condition(context));

    for (const rule of applicableRules) {
      if (rule.modifications.prepend) {
        body = rule.modifications.prepend + body;
      }
      if (rule.modifications.append) {
        body = body + rule.modifications.append;
      }
      if (rule.modifications.replacements) {
        for (const [search, replace] of Object.entries(rule.modifications.replacements)) {
          body = body.replace(new RegExp(search, 'g'), replace);
        }
      }
    }

    return { subject, body };
  }

  /**
   * Get personalization suggestions for a guest
   */
  getPersonalizationSuggestions(context: MessageContext): string[] {
    const suggestions: string[] = [];

    if (context.guest.previousStays > 2) {
      suggestions.push('Consider offering a loyalty discount');
    }

    if (context.guest.isVip) {
      suggestions.push('Consider a personal welcome gift or early check-in');
    }

    if (context.guest.birthday && this.isDateUpcoming(context.guest.birthday, 30)) {
      suggestions.push('Guest has a birthday coming up!');
    }

    if (context.guest.anniversary && this.isDateUpcoming(context.guest.anniversary, 30)) {
      suggestions.push('Guest has an anniversary coming up!');
    }

    const nights = Math.ceil(
      (context.booking.checkOut.getTime() - context.booking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (nights >= 14) {
      suggestions.push('Long stay - consider weekly cleaning service');
    }

    return suggestions;
  }

  /**
   * Check if a date is upcoming within X days
   */
  private isDateUpcoming(date: Date, withinDays: number): boolean {
    const now = new Date();
    const checkDate = new Date(date);
    checkDate.setFullYear(now.getFullYear());

    // Handle year rollover
    if (checkDate < now) {
      checkDate.setFullYear(now.getFullYear() + 1);
    }

    const diffDays = Math.ceil((checkDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= withinDays;
  }

  /**
   * Generate personalized greeting based on time of day
   */
  getTimeBasedGreeting(timezone?: string): string {
    const now = new Date();

    // Simple timezone handling
    let hour = now.getHours();
    if (timezone) {
      try {
        const localTime = new Date(
          now.toLocaleString('en-US', { timeZone: timezone })
        );
        hour = localTime.getHours();
      } catch {
        // Use default if timezone invalid
      }
    }

    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Adapt message tone based on context
   */
  adaptTone(
    message: string,
    tone: 'formal' | 'casual' | 'friendly'
  ): string {
    switch (tone) {
      case 'formal':
        return message
          .replace(/Hey|Hi there|Hiya/gi, 'Hello')
          .replace(/Thanks!|Thanks/gi, 'Thank you')
          .replace(/Cheers|See ya|Later/gi, 'Best regards');

      case 'casual':
        return message
          .replace(/Dear /gi, 'Hi ')
          .replace(/Best regards|Sincerely|Warm regards/gi, 'Cheers')
          .replace(/We would like to/gi, "We'd like to");

      case 'friendly':
        return message
          .replace(/Hello/gi, 'Hey there')
          .replace(/Dear /gi, '')
          .replace(/Best regards|Sincerely/gi, 'See you soon');

      default:
        return message;
    }
  }

  /**
   * Add seasonal touches to messages
   */
  addSeasonalTouches(message: string, date: Date): string {
    const month = date.getMonth();

    // Add seasonal references based on month
    const seasonalAdditions: Record<number, string> = {
      11: '\n\nHappy Holidays! ', // December
      0: '\n\nHappy New Year! ', // January
      6: '\n\nHope you\'re enjoying the summer! ', // July
      10: '\n\nHappy Thanksgiving season! ', // November
    };

    if (seasonalAdditions[month]) {
      return message + seasonalAdditions[month];
    }

    return message;
  }

  /**
   * Create a preview of personalized message
   */
  previewMessage(
    template: MessageTemplate,
    context: MessageContext
  ): {
    subject?: string;
    body: string;
    appliedRules: string[];
    suggestions: string[];
  } {
    const { subject, body } = this.personalizeMessage(template, context);
    const appliedRules = this.rules
      .filter((rule) => rule.condition(context))
      .map((rule) => rule.name);
    const suggestions = this.getPersonalizationSuggestions(context);

    return {
      subject,
      body,
      appliedRules,
      suggestions,
    };
  }

  /**
   * Add custom personalization rule
   */
  addRule(rule: PersonalizationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove personalization rule by name
   */
  removeRule(name: string): boolean {
    const index = this.rules.findIndex((r) => r.name === name);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): PersonalizationRule[] {
    return [...this.rules];
  }
}

export const messagePersonalizer = new MessagePersonalizer();
