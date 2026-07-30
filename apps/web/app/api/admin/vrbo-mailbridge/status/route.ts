import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'admin');
  if (auth.error) return auth.error;

  try {
    const [mailCounts, ledgerCounts, recentRuns, atRisk] = await Promise.all([
      prisma.vrboMailMessage.groupBy({
        by: ['parseStatus'],
        _count: { _all: true },
      }),
      prisma.vrboReservationLedger.groupBy({
        by: ['consensusStatus'],
        _count: { _all: true },
      }),
      prisma.vrboReconciliationRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          mode: true,
          status: true,
          evidenceCount: true,
          reservationCount: true,
          consistentCount: true,
          unverifiedCount: true,
          syncAtRiskCount: true,
          errorCount: true,
        },
      }),
      prisma.vrboReservationLedger.findMany({
        where: { consensusStatus: 'SYNC_AT_RISK' },
        orderBy: { lastReconciledAt: 'desc' },
        take: 25,
        select: {
          reservationKey: true,
          propertyId: true,
          vrboListingId: true,
          reservationId: true,
          confirmationCode: true,
          status: true,
          checkIn: true,
          checkOut: true,
          sourceCount: true,
          evidenceCount: true,
          disagreementJson: true,
          validationErrors: true,
          lastReconciledAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      mode: 'SHADOW',
      mutatesLiveOperations: false,
      mail: Object.fromEntries(
        mailCounts.map((item) => [item.parseStatus, item._count._all]),
      ),
      ledger: Object.fromEntries(
        ledgerCounts.map((item) => [item.consensusStatus, item._count._all]),
      ),
      recentRuns,
      atRisk,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    const schemaMissing =
      message.includes('does not exist') ||
      message.includes('VrboMailMessage') ||
      message.includes('VrboReservationLedger');

    return NextResponse.json(
      {
        error: schemaMissing
          ? 'Vrbo MailBridge schema is not deployed'
          : 'Failed to read Vrbo MailBridge status',
        code: schemaMissing ? 'MAILBRIDGE_SCHEMA_MISSING' : 'MAILBRIDGE_STATUS_FAILED',
      },
      { status: schemaMissing ? 503 : 500 },
    );
  }
}
