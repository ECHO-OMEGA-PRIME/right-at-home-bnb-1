// Right at Home BnB - Drizzle ORM Schema
// Steven Palma | Midland, TX | 22 Properties
// Complete database schema for property management system
// Migrated from Prisma -> Drizzle with @vercel/postgres (PostgreSQL)

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================
// ENUMS
// ============================================

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "OWNER",
  "MANAGER",
  "CLEANER",
  "MAINTENANCE",
  "ACCOUNTANT",
  "GUEST",
]);

export const propertyStatusEnum = pgEnum("property_status", [
  "ACTIVE",
  "INACTIVE",
  "MAINTENANCE",
  "ONBOARDING",
  "ARCHIVED",
]);

export const propertyTypeEnum = pgEnum("property_type", [
  "HOUSE",
  "APARTMENT",
  "CONDO",
  "TOWNHOUSE",
  "STUDIO",
  "CABIN",
  "SUITE",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "INQUIRY",
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

export const bookingPlatformEnum = pgEnum("booking_platform", [
  "DIRECT",
  "AIRBNB",
  "VRBO",
  "BOOKING_COM",
  "EXPEDIA",
  "OTHER",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
  "VOIDED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BANK_TRANSFER",
  "CASH",
  "CHECK",
  "PAYPAL",
  "VENMO",
  "ZELLE",
  "PLATFORM_PAYOUT",
  "OTHER",
]);

export const cleaningJobTypeEnum = pgEnum("cleaning_job_type", [
  "TURNOVER",
  "DEEP_CLEAN",
  "MID_STAY",
  "INSPECTION",
  "MAINTENANCE",
  "POST_CHECKOUT",
]);

export const cleaningJobStatusEnum = pgEnum("cleaning_job_status", [
  "SCHEDULED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
]);

export const checklistItemStatusEnum = pgEnum("checklist_item_status", [
  "PENDING",
  "DONE",
  "SKIPPED",
  "FLAGGED",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "WELCOME",
  "CHECK_IN",
  "CHECK_OUT",
  "REVIEW_REQUEST",
  "FOLLOW_UP",
  "CUSTOM",
  "AUTOMATED",
  "CONCIERGE",
]);

export const messageChannelEnum = pgEnum("message_channel", [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "IN_APP",
  "PLATFORM",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "DRAFT",
  "SCHEDULED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "BOUNCED",
]);

export const sentimentEnum = pgEnum("sentiment", [
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "MIXED",
]);

export const expenseCategoryEnum = pgEnum("expense_category", [
  "CLEANING",
  "MAINTENANCE",
  "SUPPLIES",
  "UTILITIES",
  "INSURANCE",
  "MORTGAGE",
  "TAXES",
  "MARKETING",
  "SOFTWARE",
  "FURNISHING",
  "LANDSCAPING",
  "PEST_CONTROL",
  "LEGAL",
  "ACCOUNTING",
  "OTHER",
]);

export const expenseStatusEnum = pgEnum("expense_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
  "REIMBURSED",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "SENT",
  "VIEWED",
  "PAID",
  "PARTIALLY_PAID",
  "OVERDUE",
  "CANCELLED",
  "VOID",
]);

export const reviewSourceEnum = pgEnum("review_source", [
  "AIRBNB",
  "VRBO",
  "GOOGLE",
  "DIRECT",
  "INTERNAL",
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "ACTIVE",
  "INACTIVE",
  "TERMINATED",
  "ON_LEAVE",
]);

export const employeeTypeEnum = pgEnum("employee_type", [
  "W2",
  "1099",
  "CONTRACT",
]);

export const payFrequencyEnum = pgEnum("pay_frequency", [
  "WEEKLY",
  "BIWEEKLY",
  "SEMIMONTHLY",
  "MONTHLY",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const journalEntryStatusEnum = pgEnum("journal_entry_status", [
  "DRAFT",
  "POSTED",
  "VOID",
]);

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "PURCHASE",
  "USAGE",
  "TRANSFER",
  "ADJUSTMENT",
  "RETURN",
  "DISPOSAL",
]);

export const noteEntityTypeEnum = pgEnum("note_entity_type", [
  "PROPERTY",
  "BOOKING",
  "GUEST",
  "CLEANING_JOB",
  "EXPENSE",
  "INVOICE",
  "EMPLOYEE",
  "GENERAL",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
  "APPROVE",
  "REJECT",
]);

// ============================================
// USERS & AUTHENTICATION
// ============================================

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").default("GUEST").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_is_active_idx").on(table.isActive),
    index("users_role_active_idx").on(table.role, table.isActive),
    index("users_created_at_idx").on(table.createdAt),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  cleaningJobs: many(cleaningJobs),
  expenses: many(expenses),
  approvedMessages: many(messages, { relationName: "approvedBy" }),
  notes: many(notes),
}));

// ============================================
// PROPERTIES
// ============================================

