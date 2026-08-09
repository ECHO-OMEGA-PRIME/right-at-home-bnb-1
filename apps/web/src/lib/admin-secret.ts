/**
 * Validation for the ADMIN_API_SECRET service credential.
 *
 * Two failures this replaces, both in app/api/admin/vrbo-ical:
 *
 *   1. A fallback to a published literal. If the env var were ever unset or misspelled, the
 *      route would silently accept a secret anyone can read in the repo. A
 *      missing secret must deny, never substitute a default.
 *
 *   2. `if (!apiSecret && !cookie) return 401` — which accepts ANY cookie value
 *      without validating it. Presence of a credential is not authentication.
 *      That is the same defect as the middleware bypass fixed earlier today.
 *
 * NOT currently exploitable: /api/admin sits in the middleware's
 * ADMIN_ONLY_PREFIXES, so an unauthenticated request is refused before the
 * handler runs (verified live — a garbage cookie gets 401). This is
 * defence-in-depth for the day that prefix list changes or the route moves.
 */

import crypto from 'crypto';

/**
 * Constant-time comparison against ADMIN_API_SECRET.
 *
 * Returns false when the secret is unset, so a misconfigured deployment refuses
 * service rather than accepting anything.
 */
export function adminSecretMatches(provided: string | null | undefined): boolean {
  const expected = (process.env.ADMIN_API_SECRET ?? '').trim();
  if (!expected) return false;

  const p = Buffer.from((provided ?? '').trim(), 'utf8');
  const e = Buffer.from(expected, 'utf8');
  // timingSafeEqual throws on a length mismatch, and length is not secret.
  if (p.length !== e.length) return false;
  return crypto.timingSafeEqual(p, e);
}

/** True when ADMIN_API_SECRET is configured at all. */
export function adminSecretConfigured(): boolean {
  return Boolean((process.env.ADMIN_API_SECRET ?? '').trim());
}
