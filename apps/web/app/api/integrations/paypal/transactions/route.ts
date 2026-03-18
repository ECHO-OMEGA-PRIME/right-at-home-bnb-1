import { NextRequest, NextResponse } from "next/server";
import { paypalFetch } from "@/lib/integrations/paypal-client";

/**
 * GET /api/integrations/paypal/transactions
 *
 * List recent PayPal transactions using the Transaction Search API.
 *
 * Query params:
 *   start_date  - ISO 8601 datetime (default: 30 days ago)
 *   end_date    - ISO 8601 datetime (default: now)
 *   page        - 1-based page number (default 1)
 *   page_size   - results per page (default 100, max 500)
 *   fields      - "all" for full details, "transaction_info" for summary (default "all")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Default date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const startDate =
      searchParams.get("start_date") ?? thirtyDaysAgo.toISOString();
    const endDate = searchParams.get("end_date") ?? now.toISOString();
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("page_size") ?? "100", 10))
    );
    const fields = searchParams.get("fields") ?? "all";

    const queryParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      page: String(page),
      page_size: String(pageSize),
      fields,
    });

    const response = await paypalFetch(
      `/v1/reporting/transactions?${queryParams.toString()}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[PayPal Transactions GET] Request failed:",
        response.status,
        errorBody
      );
      return NextResponse.json(
        { error: "Failed to fetch PayPal transactions.", details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      transactions: data.transaction_details ?? [],
      totalItems: data.total_items ?? 0,
      totalPages: data.total_pages ?? 0,
      page,
      pageSize,
      startDate,
      endDate,
      accountNumber: data.account_number ?? null,
      lastRefreshed: data.last_refreshed_datetime ?? null,
    });
  } catch (error) {
    console.error("[PayPal Transactions GET] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error fetching PayPal transactions",
      },
      { status: 500 }
    );
  }
}
