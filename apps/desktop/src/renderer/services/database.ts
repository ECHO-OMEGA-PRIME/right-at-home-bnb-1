/**
 * Right at Home BnB - Database Service Layer
 * Provides typed Prisma operations via IPC bridge
 * Offline-first with SQLite local database
 * @author ECHO OMEGA PRIME
 */

import type {
  Property,
  PropertyPhoto,
  Booking,
  Guest,
  CleaningJob,
  SmartLock,
  Expense,
  Message,
  User,
  AuditLog,
  Setting,
  ConciergeQuery,
} from '@prisma/client';

// Type helpers
type PropertyWithPhotos = Property & { photos: PropertyPhoto[] };
type BookingWithRelations = Booking & { property: Property; guest: Guest };
type CleaningJobWithRelations = CleaningJob & { property: Property; cleaner: User | null; booking: Booking | null };

// Query filters
interface PropertyFilters {
  status?: string;
  city?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  search?: string;
}

interface BookingFilters {
  propertyId?: string;
  guestId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

interface CleaningJobFilters {
  propertyId?: string;
  cleanerId?: string;
  status?: string;
  scheduledDate?: Date;
  jobType?: string;
}

interface GuestFilters {
  search?: string;
  isVip?: boolean;
  platform?: string;
}

interface ExpenseFilters {
  propertyId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

// Dashboard stats
interface DashboardStats {
  totalProperties: number;
  activeBookings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  pendingCleanings: number;
  monthlyRevenue: number;
  occupancyRate: number;
  totalPhotos: number;
  totalGuests: number;
  avgRating: number;
}

// Revenue data for charts
interface RevenueData {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

// Occupancy data
interface OccupancyData {
  propertyId: string;
  propertyName: string;
  occupancyRate: number;
  totalNights: number;
  bookedNights: number;
}

/**
 * Database Service - Exposes Prisma operations via IPC
 * All operations go through the secure context bridge
 */
class DatabaseService {
  // ============================================================================
  // PROPERTIES
  // ============================================================================

