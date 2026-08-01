import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import { propertyScopeFor } from '@/lib/tenant-scope';
import { EXPORT_REPORTS, type ExportReport, buildExport } from '@/lib/accounting-exports';
import { csvHeaders, toCsv } from '@/lib/csv';

// P5 objective 1 — tax and utilities exports.
//
// Server-side on purpose. The two exports that existed built CSV in the browser
// by joining arrays with commas and no escaping, so one property name with a
// comma in it shifted every column after it — producing a file that opens
// cleanly with the wrong numbers under the wrong headings. Doing it here means
// one implementation, escaped once, that the tenant scope also applies to.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function defaultStart(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), 0, 1)); // 1 January — a tax year
}

function parseDay(raw: string | null, fallback: Date, endOfDay = false): Date | null {
  if (!raw) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── GET /api/accounting/exports?report=&start=&end=&format= ──────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const report = params.get('report') ?? 'revenue';

  // Enumerate what is allowed rather than rejecting a blocklist.
  if (!EXPORT_REPORTS.includes(report as ExportReport)) {
    return NextResponse.json(
      { error: `report must be one of: ${EXPORT_REPORTS.join(', ')}` },
      { status: 400 },
    );
  }

  const start = parseDay(params.get('start'), defaultStart());
  const end = parseDay(params.get('end'), new Date(), true);

  // A filing export that quietly covers a different period than the one asked
  // for is worse than an error, because nothing about the file looks wrong.
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end must be YYYY-MM-DD dates' }, { status: 400 });
  }
  if (start > end) {
    return NextResponse.json({ error: 'start must be on or before end' }, { status: 400 });
  }

  try {
    const scope = await propertyScopeFor(auth.user);
    const result = await buildExport(report as ExportReport, scope, start, end);

    if ((params.get('format') ?? 'csv').toLowerCase() === 'json') {
      return NextResponse.json({
        report: result.report,
        period: result.period,
        row_count: result.records.length,
        records: result.records,
        warnings: result.warnings,
      });
    }

    return new NextResponse(toCsv(result.headers, result.rows), {
      headers: csvHeaders(result.filename, result.rows.length),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to build the export', detail: error.message },
      { status: 500 },
    );
  }
}
