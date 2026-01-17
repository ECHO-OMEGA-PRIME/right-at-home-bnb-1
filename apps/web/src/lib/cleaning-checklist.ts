'use client';

/**
 * Right at Home BnB - Cleaning Checklist System
 * Complete cleaning task management for turnover cleanings
 * @author ECHO OMEGA PRIME
 */

import { db } from './auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// Cleaning Task Status
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'verified' | 'issues';

// Checklist Item Status
export type ItemStatus = 'pending' | 'completed' | 'skipped' | 'issue';

// Checklist Categories
export type ChecklistCategory =
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'living_area'
  | 'laundry'
  | 'outdoor'
  | 'supplies'
  | 'final_inspection';

// Individual Checklist Item
export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  task: string;
  description?: string;
  required: boolean;
  photoRequired?: boolean;
  status: ItemStatus;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  photoUrl?: string;
}

// Cleaning Task (Assignment)
export interface CleaningTask {
  id: string;
  propertyId: string;
  propertyName: string;
  bookingId?: string;
  assignedTo: string; // Worker email
  assignedToName: string;
  scheduledDate: string;
  scheduledTime?: string;
  dueBy: string; // Must be completed by this time (before guest check-in)
  status: TaskStatus;
  checklist: ChecklistItem[];
  startedAt?: string;
  completedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  photos: CleaningPhoto[];
  notes?: string;
  issues?: CleaningIssue[];
  totalItems: number;
  completedItems: number;
  estimatedDuration: number; // Minutes
  actualDuration?: number; // Minutes
  payAmount?: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

// Cleaning Photo
export interface CleaningPhoto {
  id: string;
  url: string;
  category: ChecklistCategory;
  caption?: string;
  uploadedAt: string;
  uploadedBy: string;
}

// Cleaning Issue
export interface CleaningIssue {
  id: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  photoUrl?: string;
  reportedAt: string;
  reportedBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

// Default Checklist Template
export const DEFAULT_CHECKLIST_TEMPLATE: Omit<ChecklistItem, 'status' | 'completedAt' | 'completedBy' | 'notes' | 'photoUrl'>[] = [
  // Kitchen (12 items)
  { id: 'kitchen_1', category: 'kitchen', task: 'Clean all countertops', required: true },
  { id: 'kitchen_2', category: 'kitchen', task: 'Clean stovetop and oven', required: true },
  { id: 'kitchen_3', category: 'kitchen', task: 'Clean microwave inside and out', required: true },
  { id: 'kitchen_4', category: 'kitchen', task: 'Empty and clean refrigerator', required: true },
  { id: 'kitchen_5', category: 'kitchen', task: 'Run and empty dishwasher', required: true },
  { id: 'kitchen_6', category: 'kitchen', task: 'Clean sink and faucets', required: true },
  { id: 'kitchen_7', category: 'kitchen', task: 'Wipe cabinet fronts', required: true },
  { id: 'kitchen_8', category: 'kitchen', task: 'Clean coffee maker', required: true },
  { id: 'kitchen_9', category: 'kitchen', task: 'Take out trash', required: true },
  { id: 'kitchen_10', category: 'kitchen', task: 'Sweep and mop floor', required: true },
  { id: 'kitchen_11', category: 'kitchen', task: 'Replace trash bags', required: true },
  { id: 'kitchen_12', category: 'kitchen', task: 'Stock basic supplies (soap, sponge)', required: true },

  // Bathroom (15 items)
  { id: 'bath_1', category: 'bathroom', task: 'Clean and sanitize toilet', required: true },
  { id: 'bath_2', category: 'bathroom', task: 'Clean shower/tub', required: true },
  { id: 'bath_3', category: 'bathroom', task: 'Clean shower door/curtain', required: true },
  { id: 'bath_4', category: 'bathroom', task: 'Clean sink and faucets', required: true },
  { id: 'bath_5', category: 'bathroom', task: 'Clean mirror', required: true },
  { id: 'bath_6', category: 'bathroom', task: 'Clean countertop', required: true },
  { id: 'bath_7', category: 'bathroom', task: 'Empty trash and replace bag', required: true },
  { id: 'bath_8', category: 'bathroom', task: 'Sweep and mop floor', required: true },
  { id: 'bath_9', category: 'bathroom', task: 'Replace towels (bath, hand, washcloth)', required: true },
  { id: 'bath_10', category: 'bathroom', task: 'Replace bath mat', required: true },
  { id: 'bath_11', category: 'bathroom', task: 'Stock toilet paper (3+ rolls)', required: true },
  { id: 'bath_12', category: 'bathroom', task: 'Stock toiletries (shampoo, conditioner, soap)', required: true },
  { id: 'bath_13', category: 'bathroom', task: 'Clean exhaust fan', required: false },
  { id: 'bath_14', category: 'bathroom', task: 'Check drain for hair/clogs', required: true },
  { id: 'bath_15', category: 'bathroom', task: 'Wipe door handles', required: true },

  // Bedroom (10 items)
  { id: 'bed_1', category: 'bedroom', task: 'Strip and remake bed with fresh linens', required: true, photoRequired: true },
  { id: 'bed_2', category: 'bedroom', task: 'Fluff and arrange pillows', required: true },
  { id: 'bed_3', category: 'bedroom', task: 'Dust all surfaces', required: true },
  { id: 'bed_4', category: 'bedroom', task: 'Clean mirrors', required: true },
  { id: 'bed_5', category: 'bedroom', task: 'Vacuum/mop floors', required: true },
  { id: 'bed_6', category: 'bedroom', task: 'Empty closet of previous guest items', required: true },
  { id: 'bed_7', category: 'bedroom', task: 'Check drawers (empty and wipe)', required: true },
  { id: 'bed_8', category: 'bedroom', task: 'Clean windows (inside)', required: false },
  { id: 'bed_9', category: 'bedroom', task: 'Check under bed for items', required: true },
  { id: 'bed_10', category: 'bedroom', task: 'Wipe door handles and light switches', required: true },

  // Living Area (10 items)
  { id: 'living_1', category: 'living_area', task: 'Vacuum all floors and carpets', required: true },
  { id: 'living_2', category: 'living_area', task: 'Dust all surfaces', required: true },
  { id: 'living_3', category: 'living_area', task: 'Clean and arrange throw pillows', required: true },
  { id: 'living_4', category: 'living_area', task: 'Clean TV screen', required: true },
  { id: 'living_5', category: 'living_area', task: 'Test TV and remotes (batteries)', required: true },
  { id: 'living_6', category: 'living_area', task: 'Clean windows (inside)', required: false },
  { id: 'living_7', category: 'living_area', task: 'Wipe all door handles and light switches', required: true },
  { id: 'living_8', category: 'living_area', task: 'Check for previous guest items', required: true },
  { id: 'living_9', category: 'living_area', task: 'Arrange decor items', required: true },
  { id: 'living_10', category: 'living_area', task: 'Empty all trash cans', required: true },

  // Laundry (6 items)
  { id: 'laundry_1', category: 'laundry', task: 'Wash all used linens', required: true },
  { id: 'laundry_2', category: 'laundry', task: 'Wash all used towels', required: true },
  { id: 'laundry_3', category: 'laundry', task: 'Clean washer/dryer lint trap', required: true },
  { id: 'laundry_4', category: 'laundry', task: 'Fold and store extra linens', required: true },
  { id: 'laundry_5', category: 'laundry', task: 'Check for stains (treat or replace)', required: true },
  { id: 'laundry_6', category: 'laundry', task: 'Report any damaged linens', required: true },

  // Outdoor (8 items)
  { id: 'outdoor_1', category: 'outdoor', task: 'Sweep porch/patio', required: true },
  { id: 'outdoor_2', category: 'outdoor', task: 'Wipe outdoor furniture', required: true },
  { id: 'outdoor_3', category: 'outdoor', task: 'Clean grill (if applicable)', required: false },
  { id: 'outdoor_4', category: 'outdoor', task: 'Check hot tub/pool (if applicable)', required: false },
  { id: 'outdoor_5', category: 'outdoor', task: 'Empty outdoor trash cans', required: true },
  { id: 'outdoor_6', category: 'outdoor', task: 'Check exterior lighting', required: true },
  { id: 'outdoor_7', category: 'outdoor', task: 'Remove any debris from yard', required: true },
  { id: 'outdoor_8', category: 'outdoor', task: 'Check front door area presentation', required: true },

  // Supplies Check (10 items)
  { id: 'supplies_1', category: 'supplies', task: 'Check coffee/tea supplies', required: true },
  { id: 'supplies_2', category: 'supplies', task: 'Check dish soap', required: true },
  { id: 'supplies_3', category: 'supplies', task: 'Check paper towels (2+ rolls)', required: true },
  { id: 'supplies_4', category: 'supplies', task: 'Check hand soap (all sinks)', required: true },
  { id: 'supplies_5', category: 'supplies', task: 'Check toilet paper (3+ rolls each bath)', required: true },
  { id: 'supplies_6', category: 'supplies', task: 'Check trash bags', required: true },
  { id: 'supplies_7', category: 'supplies', task: 'Check laundry detergent', required: true },
  { id: 'supplies_8', category: 'supplies', task: 'Check shampoo/conditioner/body wash', required: true },
  { id: 'supplies_9', category: 'supplies', task: 'Report any low supplies', required: true },
  { id: 'supplies_10', category: 'supplies', task: 'Check welcome basket/amenities', required: false },

  // Final Inspection (10 items)
  { id: 'final_1', category: 'final_inspection', task: 'Walk through entire property', required: true },
  { id: 'final_2', category: 'final_inspection', task: 'Check all lights work', required: true },
  { id: 'final_3', category: 'final_inspection', task: 'Set thermostat to standard temp (72°F)', required: true },
  { id: 'final_4', category: 'final_inspection', task: 'Lock all windows', required: true },
  { id: 'final_5', category: 'final_inspection', task: 'Close all blinds/curtains appropriately', required: true },
  { id: 'final_6', category: 'final_inspection', task: 'Check WiFi is working', required: true },
  { id: 'final_7', category: 'final_inspection', task: 'Take completion photos', required: true, photoRequired: true },
  { id: 'final_8', category: 'final_inspection', task: 'Lock all doors', required: true },
  { id: 'final_9', category: 'final_inspection', task: 'Overall smell/freshness check', required: true },
  { id: 'final_10', category: 'final_inspection', task: 'Leave welcome note in place', required: false },
];

// Category Display Names
export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  bedroom: 'Bedroom',
  living_area: 'Living Area',
  laundry: 'Laundry',
  outdoor: 'Outdoor',
  supplies: 'Supplies Check',
  final_inspection: 'Final Inspection',
};

// ============================================
// Cleaning Task Functions
// ============================================

/**
 * Create a new cleaning task
 */
export async function createCleaningTask(data: {
  propertyId: string;
  propertyName: string;
  bookingId?: string;
  assignedTo: string;
  assignedToName: string;
  scheduledDate: string;
  dueBy: string;
  estimatedDuration?: number;
  payAmount?: number;
}): Promise<CleaningTask> {
  const taskId = `clean_${data.propertyId}_${Date.now()}`;

  // Initialize checklist from template
  const checklist: ChecklistItem[] = DEFAULT_CHECKLIST_TEMPLATE.map(item => ({
    ...item,
    status: 'pending' as ItemStatus,
  }));

  const task: CleaningTask = {
    id: taskId,
    propertyId: data.propertyId,
    propertyName: data.propertyName,
    bookingId: data.bookingId,
    assignedTo: data.assignedTo,
    assignedToName: data.assignedToName,
    scheduledDate: data.scheduledDate,
    dueBy: data.dueBy,
    status: 'pending',
    checklist,
    photos: [],
    totalItems: checklist.length,
    completedItems: 0,
    estimatedDuration: data.estimatedDuration || 180, // Default 3 hours
    payAmount: data.payAmount,
    isPaid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db(), 'cleaning_tasks', taskId), task);

