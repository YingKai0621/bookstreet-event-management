# Current Sprint

## Sprint 04 Event Lifecycle and Pre-payment Booth Release

- Status: `DOCUMENTATION BASELINE - IMPLEMENTATION PENDING`
- Sprint file: `docs/sprints/sprint-04.md`
- Use Case Specifications: `docs/use-cases/sprint-04-use-case-specifications.md`
- API Contract: `docs/api/sprint-04-api-contract.md`
- Backend Work Assignment: `docs/sprints/SPRINT_04_BACKEND_WORK_ASSIGNMENT.md`

## Sprint goal

Harden Event update/delete/cancellation and timed lifecycle behavior, then let an owning Partner
release an eligible selected Booth Hold before settlement without weakening Sprint 3 payment
reconciliation safety.

## Starting baseline

- Sprint 1 Event and Partner-application backend is implemented.
- Sprint 2 Booth request, selection, price-locked Hold and expiry backend is implemented through V6.
- Sprint 3 VNPay Payment and Assignment backend is implemented and verified through V7.
- Backend baseline: 222 tests with no failures or errors; 69 tests are intentionally skipped by
  test configuration.
- VNPay disposable spike baseline: 20 tests passed.
- Sprint 3 frontend payment integration and Playwright payment E2E remain tracked technical debt.
- V1 through V7 are immutable; Sprint 4 owns V8.

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

Every implementation change must map to the Sprint 4 Use Case Specifications and Acceptance
Criteria.
