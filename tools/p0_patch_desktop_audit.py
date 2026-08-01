from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src\renderer\services\audit.ts")
text = path.read_text(encoding="utf-8")
anchor = """export const auditSystem = auditService.logSystem.bind(auditService);
"""
addition = r'''export const auditSystem = auditService.logSystem.bind(auditService);

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
  if (
    action.startsWith('backup.') ||
    action.startsWith('import.') ||
    action.startsWith('export.') ||
    action.startsWith('system.')
  ) {
    return 'system';
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
'''

if anchor not in text:
    raise SystemExit("Audit export anchor not found")
path.write_text(text.replace(anchor, addition, 1), encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