export const properties = pgTable(
  "properties",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    address: text("address").notNull(),
    city: text("city").default("Midland").notNull(),
    state: text("state").default("TX").notNull(),
    zipCode: text("zip_code"),
    latitude: real("latitude"),
    longitude: real("longitude"),

    // Property details
    bedrooms: integer("bedrooms").notNull(),
    bathrooms: real("bathrooms").notNull(),
    maxGuests: integer("max_guests").notNull(),
    squareFeet: integer("square_feet"),
    propertyType: propertyTypeEnum("property_type")
      .default("HOUSE")
      .notNull(),

    // Amenities & info
    amenities: json("amenities").$type<string[]>(),
    wifiNetwork: text("wifi_network"),
    wifiPassword: text("wifi_password"),
    parkingInfo: text("parking_info"),
    checkInInstructions: text("check_in_instructions"),
    checkOutInstructions: text("check_out_instructions"),
    houseRules: text("house_rules"),

    // Cleaning
    cleaningChecklist: json("cleaning_checklist").$type<string[]>(),

    // Pricing (in cents)
    nightlyRate: integer("nightly_rate").notNull(),
    cleaningFee: integer("cleaning_fee"),
    securityDeposit: integer("security_deposit"),

    // External IDs
    airbnbId: text("airbnb_id"),
    vrboId: text("vrbo_id"),

    // Status
    status: propertyStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("properties_slug_idx").on(table.slug),
    index("properties_status_idx").on(table.status),
    index("properties_city_idx").on(table.city),
    index("properties_status_city_idx").on(table.status, table.city),
    index("properties_property_type_idx").on(table.propertyType),
    index("properties_bedrooms_idx").on(table.bedrooms),
    index("properties_nightly_rate_idx").on(table.nightlyRate),
    index("properties_airbnb_id_idx").on(table.airbnbId),
    index("properties_vrbo_id_idx").on(table.vrboId),
    index("properties_created_at_idx").on(table.createdAt),
  ]
);

export const propertiesRelations = relations(properties, ({ many, one }) => ({
  photos: many(propertyPhotos),
  bookings: many(bookings),
  cleaningJobs: many(cleaningJobs),
  smartLock: one(smartLocks),
  expenses: many(expenses),
  inventoryItems: many(inventoryItems),
  notes: many(notes),
}));

// ============================================
// PROPERTY PHOTOS
// ============================================

export const propertyPhotos = pgTable(
  "property_photos",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: text("caption"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("property_photos_property_id_idx").on(table.propertyId),
    index("property_photos_sort_order_idx").on(table.propertyId, table.sortOrder),
  ]
);

export const propertyPhotosRelations = relations(propertyPhotos, ({ one }) => ({
  property: one(properties, {
    fields: [propertyPhotos.propertyId],
    references: [properties.id],
  }),
}));

// ============================================
// GUESTS & CRM
// ============================================

export const guests = pgTable(
  "guests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),

    // Source
    platform: bookingPlatformEnum("platform").default("DIRECT").notNull(),
    platformId: text("platform_id"),

    // CRM data
    firstStay: timestamp("first_stay", { withTimezone: true }),
    lastStay: timestamp("last_stay", { withTimezone: true }),
    totalStays: integer("total_stays").default(0).notNull(),
    totalSpent: integer("total_spent").default(0).notNull(), // cents
    avgRating: real("avg_rating"),

    // Tags & preferences
    tags: json("tags").$type<string[]>(),
    notes: text("notes"),
    preferences: json("preferences").$type<Record<string, string | boolean | number>>(),

    // VIP status
    isVip: boolean("is_vip").default(false).notNull(),
    vipTier: text("vip_tier"),

    // Special dates
    birthday: timestamp("birthday", { withTimezone: true }),
    anniversary: timestamp("anniversary", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("guests_email_idx").on(table.email),
    index("guests_is_vip_idx").on(table.isVip),
    index("guests_platform_idx").on(table.platform),
    index("guests_platform_id_idx").on(table.platform, table.platformId),
    index("guests_total_stays_idx").on(table.totalStays),
    index("guests_total_spent_idx").on(table.totalSpent),
    index("guests_last_stay_idx").on(table.lastStay),
    index("guests_vip_spent_idx").on(table.isVip, table.totalSpent),
    index("guests_created_at_idx").on(table.createdAt),
    index("guests_birthday_idx").on(table.birthday),
  ]
);

export const guestsRelations = relations(guests, ({ many }) => ({
  bookings: many(bookings),
  messages: many(messages),
  conciergeQueries: many(conciergeQueries),
  reviews: many(reviews),
  invoices: many(invoices),
  notes: many(notes),
}));

// ============================================
// BOOKINGS
// ============================================

