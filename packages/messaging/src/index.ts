/**
 * Right at Home BnB - Automated Messaging Package
 * Export all messaging functionality
 */

export {
  MessageTemplatesManager,
  messageTemplatesManager,
  EMAIL_TEMPLATES,
  SMS_TEMPLATES,
} from './message-templates';

export {
  MessageScheduler,
  messageScheduler,
} from './scheduler';

export {
  MessagePersonalizer,
  messagePersonalizer,
} from './personalization';

export type {
  MessageType,
  MessageChannel,
  MessageStatus,
  MessageTemplate,
  MessageTiming,
  ScheduledMessage,
  Guest,
  Booking,
  Property,
  MessageContext,
  PersonalizationData,
  SendResult,
  MessagingConfig,
  MessageScheduleOptions,
  AutomationRule,
  AutomationTrigger,
  AutomationCondition,
  AutomationAction,
  MessageAnalytics,
  MessagePerformance,
  GuestPreferences,
} from './types';
