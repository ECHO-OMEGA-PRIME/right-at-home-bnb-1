# RAH Midland Production Nonfunctional Requirements

Status: **P0 PROVISIONAL BASELINE**

These requirements apply to the production web application, API, background jobs, mobile/desktop clients where used, databases, object storage, messaging, channel synchronization, and smart-home integrations.

## 1. Availability and reliability

- Public property browsing monthly availability target: **99.9%**.
- Authenticated operations monthly availability target: **99.5%** until the Midland pilot completes; target **99.9%** after pilot acceptance.
- A single third-party provider outage must not corrupt canonical booking, task, access, inventory, or financial state.
- Critical workflows must expose `pending`, `succeeded`, `failed`, and `requires_operator` states; no silent success.
- Background work must use idempotency keys and bounded retries with backoff.
- Poison events must move to a visible dead-letter/reconciliation queue.
- Health checks must distinguish configuration failure, dependency failure, and application failure.

## 2. Performance

Production targets measured at the 75th percentile on representative mobile hardware and a normal West Texas cellular connection:

- Largest Contentful Paint: **≤ 2.5 seconds** for public pages.
- Interaction to Next Paint: **≤ 200 ms** for primary interactions.
- Cumulative Layout Shift: **≤ 0.1**.
- Public API read response: **≤ 500 ms p95**, excluding external provider latency.
- Authenticated operational read response: **≤ 750 ms p95**.
- Standard application write acknowledgement: **≤ 1 second p95**.
- Dashboard initial useful data: **≤ 3 seconds p95**.
- Photo upload must show local progress within **500 ms** and support retry/resume behavior.

External provider calls exceeding their budget must become asynchronous or visibly pending rather than blocking the UI indefinitely.

## 3. Mobile and responsive operation

- Supported widths: **360 px through 1920 px**.
- Primary cleaner, maintenance, and owner workflows must be usable at 360 × 640 without horizontal scrolling.
- Touch targets: **44 × 44 CSS pixels minimum** where practical.
- Core task actions must remain reachable with one hand on common phone layouts.
- Camera/photo evidence must work from mobile browsers used in the pilot.
- Network loss during checklist or photo work must not silently discard entered data.
- Reconnect must reconcile local and server state and surface conflicts.

## 4. Accessibility

- Target: **WCAG 2.2 AA** for public and critical authenticated workflows.
- Full keyboard operation for navigation, forms, dialogs, and primary actions.
- Visible focus indicator with sufficient contrast.
- Form inputs require programmatic labels and actionable error text.
- Color cannot be the only indicator of status.
- Screen-reader announcements for asynchronous success, failure, and validation states.
- Reduced-motion preference must be respected for nonessential animations.

## 5. Security

- Firebase authority is exclusively `rightathome-prod`; cross-project fallback is prohibited.
- Production authentication must validate server-side session/token authenticity, expiry, audience/project, and revocation policy where supported.
- Authorization must be enforced server-side; client hiding is supplementary only.
- Least privilege and property-level scope apply to every nonpublic API request.
- Development login and development tokens are disabled in production.
- Secrets must not appear in source, client bundles, logs, screenshots, generated status files, or exported diagnostics.
- Sensitive provider credentials must reside in an approved secret store and be rotated after suspected disclosure.
- Administrative and financial writes require audit evidence.
- Rate limits apply to login, registration, password recovery, messaging, booking, and expensive AI/provider endpoints.
- Content Security Policy and security headers must be validated against production behavior.
- Dependency and container vulnerability findings rated critical/high block launch unless formally accepted with a compensating control and deadline.

## 6. Privacy and data minimization

- Collect only data required for booking, operations, communications, legal, and accounting purposes.
- Internal notes, access credentials, staff details, and financial data are never included in public property responses.
- Guest data is scoped to the guest's own booking and authorized operational users.
- Logs redact tokens, passwords, private keys, full payment data, permanent lock credentials, and sensitive message content.
- Data export and deletion procedures must account for legal/accounting retention obligations.
- Production analytics must not record sensitive form values.

## 7. Data integrity and consistency

- Canonical objects use stable IDs.
- External imports retain source system and source ID.
- Uniqueness constraints or idempotency records prevent duplicate bookings, messages, payments, access codes, tasks, and work orders.
- State transitions are validated; impossible transitions fail closed.
- Financial records use append-only adjustment semantics after period lock.
- Date/time values are stored in UTC and rendered in the property's configured timezone.
- Property status changes propagate predictably to booking, access, public listing, and operations behavior.

