/**
 * Right at Home BnB - Cleaning Schedule Management Service
 * Automated scheduling, assignment, and tracking
 */

import type { CleaningJob, Cleaner, Property, Booking, CleaningChecklistItem } from '@shared/types';
import { format, parseISO, addHours, differenceInMinutes, isToday, isTomorrow, addDays } from 'date-fns';

export interface CleaningConfig {
  defaultDuration: Record<string, number>; // by property size (bedrooms)
  turnoverBuffer: number; // hours between checkout and next checkin
  autoSchedule: boolean;
  defaultChecklistTemplate: string;
  notifyCleanerHoursBefore: number;
  requirePhotoVerification: boolean;
  trackSupplyLevels: boolean;
}

export interface CleaningChecklist {
  id: string;
  name: string;
  propertyType: string;
  items: CleaningChecklistItem[];
  estimatedMinutes: number;
}

export interface CleanerAvailability {
  cleanerId: string;
  date: string;
  slots: TimeSlot[];
}

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  jobId?: string;
}

export interface SupplyItem {
  id: string;
  name: string;
  category: 'toiletries' | 'cleaning' | 'linens' | 'kitchen' | 'amenities';
  unit: string;
  currentStock: number;
  reorderLevel: number;
  costPerUnit: number;
}

// Default cleaning checklists
const DEFAULT_CHECKLISTS: Omit<CleaningChecklist, 'id'>[] = [
  {
    name: 'Standard Turnover',
    propertyType: 'all',
    estimatedMinutes: 120,
    items: [
      { id: '1', task: 'Strip beds and collect dirty linens', completed: false },
      { id: '2', task: 'Start laundry (sheets, towels)', completed: false },
      { id: '3', task: 'Clean all bathrooms (toilets, showers, sinks)', completed: false },
      { id: '4', task: 'Clean mirrors and glass surfaces', completed: false },
      { id: '5', task: 'Empty all trash cans', completed: false },
      { id: '6', task: 'Vacuum all floors and rugs', completed: false },
      { id: '7', task: 'Mop hard floors', completed: false },
      { id: '8', task: 'Clean kitchen (counters, appliances, sink)', completed: false },
      { id: '9', task: 'Check and clean inside refrigerator', completed: false },
      { id: '10', task: 'Run dishwasher or hand wash dishes', completed: false },
      { id: '11', task: 'Make beds with fresh linens', completed: false },
      { id: '12', task: 'Set out fresh towels', completed: false },
      { id: '13', task: 'Restock toiletries (soap, shampoo, TP)', completed: false },
      { id: '14', task: 'Dust all surfaces and furniture', completed: false },
      { id: '15', task: 'Check all lights and replace bulbs if needed', completed: false },
      { id: '16', task: 'Reset thermostat to default', completed: false },
      { id: '17', task: 'Lock all windows and doors', completed: false },
      { id: '18', task: 'Take photos for verification', completed: false },
    ],
  },
  {
    name: 'Deep Clean',
    propertyType: 'all',
    estimatedMinutes: 240,
    items: [
      { id: '1', task: 'Standard turnover tasks', completed: false },
      { id: '2', task: 'Clean inside all cabinets', completed: false },
      { id: '3', task: 'Clean inside oven and microwave', completed: false },
      { id: '4', task: 'Clean behind and under furniture', completed: false },
      { id: '5', task: 'Wash windows (inside and out)', completed: false },
      { id: '6', task: 'Clean ceiling fans and light fixtures', completed: false },
      { id: '7', task: 'Shampoo carpets/rugs', completed: false },
      { id: '8', task: 'Clean all baseboards', completed: false },
      { id: '9', task: 'Sanitize all door handles and switches', completed: false },
      { id: '10', task: 'Check and clean HVAC filters', completed: false },
      { id: '11', task: 'Clean patio/balcony if applicable', completed: false },
      { id: '12', task: 'Inspect for maintenance issues', completed: false },
    ],
  },
  {
    name: 'Quick Inspection',
    propertyType: 'all',
    estimatedMinutes: 30,
    items: [
      { id: '1', task: 'Walk through all rooms', completed: false },
      { id: '2', task: 'Check for obvious damage', completed: false },
      { id: '3', task: 'Verify all appliances work', completed: false },
      { id: '4', task: 'Check smoke/CO detectors', completed: false },
      { id: '5', task: 'Verify WiFi is working', completed: false },
      { id: '6', task: 'Check smart lock battery level', completed: false },
      { id: '7', task: 'Note any issues for maintenance', completed: false },
    ],
  },
];

class CleaningService {
  private config: CleaningConfig = {
    defaultDuration: {
      '0': 60, // Studio
      '1': 90,
      '2': 120,
      '3': 150,
      '4': 180,
      '5': 210,
      '6': 240,
    },
    turnoverBuffer: 4, // 4 hours between checkout (11am) and checkin (3pm)
    autoSchedule: true,
    defaultChecklistTemplate: 'standard-turnover',
    notifyCleanerHoursBefore: 24,
    requirePhotoVerification: true,
    trackSupplyLevels: true,
  };

