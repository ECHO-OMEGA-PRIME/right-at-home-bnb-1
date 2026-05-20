// PayPal API Client for RAH-Midland BnB
// Uses REST API with client credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayPalInvoiceItem {
  name: string;
  quantity: number;
  unitAmount: number;
  description?: string;
  tax?: { name: string; percent: string };
}

export interface PayPalInvoice {
  id: string;
  status: string;
  detail: {
    invoice_number: string;
    invoice_date: string;
    currency_code: string;
    note?: string;
    memo?: string;
    payment_term?: { due_date: string };
  };
  primary_recipients?: Array<{
    billing_info: {
      name?: { given_name: string; surname: string };
      email_address?: string;
    };
  }>;
  items?: Array<{
    name: string;
    quantity: string;
    unit_amount: { currency_code: string; value: string };
  }>;
  amount: {
    currency_code: string;
    value: string;
    breakdown?: {
      item_total?: { currency_code: string; value: string };
      tax_total?: { currency_code: string; value: string };
    };
  };
  due_amount?: { currency_code: string; value: string };
  payments?: {
    paid_amount?: { currency_code: string; value: string };
    transactions?: Array<{
      payment_id: string;
      amount: { currency_code: string; value: string };
      payment_date: string;
      method: string;
    }>;
  };
  links?: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalTransaction {
  transaction_info: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_updated_date: string;
    transaction_amount: { currency_code: string; value: string };
    fee_amount?: { currency_code: string; value: string };
    transaction_status: string;
    transaction_subject?: string;
    transaction_note?: string;
  };
  payer_info?: {
    account_id?: string;
    email_address?: string;
    payer_name?: { given_name?: string; surname?: string; alternate_full_name?: string };
  };
  cart_info?: {
    item_details?: Array<{
      item_name?: string;
      item_quantity?: string;
      item_unit_price?: { currency_code: string; value: string };
    }>;
  };
}

export interface PayPalBalance {
  balances: Array<{
    currency: string;
    total_balance: { currency_code: string; value: string };
    available_balance: { currency_code: string; value: string };
    withheld_balance?: { currency_code: string; value: string };
  }>;
  account_id: string;
  as_of_time: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Returns the PayPal API base URL based on the PAYPAL_MODE environment variable.
 * Defaults to sandbox when PAYPAL_MODE is not "live".
 */
export function getPayPalBaseUrl(): string {
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * Obtains a PayPal access token via the client-credentials grant.
 * Caches the token until 60 seconds before expiry.
 */
export async function getPayPalAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variables"
    );
  }

  const baseUrl = getPayPalBaseUrl();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `PayPal token request failed (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  const expiresInMs = (data.expires_in as number) * 1000;

  cachedToken = {
    token: data.access_token as string,
    expiresAt: Date.now() + expiresInMs - 60_000, // refresh 60s early
  };

  return cachedToken.token;
}

/**
 * Authenticated fetch wrapper for the PayPal REST API.
 * Automatically obtains / refreshes the bearer token.
 *
 * @param path  - API path starting with "/" (e.g. "/v2/invoicing/invoices")
 * @param options - Standard RequestInit overrides
 */
export async function paypalFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Orders API — Create & Capture (PayPal Checkout)
// ---------------------------------------------------------------------------

/**
 * Create a PayPal order for checkout.
 * Returns the order ID and the approval URL where the customer authorises payment.
 */
export async function createPayPalOrder(
  amount: number,
  description: string,
  bookingRef: string
): Promise<{ id: string; approveUrl: string }> {
  const res = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: bookingRef,
          description,
          amount: {
            currency_code: "USD",
            value: amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "Right at Home BnB",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://rah-midland.com"}/booking/complete`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://rah-midland.com"}/properties`,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal createOrder failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const approveLink = data.links?.find(
    (l: { rel: string; href: string }) => l.rel === "approve"
  );

  if (!approveLink) {
    throw new Error("PayPal order created but no approve URL returned");
  }

  return { id: data.id as string, approveUrl: approveLink.href as string };
}

