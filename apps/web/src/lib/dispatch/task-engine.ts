/**
 * Right at Home BnB - Task Dispatch Engine
 * Creates, assigns, and manages operational tasks:
 * cleaning jobs, maintenance requests, inspections, and supply runs.
 * Auto-assigns based on availability, proximity, and workload.
 */

import prisma from '../prisma';
import { nowCST, addDays, startOfDay, formatDateTime } from '../utils/dates';
import { toCents } from '../utils/money';

// ============================================
// TYPES
// ============================================

export type TaskType = 'turnover_clean' | 'deep_clean' | 'maintenance' | 'inspection' | 'supply_run' | 'guest_request';
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

export interface TaskCreateInput {
  propertyId: string;
  type: TaskType;
  priority: TaskPriority;
  title: string;
  description?: string;
  scheduledAt: Date;
  dueBy?: Date;
  estimatedMinutes?: number;
  bookingId?: string;
  assignToId?: string;
  notes?: string;
}

export interface TaskResult {
  id: string;
  propertyId: string;
  type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedTo: string | null;
  assignedToName: string | null;
  scheduledAt: Date;
  dueBy: Date | null;
  estimatedMinutes: number;
  bookingId: string | null;
  createdAt: Date;
}

export interface AssignmentResult {
  taskId: string;
  assignedTo: string;
  assignedToName: string;
  reason: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  activeTaskCount: number;
  lastCompletedAt: Date | null;
  avgCompletionMinutes: number;
}

// ============================================
// TASK CREATION
// ============================================

/**
 * Create a new operational task.
 * If no assignee is specified, the task enters the pending pool for auto-assignment.
 */
export async function createTask(input: TaskCreateInput): Promise<TaskResult> {
  const {
    propertyId,
    type,
    priority,
    title,
    description,
    scheduledAt,
    dueBy,
    estimatedMinutes = getDefaultEstimate(type),
    bookingId,
    assignToId,
    notes,
  } = input;

  // Validate the property exists
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, name: true },
  });

  if (!property) {
    throw new Error(`Property not found: ${propertyId}`);
  }

  // For turnover_clean, create via CleaningJob model
  if (type === 'turnover_clean' || type === 'deep_clean') {
    const cleaningJob = await prisma.cleaningJob.create({
      data: {
        propertyId,
        cleanerId: assignToId || null,
        bookingId: bookingId || null,
        scheduledAt,
        jobType: type === 'deep_clean' ? 'DEEP_CLEAN' : 'TURNOVER',
        status: assignToId ? 'ASSIGNED' : 'SCHEDULED',
        notes: [title, description, notes].filter(Boolean).join(' | '),
      },
      include: {
        cleaner: { select: { id: true, name: true } },
      },
    });

    return {
      id: cleaningJob.id,
      propertyId,
      type,
      priority,
      title,
      description: description || null,
      status: assignToId ? 'assigned' : 'pending',
      assignedTo: cleaningJob.cleaner?.id || null,
      assignedToName: cleaningJob.cleaner?.name || null,
      scheduledAt: cleaningJob.scheduledAt,
      dueBy: dueBy || null,
      estimatedMinutes,
      bookingId: bookingId || null,
      createdAt: cleaningJob.createdAt,
    };
  }

  // For non-cleaning tasks, store as a Setting (since we don't have a generic task table)
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const taskData = {
    id: taskId,
    propertyId,
    type,
    priority,
    title,
    description: description || null,
    status: assignToId ? 'assigned' as TaskStatus : 'pending' as TaskStatus,
    assignedTo: assignToId || null,
    scheduledAt: scheduledAt.toISOString(),
    dueBy: dueBy ? dueBy.toISOString() : null,
    estimatedMinutes,
    bookingId: bookingId || null,
    notes: notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await prisma.setting.create({
    data: {
      key: `task:${taskId}`,
      value: JSON.stringify(taskData),
      description: `Task: ${title} (${type}) for property ${property.name}`,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entity: 'Task',
      entityId: taskId,
      newValues: JSON.stringify({ type, priority, title, propertyId, scheduledAt: scheduledAt.toISOString() }),
    },
  });

  // Look up assignee name if assigned
  let assignedToName: string | null = null;
  if (assignToId) {
    const user = await prisma.user.findUnique({ where: { id: assignToId }, select: { name: true } });
    assignedToName = user?.name || null;
  }

  return {
    id: taskId,
    propertyId,
    type,
    priority,
    title,
    description: description || null,
    status: assignToId ? 'assigned' : 'pending',
    assignedTo: assignToId || null,
    assignedToName,
    scheduledAt,
    dueBy: dueBy || null,
    estimatedMinutes,
    bookingId: bookingId || null,
    createdAt: new Date(),
  };
}

