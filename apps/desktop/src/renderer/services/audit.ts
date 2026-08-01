/**
 * Right at Home BnB - Audit Logging Service
 * Comprehensive audit trail for security and compliance
 */

import { encryptionService } from './encryption';

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.session_refresh'
  | 'auth.session_expired'
  | 'auth.password_change'
  | 'auth.failed_login'
  | 'data.create'
  | 'data.read'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'data.import'
  | 'booking.create'
  | 'booking.update'
  | 'booking.cancel'
  | 'booking.complete'
  | 'payment.received'
  | 'payment.refund'
  | 'payment.failed'
  | 'invoice.generate'
  | 'invoice.send'
  | 'guest.create'
  | 'guest.update'
  | 'guest.delete'
  | 'property.create'
  | 'property.update'
  | 'property.delete'
  | 'cleaning.schedule'
  | 'cleaning.complete'
  | 'cleaning.cancel'
  | 'settings.update'
  | 'security.credential_access'
  | 'security.encryption_operation'
  | 'security.permission_denied'
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  | 'sync.start'
  | 'sync.complete'
  | 'sync.error';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  maxEntries: number;
  encryptSensitive: boolean;
  autoExport: boolean;
  exportPath?: string;
  sensitiveFields: string[];
}

export interface AuditStats {
  totalEntries: number;
  entriesByType: Record<string, number>;
  entriesBySeverity: Record<AuditSeverity, number>;
  failedOperations24h: number;
  securityEvents24h: number;
  oldestEntry?: string;
  newestEntry?: string;
}

