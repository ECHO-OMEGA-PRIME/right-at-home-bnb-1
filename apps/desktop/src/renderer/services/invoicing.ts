/**
 * Right at Home BnB - Invoice Generation Service
 * Professional invoice creation with PDF export
 */

import type { Booking, Property, Guest, Transaction } from '@shared/types';
import { format, parseISO, differenceInDays } from 'date-fns';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  propertyId: string;
  guestId: string;
  property: Property;
  guest: Guest;
  booking: Booking;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: 'accommodation' | 'cleaning' | 'service' | 'extra' | 'discount' | 'tax';
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceConfig {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;
  taxRate: number;
  paymentTerms: number; // days
  bankDetails?: string;
  venmoHandle?: string;
  zelleEmail?: string;
  invoicePrefix: string;
  termsAndConditions?: string;
}

class InvoicingService {
  private config: InvoiceConfig = {
    companyName: 'Right at Home BnB',
    companyAddress: 'Midland, TX 79701',
    companyPhone: '(432) 555-0000',
    companyEmail: 'steven@rah-midland.com',
    taxRate: 0, // Vacation rentals often tax-exempt in TX
    paymentTerms: 7,
    invoicePrefix: 'RAH',
    termsAndConditions: 'Thank you for staying with Right at Home BnB! We hope to host you again soon.',
  };

  private invoiceCounter: number = 0;

