/**
 * Right at Home BNB - Cross-Platform Sync System
 * Enables real-time data synchronization across Web, Mobile, and Desktop
 */

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
  Unsubscribe,
  getDocs
} from 'firebase/firestore';

// Sync event types
export type SyncEventType =
  | 'property_updated'
  | 'booking_created'
  | 'booking_updated'
  | 'cleaning_job_assigned'
  | 'cleaning_job_completed'
  | 'guest_message'
  | 'cleaner_checkin'
  | 'smart_device_status'
  | 'payment_received'
  | 'settings_changed';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  entityId: string;
  entityType: 'property' | 'booking' | 'cleaning' | 'guest' | 'cleaner' | 'device' | 'payment';
  data: Record<string, unknown>;
  source: 'web' | 'mobile' | 'desktop';
  timestamp: Timestamp;
  processed: {
    web: boolean;
    mobile: boolean;
    desktop: boolean;
  };
}

export interface SyncConfig {
  platform: 'web' | 'mobile' | 'desktop';
  deviceId: string;
  userId: string;
}

export class CrossPlatformSync {
  private db: any;
  private config: SyncConfig;
  private listeners: Map<string, Unsubscribe> = new Map();
  private eventHandlers: Map<SyncEventType, ((event: SyncEvent) => void)[]> = new Map();

  constructor(db: any, config: SyncConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Initialize sync and register this device
   */
  async initialize(): Promise<void> {
    const deviceRef = doc(this.db, 'sync_devices', this.config.deviceId);
    await setDoc(deviceRef, {
      platform: this.config.platform,
      userId: this.config.userId,
      lastSeen: serverTimestamp(),
      online: true
    }, { merge: true });

    // Start heartbeat
    this.startHeartbeat();

    // Listen for sync events
    this.listenForEvents();
  }

  /**
   * Publish a sync event to all platforms
   */
  async publishEvent(
    type: SyncEventType,
    entityId: string,
    entityType: SyncEvent['entityType'],
    data: Record<string, unknown>
  ): Promise<string> {
    const eventRef = doc(collection(this.db, 'sync_events'));
    const event: Omit<SyncEvent, 'id'> = {
      type,
      entityId,
      entityType,
      data,
      source: this.config.platform,
      timestamp: serverTimestamp() as Timestamp,
      processed: {
        web: this.config.platform === 'web',
        mobile: this.config.platform === 'mobile',
        desktop: this.config.platform === 'desktop'
      }
    };

    await setDoc(eventRef, event);
    return eventRef.id;
  }

  /**
   * Subscribe to specific event types
   */
  on(type: SyncEventType, handler: (event: SyncEvent) => void): void {
    const handlers = this.eventHandlers.get(type) || [];
    handlers.push(handler);
    this.eventHandlers.set(type, handlers);
  }

  /**
   * Listen for real-time sync events
   */
  private listenForEvents(): void {
    const eventsQuery = query(
      collection(this.db, 'sync_events'),
      where(`processed.${this.config.platform}`, '==', false),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const event = { id: change.doc.id, ...change.doc.data() } as SyncEvent;

          // Don't process events from this platform
          if (event.source === this.config.platform) return;

          // Trigger handlers
          const handlers = this.eventHandlers.get(event.type) || [];
          handlers.forEach(handler => handler(event));

          // Mark as processed
          await updateDoc(doc(this.db, 'sync_events', event.id), {
            [`processed.${this.config.platform}`]: true
          });
        }
      });
    });

    this.listeners.set('events', unsubscribe);
  }

  /**
   * Keep device online status updated
   */
  private startHeartbeat(): void {
    const interval = setInterval(async () => {
      const deviceRef = doc(this.db, 'sync_devices', this.config.deviceId);
      await updateDoc(deviceRef, {
        lastSeen: serverTimestamp(),
        online: true
      });
    }, 30000); // Every 30 seconds

    // Store interval for cleanup
    (this as any)._heartbeatInterval = interval;
  }

  /**
   * Get all online devices
   */
  async getOnlineDevices(): Promise<{ platform: string; deviceId: string; lastSeen: Date }[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const devicesQuery = query(
      collection(this.db, 'sync_devices'),
      where('online', '==', true),
      where('lastSeen', '>=', Timestamp.fromDate(fiveMinutesAgo))
    );

    const snapshot = await getDocs(devicesQuery);
    return snapshot.docs.map(doc => ({
      platform: doc.data().platform,
      deviceId: doc.id,
      lastSeen: doc.data().lastSeen.toDate()
    }));
  }

  /**
   * Cleanup on disconnect
   */
  async disconnect(): Promise<void> {
    // Stop heartbeat
    if ((this as any)._heartbeatInterval) {
      clearInterval((this as any)._heartbeatInterval);
    }

    // Unsubscribe all listeners
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();

    // Mark device offline
    const deviceRef = doc(this.db, 'sync_devices', this.config.deviceId);
    await updateDoc(deviceRef, {
      online: false,
      lastSeen: serverTimestamp()
    });
  }
}

// Convenience functions for common sync operations
export const SyncHelpers = {
  /**
   * Sync a property update across platforms
   */
  async syncPropertyUpdate(sync: CrossPlatformSync, propertyId: string, changes: Record<string, unknown>) {
    return sync.publishEvent('property_updated', propertyId, 'property', changes);
  },

  /**
   * Sync a new booking
   */
  async syncBookingCreated(sync: CrossPlatformSync, bookingId: string, bookingData: Record<string, unknown>) {
    return sync.publishEvent('booking_created', bookingId, 'booking', bookingData);
  },

  /**
   * Sync cleaner check-in (from mobile)
   */
  async syncCleanerCheckin(sync: CrossPlatformSync, cleanerId: string, jobId: string, location: { lat: number; lng: number }) {
    return sync.publishEvent('cleaner_checkin', jobId, 'cleaner', {
      cleanerId,
      location,
      checkinTime: new Date().toISOString()
    });
  },

  /**
   * Sync cleaning job completion
   */
  async syncCleaningComplete(sync: CrossPlatformSync, jobId: string, report: Record<string, unknown>) {
    return sync.publishEvent('cleaning_job_completed', jobId, 'cleaning', report);
  },

  /**
   * Sync smart device status change
   */
  async syncDeviceStatus(sync: CrossPlatformSync, deviceId: string, status: Record<string, unknown>) {
    return sync.publishEvent('smart_device_status', deviceId, 'device', status);
  },

  /**
   * Sync guest message
   */
  async syncGuestMessage(sync: CrossPlatformSync, guestId: string, message: Record<string, unknown>) {
    return sync.publishEvent('guest_message', guestId, 'guest', message);
  }
};

export default CrossPlatformSync;
