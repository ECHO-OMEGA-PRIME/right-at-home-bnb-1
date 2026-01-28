/**
 * Right at Home BnB - Audit Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

describe('Audit Service', () => {
  let auditService: typeof import('@renderer/services/audit');

  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();

    // Dynamic import to get fresh instance
    auditService = await import('@renderer/services/audit');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Logging', () => {
    it('should log audit event with correct structure', () => {
      const event = auditService.logEvent({
        action: 'booking.create',
        resourceType: 'booking',
        resourceId: 'booking-123',
        userId: 'user-456',
        details: { guestName: 'John Doe' },
      });

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.action).toBe('booking.create');
      expect(event.resourceType).toBe('booking');
      expect(event.resourceId).toBe('booking-123');
    });

    it('should auto-generate timestamp', () => {
      const before = Date.now();

      const event = auditService.logEvent({
        action: 'test.action',
        resourceType: 'test',
        resourceId: 'test-123',
      });

      const after = Date.now();

      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after);
    });

    it('should generate unique event IDs', () => {
      const event1 = auditService.logEvent({
        action: 'test.action',
        resourceType: 'test',
        resourceId: 'test-1',
      });

      const event2 = auditService.logEvent({
        action: 'test.action',
        resourceType: 'test',
        resourceId: 'test-2',
      });

      expect(event1.id).not.toBe(event2.id);
    });

    it('should capture IP and user agent when available', () => {
      const event = auditService.logEvent({
        action: 'login.success',
        resourceType: 'session',
        resourceId: 'session-123',
        metadata: {
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      expect(event.metadata?.ipAddress).toBe('192.168.1.100');
      expect(event.metadata?.userAgent).toBeDefined();
    });
  });

  describe('Action Categories', () => {
    it('should categorize CRUD operations', () => {
      expect(auditService.getActionCategory('booking.create')).toBe('create');
      expect(auditService.getActionCategory('guest.read')).toBe('read');
      expect(auditService.getActionCategory('property.update')).toBe('update');
      expect(auditService.getActionCategory('expense.delete')).toBe('delete');
    });

    it('should categorize auth operations', () => {
      expect(auditService.getActionCategory('login.success')).toBe('auth');
      expect(auditService.getActionCategory('login.failed')).toBe('auth');
      expect(auditService.getActionCategory('logout')).toBe('auth');
      expect(auditService.getActionCategory('password.change')).toBe('auth');
    });

    it('should categorize system operations', () => {
      expect(auditService.getActionCategory('backup.create')).toBe('system');
      expect(auditService.getActionCategory('import.complete')).toBe('system');
      expect(auditService.getActionCategory('export.complete')).toBe('system');
    });
  });

  describe('Event Retrieval', () => {
    beforeEach(() => {
      // Create some test events
      auditService.logEvent({
        action: 'booking.create',
        resourceType: 'booking',
        resourceId: 'booking-1',
        userId: 'user-1',
      });

      auditService.logEvent({
        action: 'property.update',
        resourceType: 'property',
        resourceId: 'property-1',
        userId: 'user-1',
      });

      auditService.logEvent({
        action: 'login.success',
        resourceType: 'session',
        resourceId: 'session-1',
        userId: 'user-2',
      });
    });

    it('should retrieve all events', () => {
      const events = auditService.getEvents();

      expect(events.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter events by user', () => {
      const events = auditService.getEvents({ userId: 'user-1' });

      expect(events.every((e) => e.userId === 'user-1')).toBe(true);
    });

    it('should filter events by resource type', () => {
      const events = auditService.getEvents({ resourceType: 'booking' });

      expect(events.every((e) => e.resourceType === 'booking')).toBe(true);
    });

    it('should filter events by action', () => {
      const events = auditService.getEvents({ action: 'login.success' });

      expect(events.every((e) => e.action === 'login.success')).toBe(true);
    });

    it('should filter events by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const events = auditService.getEvents({
        startDate: yesterday,
        endDate: tomorrow,
      });

      expect(events.length).toBeGreaterThanOrEqual(3);
    });

    it('should limit returned events', () => {
      const events = auditService.getEvents({ limit: 2 });

      expect(events.length).toBe(2);
    });

    it('should sort events by timestamp descending', () => {
      const events = auditService.getEvents();

      for (let i = 1; i < events.length; i++) {
        expect(events[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i].timestamp.getTime()
        );
      }
    });
  });

  describe('Security Events', () => {
    it('should flag failed login attempts', () => {
      const event = auditService.logSecurityEvent({
        type: 'login.failed',
        userId: 'user-123',
        reason: 'Invalid password',
        attempts: 3,
      });

      expect(event.severity).toBe('warning');
      expect(event.details?.attempts).toBe(3);
    });

    it('should flag suspicious activity', () => {
      const event = auditService.logSecurityEvent({
        type: 'suspicious.activity',
        description: 'Multiple failed logins from different IPs',
        severity: 'high',
      });

      expect(event.severity).toBe('high');
    });

    it('should log account lockout', () => {
      const event = auditService.logSecurityEvent({
        type: 'account.locked',
        userId: 'user-123',
        reason: 'Too many failed attempts',
      });

      expect(event.action).toContain('locked');
    });
  });

  describe('Data Change Tracking', () => {
    it('should track field changes', () => {
      const changes = auditService.trackChanges(
        { price: 100, description: 'Old description' },
        { price: 150, description: 'New description' }
      );

      expect(changes).toHaveLength(2);
      expect(changes).toContainEqual({
        field: 'price',
        oldValue: 100,
        newValue: 150,
      });
    });

    it('should ignore unchanged fields', () => {
      const changes = auditService.trackChanges(
        { price: 100, name: 'Same Name' },
        { price: 150, name: 'Same Name' }
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('price');
    });

    it('should handle nested object changes', () => {
      const changes = auditService.trackChanges(
        { settings: { theme: 'light' } },
        { settings: { theme: 'dark' } }
      );

      expect(changes.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance & Retention', () => {
    it('should mark events for retention', () => {
      const event = auditService.logEvent({
        action: 'payment.process',
        resourceType: 'payment',
        resourceId: 'payment-123',
        retention: 'long-term',
      });

      expect(event.retention).toBe('long-term');
    });

    it('should identify events requiring long-term retention', () => {
      // Financial events should be retained long-term
      expect(auditService.requiresLongTermRetention('payment.process')).toBe(true);
      expect(auditService.requiresLongTermRetention('invoice.create')).toBe(true);
      expect(auditService.requiresLongTermRetention('refund.process')).toBe(true);

      // Regular events can be purged normally
      expect(auditService.requiresLongTermRetention('property.view')).toBe(false);
    });

    it('should generate compliance report', () => {
      const report = auditService.generateComplianceReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(report).toBeDefined();
      expect(report.totalEvents).toBeDefined();
      expect(report.byCategory).toBeDefined();
      expect(report.securityEvents).toBeDefined();
    });
  });

  describe('Export', () => {
    it('should export events to JSON', () => {
      auditService.logEvent({
        action: 'test.export',
        resourceType: 'test',
        resourceId: 'test-1',
      });

      const json = auditService.exportToJSON();

      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should export events to CSV', () => {
      auditService.logEvent({
        action: 'test.export',
        resourceType: 'test',
        resourceId: 'test-1',
      });

      const csv = auditService.exportToCSV();

      expect(csv).toBeDefined();
      expect(csv).toContain('action');
      expect(csv).toContain('test.export');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Create varied events for statistics
      for (let i = 0; i < 10; i++) {
        auditService.logEvent({
          action: 'booking.create',
          resourceType: 'booking',
          resourceId: `booking-${i}`,
          userId: `user-${i % 3}`,
        });
      }

      for (let i = 0; i < 5; i++) {
        auditService.logEvent({
          action: 'property.update',
          resourceType: 'property',
          resourceId: `property-${i}`,
          userId: 'user-1',
        });
      }
    });

    it('should calculate event statistics', () => {
      const stats = auditService.getStatistics();

      expect(stats.totalEvents).toBeGreaterThanOrEqual(15);
      expect(stats.byAction['booking.create']).toBe(10);
      expect(stats.byAction['property.update']).toBe(5);
    });

    it('should calculate events per user', () => {
      const stats = auditService.getStatistics();

      expect(stats.byUser['user-1']).toBeGreaterThan(0);
    });

    it('should calculate events per day', () => {
      const today = new Date().toISOString().split('T')[0];
      const stats = auditService.getStatistics();

      expect(stats.byDate[today]).toBeGreaterThan(0);
    });
  });
});