/**
 * Capture payment after the customer has approved via PayPal.
 */
export async function capturePayPalOrder(
  orderId: string
): Promise<{ transactionId: string; status: string; payer: Record<string, unknown> }> {
  const res = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal captureOrder failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const capture =
    data.purchase_units?.[0]?.payments?.captures?.[0] ?? {};

  return {
    transactionId: (capture.id as string) ?? orderId,
    status: data.status as string,
    payer: data.payer ?? {},
  };
}

// ---------------------------------------------------------------------------
// Invoicing API — Create & Send
// ---------------------------------------------------------------------------

export interface InvoiceInput {
  recipientEmail: string;
  recipientName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  nightlyRate: number;
  cleaningFee: number;
  totalAmount: number;
  bookingRef: string;
}

/**
 * Create a PayPal invoice and immediately send it to the guest.
 */
export async function createAndSendInvoice(
  invoice: InvoiceInput
): Promise<{ invoiceId: string; invoiceUrl: string }> {
  const nameParts = invoice.recipientName.trim().split(/\s+/);
  const givenName = nameParts[0] || "Guest";
  const surname = nameParts.slice(1).join(" ") || "";

  const today = new Date().toISOString().slice(0, 10);

  // 1. Create draft invoice
  const createRes = await paypalFetch("/v2/invoicing/invoices", {
    method: "POST",
    body: JSON.stringify({
      detail: {
        invoice_number: `RAH-${invoice.bookingRef}`,
        invoice_date: today,
        currency_code: "USD",
        note: `Thank you for booking ${invoice.propertyName} with Right at Home BnB! Check-in: ${invoice.checkIn}, Check-out: ${invoice.checkOut}.`,
        payment_term: {
          due_date: today,
        },
      },
      invoicer: {
        name: { given_name: "Right at Home", surname: "BnB" },
        email_address: "steven@rah-midland.com",
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: givenName, surname },
            email_address: invoice.recipientEmail,
          },
        },
      ],
      items: [
        {
          name: `${invoice.propertyName} — ${invoice.nights} night${invoice.nights > 1 ? "s" : ""}`,
          description: `${invoice.checkIn} to ${invoice.checkOut}`,
          quantity: String(invoice.nights),
          unit_amount: {
            currency_code: "USD",
            value: invoice.nightlyRate.toFixed(2),
          },
        },
        ...(invoice.cleaningFee > 0
          ? [
              {
                name: "Cleaning Fee",
                description: "One-time cleaning fee",
                quantity: "1",
                unit_amount: {
                  currency_code: "USD",
                  value: invoice.cleaningFee.toFixed(2),
                },
              },
            ]
          : []),
      ],
      configuration: {
        tax_calculated_after_discount: true,
        tax_inclusive: false,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`PayPal createInvoice failed (${createRes.status}): ${err}`);
  }

  // The create endpoint returns a 201 with an href in the response
  const createData = await createRes.json();
  const invoiceHref: string | undefined =
    createData.href ??
    createData.links?.find((l: { rel: string }) => l.rel === "self")?.href;

  // Extract invoice ID from the href URL
  const invoiceId = invoiceHref?.split("/").pop() ?? createData.id ?? "";

  // 2. Send the invoice
  const sendRes = await paypalFetch(
    `/v2/invoicing/invoices/${invoiceId}/send`,
    {
      method: "POST",
      body: JSON.stringify({ send_to_invoicer: true }),
    }
  );

  if (!sendRes.ok) {
    const sendErr = await sendRes.text();
    console.error(`PayPal sendInvoice warning (${sendRes.status}): ${sendErr}`);
    // Don't throw — invoice was created, just not sent automatically
  }

  const invoiceUrl = `https://www.paypal.com/invoice/p/#${invoiceId}`;

  return { invoiceId, invoiceUrl };
}
