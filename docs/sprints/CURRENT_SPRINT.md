# Current Sprint

## Sprint 04 Event Lifecycle and Pre-payment Booth Release

- Status: `COMPLETED`
- Completed: `2026-10-16`
- Sprint file: `docs/sprints/sprint-04.md`
- Use Case Specifications: `docs/use-cases/sprint-04-use-case-specifications.md`
- API Contract: `docs/api/sprint-04-api-contract.md`
- Backend Work Assignment: `docs/sprints/SPRINT_04_BACKEND_WORK_ASSIGNMENT.md`
- Completion Report: `docs/development/SPRINT_04_COMPLETION_REPORT.md`

## Sprint goal

Harden Event update/delete/cancellation and timed lifecycle behavior, then let an owning Partner
release an eligible selected Booth Hold before settlement without weakening Sprint 3 payment
reconciliation safety.

## Completion baseline

- Sprint 1 Event and Partner-application backend is implemented.
- Sprint 2 Booth request, selection, price-locked Hold and expiry backend is implemented through V6.
- Sprint 3 VNPay Payment and Assignment backend is implemented and verified through V7.
- Sprint 4 Event lifecycle and pre-payment release is implemented through V8.
- All 23 Sprint 4 Acceptance Criteria have implementation and automated coverage.
- Backend regression: 284 tests passed with no failures, errors or skips.
- VNPay disposable spike: 20 tests passed.
- Frontend lint and production build passed; warnings and bundle splitting remain technical debt.
- Required Swagger smoke flows were manually accepted.
- V1 through V8 are the immutable current schema baseline.

## Included Use Case slices

- UC-O01 Manage Events — Draft delete, safe published update, eligible cancellation and timed
  lifecycle transitions.
- UC-E02 Manage Booth Request — Pending withdrawal and safe Selected Hold release before
  settlement.

## Scope guard

Sprint 4 excludes post-assignment Booth change/cancellation, business refunds, Partner withdrawal
from the whole Event after approval, cancellation of an Ongoing Event and Admin emergency
cancellation.

Every Payment `PENDING`/`SUCCESS`, reconciliation-required record and BoothAssignment remains a
hard blocker. A browser or frontend claim can never release a Hold or establish payment state.

Every Event-scoped mutation serializes on the Event row before domain locks. Booth/payment work
then follows `Event → Booth (if needed) → EventBoothConfig (if needed) → Hold → Payment by
ascending id → BoothRequest`. Publish and operational patch also require
`boothRequestDeadlineAt + boothPaymentWindowMinutes <= startAt`.

That invariant bounds the scheduled checkout window, not unresolved gateway evidence. A Pending or
reconciliation-required Payment may keep its Hold Active into Ongoing without pausing the Event;
trusted success may settle while Published/Ongoing, but after Completed/Cancelled it creates no
Assignment and is retained for manual reconciliation.

Every delivered change maps to the Sprint 4 Use Case Specifications and Acceptance Criteria. No
new implementation Sprint has been selected; future work must receive a new approved baseline
before changing the completed Sprint 4 scope.