// ============================================
// AUTO-ASSIGNMENT
// ============================================

/**
 * Get available crew members for task assignment.
 * Considers role, current workload, and recent performance.
 */
async function getAvailableCrew(taskType: TaskType): Promise<CrewMember[]> {
  // Determine required role based on task type
  const requiredRole = taskType === 'turnover_clean' || taskType === 'deep_clean'
    ? 'CLEANER'
    : taskType === 'maintenance'
      ? 'MAINTENANCE'
      : undefined; // Any role for inspections, supply runs, guest requests

  const whereClause = requiredRole
    ? { isActive: true, role: requiredRole }
    : { isActive: true, role: { in: ['CLEANER', 'MAINTENANCE', 'MANAGER'] } };

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      cleaningJobs: {
        where: {
          status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] },
        },
        select: { id: true },
      },
    },
  });

  const crewMembers: CrewMember[] = [];

  for (const user of users) {
    // Get last completed task time
    const lastCompleted = await prisma.cleaningJob.findFirst({
      where: {
        cleanerId: user.id,
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, durationMins: true },
    });

    // Calculate average completion time from last 20 jobs
    const recentJobs = await prisma.cleaningJob.findMany({
      where: {
        cleanerId: user.id,
        status: 'COMPLETED',
        durationMins: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
      select: { durationMins: true },
    });

    const avgMinutes = recentJobs.length > 0
      ? Math.round(recentJobs.reduce((sum, j) => sum + (j.durationMins || 0), 0) / recentJobs.length)
      : getDefaultEstimate(taskType);

    crewMembers.push({
      id: user.id,
      name: user.name,
      role: user.role,
      activeTaskCount: user.cleaningJobs.length,
      lastCompletedAt: lastCompleted?.completedAt || null,
      avgCompletionMinutes: avgMinutes,
    });
  }

  return crewMembers;
}

/**
 * Auto-assign a task to the best available crew member.
 *
 * Assignment algorithm:
 * 1. Filter crew by required role
 * 2. Sort by:
 *    a. Fewest active tasks (load balancing)
 *    b. Fastest average completion time (efficiency)
 *    c. Most recently active (engagement)
 * 3. Pick the top candidate
 */
