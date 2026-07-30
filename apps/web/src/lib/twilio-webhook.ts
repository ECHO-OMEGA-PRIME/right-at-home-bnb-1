import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { validateRequest } from 'twilio';

/**
 * Twilio webhook signature verification.
 *
 * The /api/calls/* routes sit under the middleware's PUBLIC_API_PREFIXES, so
 * they are reachable with no session by design -- Twilio has no cookie. Until
 * now nothing verified the caller either, which meant anyone could POST forged
 * call events: drive the AI responder, fire emergency callbacks, and run up
 * Twilio spend. A session guard is the wrong fix (it would break real inbound
 * calls); signature verification is the right one.
 *
 * Twilio signs `URL + each POST param appended in alphabetical key order`, with
 * HMAC-SHA1 keyed by the account auth token, base64-encoded, sent as
 * X-Twilio-Signature (see twilio-node src/webhooks/webhooks.ts).
 *
 * The subtle part is the URL: it must be byte-identical to the one Twilio
 * called. Behind Vercel's proxy `request.url` can carry an internal host, so it
 * is rebuilt from the forwarded headers. If the number is ever pointed at a
 * different public hostname, set TWILIO_WEBHOOK_BASE_URL rather than editing
 * code.
 */

function webhookUrl(request: NextRequest): string {
  const override = process.env.TWILIO_WEBHOOK_BASE_URL?.trim();
  if (override) {
    return `${override.replace(/\/$/, '')}${request.nextUrl.pathname}${request.nextUrl.search}`;
  }
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https';
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    request.headers.get('host') ||
    request.nextUrl.host;
  return `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
}

/**
 * Verify one inbound Twilio webhook.
 *
 * Reads the form body from a CLONE so the caller can still consume its own
 * body -- a request stream can only be read once, and validating by consuming
 * it would break every handler.
 */
export async function isValidTwilioRequest(request: NextRequest): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = request.headers.get('x-twilio-signature');

  // Fail CLOSED. An absent token must deny, never wave the request through --
  // that is precisely the bug that left the cron routes open (a missing env var
  // silently disabling the check).
  if (!authToken || !signature) return false;

  let params: Record<string, string> = {};
  try {
    const form = await request.clone().formData();
    form.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : '';
    });
  } catch {
    // Not form-encoded. Twilio voice/status webhooks always are, so treat
    // anything else as unsigned rather than guessing at the body shape.
    params = {};
  }

  try {
    return validateRequest(authToken, signature, webhookUrl(request), params);
  } catch {
    return false;
  }
}

/**
 * Guard helper mirroring the api-auth `{ error }` shape used elsewhere:
 *
 *   const bad = await requireTwilioSignature(request);
 *   if (bad) return bad;
 */
export async function requireTwilioSignature(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (await isValidTwilioRequest(request)) return null;
  return NextResponse.json(
    { error: 'Invalid Twilio signature', code: 'UNAUTHORIZED' },
    { status: 401 },
  );
}

export const __testing__ = { webhookUrl };
