/**
 * Right at Home BnB - Service Worker
 * Provides offline support, background sync, and push notifications
 * Version: 1.0.0
 */

const CACHE_NAME = 'rah-bnb-v1';
const OFFLINE_CACHE = 'rah-bnb-offline-v1';
const DATA_CACHE = 'rah-bnb-data-v1';
const IMAGE_CACHE = 'rah-bnb-images-v1';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/properties',
  '/bookings',
  '/cleaning',
  '/offline',
  '/manifest.json',
  '/favicon.svg',
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  '/api/properties',
  '/api/bookings',
  '/api/cleaning',
  '/api/dashboard/stats',
];

// Pages that work offline with cached data
const OFFLINE_PAGES = [
  '/dashboard',
  '/properties',
  '/bookings',
  '/cleaning',
];

// ============================================
// INSTALLATION - Cache static assets
// ============================================
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('[ServiceWorker] Caching static assets');

      // Cache static assets - don't fail on individual errors
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn(`[ServiceWorker] Failed to cache: ${asset}`, error);
        }
      }

      // Force activation without waiting
      await self.skipWaiting();
    })()
  );
});

// ============================================
// ACTIVATION - Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('rah-bnb-') && name !== CACHE_NAME && name !== OFFLINE_CACHE && name !== DATA_CACHE && name !== IMAGE_CACHE)
          .map(name => {
            console.log(`[ServiceWorker] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );

      // Take control of all clients immediately
      await self.clients.claim();
      console.log('[ServiceWorker] Active and controlling');
    })()
  );
});

// ============================================
// FETCH - Handle all network requests
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (handled by background sync)
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different request types
  if (url.pathname.startsWith('/api/')) {
    // API requests: Network first, fallback to cache
    event.respondWith(handleApiRequest(request));
  } else if (request.destination === 'image') {
    // Images: Cache first, fallback to network
    event.respondWith(handleImageRequest(request));
  } else if (OFFLINE_PAGES.includes(url.pathname) || url.pathname === '/') {
    // App pages: Network first, fallback to cache
    event.respondWith(handlePageRequest(request));
  } else {
    // Other requests: Stale while revalidate
    event.respondWith(handleGenericRequest(request));
  }
});

// ============================================
// REQUEST HANDLERS
// ============================================

async function handleApiRequest(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[ServiceWorker] Network failed for API, trying cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Add header to indicate offline data
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cache-Status', 'offline');

      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }

    // Return offline API response
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'You are offline. This data will sync when you reconnect.',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);

  // Try cache first for images
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return placeholder image for offline
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect fill="#1a1a1a" width="200" height="200"/>
        <text fill="#666" font-family="Arial" font-size="14" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Offline</text>
      </svg>`,
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

async function handlePageRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[ServiceWorker] Network failed for page, trying cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page
    const offlinePage = await cache.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }

    // Generate basic offline response
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Right at Home BnB</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui; background: #0a0505; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .container { text-align: center; padding: 2rem; }
            h1 { color: #500000; }
            button { background: #500000; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-size: 1rem; }
            button:hover { background: #700000; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
          </div>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function handleGenericRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // Stale while revalidate
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  return cachedResponse || fetchPromise;
}

// ============================================
// BACKGROUND SYNC - Sync offline actions
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);

  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  } else if (event.tag === 'sync-cleaning-status') {
    event.waitUntil(syncCleaningStatus());
  } else if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-all') {
    event.waitUntil(syncAll());
  }
});

async function syncBookings() {
  console.log('[ServiceWorker] Syncing bookings...');

  try {
    const pendingActions = await getFromIndexedDB('pending-bookings');

    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data)
        });

        if (response.ok) {
          await removeFromIndexedDB('pending-bookings', action.id);
          await notifyClients('sync-complete', { type: 'booking', id: action.id });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync booking:', action.id, error);
      }
    }

    console.log('[ServiceWorker] Bookings sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync bookings error:', error);
  }
}

async function syncCleaningStatus() {
  console.log('[ServiceWorker] Syncing cleaning status...');

  try {
    const pendingActions = await getFromIndexedDB('pending-cleaning');

    for (const action of pendingActions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.data)
        });

        if (response.ok) {
          await removeFromIndexedDB('pending-cleaning', action.id);
          await notifyClients('sync-complete', { type: 'cleaning', id: action.id });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync cleaning:', action.id, error);
      }
    }

    console.log('[ServiceWorker] Cleaning sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync cleaning error:', error);
  }
}