## 8. Backup and recovery

Until production infrastructure is fully inventoried, the following are minimum targets:

- PostgreSQL point-in-time recovery or equivalent: **enabled**.
- Database backup frequency: **at least daily**, with more frequent provider-native snapshots where available.
- Object/photo storage backup or versioning: **enabled** for required operational evidence.
- Configuration and infrastructure-as-code: version controlled.
- Recovery Point Objective: **≤ 24 hours** during pilot; target **≤ 1 hour** after launch hardening.
- Recovery Time Objective: **≤ 8 hours** during pilot; target **≤ 4 hours** after launch hardening.
- Restore test: at least **quarterly**, and before READY verdict for the first production launch.
- Restore evidence must record backup ID/date, restored scope, validation queries, duration, and result.

## 9. Retention

Provisional minimums, subject to legal/accounting confirmation:

- Audit and security events: **7 years**.
- Financial source records and tax exports: **7 years**.
- Booking and guest transaction records: **7 years**, with sensitive fields minimized.
- Required turnover/maintenance completion evidence: **3 years**.
- Operational application logs: **30–90 days** depending on sensitivity and storage cost.
- Failed-job/dead-letter evidence: **1 year** after resolution.
- Temporary upload artifacts: remove within **24 hours** after successful finalization or failed-session expiry.

Retention deletion must be auditable and must not remove records under legal hold.

## 10. Observability and alerting

- Every service exposes a health endpoint appropriate to its trust boundary.
- Structured logs include timestamp, severity, service, environment, correlation ID, actor/user ID where permitted, property scope, operation, and result.
- Metrics cover request rate, error rate, latency, queue depth, retry count, reconciliation backlog, login failures, provider failures, and job lateness.
- Critical alerts include authentication outage, database outage, booking-sync backlog, lock-code failure, message delivery failure, backup failure, and elevated authorization failures.
- Alerts identify ownership and an operator action; unactionable noise is not acceptable.
- Production version/commit is observable without exposing secrets.

## 11. Auditability

- Critical actions produce append-only audit events.
- Audit timestamps use UTC and synchronized system clocks.
- Correlation IDs link user action, API request, background work, and provider response.
- Provider requests retain safe metadata and provider transaction IDs.
- Administrative recovery and manual overrides require actor, reason, and before/after state.
- Audit export supports property, actor, action, object, result, and date filters.

## 12. Deployment and change control

- Production deployments originate from an immutable Git commit.
- Build must pass typecheck, schema validation, tests, secret scanning, and production bundle inspection.
- Deployment environment variable names and project linkage are captured as evidence without values.
- Database migrations require forward procedure, rollback/repair procedure, and preflight backup.
- Feature flags or shadow mode are required for risky external integrations until reconciliation evidence passes.
- Rollback must be documented and tested for web/API changes.
- Direct untracked production edits are prohibited.

## 13. Testing requirements

Before READY:

- Unit tests for authorization, state transitions, idempotency, calculations, and formatting.
- Integration tests for database, Firebase identity, messaging, smart locks, payments, and channel imports using safe test resources.
- End-to-end tests for owner/admin, cleaner, maintenance, and guest critical paths.
- Negative authorization matrix tests for every protected route/API class.
- Duplicate delivery, timeout, retry, partial failure, and reconnect tests.
- Mobile multi-viewport and accessibility scans.
- Backup restore and rollback exercises.
- Production smoke test against immutable deployment.

## 14. Incident response

- Severity definitions and escalation ownership must be published.
- Critical incidents require timeline, impacted properties/users, containment, recovery, and evidence preservation.
- Access or secret exposure requires credential rotation, session/token revocation, log review, and documented scope assessment.
- Data-integrity incidents require writes to be paused or isolated until reconciliation is complete.
- Post-incident review identifies root cause, corrective actions, owners, and deadlines.

## P0 evidence still required

- Actual hosting and dependency availability measurements.
- Verified database backup/PITR configuration.
- Verified object-storage durability/versioning.
- Current log/metric/alert platforms and retention.
- Legal confirmation of privacy and retention periods.
- Pilot device/browser inventory.
- Owner approval of availability and recovery targets.