export const bookings = pgTable(
  "bookings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id),
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id),

    // Dates
    checkIn: timestamp("check_in", { withTimezone: true }).notNull(),
    checkOut: timestamp("check_out", { withTimezone: true }).notNull(),

    // Details
    guestCount: integer("guest_count").default(1).notNull(),
    platform: bookingPlatformEnum("platform").default("DIRECT").notNull(),
    confirmCode: text("confirm_code"),

    // Pricing (all in cents)
    nightlyRate: integer("nightly_rate").notNull(),
    totalNights: integer("total_nights").notNull(),
    subtotal: integer("subtotal").notNull(),
    cleaningFee: integer("cleaning_fee"),
    serviceFee: integer("service_fee"),
    taxes: integer("taxes"),
    totalPrice: integer("total_price").notNull(),

    // Access
    accessCode: text("access_code"),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),

    // Status
    status: bookingStatusEnum("status").default("CONFIRMED").notNull(),
    specialRequests: text("special_requests"),
    internalNotes: text("internal_notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("bookings_property_id_idx").on(table.propertyId),
    index("bookings_guest_id_idx").on(table.guestId),
    index("bookings_check_in_idx").on(table.checkIn),
    index("bookings_check_out_idx").on(table.checkOut),
    index("bookings_status_idx").on(table.status),
    index("bookings_property_check_in_idx").on(table.propertyId, table.checkIn),
    index("bookings_property_status_idx").on(table.propertyId, table.status),
    index("bookings_property_dates_idx").on(table.propertyId, table.checkIn, table.checkOut),
    index("bookings_platform_status_idx").on(table.platform, table.status),
    index("bookings_platform_idx").on(table.platform),
    index("bookings_created_at_idx").on(table.createdAt),
    index("bookings_confirm_code_idx").on(table.confirmCode),
  ]
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  property: one(properties, {
    fields: [bookings.propertyId],
    references: [properties.id],
  }),
  guest: one(guests, {
    fields: [bookings.guestId],
    references: [guests.id],
  }),
  cleaningJob: one(cleaningJobs),
  messages: many(messages),
  payments: many(bookingPayments),
  review: one(reviews),
  invoice: one(invoices),
  notes: many(notes),
}));

// ============================================
// BOOKING PAYMENTS
// ============================================

export const bookingPayments = pgTable(
  "booking_payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    // Payment details (in cents)
    amount: integer("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").default("PENDING").notNull(),

    // External reference
    transactionId: text("transaction_id"),
    processorRef: text("processor_ref"),
    platformPayoutId: text("platform_payout_id"),

    // Refund tracking (in cents)
    refundAmount: integer("refund_amount"),
    refundReason: text("refund_reason"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),

    // Metadata
    metadata: json("metadata").$type<Record<string, unknown>>(),
    notes: text("notes"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("booking_payments_booking_id_idx").on(table.bookingId),
    index("booking_payments_status_idx").on(table.status),
    index("booking_payments_method_idx").on(table.method),
    index("booking_payments_paid_at_idx").on(table.paidAt),
    index("booking_payments_transaction_id_idx").on(table.transactionId),
    index("booking_payments_created_at_idx").on(table.createdAt),
  ]
);

export const bookingPaymentsRelations = relations(bookingPayments, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingPayments.bookingId],
    references: [bookings.id],
  }),
}));

// ============================================
// CLEANING JOBS
// ============================================

export const cleaningJobs = pgTable(
  "cleaning_jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id),
    cleanerId: text("cleaner_id").references(() => users.id),
    bookingId: text("booking_id").references(() => bookings.id),

    // Scheduling
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Type & status
    jobType: cleaningJobTypeEnum("job_type").default("TURNOVER").notNull(),
    status: cleaningJobStatusEnum("status").default("SCHEDULED").notNull(),

    // GPS verification
    checkInLat: real("check_in_lat"),
    checkInLng: real("check_in_lng"),
    checkOutLat: real("check_out_lat"),
    checkOutLng: real("check_out_lng"),

    // Checklist & photos
    checklistProgress: json("checklist_progress").$type<{ item: string; status: string; notes?: string }[]>(),
    photos: json("photos").$type<{ url: string; caption?: string; takenAt?: string }[]>(),

    // Quality
    score: integer("score"),
    scoreFeedback: text("score_feedback"),

    // Notes
    notes: text("notes"),
    issues: text("issues"),

    // Duration
    durationMins: integer("duration_mins"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("cleaning_jobs_booking_id_idx").on(table.bookingId),
    index("cleaning_jobs_property_id_idx").on(table.propertyId),
    index("cleaning_jobs_cleaner_id_idx").on(table.cleanerId),
    index("cleaning_jobs_status_idx").on(table.status),
    index("cleaning_jobs_scheduled_at_idx").on(table.scheduledAt),
    index("cleaning_jobs_property_schedule_idx").on(table.propertyId, table.scheduledAt),
    index("cleaning_jobs_cleaner_status_idx").on(table.cleanerId, table.status),
    index("cleaning_jobs_cleaner_schedule_idx").on(table.cleanerId, table.scheduledAt),
    index("cleaning_jobs_schedule_status_idx").on(table.scheduledAt, table.status),
    index("cleaning_jobs_type_status_idx").on(table.jobType, table.status),
    index("cleaning_jobs_created_at_idx").on(table.createdAt),
    index("cleaning_jobs_completed_at_idx").on(table.completedAt),
  ]
);

export const cleaningJobsRelations = relations(cleaningJobs, ({ one, many }) => ({
  property: one(properties, {
    fields: [cleaningJobs.propertyId],
    references: [properties.id],
  }),
  cleaner: one(users, {
    fields: [cleaningJobs.cleanerId],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [cleaningJobs.bookingId],
    references: [bookings.id],
  }),
  checklist: many(cleaningChecklists),
  notes: many(notes),
}));