  return task;
}

/**
 * Start a cleaning task
 */
export async function startCleaningTask(taskId: string): Promise<void> {
  await updateDoc(doc(db(), 'cleaning_tasks', taskId), {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update a checklist item
 */
export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  update: {
    status: ItemStatus;
    notes?: string;
    photoUrl?: string;
  },
  workerEmail: string
): Promise<void> {
  const taskRef = doc(db(), 'cleaning_tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error('Task not found');
  }

  const task = taskSnap.data() as CleaningTask;
  const updatedChecklist = task.checklist.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        ...update,
        completedAt: update.status === 'completed' ? new Date().toISOString() : undefined,
        completedBy: update.status === 'completed' ? workerEmail : undefined,
      };
    }
    return item;
  });

  const completedItems = updatedChecklist.filter(i => i.status === 'completed').length;

  await updateDoc(taskRef, {
    checklist: updatedChecklist,
    completedItems,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Complete a cleaning task
 */
export async function completeCleaningTask(
  taskId: string,
  notes?: string
): Promise<void> {
  const taskRef = doc(db(), 'cleaning_tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error('Task not found');
  }

  const task = taskSnap.data() as CleaningTask;

  // Calculate actual duration
  const startTime = task.startedAt ? new Date(task.startedAt) : new Date();
  const endTime = new Date();
  const actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  await updateDoc(taskRef, {
    status: 'completed',
    completedAt: endTime.toISOString(),
    actualDuration,
    notes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Verify a cleaning task (by admin/owner)
 */
export async function verifyCleaningTask(
  taskId: string,
  verifiedBy: string,
  approved: boolean,
  notes?: string
): Promise<void> {
  await updateDoc(doc(db(), 'cleaning_tasks', taskId), {
    status: approved ? 'verified' : 'issues',
    verifiedAt: new Date().toISOString(),
    verifiedBy,
    verificationNotes: notes,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Add a photo to cleaning task
 */
export async function addCleaningPhoto(
  taskId: string,
  photo: {
    url: string;
    category: ChecklistCategory;
    caption?: string;
  },
  uploadedBy: string
): Promise<void> {
  const taskRef = doc(db(), 'cleaning_tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error('Task not found');
  }

  const task = taskSnap.data() as CleaningTask;

  const newPhoto: CleaningPhoto = {
    id: `photo_${Date.now()}`,
    url: photo.url,
    category: photo.category,
    caption: photo.caption,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
  };

  await updateDoc(taskRef, {
    photos: [...task.photos, newPhoto],
    updatedAt: serverTimestamp(),
  });
}

/**
 * Report an issue during cleaning
 */
export async function reportCleaningIssue(
  taskId: string,
  issue: {
    description: string;
    severity: 'minor' | 'moderate' | 'major';
    photoUrl?: string;
  },
  reportedBy: string
): Promise<void> {
  const taskRef = doc(db(), 'cleaning_tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error('Task not found');
  }

  const task = taskSnap.data() as CleaningTask;

  const newIssue: CleaningIssue = {
    id: `issue_${Date.now()}`,
    description: issue.description,
    severity: issue.severity,
    photoUrl: issue.photoUrl,
    reportedAt: new Date().toISOString(),
    reportedBy,
  };

  await updateDoc(taskRef, {
    issues: [...(task.issues || []), newIssue],
    status: 'issues',
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Query Functions
// ============================================

/**
 * Get cleaning tasks for a worker
 */
export async function getWorkerTasks(workerEmail: string): Promise<CleaningTask[]> {
  const q = query(
    collection(db(), 'cleaning_tasks'),
    where('assignedTo', '==', workerEmail),
    orderBy('scheduledDate', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as CleaningTask);
}

/**
 * Get pending tasks for a worker
 */
export async function getPendingTasks(workerEmail: string): Promise<CleaningTask[]> {
  const q = query(
    collection(db(), 'cleaning_tasks'),
    where('assignedTo', '==', workerEmail),
    where('status', 'in', ['pending', 'in_progress'])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as CleaningTask);
}

/**
 * Get all tasks for a property
 */
export async function getPropertyTasks(propertyId: string): Promise<CleaningTask[]> {
  const q = query(
    collection(db(), 'cleaning_tasks'),
    where('propertyId', '==', propertyId),
    orderBy('scheduledDate', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as CleaningTask);
}

/**
 * Get tasks needing verification
 */
export async function getTasksNeedingVerification(): Promise<CleaningTask[]> {
  const q = query(
    collection(db(), 'cleaning_tasks'),
    where('status', '==', 'completed')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as CleaningTask);
}

/**
 * Get task by ID
 */
export async function getCleaningTask(taskId: string): Promise<CleaningTask | null> {
  const taskSnap = await getDoc(doc(db(), 'cleaning_tasks', taskId));
  return taskSnap.exists() ? (taskSnap.data() as CleaningTask) : null;
}

/**
 * Calculate checklist progress
 */
export function calculateProgress(checklist: ChecklistItem[]): {
  total: number;
  completed: number;
  percentage: number;
  byCategory: Record<ChecklistCategory, { total: number; completed: number }>;
} {
  const total = checklist.length;
  const completed = checklist.filter(i => i.status === 'completed').length;

  const byCategory: Record<ChecklistCategory, { total: number; completed: number }> = {
    kitchen: { total: 0, completed: 0 },
    bathroom: { total: 0, completed: 0 },
    bedroom: { total: 0, completed: 0 },
    living_area: { total: 0, completed: 0 },
    laundry: { total: 0, completed: 0 },
    outdoor: { total: 0, completed: 0 },
    supplies: { total: 0, completed: 0 },
    final_inspection: { total: 0, completed: 0 },
  };

  checklist.forEach(item => {
    byCategory[item.category].total++;
    if (item.status === 'completed') {
      byCategory[item.category].completed++;
    }
  });

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    byCategory,
  };
}
