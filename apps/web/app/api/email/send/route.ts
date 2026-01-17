/**
 * Right at Home BnB - Email Sending API
 * Handles transactional emails via configured email service
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';

// Email service configuration - supports multiple providers
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend'; // 'resend', 'sendgrid', 'smtp'
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

interface EmailRequest {
  to: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}

// Send via Resend
async function sendViaResend(email: EmailRequest): Promise<{ messageId: string }> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: email.fromName ? `${email.fromName} <${email.from}>` : email.from,
      to: [email.to],
      reply_to: email.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send email via Resend');
  }

  const result = await response.json();
  return { messageId: result.id };
}

// Send via SendGrid
async function sendViaSendGrid(email: EmailRequest): Promise<{ messageId: string }> {
  if (!SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: email.to }] }],
      from: {
        email: email.from,
        name: email.fromName,
      },
      reply_to: email.replyTo ? { email: email.replyTo } : undefined,
      subject: email.subject,
      content: [
        { type: 'text/plain', value: email.text || '' },
        { type: 'text/html', value: email.html },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to send email via SendGrid');
  }

  // SendGrid returns message ID in headers
  const messageId = response.headers.get('X-Message-Id') || `sg_${Date.now()}`;
  return { messageId };
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();

    // Validate required fields
    if (!body.to || !body.from || !body.subject || !body.html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, from, subject, html' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.to)) {
      return NextResponse.json(
        { error: 'Invalid recipient email address' },
        { status: 400 }
      );
    }

    let result: { messageId: string };

    switch (EMAIL_PROVIDER) {
      case 'resend':
        result = await sendViaResend(body);
        break;
      case 'sendgrid':
        result = await sendViaSendGrid(body);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported email provider: ${EMAIL_PROVIDER}` },
          { status: 500 }
        );
    }

    // Log email send (for audit trail)
    console.log(`[EMAIL] Sent to ${body.to} | Subject: ${body.subject} | ID: ${result.messageId}`);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });

  } catch (error: any) {
    console.error('[EMAIL ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
