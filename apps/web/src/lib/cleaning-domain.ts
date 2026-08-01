/**
 * Right at Home BnB - Cleaning domain: checklist data and pure helpers.
 *
 * Split out of `cleaning-system.ts`, which glued this static domain to a
 * Firestore data layer. Nothing ever called the Firestore half -- all three
 * consumers (the cleaning API route and the cleaning / notifications pages)
 * imported only types, the master checklist and pure lookups -- yet importing
 * any of them pulled `firebase/firestore` into the module graph, including
 * into a server route that has been fully on Prisma for some time.
 *
 * The Firestore half was also a superseded twin of `app/api/cleaning/route.ts`:
 * createCleaningReport/startCleaningJob/updateChecklistItem/addCleaningIssue/
 * addVerificationPhoto/completeCleaningJob mirrored its create/start/
 * complete_item/report_issue/add_photo/complete actions, minus the property
 * scoping and completion gates the route enforces. It is deleted rather than
 * migrated: rewriting an unreferenced duplicate against Postgres would just
 * recreate the ambiguity about which one is authoritative.
 *
 * Keep this module free of I/O. It is imported by both client components and
 * server routes precisely because it has no data layer.
 *
 * @author ECHO OMEGA PRIME
 */


// ============================================
// TYPES
// ============================================

export interface ChecklistItem {
  id: string;
  category: 'bedroom' | 'bathroom' | 'kitchen' | 'living' | 'exterior' | 'general';
  task: string;
  description?: string;
  requiresPhoto: boolean;
  order: number;
}

export interface CompletedChecklistItem {
  itemId: string;
  completed: boolean;
  completedAt?: Date;
  photoUrl?: string;
  notes?: string;
}

