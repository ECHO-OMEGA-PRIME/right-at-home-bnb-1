# Property Questionnaire — Migration Note

**Status (2026-05-20):** the Cloudflare Worker config (`wrangler.toml`) for this
form was **removed** as part of the CF → Echo Cloud migration
(see `WEBSITES/right-at-home-bnb/CF_TO_ECHO_CLOUD_MIGRATION.md`).

`worker.js` is preserved here as the source of the property questionnaire form
(HTML + JS) so it can be re-deployed on Echo Cloud — three options, in order
of preferred:

1. **Port to a Next.js route** at `apps/web/app/property-questionnaire/page.tsx`
   (server component renders the same HTML; submit handler hits the backend
   FastAPI route). Cleanest long-term.
2. **Serve as a static file** from the FastAPI backend under
   `/api/v1/property-questionnaire/` and route it through `api.rah-midland.com`.
3. **Re-host as a static page** on Vercel via the rah-midland.com root project.

None of these are required for the migration cutover — the form was a one-off
data-collection tool that Steven filled out previously. Re-deploy on demand.