async function syncMessages() {
  console.log('[ServiceWorker] Syncing messages...');

  try {
    const pendingMessages = await getFromIndexedDB('pending-messages');

    for (const message of pendingMessages) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.data)
        });

        if (response.ok) {
          await removeFromIndexedDB('pending-messages', message.id);
          await notifyClients('sync-complete', { type: 'message', id: message.id });
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync message:', message.id, error);
      }
    }

    console.log('[ServiceWorker] Messages sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync messages error:', error);
  }
}

async function syncAll() {
  await syncBookings();
  await syncCleaningStatus();
  await syncMessages();
  await notifyClients('sync-all-complete', { timestamp: Date.now() });
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');

  if (!event.data) {
    console.log('[ServiceWorker] Push event but no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (error) {
    data = {
      title: 'Right at Home BnB',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png'
    };
  }

  const options = {
    body: data.body || data.message,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      type: data.type,
      id: data.id,
      timestamp: Date.now()
    },
    actions: getNotificationActions(data.type),
    tag: data.tag || `rah-${data.type}-${data.id || Date.now()}`,
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Right at Home BnB', options)
  );
});

function getNotificationActions(type) {
  switch (type) {
    case 'new-booking':
      return [
        { action: 'view', title: 'View Booking', icon: '/icons/action-view.png' },
        { action: 'confirm', title: 'Confirm', icon: '/icons/action-confirm.png' }
      ];
    case 'cleaner-late':
      return [
        { action: 'call', title: 'Call Cleaner', icon: '/icons/action-call.png' },
        { action: 'reassign', title: 'Reassign', icon: '/icons/action-reassign.png' }
      ];
    case 'guest-message':
      return [
        { action: 'reply', title: 'Reply', icon: '/icons/action-reply.png' },
        { action: 'view', title: 'View', icon: '/icons/action-view.png' }
      ];
    case 'checkout-reminder':
      return [
        { action: 'send-reminder', title: 'Send Reminder', icon: '/icons/action-send.png' },
        { action: 'view', title: 'View', icon: '/icons/action-view.png' }
      ];
    default:
      return [
        { action: 'view', title: 'View', icon: '/icons/action-view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' }
      ];
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action);

  event.notification.close();

  const data = event.notification.data;
  let targetUrl = data.url || '/';

  // Handle specific actions
  if (event.action === 'view') {
    targetUrl = data.url || '/';
  } else if (event.action === 'confirm' && data.type === 'new-booking') {
    targetUrl = `/bookings/${data.id}/confirm`;
  } else if (event.action === 'call' && data.type === 'cleaner-late') {
    targetUrl = `/cleaners/${data.id}/call`;
  } else if (event.action === 'reply' && data.type === 'guest-message') {
    targetUrl = `/messages/${data.id}`;
  } else if (event.action === 'reassign') {
    targetUrl = `/cleaning/${data.id}/reassign`;
  } else if (event.action === 'send-reminder') {
    targetUrl = `/bookings/${data.id}/reminder`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(targetUrl);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed:', event.notification.tag);

  // Track notification dismissal analytics
  const data = event.notification.data;
  fetch('/api/analytics/notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'dismissed',
      type: data.type,
      id: data.id,
      timestamp: Date.now()
    })
  }).catch(() => {
    // Ignore errors for analytics
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function notifyClients(type, data) {
  const allClients = await clients.matchAll({ includeUncontrolled: true });

  for (const client of allClients) {
    client.postMessage({
      type,
      data,
      timestamp: Date.now()
    });
  }
}

// IndexedDB helpers for background sync
const DB_NAME = 'rah-bnb-sync';
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('pending-bookings')) {
        db.createObjectStore('pending-bookings', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-cleaning')) {
        db.createObjectStore('pending-cleaning', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function getFromIndexedDB(storeName) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removeFromIndexedDB(storeName, id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ============================================
// MESSAGE HANDLING FROM CLIENTS
// ============================================
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(data.urls));
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(data.cacheName));
      break;

    case 'GET_CACHE_STATUS':
      event.waitUntil(getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      }));
      break;

    case 'TRIGGER_SYNC':
      if ('sync' in self.registration) {
        event.waitUntil(self.registration.sync.register(data.tag));
      }
      break;
  }
});

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);

  for (const url of urls) {
    try {
      await cache.add(url);
    } catch (error) {
      console.warn('[ServiceWorker] Failed to cache URL:', url, error);
    }
  }
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('rah-bnb-')).map(n => caches.delete(n)));
  }
}

async function getCacheStatus() {
  const names = await caches.keys();
  const status = {};

  for (const name of names.filter(n => n.startsWith('rah-bnb-'))) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = keys.length;
  }

  return status;
}

console.log('[ServiceWorker] Loaded successfully');
