import twilio from 'twilio';

export interface SensitiveDeliveryRequest {
  email?: string | null;
  phone?: string | null;
  subject: string;
  message: string;
}

export interface SensitiveDeliveryReceipt {
  channel: 'SMS' | 'EMAIL';
  receiptId: string;
  deliveredAt: string;
}

function assertMessageSafe(message: string): void {
  if (!message || message.length > 4000) {
    throw new Error('Sensitive message must be between 1 and 4000 characters');
  }
}

async function sendSms(phone: string, message: string): Promise<SensitiveDeliveryReceipt> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    throw new Error('SMS delivery is not configured');
  }

  const client = twilio(accountSid, authToken);
  const result = await client.messages.create({ to: phone, from, body: message });
  return {
    channel: 'SMS',
    receiptId: result.sid,
    deliveredAt: new Date().toISOString(),
  };
}

async function sendEmail(email: string, subject: string, message: string): Promise<SensitiveDeliveryReceipt> {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  const from = process.env.RAH_TRANSACTIONAL_EMAIL || 'stay@rah-midland.com';

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Email delivery is not configured');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Right at Home BnB <${from}>`,
        to: [email],
        subject,
        text: message,
      }),
    });
    if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}`);
    const body = await response.json();
    return {
      channel: 'EMAIL',
      receiptId: String(body.id || 'resend-receipt'),
      deliveredAt: new Date().toISOString(),
    };
  }

  if (provider === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('Email delivery is not configured');
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from, name: 'Right at Home BnB' },
        subject,
        content: [{ type: 'text/plain', value: message }],
      }),
    });
    if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}`);
    return {
      channel: 'EMAIL',
      receiptId: response.headers.get('x-message-id') || 'sendgrid-receipt',
      deliveredAt: new Date().toISOString(),
    };
  }

  throw new Error(`Unsupported email provider: ${provider}`);
}

/**
 * Delivers a sensitive value without persisting or logging the message body.
 * SMS is preferred. Email is used only when SMS is unavailable or fails.
 */
export async function deliverSensitiveGuestMessage(
  request: SensitiveDeliveryRequest,
): Promise<SensitiveDeliveryReceipt> {
  assertMessageSafe(request.message);

  let smsError: Error | null = null;
  if (request.phone) {
    try {
      return await sendSms(request.phone, request.message);
    } catch (error) {
      smsError = error instanceof Error ? error : new Error('SMS delivery failed');
    }
  }

  if (request.email) {
    return sendEmail(request.email, request.subject, request.message);
  }

  throw smsError || new Error('Guest has no deliverable phone or email address');
}
