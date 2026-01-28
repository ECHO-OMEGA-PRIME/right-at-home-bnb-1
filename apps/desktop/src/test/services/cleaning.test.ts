/**
 * Right at Home BnB - Cleaning Schedule Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

describe('Cleaning Schedule Service', () => {
  let cleaningService: typeof import('@renderer/services/cleaning');

  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();

    // Dynamic import to get fresh instance
    cleaningService = await import('@renderer/services/cleaning');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Job Creation', () => {
    it('should create cleaning job with correct defaults', () => {
      const job = cleaningService.createCleaningJob({
        propertyId: 'prop-123',
        propertyName: 'Sunset Villa',
        scheduledDate: new Date('2024-01-15'),
        type: 'checkout',
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.propertyId).toBe('prop-123');
      expect(job.type).toBe('checkout');
    });

    it('should auto-generate job from checkout booking', () => {
      const booking = {
        id: 'booking-123',
        propertyId: 'prop-123',
        propertyName: 'Beach House',
        checkOut: new Date('2024-01-15T11:00:00'),
        nextCheckIn: new Date('2024-01-15T15:00:00'),
      };

      const job = cleaningService.generateJobFromBooking(booking);

      expect(job.type).toBe('turnover');
      expect(job.propertyId).toBe('prop-123');
      expect(job.urgency).toBe('high'); // 4 hour window = urgent
    });

    it('should calculate urgency based on time window', () => {
      // Less than 4 hours = high urgency
      expect(cleaningService.calculateUrgency(3)).toBe('high');
      // 4-6 hours = medium urgency
      expect(cleaningService.calculateUrgency(5)).toBe('medium');
      // More than 6 hours = low urgency
      expect(cleaningService.calculateUrgency(8)).toBe('low');
    });
  });

  describe('Scheduling', () => {
    const mockCleaners = [
      { id: 'cleaner-1', name: 'Maria', available: true, avgTime: 90 },
      { id: 'cleaner-2', name: 'Carlos', available: true, avgTime: 75 },
      { id: 'cleaner-3', name: 'Ana', available: false, avgTime: 85 },
    ];

    it('should find available cleaners', () => {
      const available = cleaningService.getAvailableCleaners(
        mockCleaners,
        new Date('2024-01-15T10:00:00')
      );

      expect(available).toHaveLength(2);
      expect(available.map(c => c.name)).toContain('Maria');
      expect(available.map(c => c.name)).toContain('Carlos');
      expect(available.map(c => c.name)).not.toContain('Ana');
    });

    it('should auto-assign best cleaner', () => {
      const job = {
        id: 'job-123',
        propertyId: 'prop-123',
        scheduledDate: new Date('2024-01-15'),
        estimatedDuration: 90,
      };

      const assigned = cleaningService.autoAssignCleaner(job, mockCleaners);

      expect(assigned).toBeDefined();
      // Should assign Carlos (fastest average time)
      expect(assigned?.cleanerId).toBe('cleaner-2');
    });

    it('should respect cleaner availability windows', () => {
      const cleanerWithSchedule = {
        id: 'cleaner-1',
        name: 'Maria',
        schedule: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
      };

      // 10:00 should be available
      expect(
        cleaningService.isCleanerAvailable(
          cleanerWithSchedule,
          new Date('2024-01-15T10:00:00')
        )
      ).toBe(true);

      // 13:00 should not be available (lunch break)
      expect(
        cleaningService.isCleanerAvailable(
          cleanerWithSchedule,
          new Date('2024-01-15T13:00:00')
        )
      ).toBe(false);
    });
  });

  describe('Job Status Management', () => {
    it('should update job status', () => {
      const job = cleaningService.createCleaningJob({
        propertyId: 'prop-123',
        propertyName: 'Test Property',
        scheduledDate: new Date(),
        type: 'checkout',
      });

      expect(job.status).toBe('pending');

      cleaningService.updateJobStatus(job, 'in_progress');
      expect(job.status).toBe('in_progress');
      expect(job.startedAt).toBeDefined();

      cleaningService.updateJobStatus(job, 'completed');
      expect(job.status).toBe('completed');
      expect(job.completedAt).toBeDefined();
    });

    it('should calculate job duration when completed', () => {
      const job = cleaningService.createCleaningJob({
        propertyId: 'prop-123',
        propertyName: 'Test Property',
        scheduledDate: new Date(),
        type: 'checkout',
      });

      job.startedAt = new Date('2024-01-15T10:00:00');
      cleaningService.updateJobStatus(job, 'completed');
      job.completedAt = new Date('2024-01-15T11:30:00');

      const duration = cleaningService.calculateJobDuration(job);
      expect(duration).toBe(90); // 90 minutes
    });

    it('should track job issues', () => {
      const job = cleaningService.createCleaningJob({
        propertyId: 'prop-123',
        propertyName: 'Test Property',
        scheduledDate: new Date(),
        type: 'checkout',
      });

      cleaningService.addJobIssue(job, {
        type: 'damage',
        description: 'Stain on carpet in bedroom',
        severity: 'minor',
      });

      expect(job.issues).toHaveLength(1);
      expect(job.issues[0].type).toBe('damage');
    });
  });

  describe('Checklist Management', () => {
    it('should create checklist from template', () => {
      const template = cleaningService.getChecklistTemplate('checkout');

      expect(template).toBeDefined();
      expect(template.items).toBeDefined();
      expect(template.items.length).toBeGreaterThan(0);
    });

    it('should track checklist completion', () => {
      const checklist = cleaningService.createChecklist('checkout');

      expect(checklist.completedItems).toBe(0);
      expect(checklist.totalItems).toBeGreaterThan(0);

      cleaningService.markChecklistItem(checklist, 0, true);
      expect(checklist.completedItems).toBe(1);

      const progress = cleaningService.getChecklistProgress(checklist);
      expect(progress).toBeGreaterThan(0);
    });

    it('should validate all items completed before job completion', () => {
      const job = cleaningService.createCleaningJob({
        propertyId: 'prop-123',
        propertyName: 'Test Property',
        scheduledDate: new Date(),
        type: 'checkout',
      });

      job.checklist = cleaningService.createChecklist('checkout');

      // Should not allow completion with incomplete checklist
      const canComplete = cleaningService.canCompleteJob(job);
      expect(canComplete).toBe(false);

      // Mark all items complete
      job.checklist.items.forEach((_, index) => {
        cleaningService.markChecklistItem(job.checklist, index, true);
      });

      expect(cleaningService.canCompleteJob(job)).toBe(true);
    });
  });

  describe('Notifications', () => {
    it('should generate reminder notification', () => {
      const job = {
        id: 'job-123',
        propertyName: 'Beach House',
        scheduledDate: new Date('2024-01-15T14:00:00'),
        cleanerName: 'Maria',
      };

      const notification = cleaningService.generateReminderNotification(job);

      expect(notification.title).toContain('Cleaning Reminder');
      expect(notification.body).toContain('Beach House');
      expect(notification.body).toContain('Maria');
    });

    it('should schedule notifications for upcoming jobs', () => {
      const jobs = [
        {
          id: 'job-1',
          scheduledDate: new Date(Date.now() + 30 * 60 * 1000), // 30 mins from now
          propertyName: 'Property 1',
        },
        {
          id: 'job-2',
          scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          propertyName: 'Property 2',
        },
      ];

      const scheduledNotifications = cleaningService.scheduleNotifications(jobs);

      expect(scheduledNotifications).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should calculate cleaner statistics', () => {
      const completedJobs = [
        { cleanerId: 'cleaner-1', duration: 90, rating: 5 },
        { cleanerId: 'cleaner-1', duration: 85, rating: 4 },
        { cleanerId: 'cleaner-1', duration: 95, rating: 5 },
      ];

      const stats = cleaningService.calculateCleanerStats('cleaner-1', completedJobs);

      expect(stats.totalJobs).toBe(3);
      expect(stats.averageDuration).toBe(90);
      expect(stats.averageRating).toBeCloseTo(4.67, 1);
    });

    it('should generate daily summary', () => {
      const jobs = [
        { status: 'completed', propertyName: 'Prop 1' },
        { status: 'completed', propertyName: 'Prop 2' },
        { status: 'pending', propertyName: 'Prop 3' },
        { status: 'cancelled', propertyName: 'Prop 4' },
      ];

      const summary = cleaningService.generateDailySummary(jobs);

      expect(summary.completed).toBe(2);
      expect(summary.pending).toBe(1);
      expect(summary.cancelled).toBe(1);
      expect(summary.completionRate).toBe(0.5);
    });
  });
});
