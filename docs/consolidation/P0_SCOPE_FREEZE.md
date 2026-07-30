# RAH Midland P0 Scope Freeze

Effective date: **2026-07-23**

## Frozen acceptance authority

The acceptance criteria in the following document are the canonical P0 product scope:

- `docs/consolidation/P0_ACCEPTANCE_MATRIX.md`
- SHA-256: `2a5ec60a4c7d11ec5d617167d9d53f337155f919347238b6aa3d434eb263065e`

The matrix covers:

- 22 known properties, currently expected to reconcile as 18 active and 4 inactive;
- Crew A: Bobby + Bree;
- Crew B: Michael + Javier;
- owner/operator: Steven;
- maintenance lead: Joseph;
- owner, admin, worker, cleaner, maintenance, yard/handyman, and guest behavior;
- authentication, property management, booking/channel sync, 90-minute turnovers, GPS/photo evidence, smart locks, guest communications, maintenance, inventory, finance, reporting, and audit history.

## Change control

The scope above is frozen. A change requires all of the following:

1. written reason;
2. impact on schedule, data, security, operations, and testing;
3. updated acceptance criteria;
4. Commander approval;
5. append-only Build Tracker record.

## Evidence versus scope

The following remain required evidence and do not alter the frozen scope by themselves:

- production property count/status reconciliation;
- current user and crew roster reconciliation;
- Firebase `rightathome-prod` verification;
- channel, smart-lock, messaging, payment, and storage provider inventory;
- owner confirmation of active/inactive property behavior;
- production test results.

If evidence reveals a discrepancy, the discrepancy becomes a blocker or migration task. It does not silently rewrite acceptance criteria.
