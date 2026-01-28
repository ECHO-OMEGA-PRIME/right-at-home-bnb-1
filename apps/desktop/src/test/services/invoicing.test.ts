/**
 * Right at Home BnB - Invoicing Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockElectronAPI, mockStore } from '../setup';

describe('Invoicing Service', () => {
  let invoicingService: typeof import('@renderer/services/invoicing');

  beforeEach(async () => {
    vi.resetModules();
    mockStore.clear();

    // Dynamic import to get fresh instance
    invoicingService = await import('@renderer/services/invoicing');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Invoice Generation', () => {
    const mockBooking = {
      id: 'booking-123',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      propertyName: 'Sunset Villa',
      propertyAddress: '123 Beach Rd, Midland, TX',
      checkIn: new Date('2024-01-15'),
      checkOut: new Date('2024-01-20'),
      nightlyRate: 150,
      cleaningFee: 75,
      serviceFee: 45,
      taxes: 52.5,
      totalAmount: 897.5,
    };

    it('should generate invoice with correct line items', () => {
      const invoice = invoicingService.generateInvoice(mockBooking);

      expect(invoice).toBeDefined();
      expect(invoice.lineItems).toBeDefined();
      expect(invoice.lineItems.length).toBeGreaterThan(0);

      // Check for accommodation line item
      const accommodationItem = invoice.lineItems.find(
        item => item.description.includes('night')
      );
      expect(accommodationItem).toBeDefined();
    });

    it('should calculate correct total amount', () => {
      const invoice = invoicingService.generateInvoice(mockBooking);

      // 5 nights * $150 = $750 + $75 cleaning + $45 service + $52.5 taxes = $922.5
      expect(invoice.total).toBe(mockBooking.totalAmount);
    });

    it('should generate unique invoice numbers', () => {
      const invoice1 = invoicingService.generateInvoice(mockBooking);
      const invoice2 = invoicingService.generateInvoice(mockBooking);

      expect(invoice1.invoiceNumber).toBeDefined();
      expect(invoice2.invoiceNumber).toBeDefined();
      expect(invoice1.invoiceNumber).not.toBe(invoice2.invoiceNumber);
    });

    it('should include property and guest information', () => {
      const invoice = invoicingService.generateInvoice(mockBooking);

      expect(invoice.guest.name).toBe('John Doe');
      expect(invoice.guest.email).toBe('john@example.com');
      expect(invoice.property.name).toBe('Sunset Villa');
      expect(invoice.property.address).toBe('123 Beach Rd, Midland, TX');
    });

    it('should calculate correct number of nights', () => {
      const invoice = invoicingService.generateInvoice(mockBooking);

      expect(invoice.nights).toBe(5);
    });
  });

  describe('Invoice Formatting', () => {
    it('should format currency correctly', () => {
      const formatted = invoicingService.formatCurrency(1234.56);

      expect(formatted).toBe('$1,234.56');
    });

    it('should format date ranges correctly', () => {
      const checkIn = new Date('2024-01-15');
      const checkOut = new Date('2024-01-20');
      const formatted = invoicingService.formatDateRange(checkIn, checkOut);

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2024');
    });

    it('should format invoice number with proper prefix', () => {
      const invoiceNumber = invoicingService.generateInvoiceNumber();

      expect(invoiceNumber).toMatch(/^RAH-\d{4}-\d{6}$/);
    });
  });

  describe('Tax Calculations', () => {
    it('should calculate taxes based on rate', () => {
      const subtotal = 800;
      const taxRate = 0.0825; // 8.25% Texas tax

      const taxes = invoicingService.calculateTaxes(subtotal, taxRate);

      expect(taxes).toBe(66);
    });

    it('should handle zero tax rate', () => {
      const subtotal = 800;
      const taxRate = 0;

      const taxes = invoicingService.calculateTaxes(subtotal, taxRate);

      expect(taxes).toBe(0);
    });

    it('should round taxes to 2 decimal places', () => {
      const subtotal = 123.45;
      const taxRate = 0.0825;

      const taxes = invoicingService.calculateTaxes(subtotal, taxRate);

      expect(taxes).toBe(10.18);
    });
  });

  describe('Invoice Status', () => {
    it('should track invoice status', () => {
      const invoice = invoicingService.createInvoice({
        bookingId: 'booking-123',
        amount: 500,
      });

      expect(invoice.status).toBe('draft');

      invoice.status = 'sent';
      expect(invoice.status).toBe('sent');

      invoice.status = 'paid';
      expect(invoice.status).toBe('paid');
    });

    it('should record payment date when marked as paid', () => {
      const invoice = invoicingService.createInvoice({
        bookingId: 'booking-123',
        amount: 500,
      });

      invoicingService.markAsPaid(invoice);

      expect(invoice.status).toBe('paid');
      expect(invoice.paidAt).toBeDefined();
      expect(invoice.paidAt).toBeInstanceOf(Date);
    });
  });

  describe('Invoice Templates', () => {
    it('should use default template when none specified', () => {
      const html = invoicingService.renderInvoiceHTML({
        invoiceNumber: 'RAH-2024-001234',
        guest: { name: 'John Doe', email: 'john@example.com' },
        property: { name: 'Sunset Villa', address: '123 Beach Rd' },
        lineItems: [{ description: 'Accommodation', amount: 750 }],
        total: 750,
      });

      expect(html).toContain('RAH-2024-001234');
      expect(html).toContain('John Doe');
      expect(html).toContain('Sunset Villa');
    });

    it('should include company branding', () => {
      const html = invoicingService.renderInvoiceHTML({
        invoiceNumber: 'RAH-2024-001234',
        guest: { name: 'Guest', email: 'guest@example.com' },
        property: { name: 'Property', address: 'Address' },
        lineItems: [],
        total: 0,
      });

      expect(html).toContain('Right at Home BnB');
    });
  });
});