  async getProperties(filters?: PropertyFilters): Promise<PropertyWithPhotos[]> {
    return window.electronAPI.db.query('properties.findMany', {
      where: this.buildPropertyWhere(filters),
      include: { photos: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProperty(id: string): Promise<PropertyWithPhotos | null> {
    return window.electronAPI.db.query('properties.findUnique', {
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // Alias for getProperty
  async getPropertyById(id: string): Promise<PropertyWithPhotos | null> {
    return this.getProperty(id);
  }

  async createProperty(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<Property> {
    return window.electronAPI.db.query('properties.create', { data });
  }

  async updateProperty(id: string, data: Partial<Property>): Promise<Property> {
    return window.electronAPI.db.query('properties.update', {
      where: { id },
      data,
    });
  }

  async deleteProperty(id: string): Promise<void> {
    await window.electronAPI.db.query('properties.delete', { where: { id } });
  }

  async getPropertyStats(id: string): Promise<{
    totalBookings: number;
    totalRevenue: number;
    avgNightlyRate: number;
    occupancyRate: number;
    avgRating: number;
  }> {
    const bookings = await window.electronAPI.db.query('bookings.findMany', {
      where: { propertyId: id },
    }) as Booking[];

    const totalBookings = bookings.length;
    const totalRevenue = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const avgNightlyRate = bookings.length > 0
      ? bookings.reduce((sum, b) => sum + b.nightlyRate, 0) / totalBookings
      : 0;

    // Calculate occupancy for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBookings = bookings.filter(b => new Date(b.checkIn) >= thirtyDaysAgo);
    const bookedNights = recentBookings.reduce((sum, b) => sum + b.totalNights, 0);
    const occupancyRate = Math.round((bookedNights / 30) * 100);

    return {
      totalBookings,
      totalRevenue,
      avgNightlyRate,
      occupancyRate,
      avgRating: 4.8, // Would calculate from reviews
    };
  }

  private buildPropertyWhere(filters?: PropertyFilters) {
    if (!filters) return {};

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.city) {
      where.city = filters.city;
    }

    if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
      where.bedrooms = {};
      if (filters.minBedrooms !== undefined) {
        (where.bedrooms as Record<string, number>).gte = filters.minBedrooms;
      }
      if (filters.maxBedrooms !== undefined) {
        (where.bedrooms as Record<string, number>).lte = filters.maxBedrooms;
      }
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  // ============================================================================
  // PROPERTY PHOTOS
  // ============================================================================

  async addPropertyPhoto(data: {
    propertyId: string;
    url: string;
    caption?: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }): Promise<PropertyPhoto> {
    // If this is primary, unset other primaries
    if (data.isPrimary) {
      await window.electronAPI.db.query('propertyPhotos.updateMany', {
        where: { propertyId: data.propertyId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return window.electronAPI.db.query('propertyPhotos.create', { data });
  }

  async deletePropertyPhoto(id: string): Promise<void> {
    await window.electronAPI.db.query('propertyPhotos.delete', { where: { id } });
  }

  async reorderPropertyPhotos(propertyId: string, photoIds: string[]): Promise<void> {
    for (let i = 0; i < photoIds.length; i++) {
      await window.electronAPI.db.query('propertyPhotos.update', {
        where: { id: photoIds[i] },
        data: { sortOrder: i },
      });
    }
  }

  // ============================================================================
  // BOOKINGS
  // ============================================================================

  async getBookings(filters?: BookingFilters): Promise<BookingWithRelations[]> {
    return window.electronAPI.db.query('bookings.findMany', {
      where: this.buildBookingWhere(filters),
      include: { property: true, guest: true },
      orderBy: { checkIn: 'asc' },
    });
  }

  async getBooking(id: string): Promise<BookingWithRelations | null> {
    return window.electronAPI.db.query('bookings.findUnique', {
      where: { id },
      include: { property: true, guest: true, cleaningJob: true, messages: true },
    });
  }

  async createBooking(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<Booking> {
    // Calculate total nights if not provided
    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);
    const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return window.electronAPI.db.query('bookings.create', {
      data: {
        ...data,
        totalNights,
        subtotal: data.nightlyRate * totalNights,
        totalPrice: data.totalPrice || (data.nightlyRate * totalNights + (data.cleaningFee || 0) + (data.serviceFee || 0) + (data.taxes || 0)),
      },
    });
  }

  async updateBooking(id: string, data: Partial<Booking>): Promise<Booking> {
    return window.electronAPI.db.query('bookings.update', {
      where: { id },
      data,
    });
  }

  async cancelBooking(id: string): Promise<Booking> {
    return window.electronAPI.db.query('bookings.update', {
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async getTodaysCheckIns(): Promise<BookingWithRelations[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return window.electronAPI.db.query('bookings.findMany', {
      where: {
        checkIn: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      include: { property: true, guest: true },
    });
  }

  async getTodaysCheckOuts(): Promise<BookingWithRelations[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return window.electronAPI.db.query('bookings.findMany', {
      where: {
        checkOut: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      include: { property: true, guest: true },
    });
  }

  async getUpcomingBookings(days: number = 7): Promise<BookingWithRelations[]> {
    const today = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return window.electronAPI.db.query('bookings.findMany', {
      where: {
        checkIn: { gte: today, lte: future },
        status: { not: 'CANCELLED' },
      },
      include: { property: true, guest: true },
      orderBy: { checkIn: 'asc' },
    });
  }

  private buildBookingWhere(filters?: BookingFilters) {
    if (!filters) return {};

    const where: Record<string, unknown> = {};

    if (filters.propertyId) {
      where.propertyId = filters.propertyId;
    }

    if (filters.guestId) {
      where.guestId = filters.guestId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.checkIn = {};
      if (filters.startDate) {
        (where.checkIn as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.checkIn as Record<string, Date>).lte = filters.endDate;
      }
    }

    return where;
  }

  // ============================================================================
  // GUESTS
  // ============================================================================

  async getGuests(filters?: GuestFilters): Promise<Guest[]> {
    return window.electronAPI.db.query('guests.findMany', {
      where: this.buildGuestWhere(filters),
      orderBy: { totalSpent: 'desc' },
    });
  }

  async getGuest(id: string): Promise<Guest | null> {
    return window.electronAPI.db.query('guests.findUnique', {
      where: { id },
      include: { bookings: { include: { property: true } }, messages: true },
    });
  }

  async createGuest(data: Omit<Guest, 'id' | 'createdAt' | 'updatedAt'>): Promise<Guest> {
    return window.electronAPI.db.query('guests.create', { data });
  }

  async updateGuest(id: string, data: Partial<Guest>): Promise<Guest> {
    return window.electronAPI.db.query('guests.update', {
      where: { id },
      data,
    });
  }

  async getVIPGuests(): Promise<Guest[]> {
    return window.electronAPI.db.query('guests.findMany', {
      where: { isVip: true },
      orderBy: { totalSpent: 'desc' },
    });
  }

  private buildGuestWhere(filters?: GuestFilters) {
    if (!filters) return {};

    const where: Record<string, unknown> = {};

    if (filters.isVip !== undefined) {
      where.isVip = filters.isVip;
    }

    if (filters.platform) {
      where.platform = filters.platform;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  // ============================================================================
  // CLEANING JOBS
  // ============================================================================

  async getCleaningJobs(filters?: CleaningJobFilters): Promise<CleaningJobWithRelations[]> {
    return window.electronAPI.db.query('cleaningJobs.findMany', {
      where: this.buildCleaningJobWhere(filters),
      include: { property: true, cleaner: true, booking: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getCleaningJob(id: string): Promise<CleaningJobWithRelations | null> {
    return window.electronAPI.db.query('cleaningJobs.findUnique', {
      where: { id },
      include: { property: true, cleaner: true, booking: true },
    });
  }

  async createCleaningJob(data: Omit<CleaningJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<CleaningJob> {
    return window.electronAPI.db.query('cleaningJobs.create', { data });
  }

  async updateCleaningJob(id: string, data: Partial<CleaningJob>): Promise<CleaningJob> {
    return window.electronAPI.db.query('cleaningJobs.update', {
      where: { id },
      data,
    });
  }

  async startCleaningJob(id: string, lat?: number, lng?: number): Promise<CleaningJob> {
    return window.electronAPI.db.query('cleaningJobs.update', {
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        checkInLat: lat,
        checkInLng: lng,
      },
    });
  }

  async completeCleaningJob(id: string, data: {
    photos?: string;
    score?: number;
    notes?: string;
    lat?: number;
    lng?: number;
  }): Promise<CleaningJob> {
    const job = await this.getCleaningJob(id);
    const completedAt = new Date();
    const durationMins = job?.startedAt
      ? Math.round((completedAt.getTime() - new Date(job.startedAt).getTime()) / 60000)
      : undefined;

    return window.electronAPI.db.query('cleaningJobs.update', {
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt,
        durationMins,
        photos: data.photos,
        score: data.score,
        notes: data.notes,
        checkOutLat: data.lat,
        checkOutLng: data.lng,
      },
    });
  }

  async getTodaysCleaningJobs(): Promise<CleaningJobWithRelations[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return window.electronAPI.db.query('cleaningJobs.findMany', {
      where: {
        scheduledAt: { gte: today, lt: tomorrow },
      },
      include: { property: true, cleaner: true, booking: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getPendingCleaningJobs(): Promise<CleaningJobWithRelations[]> {
    return window.electronAPI.db.query('cleaningJobs.findMany', {
      where: {
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      include: { property: true, cleaner: true, booking: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  private buildCleaningJobWhere(filters?: CleaningJobFilters) {
    if (!filters) return {};

    const where: Record<string, unknown> = {};

    if (filters.propertyId) {
      where.propertyId = filters.propertyId;
    }

    if (filters.cleanerId) {
      where.cleanerId = filters.cleanerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.jobType) {
      where.jobType = filters.jobType;
    }

    if (filters.scheduledDate) {
      const start = new Date(filters.scheduledDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.scheduledAt = { gte: start, lt: end };
    }

    return where;
  }

  // ============================================================================
  // SMART LOCKS
  // ============================================================================

  async getSmartLocks(): Promise<(SmartLock & { property: Property })[]> {
    return window.electronAPI.db.query('smartLocks.findMany', {
      include: { property: true },
    });
  }

  async getSmartLock(id: string): Promise<SmartLock & { property: Property } | null> {
    return window.electronAPI.db.query('smartLocks.findUnique', {
      where: { id },
      include: { property: true },
    });
  }

  async updateSmartLockCode(id: string, code: string, expiresAt?: Date): Promise<SmartLock> {
    return window.electronAPI.db.query('smartLocks.update', {
      where: { id },
      data: {
        currentCode: code,
        codeExpiresAt: expiresAt,
        lastActivity: new Date(),
      },
    });
  }

  // ============================================================================
  // EXPENSES
  // ============================================================================

  async getExpenses(filters?: ExpenseFilters): Promise<(Expense & { property: Property })[]> {
    return window.electronAPI.db.query('expenses.findMany', {
      where: this.buildExpenseWhere(filters),
      include: { property: true },
      orderBy: { date: 'desc' },
    });
  }

  async createExpense(data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    return window.electronAPI.db.query('expenses.create', { data });
  }

  async updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
    return window.electronAPI.db.query('expenses.update', {
      where: { id },
      data,
    });
  }

  async deleteExpense(id: string): Promise<void> {
    await window.electronAPI.db.query('expenses.delete', { where: { id } });
  }

  private buildExpenseWhere(filters?: ExpenseFilters) {
    if (!filters) return {};

    const where: Record<string, unknown> = {};

    if (filters.propertyId) {
      where.propertyId = filters.propertyId;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        (where.date as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.date as Record<string, Date>).lte = filters.endDate;
      }
    }

    return where;
  }

  // ============================================================================
  // DASHBOARD STATS
  // ============================================================================

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Run all queries in parallel
    const [
      propertiesCount,
      photosCount,
      guestsCount,
      activeBookings,
      todayCheckIns,
      todayCheckOuts,
      pendingCleanings,
      monthlyBookings,
    ] = await Promise.all([
      window.electronAPI.db.query('properties.count', { where: { status: 'ACTIVE' } }),
      window.electronAPI.db.query('propertyPhotos.count', {}),
      window.electronAPI.db.query('guests.count', {}),
      window.electronAPI.db.query('bookings.count', {
        where: { status: 'CONFIRMED', checkIn: { lte: today }, checkOut: { gte: today } },
      }),
      window.electronAPI.db.query('bookings.count', {
        where: { checkIn: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } },
      }),
      window.electronAPI.db.query('bookings.count', {
        where: { checkOut: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } },
      }),
      window.electronAPI.db.query('cleaningJobs.count', {
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
      }),
      window.electronAPI.db.query('bookings.findMany', {
        where: { checkIn: { gte: startOfMonth, lte: endOfMonth }, status: { not: 'CANCELLED' } },
        select: { totalPrice: true, totalNights: true },
      }),
    ]);

    const monthlyRevenue = (monthlyBookings as { totalPrice: number }[]).reduce((sum, b) => sum + b.totalPrice, 0);
    const totalNights = (monthlyBookings as { totalNights: number }[]).reduce((sum, b) => sum + b.totalNights, 0);
    const daysInMonth = endOfMonth.getDate();
    const occupancyRate = Math.round((totalNights / (propertiesCount * daysInMonth)) * 100);

    return {
      totalProperties: propertiesCount,
      activeBookings,
      todayCheckIns,
      todayCheckOuts,
      pendingCleanings,
      monthlyRevenue,
      occupancyRate,
      totalPhotos: photosCount,
      totalGuests: guestsCount,
      avgRating: 4.8,
    };
  }

  async getRevenueData(months: number = 6): Promise<RevenueData[]> {
    const data: RevenueData[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const [bookings, expenses] = await Promise.all([
        window.electronAPI.db.query('bookings.findMany', {
          where: { checkIn: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } },
          select: { totalPrice: true },
        }),
        window.electronAPI.db.query('expenses.findMany', {
          where: { date: { gte: startDate, lte: endDate } },
          select: { amount: true },
        }),
      ]);

      const revenue = (bookings as { totalPrice: number }[]).reduce((sum, b) => sum + b.totalPrice, 0);
      const totalExpenses = (expenses as { amount: number }[]).reduce((sum, e) => sum + e.amount, 0);

      data.push({
        month: startDate.toLocaleString('default', { month: 'short' }),
        revenue,
        expenses: totalExpenses,
        net: revenue - totalExpenses,
      });
    }

    return data;
  }

  async getOccupancyByProperty(): Promise<OccupancyData[]> {
    const properties = await window.electronAPI.db.query('properties.findMany', {
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    }) as { id: string; name: string }[];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const data: OccupancyData[] = [];

    for (const property of properties) {
      const bookings = await window.electronAPI.db.query('bookings.findMany', {
        where: {
          propertyId: property.id,
          checkIn: { gte: thirtyDaysAgo },
          status: { not: 'CANCELLED' },
        },
        select: { totalNights: true },
      }) as { totalNights: number }[];

      const bookedNights = bookings.reduce((sum, b) => sum + b.totalNights, 0);
      const occupancyRate = Math.round((bookedNights / 30) * 100);

      data.push({
        propertyId: property.id,
        propertyName: property.name,
        occupancyRate,
        totalNights: 30,
        bookedNights,
      });
    }

    return data.sort((a, b) => b.occupancyRate - a.occupancyRate);
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  async getSetting(key: string): Promise<string | null> {
    const setting = await window.electronAPI.db.query('settings.findUnique', {
      where: { key },
    }) as Setting | null;
    return setting?.value ?? null;
  }

  async setSetting(key: string, value: string, description?: string): Promise<void> {
    await window.electronAPI.db.query('settings.upsert', {
      where: { key },
      update: { value },
      create: { key, value, description },
    });
  }

  // ============================================================================
  // AUDIT LOG
  // ============================================================================

  async logAuditEvent(data: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }): Promise<void> {
    await window.electronAPI.db.query('auditLogs.create', {
      data: {
        ...data,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : undefined,
        newValues: data.newValues ? JSON.stringify(data.newValues) : undefined,
      },
    });
  }

  async getAuditLogs(filters?: {
    userId?: string;
    entity?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]> {
    const where: Record<string, unknown> = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.entity) {
      where.entity = filters.entity;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    return window.electronAPI.db.query('auditLogs.findMany', {
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

// Export singleton instance
export const db = new DatabaseService();

// Also export as databaseService for consistency
export const databaseService = db;

// Export types
export type {
  PropertyWithPhotos,
  BookingWithRelations,
  CleaningJobWithRelations,
  PropertyFilters,
  BookingFilters,
  CleaningJobFilters,
  GuestFilters,
  ExpenseFilters,
  DashboardStats,
  RevenueData,
  OccupancyData,
};
