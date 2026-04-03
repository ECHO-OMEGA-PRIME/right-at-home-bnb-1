import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/admin",
  "/dashboard",
  "/bookings",
  "/calendar",
  "/cleaning",
  "/concierge",
  "/finance",
  "/guests",
  "/locks",
  "/maintenance",
  "/messages",
  "/notifications",
  "/settings",
  "/smart-home",
  "/steven",
];

// Routes that are always public (no auth check)
const PUBLIC_ROUTES = [
  "/",
  "/properties",
  "/login",
  "/register",
  "/dev-login",
  "/privacy-policy",
  "/terms-of-service",
  "/booking/success",
  "/booking/complete",
];

// API routes that are public (no auth)
const PUBLIC_API_ROUTES = [
  "/api/health",
  "/api/properties",
  "/api/webhooks/stripe",
  "/api/webhooks/vrbo",
  "/api/integrations/vrbo/webhook",
  "/api/integrations/ical",
  "/api/cron",
  "/api/calls",        // Twilio webhooks (incoming, gather, status, ai-respond, transcribe)
  "/api/concierge",    // AI concierge (public guest access)
  "/api/bookings/checkout",  // PayPal direct booking checkout
  "/api/bookings/capture",   // PayPal payment capture
];

// Admin-only routes — require owner/admin role
const ADMIN_ONLY_PREFIXES = [
  "/admin",
  "/api/admin",
  "/api/payroll",
  "/api/accounting",
  "/api/integrations/paypal",
  "/api/expenses",
  "/api/invoices",
  "/api/taxes",
  "/api/settings",
];

const AUTH_COOKIE_NAME = "rah-auth-token";

type TokenRole = "guest" | "worker" | "admin" | "owner";

/**
 * Extract role from auth token.
 * Dev tokens: "dev_role_workerType" or "dev-mode-dev_role_..."
 * Firebase tokens: opaque JWT — we can't decode role in middleware without
 * calling Firebase Admin (Edge doesn't support it), so we set a role cookie.
 */
function extractRoleFromToken(token: string): TokenRole | null {
  // Dev mode tokens
  if (token.startsWith("dev_") || token.startsWith("dev-mode-")) {
    const clean = token.replace("dev-mode-", "");
    const parts = clean.split("_");
    const role = parts[1] as TokenRole;
    if (["guest", "worker", "admin", "owner"].includes(role)) {
      return role;
    }
    return "guest";
  }
  // Firebase JWT — can't decode in Edge Runtime without firebase-admin
  // Role enforcement for Firebase users happens at API route level
  return null;
}

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/properties/")) return true;
  if (pathname.startsWith("/booking/success")) return true;
  if (pathname.startsWith("/booking/complete")) return true;
  return false;
}

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Dev-login: allow through (password-protected on the page itself) ──
  if (pathname === "/dev-login" || pathname.startsWith("/dev-login/")) {
    return response;
  }

  // ── Public page routes — always allow ──
  if (isPublicRoute(pathname)) {
    return response;
  }

  // ── API routes ──
  if (pathname.startsWith("/api/")) {
    // Public API routes (health, webhooks, public property listing)
    if (isPublicApiRoute(pathname)) {
      return response;
    }

    // Allow API routes with valid API secret header (programmatic access)
    const apiSecret = request.headers.get("x-api-secret");
    if (apiSecret) {
      return response; // Route handler validates the secret
    }

    // All other API routes require auth cookie
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Admin-only API routes — check role from dev token
    if (isAdminOnlyRoute(pathname)) {
      const role = extractRoleFromToken(authToken);
      // If we can determine the role (dev token) and it's not admin/owner, block
      if (role && role !== "admin" && role !== "owner") {
        return NextResponse.json(
          { error: "Admin access required", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    return response;
  }

  // ── Protected page routes — check for auth cookie ──
  if (isProtectedRoute(pathname)) {
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!authToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin pages — check role
    if (isAdminOnlyRoute(pathname)) {
      const role = extractRoleFromToken(authToken);
      if (role && role !== "admin" && role !== "owner") {
        // Workers/guests trying to access admin — redirect to dashboard
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    return response;
  }

  // ── All other routes — allow through ──
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$|.*\\.woff2?$|.*\\.ttf$|.*\\.eot$).*)",
  ],
};
