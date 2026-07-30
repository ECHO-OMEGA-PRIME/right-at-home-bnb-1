# Google Cloud Access Recovery Case #73637706

## Resource

- Display name: `RightAtHome-Prod`
- Project ID: `rightathome-prod`
- Project number: `263471826747`
- Production application: `rah-midland.com`

## Request

- Requestor: Bobby Don McWilliams II
- Contact account: `bmcii1976@gmail.com`
- Former administrator identity: `bob@cleanbrees.com` — no longer accessible
- Requested roles:
  - Firebase Editor (`roles/firebase.editor`)
  - Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`)
  - Minimum project visibility required to use Firebase Management

## Submission evidence

- Submitted through Google's official **GCP Account and Resource Recovery Request** form.
- Google confirmation page stated: **Your email has been sent**.
- Confirmation email received in Gmail from Google Cloud Support.
- Case number: **73637706**
- Case opened: approximately 2026-07-24 01:01 America/Chicago.
- Google stated that valid inquiries are normally answered within 48 hours.

## Verified connection to the project

Archived Firebase CLI output dated 2025-06-25 lists:

- `RightAtHome-Prod`
- `rightathome-prod`
- Project number `263471826747`

The current production application depends on this Firebase project. The deployed Vercel Firebase client configuration is internally inconsistent and does not match `rightathome-prod`; production login cannot be repaired safely until authoritative project access is restored.

## Next actions

1. Monitor Gmail and the Google Cloud support case for verification requests.
2. Provide archived CLI, source/deployment, domain-control, and billing/payment evidence if requested.
3. Test IAM and Firebase Management access after any support action.
4. Recover the authoritative Firebase web-app registration and authorized domains.
5. Replace Vercel production values atomically.
6. Deploy the validated P0 candidate and prove owner/admin login plus guest denial of `/properties/new`.

No production configuration, deployment, credential rotation, or destructive action was performed as part of opening this case.
