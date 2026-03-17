/**
 * Right at Home BnB - Zod Validation Schemas
 * Schemas for all major entity creation and mutation operations.
 */

import { z } from 'zod';

// ============================================
// BOOKING
// ============================================

export const bookingCreateSchema = z.object({
  check_in: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'check_in must be a valid date string',
  }),
  check_out: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'check_out must be a valid date string',
  }),
  property_id: z.string().min(1, 'property_id is required'),
  guest_name: z.string().min(1, 'Guest name is required').max(200),
  guest_email: z.string().email('Invalid email address'),
  guest_phone: z.string().optional(),
  num_guests: z.number().int().min(1, 'At least 1 guest required').max(50),
  platform: z.enum(['DIRECT', 'AIRBNB', 'VRBO', 'BOOKING', 'OTHER']).default('DIRECT'),
  special_requests: z.string().max(2000).optional(),
  pet_fee: z.boolean().default(false),
}).refine(
  (data) => new Date(data.check_out) > new Date(data.check_in),
  { message: 'check_out must be after check_in', path: ['check_out'] }
);

// ============================================
// PROPERTY
// ============================================

export const propertyCreateSchema = z.object({
  name: z.string().min(1, 'Property name is required').max(200),
  address: z.string().min(1, 'Address is required').max(500),
  city: z.string().default('Midland'),
  state: z.string().length(2).default('TX'),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional(),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  max_guests: z.number().int().min(1).max(50),
  square_feet: z.number().int().positive().optional(),
  property_type: z.enum(['HOUSE', 'APARTMENT', 'CONDO', 'CABIN', 'STUDIO', 'TOWNHOUSE']).default('HOUSE'),
  base_rate_cents: z.number().int().min(0, 'Base rate cannot be negative'),
  cleaning_fee_cents: z.number().int().min(0).default(0),
  security_deposit_cents: z.number().int().min(0).default(0),
  amenities: z.array(z.string()).optional(),
  wifi_network: z.string().max(100).optional(),
  wifi_password: z.string().max(100).optional(),
  parking_info: z.string().max(500).optional(),
  check_in_instructions: z.string().max(2000).optional(),
  check_out_instructions: z.string().max(2000).optional(),
  house_rules: z.string().max(5000).optional(),
  airbnb_id: z.string().optional(),
  vrbo_id: z.string().optional(),
});

// ============================================
// GUEST
// ============================================

export const guestCreateSchema = z.object({
  name: z.string().min(1, 'Guest name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(30).optional(),
  platform: z.enum(['DIRECT', 'AIRBNB', 'VRBO', 'BOOKING', 'OTHER']).default('DIRECT'),
  platform_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(5000).optional(),
  preferences: z.string().max(5000).optional(),
  birthday: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'birthday must be a valid date string',
  }).optional(),
  anniversary: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'anniversary must be a valid date string',
  }).optional(),
});

// ============================================
// JOURNAL ENTRY (Double-entry bookkeeping)
// ============================================

const journalLineSchema = z.object({
  account_code: z.string().min(4).max(4),
  description: z.string().max(500).optional(),
  debit_cents: z.number().int().min(0).default(0),
  credit_cents: z.number().int().min(0).default(0),
}).refine(
  (line) => line.debit_cents > 0 || line.credit_cents > 0,
  { message: 'Each line must have a debit or credit amount' }
).refine(
  (line) => !(line.debit_cents > 0 && line.credit_cents > 0),
  { message: 'A line cannot have both debit and credit' }
);

export const journalEntrySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'date must be a valid date string',
  }),
  description: z.string().min(1, 'Description is required').max(500),
  ref_type: z.string().max(50).optional(),
  ref_id: z.string().optional(),
  property_id: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'A journal entry requires at least 2 lines'),
}).refine(
  (entry) => {
    const totalDebits = entry.lines.reduce((sum, l) => sum + (l.debit_cents || 0), 0);
    const totalCredits = entry.lines.reduce((sum, l) => sum + (l.credit_cents || 0), 0);
    return totalDebits === totalCredits;
  },
  { message: 'Total debits must equal total credits', path: ['lines'] }
);

// ============================================
// INVOICE
// ============================================

const invoiceLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).default(1),
  unit_price_cents: z.number().int(),
  amount_cents: z.number().int(),
});

export const invoiceCreateSchema = z.object({
  guest_id: z.string().min(1, 'guest_id is required'),
  booking_id: z.string().optional(),
  property_id: z.string().optional(),
  due_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'due_date must be a valid date string',
  }),
  lines: z.array(invoiceLineSchema).min(1, 'At least one invoice line is required'),
  notes: z.string().max(2000).optional(),
  tax_cents: z.number().int().min(0).default(0),
});

// ============================================
// EMPLOYEE
// ============================================

export const employeeCreateSchema = z.object({
  name: z.string().min(1, 'Employee name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(30).optional(),
  role: z.enum(['CLEANER', 'MAINTENANCE', 'MANAGER', 'INSPECTOR', 'DISPATCHER', 'ADMIN']),
  hourly_rate_cents: z.number().int().min(0, 'Hourly rate cannot be negative'),
  filing_status: z.enum(['single', 'married_joint', 'married_separate', 'head_of_household']).default('single'),
  allowances: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  start_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'start_date must be a valid date string',
  }),
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
});

// ============================================
// TASK
// ============================================

export const taskCreateSchema = z.object({
  property_id: z.string().min(1, 'property_id is required'),
  type: z.enum(['CLEANING', 'MAINTENANCE', 'INSPECTION', 'INVENTORY', 'EMERGENCY', 'YARD_CARE', 'PEST_CONTROL', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  description: z.string().min(1).max(2000),
  scheduled_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduled_date must be a valid date string',
  }),
  assigned_to: z.string().optional(),
  estimated_minutes: z.number().int().positive().optional(),
  booking_id: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

// ============================================
// EXPENSE
// ============================================

export const expenseCreateSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  amount_cents: z.number().int().min(1, 'Amount must be positive'),
  category: z.enum([
    'homeowner_payment', 'utilities', 'cleaning', 'maintenance',
    'yard_care', 'inventory', 'supplies', 'insurance', 'taxes',
    'marketing', 'software', 'commissions', 'pest_control',
    'laundry', 'api_costs', 'other',
  ]),
  subcategory: z.string().max(100).optional(),
  vendor: z.string().max(200).optional(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'date must be a valid date string',
  }),
  property_id: z.string().optional(),
  receipt_url: z.string().url().optional(),
  is_tax_deductible: z.boolean().default(true),
  tax_category: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// ============================================
// REVIEW RESPONSE
// ============================================

export const reviewResponseSchema = z.object({
  response_text: z.string().min(10, 'Response must be at least 10 characters').max(5000),
});

// ============================================
// NOTE
// ============================================

export const noteCreateSchema = z.object({
  type: z.enum(['GENERAL', 'PROPERTY', 'GUEST', 'BOOKING', 'EMPLOYEE', 'FINANCIAL', 'MAINTENANCE']),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(10000),
  tags: z.array(z.string().max(50)).max(20).optional(),
  ref_id: z.string().optional(),
  ref_type: z.string().max(50).optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type BookingCreate = z.infer<typeof bookingCreateSchema>;
export type PropertyCreate = z.infer<typeof propertyCreateSchema>;
export type GuestCreate = z.infer<typeof guestCreateSchema>;
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type ExpenseCreate = z.infer<typeof expenseCreateSchema>;
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;
export type NoteCreate = z.infer<typeof noteCreateSchema>;