class AuditService {
  private config: AuditConfig = {
    enabled: true,
    retentionDays: 90,
    maxEntries: 100000,
    encryptSensitive: true,
    autoExport: false,
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'email',
      'phone',
    ],
  };

  private entries: AuditEntry[] = [];
  private pendingEntries: AuditEntry[] = [];
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadConfig();
    this.loadEntries();
    this.startRetentionCleanup();
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<AuditConfig>('auditConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      console.error('[Audit] Failed to load config:', error);
    }
  }

  private async loadEntries(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<AuditEntry[]>('auditLog');
      if (stored) {
        this.entries = stored;
      }
    } catch (error) {
      console.error('[Audit] Failed to load entries:', error);
    }
  }

  private async saveEntries(): Promise<void> {
    try {
      // Trim entries if necessary
      while (this.entries.length > this.config.maxEntries) {
        this.entries.shift();
      }
      await window.electronAPI.store.set('auditLog', this.entries);
    } catch (error) {
      console.error('[Audit] Failed to save entries:', error);
    }
  }

  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveEntries();
    }, 2000);
  }

  private startRetentionCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldEntries();
    }, 60 * 60 * 1000);

    // Run initial cleanup
    this.cleanupOldEntries();
  }

  private cleanupOldEntries(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const originalLength = this.entries.length;
    this.entries = this.entries.filter(
      (entry) => new Date(entry.timestamp) >= cutoffDate
    );

    if (this.entries.length < originalLength) {
      console.log(
        `[Audit] Cleaned up ${originalLength - this.entries.length} old entries`
      );
      this.saveEntries();
    }
  }

  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details || !this.config.encryptSensitive) {
      return details;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.config.sensitiveFields.some((field) =>
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive && typeof value === 'string') {
        // Mask sensitive values
        sanitized[key] = value.substring(0, 2) + '***' + value.substring(value.length - 2);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private getSeverity(eventType: AuditEventType): AuditSeverity {
    const criticalEvents: AuditEventType[] = [
      'auth.failed_login',
      'security.permission_denied',
      'security.credential_access',
      'payment.failed',
      'system.error',
    ];

    const warningEvents: AuditEventType[] = [
      'auth.session_expired',
      'data.delete',
      'guest.delete',
      'property.delete',
      'booking.cancel',
      'payment.refund',
      'sync.error',
    ];

    if (criticalEvents.includes(eventType)) {
      return 'critical';
    }
    if (warningEvents.includes(eventType)) {
      return 'warning';
    }
    return 'info';
  }

  // Main logging method
  async log(
    eventType: AuditEventType,
    action: string,
    options: {
      resourceType?: string;
      resourceId?: string;
      details?: Record<string, unknown>;
      success?: boolean;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
      severity?: AuditSeverity;
    } = {}
  ): Promise<AuditEntry> {
    if (!this.config.enabled) {
      return {} as AuditEntry;
    }

    const session = encryptionService.getSession();

    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      severity: options.severity || this.getSeverity(eventType),
      userId: session?.userId,
      sessionId: session?.id,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      action,
      details: this.sanitizeDetails(options.details),
      userAgent: navigator.userAgent,
      success: options.success !== false,
      errorMessage: options.errorMessage,
      metadata: options.metadata,
    };

    this.entries.push(entry);
    this.debouncedSave();

    // Log critical events to console immediately
    if (entry.severity === 'critical') {
      console.warn('[Audit][CRITICAL]', entry.eventType, entry.action, entry.errorMessage);
    }

    return entry;
  }

  // Convenience methods for common events
  async logAuth(
    action: 'login' | 'logout' | 'session_refresh' | 'session_expired' | 'password_change' | 'failed_login',
    details?: Record<string, unknown>,
    success: boolean = true
  ): Promise<AuditEntry> {
    return this.log(`auth.${action}` as AuditEventType, `User ${action}`, {
      details,
      success,
    });
  }

  async logDataAccess(
    operation: 'create' | 'read' | 'update' | 'delete' | 'export' | 'import',
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ): Promise<AuditEntry> {
    return this.log(`data.${operation}` as AuditEventType, `${operation} ${resourceType}`, {
      resourceType,
      resourceId,
      details,
    });
  }

  async logBooking(
    action: 'create' | 'update' | 'cancel' | 'complete',
    bookingId: string,
    details?: Record<string, unknown>
  ): Promise<AuditEntry> {
    return this.log(`booking.${action}` as AuditEventType, `Booking ${action}`, {
      resourceType: 'booking',
      resourceId: bookingId,
      details,
    });
  }

  async logPayment(
    action: 'received' | 'refund' | 'failed',
    amount: number,
    details?: Record<string, unknown>
  ): Promise<AuditEntry> {
    return this.log(`payment.${action}` as AuditEventType, `Payment ${action}: $${amount}`, {
      resourceType: 'payment',
      details: { amount, ...details },
      success: action !== 'failed',
    });
  }

  async logSecurity(
    action: 'credential_access' | 'encryption_operation' | 'permission_denied',
    details?: Record<string, unknown>,
    success: boolean = true
  ): Promise<AuditEntry> {
    return this.log(`security.${action}` as AuditEventType, `Security: ${action}`, {
      details,
      success,
      severity: 'critical',
    });
  }

  async logSystem(
    action: 'startup' | 'shutdown' | 'error',
    details?: Record<string, unknown>
  ): Promise<AuditEntry> {
    return this.log(`system.${action}` as AuditEventType, `System ${action}`, {
      details,
      success: action !== 'error',
    });
  }

  async logSync(
    action: 'start' | 'complete' | 'error',
    service: string,
    details?: Record<string, unknown>
  ): Promise<AuditEntry> {
    return this.log(`sync.${action}` as AuditEventType, `Sync ${action}: ${service}`, {
      resourceType: 'sync',
      details: { service, ...details },
      success: action !== 'error',
    });
  }

  // Query methods
  getEntries(options?: {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    successOnly?: boolean;
    failuresOnly?: boolean;
    limit?: number;
  }): AuditEntry[] {
    let filtered = [...this.entries];

    if (options?.eventType) {
      filtered = filtered.filter((e) => e.eventType === options.eventType);
    }

    if (options?.severity) {
      filtered = filtered.filter((e) => e.severity === options.severity);
    }

    if (options?.userId) {
      filtered = filtered.filter((e) => e.userId === options.userId);
    }

    if (options?.resourceType) {
      filtered = filtered.filter((e) => e.resourceType === options.resourceType);
    }

    if (options?.resourceId) {
      filtered = filtered.filter((e) => e.resourceId === options.resourceId);
    }

    if (options?.startDate) {
      filtered = filtered.filter((e) => new Date(e.timestamp) >= options.startDate!);
    }

    if (options?.endDate) {
      filtered = filtered.filter((e) => new Date(e.timestamp) <= options.endDate!);
    }

    if (options?.successOnly) {
      filtered = filtered.filter((e) => e.success);
    }

    if (options?.failuresOnly) {
      filtered = filtered.filter((e) => !e.success);
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getStats(): AuditStats {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const entriesByType: Record<string, number> = {};
    const entriesBySeverity: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0,
    };
    let failedOperations24h = 0;
    let securityEvents24h = 0;

    this.entries.forEach((entry) => {
      entriesByType[entry.eventType] = (entriesByType[entry.eventType] || 0) + 1;
      entriesBySeverity[entry.severity]++;

      const entryDate = new Date(entry.timestamp);
      if (entryDate >= yesterday) {
        if (!entry.success) {
          failedOperations24h++;
        }
        if (entry.eventType.startsWith('security.')) {
          securityEvents24h++;
        }
      }
    });

    const timestamps = this.entries.map((e) => e.timestamp);

    return {
      totalEntries: this.entries.length,
      entriesByType,
      entriesBySeverity,
      failedOperations24h,
      securityEvents24h,
      oldestEntry: timestamps.length > 0 ? timestamps[0] : undefined,
      newestEntry: timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined,
    };
  }

  // Export functionality
  async exportAuditLog(
    format: 'json' | 'csv' = 'json',
    options?: {
      startDate?: Date;
      endDate?: Date;
      eventTypes?: AuditEventType[];
    }
  ): Promise<{ success: boolean; path?: string }> {
    let entries = this.entries;

    if (options?.startDate) {
      entries = entries.filter((e) => new Date(e.timestamp) >= options.startDate!);
    }

    if (options?.endDate) {
      entries = entries.filter((e) => new Date(e.timestamp) <= options.endDate!);
    }

    if (options?.eventTypes) {
      entries = entries.filter((e) => options.eventTypes!.includes(e.eventType));
    }

    const result = await window.electronAPI.dialog.showSaveDialog({
      title: 'Export Audit Log',
      defaultPath: `rightathome-audit-${new Date().toISOString().split('T')[0]}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    let content: string;

    if (format === 'json') {
      content = JSON.stringify(entries, null, 2);
    } else {
      // CSV format
      const headers = [
        'id',
        'timestamp',
        'eventType',
        'severity',
        'userId',
        'sessionId',
        'resourceType',
        'resourceId',
        'action',
        'success',
        'errorMessage',
      ];
      const rows = entries.map((entry) =>
        [
          entry.id,
          entry.timestamp,
          entry.eventType,
          entry.severity,
          entry.userId || '',
          entry.sessionId || '',
          entry.resourceType || '',
          entry.resourceId || '',
          `"${entry.action.replace(/"/g, '""')}"`,
          entry.success,
          entry.errorMessage || '',
        ].join(',')
      );
      content = [headers.join(','), ...rows].join('\n');
    }

    const writeResult = await window.electronAPI.file.write(result.filePath, content);
    return { success: writeResult.success, path: result.filePath };
  }

  // Configuration
  setConfig(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config };
    window.electronAPI.store.set('auditConfig', this.config);
  }

  getConfig(): AuditConfig {
    return { ...this.config };
  }

  // Clear audit log (requires confirmation)
  async clearAuditLog(beforeDate?: Date): Promise<void> {
    const originalLength = this.entries.length;

    if (beforeDate) {
      this.entries = this.entries.filter((e) => new Date(e.timestamp) >= beforeDate);
    } else {
      this.entries = [];
    }

    await this.saveEntries();

    // Log the clear action itself
    await this.log('data.delete', 'Audit log cleared', {
      details: {
        entriesRemoved: originalLength - this.entries.length,
        beforeDate: beforeDate?.toISOString(),
      },
      severity: 'warning',
    });
  }
}

