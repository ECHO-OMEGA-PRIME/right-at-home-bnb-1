import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';
import {
  LedgerImbalanceError,
  UnknownAccountError,
  listJournalEntries,
  postJournalEntry,
} from '@/lib/ledger';

// Real JournalEntry / JournalEntryLine rows (queue #26855). This route pushed
// onto an in-memory array, so entries vanished on the next cold start -- an
// accounting ledger that forgot everything.
//
// The route already validated debits == credits; that rule now lives in
// postJournalEntry, which is the single door into the ledger, so the invariant
// is enforced identically no matter which caller writes an entry.

// ── GET /api/accounting/journal-entries ────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const params = request.nextUrl.searchParams;
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');

    const entries = await listJournalEntries({
      from: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
      to: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
      referenceType: params.get('reference_type'),
    });

    return NextResponse.json({ journal_entries: entries, total: entries.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to list journal entries', detail: error.message },
      { status: 500 },
    );
  }
}

// ── POST /api/accounting/journal-entries ───────────────────────────────────
export async function POST(request: NextRequest) {
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  if (auth.error) return auth.error;
  try {
    const body = await request.json();

    if (!body.date || !body.description || !Array.isArray(body.lines) || body.lines.length < 2) {
      return NextResponse.json(
        { error: 'Required: date, description, lines (array with at least 2 entries)' },
        { status: 400 },
      );
    }

    for (const line of body.lines) {
      if (!line.account_code) {
        return NextResponse.json({ error: 'Each line must have account_code' }, { status: 400 });
      }
      if (typeof line.debit_cents !== 'number' || typeof line.credit_cents !== 'number') {
        return NextResponse.json(
          { error: 'Each line must have numeric debit_cents and credit_cents' },
          { status: 400 },
        );
      }
      if (line.debit_cents < 0 || line.credit_cents < 0) {
        return NextResponse.json(
          { error: 'debit_cents and credit_cents must be non-negative' },
          { status: 400 },
        );
      }
    }

    const referenceType = body.reference_type || 'manual';
    const reference = body.reference_id ? `${referenceType}:${body.reference_id}` : referenceType;

    try {
      const entry = await postJournalEntry({
        entryDate: new Date(`${body.date}T00:00:00.000Z`),
        memo: body.description,
        reference,
        propertyId: body.property_id ?? null,
        lines: body.lines.map((l: any) => ({
          accountCode: l.account_code,
          debitCents: l.debit_cents,
          creditCents: l.credit_cents,
          propertyId: l.property_id ?? null,
          memo: l.memo ?? null,
        })),
      });

      // Re-read through the same mapper the list endpoint uses so a created
      // entry and a listed entry are never different shapes.
      const [created] = await listJournalEntries({
        from: new Date(`${body.date}T00:00:00.000Z`),
        to: new Date(`${body.date}T23:59:59.999Z`),
      });

      return NextResponse.json({ journal_entry: created ?? entry }, { status: 201 });
    } catch (e) {
      if (e instanceof LedgerImbalanceError) {
        const totalDebits = body.lines.reduce((s: number, l: any) => s + l.debit_cents, 0);
        const totalCredits = body.lines.reduce((s: number, l: any) => s + l.credit_cents, 0);
        return NextResponse.json(
          {
            error: 'Journal entry is unbalanced. Total debits must equal total credits.',
            total_debits_cents: totalDebits,
            total_credits_cents: totalCredits,
          },
          { status: 400 },
        );
      }
      if (e instanceof UnknownAccountError) {
        // A code that is not in the chart of accounts is a client error, not a
        // server fault -- and saying which code is missing is the whole point.
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create journal entry', detail: error.message },
      { status: 500 },
    );
  }
}