export async function autoAssignTask(taskId: string): Promise<AssignmentResult | null> {
  // Load the task
  const setting = await prisma.setting.findUnique({
    where: { key: `task:${taskId}` },
  });

  let taskType: TaskType = 'guest_request';
  let propertyId: string | null = null;

  if (setting) {
    const taskData = JSON.parse(setting.value);
    taskType = taskData.type;
    propertyId = taskData.propertyId;
  } else {
    // Check if it's a cleaning job
    const cleaningJob = await prisma.cleaningJob.findUnique({
      where: { id: taskId },
    });
    if (cleaningJob) {
      taskType = cleaningJob.jobType === 'DEEP_CLEAN' ? 'deep_clean' : 'turnover_clean';
      propertyId = cleaningJob.propertyId;
    } else {
      return null;
    }
  }

  const candidates = await getAvailableCrew(taskType);

  if (candidates.length === 0) {
    return null;
  }

  // Sort by: fewest active tasks, then fastest, then most recent
  candidates.sort((a, b) => {
    // Primary: fewest active tasks
    if (a.activeTaskCount !== b.activeTaskCount) {
      return a.activeTaskCount - b.activeTaskCount;
    }
    // Secondary: fastest average
    if (a.avgCompletionMinutes !== b.avgCompletionMinutes) {
      return a.avgCompletionMinutes - b.avgCompletionMinutes;
    }
    // Tertiary: most recently active
    const aTime = a.lastCompletedAt?.getTime() ?? 0;
    const bTime = b.lastCompletedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const chosen = candidates[0];

  // Assign the task
  if (setting) {
    const taskData = JSON.parse(setting.value);
    taskData.assignedTo = chosen.id;
    taskData.status = 'assigned';
    taskData.updatedAt = new Date().toISOString();
    await prisma.setting.update({
      where: { key: `task:${taskId}` },
      data: { value: JSON.stringify(taskData) },
    });
  } else {
    // Cleaning job assignment
    await prisma.cleaningJob.update({
      where: { id: taskId },
      data: {
        cleanerId: chosen.id,
        status: 'ASSIGNED',
      },
    });
  }

  const reason = `Lowest workload (${chosen.activeTaskCount} active tasks), avg ${chosen.avgCompletionMinutes}min completion`;

  await prisma.auditLog.create({
    data: {
      action: 'AUTO_ASSIGN',
      entity: 'Task',
      entityId: taskId,
      userId: chosen.id,
      newValues: JSON.stringify({ assignedTo: chosen.id, assignedToName: chosen.name, reason }),
    },
  });

  return {
    taskId,
    assignedTo: chosen.id,
    assignedToName: chosen.name,
    reason,
  };
}

// ============================================
// TASK LIFECYCLE
// ============================================

/**
 * Mark a task as in progress.
 */
export async function startTask(taskId: string, userId: string): Promise<void> {
  // Check CleaningJob first
  const cleaningJob = await prisma.cleaningJob.findUnique({ where: { id: taskId } });
  if (cleaningJob) {
    await prisma.cleaningJob.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
    return;
  }

  // Generic task
  const setting = await prisma.setting.findUnique({ where: { key: `task:${taskId}` } });
  if (setting) {
    const taskData = JSON.parse(setting.value);
    taskData.status = 'in_progress';
    taskData.startedAt = new Date().toISOString();
    taskData.updatedAt = new Date().toISOString();
    await prisma.setting.update({
      where: { key: `task:${taskId}` },
      data: { value: JSON.stringify(taskData) },
    });
  }
}

/**
 * Mark a task as completed.
 */
export async function completeTask(
  taskId: string,
  userId: string,
  options?: { score?: number; notes?: string; durationMinutes?: number }
): Promise<void> {
  const now = new Date();

  // Check CleaningJob first
  const cleaningJob = await prisma.cleaningJob.findUnique({ where: { id: taskId } });
  if (cleaningJob) {
    const duration = options?.durationMinutes ??
      (cleaningJob.startedAt
        ? Math.round((now.getTime() - cleaningJob.startedAt.getTime()) / 60000)
        : null);

    await prisma.cleaningJob.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        durationMins: duration,
        score: options?.score,
        notes: options?.notes || cleaningJob.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'COMPLETE',
        entity: 'CleaningJob',
        entityId: taskId,
        userId,
        newValues: JSON.stringify({ duration, score: options?.score }),
      },
    });
    return;
  }

  // Generic task
  const setting = await prisma.setting.findUnique({ where: { key: `task:${taskId}` } });
  if (setting) {
    const taskData = JSON.parse(setting.value);
    taskData.status = 'completed';
    taskData.completedAt = now.toISOString();
    taskData.updatedAt = now.toISOString();
    if (options?.notes) taskData.completionNotes = options.notes;
    if (options?.durationMinutes) taskData.actualMinutes = options.durationMinutes;
    await prisma.setting.update({
      where: { key: `task:${taskId}` },
      data: { value: JSON.stringify(taskData) },
    });
  }
}

/**
 * Cancel a task.
 */
export async function cancelTask(taskId: string, reason: string): Promise<void> {
  const cleaningJob = await prisma.cleaningJob.findUnique({ where: { id: taskId } });
  if (cleaningJob) {
    await prisma.cleaningJob.update({
      where: { id: taskId },
      data: { status: 'CANCELLED', notes: `Cancelled: ${reason}` },
    });
    return;
  }

  const setting = await prisma.setting.findUnique({ where: { key: `task:${taskId}` } });
  if (setting) {
    const taskData = JSON.parse(setting.value);
    taskData.status = 'cancelled';
    taskData.cancelReason = reason;
    taskData.updatedAt = new Date().toISOString();
    await prisma.setting.update({
      where: { key: `task:${taskId}` },
      data: { value: JSON.stringify(taskData) },
    });
  }
}

// ============================================
// AUTOMATIC TASK GENERATION
// ============================================

/**
 * Automatically generate turnover cleaning tasks for upcoming checkouts.
 * Scheduled cleaning starts at the property's checkout time.
 * Should be called daily by a cron job.
 *
 * @param lookAheadDays - How many days ahead to look for checkouts
 * @returns Number of cleaning tasks created
 */
export async function generateTurnoverTasks(lookAheadDays: number = 2): Promise<number> {
  const now = new Date();
  const lookAhead = addDays(startOfDay(now), lookAheadDays);

  // Find bookings checking out in the next N days
  const upcomingCheckouts = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkOut: {
        gte: startOfDay(now),
        lte: lookAhead,
      },
    },
    include: {
      property: { select: { id: true, name: true } },
      cleaningJob: { select: { id: true } },
    },
  });

  let created = 0;

  for (const booking of upcomingCheckouts) {
    // Skip if a cleaning job already exists for this booking
    if (booking.cleaningJob) continue;

    // Schedule cleaning for 1 hour after checkout
    const cleaningTime = new Date(booking.checkOut.getTime() + 60 * 60 * 1000);

    await createTask({
      propertyId: booking.propertyId,
      type: 'turnover_clean',
      priority: 'high',
      title: `Turnover clean - ${booking.property.name}`,
      description: `Turnover cleaning after checkout. Guest count: ${booking.guestCount}.`,
      scheduledAt: cleaningTime,
      dueBy: addDays(booking.checkOut, 1),
      bookingId: booking.id,
    });

    created++;
  }

  return created;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get all pending (unassigned) tasks.
 */
