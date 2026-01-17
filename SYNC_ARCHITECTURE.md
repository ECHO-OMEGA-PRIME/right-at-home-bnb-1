# Right at Home BNB - Cross-Platform Sync Architecture

## Overview

All three platforms (Web, Mobile, Desktop) sync in real-time through Firebase Firestore using a unified sync system.

## Package Structure

```
packages/shared/
├── src/
│   ├── index.ts           # Main exports
│   ├── types/index.ts     # Shared TypeScript types
│   ├── sync/
│   │   ├── index.ts       # CrossPlatformSync class
│   │   └── hooks.ts       # React hooks for sync
│   ├── firebase/index.ts  # Firebase configuration
│   └── api/index.ts       # Unified API client
└── package.json
```

## Usage in Each Platform

### Web (Next.js)

```tsx
// app/providers.tsx
import { useCrossPlatformSync } from '@rightathome/shared';
import { getFirestoreInstance } from '@rightathome/shared/firebase';

export function SyncProvider({ children }) {
  const { sync, isConnected, onlineDevices } = useCrossPlatformSync(
    getFirestoreInstance(),
    userId
  );

  return (
    <SyncContext.Provider value={{ sync, isConnected, onlineDevices }}>
      {children}
    </SyncContext.Provider>
  );
}
```

### Mobile (React Native)

```tsx
// App.tsx
import { useCrossPlatformSync, useSyncedCleaningJobs } from '@rightathome/shared';

function CleanerApp() {
  const { sync, isConnected } = useCrossPlatformSync(db, userId);
  const { jobs, completeJob } = useSyncedCleaningJobs(sync, initialJobs);

  // Cleaner completes job on mobile
  const handleComplete = async (jobId, report) => {
    await completeJob(jobId, report);
    // Automatically syncs to Web & Desktop!
  };
}
```

### Desktop (Electron)

```tsx
// renderer/App.tsx
import { useCrossPlatformSync, useSyncedProperties } from '@rightathome/shared';

function AdminDashboard() {
  const { sync, isConnected, onlineDevices } = useCrossPlatformSync(db, userId);
  const { properties, updateProperty } = useSyncedProperties(sync, initialProperties);

  // Admin updates property on desktop
  const handleUpdate = async (propertyId, changes) => {
    await updateProperty(propertyId, changes);
    // Automatically syncs to Web & Mobile!
  };

  return (
    <div>
      <StatusBar>
        {isConnected ? 'Connected' : 'Offline'}
        Online: {onlineDevices.map(d => d.platform).join(', ')}
      </StatusBar>
      {/* ... */}
    </div>
  );
}
```

## Sync Events

| Event Type | Triggered By | Synced To |
|------------|--------------|-----------|
| `property_updated` | Desktop/Web | All |
| `booking_created` | Web | All |
| `booking_updated` | Web | All |
| `cleaning_job_assigned` | Web/Desktop | All |
| `cleaning_job_completed` | Mobile | All |
| `cleaner_checkin` | Mobile | All |
| `guest_message` | Web/Mobile | All |
| `smart_device_status` | Any | All |
| `payment_received` | Web | All |
| `settings_changed` | Any | All |

## Firebase Collections

| Collection | Purpose |
|------------|---------|
| `rightathome_sync_events` | Real-time sync events |
| `rightathome_sync_devices` | Online device tracking |
| `rightathome_properties` | Property data |
| `rightathome_bookings` | Booking records |
| `rightathome_cleaning_jobs` | Cleaning assignments |
| `rightathome_messages` | Guest communications |

## Real-Time Flow Example

```
1. Cleaner checks in at property (Mobile)
   ↓
2. GPS verified, checkin event published
   ↓
3. Firebase Firestore receives event
   ↓
4. Web dashboard updates "Cleaner on site" indicator
   ↓
5. Desktop admin sees real-time status change
   ↓
6. All platforms show consistent state
```

## Installation

```bash
# From any app directory
npm install @rightathome/shared

# Or with workspace
npm install @rightathome/shared --workspace=apps/web
npm install @rightathome/shared --workspace=apps/mobile
npm install @rightathome/shared --workspace=apps/desktop
```

## Build Shared Package

```bash
cd packages/shared
npm run build
```

## Environment Variables

All platforms need these:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=xxx    # Web
EXPO_PUBLIC_FIREBASE_API_KEY=xxx    # Mobile
VITE_FIREBASE_API_KEY=xxx           # Desktop

NEXT_PUBLIC_FIREBASE_APP_ID=xxx
EXPO_PUBLIC_FIREBASE_APP_ID=xxx
VITE_FIREBASE_APP_ID=xxx

# API (optional - defaults to production)
NEXT_PUBLIC_API_URL=https://rightathome.vercel.app/api
EXPO_PUBLIC_API_URL=https://rightathome.vercel.app/api
VITE_API_URL=https://rightathome.vercel.app/api
```

---

*Right at Home BNB | Steven Palma | Midland, TX*
*Cross-Platform Sync System v1.0*
