# RAH Midland Credential Rotation Runbook

Status: **REQUIRED BEFORE ANY PRODUCTION DEPLOYMENT**

## Trigger

Live-looking credentials were found in local environment and historical status artifacts. Treat every exposed value as compromised regardless of whether the artifact was committed.

## Immediate controls

1. Freeze deployment and environment synchronization.
2. Do not copy exposed values into chat, tickets, screenshots, or tracker messages.
3. Preserve evidence metadata only: file path, timestamp, provider, and credential type.
4. Identify every environment where the credential may have been used.

## Rotation order

### 1. Database

- Create a new application credential with least-privilege access.
- Update the approved secret store and nonproduction environment first.
- Validate connection, migrations, read/write permissions, and application health.
- Update production through controlled change.
- Revoke the old credential.
- Review database connection and authentication logs for unexpected source IPs, users, or activity.
- Confirm backups and PITR are healthy before and after rotation.

### 2. Twilio or communications provider

- Rotate the authentication token or API key.
- Verify the expected account and sending number.
- Update webhook validation secrets where applicable.
- Update the approved secret store and environments.
- Send a controlled test message to an approved test recipient.
- Revoke the old token and review account logs, message history, and webhook activity.

### 3. Tuya / smart-lock provider

- Rotate access secret and, if supported, access ID/application key.
- Confirm the cloud project, region, linked devices, and allowed APIs.
- Update secrets through controlled change.
- Test read-only device inventory first.
- Test a safe nonproduction device or approved test operation.
- Revoke the old secret and review provider logs for unauthorized calls.

### 4. Firebase

- Confirm the canonical project is `rightathome-prod`.
- Generate a new service account for the minimum required Admin SDK permissions.
- Configure all six public client values from the same project.
- Add only approved authorized domains.
- Revoke old service-account keys.
- Review Authentication, IAM, Firestore, Storage, and audit logs.

### 5. Other providers

Repeat the same process for payment, AI, email, object storage, Vercel, GitHub, and Echo SDK credentials if any were present in exposed artifacts.

## Session and token invalidation

- Revoke provider sessions where supported.
- Invalidate long-lived application sessions if the exposed material could sign or mint sessions.
- Remove development tokens and production dev-login state.
- Force reauthentication for privileged users after authentication material changes.

## Repository and artifact remediation

- Verify `.env`, `.env.local`, private keys, and generated environment dumps are ignored.
- Search Git history, worktrees, detached snapshots, build artifacts, status documents, and backups for exposed values.
- Rewrite Git history only after preserving a controlled backup and coordinating with every clone owner.
- Delete or sanitize generated status files that contain secret values.
- Preserve a hash and path record of removed artifacts without preserving the secret in ordinary documentation.

## Verification evidence

For each rotated credential record:

- provider;
- credential type;
- rotation timestamp;
- actor;
- old credential revoked: yes/no;
- new credential stored in approved secret store: yes/no;
- environments updated;
- validation performed;
- audit/log review result;
- incident or change reference.

Never record the credential value.

## Completion gate

Rotation is complete only when:

- every exposed credential is replaced;
- every old credential is revoked;
- production uses only the new values;
- provider logs are reviewed;
- repository/history scans are clean;
- login, database, messaging, lock, and health checks pass;
- evidence is attached to the Build Tracker.
