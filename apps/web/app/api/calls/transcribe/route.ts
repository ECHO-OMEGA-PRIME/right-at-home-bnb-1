/**
 * Twilio Call Transcription Webhook
 * Right at Home BnB - AI Phone Answering System
 *
 * Receives transcription results from Twilio's <Record transcribe="true">
 * and logs them for review.
 *
 * POST /api/calls/transcribe
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB, Midland, TX
 */

import { NextRequest, NextResponse } from 'next/server';

interface TranscriptionRecord {
  callSid: string;
  recordingSid: string;
  transcriptionSid: string;
  transcriptionText: string;
  transcriptionStatus: string;
  from: string;
  to: string;
  recordingUrl: string;
  timestamp: string;
}

// In-memory store for transcriptions (in production, use database)
// Keeps the last 200 transcriptions available for review
const transcriptionLog: TranscriptionRecord[] = [];
const MAX_LOG_SIZE = 200;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const callSid = formData.get('CallSid') as string;
    const recordingSid = formData.get('RecordingSid') as string;
    const transcriptionSid = formData.get('TranscriptionSid') as string;
    const transcriptionText = formData.get('TranscriptionText') as string;
    const transcriptionStatus = formData.get('TranscriptionStatus') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;

    const record: TranscriptionRecord = {
      callSid: callSid || 'unknown',
      recordingSid: recordingSid || '',
      transcriptionSid: transcriptionSid || '',
      transcriptionText: transcriptionText || '',
      transcriptionStatus: transcriptionStatus || 'unknown',
      from: from || 'unknown',
      to: to || 'unknown',
      recordingUrl: recordingUrl || '',
      timestamp: new Date().toISOString(),
    };

    console.log('[Transcribe]', {
      callSid: record.callSid,
      from: record.from,
      status: record.transcriptionStatus,
      textLength: record.transcriptionText.length,
      text: record.transcriptionText.substring(0, 200),
      timestamp: record.timestamp,
    });

    // Store in memory log
    transcriptionLog.push(record);

    // Trim log if it exceeds max size
    if (transcriptionLog.length > MAX_LOG_SIZE) {
      transcriptionLog.splice(0, transcriptionLog.length - MAX_LOG_SIZE);
    }

    // Return empty TwiML (Twilio expects a response but doesn't use it for transcription callbacks)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  } catch (error) {
    console.error('[Transcribe Error]', error);

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      }
    );
  }
}

/**
 * GET handler to retrieve recent transcriptions for review.
 * Could be used by the admin dashboard.
 */
export async function GET() {
  return NextResponse.json({
    count: transcriptionLog.length,
    transcriptions: transcriptionLog.slice(-50).reverse(),
  });
}