// ============================================
// CLEANING CHECKLISTS
// ============================================

export const cleaningChecklists = pgTable(
  "cleaning_checklists",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    cleaningJobId: text("cleaning_job_id")
      .notNull()
      .references(() => cleaningJobs.id, { onDelete: "cascade" }),

    // Checklist item
    area: text("area").notNull(),
    task: text("task").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),

    // Status
    status: checklistItemStatusEnum("status").default("PENDING").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: text("completed_by"),

    // Evidence
    photoUrl: text("photo_url"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("cleaning_checklists_job_id_idx").on(table.cleaningJobId),
    index("cleaning_checklists_status_idx").on(table.status),
    index("cleaning_checklists_area_idx").on(table.area),
    index("cleaning_checklists_job_sort_idx").on(table.cleaningJobId, table.sortOrder),
  ]
);

export const cleaningChecklistsRelations = relations(cleaningChecklists, ({ one }) => ({
  cleaningJob: one(cleaningJobs, {
    fields: [cleaningChecklists.cleaningJobId],
    references: [cleaningJobs.id],
  }),
}));

// ============================================
// SMART LOCKS
// ============================================

export const smartLocks = pgTable(
  "smart_locks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    // Device info
    brand: text("brand").notNull(),
    model: text("model"),
    deviceId: text("device_id").notNull(),
    serialNumber: text("serial_number"),

    // Current state
    currentCode: text("current_code"),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),
    batteryLevel: integer("battery_level"),
    lastActivity: timestamp("last_activity", { withTimezone: true }),
    isOnline: boolean("is_online").default(true).notNull(),

    // Access log
    accessLog: json("access_log").$type<{ code: string; timestamp: string; type: string; success: boolean }[]>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("smart_locks_property_id_idx").on(table.propertyId),
    index("smart_locks_brand_idx").on(table.brand),
    index("smart_locks_device_id_idx").on(table.deviceId),
    index("smart_locks_is_online_idx").on(table.isOnline),
  ]
);

export const smartLocksRelations = relations(smartLocks, ({ one }) => ({
  property: one(properties, {
    fields: [smartLocks.propertyId],
    references: [properties.id],
  }),
}));

// ============================================
// MESSAGING
// ============================================

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id),
    bookingId: text("booking_id").references(() => bookings.id),

    // Message details
    type: messageTypeEnum("type").notNull(),
    channel: messageChannelEnum("channel").default("EMAIL").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),

    // Status
    status: messageStatusEnum("status").default("DRAFT").notNull(),

    // Scheduling
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),

    // Approval
    approvedById: text("approved_by_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // AI analysis
    sentiment: sentimentEnum("sentiment"),
    sentimentScore: real("sentiment_score"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_guest_id_idx").on(table.guestId),
    index("messages_booking_id_idx").on(table.bookingId),
    index("messages_status_idx").on(table.status),
    index("messages_type_idx").on(table.type),
    index("messages_channel_idx").on(table.channel),
    index("messages_guest_type_idx").on(table.guestId, table.type),
    index("messages_status_scheduled_idx").on(table.status, table.scheduledFor),
    index("messages_sent_at_idx").on(table.sentAt),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_sentiment_idx").on(table.sentiment),
  ]
);

export const messagesRelations = relations(messages, ({ one }) => ({
  guest: one(guests, {
    fields: [messages.guestId],
    references: [guests.id],
  }),
  booking: one(bookings, {
    fields: [messages.bookingId],
    references: [bookings.id],
  }),
  approver: one(users, {
    relationName: "approvedBy",
    fields: [messages.approvedById],
    references: [users.id],
  }),
}));

// ============================================
// REVIEWS
// ============================================

export const reviews = pgTable(
  "reviews",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id),

    // Ratings (1-5 scale)
    overallRating: integer("overall_rating").notNull(),
    cleanlinessRating: integer("cleanliness_rating"),
    communicationRating: integer("communication_rating"),
    checkInRating: integer("check_in_rating"),
    accuracyRating: integer("accuracy_rating"),
    locationRating: integer("location_rating"),
    valueRating: integer("value_rating"),

    // Content
    title: text("title"),
    body: text("body"),
    hostResponse: text("host_response"),
    hostRespondedAt: timestamp("host_responded_at", { withTimezone: true }),

    // Source
    source: reviewSourceEnum("source").default("DIRECT").notNull(),
    externalId: text("external_id"),
    externalUrl: text("external_url"),

    // Visibility
    isPublic: boolean("is_public").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),

    // AI analysis
    sentiment: sentimentEnum("sentiment"),
    tags: json("tags").$type<string[]>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reviews_booking_id_idx").on(table.bookingId),
    index("reviews_guest_id_idx").on(table.guestId),
    index("reviews_property_id_idx").on(table.propertyId),
    index("reviews_overall_rating_idx").on(table.overallRating),
    index("reviews_source_idx").on(table.source),
    index("reviews_is_public_idx").on(table.isPublic),
    index("reviews_is_featured_idx").on(table.isFeatured),
    index("reviews_property_rating_idx").on(table.propertyId, table.overallRating),
    index("reviews_created_at_idx").on(table.createdAt),
    index("reviews_sentiment_idx").on(table.sentiment),
  ]
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  guest: one(guests, {
    fields: [reviews.guestId],
    references: [guests.id],
  }),
  property: one(properties, {
    fields: [reviews.propertyId],
    references: [properties.id],
  }),
}));

