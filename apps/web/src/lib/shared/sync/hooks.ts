/**
 * Right at Home BNB - Sync Hooks for React (Web/Mobile/Desktop)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import CrossPlatformSync, { SyncEvent, SyncEventType, SyncConfig } from './index';

// Platform detection
const detectPlatform = (): 'web' | 'mobile' | 'desktop' => {
  if (typeof window !== 'undefined') {
    // Check for Electron
    if ((window as any).electron || navigator.userAgent.includes('Electron')) {
      return 'desktop';
    }
    // Check for React Native
    if ((window as any).ReactNativeWebView || navigator.product === 'ReactNative') {
      return 'mobile';
    }
  }
  return 'web';
};

// Generate unique device ID
const getDeviceId = (): string => {
  const storageKey = 'rightathome_device_id';

  if (typeof localStorage !== 'undefined') {
    let deviceId = localStorage.getItem(storageKey);
    if (!deviceId) {
      deviceId = `${detectPlatform()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(storageKey, deviceId);
    }
    return deviceId;
  }

  return `${detectPlatform()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Hook to initialize and manage cross-platform sync
 */
export function useCrossPlatformSync(db: any, userId: string) {
  const [sync, setSync] = useState<CrossPlatformSync | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineDevices, setOnlineDevices] = useState<{ platform: string; deviceId: string }[]>([]);

  useEffect(() => {
    if (!db || !userId) return;

    const config: SyncConfig = {
      platform: detectPlatform(),
      deviceId: getDeviceId(),
      userId
    };

    const syncInstance = new CrossPlatformSync(db, config);

    syncInstance.initialize().then(() => {
      setSync(syncInstance);
      setIsConnected(true);

      // Poll for online devices
      const pollDevices = async () => {
        const devices = await syncInstance.getOnlineDevices();
        setOnlineDevices(devices);
      };

      pollDevices();
      const interval = setInterval(pollDevices, 60000);

      return () => clearInterval(interval);
    });

    return () => {
      syncInstance.disconnect();
      setIsConnected(false);
    };
  }, [db, userId]);

  return { sync, isConnected, onlineDevices, platform: detectPlatform() };
}

/**
 * Hook to subscribe to specific sync events
 */
export function useSyncEvent(
  sync: CrossPlatformSync | null,
  eventType: SyncEventType,
  handler: (event: SyncEvent) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!sync) return;

    sync.on(eventType, (event) => {
      handlerRef.current(event);
    });
  }, [sync, eventType]);
}

/**
 * Hook to sync properties in real-time
 */
export function useSyncedProperties(sync: CrossPlatformSync | null, initialProperties: any[]) {
  const [properties, setProperties] = useState(initialProperties);

  useSyncEvent(sync, 'property_updated', (event) => {
    setProperties(prev =>
      prev.map(p => p.id === event.entityId ? { ...p, ...event.data } : p)
    );
  });

  const updateProperty = useCallback(async (propertyId: string, changes: Record<string, unknown>) => {
    if (!sync) return;

    // Optimistic update
    setProperties(prev =>
      prev.map(p => p.id === propertyId ? { ...p, ...changes } : p)
    );

    // Publish to other platforms
    await sync.publishEvent('property_updated', propertyId, 'property', changes);
  }, [sync]);

  return { properties, updateProperty };
}

/**
 * Hook to sync bookings in real-time
 */
export function useSyncedBookings(sync: CrossPlatformSync | null, initialBookings: any[]) {
  const [bookings, setBookings] = useState(initialBookings);

  useSyncEvent(sync, 'booking_created', (event) => {
    setBookings(prev => [...prev, { id: event.entityId, ...event.data }]);
  });

  useSyncEvent(sync, 'booking_updated', (event) => {
    setBookings(prev =>
      prev.map(b => b.id === event.entityId ? { ...b, ...event.data } : b)
    );
  });

  const createBooking = useCallback(async (bookingData: Record<string, unknown>) => {
    if (!sync) return;
    const bookingId = `booking_${Date.now()}`;

    // Optimistic update
    setBookings(prev => [...prev, { id: bookingId, ...bookingData }]);

    // Publish to other platforms
    await sync.publishEvent('booking_created', bookingId, 'booking', bookingData);

    return bookingId;
  }, [sync]);

  return { bookings, createBooking };
}

/**
 * Hook to sync cleaning jobs in real-time
 */
export function useSyncedCleaningJobs(sync: CrossPlatformSync | null, initialJobs: any[]) {
  const [jobs, setJobs] = useState(initialJobs);

  useSyncEvent(sync, 'cleaning_job_assigned', (event) => {
    setJobs(prev => [...prev, { id: event.entityId, ...event.data }]);
  });

  useSyncEvent(sync, 'cleaning_job_completed', (event) => {
    setJobs(prev =>
      prev.map(j => j.id === event.entityId ? { ...j, ...event.data, status: 'completed' } : j)
    );
  });

  useSyncEvent(sync, 'cleaner_checkin', (event) => {
    setJobs(prev =>
      prev.map(j => j.id === event.entityId ? { ...j, checkinData: event.data } : j)
    );
  });

  const completeJob = useCallback(async (jobId: string, report: Record<string, unknown>) => {
    if (!sync) return;

    // Optimistic update
    setJobs(prev =>
      prev.map(j => j.id === jobId ? { ...j, ...report, status: 'completed' } : j)
    );

    // Publish to other platforms
    await sync.publishEvent('cleaning_job_completed', jobId, 'cleaning', report);
  }, [sync]);

  return { jobs, completeJob };
}

/**
 * Hook to sync guest messages in real-time
 */
export function useSyncedMessages(sync: CrossPlatformSync | null, guestId: string, initialMessages: any[]) {
  const [messages, setMessages] = useState(initialMessages);

  useSyncEvent(sync, 'guest_message', (event) => {
    if (event.data.guestId === guestId || event.entityId === guestId) {
      setMessages(prev => [...prev, event.data]);
    }
  });

  const sendMessage = useCallback(async (content: string, fromHost: boolean = true) => {
    if (!sync) return;

    const messageData = {
      guestId,
      content,
      fromHost,
      timestamp: new Date().toISOString()
    };

    // Optimistic update
    setMessages(prev => [...prev, messageData]);

    // Publish to other platforms
    await sync.publishEvent('guest_message', guestId, 'guest', messageData);
  }, [sync, guestId]);

  return { messages, sendMessage };
}

/**
 * Hook to sync smart device status
 */
export function useSyncedDevices(sync: CrossPlatformSync | null, initialDevices: any[]) {
  const [devices, setDevices] = useState(initialDevices);

  useSyncEvent(sync, 'smart_device_status', (event) => {
    setDevices(prev =>
      prev.map(d => d.id === event.entityId ? { ...d, ...event.data } : d)
    );
  });

  const updateDeviceStatus = useCallback(async (deviceId: string, status: Record<string, unknown>) => {
    if (!sync) return;

    // Optimistic update
    setDevices(prev =>
      prev.map(d => d.id === deviceId ? { ...d, ...status } : d)
    );

    // Publish to other platforms
    await sync.publishEvent('smart_device_status', deviceId, 'device', status);
  }, [sync]);

  return { devices, updateDeviceStatus };
}

export default {
  useCrossPlatformSync,
  useSyncEvent,
  useSyncedProperties,
  useSyncedBookings,
  useSyncedCleaningJobs,
  useSyncedMessages,
  useSyncedDevices
};
