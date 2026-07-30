import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireOneOfRoles } from '@/lib/api-auth';

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend';

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

function constantTimeEquals(leftValue: string, rightValue: string): boolean {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function authorize(request: NextRequest): Promise<NextResponse | null> {
  const expected = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || '';
  const supplied = request.headers.get('x-api-secret') || '';
  if (expected && supplied && constantTimeEquals(supplied, expected)) return null;
  const auth = await requireOneOfRoles(request, ['owner', 'admin']);
  return auth.error;
}

function validate(body: EmailRequest): string | null {
  if (!body.to || !body.subject || !body.html) return 'Missing required fields: to, subject, html';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) return 'Invalid recipient email address';
  if (body.subject.length > 200) return 'Subject is too long';
  if (body.html.length > 200_000) return 'Email body is too large';
  return null;
}

async function sendViaResend(body: EmailRequest, from: string): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Email delivery is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Right at Home BnB <${from}>`,
      to: [body.to],
      reply_to: body.replyTo,
      subject: body.subject,
      html: body.html,
      text: body.text,
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  const result = await response.json();
  return String(result.id || 'resend-receipt');
}

async function sendViaSendGrid(body: EmailRequest, from: string): Promise<string> {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error('Email delivery is not configured');
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: body.to }] }],
      from: { email: from, name: 'Right at Home BnB' },
      reply_to: body.replyTo ? { email: body.replyTo } : undefined,
      subject: body.subject,
      content: [
        ...(body.text ? [{ type: 'text/plain', value: body.text }] : []),
        { type: 'text/html', value: body.html },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  return response.headers.get('x-message-id') || 'sendgrid-receipt';
}

export async function POST(request: NextRequest) {
  const denied = await authorize(request);
  if (denied) return denied;

  try {
    const body = await request.json() as EmailRequest;
    const validationError = validate(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const from = process.env.RAH_TRANSACTIONAL_EMAIL || 'stay@rah-midland.com';
    const messageId = EMAIL_PROVIDER === 'resend'
      ? await sendViaResend(body, from)
      : EMAIL_PROVIDER === 'sendgrid'
        ? await sendViaSendGrid(body, from)
        : null;

    if (!messageId) {
      return NextResponse.json({ error: `Unsupported email provider: ${EMAIL_PROVIDER}` }, { status: 500 });
    }

    console.log(`[EMAIL] Delivered receipt ${messageId}`);
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