// ============================================
// INVOICES
// ============================================

export const invoices = pgTable(
  "invoices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    invoiceNumber: text("invoice_number").notNull(),
    bookingId: text("booking_id").references(() => bookings.id),
    guestId: text("guest_id")
      .notNull()
      .references(() => guests.id),
    propertyId: text("property_id").references(() => properties.id),

    // Status
    status: invoiceStatusEnum("status").default("DRAFT").notNull(),

    // Dates
    issueDate: timestamp("issue_date", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    paidDate: timestamp("paid_date", { withTimezone: true }),

    // Amounts (in cents)
    subtotal: integer("subtotal").notNull(),
    taxAmount: integer("tax_amount").default(0).notNull(),
    discountAmount: integer("discount_amount").default(0).notNull(),
    totalAmount: integer("total_amount").notNull(),
    amountPaid: integer("amount_paid").default(0).notNull(),
    balanceDue: integer("balance_due").notNull(),

    // Details
    notes: text("notes"),
    terms: text("terms"),
    footerText: text("footer_text"),

    // Metadata
    metadata: json("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("invoices_invoice_number_idx").on(table.invoiceNumber),
    index("invoices_booking_id_idx").on(table.bookingId),
    index("invoices_guest_id_idx").on(table.guestId),
    index("invoices_property_id_idx").on(table.propertyId),
    index("invoices_status_idx").on(table.status),
    index("invoices_issue_date_idx").on(table.issueDate),
    index("invoices_due_date_idx").on(table.dueDate),
    index("invoices_status_due_date_idx").on(table.status, table.dueDate),
    index("invoices_created_at_idx").on(table.createdAt),
  ]
);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [invoices.bookingId],
    references: [bookings.id],
  }),
  guest: one(guests, {
    fields: [invoices.guestId],
    references: [guests.id],
  }),
  property: one(properties, {
    fields: [invoices.propertyId],
    references: [properties.id],
  }),
  lineItems: many(invoiceLineItems),
}));

// ============================================
// INVOICE LINE ITEMS
// ============================================

export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),

    // Item details
    description: text("description").notNull(),
    quantity: real("quantity").default(1).notNull(),
    unitPrice: integer("unit_price").notNull(), // cents
    amount: integer("amount").notNull(), // cents (quantity * unitPrice)
    sortOrder: integer("sort_order").default(0).notNull(),

    // Categorization
    category: text("category"),
    taxable: boolean("taxable").default(true).notNull(),

    // Date range (for nightly charges)
    dateFrom: timestamp("date_from", { withTimezone: true }),
    dateTo: timestamp("date_to", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
    index("invoice_line_items_category_idx").on(table.category),
    index("invoice_line_items_invoice_sort_idx").on(table.invoiceId, table.sortOrder),
  ]
);

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
}));

// ============================================
// EXPENSES
// ============================================

export const expenses = pgTable(
  "expenses",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id),
    createdById: text("created_by_id").references(() => users.id),

    // Expense details
    category: expenseCategoryEnum("category").notNull(),
    subcategory: text("subcategory"),
    amount: integer("amount").notNull(), // cents
    description: text("description").notNull(),
    vendor: text("vendor"),

    // Date
    date: timestamp("date", { withTimezone: true }).notNull(),

    // Receipt
    receiptUrl: text("receipt_url"),

    // Tax
    isTaxDeductible: boolean("is_tax_deductible").default(true).notNull(),
    taxCategory: text("tax_category"),

    // Status
    status: expenseStatusEnum("status").default("PENDING").notNull(),

    // Notes
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("expenses_property_id_idx").on(table.propertyId),
    index("expenses_created_by_id_idx").on(table.createdById),
    index("expenses_category_idx").on(table.category),
    index("expenses_date_idx").on(table.date),
    index("expenses_property_date_idx").on(table.propertyId, table.date),
    index("expenses_property_category_idx").on(table.propertyId, table.category),
    index("expenses_category_date_idx").on(table.category, table.date),
    index("expenses_status_idx").on(table.status),
    index("expenses_is_tax_deductible_idx").on(table.isTaxDeductible),
    index("expenses_tax_category_idx").on(table.isTaxDeductible, table.taxCategory),
    index("expenses_vendor_idx").on(table.vendor),
    index("expenses_created_at_idx").on(table.createdAt),
  ]
);

export const expensesRelations = relations(expenses, ({ one }) => ({
  property: one(properties, {
    fields: [expenses.propertyId],
    references: [properties.id],
  }),
  createdBy: one(users, {
    fields: [expenses.createdById],
    references: [users.id],
  }),
}));

// ============================================
// EMPLOYEES
// ============================================

