'use client';

/**
 * Right at Home BnB - Email Templates & Sending System
 * Welcome emails and automated guest communication
 * @author ECHO OMEGA PRIME
 */

// Email Configuration
export const EMAIL_CONFIG = {
  from: {
    bookings: {
      name: 'Right at Home BnB',
      email: 'bookings@rah-midland.com', // Alias for steven.palma@rah-midland.com
    },
    support: {
      name: 'Right at Home Support',
      email: 'support@rah-midland.com',
    },
    owner: {
      name: 'Steven Palma',
      email: 'steven.palma@rah-midland.com',
    },
  },
  replyTo: 'steven.palma@rah-midland.com',
};

// Email Template Types
export type EmailTemplateType =
  | 'booking_confirmation'
  | 'welcome'
  | 'checkin_instructions'
  | 'checkout_reminder'
  | 'review_request'
  | 'cancellation'
  | 'refund_processed'
  | 'payment_reminder';

// Booking Details for Templates
export interface BookingEmailData {
  guestName: string;
  guestEmail: string;
  propertyName: string;
  propertyAddress: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  numberOfGuests: number;
  numberOfNights: number;
  totalAmount: number;
  confirmationNumber: string;
  wifiName?: string;
  wifiPassword?: string;
  doorCode?: string;
  parkingInstructions?: string;
  specialInstructions?: string;
  contactPhone: string;
}