export const auditService = new AuditService();

// Convenience exports
export const auditLog = auditService.log.bind(auditService);
export const auditAuth = auditService.logAuth.bind(auditService);
export const auditData = auditService.logDataAccess.bind(auditService);
export const auditBooking = auditService.logBooking.bind(auditService);
export const auditPayment = auditService.logPayment.bind(auditService);
export const auditSecurity = auditService.logSecurity.bind(auditService);
export const auditSystem = auditService.logSystem.bind(auditService);

// Legacy functional facade retained for desktop integrations and deterministic tests.
export type LegacyAuditSeverity = 'info' | 'warning' | 'high' | 'critical';
export type LegacyAuditRetention = 'standard' | 'long-term';

export interface LegacyAuditEvent {
  id: string;
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId: string;
  userId?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  severity: LegacyAuditSeverity;
  retention: LegacyAuditRetention;
}

export interface LegacyAuditEventInput {
  action: string;
  resourceType: string;
  resourceId: string;
  userId?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  severity?: LegacyAuditSeverity;
  retention?: LegacyAuditRetention;
}

export interface LegacyAuditFilter {
  userId?: string;
  resourceType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

const legacyEvents: LegacyAuditEvent[] = [];

function legacySeverityForAction(action: string): LegacyAuditSeverity {
  if (action === 'login.failed') return 'warning';
  if (action.includes('locked') || action.includes('suspicious')) return 'high';
  if (action.includes('permission_denied') || action.includes('breach')) return 'critical';
  return 'info';
}

function compatibilityEventType(action: string): AuditEventType {
  const directMappings: Record<string, AuditEventType> = {
    'login.success': 'auth.login',
    'login.failed': 'auth.failed_login',
    logout: 'auth.logout',
    'password.change': 'auth.password_change',
    'booking.create': 'booking.create',
    'booking.update': 'booking.update',
    'booking.cancel': 'booking.cancel',
    'property.update': 'property.update',
    'payment.process': 'payment.received',
    'refund.process': 'payment.refund',
    'invoice.create': 'invoice.generate',
  };
  if (directMappings[action]) return directMappings[action];
  if (action.endsWith('.create')) return 'data.create';
  if (action.endsWith('.read') || action.endsWith('.view')) return 'data.read';
  if (action.endsWith('.update')) return 'data.update';
  if (action.endsWith('.delete')) return 'data.delete';
  if (action.includes('export')) return 'data.export';
  if (action.includes('import')) return 'data.import';
  return 'data.read';
}

export function logEvent(input: LegacyAuditEventInput): LegacyAuditEvent {
  const event: LegacyAuditEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    userId: input.userId,
    details: input.details,
    metadata: input.metadata,
    severity: input.severity ?? legacySeverityForAction(input.action),
    retention:
      input.retention ??
      (requiresLongTermRetention(input.action) ? 'long-term' : 'standard'),
  };
  legacyEvents.push(event);

