/**
 * Right at Home BnB - Message Scheduler
 * Schedule and manage automated message delivery
 */

import type {
  ScheduledMessage,
  MessageTemplate,
  MessageContext,
  MessageType,
  MessageChannel,
  MessageStatus,
  MessagingConfig,
  MessageScheduleOptions,
  AutomationRule,
  SendResult,
} from './types';
import { MessageTemplatesManager, messageTemplatesManager } from './message-templates';
import { MessagePersonalizer, messagePersonalizer } from './personalization';

/**
 * Default messaging configuration
 */
const DEFAULT_CONFIG: MessagingConfig = {
  defaultTimezone: 'America/Chicago',
  defaultChannel: 'EMAIL',
  retryAttempts: 3,
  retryDelayMinutes: 30,
  quietHoursStart: 21,
  quietHoursEnd: 8,
  emailFromAddress: 'hello@rightathomebnb.com',
  emailFromName: 'Right at Home BnB',
  smsFromNumber: undefined,
};

/**
 * Message Scheduler
 */
export class MessageScheduler {
  private config: MessagingConfig;
  private templatesManager: MessageTemplatesManager;
  private personalizer: MessagePersonalizer;
  private scheduledMessages: Map<string, ScheduledMessage>;
  private automationRules: Map<string, AutomationRule>;

  constructor(
    config?: Partial<MessagingConfig>,
    templatesManager?: MessageTemplatesManager,
    personalizer?: MessagePersonalizer
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.templatesManager = templatesManager || messageTemplatesManager;
    this.personalizer = personalizer || messagePersonalizer;
    this.scheduledMessages = new Map();
    this.automationRules = new Map();
    this.initializeDefaultAutomations();
  }

