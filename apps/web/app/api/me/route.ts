/**
 * Right at Home BnB — GET /api/me
 *
 * The authenticated caller's own identity and role, resolved server-side.
 *
 * WHY THIS EXISTS: the browser used to answer "who am I / am I an owner?" by
 * reading Firestore `users/{uid}` directly (src/lib/auth.ts getCurrentUser and
 * isOwner). That put a Google project on the critical path of every page — when
 * all five billing accounts closed, Firestore returned 429 on everything and the
 * client could no longer resolve its own role. It also meant the role was read
 * by the same party it authorises, over a rule set the client can see.
 *
 * The role now comes from the server, through the hardened path in
 * `@/lib/api-auth`: echo-auth verifies identity (RS256/JWKS, no Google billing),
 * and the role comes from the Postgres `User` table. The
 * browser cannot reach Postgres, so this endpoint is how it asks.
 *
 * Deliberately NOT a role gate. Any authenticated caller may ask who they are —
 * that is the point — but they only ever learn about THEMSELVES, because the
 * uid is taken from the verified token and never from user input.
 *
 * @author ECHO OMEGA PRIME
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // requireAuth already distinguishes the three outcomes that matter:
  //   invalid/absent credential      -> 401
  //   identity or role store down    -> 503 + Retry-After (never a silent 401,
  //                                     never an assumed role)
  //   verified                       -> a user
  const { user, error } = await requireAuth(request);
  if (error) return error;

  return NextResponse.json(
    {
      uid: user!.uid,
      email: user!.email,
      role: user!.role,
      workerType: user!.workerType,
      // Surfaced so a client can tell a real session from a local dev one
      // rather than inferring it from the role.
      isDevMode: user!.isDevMode,
    },
    {
      // Identity is per-caller and changes on role edits; caching it anywhere
      // shared would leak one user's role to another.
      headers: { 'Cache-Control': 'private, no-store' },
    }
  );
}
