/**
 * Prisma Adapter for RightAtHomeBnB CloudSync
 *
 * Bridges Prisma models with CloudSync types, enabling automatic
 * sync of SQLite data to Firebase Firestore.
 */

import type { PrismaClient, Property, PropertyPhoto, Booking, Guest, CleaningJob, SmartLock, Message, Expense, User } from '@prisma/client';
import { CloudSync, getCloudSync, initializeCloudSync } from './cloud-sync.js';
import { SyncStatusTracker, getSyncStatusTracker } from './sync-status-tracker.js';
import type {
  SyncableEntity,
  CloudProperty,
  CloudPhoto,
  CloudBooking,
  CloudGuest,
  SyncableRecord,
  BulkSyncResult,
  SyncResult
} from './types.js';

/**
 * Convert Prisma Property to CloudProperty
 */
export function propertyToCloud(property: Property): CloudProperty {
  return {
    id: property.id,
    name: property.name,
    address: property.address,
    city: property.city,
    state: property.state,
    zipCode: property.zipCode ?? undefined,
    latitude: property.latitude ?? undefined,
    longitude: property.longitude ?? undefined,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    maxGuests: property.maxGuests,
    squareFeet: property.squareFeet ?? undefined,
    propertyType: property.propertyType,
    amenities: property.amenities ?? undefined,
    wifiNetwork: property.wifiNetwork ?? undefined,
    wifiPassword: property.wifiPassword ?? undefined,
    parkingInfo: property.parkingInfo ?? undefined,
    checkInInstr: property.checkInInstr ?? undefined,
    checkOutInstr: property.checkOutInstr ?? undefined,
    houseRules: property.houseRules ?? undefined,
    cleaningChecklist: property.cleaningChecklist ?? undefined,
    nightlyRate: property.nightlyRate,
    cleaningFee: property.cleaningFee ?? undefined,
    securityDeposit: property.securityDeposit ?? undefined,
    airbnbId: property.airbnbId ?? undefined,
    vrboId: property.vrboId ?? undefined,
    status: property.status,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString()
  };
}

/**
 * Convert Prisma PropertyPhoto to CloudPhoto
 */
export function photoToCloud(photo: PropertyPhoto): CloudPhoto {
  return {
    id: photo.id,
    propertyId: photo.propertyId,
    url: photo.url,
    caption: photo.caption ?? undefined,
    isPrimary: photo.isPrimary,
    sortOrder: photo.sortOrder,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.createdAt.toISOString() // PropertyPhoto doesn't have updatedAt
  };
}

/**
 * Convert Prisma Booking to CloudBooking
 */
export function bookingToCloud(booking: Booking): CloudBooking {
  return {
    id: booking.id,
    propertyId: booking.propertyId,
    guestId: booking.guestId,
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    guestCount: booking.guestCount,
    platform: booking.platform,
    confirmCode: booking.confirmCode ?? undefined,
    nightlyRate: booking.nightlyRate,
    totalNights: booking.totalNights,
    subtotal: booking.subtotal,
    cleaningFee: booking.cleaningFee ?? undefined,
    serviceFee: booking.serviceFee ?? undefined,
    taxes: booking.taxes ?? undefined,
    totalPrice: booking.totalPrice,
    accessCode: booking.accessCode ?? undefined,
    codeExpiresAt: booking.codeExpiresAt?.toISOString(),
    status: booking.status,
    specialReqs: booking.specialReqs ?? undefined,
    internalNotes: booking.internalNotes ?? undefined,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString()
  };
}

/**
 * Convert Prisma Guest to CloudGuest
 */
export function guestToCloud(guest: Guest): CloudGuest {
  return {
    id: guest.id,
    email: guest.email,
    name: guest.name,
    phone: guest.phone ?? undefined,
    platform: guest.platform,
    platformId: guest.platformId ?? undefined,
    firstStay: guest.firstStay?.toISOString(),
    lastStay: guest.lastStay?.toISOString(),
    totalStays: guest.totalStays,
    totalSpent: guest.totalSpent,
    avgRating: guest.avgRating ?? undefined,
    tags: guest.tags ?? undefined,
    notes: guest.notes ?? undefined,
    preferences: guest.preferences ?? undefined,
    isVip: guest.isVip,
    vipTier: guest.vipTier ?? undefined,
    birthday: guest.birthday?.toISOString(),
    anniversary: guest.anniversary?.toISOString(),
    createdAt: guest.createdAt.toISOString(),
    updatedAt: guest.updatedAt.toISOString()
  };
}

/**
 * Prisma CloudSync Adapter
 *
 * Provides methods to sync Prisma models to Firebase.
 */
export class PrismaCloudSyncAdapter {
  private prisma: PrismaClient;
  private cloudSync: CloudSync | null = null;
  private statusTracker: SyncStatusTracker;
  private initialized: boolean = false;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.statusTracker = getSyncStatusTracker();
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.cloudSync = await initializeCloudSync();

    // Connect status tracker to sync events
    this.cloudSync.on('record:created', (event) => this.statusTracker.processSyncEvent(event));
    this.cloudSync.on('record:updated', (event) => this.statusTracker.processSyncEvent(event));
    this.cloudSync.on('record:deleted', (event) => this.statusTracker.processSyncEvent(event));
    this.cloudSync.on('sync:error', (event) => this.statusTracker.processSyncEvent(event));
    this.cloudSync.on('sync:conflict', (event) => this.statusTracker.processSyncEvent(event));