  /**
   * Initialize default automation rules
   */
  private initializeDefaultAutomations(): void {
    const defaultRules: AutomationRule[] = [
      {
        id: 'auto_booking_confirmed',
        name: 'Booking Confirmation',
        trigger: { type: 'booking_created' },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_booking_confirmed', channel: 'EMAIL' },
          { type: 'send_message', templateId: 'sms_booking_confirmed', channel: 'SMS' },
        ],
        isActive: true,
        priority: 100,
      },
      {
        id: 'auto_pre_arrival',
        name: 'Pre-Arrival Reminder',
        trigger: { type: 'checkin_date', offsetDays: -3 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_pre_arrival', channel: 'EMAIL' },
        ],
        isActive: true,
        priority: 90,
      },
      {
        id: 'auto_checkin_instructions',
        name: 'Check-in Instructions',
        trigger: { type: 'checkin_date', offsetDays: -1 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_checkin_instructions', channel: 'EMAIL' },
          { type: 'send_message', templateId: 'sms_checkin_code', channel: 'SMS' },
        ],
        isActive: true,
        priority: 100,
      },
      {
        id: 'auto_welcome',
        name: 'Welcome Message',
        trigger: { type: 'checkin_date', offsetHours: 3 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_welcome', channel: 'EMAIL' },
          { type: 'send_message', templateId: 'sms_welcome', channel: 'SMS' },
        ],
        isActive: true,
        priority: 80,
      },
      {
        id: 'auto_pre_checkout',
        name: 'Pre-Checkout Reminder',
        trigger: { type: 'checkout_date', offsetDays: -1 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_pre_checkout', channel: 'EMAIL' },
        ],
        isActive: true,
        priority: 90,
      },
      {
        id: 'auto_checkout_reminder',
        name: 'Checkout Day Reminder',
        trigger: { type: 'checkout_date', offsetHours: -3 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'sms_checkout_reminder', channel: 'SMS' },
        ],
        isActive: true,
        priority: 95,
      },
      {
        id: 'auto_post_checkout',
        name: 'Thank You Message',
        trigger: { type: 'checkout_date', offsetHours: 4 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_post_checkout', channel: 'EMAIL' },
          { type: 'send_message', templateId: 'sms_thanks', channel: 'SMS' },
        ],
        isActive: true,
        priority: 80,
      },
      {
        id: 'auto_review_request',
        name: 'Review Request',
        trigger: { type: 'checkout_date', offsetDays: 2 },
        conditions: [],
        actions: [
          { type: 'send_message', templateId: 'email_review_request', channel: 'EMAIL' },
        ],
        isActive: true,
        priority: 70,
      },
    ];

    for (const rule of defaultRules) {
      this.automationRules.set(rule.id, rule);
    }
  }

  /**
   * Schedule messages for a booking
   */
  scheduleBookingMessages(
    context: MessageContext,
    options: MessageScheduleOptions = {}
  ): ScheduledMessage[] {
    const scheduled: ScheduledMessage[] = [];

    // Get active automation rules sorted by priority
    const activeRules = Array.from(this.automationRules.values())
      .filter((r) => r.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of activeRules) {
      // Check conditions
      if (!this.evaluateConditions(rule.conditions, context)) {
        continue;
      }

      // Schedule messages for each action
      for (const action of rule.actions) {
        if (action.type !== 'send_message') continue;

        const template = this.templatesManager.getTemplate(action.templateId!);
        if (!template) continue;

        const channel = options.overrideChannel || action.channel || template.channel;

        // Skip if guest prefers not to receive this type
        if (context.guest.preferences?.unsubscribedTypes?.includes(template.type)) {
          continue;
        }

        // Skip if message already exists for this booking/template combination
        if (options.skipIfExists) {
          const existingKey = `${context.booking.id}_${template.id}`;
          if (this.scheduledMessages.has(existingKey)) {
            continue;
          }
        }

        // Calculate send time
        const sendTime = this.calculateSendTime(rule.trigger, context);
        if (!sendTime) continue;

        // Personalize message
        const personalized = this.personalizer.personalizeMessage(template, context);

        // Create scheduled message
        const message: ScheduledMessage = {
          id: this.generateMessageId(),
          templateId: template.id,
          bookingId: context.booking.id,
          guestId: context.guest.id,
          propertyId: context.property.id,
          channel,
          subject: personalized.subject,
          body: personalized.body,
          status: 'SCHEDULED',
          scheduledFor: sendTime,
          retryCount: 0,
          metadata: {
            ruleName: rule.name,
            templateName: template.name,
            ...options.customVariables,
          },
        };

        this.scheduledMessages.set(`${context.booking.id}_${template.id}`, message);
        scheduled.push(message);
      }
    }

    return scheduled;
  }

  /**
   * Evaluate automation conditions
   */
  private evaluateConditions(
    conditions: AutomationRule['conditions'],
    context: MessageContext
  ): boolean {
    for (const condition of conditions) {
      const value = this.getContextValue(condition.field, context);

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'not_equals':
          if (value === condition.value) return false;
          break;
        case 'contains':
          if (typeof value !== 'string' || !value.includes(String(condition.value))) return false;
          break;
        case 'greater_than':
          if (typeof value !== 'number' || value <= Number(condition.value)) return false;
          break;
        case 'less_than':
          if (typeof value !== 'number' || value >= Number(condition.value)) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Get value from context by field path
   */
  private getContextValue(field: string, context: MessageContext): unknown {
    const parts = field.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Calculate send time based on trigger
   */
  private calculateSendTime(
    trigger: AutomationRule['trigger'],
    context: MessageContext
  ): Date | null {
    let baseDate: Date;

    switch (trigger.type) {
      case 'booking_created':
        baseDate = new Date();
        break;
      case 'checkin_date':
        baseDate = new Date(context.booking.checkIn);
        break;
      case 'checkout_date':
        baseDate = new Date(context.booking.checkOut);
        break;
      default:
        return null;
    }

    // Apply offset
    if (trigger.offsetDays) {
      baseDate.setDate(baseDate.getDate() + trigger.offsetDays);
    }
    if (trigger.offsetHours) {
      baseDate.setHours(baseDate.getHours() + trigger.offsetHours);
    }

    // Respect quiet hours
    const adjustedTime = this.adjustForQuietHours(baseDate);

    return adjustedTime;
  }

  /**
   * Adjust send time to respect quiet hours
   */
  private adjustForQuietHours(date: Date): Date {
    const hour = date.getHours();

    if (hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd) {
      // Move to next morning
      const adjusted = new Date(date);
      if (hour >= this.config.quietHoursStart) {
        adjusted.setDate(adjusted.getDate() + 1);
      }
      adjusted.setHours(this.config.quietHoursEnd, 0, 0, 0);
      return adjusted;
    }

    return date;
  }

  /**
   * Get messages due for sending
   */
  getDueMessages(): ScheduledMessage[] {
    const now = new Date();
    return Array.from(this.scheduledMessages.values()).filter(
      (m) => m.status === 'SCHEDULED' && m.scheduledFor <= now
    );
  }

  /**
   * Get all scheduled messages for a booking
   */
  getBookingMessages(bookingId: string): ScheduledMessage[] {
    return Array.from(this.scheduledMessages.values()).filter(
      (m) => m.bookingId === bookingId
    );
  }

  /**
   * Cancel a scheduled message
   */
  cancelMessage(messageId: string): boolean {
    for (const [key, message] of this.scheduledMessages) {
      if (message.id === messageId && message.status === 'SCHEDULED') {
        message.status = 'CANCELLED';
        this.scheduledMessages.set(key, message);
        return true;
      }
    }
    return false;
  }

  /**
   * Cancel all messages for a booking
   */
  cancelBookingMessages(bookingId: string): number {
    let cancelled = 0;
    for (const [key, message] of this.scheduledMessages) {
      if (message.bookingId === bookingId && message.status === 'SCHEDULED') {
        message.status = 'CANCELLED';
        this.scheduledMessages.set(key, message);
        cancelled++;
      }
    }
    return cancelled;
  }

  /**
   * Reschedule a message
   */
  rescheduleMessage(messageId: string, newTime: Date): boolean {
    for (const [key, message] of this.scheduledMessages) {
      if (message.id === messageId && message.status === 'SCHEDULED') {
        message.scheduledFor = this.adjustForQuietHours(newTime);
        this.scheduledMessages.set(key, message);
        return true;
      }
    }
    return false;
  }

  /**
   * Mark message as sent
   */
  markSent(messageId: string, deliveryId?: string): void {
    for (const [key, message] of this.scheduledMessages) {
      if (message.id === messageId) {
        message.status = 'SENT';
        message.sentAt = new Date();
        if (deliveryId) {
          message.metadata = { ...message.metadata, deliveryId };
        }
        this.scheduledMessages.set(key, message);
        return;
      }
    }
  }

  /**
   * Mark message as delivered
   */
  markDelivered(messageId: string): void {
    for (const [key, message] of this.scheduledMessages) {
      if (message.id === messageId) {
        message.status = 'DELIVERED';
        message.deliveredAt = new Date();
        this.scheduledMessages.set(key, message);
        return;
      }
    }
  }

  /**
   * Mark message as failed
   */
  markFailed(messageId: string, reason: string): void {
    for (const [key, message] of this.scheduledMessages) {
      if (message.id === messageId) {
        message.retryCount++;

        if (message.retryCount >= this.config.retryAttempts) {
          message.status = 'FAILED';
          message.failureReason = reason;
        } else {
          // Reschedule for retry
          const retryTime = new Date();
          retryTime.setMinutes(retryTime.getMinutes() + this.config.retryDelayMinutes);
          message.scheduledFor = retryTime;
        }

        this.scheduledMessages.set(key, message);
        return;
      }
    }
  }

  /**
   * Send a single message immediately
   */
  async sendImmediately(
    template: MessageTemplate,
    context: MessageContext,
    channel?: MessageChannel
  ): Promise<SendResult> {
    const targetChannel = channel || template.channel;
    const personalized = this.personalizer.personalizeMessage(template, context);

    // In production, this would call the actual send service
    // For now, we simulate the send
    const result: SendResult = {
      success: true,
      messageId: this.generateMessageId(),
      channel: targetChannel,
      sentAt: new Date(),
    };

    return result;
  }

  /**
   * Schedule a custom message
   */
  scheduleCustomMessage(
    context: MessageContext,
    subject: string | undefined,
    body: string,
    channel: MessageChannel,
    sendAt: Date
  ): ScheduledMessage {
    const message: ScheduledMessage = {
      id: this.generateMessageId(),
      templateId: 'custom',
      bookingId: context.booking.id,
      guestId: context.guest.id,
      propertyId: context.property.id,
      channel,
      subject,
      body,
      status: 'SCHEDULED',
      scheduledFor: this.adjustForQuietHours(sendAt),
      retryCount: 0,
    };

    this.scheduledMessages.set(message.id, message);
    return message;
  }

  /**
   * Get message statistics
   */
  getStatistics(): {
    total: number;
    scheduled: number;
    sent: number;
    delivered: number;
    failed: number;
    cancelled: number;
  } {
    const messages = Array.from(this.scheduledMessages.values());

    return {
      total: messages.length,
      scheduled: messages.filter((m) => m.status === 'SCHEDULED').length,
      sent: messages.filter((m) => m.status === 'SENT').length,
      delivered: messages.filter((m) => m.status === 'DELIVERED').length,
      failed: messages.filter((m) => m.status === 'FAILED').length,
      cancelled: messages.filter((m) => m.status === 'CANCELLED').length,
    };
  }

  /**
   * Add automation rule
   */
  addAutomationRule(rule: AutomationRule): void {
    this.automationRules.set(rule.id, rule);
  }

  /**
   * Remove automation rule
   */
  removeAutomationRule(ruleId: string): boolean {
    return this.automationRules.delete(ruleId);
  }

  /**
   * Toggle automation rule
   */
  toggleAutomationRule(ruleId: string, isActive: boolean): boolean {
    const rule = this.automationRules.get(ruleId);
    if (rule) {
      rule.isActive = isActive;
      this.automationRules.set(ruleId, rule);
      return true;
    }
    return false;
  }

  /**
   * Get all automation rules
   */
  getAutomationRules(): AutomationRule[] {
    return Array.from(this.automationRules.values());
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MessagingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear old messages (cleanup)
   */
  clearOldMessages(olderThanDays: number = 90): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let cleared = 0;
    for (const [key, message] of this.scheduledMessages) {
      if (
        message.scheduledFor < cutoff &&
        (message.status === 'DELIVERED' || message.status === 'FAILED' || message.status === 'CANCELLED')
      ) {
        this.scheduledMessages.delete(key);
        cleared++;
      }
    }

    return cleared;
  }
}

export const messageScheduler = new MessageScheduler();
