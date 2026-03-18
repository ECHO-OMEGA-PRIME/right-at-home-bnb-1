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
