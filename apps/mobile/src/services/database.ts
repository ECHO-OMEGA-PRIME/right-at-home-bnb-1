/**
 * SQLite Database Service
 * Offline-first local storage with sync capability
 * @author ECHO OMEGA PRIME
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'rightathome.db';

// Types for database records
export interface LocalProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities: string;
  photos: string;
  description: string;
  baseRate: number;
  cleaningFee: number;
  status: string;
  lastSynced: number;
  locallyModified: number;
}

export interface LocalBooking {
  id: string;
  propertyId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: number;
  checkOut: number;
  guests: number;
  total: number;
  status: string;
  source: string;
  notes: string;
  lastSynced: number;
  locallyModified: number;
}

export interface LocalCleaningJob {
  id: string;
  propertyId: string;
  bookingId: string;
  cleanerId: string;
  scheduledDate: number;
  scheduledTime: string;
  status: string;
  priority: string;
  rate: number;
  lastSynced: number;
  locallyModified: number;
}

export interface LocalNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string;
  read: number;
  createdAt: number;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    if (Platform.OS === 'web') {
      console.warn('SQLite not supported on web');
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        lat REAL,
        lng REAL,
        type TEXT,
        bedrooms INTEGER,
        bathrooms INTEGER,
        maxGuests INTEGER,
        amenities TEXT,
        photos TEXT,
        description TEXT,
        baseRate REAL,
        cleaningFee REAL,
        status TEXT DEFAULT 'active',
        lastSynced INTEGER DEFAULT 0,
        locallyModified INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        propertyId TEXT NOT NULL,
        guestName TEXT NOT NULL,
        guestEmail TEXT,
        guestPhone TEXT,
        checkIn INTEGER NOT NULL,
        checkOut INTEGER NOT NULL,
        guests INTEGER DEFAULT 1,
        total REAL,
        status TEXT DEFAULT 'pending',
        source TEXT DEFAULT 'direct',
        notes TEXT,
        lastSynced INTEGER DEFAULT 0,
        locallyModified INTEGER DEFAULT 0,
        FOREIGN KEY (propertyId) REFERENCES properties(id)
      );

      CREATE TABLE IF NOT EXISTS cleaning_jobs (
        id TEXT PRIMARY KEY,
        propertyId TEXT NOT NULL,
        bookingId TEXT,
        cleanerId TEXT,
        scheduledDate INTEGER NOT NULL,
        scheduledTime TEXT,
        status TEXT DEFAULT 'scheduled',
        priority TEXT DEFAULT 'normal',
        rate REAL,
        lastSynced INTEGER DEFAULT 0,
        locallyModified INTEGER DEFAULT 0,
        FOREIGN KEY (propertyId) REFERENCES properties(id),
        FOREIGN KEY (bookingId) REFERENCES bookings(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        data TEXT,
        read INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tableName TEXT NOT NULL,
        recordId TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT,
        createdAt INTEGER NOT NULL,
        retryCount INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(propertyId);
      CREATE INDEX IF NOT EXISTS idx_bookings_checkin ON bookings(checkIn);
      CREATE INDEX IF NOT EXISTS idx_cleaning_scheduled ON cleaning_jobs(scheduledDate);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    `);
  }

  // Properties
  async getProperties(): Promise<LocalProperty[]> {
    if (!this.db) return [];
    return await this.db.getAllAsync<LocalProperty>('SELECT * FROM properties ORDER BY name');
  }

  async getProperty(id: string): Promise<LocalProperty | null> {
    if (!this.db) return null;
    return await this.db.getFirstAsync<LocalProperty>(
      'SELECT * FROM properties WHERE id = ?',
      [id]
    );
  }

  async saveProperty(property: Partial<LocalProperty>): Promise<void> {
    if (!this.db) return;

    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO properties
       (id, name, address, city, state, zip, lat, lng, type, bedrooms, bathrooms,
        maxGuests, amenities, photos, description, baseRate, cleaningFee, status,
        lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        property.id,
        property.name,
        property.address,
        property.city,
        property.state,
        property.zip,
        property.lat,
        property.lng,
        property.type,
        property.bedrooms,
        property.bathrooms,
        property.maxGuests,
        property.amenities,
        property.photos,
        property.description,
        property.baseRate,
        property.cleaningFee,
        property.status || 'active',
        property.lastSynced || now,
        property.locallyModified || 1,
      ]
    );

    await this.addToSyncQueue('properties', property.id!, 'upsert', property);
  }

  // Bookings
  async getBookings(options?: {
    propertyId?: string;
    status?: string;
    fromDate?: number;
    toDate?: number;
  }): Promise<LocalBooking[]> {
    if (!this.db) return [];

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: any[] = [];

    if (options?.propertyId) {
      query += ' AND propertyId = ?';
      params.push(options.propertyId);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.fromDate) {
      query += ' AND checkIn >= ?';
      params.push(options.fromDate);
    }
    if (options?.toDate) {
      query += ' AND checkOut <= ?';
      params.push(options.toDate);
    }

    query += ' ORDER BY checkIn ASC';

    return await this.db.getAllAsync<LocalBooking>(query, params);
  }

  async getBooking(id: string): Promise<LocalBooking | null> {
    if (!this.db) return null;
    return await this.db.getFirstAsync<LocalBooking>(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );
  }

  async saveBooking(booking: Partial<LocalBooking>): Promise<void> {
    if (!this.db) return;

    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO bookings
       (id, propertyId, guestName, guestEmail, guestPhone, checkIn, checkOut,
        guests, total, status, source, notes, lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking.id,
        booking.propertyId,
        booking.guestName,
        booking.guestEmail,
        booking.guestPhone,
        booking.checkIn,
        booking.checkOut,
        booking.guests,
        booking.total,
        booking.status || 'pending',
        booking.source || 'direct',
        booking.notes,
        booking.lastSynced || now,
        booking.locallyModified || 1,
      ]
    );

    await this.addToSyncQueue('bookings', booking.id!, 'upsert', booking);
  }

  // Cleaning Jobs
  async getCleaningJobs(options?: {
    propertyId?: string;
    status?: string;
    fromDate?: number;
    toDate?: number;
  }): Promise<LocalCleaningJob[]> {
    if (!this.db) return [];

    let query = 'SELECT * FROM cleaning_jobs WHERE 1=1';
    const params: any[] = [];

    if (options?.propertyId) {
      query += ' AND propertyId = ?';
      params.push(options.propertyId);
    }
    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.fromDate) {
      query += ' AND scheduledDate >= ?';
      params.push(options.fromDate);
    }
    if (options?.toDate) {
      query += ' AND scheduledDate <= ?';
      params.push(options.toDate);
    }

    query += ' ORDER BY scheduledDate ASC';

    return await this.db.getAllAsync<LocalCleaningJob>(query, params);
  }

  async saveCleaningJob(job: Partial<LocalCleaningJob>): Promise<void> {
    if (!this.db) return;

    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO cleaning_jobs
       (id, propertyId, bookingId, cleanerId, scheduledDate, scheduledTime,
        status, priority, rate, lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.propertyId,
        job.bookingId,
        job.cleanerId,
        job.scheduledDate,
        job.scheduledTime,
        job.status || 'scheduled',
        job.priority || 'normal',
        job.rate,
        job.lastSynced || now,
        job.locallyModified || 1,
      ]
    );

    await this.addToSyncQueue('cleaning_jobs', job.id!, 'upsert', job);
  }

  // Notifications
  async getNotifications(unreadOnly = false): Promise<LocalNotification[]> {
    if (!this.db) return [];

    const query = unreadOnly
      ? 'SELECT * FROM notifications WHERE read = 0 ORDER BY createdAt DESC'
      : 'SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100';

    return await this.db.getAllAsync<LocalNotification>(query);
  }

  async saveNotification(notification: LocalNotification): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO notifications
       (id, type, title, body, data, read, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        notification.type,
        notification.title,
        notification.body,
        notification.data,
        notification.read,
        notification.createdAt,
      ]
    );
  }

  async markNotificationRead(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
  }

  async markAllNotificationsRead(): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('UPDATE notifications SET read = 1');
  }

  async getUnreadNotificationCount(): Promise<number> {
    if (!this.db) return 0;
    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM notifications WHERE read = 0'
    );
    return result?.count || 0;
  }

  // Sync Queue
  private async addToSyncQueue(
    tableName: string,
    recordId: string,
    operation: string,
    data: any
  ): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT INTO sync_queue (tableName, recordId, operation, data, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [tableName, recordId, operation, JSON.stringify(data), Date.now()]
    );
  }

  async getSyncQueue(): Promise<any[]> {
    if (!this.db) return [];
    return await this.db.getAllAsync(
      'SELECT * FROM sync_queue ORDER BY createdAt ASC LIMIT 50'
    );
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async incrementSyncRetry(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE sync_queue SET retryCount = retryCount + 1 WHERE id = ?',
      [id]
    );
  }

  // Utility
  async clearAllData(): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync(`
      DELETE FROM properties;
      DELETE FROM bookings;
      DELETE FROM cleaning_jobs;
      DELETE FROM notifications;
      DELETE FROM sync_queue;
    `);
  }

  async getLastSyncTime(tableName: string): Promise<number> {
    if (!this.db) return 0;
    const result = await this.db.getFirstAsync<{ maxSync: number }>(
      `SELECT MAX(lastSynced) as maxSync FROM ${tableName}`
    );
    return result?.maxSync || 0;
  }
}

export const database = new DatabaseService();
export default database;
