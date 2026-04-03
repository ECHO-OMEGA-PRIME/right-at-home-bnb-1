/**
 * TTS Proxy Endpoint for Twilio <Play>
 * Right at Home BnB - AI Phone Answering System
 *
 * Tries ElevenLabs first for natural voice, falls back to empty response
 * (caller handler uses <Say> as fallback when <Play> fails).
 *
 * GET /api/calls/tts?t=BASE64_ENCODED_TEXT
 *
 * @author ECHO OMEGA PRIME
 * @owner Steven Palma - Right at Home BnB, Midland, TX
 */

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = 'TxGEqnHWrfWFTfGW9XjX';
const ELEVENLABS_MODEL = 'eleven_turbo_v2_5';

export async function GET(request: NextRequest) {
  const encodedText = request.nextUrl.searchParams.get('t');

  if (!encodedText) {
    return new NextResponse('Missing text parameter', { status: 400 });
  }

  let text: string;
  try {
    text = Buffer.from(encodedText, 'base64').toString('utf-8');
  } catch {
    return new NextResponse('Invalid base64 encoding', { status: 400 });
  }

  if (!text.trim()) {
    return new NextResponse('Empty text', { status: 400 });
  }

  // Try ElevenLabs
  if (ELEVENLABS_API_KEY) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: ELEVENLABS_MODEL,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log(`[TTS] ElevenLabs success, ${audioBuffer.byteLength} bytes`);
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-cache',
          },
        });
      }

      console.error(`[TTS] ElevenLabs failed: ${response.status} ${response.statusText}`);
    } catch (err) {
      console.error('[TTS] ElevenLabs exception:', err);
    }
  }

  // ElevenLabs unavailable — return 404 so Twilio skips <Play> and falls through
  return new NextResponse('TTS unavailable', { status: 404 });
}
