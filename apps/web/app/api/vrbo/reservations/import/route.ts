/**
 * POST /api/vrbo/reservations/import
 * Import VRBO Partner Central reservation CSV export.
 * Body: { csv: string } or multipart file upload.
 */
import { NextRequest, NextResponse } from 'next/server';
import { importVrboReservationsCsv } from '@/lib/integrations/vrbo-csv-import-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let csvText = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (file instanceof File) {
        csvText = await file.text();
      } else {
        csvText = String(form.get('csv') ?? '');
      }
    } else {
      const body = await request.json();
      csvText = body.csv ?? body.content ?? '';
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'Missing CSV content' }, { status: 400 });
    }

    const result = await importVrboReservationsCsv(csvText);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}