export const employees = pgTable(
  "employees",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),

    // Employment
    employeeType: employeeTypeEnum("employee_type").default("1099").notNull(),
    title: text("title"),
    department: text("department"),
    hireDate: timestamp("hire_date", { withTimezone: true }).notNull(),
    terminationDate: timestamp("termination_date", { withTimezone: true }),
    status: employeeStatusEnum("status").default("ACTIVE").notNull(),

    // Compensation (in cents)
    hourlyRate: integer("hourly_rate"),
    salaryAmount: integer("salary_amount"),
    payFrequency: payFrequencyEnum("pay_frequency").default("BIWEEKLY").notNull(),

    // Tax info
    ssn: text("ssn"), // encrypted at app layer
    taxFilingStatus: text("tax_filing_status"),
    w4Allowances: integer("w4_allowances"),
    stateWithholding: boolean("state_withholding").default(true).notNull(),

    // Direct deposit
    bankName: text("bank_name"),
    bankRoutingNumber: text("bank_routing_number"),
    bankAccountNumber: text("bank_account_number"),

    // Emergency contact
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),

    // Notes & config
    notes: text("notes"),
    config: json("config").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("employees_email_idx").on(table.email),
    index("employees_user_id_idx").on(table.userId),
    index("employees_status_idx").on(table.status),
    index("employees_employee_type_idx").on(table.employeeType),
    index("employees_department_idx").on(table.department),
    index("employees_hire_date_idx").on(table.hireDate),
    index("employees_status_type_idx").on(table.status, table.employeeType),
    index("employees_created_at_idx").on(table.createdAt),
  ]
);

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  paychecks: many(paychecks),
}));

// ============================================
// PAY PERIODS
// ============================================

export const payPeriods = pgTable(
  "pay_periods",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Period dates
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    payDate: timestamp("pay_date", { withTimezone: true }).notNull(),

    // Status
    status: text("status").default("OPEN").notNull(), // OPEN, PROCESSING, CLOSED

    // Totals (in cents)
    totalGross: integer("total_gross").default(0).notNull(),
    totalDeductions: integer("total_deductions").default(0).notNull(),
    totalNet: integer("total_net").default(0).notNull(),
    totalEmployerTaxes: integer("total_employer_taxes").default(0).notNull(),

    // Notes
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pay_periods_start_date_idx").on(table.startDate),
    index("pay_periods_end_date_idx").on(table.endDate),
    index("pay_periods_pay_date_idx").on(table.payDate),
    index("pay_periods_status_idx").on(table.status),
    index("pay_periods_dates_idx").on(table.startDate, table.endDate),
  ]
);

export const payPeriodsRelations = relations(payPeriods, ({ many }) => ({
  paychecks: many(paychecks),
}));

// ============================================
// PAYCHECKS
// ============================================

export const paychecks = pgTable(
  "paychecks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id),
    payPeriodId: text("pay_period_id")
      .notNull()
      .references(() => payPeriods.id),

    // Hours
    regularHours: real("regular_hours").default(0).notNull(),
    overtimeHours: real("overtime_hours").default(0).notNull(),

    // Amounts (in cents)
    grossPay: integer("gross_pay").notNull(),
    netPay: integer("net_pay").notNull(),

    // Tax withholdings (in cents)
    federalTax: integer("federal_tax").default(0).notNull(),
    stateTax: integer("state_tax").default(0).notNull(),
    socialSecurity: integer("social_security").default(0).notNull(),
    medicare: integer("medicare").default(0).notNull(),

    // Employer taxes (in cents)
    employerSocialSecurity: integer("employer_social_security").default(0).notNull(),
    employerMedicare: integer("employer_medicare").default(0).notNull(),
    employerFuta: integer("employer_futa").default(0).notNull(),
    employerSuta: integer("employer_suta").default(0).notNull(),

    // Status
    status: text("status").default("DRAFT").notNull(), // DRAFT, APPROVED, PAID, VOID
    paidAt: timestamp("paid_at", { withTimezone: true }),

    // Metadata
    notes: text("notes"),
    metadata: json("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("paychecks_employee_id_idx").on(table.employeeId),
    index("paychecks_pay_period_id_idx").on(table.payPeriodId),
    index("paychecks_status_idx").on(table.status),
    index("paychecks_employee_period_idx").on(table.employeeId, table.payPeriodId),
    index("paychecks_paid_at_idx").on(table.paidAt),
    index("paychecks_created_at_idx").on(table.createdAt),
  ]
);

export const paychecksRelations = relations(paychecks, ({ one, many }) => ({
  employee: one(employees, {
    fields: [paychecks.employeeId],
    references: [employees.id],
  }),
  payPeriod: one(payPeriods, {
    fields: [paychecks.payPeriodId],
    references: [payPeriods.id],
  }),
  deductions: many(paycheckDeductions),
}));

// ============================================
// PAYCHECK DEDUCTIONS
// ============================================

export const paycheckDeductions = pgTable(
  "paycheck_deductions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    paycheckId: text("paycheck_id")
      .notNull()
      .references(() => paychecks.id, { onDelete: "cascade" }),

    // Deduction details
    type: text("type").notNull(), // HEALTH_INSURANCE, DENTAL, 401K, GARNISHMENT, etc.
    description: text("description").notNull(),
    amount: integer("amount").notNull(), // cents
    isPreTax: boolean("is_pre_tax").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("paycheck_deductions_paycheck_id_idx").on(table.paycheckId),
    index("paycheck_deductions_type_idx").on(table.type),
  ]
);

