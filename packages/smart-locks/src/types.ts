/**
 * Right at Home BnB - Smart Lock Types
 * Type definitions for smart lock integration
 */

/**
 * Supported lock providers
 */
export type LockProvider = 'SCHLAGE' | 'AUGUST' | 'YALE' | 'KWIKSET' | 'GENERIC';

/**
 * Lock status
 */
export type LockStatus = 'LOCKED' | 'UNLOCKED' | 'JAMMED' | 'UNKNOWN' | 'OFFLINE';

/**
 * Access code status
 */
export type AccessCodeStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'REVOKED' | 'FAILED';

/**
 * Lock event types
 */
export type LockEventType =
  | 'LOCKED'
  | 'UNLOCKED'
  | 'LOCKED_MANUALLY'
  | 'UNLOCKED_MANUALLY'
  | 'CODE_ENTERED'
  | 'CODE_FAILED'
  | 'JAMMED'
  | 'BATTERY_LOW'
  | 'TAMPER_DETECTED'
  | 'OFFLINE'
  | 'ONLINE'
  | 'CODE_CREATED'
  | 'CODE_DELETED';

/**
 * Smart Lock Device
 */
export interface SmartLockDevice {
  id: string;
  propertyId: string;
  name: string;
  provider: LockProvider;
  deviceId: string;
  model?: string;
  firmwareVersion?: string;
  batteryLevel?: number;
  status: LockStatus;
  isOnline: boolean;
  lastSeen: Date;
  capabilities: LockCapabilities;
  metadata?: Record<string, unknown>;
}

/**
 * Lock capabilities
 */
export interface LockCapabilities {
  canLock: boolean;
  canUnlock: boolean;
  canCreateCodes: boolean;
  canDeleteCodes: boolean;
  canScheduleCodes: boolean;
  maxCodes: number;
  codeLength: { min: number; max: number };
  supportsBatteryReporting: boolean;
  supportsAutoLock: boolean;
  supportsHistory: boolean;
}

/**
 * Access Code
 */
export interface AccessCode {
  id: string;
  lockId: string;
  bookingId?: string;
  name: string;
  code: string;
  status: AccessCodeStatus;
  startTime: Date;
  endTime: Date;
  usageCount: number;
  maxUses?: number;
  createdAt: Date;
  lastUsed?: Date;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Access code creation request
 */
export interface CreateAccessCodeRequest {
  lockId: string;
  bookingId?: string;
  name: string;
  code?: string; // Optional - will generate if not provided
  startTime: Date;
  endTime: Date;
  maxUses?: number;
  guestName?: string;
  notify?: boolean;
}

/**
 * Lock event
 */
export interface LockEvent {
  id: string;
  lockId: string;
  type: LockEventType;
  timestamp: Date;
  codeId?: string;
  codeName?: string;
  userId?: string;
  source: 'CODE' | 'MANUAL' | 'AUTO' | 'REMOTE' | 'SYSTEM';
  details?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Lock operation result
 */
export interface LockOperationResult {
  success: boolean;
  lockId: string;
  operation: 'LOCK' | 'UNLOCK' | 'CREATE_CODE' | 'DELETE_CODE' | 'UPDATE_CODE';
  timestamp: Date;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Provider credentials
 */
export interface ProviderCredentials {
  provider: LockProvider;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId?: string;
  webhookSecret?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: LockProvider;
  credentials: ProviderCredentials;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  webhookUrl?: string;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  provider: LockProvider;
  eventType: LockEventType;
  deviceId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  signature?: string;
}

/**
 * Lock provider interface
 */
export interface ILockProvider {
  provider: LockProvider;

  // Device operations
  listDevices(): Promise<SmartLockDevice[]>;
  getDevice(deviceId: string): Promise<SmartLockDevice | null>;
  lock(deviceId: string): Promise<LockOperationResult>;
  unlock(deviceId: string): Promise<LockOperationResult>;
  getStatus(deviceId: string): Promise<LockStatus>;
  getBatteryLevel(deviceId: string): Promise<number | null>;

  // Access code operations
  listAccessCodes(deviceId: string): Promise<AccessCode[]>;
  createAccessCode(request: CreateAccessCodeRequest): Promise<AccessCode>;
  updateAccessCode(codeId: string, updates: Partial<AccessCode>): Promise<AccessCode>;
  deleteAccessCode(codeId: string): Promise<boolean>;

  // Event operations
  getHistory(deviceId: string, since?: Date): Promise<LockEvent[]>;

  // Webhook handling
  handleWebhook(event: WebhookEvent): Promise<void>;
}

/**
 * Booking information for code generation
 */
export interface BookingInfo {
  id: string;
  propertyId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
  confirmationCode?: string;
}

/**
 * Code generation options
 */
export interface CodeGenerationOptions {
  length?: number;
  allowedChars?: string;
  prefix?: string;
  avoidSimilar?: boolean;
  avoidSequential?: boolean;
  checkExisting?: boolean;
}

/**
 * Lock manager configuration
 */
export interface LockManagerConfig {
  providers: ProviderConfig[];
  defaultCodeLength: number;
  codeStartOffsetMinutes: number;
  codeEndOffsetMinutes: number;
  autoExpireCodes: boolean;
  notifyOnCodeCreate: boolean;
  notifyOnCodeExpire: boolean;
  webhookBaseUrl?: string;
}

/**
 * Code notification
 */
export interface CodeNotification {
  type: 'CODE_CREATED' | 'CODE_EXPIRING' | 'CODE_EXPIRED' | 'CODE_FAILED';
  bookingId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  propertyName: string;
  code?: string;
  validFrom?: Date;
  validUntil?: Date;
  message?: string;
}

/**
 * Lock health status
 */
export interface LockHealthStatus {
  lockId: string;
  name: string;
  provider: LockProvider;
  isOnline: boolean;
  batteryLevel: number | null;
  batteryStatus: 'GOOD' | 'LOW' | 'CRITICAL' | 'UNKNOWN';
  lastSeen: Date;
  status: LockStatus;
  activeCodesCount: number;
  recentIssues: string[];
}

/**
 * Property lock summary
 */
export interface PropertyLockSummary {
  propertyId: string;
  propertyName: string;
  locks: LockHealthStatus[];
  totalLocks: number;
  onlineLocks: number;
  offlineLocks: number;
  lowBatteryLocks: number;
  issues: string[];
}