  private checklists: CleaningChecklist[] = [];
  private cleaners: Cleaner[] = [];

  constructor() {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      const [config, checklists, cleaners] = await Promise.all([
        window.electronAPI.store.get<CleaningConfig>('cleaningConfig'),
        window.electronAPI.store.get<CleaningChecklist[]>('cleaningChecklists'),
        window.electronAPI.store.get<Cleaner[]>('cleaners'),
      ]);

      if (config) this.config = { ...this.config, ...config };
      if (checklists && checklists.length > 0) {
        this.checklists = checklists;
      } else {
        this.checklists = DEFAULT_CHECKLISTS.map((c, i) => ({
          ...c,
          id: `checklist-${i + 1}`,
        }));
        await this.saveChecklists();
      }
      if (cleaners) this.cleaners = cleaners;
    } catch (error) {
      console.error('[Cleaning] Failed to load data:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    await window.electronAPI.store.set('cleaningConfig', this.config);
  }

  private async saveChecklists(): Promise<void> {
    await window.electronAPI.store.set('cleaningChecklists', this.checklists);
  }

  private async saveCleaners(): Promise<void> {
    await window.electronAPI.store.set('cleaners', this.cleaners);
  }

  getConfig(): CleaningConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<CleaningConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
  }

  // Cleaner management
  getCleaners(): Cleaner[] {
    return [...this.cleaners];
  }

  getCleaner(id: string): Cleaner | undefined {
    return this.cleaners.find((c) => c.id === id);
  }