export const paycheckDeductionsRelations = relations(paycheckDeductions, ({ one }) => ({
  paycheck: one(paychecks, {
    fields: [paycheckDeductions.paycheckId],
    references: [paychecks.id],
  }),
}));

// ============================================
// CHART OF ACCOUNTS
// ============================================

export const accounts = pgTable(
  "accounts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Account info
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    accountType: accountTypeEnum("account_type").notNull(),

    // Hierarchy
    parentId: text("parent_id"),
    isHeader: boolean("is_header").default(false).notNull(),

    // State
    isActive: boolean("is_active").default(true).notNull(),
    isBankAccount: boolean("is_bank_account").default(false).notNull(),

    // Current balance (in cents)
    balance: integer("balance").default(0).notNull(),

    // Tax mapping
    taxLineCode: text("tax_line_code"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("accounts_code_idx").on(table.code),
    index("accounts_account_type_idx").on(table.accountType),
    index("accounts_parent_id_idx").on(table.parentId),
    index("accounts_is_active_idx").on(table.isActive),
    index("accounts_type_active_idx").on(table.accountType, table.isActive),
    index("accounts_name_idx").on(table.name),
  ]
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: "parentChild",
  }),
  children: many(accounts, { relationName: "parentChild" }),
  journalLines: many(journalLines),
}));

// ============================================
// JOURNAL ENTRIES (double-entry bookkeeping)
// ============================================

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Entry info
    entryNumber: serial("entry_number"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    description: text("description").notNull(),
    reference: text("reference"),

    // Source
    sourceType: text("source_type"), // BOOKING, EXPENSE, PAYROLL, MANUAL
    sourceId: text("source_id"),

    // Status
    status: journalEntryStatusEnum("status").default("DRAFT").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: text("posted_by"),

    // Totals (in cents) - must balance
    totalDebit: integer("total_debit").default(0).notNull(),
    totalCredit: integer("total_credit").default(0).notNull(),

    // Notes
    notes: text("notes"),
    metadata: json("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("journal_entries_date_idx").on(table.date),
    index("journal_entries_status_idx").on(table.status),
    index("journal_entries_source_idx").on(table.sourceType, table.sourceId),
    index("journal_entries_reference_idx").on(table.reference),
    index("journal_entries_posted_at_idx").on(table.postedAt),
    index("journal_entries_created_at_idx").on(table.createdAt),
    index("journal_entries_date_status_idx").on(table.date, table.status),
  ]
);

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalLines),
}));

// ============================================
// JOURNAL LINES
// ============================================

export const journalLines = pgTable(
  "journal_lines",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    journalEntryId: text("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),

    // Amounts (in cents) - one of these should be 0
    debit: integer("debit").default(0).notNull(),
    credit: integer("credit").default(0).notNull(),

    // Description for this line
    description: text("description"),

    // Property attribution (for per-property P&L)
    propertyId: text("property_id").references(() => properties.id),

    sortOrder: integer("sort_order").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("journal_lines_journal_entry_id_idx").on(table.journalEntryId),
    index("journal_lines_account_id_idx").on(table.accountId),
    index("journal_lines_property_id_idx").on(table.propertyId),
    index("journal_lines_entry_sort_idx").on(table.journalEntryId, table.sortOrder),
  ]
);

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id],
  }),
  property: one(properties, {
    fields: [journalLines.propertyId],
    references: [properties.id],
  }),
}));

// ============================================
// INVENTORY
// ============================================

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id),

    // Item info
    name: text("name").notNull(),
    sku: text("sku"),
    category: text("category").notNull(),
    description: text("description"),

    // Quantity
    quantity: integer("quantity").default(0).notNull(),
    minQuantity: integer("min_quantity").default(0).notNull(),
    maxQuantity: integer("max_quantity"),
    unit: text("unit").default("each").notNull(),

    // Cost (in cents)
    unitCost: integer("unit_cost"),
    totalValue: integer("total_value"),

    // Vendor
    preferredVendor: text("preferred_vendor"),
    reorderUrl: text("reorder_url"),

    // Location
    storageLocation: text("storage_location"),

    // State
    isActive: boolean("is_active").default(true).notNull(),
    lastCountedAt: timestamp("last_counted_at", { withTimezone: true }),

    // Metadata
    photos: json("photos").$type<string[]>(),
    metadata: json("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inventory_items_property_id_idx").on(table.propertyId),
    index("inventory_items_category_idx").on(table.category),
    index("inventory_items_sku_idx").on(table.sku),
    index("inventory_items_is_active_idx").on(table.isActive),
    index("inventory_items_property_category_idx").on(table.propertyId, table.category),
    index("inventory_items_low_stock_idx").on(table.quantity, table.minQuantity),
    index("inventory_items_created_at_idx").on(table.createdAt),
  ]
);

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  property: one(properties, {
    fields: [inventoryItems.propertyId],
    references: [properties.id],
  }),
  movements: many(inventoryMovements),
}));