export interface CleaningIssue {
  id: string;
  category: 'maintenance' | 'damage' | 'supply' | 'safety' | 'other';
  severity: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  location: string;
  photoUrls: string[];
  reportedAt: Date;
  status: 'reported' | 'acknowledged' | 'in_progress' | 'resolved';
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface ServiceRequest {
  id: string;
  reportId: string;
  propertyId: string;
  propertyAddress: string;
  type: 'yard' | 'handyman' | 'plumber' | 'electrician' | 'hvac' | 'appliance';
  urgency: 'routine' | 'soon' | 'urgent';
  description: string;
  photoUrls: string[];
  createdAt: Date;
  createdBy: string;
  status: 'pending' | 'notified' | 'scheduled' | 'completed';
  assignedTo?: string;
  scheduledFor?: Date;
  completedAt?: Date;
  completionNotes?: string;
}

export interface CompletionQuestions {
  yardWorkNeeded: boolean;
  yardWorkNotes?: string;
  yardWorkPhotos?: string[];
  maintenanceNeeded: boolean;
  maintenanceNotes?: string;
  maintenancePhotos?: string[];
  hvacIssues: boolean;
  hvacNotes?: string;
  applianceIssues: boolean;
  applianceNotes?: string;
  guestLeftItems: boolean;
  guestItemsDescription?: string;
  guestItemsPhotos?: string[];
}

export type CleaningJobType = 'turnover' | 'deep_clean' | 'inspection' | 'touch_up';

export interface CleaningReport {
  id: string;
  propertyId: string;
  propertyName: string;
  cleanerId: string;
  cleanerName: string;
  bookingId?: string;
  jobType: 'turnover' | 'deep_clean' | 'inspection' | 'touch_up';
  status: 'not_started' | 'in_progress' | 'completed' | 'needs_review';
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  checklist: CompletedChecklistItem[];
  issues: CleaningIssue[];
  overallNotes?: string;
  timeSpentMinutes?: number;
  suppliesUsed?: string[];
  suppliesNeeded?: string[];
  verificationPhotos: {
    area: string;
    photoUrl: string;
    takenAt: Date;
  }[];
  rating?: number; // Owner/manager rating
  feedback?: string;
  // New: Completion questions & service requests
  completionQuestions?: CompletionQuestions;
  serviceRequests?: ServiceRequest[];
}

// ============================================
// SERVICE PROVIDERS (Steven's contacts)
// ============================================

export interface ServiceProvider {
  id: string;
  name: string;
  company: string;
  type: ServiceRequest['type'];
  phone: string;
  email?: string;
  notes?: string;
}

// Service providers — add real vendor contacts here
export const serviceProviders: ServiceProvider[] = [];

// ============================================
// MASTER CHECKLIST (Same for all properties)
// ============================================

export const masterChecklist: ChecklistItem[] = [
  // BEDROOM
  { id: 'bed-1', category: 'bedroom', task: 'Strip all bedding', description: 'Remove sheets, pillowcases, duvet covers', requiresPhoto: false, order: 1 },
  { id: 'bed-2', category: 'bedroom', task: 'Check mattress for stains/damage', description: 'Report any issues found', requiresPhoto: false, order: 2 },
  { id: 'bed-3', category: 'bedroom', task: 'Make beds with fresh linens', description: 'Hospital corners, smooth finish', requiresPhoto: true, order: 3 },
  { id: 'bed-4', category: 'bedroom', task: 'Dust all surfaces', description: 'Nightstands, dressers, headboard', requiresPhoto: false, order: 4 },
  { id: 'bed-5', category: 'bedroom', task: 'Vacuum/mop floors', description: 'Under bed, corners, closet', requiresPhoto: false, order: 5 },
  { id: 'bed-6', category: 'bedroom', task: 'Clean mirrors', description: 'Streak-free finish', requiresPhoto: false, order: 6 },
  { id: 'bed-7', category: 'bedroom', task: 'Empty trash cans', description: 'Replace liner', requiresPhoto: false, order: 7 },
  { id: 'bed-8', category: 'bedroom', task: 'Check closet', description: 'Hangers aligned, extra blankets folded', requiresPhoto: false, order: 8 },
  { id: 'bed-9', category: 'bedroom', task: 'Final bedroom photo', description: 'Full room view showing made bed', requiresPhoto: true, order: 9 },

  // BATHROOM
  { id: 'bath-1', category: 'bathroom', task: 'Scrub toilet inside and out', description: 'Bowl, seat, base, behind', requiresPhoto: false, order: 1 },
  { id: 'bath-2', category: 'bathroom', task: 'Clean shower/tub', description: 'Walls, floor, doors, fixtures', requiresPhoto: true, order: 2 },
  { id: 'bath-3', category: 'bathroom', task: 'Clean sink and vanity', description: 'Faucet, drain, countertop', requiresPhoto: false, order: 3 },
  { id: 'bath-4', category: 'bathroom', task: 'Clean mirrors', description: 'Streak-free, check for spots', requiresPhoto: false, order: 4 },
  { id: 'bath-5', category: 'bathroom', task: 'Restock toiletries', description: 'Soap, shampoo, TP, tissues', requiresPhoto: false, order: 5 },
  { id: 'bath-6', category: 'bathroom', task: 'Replace towels', description: 'Bath, hand, washcloth - neatly folded', requiresPhoto: true, order: 6 },
  { id: 'bath-7', category: 'bathroom', task: 'Mop floor', description: 'Corners, behind toilet', requiresPhoto: false, order: 7 },
  { id: 'bath-8', category: 'bathroom', task: 'Empty trash', description: 'Replace liner', requiresPhoto: false, order: 8 },
  { id: 'bath-9', category: 'bathroom', task: 'Check drains', description: 'Clear any hair/debris', requiresPhoto: false, order: 9 },
  { id: 'bath-10', category: 'bathroom', task: 'Final bathroom photo', description: 'Full bathroom view', requiresPhoto: true, order: 10 },

  // KITCHEN
  { id: 'kit-1', category: 'kitchen', task: 'Clean all countertops', description: 'Sanitize, remove any items', requiresPhoto: false, order: 1 },
  { id: 'kit-2', category: 'kitchen', task: 'Clean stovetop', description: 'Burners, drip pans, surface', requiresPhoto: true, order: 2 },
  { id: 'kit-3', category: 'kitchen', task: 'Clean oven interior', description: 'Check for spills/food', requiresPhoto: false, order: 3 },
  { id: 'kit-4', category: 'kitchen', task: 'Clean microwave', description: 'Inside and outside', requiresPhoto: false, order: 4 },
  { id: 'kit-5', category: 'kitchen', task: 'Clean refrigerator', description: 'Inside shelves, drawers, exterior', requiresPhoto: true, order: 5 },
  { id: 'kit-6', category: 'kitchen', task: 'Run dishwasher if needed', description: 'Or hand wash remaining dishes', requiresPhoto: false, order: 6 },
  { id: 'kit-7', category: 'kitchen', task: 'Clean sink', description: 'Faucet, basin, disposal', requiresPhoto: false, order: 7 },
  { id: 'kit-8', category: 'kitchen', task: 'Wipe cabinet fronts', description: 'Remove fingerprints, spills', requiresPhoto: false, order: 8 },
  { id: 'kit-9', category: 'kitchen', task: 'Check dishes/utensils', description: 'Complete set, properly stored', requiresPhoto: false, order: 9 },
  { id: 'kit-10', category: 'kitchen', task: 'Clean coffee maker', description: 'Empty grounds, wipe clean', requiresPhoto: false, order: 10 },
  { id: 'kit-11', category: 'kitchen', task: 'Empty all trash', description: 'Kitchen trash, recycling', requiresPhoto: false, order: 11 },
  { id: 'kit-12', category: 'kitchen', task: 'Mop floor', description: 'All areas including under table', requiresPhoto: false, order: 12 },
  { id: 'kit-13', category: 'kitchen', task: 'Final kitchen photo', description: 'Full kitchen view', requiresPhoto: true, order: 13 },

  // LIVING ROOM
  { id: 'liv-1', category: 'living', task: 'Vacuum all furniture', description: 'Sofas, chairs, cushions', requiresPhoto: false, order: 1 },
  { id: 'liv-2', category: 'living', task: 'Fluff and arrange pillows', description: 'Decorative pillows placed nicely', requiresPhoto: false, order: 2 },
  { id: 'liv-3', category: 'living', task: 'Dust all surfaces', description: 'Tables, shelves, TV stand', requiresPhoto: false, order: 3 },
  { id: 'liv-4', category: 'living', task: 'Clean TV and remotes', description: 'Screen, sanitize remotes', requiresPhoto: false, order: 4 },
  { id: 'liv-5', category: 'living', task: 'Vacuum/mop floors', description: 'Under furniture, corners', requiresPhoto: false, order: 5 },
  { id: 'liv-6', category: 'living', task: 'Clean windows inside', description: 'Streak-free, check blinds', requiresPhoto: false, order: 6 },
  { id: 'liv-7', category: 'living', task: 'Check fireplace (if applicable)', description: 'Clean hearth, remove ash', requiresPhoto: false, order: 7 },
  { id: 'liv-8', category: 'living', task: 'Final living room photo', description: 'Full room view', requiresPhoto: true, order: 8 },

  // EXTERIOR
  { id: 'ext-1', category: 'exterior', task: 'Sweep porch/patio', description: 'Entry areas, outdoor seating', requiresPhoto: false, order: 1 },
  { id: 'ext-2', category: 'exterior', task: 'Wipe outdoor furniture', description: 'Tables, chairs', requiresPhoto: false, order: 2 },
  { id: 'ext-3', category: 'exterior', task: 'Check BBQ grill', description: 'Clean grates, empty grease trap', requiresPhoto: true, order: 3 },
  { id: 'ext-4', category: 'exterior', task: 'Check pool/hot tub (if applicable)', description: 'Water clarity, debris removal', requiresPhoto: true, order: 4 },
  { id: 'ext-5', category: 'exterior', task: 'Empty outdoor trash', description: 'Take to curb if needed', requiresPhoto: false, order: 5 },
  { id: 'ext-6', category: 'exterior', task: 'Check exterior lights', description: 'Porch, patio, walkway', requiresPhoto: false, order: 6 },
  { id: 'ext-7', category: 'exterior', task: 'Final exterior photo', description: 'Front of house', requiresPhoto: true, order: 7 },

  // GENERAL
  { id: 'gen-1', category: 'general', task: 'Check all light bulbs', description: 'Replace any burned out', requiresPhoto: false, order: 1 },
  { id: 'gen-2', category: 'general', task: 'Check smoke detectors', description: 'Test button, check battery', requiresPhoto: false, order: 2 },
  { id: 'gen-3', category: 'general', task: 'Set thermostat', description: '72°F or per instructions', requiresPhoto: false, order: 3 },
  { id: 'gen-4', category: 'general', task: 'Check door locks', description: 'All exterior doors lock properly', requiresPhoto: false, order: 4 },
  { id: 'gen-5', category: 'general', task: 'Final walkthrough', description: 'Check nothing left behind', requiresPhoto: false, order: 5 },
  { id: 'gen-6', category: 'general', task: 'Lock up and set code', description: 'Verify door code works', requiresPhoto: false, order: 6 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getChecklistByCategory(category: ChecklistItem['category']): ChecklistItem[] {
  return masterChecklist
    .filter(item => item.category === category)
    .sort((a, b) => a.order - b.order);
}

export function getChecklistForProperty(propertyId: string): ChecklistItem[] {
  // In the future, this could customize the checklist based on property configuration
  // For now, return the full master checklist sorted by order
  return [...masterChecklist].sort((a, b) => a.order - b.order);
}

export function getRequiredPhotoItems(): ChecklistItem[] {
  return masterChecklist.filter(item => item.requiresPhoto);
}

export function calculateCompletionPercentage(checklist: CompletedChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const completed = checklist.filter(item => item.completed).length;
  return Math.round((completed / checklist.length) * 100);
}

export function getCategoryCompletionStatus(
  checklist: CompletedChecklistItem[],
  category: ChecklistItem['category']
): { completed: number; total: number; percentage: number } {
  const categoryItems = masterChecklist.filter(item => item.category === category);
  const categoryItemIds = categoryItems.map(item => item.id);
  const completedItems = checklist.filter(
    item => categoryItemIds.includes(item.itemId) && item.completed
  );

  return {
    completed: completedItems.length,
    total: categoryItems.length,
    percentage: categoryItems.length > 0
      ? Math.round((completedItems.length / categoryItems.length) * 100)
      : 0,
  };
}

// ============================================
// NOTIFICATION / SERVICE-REQUEST TYPES
//
// The types stay; the Firestore readers and writers that used them do not.
// `app/notifications/page.tsx` consumes these as shapes only.
// ============================================

export interface OwnerNotification {
  id: string;
  type: 'service_request' | 'cleaning_complete' | 'urgent_issue' | 'guest_left_items';
  title: string;
  message: string;
  propertyId: string;
  propertyAddress: string;
  reportId: string;
  serviceRequestId?: string;
  photoUrls: string[];
  serviceType?: ServiceRequest['type'];
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  readAt?: Date;
  actionTaken?: 'dispatched_yard' | 'dispatched_handyman' | 'dispatched_other' | 'dismissed';
  actionTakenAt?: Date;
}

export function getServiceProvider(type: ServiceRequest['type']): ServiceProvider | undefined {
  return serviceProviders.find(p => p.type === type);
}

export function getAllServiceProviders(): ServiceProvider[] {
  return serviceProviders;
}