// Generate Welcome Email HTML
export function generateWelcomeEmail(data: BookingEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Right at Home BnB</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 0; padding: 0; background: #F5F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #500000 0%, #722F37 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: normal; }
    .header p { color: #C4A777; margin: 10px 0 0; font-size: 14px; }
    .content { padding: 40px 30px; }
    .greeting { font-size: 20px; color: #500000; margin-bottom: 20px; }
    .info-box { background: #F5F5F0; border-left: 4px solid #500000; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #666; font-size: 14px; }
    .info-value { color: #2D2D2D; font-weight: bold; font-size: 14px; }
    .highlight-box { background: #500000; color: white; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px; }
    .highlight-box .number { font-size: 24px; letter-spacing: 2px; font-family: monospace; }
    .cta-button { display: inline-block; background: #500000; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { background: #2D2D2D; color: #999; padding: 30px; text-align: center; font-size: 12px; }
    .footer a { color: #C4A777; }
    .divider { height: 1px; background: #C4A777; margin: 30px 0; }
    .checklist { list-style: none; padding: 0; }
    .checklist li { padding: 10px 0; padding-left: 30px; position: relative; }
    .checklist li:before { content: '✓'; position: absolute; left: 0; color: #500000; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Right at Home BnB</h1>
      <p>✦ Midland, Texas ✦</p>
    </div>

    <!-- Content -->
    <div class="content">
      <p class="greeting">Welcome, ${data.guestName}!</p>

      <p>Thank you for choosing Right at Home BnB for your upcoming stay in Midland. We're thrilled to host you and want to ensure your experience is nothing short of exceptional.</p>

      <!-- Confirmation Number -->
      <div class="highlight-box">
        <p style="margin: 0 0 10px;">Confirmation Number</p>
        <p class="number">${data.confirmationNumber}</p>
      </div>

      <!-- Booking Details -->
      <div class="info-box">
        <h3 style="margin-top: 0; color: #500000;">Your Reservation Details</h3>
        <div class="info-row">
          <span class="info-label">Property</span>
          <span class="info-value">${data.propertyName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Check-In</span>
          <span class="info-value">${data.checkInDate} at ${data.checkInTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Check-Out</span>
          <span class="info-value">${data.checkOutDate} at ${data.checkOutTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Guests</span>
          <span class="info-value">${data.numberOfGuests}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Nights</span>
          <span class="info-value">${data.numberOfNights}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total</span>
          <span class="info-value">$${data.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- What to Expect -->
      <h3 style="color: #500000;">What to Expect</h3>
      <ul class="checklist">
        <li>Check-in instructions will be sent 24 hours before your arrival</li>
        <li>Self check-in available via smart lock</li>
        <li>WiFi and all amenities information in the welcome guide</li>
        <li>24/7 AI Concierge support for any questions</li>
      </ul>

      <div class="divider"></div>

      <!-- Contact Info -->
      <h3 style="color: #500000;">Need Assistance?</h3>
      <p>Our team is here to help! You can reach us at:</p>
      <p><strong>Phone:</strong> ${data.contactPhone}</p>
      <p><strong>Email:</strong> bookings@rah-midland.com</p>

      <p style="margin-top: 30px;">We look forward to hosting you!</p>
      <p><em>— Steven Palma & The Right at Home Team</em></p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>Right at Home BnB</strong></p>
      <p>Premium Short-Term Rentals in Midland, Texas</p>
      <p style="margin-top: 20px;">
        <a href="https://rah-midland.com">Website</a> &nbsp;|&nbsp;
        <a href="https://rah-midland.com/properties">Properties</a> &nbsp;|&nbsp;
        <a href="https://rah-midland.com/contact">Contact</a>
      </p>
      <p style="margin-top: 20px; color: #666;">
        This email was sent to ${data.guestEmail} regarding your reservation.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Generate Check-In Instructions Email
export function generateCheckInEmail(data: BookingEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check-In Instructions - Right at Home BnB</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 0; padding: 0; background: #F5F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #500000 0%, #722F37 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 40px 30px; }
    .code-box { background: #500000; color: white; padding: 30px; text-align: center; margin: 20px 0; border-radius: 8px; }
    .code-box .label { font-size: 14px; opacity: 0.8; margin-bottom: 10px; }
    .code-box .code { font-size: 36px; letter-spacing: 5px; font-family: monospace; }
    .info-box { background: #F5F5F0; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .footer { background: #2D2D2D; color: #999; padding: 30px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔑 Your Check-In Instructions</h1>
    </div>
    <div class="content">
      <p>Hi ${data.guestName},</p>
      <p>Your stay at <strong>${data.propertyName}</strong> begins tomorrow! Here's everything you need to check in:</p>

      <!-- Door Code -->
      ${data.doorCode ? `
      <div class="code-box">
        <p class="label">DOOR CODE</p>
        <p class="code">${data.doorCode}</p>
        <p style="font-size: 12px; margin-top: 15px; opacity: 0.8;">This code will work from ${data.checkInTime} on ${data.checkInDate}</p>
      </div>
      ` : ''}

      <!-- Address -->
      <div class="info-box">
        <h3 style="margin-top: 0; color: #500000;">📍 Property Address</h3>
        <p style="font-size: 18px; margin: 0;">${data.propertyAddress}</p>
        <a href="https://maps.google.com/?q=${encodeURIComponent(data.propertyAddress)}" style="color: #500000;">Open in Google Maps →</a>
      </div>

      <!-- WiFi -->
      ${data.wifiName ? `
      <div class="info-box">
        <h3 style="margin-top: 0; color: #500000;">📶 WiFi Access</h3>
        <p><strong>Network:</strong> ${data.wifiName}</p>
        <p><strong>Password:</strong> ${data.wifiPassword}</p>
      </div>
      ` : ''}

      <!-- Parking -->
      ${data.parkingInstructions ? `
      <div class="info-box">
        <h3 style="margin-top: 0; color: #500000;">🚗 Parking</h3>
        <p>${data.parkingInstructions}</p>
      </div>
      ` : ''}

      <!-- Special Instructions -->
      ${data.specialInstructions ? `
      <div class="info-box">
        <h3 style="margin-top: 0; color: #500000;">📋 Special Instructions</h3>
        <p>${data.specialInstructions}</p>
      </div>
      ` : ''}

      <p style="margin-top: 30px;">Questions? Call or text us at <strong>${data.contactPhone}</strong></p>
      <p>Enjoy your stay!</p>
    </div>
    <div class="footer">
      <p>Right at Home BnB • Midland, Texas</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Generate Review Request Email
export function generateReviewRequestEmail(data: BookingEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How Was Your Stay? - Right at Home BnB</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 0; padding: 0; background: #F5F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #500000 0%, #722F37 100%); padding: 40px 20px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
    .content { padding: 40px 30px; text-align: center; }
    .stars { font-size: 48px; margin: 30px 0; }
    .cta-button { display: inline-block; background: #500000; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; }
    .footer { background: #2D2D2D; color: #999; padding: 30px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⭐ How Was Your Stay?</h1>
    </div>
    <div class="content">
      <p>Hi ${data.guestName},</p>
      <p>We hope you enjoyed your stay at <strong>${data.propertyName}</strong>!</p>
      <p>Your feedback helps us improve and helps future guests find great stays in Midland.</p>
      <div class="stars">⭐⭐⭐⭐⭐</div>
      <p>Would you take a moment to share your experience?</p>
      <a href="https://rah-midland.com/review/${data.confirmationNumber}" class="cta-button">Leave a Review</a>
      <p style="margin-top: 40px; color: #666;">Thank you for choosing Right at Home BnB. We hope to host you again!</p>
    </div>
    <div class="footer">
      <p>Right at Home BnB • Midland, Texas</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Plain text versions for accessibility/fallback
export function generateWelcomeEmailPlainText(data: BookingEmailData): string {
  return `
Welcome to Right at Home BnB!

Hi ${data.guestName},

Thank you for choosing Right at Home BnB for your upcoming stay in Midland, Texas.

CONFIRMATION NUMBER: ${data.confirmationNumber}

RESERVATION DETAILS:
- Property: ${data.propertyName}
- Check-In: ${data.checkInDate} at ${data.checkInTime}
- Check-Out: ${data.checkOutDate} at ${data.checkOutTime}
- Guests: ${data.numberOfGuests}
- Nights: ${data.numberOfNights}
- Total: $${data.totalAmount.toFixed(2)}

WHAT TO EXPECT:
✓ Check-in instructions will be sent 24 hours before your arrival
✓ Self check-in available via smart lock
✓ WiFi and all amenities information in the welcome guide
✓ 24/7 AI Concierge support for any questions

NEED ASSISTANCE?
Phone: ${data.contactPhone}
Email: bookings@rah-midland.com

We look forward to hosting you!

— Steven Palma & The Right at Home Team

---
Right at Home BnB
Premium Short-Term Rentals in Midland, Texas
https://rah-midland.com
  `.trim();
}

// Send email via API (uses configured email service)
export async function sendBookingEmail(
  type: EmailTemplateType,
  data: BookingEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  let html: string;
  let subject: string;
  let plainText: string;

  switch (type) {
    case 'booking_confirmation':
    case 'welcome':
      html = generateWelcomeEmail(data);
      plainText = generateWelcomeEmailPlainText(data);
      subject = `Booking Confirmed! ${data.propertyName} - ${data.checkInDate}`;
      break;
    case 'checkin_instructions':
      html = generateCheckInEmail(data);
      subject = `Check-In Instructions for Tomorrow - ${data.propertyName}`;
      plainText = `Your check-in details for ${data.propertyName}...`;
      break;
    case 'review_request':
      html = generateReviewRequestEmail(data);
      subject = `How Was Your Stay at ${data.propertyName}?`;
      plainText = `We hope you enjoyed your stay...`;
      break;
    default:
      return { success: false, error: 'Unknown email template type' };
  }

  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.guestEmail,
        from: EMAIL_CONFIG.from.bookings.email,
        fromName: EMAIL_CONFIG.from.bookings.name,
        replyTo: EMAIL_CONFIG.replyTo,
        subject,
        html,
        text: plainText,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message };
    }

    const result = await response.json();
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
