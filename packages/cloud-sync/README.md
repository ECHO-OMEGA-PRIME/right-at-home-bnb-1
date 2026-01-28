# @rightathome/cloud-sync

CloudSync module for RightAtHomeBnB - Firebase Firestore sync with offline support.

## Features

- **Real-time Sync**: Bidirectional sync between local SQLite and Firebase Firestore
- **Offline Support**: Automatic queue processing when connectivity is restored
- **Conflict Resolution**: Configurable strategies (last-write-wins, local-wins, remote-wins)
- **Sync Status Tracking**: Visual indicators for synced, pending, error states
- **React Hooks**: Easy integration with React/React Native apps
- **Prisma Adapter**: Direct sync from Prisma models

## Installation

```bash
pnpm add @rightathome/cloud-sync
```

## Firebase Setup

The module uses the `echo-prime-ai` Firebase project. Ensure you have the following environment variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
# or for server-side
FIREBASE_API_KEY=your-api-key
FIREBASE_APP_ID=your-app-id
```

## Firestore Collections

| Collection | Description |
|------------|-------------|
| `rightathome_properties` | Property documents |
| `rightathome_photos` | Photo documents |
| `rightathome_bookings` | Booking documents |
| `rightathome_guests` | Guest documents |
| `rightathome_cleaning_jobs` | Cleaning job documents |
| `rightathome_smart_locks` | Smart lock documents |
| `rightathome_messages` | Message documents |
| `rightathome_expenses` | Expense documents |
| `rightathome_users` | User documents |
| `rightathome_sync_metadata` | Sync timestamps |
| `rightathome_offline_queue` | Offline queue (internal) |

## Quick Start

### Basic Usage

```typescript
import { initializeCloudSync, getCloudSync } from '@rightathome/cloud-sync';

// Initialize
await initializeCloudSync({
  autoSync: true,
  conflictResolution: 'last-write-wins',
  enableOfflineQueue: true
});

const cloudSync = getCloudSync();

// Sync a property
await cloudSync.syncProperty({
  id: 'prop-123',
  name: 'Sunset Villa',
  address: '123 Main St',
  // ... other fields
});

// Listen for changes
const unsubscribe = cloudSync.listenForChanges('property', (changes) => {
  console.log('Property changes:', changes);
});

// Later: stop listening
unsubscribe();
```

### With Prisma

```typescript
import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '@rightathome/cloud-sync';

const prisma = new PrismaClient();
const adapter = createPrismaAdapter(prisma);

await adapter.initialize();

// Sync single property
await adapter.syncPropertyById('prop-123');

// Sync all properties
const result = await adapter.syncAllProperties();
console.log(`Synced ${result.successCount} properties`);

// Full sync
const fullResult = await adapter.fullSync();
console.log(`Total time: ${fullResult.totalDuration}ms`);
```

### React Hooks

```tsx
import {
  useCloudSync,
  useSyncStatus,
  useOnlineStatus,
  useOfflineQueue
} from '@rightathome/cloud-sync';

function PropertyCard({ property }) {
  const { status, isPending, isError, isSynced } = useSyncStatus('property', property.id);

  return (
    <div>
      <h3>{property.name}</h3>
      {isPending && <SyncingSpinner />}
      {isError && <ErrorIcon />}
      {isSynced && <CheckmarkIcon />}
    </div>
  );
}

function SyncStatusBar() {
  const { isOnline, summary, pendingCount, errorCount } = useCloudSync();
  const { queueSize, hasPending } = useOfflineQueue();

  return (
    <div>
      {!isOnline && <span>Offline - {queueSize} pending</span>}
      <span>Synced: {summary.synced}</span>
      <span>Pending: {pendingCount}</span>
      {errorCount > 0 && <span>Errors: {errorCount}</span>}
    </div>
  );
}
```

## API Reference

### CloudSync

Main sync service class.

```typescript
const cloudSync = getCloudSync();

// Sync single record
await cloudSync.syncProperty(property);
await cloudSync.syncRecord('booking', booking);