  constructor() {
    this.loadConfig();
    this.loadCounter();
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await window.electronAPI.store.get<InvoiceConfig>('invoiceConfig');
      if (stored) {
        this.config = { ...this.config, ...stored };
      }
    } catch (error) {
      console.error('[Invoice] Failed to load config:', error);
    }
  }

  private async loadCounter(): Promise<void> {
    try {
      const counter = await window.electronAPI.store.get<number>('invoiceCounter');
      this.invoiceCounter = counter || 0;
    } catch (error) {
      console.error('[Invoice] Failed to load counter:', error);
    }
  }

  private async incrementCounter(): Promise<string> {
    this.invoiceCounter++;
    await window.electronAPI.store.set('invoiceCounter', this.invoiceCounter);
    const year = new Date().getFullYear();
    return `${this.config.invoicePrefix}-${year}-${String(this.invoiceCounter).padStart(5, '0')}`;
  }

  async saveConfig(config: Partial<InvoiceConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await window.electronAPI.store.set('invoiceConfig', this.config);
  }

  getConfig(): InvoiceConfig {
    return { ...this.config };
  }

  // Generate invoice from booking
  async generateInvoice(
    booking: Booking,
    property: Property,
    guest: Guest,
    extras?: { description: string; amount: number }[]
  ): Promise<Invoice> {
    const invoiceNumber = await this.incrementCounter();
    const nights = differenceInDays(parseISO(booking.checkOut), parseISO(booking.checkIn));
    const nightlyRate = (booking.totalPrice - booking.cleaningFee - booking.serviceFee) / nights;

    const lineItems: InvoiceLineItem[] = [
      {
        id: '1',
        description: `Accommodation at ${property.name}`,
        quantity: nights,
        unitPrice: nightlyRate,
        total: nightlyRate * nights,
        type: 'accommodation',
      },
      {
        id: '2',
        description: 'Cleaning Fee',
        quantity: 1,
        unitPrice: booking.cleaningFee,
        total: booking.cleaningFee,
        type: 'cleaning',
      },
    ];

    if (booking.serviceFee > 0) {
      lineItems.push({
        id: '3',
        description: 'Service Fee',
        quantity: 1,
        unitPrice: booking.serviceFee,
        total: booking.serviceFee,
        type: 'service',
      });
    }

    // Add extras
    if (extras && extras.length > 0) {
      extras.forEach((extra, index) => {
        lineItems.push({
          id: `extra-${index + 1}`,
          description: extra.description,
          quantity: 1,
          unitPrice: extra.amount,
          total: extra.amount,
          type: extra.amount < 0 ? 'discount' : 'extra',
        });
      });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (this.config.taxRate / 100);
    const total = subtotal + taxAmount;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + this.config.paymentTerms);

    const invoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      bookingId: booking.id,
      propertyId: property.id,
      guestId: guest.id,
      property,
      guest,
      booking,
      lineItems,
      subtotal,
      taxRate: this.config.taxRate,
      taxAmount,
      total,
      status: 'draft',
      dueDate: dueDate.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return invoice;
  }

  // Generate HTML for invoice (for PDF export)
  generateInvoiceHTML(invoice: Invoice): string {
    const checkIn = format(parseISO(invoice.booking.checkIn), 'MMMM d, yyyy');
    const checkOut = format(parseISO(invoice.booking.checkOut), 'MMMM d, yyyy');
    const dueDate = format(parseISO(invoice.dueDate), 'MMMM d, yyyy');
    const invoiceDate = format(parseISO(invoice.createdAt), 'MMMM d, yyyy');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #333; background: #fff; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid #500000; padding-bottom: 20px; }
    .company { }
    .company h1 { color: #500000; font-size: 28px; margin-bottom: 8px; }
    .company p { color: #666; font-size: 12px; line-height: 1.6; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { color: #500000; font-size: 32px; margin-bottom: 10px; }
    .invoice-info p { font-size: 14px; margin-bottom: 4px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .party { width: 45%; }
    .party h3 { color: #500000; font-size: 14px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    .party p { font-size: 14px; line-height: 1.8; }
    .booking-details { background: #f9f9f9; padding: 15px 20px; border-radius: 8px; margin-bottom: 30px; }
    .booking-details h3 { color: #500000; font-size: 14px; margin-bottom: 10px; }
    .booking-details .row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #500000; color: white; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; }
    td { padding: 12px 15px; border-bottom: 1px solid #eee; font-size: 14px; }
    .text-right { text-align: right; }
    .totals { width: 300px; margin-left: auto; }
    .totals tr:last-child { font-weight: bold; font-size: 16px; }
    .totals tr:last-child td { border-top: 2px solid #500000; padding-top: 15px; color: #500000; }
    .payment-info { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .payment-info h3 { color: #500000; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; }
    .payment-methods { display: flex; gap: 30px; }
    .payment-method p { font-size: 13px; margin-bottom: 5px; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; padding-top: 20px; border-top: 1px solid #ddd; }
    .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .status.paid { background: #dcfce7; color: #166534; }
    .status.draft { background: #fef3c7; color: #92400e; }
    .status.sent { background: #dbeafe; color: #1e40af; }
    .status.overdue { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>${this.config.companyName}</h1>
      <p>${this.config.companyAddress}<br>
      ${this.config.companyPhone}<br>
      ${this.config.companyEmail}</p>
    </div>
    <div class="invoice-info">
      <h2>INVOICE</h2>
      <p><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
      <p><strong>Date:</strong> ${invoiceDate}</p>
      <p><strong>Due Date:</strong> ${dueDate}</p>
      <p><span class="status ${invoice.status}">${invoice.status}</span></p>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Bill To</h3>
      <p><strong>${invoice.guest.firstName} ${invoice.guest.lastName}</strong><br>
      ${invoice.guest.email}<br>
      ${invoice.guest.phone}</p>
    </div>
    <div class="party">
      <h3>Property</h3>
      <p><strong>${invoice.property.name}</strong><br>
      ${invoice.property.address}<br>
      ${invoice.property.city}, ${invoice.property.state} ${invoice.property.zipCode}</p>
    </div>
  </div>

  <div class="booking-details">
    <h3>Booking Details</h3>
    <div class="row"><span>Check-in:</span><span>${checkIn}</span></div>
    <div class="row"><span>Check-out:</span><span>${checkOut}</span></div>
    <div class="row"><span>Guests:</span><span>${invoice.booking.guests}</span></div>
    <div class="row"><span>Booking Source:</span><span>${invoice.booking.source}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.lineItems
        .map(
          (item) => `
        <tr>
          <td>${item.description}</td>
          <td class="text-right">${item.type === 'accommodation' ? `${item.quantity} nights` : item.quantity}</td>
          <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
          <td class="text-right">$${item.total.toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td>Subtotal:</td>
      <td class="text-right">$${invoice.subtotal.toFixed(2)}</td>
    </tr>
    ${
      invoice.taxAmount > 0
        ? `
    <tr>
      <td>Tax (${invoice.taxRate}%):</td>
      <td class="text-right">$${invoice.taxAmount.toFixed(2)}</td>
    </tr>
    `
        : ''
    }
    <tr>
      <td>Total Due:</td>
      <td class="text-right">$${invoice.total.toFixed(2)}</td>
    </tr>
  </table>

  <div class="payment-info">
    <h3>Payment Information</h3>
    <div class="payment-methods">
      ${this.config.venmoHandle ? `<div class="payment-method"><p><strong>Venmo:</strong></p><p>@${this.config.venmoHandle}</p></div>` : ''}
      ${this.config.zelleEmail ? `<div class="payment-method"><p><strong>Zelle:</strong></p><p>${this.config.zelleEmail}</p></div>` : ''}
      ${this.config.bankDetails ? `<div class="payment-method"><p><strong>Bank Transfer:</strong></p><p>${this.config.bankDetails}</p></div>` : ''}
    </div>
  </div>

  <div class="footer">
    <p>${this.config.termsAndConditions || ''}</p>
    <p style="margin-top: 10px; color: #500000;"><strong>Gig 'Em Aggies!</strong></p>
  </div>
</body>
</html>`;
  }

  // Export invoice to PDF
  async exportToPDF(invoice: Invoice): Promise<{ success: boolean; path?: string; error?: string }> {
    const html = this.generateInvoiceHTML(invoice);

    // Create temporary HTML file and print to PDF
    const result = await window.electronAPI.dialog.showSaveDialog({
      title: 'Save Invoice',
      defaultPath: `Invoice-${invoice.invoiceNumber}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' };
    }

    // Use Electron's print to PDF functionality
    const pdfResult = await window.electronAPI.print.toPDF();
    if (pdfResult.success) {
      return { success: true, path: result.filePath };
    }

    // Fallback: save as HTML
    const htmlPath = result.filePath.replace('.pdf', '.html');
    const writeResult = await window.electronAPI.file.write(htmlPath, html);
    if (writeResult.success) {
      await window.electronAPI.shell.openPath(htmlPath);
      return { success: true, path: htmlPath };
    }

    return { success: false, error: 'Failed to export invoice' };
  }

  // Send invoice via email (requires backend)
  async sendInvoice(invoice: Invoice, emailOverride?: string): Promise<{ success: boolean; error?: string }> {
    const email = emailOverride || invoice.guest.email;
    const subject = `Invoice ${invoice.invoiceNumber} - ${this.config.companyName}`;
    const html = this.generateInvoiceHTML(invoice);

    // This would typically call a backend API
    console.log(`[Invoice] Would send invoice to ${email}`);
    console.log(`[Invoice] Subject: ${subject}`);

    // For now, open mail client
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `Please find your invoice attached.\n\nTotal Due: $${invoice.total.toFixed(2)}\nDue Date: ${format(parseISO(invoice.dueDate), 'MMMM d, yyyy')}`
    )}`;

    await window.electronAPI.shell.openExternal(mailtoUrl);

    return { success: true };
  }

  // Generate receipt for paid invoices
  generateReceipt(invoice: Invoice): Invoice & { receiptNumber: string; receiptDate: string } {
    return {
      ...invoice,
      receiptNumber: invoice.invoiceNumber.replace(this.config.invoicePrefix, `${this.config.invoicePrefix}R`),
      receiptDate: invoice.paidDate || new Date().toISOString(),
    };
  }
}

export const invoicingService = new InvoicingService();
