/**
 * Right at Home BnB - Messaging Types
 * Type definitions for automated messaging system
 */

export type MessageType =
  | 'BOOKING_CONFIRMED'
  | 'PRE_ARRIVAL'
  | 'CHECK_IN_INSTRUCTIONS'
  | 'WELCOME'
  | 'MID_STAY'
  | 'PRE_CHECKOUT'
  | 'CHECKOUT_REMINDER'
  | 'POST_CHECKOUT'
  | 'REVIEW_REQUEST'
  | 'CUSTOM'
  | 'MAINTENANCE_UPDATE'
  | 'SPECIAL_OFFER'
  | 'BIRTHDAY'
  | 'ANNIVERSARY'
  | 'RETURN_GUEST';

export type MessageChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'AIRBNB' | 'VRBO' | 'PUSH';

export type MessageStatus = 'DRAFT' | 'SCHEDULED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export interface MessageTemplate {
  id: string;
  name: string;
  type: MessageType;
  channel: MessageChannel;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  sendTiming?: MessageTiming;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageTiming {
  triggerType: 'relative' | 'absolute' | 'manual';
  relativeTo?: 'checkIn' | 'checkOut' | 'booking' | 'now';
  offsetDays?: number;
  offsetHours?: number;
  absoluteTime?: string;
  preferredHour?: number;
  timezone?: string;
  daysOfWeek?: number[];
}

export interface ScheduledMessage {
  id: string;
  templateId: string;
  bookingId: string;
  guestId: string;
  propertyId: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
  status: MessageStatus;
  scheduledFor: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferredChannel?: MessageChannel;
  timezone?: string;
  language?: string;
  previousStays: number;
  isVip: boolean;
  birthday?: Date;
  anniversary?: Date;
  preferences?: GuestPreferences;
}

export interface GuestPreferences {
  doNotDisturb?: boolean;
  preferredContactTime?: 'morning' | 'afternoon' | 'evening';
  unsubscribedTypes?: MessageType[];
}

export interface Booking {
  id: string;
  propertyId: string;
  guestId: string;
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  platform: 'AIRBNB' | 'VRBO' | 'DIRECT' | 'OTHER';
  confirmCode?: string;
  accessCode?: string;
  specialRequests?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  wifiNetwork?: string;
  wifiPassword?: string;
  checkInInstructions?: string;
  checkOutInstructions?: string;
  parkingInfo?: string;
  houseRules?: string;
  amenities: string[];
  hostName: string;
  hostPhone: string;
}

export interface MessageContext {
  guest: Guest;
  booking: Booking;
  property: Property;
  accessCode?: string;
  customData?: Record<string, string>;
}

export interface PersonalizationData {
  guestFirstName: string;
  guestFullName: string;
  propertyName: string;
  propertyAddress: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  nights: number;
  guestCount: number;
  wifiNetwork: string;
  wifiPassword: string;
  accessCode: string;
  parkingInfo: string;
  hostName: string;
  hostPhone: string;
  confirmCode: string;
  specialRequests: string;
  previousStays: number;
  amenitiesList: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  deliveryId?: string;
  channel: MessageChannel;
  sentAt?: Date;
  error?: string;
}

export interface MessagingConfig {
  defaultTimezone: string;
  defaultChannel: MessageChannel;
  retryAttempts: number;
  retryDelayMinutes: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  emailFromAddress: string;
  emailFromName: string;
  smsFromNumber?: string;
}

export interface MessageScheduleOptions {
  overrideChannel?: MessageChannel;
  skipIfExists?: boolean;
  customVariables?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  priority: number;
}

export interface AutomationTrigger {
  type: 'booking_created' | 'booking_modified' | 'checkin_date' | 'checkout_date' | 'schedule';
  offsetDays?: number;
  offsetHours?: number;
  scheduleExpression?: string;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: string | number | string[];
}

export interface AutomationAction {
  type: 'send_message' | 'update_status' | 'notify_host' | 'create_task';
  templateId?: string;
  channel?: MessageChannel;
  data?: Record<string, unknown>;
}

export interface MessageAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  failed: number;
  unsubscribed: number;
}

export interface MessagePerformance {
  templateId: string;
  templateName: string;
  channel: MessageChannel;
  sent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  responseRate: number;
}
