/**
 * Right at Home BnB - Cleaning Crew System
 * Checklists, photo verification, and issue reporting
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

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

export const serviceProviders: ServiceProvider[] = [
  {
    id: 'yard-1',
    name: 'Midland Lawn Care',
    company: 'Midland Lawn & Landscape',
    type: 'yard',
    phone: '(432) 555-LAWN',
    email: 'service@midlandlawn.com',
    notes: 'Regular yard service. Can usually come within 24-48 hours.'
  },
  {
    id: 'handy-1',
    name: 'Miguel Rodriguez',
    company: 'Independent Handyman',
    type: 'handyman',
    phone: '(432) 555-0147',
    notes: 'On-call handyman. Great with door handles, minor repairs, drywall, painting.'
  },
  {
    id: 'plumb-1',
    name: 'West Texas Plumbing',
    company: 'West Texas Plumbing Co.',
    type: 'plumber',
    phone: '(432) 555-PIPE',
    email: 'dispatch@wtxplumbing.com',
    notes: '24/7 emergency service available.'
  },
  {
    id: 'elec-1',
    name: 'Permian Electric',
    company: 'Permian Basin Electric',
    type: 'electrician',
    phone: '(432) 555-VOLT',
    notes: 'Licensed electrician. Call for any electrical issues.'
  },
  {
    id: 'hvac-1',
    name: 'Basin Air & Heat',
    company: 'Basin Air Conditioning',
    type: 'hvac',
    phone: '(432) 555-COOL',
    notes: 'HVAC specialists. Emergency service for AC down in summer.'
  },
  {
    id: 'appl-1',
    name: 'Appliance Pros',
    company: 'Appliance Repair Pros',
    type: 'appliance',
    phone: '(432) 555-0199',
    notes: 'Repairs for washers, dryers, dishwashers, refrigerators.'
  }
];

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
// FIREBASE COLLECTIONS
// ============================================

const COLLECTIONS = {
  CLEANING_REPORTS: 'rah_cleaning_reports',
  CLEANING_ISSUES: 'rah_cleaning_issues',
  CLEANING_PHOTOS: 'rah_cleaning_photos',
};

// ============================================
// CLEANING REPORT FUNCTIONS
// ============================================

export async function createCleaningReport(
  propertyId: string,
  propertyName: string,
  cleanerId: string,
  cleanerName: string,
  jobType: CleaningReport['jobType'],
  scheduledAt: Date,
  bookingId?: string
): Promise<string> {
  const id = `clean_${propertyId}_${Date.now()}`;
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, id);

  // Initialize checklist with all items uncompleted
  const checklist: CompletedChecklistItem[] = masterChecklist.map(item => ({
    itemId: item.id,
    completed: false,
  }));

  const report: Omit<CleaningReport, 'id' | 'scheduledAt'> & { scheduledAt: any; createdAt: any } = {
    propertyId,
    propertyName,
    cleanerId,
    cleanerName,
    bookingId,
    jobType,
    status: 'not_started',
    scheduledAt: Timestamp.fromDate(scheduledAt),
    checklist,
    issues: [],
    verificationPhotos: [],
    createdAt: serverTimestamp(),
  };

  await setDoc(reportRef, report);
  return id;
}

export async function startCleaningJob(reportId: string): Promise<void> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  await updateDoc(reportRef, {
    status: 'in_progress',
    startedAt: serverTimestamp(),
  });
}

export async function updateChecklistItem(
  reportId: string,
  itemId: string,
  completed: boolean,
  photoUrl?: string,
  notes?: string
): Promise<void> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) return;

  const checklist = reportSnap.data().checklist as CompletedChecklistItem[];
  const itemIndex = checklist.findIndex(item => item.itemId === itemId);

  if (itemIndex === -1) return;

  checklist[itemIndex] = {
    ...checklist[itemIndex],
    completed,
    completedAt: completed ? new Date() : undefined,
    photoUrl,
    notes,
  };

  await updateDoc(reportRef, { checklist });
}

export async function addCleaningIssue(
  reportId: string,
  issue: Omit<CleaningIssue, 'id' | 'reportedAt' | 'status'>
): Promise<string> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) throw new Error('Report not found');

  const issues = reportSnap.data().issues as CleaningIssue[];
  const issueId = `issue_${Date.now()}`;

  const newIssue: CleaningIssue = {
    ...issue,
    id: issueId,
    reportedAt: new Date(),
    status: 'reported',
  };

  issues.push(newIssue);
  await updateDoc(reportRef, { issues });

  return issueId;
}

export async function addVerificationPhoto(
  reportId: string,
  area: string,
  photoUrl: string
): Promise<void> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) return;

  const photos = reportSnap.data().verificationPhotos || [];
  photos.push({
    area,
    photoUrl,
    takenAt: new Date(),
  });

  await updateDoc(reportRef, { verificationPhotos: photos });
}

export async function completeCleaningJob(
  reportId: string,
  overallNotes?: string,
  suppliesUsed?: string[],
  suppliesNeeded?: string[]
): Promise<void> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) return;

  const data = reportSnap.data();
  const startedAt = data.startedAt?.toDate();
  const now = new Date();

  let timeSpentMinutes: number | undefined;
  if (startedAt) {
    timeSpentMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);
  }

  await updateDoc(reportRef, {
    status: 'completed',
    completedAt: serverTimestamp(),
    overallNotes,
    suppliesUsed,
    suppliesNeeded,
    timeSpentMinutes,
  });
}

export async function getCleaningReport(reportId: string): Promise<CleaningReport | null> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) return null;

  const data = reportSnap.data();
  return {
    id: reportSnap.id,
    ...data,
    scheduledAt: data.scheduledAt?.toDate(),
    startedAt: data.startedAt?.toDate(),
    completedAt: data.completedAt?.toDate(),
  } as CleaningReport;
}

export async function getCleanerReports(cleanerId: string): Promise<CleaningReport[]> {
  const reportsRef = collection(db(), COLLECTIONS.CLEANING_REPORTS);
  const q = query(
    reportsRef,
    where('cleanerId', '==', cleanerId),
    orderBy('scheduledAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    scheduledAt: doc.data().scheduledAt?.toDate(),
    startedAt: doc.data().startedAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate(),
  })) as CleaningReport[];
}

export async function getPropertyReports(propertyId: string): Promise<CleaningReport[]> {
  const reportsRef = collection(db(), COLLECTIONS.CLEANING_REPORTS);
  const q = query(
    reportsRef,
    where('propertyId', '==', propertyId),
    orderBy('scheduledAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    scheduledAt: doc.data().scheduledAt?.toDate(),
    startedAt: doc.data().startedAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate(),
  })) as CleaningReport[];
}

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
// SERVICE REQUEST FUNCTIONS
// ============================================

const SERVICE_REQUESTS_COLLECTION = 'rah_service_requests';
const NOTIFICATIONS_COLLECTION = 'rah_notifications';

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

export async function createServiceRequest(
  reportId: string,
  propertyId: string,
  propertyAddress: string,
  type: ServiceRequest['type'],
  urgency: ServiceRequest['urgency'],
  description: string,
  photoUrls: string[],
  createdBy: string
): Promise<string> {
  const id = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requestRef = doc(db(), SERVICE_REQUESTS_COLLECTION, id);

  const request: Omit<ServiceRequest, 'id' | 'createdAt'> & { createdAt: any } = {
    reportId,
    propertyId,
    propertyAddress,
    type,
    urgency,
    description,
    photoUrls,
    createdBy,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  await setDoc(requestRef, request);

  // Create notification for Steven
  await createOwnerNotification({
    type: 'service_request',
    title: getServiceNotificationTitle(type, urgency),
    message: `${description}\n\nProperty: ${propertyAddress}`,
    propertyId,
    propertyAddress,
    reportId,
    serviceRequestId: id,
    photoUrls,
    serviceType: type,
    urgency: urgency === 'urgent' ? 'urgent' : urgency === 'soon' ? 'high' : 'medium',
  });

  return id;
}

function getServiceNotificationTitle(type: ServiceRequest['type'], urgency: ServiceRequest['urgency']): string {
  const urgencyPrefix = urgency === 'urgent' ? '🚨 URGENT: ' : urgency === 'soon' ? '⚠️ ' : '';
  const typeLabels: Record<ServiceRequest['type'], string> = {
    yard: 'Yard Work Needed',
    handyman: 'Handyman Needed',
    plumber: 'Plumbing Issue',
    electrician: 'Electrical Issue',
    hvac: 'HVAC Issue',
    appliance: 'Appliance Repair Needed'
  };
  return `${urgencyPrefix}${typeLabels[type]}`;
}

export async function createOwnerNotification(data: Omit<OwnerNotification, 'id' | 'createdAt'>): Promise<string> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const notifRef = doc(db(), NOTIFICATIONS_COLLECTION, id);

  await setDoc(notifRef, {
    ...data,
    createdAt: serverTimestamp(),
  });

  // In production, this would also:
  // 1. Send push notification via Firebase Cloud Messaging
  // 2. Send SMS via Twilio to Steven's phone
  console.log(`[NOTIFICATION] Created: ${data.title} for ${data.propertyAddress}`);

  return id;
}

export async function getOwnerNotifications(unreadOnly: boolean = false): Promise<OwnerNotification[]> {
  const notifsRef = collection(db(), NOTIFICATIONS_COLLECTION);
  let q = query(notifsRef, orderBy('createdAt', 'desc'));

  if (unreadOnly) {
    q = query(notifsRef, where('readAt', '==', null), orderBy('createdAt', 'desc'));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    readAt: doc.data().readAt?.toDate(),
    actionTakenAt: doc.data().actionTakenAt?.toDate(),
  })) as OwnerNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const notifRef = doc(db(), NOTIFICATIONS_COLLECTION, notificationId);
  await updateDoc(notifRef, {
    readAt: serverTimestamp(),
  });
}

export async function takeNotificationAction(
  notificationId: string,
  action: OwnerNotification['actionTaken'],
  serviceProviderId?: string
): Promise<void> {
  const notifRef = doc(db(), NOTIFICATIONS_COLLECTION, notificationId);
  const notifSnap = await getDoc(notifRef);

  if (!notifSnap.exists()) return;

  await updateDoc(notifRef, {
    actionTaken: action,
    actionTakenAt: serverTimestamp(),
    readAt: serverTimestamp(),
  });

  // Update the service request status
  const serviceRequestId = notifSnap.data().serviceRequestId;
  if (serviceRequestId && action !== 'dismissed') {
    const requestRef = doc(db(), SERVICE_REQUESTS_COLLECTION, serviceRequestId);
    await updateDoc(requestRef, {
      status: 'notified',
      assignedTo: serviceProviderId,
    });
  }
}

export async function submitCompletionQuestions(
  reportId: string,
  questions: CompletionQuestions,
  propertyAddress: string
): Promise<string[]> {
  const reportRef = doc(db(), COLLECTIONS.CLEANING_REPORTS, reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) throw new Error('Report not found');

  const data = reportSnap.data();
  const serviceRequestIds: string[] = [];

  // Save completion questions
  await updateDoc(reportRef, { completionQuestions: questions });

  // Create service requests based on answers
  if (questions.yardWorkNeeded) {
    const id = await createServiceRequest(
      reportId,
      data.propertyId,
      propertyAddress,
      'yard',
      'routine',
      questions.yardWorkNotes || 'Yard work needed - see photos',
      questions.yardWorkPhotos || [],
      data.cleanerId
    );
    serviceRequestIds.push(id);
  }

  if (questions.maintenanceNeeded) {
    const id = await createServiceRequest(
      reportId,
      data.propertyId,
      propertyAddress,
      'handyman',
      'soon',
      questions.maintenanceNotes || 'Maintenance needed - see photos',
      questions.maintenancePhotos || [],
      data.cleanerId
    );
    serviceRequestIds.push(id);
  }

  if (questions.hvacIssues) {
    const id = await createServiceRequest(
      reportId,
      data.propertyId,
      propertyAddress,
      'hvac',
      'urgent',
      questions.hvacNotes || 'HVAC issue reported',
      [],
      data.cleanerId
    );
    serviceRequestIds.push(id);
  }

  if (questions.applianceIssues) {
    const id = await createServiceRequest(
      reportId,
      data.propertyId,
      propertyAddress,
      'appliance',
      'soon',
      questions.applianceNotes || 'Appliance issue reported',
      [],
      data.cleanerId
    );
    serviceRequestIds.push(id);
  }

  if (questions.guestLeftItems) {
    await createOwnerNotification({
      type: 'guest_left_items',
      title: '📦 Guest Left Items Behind',
      message: questions.guestItemsDescription || 'Guest left personal items at property',
      propertyId: data.propertyId,
      propertyAddress,
      reportId,
      photoUrls: questions.guestItemsPhotos || [],
      urgency: 'medium',
    });
  }

  return serviceRequestIds;
}

export function getServiceProvider(type: ServiceRequest['type']): ServiceProvider | undefined {
  return serviceProviders.find(p => p.type === type);
}

export function getAllServiceProviders(): ServiceProvider[] {
  return serviceProviders;
}

// ============================================
// EXPORTS
// ============================================

export const CleaningSystem = {
  masterChecklist,
  serviceProviders,
  createReport: createCleaningReport,
  startJob: startCleaningJob,
  updateItem: updateChecklistItem,
  addIssue: addCleaningIssue,
  addPhoto: addVerificationPhoto,
  complete: completeCleaningJob,
  getReport: getCleaningReport,
  getCleanerReports,
  getPropertyReports,
  getByCategory: getChecklistByCategory,
  getRequiredPhotos: getRequiredPhotoItems,
  getCompletionPercentage: calculateCompletionPercentage,
  getCategoryStatus: getCategoryCompletionStatus,
  // Service requests
  createServiceRequest,
  submitCompletionQuestions,
  getServiceProvider,
  getAllServiceProviders,
  // Notifications
  createOwnerNotification,
  getOwnerNotifications,
  markNotificationRead,
  takeNotificationAction,
};

export default CleaningSystem;
