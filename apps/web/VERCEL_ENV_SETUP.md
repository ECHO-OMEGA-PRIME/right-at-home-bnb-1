# RAH Midland — Vercel Environment Setup

## Canonical deployment

- Vercel project: `right-at-home-bnb`
- Production domains: `rah-midland.com`, `www.rah-midland.com`
- Firebase project: `rightathome-prod`

Do not configure this application against `echo-prime-ai` or any other shared Echo Firebase project.

## Required Firebase client variables

Configure all six values in Vercel for **Production**, **Preview**, and **Development** as appropriate:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=<from rightathome-prod project settings>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=rightathome-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=rightathome-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<exact bucket shown by Firebase>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from rightathome-prod project settings>
NEXT_PUBLIC_FIREBASE_APP_ID=<from rightathome-prod project settings>
```

The application now fails closed when any value is absent or when the project ID is not exactly `rightathome-prod`.

## Required Firebase Admin variables

```text
FIREBASE_PROJECT_ID=rightathome-prod
FIREBASE_STORAGE_BUCKET=<exact bucket shown by Firebase>
FIREBASE_SERVICE_ACCOUNT=<single-line JSON for a rightathome-prod service account>
```

The service-account JSON must belong to `rightathome-prod`. A service account from another Firebase project is rejected at startup.

## Authorized domains

In Firebase Console → Authentication → Settings → Authorized domains, verify:

```text
rah-midland.com
www.rah-midland.com
<current Vercel production hostname>
localhost
```

Only include `localhost` for development.

## Safe verification procedure

1. Confirm the linked Vercel project ID from `.vercel/project.json`.
2. Run `vercel env ls` from `apps/web` and verify the required variable **names** exist. Do not paste values into logs.
3. Build from a clean shell with the intended environment loaded.
4. Inspect the generated bundle and confirm it contains `rightathome-prod` and does not contain `echo-prime-ai`.
5. Deploy an immutable commit.
6. Verify:
   - `/login` initializes Firebase without configuration errors.
   - Google and email sign-in complete successfully.
   - `/properties/new` redirects unauthenticated users to `/login`.
   - The public `/properties` page does not display administrative controls.

## Environment sync tool

`tools/sync-vercel-env.py` is fail closed. It reads values only from the current process environment, requires `NEXT_PUBLIC_FIREBASE_PROJECT_ID=rightathome-prod`, and requires an explicit confirmation token before changing Vercel.

Do not use old vault paths or hardcoded project values.

## Secret handling

- Never commit `.env`, `.env.local`, private keys, service-account files, or exported Vercel environment output.
- Rotate any credential that has appeared in a status document, terminal transcript, chat, or repository history.
- Revoke old sessions and tokens after rotation.