  // Mirror the compatibility event into the durable audit service without blocking callers.
  void auditService.log(compatibilityEventType(input.action), input.action, {
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    details: input.details,
    metadata: input.metadata,
    severity:
      event.severity === 'high'
        ? 'warning'
        : event.severity,
  });

  return event;
}

export function getActionCategory(
  action: string
): 'create' | 'read' | 'update' | 'delete' | 'auth' | 'system' | 'other' {
  const operation = action.split('.').at(-1);
  if (
    action.startsWith('backup.') ||
    action.startsWith('import.') ||
    action.startsWith('export.') ||
    action.startsWith('system.')
  ) {
    return 'system';
  }
  if (operation === 'create') return 'create';
  if (operation === 'read' || operation === 'view') return 'read';
  if (operation === 'update') return 'update';
  if (operation === 'delete') return 'delete';
  if (
    action === 'logout' ||
    action.startsWith('login.') ||
    action.startsWith('password.') ||
    action.startsWith('auth.')
  ) {
    return 'auth';
  }
  return 'other';
}

export function getEvents(filter: LegacyAuditFilter = {}): LegacyAuditEvent[] {
  let events = [...legacyEvents];
  if (filter.userId) events = events.filter((event) => event.userId === filter.userId);
  if (filter.resourceType) {
    events = events.filter((event) => event.resourceType === filter.resourceType);
  }
  if (filter.action) events = events.filter((event) => event.action === filter.action);
  if (filter.startDate) {
    events = events.filter((event) => event.timestamp >= filter.startDate!);
  }
  if (filter.endDate) {
    events = events.filter((event) => event.timestamp <= filter.endDate!);
  }
  events.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
  return filter.limit ? events.slice(0, filter.limit) : events;
}