    this.initialized = true;
    console.log('[PrismaAdapter] Initialized');
  }

  /**
   * Sync a single property by ID
   */
  async syncPropertyById(id: string): Promise<SyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) {
      return {
        success: false,
        recordId: id,
        entityType: 'property',
        operation: 'update',
        status: 'error',
        error: 'Property not found'
      };
    }

    this.statusTracker.track('property', id, 'pending');
    return this.cloudSync.syncProperty(propertyToCloud(property));
  }

  /**
   * Sync all properties
   */
  async syncAllProperties(): Promise<BulkSyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const properties = await this.prisma.property.findMany();
    const cloudProperties = properties.map(propertyToCloud);

    // Mark all as pending
    for (const p of properties) {
      this.statusTracker.track('property', p.id, 'pending');
    }

    return this.cloudSync.syncAllProperties(cloudProperties);
  }

  /**
   * Sync a single photo by ID
   */
  async syncPhotoById(id: string): Promise<SyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const photo = await this.prisma.propertyPhoto.findUnique({ where: { id } });
    if (!photo) {
      return {
        success: false,
        recordId: id,
        entityType: 'photo',
        operation: 'update',
        status: 'error',
        error: 'Photo not found'
      };
    }

    this.statusTracker.track('photo', id, 'pending');
    return this.cloudSync.syncRecord('photo', photoToCloud(photo));
  }

  /**
   * Sync all photos for a property
   */
  async syncPropertyPhotos(propertyId: string): Promise<BulkSyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const photos = await this.prisma.propertyPhoto.findMany({
      where: { propertyId }
    });
    const cloudPhotos = photos.map(photoToCloud);

    for (const p of photos) {
      this.statusTracker.track('photo', p.id, 'pending');
    }

    return this.cloudSync.syncAllRecords('photo', cloudPhotos);
  }

  /**
   * Sync a single booking by ID
   */
  async syncBookingById(id: string): Promise<SyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return {
        success: false,
        recordId: id,
        entityType: 'booking',
        operation: 'update',
        status: 'error',
        error: 'Booking not found'
      };
    }

    this.statusTracker.track('booking', id, 'pending');
    return this.cloudSync.syncRecord('booking', bookingToCloud(booking));
  }

  /**
   * Sync all bookings
   */
  async syncAllBookings(): Promise<BulkSyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const bookings = await this.prisma.booking.findMany();
    const cloudBookings = bookings.map(bookingToCloud);

    for (const b of bookings) {
      this.statusTracker.track('booking', b.id, 'pending');
    }

    return this.cloudSync.syncAllRecords('booking', cloudBookings);
  }

  /**
   * Sync a single guest by ID
   */
  async syncGuestById(id: string): Promise<SyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) {
      return {
        success: false,
        recordId: id,
        entityType: 'guest',
        operation: 'update',
        status: 'error',
        error: 'Guest not found'
      };
    }

    this.statusTracker.track('guest', id, 'pending');
    return this.cloudSync.syncRecord('guest', guestToCloud(guest));
  }

  /**
   * Sync all guests
   */
  async syncAllGuests(): Promise<BulkSyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const guests = await this.prisma.guest.findMany();
    const cloudGuests = guests.map(guestToCloud);

    for (const g of guests) {
      this.statusTracker.track('guest', g.id, 'pending');
    }

    return this.cloudSync.syncAllRecords('guest', cloudGuests);
  }

  /**
   * Full sync - sync all entity types
   */
  async fullSync(): Promise<{
    properties: BulkSyncResult;
    photos: BulkSyncResult;
    bookings: BulkSyncResult;
    guests: BulkSyncResult;
    totalDuration: number;
  }> {
    const startTime = Date.now();

    const [properties, photos, bookings, guests] = await Promise.all([
      this.syncAllProperties(),
      this.syncAllPhotos(),
      this.syncAllBookings(),
      this.syncAllGuests()
    ]);

    return {
      properties,
      photos,
      bookings,
      guests,
      totalDuration: Date.now() - startTime
    };
  }

  /**
   * Sync all photos
   */
  async syncAllPhotos(): Promise<BulkSyncResult> {
    if (!this.cloudSync) throw new Error('Adapter not initialized');

    const photos = await this.prisma.propertyPhoto.findMany();
    const cloudPhotos = photos.map(photoToCloud);

    for (const p of photos) {
      this.statusTracker.track('photo', p.id, 'pending');
    }

    return this.cloudSync.syncAllRecords('photo', cloudPhotos);
  }

  /**
   * Listen for property changes from Firestore
   */
  onPropertyChanges(
    callback: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: CloudProperty }>) => void
  ): () => void {
    if (!this.cloudSync) throw new Error('Adapter not initialized');
    return this.cloudSync.listenForChanges('property', callback);
  }

  /**
   * Listen for booking changes from Firestore
   */
  onBookingChanges(
    callback: (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: CloudBooking }>) => void
  ): () => void {
    if (!this.cloudSync) throw new Error('Adapter not initialized');
    return this.cloudSync.listenForChanges('booking', callback);
  }

  /**
   * Get sync status tracker
   */
  getStatusTracker(): SyncStatusTracker {
    return this.statusTracker;
  }

  /**
   * Get CloudSync instance
   */
  getCloudSync(): CloudSync | null {
    return this.cloudSync;
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.cloudSync) {
      this.cloudSync.destroy();
    }
    this.initialized = false;
    console.log('[PrismaAdapter] Destroyed');
  }
}

// Factory function
export function createPrismaAdapter(prisma: PrismaClient): PrismaCloudSyncAdapter {
  return new PrismaCloudSyncAdapter(prisma);
}
