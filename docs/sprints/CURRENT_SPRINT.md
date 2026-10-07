# Current Sprint

## Sprint 02 Booth Selection and Allocation Hold

- Status: `DESIGN COMPLETE - IMPLEMENTATION NOT STARTED`
- Sprint file: `docs/sprints/sprint-02.md`
- Use Case Specifications: `docs/use-cases/sprint-02-use-case-specifications.md`
- API Contract: `docs/api/sprint-02-api-contract.md`
- Backend Work Assignment: `docs/sprints/SPRINT_02_BACKEND_WORK_ASSIGNMENT.md`

## Sprint goal

Deliver the Booth workflow from physical Booth configuration through Partner request, Organizer selection, price locking and temporary Hold expiry.

## Starting baseline

- Sprint 1 backend and real frontend integration are merged into `main` through merge commit `884131b`.
- Account, email verification, browser Session security, Event management, Partner Organization and Partner application flows are available.
- Organizer and Partner Playwright flows exist for the Sprint 1 integration.
- Flyway migrations V1 through V4 are applied; Sprint 2 must use a new migration.
- PostgreSQL is the source of truth for business state. Redis stores server-side login sessions.

## Included Use Case slices

- UC-O02 Manage Locations - physical Booth and Event Booth configuration slice
- UC-E02 Manage Booth Request - submit, list, detail and Pending withdrawal slice
- UC-O04 Review Booth Requests - list candidates, reject, select and expire Hold slice

## Approved Sprint 2 decisions

- `boothPaymentWindowMinutes` remains configurable per Event in the existing `events` column, accepts `60..10080` minutes inclusive and defaults to `1440` minutes (24 hours) for a new Event.
- Selection persists `expiresAt = selectedAt + boothPaymentWindowMinutes`; changing the Event setting never rewrites an existing Hold and applies only to later selections.
- Sprint 2 does not define payment-session duration.
- Selection email is triggered only after the database transaction commits; delivery failure is logged and does not roll back selection.
- One Partner may have only one `PENDING` or `SELECTED` request for the same Event–Booth.
- A new request after `WITHDRAWN` or `PAYMENT_EXPIRED` is allowed only when current rules pass; resubmission for the same Event–Booth after `REJECTED` is not allowed.
- MVP uses a simple Booth grid; drag-and-drop map editing remains out of scope.

## Key lifecycle

```text
BoothRequest PENDING
  ├─→ WITHDRAWN
  ├─→ REJECTED
  └─→ SELECTED + BoothHold ACTIVE
                    └─→ payment window expires
                        BoothHold EXPIRED
                        BoothRequest PAYMENT_EXPIRED
```

A Pending request never locks a Booth. Competing requests remain Pending after one candidate is selected.

## Scope guard

Sprint 2 excludes payment gateway integration, payment-session duration, BoothPayment, BoothAssignment, refunds, Booth change/cancellation, Activity, QR, Attendance, rewards, feedback and reporting.

Payment success, assignment creation and changing competing candidates to `NOT_SELECTED` belong to Sprint 3.

Before starting a task, verify that it maps to an included Use Case slice and an Acceptance Criterion.
