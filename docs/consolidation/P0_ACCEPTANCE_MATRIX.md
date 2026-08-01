# RAH Midland P0 Acceptance Matrix

Status: **PROVISIONAL SCOPE FREEZE — evidence required before promotion**

## Canonical operating scope

- Portfolio: 22 known properties.
- Current status basis: 18 active and 4 inactive properties pending production reconciliation.
- Turnover target: 90 minutes per standard unit unless the property profile defines an approved exception.
- Crew A: Bobby + Bree.
- Crew B: Michael + Javier.
- Owner/operator: Steven.
- Maintenance lead: Joseph.
- Supported access classes: owner, admin, worker, guest.
- Worker specializations: cleaner, maintenance, yard crew, handyman, or combined duties.

No production launch may rely on a property, user, role, or integration count that has not been reconciled against the production database and channel sources.

## Global acceptance rules

Every critical workflow must provide:

1. Authentication and least-privilege authorization.
2. Property-level scoping.
3. Idempotent writes or an explicit duplicate-prevention key.
4. Timestamped audit evidence.
5. Visible failure state and operator escalation.
6. Mobile operation at 360 px width or greater.
7. Recovery after refresh, reconnect, or duplicate event delivery.
8. No secret material in client bundles, logs, screenshots, or exported reports.

## Role matrix

| Capability | Owner | Admin | Cleaner / Crew | Maintenance / Yard | Guest |
|---|---:|---:|---:|---:|---:|
| View public property listing | Yes | Yes | Yes | Yes | Yes |
| Add/edit/archive property | Yes | Yes | No | No | No |
| View all bookings | Yes | Yes | Assigned turnover context only | Assigned work context only | Own booking only |
| Assign crews and tasks | Yes | Yes | No | No | No |
| Start/complete assigned turnover | Yes | Yes | Yes | No unless assigned | No |
| Upload required work photos | Yes | Yes | Yes | Yes | No |
| Create maintenance defect | Yes | Yes | Yes | Yes | No |
| Close maintenance defect | Yes | Yes | No | Assigned worker | No |
| View property financials | Yes | Yes, when granted | No | No | No |
| Manage smart-lock lifecycle | Yes | Yes | Read assigned access only | Read assigned access only | Active-stay code only |
| View audit history | Yes | Yes | Own actions | Own actions | Own booking events only |
| Manage users and roles | Yes | Yes, when granted | No | No | No |

## Authentication and session acceptance

### Owner/admin

- Successful Google or email sign-in against Firebase project `rightathome-prod`.
- Session survives a normal page refresh.
- Server and client resolve the same user identity and role.
- `/properties/new` is accessible only to owner/admin.
- A forged, expired, malformed, or development cookie is rejected.
- Production development-login routes and tokens are rejected.

### Worker

- Worker sees only assigned properties, jobs, schedules, codes, and evidence.
- Worker cannot open owner/admin pages by URL manipulation.
- Cleaner, maintenance, yard-crew, and handyman records normalize to the worker authorization class while retaining specialization.
- Pending or disabled workers cannot perform operational writes.

### Guest

- Guest can browse active public listings.
- Guest cannot see Add Property, administrative navigation, internal notes, lock administration, staff data, or financial data.
- Guest can view and modify only the guest's own booking where permitted.

## Property inventory acceptance

- Exactly one canonical record per property.
- Production reconciliation identifies all 22 known properties and records active/inactive state.
- Public listing excludes internal-only fields.
- Inactive properties remain visible only where explicitly approved and cannot accept bookings.
- Property profile includes address, timezone, turnover target, access system, channel IDs, emergency data, inventory profile, and responsible crew.
- Add/edit/archive operations create immutable audit events.

## Booking and channel-sync acceptance

- Airbnb/VRBO/OwnerRez or direct-source events use a stable external event ID.
- Replayed events do not create duplicate bookings, messages, access codes, or turnovers.
- Conflicting dates or property mappings create a blocked reconciliation item.
- Cancellation and date-change events update downstream access and turnover workflows.
- A reconciliation report proves source count, imported count, duplicates skipped, conflicts, and unresolved failures.

## Turnover acceptance

- Booking checkout generates one turnover job for the correct property and target window.
- Owner/admin can assign Crew A or Crew B.
- Crew member can check in only within the permitted property/geofence policy.
- Checklist progress is timestamped and recoverable after reconnect.
- Required before/after photos cannot be silently skipped.
- Completion is blocked while required steps, photos, exceptions, or defect escalation remain unresolved.
- Late, blocked, and failed jobs appear on the live operations dashboard.
- Reassignment retains original history.

## Smart-lock acceptance

- Access code is associated with one booking, property, validity window, and provider response.
- Code creation, update, verification, expiration, and deletion are auditable.
- Provider timeout or failure does not falsely mark access as ready.
- Operator receives escalation with property, guest, booking, attempted action, and recovery path.
- Worker access is limited to an assignment window.
- Guest code is never shown outside the authorized active-stay context.

## Guest communication acceptance

- Templates support welcome, pre-arrival, check-in, exception, checkout, and operator escalation.
- Every send has channel, recipient, template/version, delivery status, provider ID, and timestamp.
- Retries are idempotent.
- Failed delivery creates an operator-visible exception.
- Messages do not expose internal notes, unrelated guest data, or permanent lock credentials.

## Maintenance and yard acceptance

- Cleaner-discovered issue can create one linked work order without duplicate creation.
- Work order includes property, category, priority, description, photos, assignee, due date, status, labor, materials, and cost.
- Critical safety/access issue can block property readiness.
- Closure requires completion evidence and timestamp.
- Repeat issues are reportable by property and category.

## Inventory acceptance

- Per-property par levels and current quantities are recorded.
- Turnover consumption can decrement stock with an audit event.
- Replenishment alert identifies item, property, current count, par level, and recommended quantity.
- Purchases retain vendor, receipt/evidence, amount, property allocation, and user.
- Negative inventory and duplicate purchase import are blocked or explicitly reconciled.

## Finance and reporting acceptance

- Property P&L traces revenue and approved expenses to source records.
- Cleaning, maintenance, supply, utility, channel, and payment fees are separately reportable.
- Reporting periods can be locked after approval.
- Corrections after lock require an adjustment entry; historical values are not silently overwritten.
- Tax export identifies reporting period, property, category mapping, source count, and exceptions.

## Audit acceptance

Audit events must contain:

- event ID;
- timestamp in UTC;
- actor ID and resolved role;
- property/tenant scope;
- action and object type;
- object ID;
- request or correlation ID;
- before/after summary where applicable;
- result and failure reason;
- source system or provider.

Audit history is append-only from the application perspective and cannot be modified by ordinary owner/admin UI actions.

## Required P0 proof before this matrix becomes FINAL

- Production database property count and statuses.
- Current user/crew roster and role mapping.
- Firebase `rightathome-prod` access and authorized-domain verification.
- Current channel providers and credentials inventory.
- Current smart-lock providers and device/property mapping.
- Current SMS/email providers and sender identities.
- Owner approval of active/inactive property behavior.
- Owner approval of financial/reporting scope.
