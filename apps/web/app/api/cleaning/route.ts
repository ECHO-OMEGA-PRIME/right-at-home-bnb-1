/**
 * Right at Home BnB - Cleaning Reports API
 * Handles cleaning job management, checklist progress, and issue reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CleaningReport,
  CleaningIssue,
  masterChecklist,
  getChecklistForProperty
} from '@/lib/cleaning-system';

// In production, this would be Firebase Firestore
// For now, we'll use a simple in-memory store for demo
const cleaningReports: Map<string, CleaningReport> = new Map();

// GET - List all cleaning reports or get specific report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');
    const cleanerId = searchParams.get('cleanerId');
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    // Get specific report
    if (reportId) {
      const report = cleaningReports.get(reportId);
      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      return NextResponse.json(report);
    }

    // Filter reports
    let reports = Array.from(cleaningReports.values());

    if (cleanerId) {
      reports = reports.filter(r => r.cleanerId === cleanerId);
    }
    if (propertyId) {
      reports = reports.filter(r => r.propertyId === propertyId);
    }
    if (status) {
      reports = reports.filter(r => r.status === status);
    }

    // Sort by date, most recent first
    reports.sort((a, b) => new Date(b.startedAt || b.scheduledAt).getTime() - new Date(a.startedAt || a.scheduledAt).getTime());

    return NextResponse.json({ reports, total: reports.length });
  } catch (error) {
    console.error('Error fetching cleaning reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

// POST - Create a new cleaning report or start a job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { propertyId, propertyName, cleanerId, cleanerName, scheduledAt, jobType = 'turnover' } = body;

        if (!propertyId || !cleanerId || !scheduledAt) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const checklist = getChecklistForProperty(propertyId);
        const reportId = `clean-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const report: CleaningReport = {
          id: reportId,
          propertyId,
          propertyName: propertyName || 'Unknown Property',
          cleanerId,
          cleanerName: cleanerName || 'Unknown Cleaner',
          scheduledAt: new Date(scheduledAt),
          jobType,
          status: 'not_started',
          checklist: checklist.map(item => ({
            itemId: item.id,
            completed: false,
            photoUrl: undefined,
            notes: undefined,
            completedAt: undefined
          })),
          issues: [],
          verificationPhotos: [],
          overallNotes: ''
        };

        cleaningReports.set(reportId, report);
        return NextResponse.json({ success: true, report });
      }

      case 'start': {
        const { reportId } = body;
        const report = cleaningReports.get(reportId);

        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        report.status = 'in_progress';
        report.startedAt = new Date();
        cleaningReports.set(reportId, report);

        return NextResponse.json({ success: true, report });
      }

      case 'complete_item': {
        const { reportId, itemId, photoUrl, notes } = body;
        const report = cleaningReports.get(reportId);

        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const item = report.checklist.find(i => i.itemId === itemId);
        if (!item) {
          return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
        }

        // Check if photo is required by looking up the original checklist item
        const originalItem = masterChecklist.find(i => i.id === itemId);
        if (originalItem?.requiresPhoto && !photoUrl) {
          return NextResponse.json({ error: 'Photo required for this item' }, { status: 400 });
        }

        item.completed = true;
        item.photoUrl = photoUrl;
        item.notes = notes;
        item.completedAt = new Date();

        cleaningReports.set(reportId, report);

        // Calculate progress
        const completed = report.checklist.filter(i => i.completed).length;
        const total = report.checklist.length;

        return NextResponse.json({
          success: true,
          item,
          progress: { completed, total, percentage: Math.round((completed / total) * 100) }
        });
      }

      case 'report_issue': {
        const { reportId, issue } = body;
        const report = cleaningReports.get(reportId);

        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const newIssue: CleaningIssue = {
          ...issue,
          id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          reportedAt: new Date(),
          status: 'reported'
        };

        report.issues.push(newIssue);
        cleaningReports.set(reportId, report);

        return NextResponse.json({ success: true, issue: newIssue });
      }

      case 'add_photo': {
        const { reportId, photoUrl, description, location } = body;
        const report = cleaningReports.get(reportId);

        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        const photo = {
          area: location || description || 'General',
          photoUrl: photoUrl,
          takenAt: new Date()
        };

        report.verificationPhotos.push(photo);
        cleaningReports.set(reportId, report);

        return NextResponse.json({ success: true, photo });
      }

      case 'complete': {
        const { reportId, notes, overallRating } = body;
        const report = cleaningReports.get(reportId);

        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        // Check if all required items are completed
        const incompleteRequired = report.checklist.filter(item => {
          const originalItem = masterChecklist.find(m => m.id === item.itemId);
          return originalItem?.requiresPhoto && !item.completed;
        });

        if (incompleteRequired.length > 0) {
          return NextResponse.json({
            error: 'All required items must be completed with photos',
            incompleteItems: incompleteRequired.map(i => {
              const original = masterChecklist.find(m => m.id === i.itemId);
              return original?.task || i.itemId;
            })
          }, { status: 400 });
        }

        report.status = 'completed';
        report.completedAt = new Date();
        report.overallNotes = notes || report.overallNotes;

        // Calculate duration
        if (report.startedAt) {
          const start = new Date(report.startedAt).getTime();
          const end = new Date(report.completedAt!).getTime();
          report.timeSpentMinutes = Math.round((end - start) / 60000);
        }

        // Calculate rating based on completion and issues
        const completedItems = report.checklist.filter(i => i.completed).length;
        const totalItems = report.checklist.length;
        const issueDeduction = report.issues.filter(i => i.severity === 'high' || i.severity === 'urgent').length * 0.5;
        report.rating = Math.max(0, Math.round(((completedItems / totalItems) * 5) - issueDeduction));

        cleaningReports.set(reportId, report);

        return NextResponse.json({
          success: true,
          report,
          summary: {
            completedItems,
            totalItems,
            issuesReported: report.issues.length,
            photosUploaded: report.verificationPhotos.length + report.checklist.filter(i => i.photoUrl).length,
            timeSpentMinutes: report.timeSpentMinutes,
            rating: report.rating
          }
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing cleaning report:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// PUT - Update a cleaning report
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, updates } = body;

    const report = cleaningReports.get(reportId);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Update allowed fields
    if (updates.overallNotes !== undefined) report.overallNotes = updates.overallNotes;
    if (updates.status !== undefined) report.status = updates.status;

    cleaningReports.set(reportId, report);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error updating cleaning report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

// DELETE - Cancel a cleaning job
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    const report = cleaningReports.get(reportId);
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    if (report.status === 'completed') {
      return NextResponse.json({ error: 'Cannot delete completed reports' }, { status: 400 });
    }

    cleaningReports.delete(reportId);
    return NextResponse.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    console.error('Error deleting cleaning report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}
