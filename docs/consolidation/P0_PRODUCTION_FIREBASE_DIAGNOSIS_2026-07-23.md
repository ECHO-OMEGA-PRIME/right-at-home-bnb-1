# P0 Production Firebase Diagnosis — 2026-07-23

## Verdict

Production authentication is not configured against the canonical Firebase authority.

## Verified evidence

- Vercel project link: `right-at-home-bnb` (`prj_jzQB3wfbYluy9v38uGYr8AzF7lWB`).
- Production site: `rah-midland.com`.
- Live `/api/health` reported deployment version `d83e8aa`, while canonical Git HEAD is `f4ee582e74c3ce6c14dae0e5d00e1d44a5355916`.
- Vercel Production contains all six Firebase client variable names.
- A secret-safe comparison proved that the configured Production project ID, auth domain, and storage bucket do not match `rightathome-prod`.
- The three Production Firebase identity fields do not consistently match one another.
- The six Production Firebase values do not match the ignored local `apps/web/.env.local` values.
- The signed-in GCloud account is `bmcii1976@gmail.com`; its active default project is `echo-prime-ai`.
- Firebase CLI is installed but not authenticated.
- Firebase Management API access to `rightathome-prod` returned HTTP 403.
- The signed-in Firebase Console displayed: `The project does not exist or you do not have permission to list apps in the project` for `rightathome-prod`.
- The public `/properties` page renders the visitor as Guest, reports zero properties, and exposes Add Property.
- An unauthenticated request to `/properties/new` returned HTTP 200 instead of redirecting to login.

## Root cause classification

1. Production Vercel Firebase client values are stale or corrupt and are not the canonical `rightathome-prod` registration.
2. The currently signed-in Google account cannot retrieve or administer `rightathome-prod`, so the authoritative registration values and authorized-domain list cannot be recovered from this account.
3. Production is serving an older deployment that predates the local authorization and Firebase fail-closed corrections.

## Required remediation

1. Grant `bmcii1976@gmail.com` appropriate Firebase/Google Cloud access to `rightathome-prod`, or sign in with the account that owns the project.
2. Retrieve the canonical web-app configuration and authorized domains from Firebase Console or Firebase Management APIs.
3. Replace all six Vercel Production Firebase client values atomically.
4. Add/verify `rah-midland.com`, `www.rah-midland.com`, and the active Vercel production hostname in Firebase Authentication authorized domains.
5. Confirm the Firebase Admin service account belongs to `rightathome-prod`.
6. Deploy only an immutable, reviewed commit containing the validated local hardening.
7. Prove login and prove unauthenticated/guest denial of `/properties/new` after deployment.

## Safety state

No Vercel environment value, Firebase resource, credential, deployment, alias, or production setting was changed during this diagnosis.
