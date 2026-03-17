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
];

const AUTH_COOKIE_NAME = "rah-auth-token";

function isPublicRoute(pathname: string): boolean {
  // Exact match for public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  // Allow sub-paths of /properties (e.g. /properties/123)
  if (pathname.startsWith("/properties/")) {
    return true;
  }

  // Allow all /api routes
  if (pathname.startsWith("/api/")) {
    return true;
  }

  // Allow /booking/success with query params
  if (pathname.startsWith("/booking/success")) {
    return true;
  }

  return false;
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — always allow
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Protected routes — check for auth cookie
  if (isProtectedRoute(pathname)) {
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!authToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Token exists — allow through (Firebase verifies on the client/API side)
    return NextResponse.next();
  }

  // All other routes — allow through
  return NextResponse.next();
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
    "/((?!_next/static|_next/image|favicon\.ico|sitemap\.xml|robots\.txt|.*\.png$|.*\.jpg$|.*\.jpeg$|.*\.gif$|.*\.svg$|.*\.ico$|.*\.webp$|.*\.woff2?$|.*\.ttf$|.*\.eot$).*)",
  ],
};