  async addCleaner(cleaner: Omit<Cleaner, 'id' | 'createdAt'>): Promise<Cleaner> {
    const newCleaner: Cleaner = {
      ...cleaner,
      id: `cleaner-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.cleaners.push(newCleaner);
    await this.saveCleaners();
    return newCleaner;
  }

  async updateCleaner(id: string, updates: Partial<Cleaner>): Promise<Cleaner | undefined> {
    const index = this.cleaners.findIndex((c) => c.id === id);
    if (index === -1) return undefined;

    this.cleaners[index] = { ...this.cleaners[index], ...updates };
    await this.saveCleaners();
    return this.cleaners[index];
  }

  async removeCleaner(id: string): Promise<boolean> {
    const index = this.cleaners.findIndex((c) => c.id === id);
    if (index === -1) return false;

    this.cleaners.splice(index, 1);
    await this.saveCleaners();
    return true;
  }

  // Checklist management
  getChecklists(): CleaningChecklist[] {
    return [...this.checklists];
  }

  getChecklist(id: string): CleaningChecklist | undefined {
    return this.checklists.find((c) => c.id === id);
  }

  async createChecklist(checklist: Omit<CleaningChecklist, 'id'>): Promise<CleaningChecklist> {
    const newChecklist: CleaningChecklist = {
      ...checklist,
      id: `checklist-${Date.now()}`,
    };
    this.checklists.push(newChecklist);
    await this.saveChecklists();
    return newChecklist;
  }

  // Auto-schedule cleaning jobs from bookings
  generateCleaningSchedule(
    bookings: Booking[],
    properties: Property[],
    existingJobs: CleaningJob[]
  ): CleaningJob[] {
    const newJobs: CleaningJob[] = [];

    bookings
      .filter((b) => b.status === 'confirmed' || b.status === 'checked_in')
      .forEach((booking) => {
        const property = properties.find((p) => p.id === booking.propertyId);
        if (!property) return;

        // Check if a cleaning job already exists for this checkout
        const existingJob = existingJobs.find(
          (j) => j.bookingId === booking.id && j.type === 'turnover'
        );
        if (existingJob) return;

        const checkoutDate = parseISO(booking.checkOut);
        const checkoutTime = '11:00'; // Standard checkout time
        const cleaningTime = '14:00'; // After checkout, before next checkin

        const duration = this.config.defaultDuration[String(property.bedrooms)] || 120;

        const job: CleaningJob = {
          id: `job-${Date.now()}-${booking.id}`,
          propertyId: property.id,
          bookingId: booking.id,
          scheduledDate: format(checkoutDate, 'yyyy-MM-dd'),
          scheduledTime: cleaningTime,
          duration,
          status: 'scheduled',
          type: 'turnover',
          checklist: this.getDefaultChecklist(property),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        newJobs.push(job);
      });

    return newJobs;
  }

  private getDefaultChecklist(property: Property): CleaningChecklistItem[] {
    const standardChecklist = this.checklists.find((c) => c.name === 'Standard Turnover');
    if (standardChecklist) {
      return standardChecklist.items.map((item) => ({
        ...item,
        id: `${item.id}-${Date.now()}`,
        completed: false,
      }));
    }

    // Fallback to basic checklist
    return [
      { id: '1', task: 'Clean and prepare property', completed: false },
      { id: '2', task: 'Restock supplies', completed: false },
      { id: '3', task: 'Take verification photos', completed: false },
    ];
  }

  // Smart cleaner assignment
  assignCleaner(
    job: CleaningJob,
    cleanerAvailability: CleanerAvailability[],
    properties: Property[]
  ): { cleanerId: string; confidence: number } | null {
    const property = properties.find((p) => p.id === job.propertyId);
    if (!property) return null;

    // Find cleaners assigned to this property
    const assignedCleaners = this.cleaners.filter(
      (c) => c.status === 'active' && c.assignedProperties.includes(job.propertyId)
    );

    if (assignedCleaners.length === 0) {
      // Fall back to any active cleaner
      const activeCleaners = this.cleaners.filter((c) => c.status === 'active');
      if (activeCleaners.length === 0) return null;
      return {
        cleanerId: activeCleaners[0].id,
        confidence: 50,
      };
    }

    // Check availability for each assigned cleaner
    for (const cleaner of assignedCleaners) {
      const availability = cleanerAvailability.find((a) => a.cleanerId === cleaner.id);
      if (!availability) continue;

      const slot = availability.slots.find(
        (s) => s.available && s.start <= job.scheduledTime && s.end >= job.scheduledTime
      );

      if (slot) {
        return {
          cleanerId: cleaner.id,
          confidence: 90,
        };
      }
    }

    // No available assigned cleaner, use first assigned
    return {
      cleanerId: assignedCleaners[0].id,
      confidence: 60,
    };
  }

  // Get today's and upcoming cleaning jobs
  getUpcomingJobs(jobs: CleaningJob[], days: number = 7): CleaningJob[] {
    const now = new Date();
    const cutoffDate = addDays(now, days);

    return jobs
      .filter((job) => {
        const jobDate = parseISO(job.scheduledDate);
        return jobDate >= now && jobDate <= cutoffDate && job.status !== 'cancelled';
      })
      .sort((a, b) => {
        const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
        if (dateCompare !== 0) return dateCompare;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });
  }

  getTodaysJobs(jobs: CleaningJob[]): CleaningJob[] {
    return jobs.filter((job) => {
      const jobDate = parseISO(job.scheduledDate);
      return isToday(jobDate) && job.status !== 'cancelled';
    });
  }

  // Update job status
  async updateJobStatus(
    job: CleaningJob,
    status: CleaningJob['status'],
    updates?: Partial<CleaningJob>
  ): Promise<CleaningJob> {
    const updated: CleaningJob = {
      ...job,
      ...updates,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'completed' && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }

    return updated;
  }

  // Track checklist progress
  updateChecklistItem(
    job: CleaningJob,
    itemId: string,
    completed: boolean,
    notes?: string
  ): CleaningJob {
    const checklist = job.checklist.map((item) => {
      if (item.id === itemId) {
        return { ...item, completed, notes };
      }
      return item;
    });

    return {
      ...job,
      checklist,
      updatedAt: new Date().toISOString(),
    };
  }

  // Calculate cleaning metrics
  calculateMetrics(jobs: CleaningJob[]): CleaningMetrics {
    const completedJobs = jobs.filter((j) => j.status === 'completed');
    const scheduledJobs = jobs.filter((j) => j.status === 'scheduled');
    const issueJobs = jobs.filter((j) => j.status === 'issue');

    const avgDuration =
      completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => sum + j.duration, 0) / completedJobs.length
        : 0;

    const onTimeCount = completedJobs.filter((j) => {
      if (!j.completedAt) return false;
      const scheduled = new Date(`${j.scheduledDate}T${j.scheduledTime}`);
      const completed = parseISO(j.completedAt);
      return differenceInMinutes(completed, scheduled) <= j.duration + 30; // 30 min grace period
    }).length;

    return {
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
      scheduledJobs: scheduledJobs.length,
      issueJobs: issueJobs.length,
      avgDurationMinutes: Math.round(avgDuration),
      onTimePercentage: completedJobs.length > 0 ? (onTimeCount / completedJobs.length) * 100 : 0,
      todaysJobs: this.getTodaysJobs(jobs).length,
    };
  }

  // Send cleaner notification
  async notifyCleaner(job: CleaningJob, property: Property): Promise<void> {
    const cleaner = job.cleanerId ? this.getCleaner(job.cleanerId) : null;
    if (!cleaner) return;

    const message = `
Cleaning Job Reminder:

Property: ${property.name}
Address: ${property.address}, ${property.city}
Date: ${format(parseISO(job.scheduledDate), 'EEEE, MMMM d')}
Time: ${job.scheduledTime}
Type: ${job.type}
Duration: ${job.duration} minutes

Please confirm you can complete this job.
`.trim();

    // In production, this would send via SMS or push notification
    console.log(`[Cleaning] Would notify ${cleaner.name} (${cleaner.phone}):`, message);

    // For now, show desktop notification
    await window.electronAPI.notification.show(
      `Cleaning Reminder: ${property.name}`,
      `${job.type} scheduled for ${job.scheduledTime}`,
      { route: '/cleaning' }
    );
  }
}

interface CleaningMetrics {
  totalJobs: number;
  completedJobs: number;
  scheduledJobs: number;
  issueJobs: number;
  avgDurationMinutes: number;
  onTimePercentage: number;
  todaysJobs: number;
}

export const cleaningService = new CleaningService();
