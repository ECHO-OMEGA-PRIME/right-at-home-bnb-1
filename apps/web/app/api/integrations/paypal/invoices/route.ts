import { NextRequest, NextResponse } from "next/server";
import { paypalFetch, PayPalInvoiceItem } from "@/lib/integrations/paypal-client";

/**
 * GET /api/integrations/paypal/invoices
 *
 * Search / list invoices from PayPal.
 *
 * Query params:
 *   status - optional filter (DRAFT, SENT, PAID, CANCELLED, etc.)
 *   page   - 1-based page number (default 1)
 *   limit  - page size (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    // PayPal's search-invoices endpoint uses POST with a body
    const searchBody: Record<string, unknown> = {
      page,
      page_size: pageSize,
      total_required: true,
    };

    if (status) {
      searchBody.status = [status.toUpperCase()];
    }

    const response = await paypalFetch("/v2/invoicing/search-invoices", {
      method: "POST",
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[PayPal Invoices GET] Search failed:",
        response.status,
        errorBody
      );
      return NextResponse.json(
        { error: "Failed to search PayPal invoices.", details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      invoices: data.items ?? [],
      totalItems: data.total_items?.value ?? 0,
      totalPages: data.total_pages?.value ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[PayPal Invoices GET] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error fetching PayPal invoices",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/paypal/invoices
 *
 * Create (and optionally send) a new PayPal invoice.
 *
 * Body:
 * {
 *   recipientEmail: string;
 *   recipientName: string;         // "First Last"
 *   items: Array<{ name: string; quantity: number; unitAmount: number; description?: string }>;
 *   note?: string;
 *   sendImmediately?: boolean;     // default false
 *   dueDate?: string;              // ISO date e.g. "2026-04-15"
 *   currencyCode?: string;         // default "USD"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      recipientEmail,
      recipientName,
      items,
      note,
      sendImmediately = false,
      dueDate,
      currencyCode = "USD",
    } = body as {
      recipientEmail: string;
      recipientName: string;
      items: PayPalInvoiceItem[];
      note?: string;
      sendImmediately?: boolean;
      dueDate?: string;
      currencyCode?: string;
    };

    if (!recipientEmail || !recipientName || !items?.length) {
      return NextResponse.json(
        { error: "recipientEmail, recipientName, and items are required." },
        { status: 400 }
      );
    }

    // Split name into first / last
    const nameParts = recipientName.trim().split(/\s+/);
    const givenName = nameParts[0] ?? "";
    const surname = nameParts.slice(1).join(" ") || givenName;

    // Build PayPal invoice payload
    const invoicePayload: Record<string, unknown> = {
      detail: {
        currency_code: currencyCode,
        note: note ?? "",
        ...(dueDate ? { payment_term: { due_date: dueDate } } : {}),
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: givenName, surname },
            email_address: recipientEmail,
          },
        },
      ],
      items: items.map((item) => ({
        name: item.name,
        description: item.description ?? "",
        quantity: String(item.quantity),
        unit_amount: {
          currency_code: currencyCode,
          value: item.unitAmount.toFixed(2),
        },
      })),
    };

    // Step 1: Create the invoice (draft)
    const createResponse = await paypalFetch("/v2/invoicing/invoices", {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    });

    if (!createResponse.ok) {
      const errorBody = await createResponse.text();
      console.error(
        "[PayPal Invoices POST] Create failed:",
        createResponse.status,
        errorBody
      );
      return NextResponse.json(
        { error: "Failed to create PayPal invoice.", details: errorBody },
        { status: createResponse.status }
      );
    }

    const createdInvoice = await createResponse.json();
    const invoiceId = createdInvoice.id as string;

    // Step 2: Optionally send the invoice right away
    let sent = false;
    if (sendImmediately && invoiceId) {
      const sendResponse = await paypalFetch(
        `/v2/invoicing/invoices/${invoiceId}/send`,
        {
          method: "POST",
          body: JSON.stringify({
            send_to_invoicer: true,
            send_to_recipient: true,
          }),
        }
      );

      if (!sendResponse.ok) {
        const sendError = await sendResponse.text();
        console.error(
          "[PayPal Invoices POST] Send failed:",
          sendResponse.status,
          sendError
        );
        // Invoice was created but sending failed -- return partial success
        return NextResponse.json(
          {
            invoiceId,
            status: "DRAFT",
            sent: false,
            warning: "Invoice created but sending failed.",
            sendError,
          },
          { status: 207 }
        );
      }

      sent = true;
    }

    return NextResponse.json({
      invoiceId,
      status: sent ? "SENT" : "DRAFT",
      sent,
      href: createdInvoice.href ?? null,
    });
  } catch (error) {
    console.error("[PayPal Invoices POST] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error creating PayPal invoice",
      },
      { status: 500 }
    );
  }
}
