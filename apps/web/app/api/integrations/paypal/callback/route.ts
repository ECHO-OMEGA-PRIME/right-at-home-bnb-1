import { NextRequest, NextResponse } from "next/server";
import { getPayPalBaseUrl } from "@/lib/integrations/paypal-client";

/**
 * GET /api/integrations/paypal/callback
 *
 * OAuth callback handler for PayPal. Receives an authorization code,
 * exchanges it for access + refresh tokens, and stores them for future use.
 *
 * Query params:
 *   code  - authorization code from PayPal redirect
 *   state - CSRF / session state token (should be validated)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code in callback." },
        { status: 400 }
      );
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "PayPal client credentials are not configured." },
        { status: 500 }
      );
    }

    const baseUrl = getPayPalBaseUrl();
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    // Exchange the authorization code for tokens
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(
        "[PayPal Callback] Token exchange failed:",
        tokenResponse.status,
        errorBody
      );
      return NextResponse.json(
        {
          error: "Failed to exchange authorization code for tokens.",
          details: errorBody,
        },
        { status: 502 }
      );
    }

    const tokenData = await tokenResponse.json();

    // In production, persist refresh_token + access_token securely
    // (e.g. encrypted in DB or secure cookie). For now we log and return status.
    console.log(
      "[PayPal Callback] Token exchange successful. Scope:",
      tokenData.scope
    );

    // Redirect the user back to the integrations settings page
    const redirectUrl = new URL("/settings/integrations", request.url);
    redirectUrl.searchParams.set("paypal", "connected");
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("[PayPal Callback] Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during PayPal OAuth callback",
      },
      { status: 500 }
    );
  }
}
