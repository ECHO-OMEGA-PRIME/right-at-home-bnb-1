/**
 * Right at Home BnB - Calendar Sync Service
 * Supports iCal and Google Calendar integration
 */

import type { Booking, CleaningJob, CalendarEvent, Property } from '@shared/types';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';

// iCal format constants
const ICAL_PRODID = '-//Right at Home BnB//Desktop v1.0//EN';
const ICAL_VERSION = '2.0';

// Google Calendar API configuration
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarSyncConfig {
  googleCalendarId?: string;
  googleAccessToken?: string;
  icalFeedUrl?: string;
  syncEnabled: boolean;
  syncInterval: number; // minutes
  syncBookings: boolean;
  syncCleanings: boolean;
  syncMaintenance: boolean;
}

export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend: Date;
  location?: string;
  status?: string;
  categories?: string[];
}

class CalendarService {
  private config: CalendarSyncConfig = {
    syncEnabled: false,
    syncInterval: 30,
    syncBookings: true,
    syncCleanings: true,
    syncMaintenance: true,
  };

  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<CalendarSyncConfig>('calendarSync');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      console.error('[Calendar] Failed to load config:', error);
    }
  }

  async saveConfig(config: Partial<CalendarSyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await window.electronAPI.store.set('calendarSync', this.config);

    if (this.config.syncEnabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  getConfig(): CalendarSyncConfig {
    return { ...this.config };
  }

  // Generate iCal feed from bookings and cleaning jobs
  generateICalFeed(
    bookings: Booking[],
    cleaningJobs: CleaningJob[],
    properties: Property[]
  ): string {
    const events: ICalEvent[] = [];

    // Convert bookings to iCal events
    if (this.config.syncBookings) {
      bookings.forEach((booking) => {
        const property = properties.find((p) => p.id === booking.propertyId);
        events.push({
          uid: `booking-${booking.id}@rightathomebnb.com`,
          summary: `Guest: ${property?.name || 'Unknown Property'}`,
          description: this.generateBookingDescription(booking, property),
          dtstart: parseISO(booking.checkIn),
          dtend: parseISO(booking.checkOut),
          location: property ? `${property.address}, ${property.city}, ${property.state}` : undefined,
          status: booking.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
          categories: ['booking', booking.source],
        });
      });
    }

    // Convert cleaning jobs to iCal events
    if (this.config.syncCleanings) {
      cleaningJobs.forEach((job) => {
        const property = properties.find((p) => p.id === job.propertyId);
        const startDate = new Date(`${job.scheduledDate}T${job.scheduledTime}`);
        const endDate = new Date(startDate.getTime() + job.duration * 60 * 1000);

        events.push({
          uid: `cleaning-${job.id}@rightathomebnb.com`,
          summary: `${this.getCleaningTypeLabel(job.type)}: ${property?.name || 'Unknown Property'}`,
          description: this.generateCleaningDescription(job, property),
          dtstart: startDate,
          dtend: endDate,
          location: property ? `${property.address}, ${property.city}, ${property.state}` : undefined,
          status: job.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
          categories: ['cleaning', job.type],
        });
      });
    }

    return this.formatICalFeed(events);
  }

  private generateBookingDescription(booking: Booking, property?: Property): string {
    const lines = [
      `Property: ${property?.name || 'Unknown'}`,
      `Guests: ${booking.guests}`,
      `Total: $${booking.totalPrice.toFixed(2)}`,
      `Source: ${booking.source}`,
      `Status: ${booking.status}`,
    ];
    if (booking.notes) {
      lines.push(`Notes: ${booking.notes}`);
    }
    return lines.join('\\n');
  }

  private generateCleaningDescription(job: CleaningJob, property?: Property): string {
    const lines = [
      `Property: ${property?.name || 'Unknown'}`,
      `Type: ${this.getCleaningTypeLabel(job.type)}`,
      `Duration: ${job.duration} minutes`,
      `Status: ${job.status}`,
    ];
    if (job.checklist.length > 0) {
      lines.push('Checklist:');
      job.checklist.forEach((item) => {
        lines.push(`  ${item.completed ? '[x]' : '[ ]'} ${item.task}`);
      });
    }
    if (job.notes) {
      lines.push(`Notes: ${job.notes}`);
    }
    return lines.join('\\n');
  }

  private getCleaningTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      turnover: 'Turnover Clean',
      deep_clean: 'Deep Clean',
      inspection: 'Inspection',
      maintenance: 'Maintenance',
    };
    return labels[type] || type;
  }

  private formatICalFeed(events: ICalEvent[]): string {
    const lines = [
      'BEGIN:VCALENDAR',
      `VERSION:${ICAL_VERSION}`,
      `PRODID:${ICAL_PRODID}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Right at Home BnB',
      'X-WR-TIMEZONE:America/Chicago',
    ];

    events.forEach((event) => {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.uid}`);
      lines.push(`DTSTAMP:${this.formatICalDate(new Date())}`);
      lines.push(`DTSTART:${this.formatICalDate(event.dtstart)}`);
      lines.push(`DTEND:${this.formatICalDate(event.dtend)}`);
      lines.push(`SUMMARY:${this.escapeICalText(event.summary)}`);
      if (event.description) {
        lines.push(`DESCRIPTION:${this.escapeICalText(event.description)}`);
      }
      if (event.location) {
        lines.push(`LOCATION:${this.escapeICalText(event.location)}`);
      }
      if (event.status) {
        lines.push(`STATUS:${event.status}`);
      }
      if (event.categories && event.categories.length > 0) {
        lines.push(`CATEGORIES:${event.categories.join(',')}`);
      }
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  private formatICalDate(date: Date): string {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  }

  private escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  // Parse iCal feed and extract events
  parseICalFeed(icalData: string): ICalEvent[] {
    const events: ICalEvent[] = [];
    const eventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
    const matches = icalData.match(eventRegex) || [];

    matches.forEach((eventBlock) => {
      const event: Partial<ICalEvent> = {};

      const uid = this.extractICalProperty(eventBlock, 'UID');
      const summary = this.extractICalProperty(eventBlock, 'SUMMARY');
      const dtstart = this.extractICalProperty(eventBlock, 'DTSTART');
      const dtend = this.extractICalProperty(eventBlock, 'DTEND');

      if (uid && summary && dtstart && dtend) {
        event.uid = uid;
        event.summary = this.unescapeICalText(summary);
        event.dtstart = this.parseICalDate(dtstart);
        event.dtend = this.parseICalDate(dtend);
        event.description = this.extractICalProperty(eventBlock, 'DESCRIPTION');
        event.location = this.extractICalProperty(eventBlock, 'LOCATION');
        event.status = this.extractICalProperty(eventBlock, 'STATUS');

        const categories = this.extractICalProperty(eventBlock, 'CATEGORIES');
        if (categories) {
          event.categories = categories.split(',');
        }

        events.push(event as ICalEvent);
      }
    });

    return events;
  }

  private extractICalProperty(block: string, property: string): string | undefined {
    const regex = new RegExp(`${property}[^:]*:(.*)`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private parseICalDate(dateStr: string): Date {
    // Handle both date-only and datetime formats
    if (dateStr.includes('T')) {
      const cleaned = dateStr.replace('Z', '').replace(/[-:]/g, '');
      const year = parseInt(cleaned.substring(0, 4));
      const month = parseInt(cleaned.substring(4, 6)) - 1;
      const day = parseInt(cleaned.substring(6, 8));
      const hour = parseInt(cleaned.substring(9, 11)) || 0;
      const minute = parseInt(cleaned.substring(11, 13)) || 0;
      return new Date(Date.UTC(year, month, day, hour, minute));
    }
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  private unescapeICalText(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  // Google Calendar sync methods
  async syncToGoogleCalendar(events: CalendarEvent[]): Promise<{ success: boolean; synced: number; errors: string[] }> {
    if (!this.config.googleAccessToken || !this.config.googleCalendarId) {
      return { success: false, synced: 0, errors: ['Google Calendar not configured'] };
    }

    const errors: string[] = [];
    let synced = 0;

    for (const event of events) {
      try {
        const googleEvent = this.convertToGoogleEvent(event);
        await this.createOrUpdateGoogleEvent(googleEvent);
        synced++;
      } catch (error) {
        errors.push(`Failed to sync event ${event.id}: ${String(error)}`);
      }
    }

    return { success: errors.length === 0, synced, errors };
  }

  private convertToGoogleEvent(event: CalendarEvent): GoogleCalendarEvent {
    return {
      id: event.id,
      summary: event.title,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'America/Chicago',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'America/Chicago',
      },
      colorId: this.getGoogleColorId(event.type),
      description: `Property ID: ${event.propertyId}`,
    };
  }

  private getGoogleColorId(type: string): string {
    const colors: Record<string, string> = {
      booking: '9', // Blue
      cleaning: '10', // Green
      maintenance: '6', // Orange
      blocked: '11', // Red
    };
    return colors[type] || '1';
  }

  private async createOrUpdateGoogleEvent(event: GoogleCalendarEvent): Promise<void> {
    const url = `${GOOGLE_CALENDAR_API}/calendars/${this.config.googleCalendarId}/events`;

    const response = await fetch(`${url}/${event.id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.googleAccessToken}`,
      },
    });

    if (response.ok) {
      // Update existing
      await fetch(`${url}/${event.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.config.googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } else {
      // Create new
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    }
  }

  // Auto-sync management
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (this.config.syncEnabled && this.config.syncInterval > 0) {
      this.syncTimer = setInterval(
        () => {
          console.log('[Calendar] Auto-sync triggered');
          // Emit event for the app to handle sync
          window.dispatchEvent(new CustomEvent('calendar:sync-needed'));
        },
        this.config.syncInterval * 60 * 1000
      );
    }
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  // Export calendar to file
  async exportCalendar(
    bookings: Booking[],
    cleaningJobs: CleaningJob[],
    properties: Property[]
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const icalData = this.generateICalFeed(bookings, cleaningJobs, properties);

    const result = await window.electronAPI.dialog.showSaveDialog({
      title: 'Export Calendar',
      defaultPath: `rightathome-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`,
      filters: [{ name: 'iCalendar', extensions: ['ics'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' };
    }

    const writeResult = await window.electronAPI.file.write(result.filePath, icalData);
    if (writeResult.success) {
      return { success: true, path: result.filePath };
    }
    return { success: false, error: writeResult.error };
  }

  // Import calendar from file
  async importCalendar(): Promise<{ success: boolean; events?: ICalEvent[]; error?: string }> {
    const result = await window.electronAPI.dialog.showOpenDialog({
      title: 'Import Calendar',
      filters: [{ name: 'iCalendar', extensions: ['ics'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Import cancelled' };
    }

    const readResult = await window.electronAPI.file.read(result.filePaths[0]);
    if (!readResult.success || !readResult.data) {
      return { success: false, error: readResult.error };
    }

    try {
      const events = this.parseICalFeed(readResult.data);
      return { success: true, events };
    } catch (error) {
      return { success: false, error: `Failed to parse iCal: ${String(error)}` };
    }
  }

  // Generate blocked dates for properties
  generateBlockedDates(
    propertyId: string,
    startDate: Date,
    endDate: Date,
    reason: string
  ): CalendarEvent {
    return {
      id: `blocked-${propertyId}-${Date.now()}`,
      title: reason || 'Blocked',
      start: startDate,
      end: endDate,
      type: 'blocked',
      propertyId,
      color: '#DC2626',
    };
  }
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  description?: string;
}

export const calendarService = new CalendarService();
