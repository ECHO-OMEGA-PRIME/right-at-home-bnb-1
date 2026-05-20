import { NextResponse } from "next/server";
import { paypalFetch } from "@/lib/integrations/paypal-client";

/**
 * GET /api/integrations/paypal/balance
 *
 * Returns the current PayPal account balance(s) using the
 * Reporting API /v1/reporting/balances endpoint.
 */
export async function GET() {
  try {
    const now = new Date().toISOString();

    const response = await paypalFetch(
      `/v1/reporting/balances?as_of_time=${encodeURIComponent(now)}&currency_code=USD`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[PayPal Balance GET] Request failed:",
        response.status,
        errorBody
      );
      return NextResponse.json(
        { error: "Failed to fetch PayPal balance.", details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Flatten the response into a simpler shape for the frontend
    const balances = (data.balances ?? []).map(
      (b: {
        currency: string;
        primary: boolean;
        total_balance: { currency_code: string; value: string };
        available_balance: { currency_code: string; value: string };
        withheld_balance?: { currency_code: string; value: string };
      }) => ({
        currency: b.currency,
        primary: b.primary ?? false,
        totalBalance: parseFloat(b.total_balance?.value ?? "0"),
        availableBalance: parseFloat(b.available_balance?.value ?? "0"),
        withheldBalance: parseFloat(b.withheld_balance?.value ?? "0"),
      })
    );

    return NextResponse.json({
      balances,
      accountId: data.account_id ?? null,
      asOfTime: data.as_of_time ?? now,
    });
  } catch (error) {
    console.error("[PayPal Balance GET] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error fetching PayPal balance",
      },
      { status: 500 }
    );
  }
}