export async function getPendingTasks(): Promise<TaskResult[]> {
  const results: TaskResult[] = [];

  // Pending cleaning jobs
  const pendingCleanings = await prisma.cleaningJob.findMany({
    where: {
      status: 'SCHEDULED',
      cleanerId: null,
    },
    include: {
      cleaner: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  for (const job of pendingCleanings) {
    results.push({
      id: job.id,
      propertyId: job.propertyId,
      type: job.jobType === 'DEEP_CLEAN' ? 'deep_clean' : 'turnover_clean',
      priority: 'high',
      title: `${job.jobType} clean`,
      description: job.notes,
      status: 'pending',
      assignedTo: null,
      assignedToName: null,
      scheduledAt: job.scheduledAt,
      dueBy: null,
      estimatedMinutes: getDefaultEstimate(job.jobType === 'DEEP_CLEAN' ? 'deep_clean' : 'turnover_clean'),
      bookingId: job.bookingId,
      createdAt: job.createdAt,
    });
  }

  // Pending generic tasks from Settings
  const pendingSettings = await prisma.setting.findMany({
    where: { key: { startsWith: 'task:' } },
  });

  for (const setting of pendingSettings) {
    try {
      const data = JSON.parse(setting.value);
      if (data.status === 'pending') {
        results.push({
          id: data.id,
          propertyId: data.propertyId,
          type: data.type,
          priority: data.priority,
          title: data.title,
          description: data.description,
          status: data.status,
          assignedTo: data.assignedTo,
          assignedToName: null,
          scheduledAt: new Date(data.scheduledAt),
          dueBy: data.dueBy ? new Date(data.dueBy) : null,
          estimatedMinutes: data.estimatedMinutes,
          bookingId: data.bookingId,
          createdAt: new Date(data.createdAt),
        });
      }
    } catch {
      // Skip malformed
    }
  }

  // Sort by priority then scheduled time
  const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  results.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.scheduledAt.getTime() - b.scheduledAt.getTime();
  });

  return results;
}

/**
 * Get tasks assigned to a specific crew member.
 */
export async function getTasksForUser(userId: string): Promise<TaskResult[]> {
  const results: TaskResult[] = [];

  // Cleaning jobs assigned to this user
  const cleaningJobs = await prisma.cleaningJob.findMany({
    where: {
      cleanerId: userId,
      status: { in: ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'] },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  for (const job of cleaningJobs) {
    results.push({
      id: job.id,
      propertyId: job.propertyId,
      type: job.jobType === 'DEEP_CLEAN' ? 'deep_clean' : 'turnover_clean',
      priority: 'high',
      title: `${job.jobType} clean`,
      description: job.notes,
      status: job.status === 'IN_PROGRESS' ? 'in_progress' : 'assigned',
      assignedTo: userId,
      assignedToName: null,
      scheduledAt: job.scheduledAt,
      dueBy: null,
      estimatedMinutes: getDefaultEstimate(job.jobType === 'DEEP_CLEAN' ? 'deep_clean' : 'turnover_clean'),
      bookingId: job.bookingId,
      createdAt: job.createdAt,
    });
  }

  // Generic tasks assigned to this user
  const taskSettings = await prisma.setting.findMany({
    where: { key: { startsWith: 'task:' } },
  });

  for (const setting of taskSettings) {
    try {
      const data = JSON.parse(setting.value);
      if (data.assignedTo === userId && ['assigned', 'in_progress'].includes(data.status)) {
        results.push({
          id: data.id,
          propertyId: data.propertyId,
          type: data.type,
          priority: data.priority,
          title: data.title,
          description: data.description,
          status: data.status,
          assignedTo: userId,
          assignedToName: null,
          scheduledAt: new Date(data.scheduledAt),
          dueBy: data.dueBy ? new Date(data.dueBy) : null,
          estimatedMinutes: data.estimatedMinutes,
          bookingId: data.bookingId,
          createdAt: new Date(data.createdAt),
        });
      }
    } catch {
      // Skip malformed
    }
  }

  return results;
}

// ============================================
// HELPERS
// ============================================

/**
 * Default estimated minutes for each task type.
 */
function getDefaultEstimate(type: TaskType): number {
  switch (type) {
    case 'turnover_clean': return 90;
    case 'deep_clean': return 180;
    case 'maintenance': return 60;
    case 'inspection': return 30;
    case 'supply_run': return 45;
    case 'guest_request': return 30;
    default: return 60;
  }
}