export function logSecurityEvent(input: {
  type: string;
  userId?: string;
  reason?: string;
  description?: string;
  attempts?: number;
  severity?: LegacyAuditSeverity;
}): LegacyAuditEvent {
  return logEvent({
    action: input.type,
    resourceType: 'security',
    resourceId: input.userId ?? crypto.randomUUID(),
    userId: input.userId,
    severity: input.severity ?? legacySeverityForAction(input.type),
    details: {
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.attempts !== undefined ? { attempts: input.attempts } : {}),
    },
  });
}

export interface AuditFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export function trackChanges(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): AuditFieldChange[] {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changes: AuditFieldChange[] = [];
  for (const field of keys) {
    const oldValue = previous[field];
    const newValue = next[field];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field, oldValue, newValue });
    }
  }
  return changes;
}

export function requiresLongTermRetention(action: string): boolean {
  return /(^|\.)(payment|invoice|refund)(\.|$)/.test(action) ||
    action.startsWith('payment.') ||
    action.startsWith('invoice.') ||
    action.startsWith('refund.');
}

export function generateComplianceReport(range: {
  startDate: Date;
  endDate: Date;
}) {
  const events = getEvents(range);
  const byCategory: Record<string, number> = {};
  for (const event of events) {
    const category = getActionCategory(event.action);
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    totalEvents: events.length,
    byCategory,
    securityEvents: events.filter(
      (event) => event.resourceType === 'security' || event.action.includes('security')
    ),
    longTermRetentionEvents: events.filter(
      (event) => event.retention === 'long-term'
    ).length,
  };
}

export function exportToJSON(filter: LegacyAuditFilter = {}): string {
  return JSON.stringify(getEvents(filter), null, 2);
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportToCSV(filter: LegacyAuditFilter = {}): string {
  const headers = [
    'id',
    'timestamp',
    'action',
    'resourceType',
    'resourceId',
    'userId',
    'severity',
    'retention',
  ];
  const rows = getEvents(filter).map((event) =>
    [
      event.id,
      event.timestamp.toISOString(),
      event.action,
      event.resourceType,
      event.resourceId,
      event.userId ?? '',
      event.severity,
      event.retention,
    ]
      .map(csvCell)
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function getStatistics(filter: LegacyAuditFilter = {}) {
  const events = getEvents(filter);
  const byAction: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const byDate: Record<string, number> = {};

  for (const event of events) {
    byAction[event.action] = (byAction[event.action] ?? 0) + 1;
    if (event.userId) byUser[event.userId] = (byUser[event.userId] ?? 0) + 1;
    const date = event.timestamp.toISOString().split('T')[0];
    byDate[date] = (byDate[date] ?? 0) + 1;
  }

  return {
    totalEvents: events.length,
    byAction,
    byUser,
    byDate,
  };
}
