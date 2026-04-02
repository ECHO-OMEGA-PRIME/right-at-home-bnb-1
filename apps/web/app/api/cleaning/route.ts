/**
 * Right at Home BnB - Cleaning Reports API
 * Handles cleaning job management, checklist progress, and issue reporting
 * Uses Prisma for persistent storage (replaces in-memory Map)
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  masterChecklist,
  getChecklistForProperty
} from '@/lib/cleaning-system';

// ============================================================================
// GET - List cleaning jobs or get specific job
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');
    const cleanerId = searchParams.get('cleanerId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    // Get specific job
    if (jobId) {
      const job = await prisma.cleaningJob.findUnique({
        where: { id: jobId },
        include: {
          property: { select: { name: true, address: true } },
          cleaner: { select: { name: true, email: true, phone: true } },
          booking: { select: { id: true, checkIn: true, checkOut: true } },
        },
      });

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json({
        ...job,
        checklistProgress: job.checklistProgress ? JSON.parse(job.checklistProgress) : [],
        photos: job.photos ? JSON.parse(job.photos) : [],
        issues: job.issues ? JSON.parse(job.issues) : [],
      });
    }

    // Build where clause from filters
    const where: any = {};
    if (cleanerId) where.cleanerId = cleanerId;
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;

    const jobs = await prisma.cleaningJob.findMany({
      where,
      include: {
        property: { select: { name: true, address: true } },
        cleaner: { select: { name: true, email: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      reports: jobs.map((j) => ({
        ...j,
        checklistProgress: j.checklistProgress ? JSON.parse(j.checklistProgress) : [],
        photos: j.photos ? JSON.parse(j.photos) : [],
        issues: j.issues ? JSON.parse(j.issues) : [],
      })),
      total: jobs.length,
    });
  } catch (error: any) {
    console.error('[Cleaning GET]', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch' }, { status: 500 });
  }
}

// ============================================================================
// POST - Create or manage cleaning jobs
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { propertyId, cleanerId, scheduledAt, bookingId, jobType = 'TURNOVER' } = body;

        if (!propertyId || !scheduledAt) {
          return NextResponse.json({ error: 'propertyId and scheduledAt required' }, { status: 400 });
        }

        const checklist = getChecklistForProperty(propertyId);
        const checklistItems = checklist.map((item) => ({
          itemId: item.id,
          completed: false,
        }));

        const job = await prisma.cleaningJob.create({
          data: {
            propertyId,
            cleanerId: cleanerId || null,
            bookingId: bookingId || null,
            scheduledAt: new Date(scheduledAt),
            jobType,
            status: 'SCHEDULED',
            checklistProgress: JSON.stringify(checklistItems),
            photos: JSON.stringify([]),
            issues: JSON.stringify([]),
          },
          include: {
            property: { select: { name: true } },
            cleaner: { select: { name: true } },
          },
        });

        return NextResponse.json({ success: true, report: job });
      }

      case 'start': {
        const { reportId } = body;

        const job = await prisma.cleaningJob.update({
          where: { id: reportId },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, report: job });
      }

      case 'gps-checkin': {
        const { reportId, lat, lng } = body;

        const job = await prisma.cleaningJob.update({
          where: { id: reportId },
          data: {
            checkInLat: lat,
            checkInLng: lng,
            startedAt: new Date(),
            status: 'IN_PROGRESS',
          },
        });

        return NextResponse.json({ success: true, report: job });
      }

      case 'complete_item': {
        const { reportId, itemId, photoUrl, notes } = body;

        const job = await prisma.cleaningJob.findUnique({ where: { id: reportId } });
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const checklist = job.checklistProgress ? JSON.parse(job.checklistProgress) : [];
        const item = checklist.find((i: any) => i.itemId === itemId);
        if (!item) {
          return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
        }

        // Check if photo is required
        const originalItem = masterChecklist.find((i) => i.id === itemId);
        if (originalItem?.requiresPhoto && !photoUrl) {
          return NextResponse.json({ error: 'Photo required for this item' }, { status: 400 });
        }

        item.completed = true;
        item.photoUrl = photoUrl;
        item.notes = notes;
        item.completedAt = new Date().toISOString();

        await prisma.cleaningJob.update({
          where: { id: reportId },
          data: { checklistProgress: JSON.stringify(checklist) },
        });

        const completed = checklist.filter((i: any) => i.completed).length;
        const total = checklist.length;

        return NextResponse.json({
          success: true,
          item,
          progress: { completed, total, percentage: Math.round((completed / total) * 100) },
        });
      }

      case 'report_issue': {
        const { reportId, issue } = body;

        const job = await prisma.cleaningJob.findUnique({ where: { id: reportId } });
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const issues = job.issues ? JSON.parse(job.issues) : [];
        const newIssue = {
          ...issue,
          id: `issue-${Date.now()}`,
          reportedAt: new Date().toISOString(),
          status: 'reported',
        };
        issues.push(newIssue);

        await prisma.cleaningJob.update({
          where: { id: reportId },
          data: { issues: JSON.stringify(issues) },
        });

        return NextResponse.json({ success: true, issue: newIssue });
      }

      case 'add_photo': {
        const { reportId, photoUrl, description, location } = body;

        const job = await prisma.cleaningJob.findUnique({ where: { id: reportId } });
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const photos = job.photos ? JSON.parse(job.photos) : [];
        const photo = {
          area: location || description || 'General',
          photoUrl,
          takenAt: new Date().toISOString(),
        };
        photos.push(photo);

        await prisma.cleaningJob.update({
          where: { id: reportId },
          data: { photos: JSON.stringify(photos) },
        });

        return NextResponse.json({ success: true, photo });
      }

      case 'complete': {
        const { reportId, notes } = body;

        const job = await prisma.cleaningJob.findUnique({ where: { id: reportId } });
        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const checklist = job.checklistProgress ? JSON.parse(job.checklistProgress) : [];

        // Check required items
        const incompleteRequired = checklist.filter((item: any) => {
          const original = masterChecklist.find((m) => m.id === item.itemId);
          return original?.requiresPhoto && !item.completed;
        });

        if (incompleteRequired.length > 0) {
          return NextResponse.json({
            error: 'All required items must be completed with photos',
            incompleteItems: incompleteRequired.map((i: any) => {
              const original = masterChecklist.find((m) => m.id === i.itemId);
              return original?.task || i.itemId;
            }),
          }, { status: 400 });
        }

        const now = new Date();
        const durationMins = job.startedAt
          ? Math.round((now.getTime() - job.startedAt.getTime()) / 60000)
          : null;

        // Calculate quality score
        const completedItems = checklist.filter((i: any) => i.completed).length;
        const totalItems = checklist.length;
        const issues = job.issues ? JSON.parse(job.issues) : [];
        const issueDeduction = issues.filter((i: any) => i.severity === 'high' || i.severity === 'urgent').length * 10;
        const score = Math.max(0, Math.round(((completedItems / totalItems) * 100) - issueDeduction));

        const updated = await prisma.cleaningJob.update({
          where: { id: reportId },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            durationMins,
            score,
            notes: notes || job.notes,
          },
          include: {
            property: { select: { name: true } },
            cleaner: { select: { name: true } },
          },
        });

        return NextResponse.json({
          success: true,
          report: updated,
          summary: {
            completedItems,
            totalItems,
            issuesReported: issues.length,
            photosUploaded: (job.photos ? JSON.parse(job.photos) : []).length +
              checklist.filter((i: any) => i.photoUrl).length,
            timeSpentMinutes: durationMins,
            score,
          },
        });
      }

      case 'gps-checkout': {
        const { reportId, lat, lng } = body;

        const job = await prisma.cleaningJob.update({
          where: { id: reportId },
          data: {
            checkOutLat: lat,
            checkOutLng: lng,
          },
        });

        return NextResponse.json({ success: true, report: job });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Cleaning POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to process' }, { status: 500 });
  }
}

// ============================================================================
// PUT - Update a cleaning job
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, updates } = body;

    if (!reportId) {
      return NextResponse.json({ error: 'reportId required' }, { status: 400 });
    }

    const data: any = {};
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.cleanerId !== undefined) data.cleanerId = updates.cleanerId;
    if (updates.scheduledAt !== undefined) data.scheduledAt = new Date(updates.scheduledAt);

    const job = await prisma.cleaningJob.update({
      where: { id: reportId },
      data,
    });

    return NextResponse.json({ success: true, report: job });
  } catch (error: any) {
    console.error('[Cleaning PUT]', error);
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Cancel a cleaning job
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const job = await prisma.cleaningJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot delete completed jobs' }, { status: 400 });
    }

    await prisma.cleaningJob.delete({ where: { id: jobId } });
    return NextResponse.json({ success: true, message: 'Job deleted' });
  } catch (error: any) {
    console.error('[Cleaning DELETE]', error);
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
  }
}