// ============================================
// INVENTORY MOVEMENTS
// ============================================

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),

    // Movement details
    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),

    // Cost (in cents)
    unitCost: integer("unit_cost"),
    totalCost: integer("total_cost"),

    // Reference
    reason: text("reason"),
    reference: text("reference"),
    performedBy: text("performed_by"),

    // Notes
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("inventory_movements_item_id_idx").on(table.inventoryItemId),
    index("inventory_movements_type_idx").on(table.type),
    index("inventory_movements_created_at_idx").on(table.createdAt),
    index("inventory_movements_item_date_idx").on(table.inventoryItemId, table.createdAt),
    index("inventory_movements_performed_by_idx").on(table.performedBy),
  ]
);

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  inventoryItem: one(inventoryItems, {
    fields: [inventoryMovements.inventoryItemId],
    references: [inventoryItems.id],
  }),
}));

// ============================================
// AI CONCIERGE
// ============================================

export const conciergeQueries = pgTable(
  "concierge_queries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guestId: text("guest_id").references(() => guests.id),
    propertyId: text("property_id").references(() => properties.id),

    // Query & response
    query: text("query").notNull(),
    response: text("response").notNull(),

    // Classification
    category: text("category"),
    intent: text("intent"),

    // Quality
    wasHelpful: boolean("was_helpful"),
    rating: integer("rating"),

    // Voice
    voiceUsed: boolean("voice_used").default(false).notNull(),
    audioUrl: text("audio_url"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("concierge_queries_guest_id_idx").on(table.guestId),
    index("concierge_queries_property_id_idx").on(table.propertyId),
    index("concierge_queries_category_idx").on(table.category),
    index("concierge_queries_created_at_idx").on(table.createdAt),
    index("concierge_queries_guest_date_idx").on(table.guestId, table.createdAt),
  ]
);

export const conciergeQueriesRelations = relations(conciergeQueries, ({ one }) => ({
  guest: one(guests, {
    fields: [conciergeQueries.guestId],
    references: [guests.id],
  }),
  property: one(properties, {
    fields: [conciergeQueries.propertyId],
    references: [properties.id],
  }),
}));

// ============================================
// NOTES (polymorphic, attach to any entity)
// ============================================

export const notes = pgTable(
  "notes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text("author_id").references(() => users.id),

    // Polymorphic reference
    entityType: noteEntityTypeEnum("entity_type").notNull(),
    entityId: text("entity_id").notNull(),

    // Content
    title: text("title"),
    body: text("body").notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    isInternal: boolean("is_internal").default(true).notNull(),

    // Attachments
    attachments: json("attachments").$type<{ url: string; name: string; type: string; size: number }[]>(),

    // Tags
    tags: json("tags").$type<string[]>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notes_author_id_idx").on(table.authorId),
    index("notes_entity_idx").on(table.entityType, table.entityId),
    index("notes_entity_type_idx").on(table.entityType),
    index("notes_is_pinned_idx").on(table.isPinned),
    index("notes_created_at_idx").on(table.createdAt),
    index("notes_entity_pinned_idx").on(table.entityType, table.entityId, table.isPinned),
  ]
);

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, {
    fields: [notes.authorId],
    references: [users.id],
  }),
}));

// ============================================
// SETTINGS (key-value config)
// ============================================

export const settings = pgTable(
  "settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    value: text("value").notNull(),
    description: text("description"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("settings_key_idx").on(table.key)]
);

// ============================================
// AUDIT LOG
// ============================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id"),
    action: auditActionEnum("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    oldValues: json("old_values").$type<Record<string, unknown>>(),
    newValues: json("new_values").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_entity_idx").on(table.entity),
    index("audit_logs_entity_id_idx").on(table.entity, table.entityId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_user_date_idx").on(table.userId, table.createdAt),
    index("audit_logs_entity_action_idx").on(table.entity, table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;

export type PropertyPhoto = typeof propertyPhotos.$inferSelect;
export type NewPropertyPhoto = typeof propertyPhotos.$inferInsert;

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type BookingPayment = typeof bookingPayments.$inferSelect;
export type NewBookingPayment = typeof bookingPayments.$inferInsert;

export type CleaningJob = typeof cleaningJobs.$inferSelect;
export type NewCleaningJob = typeof cleaningJobs.$inferInsert;

export type CleaningChecklist = typeof cleaningChecklists.$inferSelect;
export type NewCleaningChecklist = typeof cleaningChecklists.$inferInsert;

export type SmartLock = typeof smartLocks.$inferSelect;
export type NewSmartLock = typeof smartLocks.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export type PayPeriod = typeof payPeriods.$inferSelect;
export type NewPayPeriod = typeof payPeriods.$inferInsert;

export type Paycheck = typeof paychecks.$inferSelect;
export type NewPaycheck = typeof paychecks.$inferInsert;

export type PaycheckDeduction = typeof paycheckDeductions.$inferSelect;
export type NewPaycheckDeduction = typeof paycheckDeductions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;

export type JournalLine = typeof journalLines.$inferSelect;
export type NewJournalLine = typeof journalLines.$inferInsert;

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;

export type ConciergeQuery = typeof conciergeQueries.$inferSelect;
export type NewConciergeQuery = typeof conciergeQueries.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