// Bulk sync
await cloudSync.syncAllProperties(properties);
await cloudSync.syncAllRecords('guest', guests);

// Delete
await cloudSync.deleteRecord('property', 'prop-123');

// Fetch from Firestore
const properties = await cloudSync.fetchAll<CloudProperty>('property');
const property = await cloudSync.fetchOne<CloudProperty>('property', 'prop-123');

// Real-time listeners
const unsubscribe = cloudSync.listenForChanges('property', (changes) => {
  for (const change of changes) {
    console.log(change.type, change.data);
  }
});

// Events
cloudSync.on('sync:started', (event) => console.log('Sync started'));
cloudSync.on('sync:completed', (event) => console.log('Sync completed'));
cloudSync.on('sync:error', (event) => console.log('Sync error:', event.error));
cloudSync.on('sync:conflict', (event) => console.log('Conflict:', event.data));
cloudSync.on('record:created', (event) => console.log('Created:', event.recordId));
cloudSync.on('record:updated', (event) => console.log('Updated:', event.recordId));
cloudSync.on('record:deleted', (event) => console.log('Deleted:', event.recordId));
```

### SyncStatusTracker

Track sync status for UI indicators.

```typescript
const tracker = getSyncStatusTracker();

// Track status
tracker.track('property', 'prop-123', 'pending');
tracker.track('property', 'prop-123', 'synced');
tracker.trackError('property', 'prop-123', 'Network error');

// Get status
const status = tracker.getStatusValue('property', 'prop-123');
const record = tracker.getStatus('property', 'prop-123');

// Get by status
const pending = tracker.getPending();
const errors = tracker.getErrors();
const conflicts = tracker.getConflicts();

// Summary
const summary = tracker.getSummary();
console.log(`${summary.synced}/${summary.total} synced`);

// Events
tracker.on('status:changed', (record) => console.log('Status changed:', record));
tracker.on('summary:updated', (summary) => console.log('Summary:', summary));
```

### OfflineQueue

Handle offline operations.

```typescript
const queue = getOfflineQueue();

await queue.initialize();

// Enqueue operation
await queue.enqueue('property', 'update', 'prop-123', propertyData);

// Check status
console.log('Online:', queue.online);
console.log('Queue size:', queue.size);
console.log('Pending items:', queue.getPendingItems());

// Process queue (called automatically when online)
await queue.processQueue(async (item) => {
  // Process item, return true if successful
  return true;
});

// Events
queue.on('connectivity:changed', (online) => console.log('Online:', online));
queue.on('queue:added', (item) => console.log('Added to queue:', item));
queue.on('queue:processed', (item) => console.log('Processed:', item));
```

## Conflict Resolution

The module supports four conflict resolution strategies:

1. **`last-write-wins`** (default): Most recent `updatedAt` wins
2. **`local-wins`**: Local data always wins
3. **`remote-wins`**: Remote data always wins
4. **`manual`**: Emit conflict event for manual resolution

```typescript
await initializeCloudSync({
  conflictResolution: 'last-write-wins' // or 'local-wins', 'remote-wins', 'manual'
});

// For manual resolution, listen to conflict events
cloudSync.on('sync:conflict', (event) => {
  const { local, remote } = event.data;
  // Implement your resolution logic
});
```

## TypeScript Types

```typescript
import type {
  SyncStatus,        // 'synced' | 'pending' | 'error' | 'conflict'
  SyncOperation,     // 'create' | 'update' | 'delete'
  SyncableEntity,    // 'property' | 'photo' | 'booking' | etc.
  CloudProperty,     // Property type for Firestore
  CloudBooking,      // Booking type for Firestore
  CloudGuest,        // Guest type for Firestore
  SyncResult,        // Result of single sync operation
  BulkSyncResult,    // Result of bulk sync
  SyncEvent          // Event payload
} from '@rightathome/cloud-sync';
```

## License

Proprietary - Right at Home BnB
