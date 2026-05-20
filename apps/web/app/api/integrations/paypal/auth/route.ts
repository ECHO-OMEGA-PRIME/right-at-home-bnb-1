import { NextRequest, NextResponse } from "next/server";
import {
  getPayPalAccessToken,
  getPayPalBaseUrl,
} from "@/lib/integrations/paypal-client";

/**
 * GET /api/integrations/paypal/auth
 *
 * Returns current PayPal connection status by verifying the configured
 * REST API credentials can obtain an access token.
 */
export async function GET() {
  try {
    const token = await getPayPalAccessToken();
    const baseUrl = getPayPalBaseUrl();
    const mode = process.env.PAYPAL_MODE ?? "sandbox";

    return NextResponse.json({
      connected: true,
      mode,
      baseUrl,
      tokenPreview: `${token.slice(0, 8)}...`,
      message: "PayPal REST API credentials are valid.",
    });
  } catch (error) {
    console.error("[PayPal Auth GET] Failed to verify credentials:", error);
    return NextResponse.json(
      {
        connected: false,
        mode: process.env.PAYPAL_MODE ?? "sandbox",
        error:
          error instanceof Error ? error.message : "Unknown error verifying PayPal credentials",
      },
      { status: 502 }
    );
  }
}

/**
 * POST /api/integrations/paypal/auth
 *
 * Stores / updates Steven's PayPal connection info (merchant ID, etc.).
 * Since we already have REST API keys configured, this endpoint verifies
 * the keys work and optionally stores a merchant_id for future reference.
 *
 * Body: { merchantId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId } = body as { merchantId?: string };

    // Verify the credentials work by obtaining a token
    const token = await getPayPalAccessToken();
    const mode = process.env.PAYPAL_MODE ?? "sandbox";

    // In a production setup you would persist merchantId to the database.
    // For now we confirm the credentials are valid and return the info.
    return NextResponse.json({
      connected: true,
      mode,
      merchantId: merchantId ?? null,
      tokenPreview: `${token.slice(0, 8)}...`,
      message: "PayPal connection verified successfully.",
    });
  } catch (error) {
    console.error("[PayPal Auth POST] Connection verification failed:", error);
    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error ? error.message : "Unknown error during PayPal connection",
      },
      { status: 502 }
    );
  }
}
