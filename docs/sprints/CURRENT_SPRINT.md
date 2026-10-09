# Current Sprint

## Sprint 03 Booth Payment and Assignment

- Status: `BACKEND IMPLEMENTED AND VERIFIED - FRONTEND/E2E PENDING`
- Sprint file: `docs/sprints/sprint-03.md`
- Use Case Specifications: `docs/use-cases/sprint-03-use-case-specifications.md`
- API Contract: `docs/api/sprint-03-api-contract.md`
- Backend Work Assignment: `docs/sprints/SPRINT_03_BACKEND_WORK_ASSIGNMENT.md`

## Sprint goal

Complete the initial Booth allocation path from a selected, price-locked Hold through
backend-verified VNPay payment to one durable BoothAssignment.

## Starting baseline

- Sprint 2 backend Booth selection and Hold lifecycle are implemented through V6.
- The PostgreSQL-backed backend baseline passes 200 tests with no failures, errors or skips.
- VNPay Sandbox signing, Return verification, IPN verification, QueryDR and five-minute checkout
  expiry were proven by the repository-local disposable spike.
- V1 through V6 are immutable; Sprint 3 owns V7.

## Included Use Case slices

- UC-E03 Pay & View Booth - initial Booth rental payment, retry, history and Assignment view.
- UC-E02 Manage Booth Request - `COMPLETED` and `NOT_SELECTED` outcomes from settlement.
- UC-O04 Review Booth Requests - free-Booth settlement and paid winner finalization.

## Approved provider decisions

- Provider: VNPay Sandbox.
- Merchant correlation: `vnp_TxnRef = BSP{boothPaymentId}`.
- IPN path: `/api/v1/payments/vnpay/ipn`.
- Purpose: `INITIAL_BOOTH_RENTAL`.
- Checkout expiry: `min(now + 15 minutes, hold.expiresAt)`; do not create a checkout with less
  than five minutes remaining.
- Exact signed checkout URL and expiry are persisted for same-key replay.
- An expired checkout is locally `TIMEOUT` only after two trusted QueryDR `00/01` results at
  least five minutes apart with matching reference and amount.
- An unresolved Payment retains the Active Hold and blocks Booth reassignment.
- An unsafe verified late charge is retained as a reconciliation conflict for manual refund; it
  never creates an invalid or duplicate Assignment.
- A zero-price Booth bypasses VNPay and is assigned atomically when selected. A positive Booth
  price below 5,000 VND is invalid; paid Booths use VNPay.

## Scope guard

Sprint 3 implements only initial Booth rental payment and Assignment. Refund execution, Booth
change/cancellation, Event-withdrawal refunds, Activity, attendance and rewards remain out of
scope.

Every implementation change must map to the Sprint 3 Use Case Specifications and Acceptance
Criteria.

## Backend implementation verification

- V7 Payment/Assignment schema, VNPay initiation/IPN/QueryDR, bounded reconciliation,
  free-Booth assignment and Partner-owned Payment/Assignment queries are implemented.
- VNPay Payment creation now commits the new attempt and complete signed checkout metadata
  atomically. Concurrent same-key requests converge after the Hold lock, and incomplete legacy
  Pending rows are closed safely as `CHECKOUT_NOT_CREATED` after the grace period.
- Reconciliation atomically claims the provider query interval before network I/O, preventing
  concurrent workers from sending duplicate QueryDR requests. Cancellation requires the exact
  VNPay `24/02` response/status pair; inconsistent evidence remains Pending for reconciliation.
- Initial-payment status `02` is the only safe generic terminal failure. Status `04` (possible
  debit/reversal), `07`, `09` and unknown combinations remain Pending so retry cannot create a
  second charge.
- Verified success that contradicts a locally terminal attempt is persisted as a reconciliation
  conflict and blocks another charge until manual resolution.
- PostgreSQL migration tests cover clean V1-to-V7 migration and the V6-to-V7 upgrade path.
- Backend regression suite: `222` tests passed with no failures, errors or skips. The expanded
  suite includes concurrency, orphan-recovery, ownership and settlement/expiry-race coverage.
- Disposable VNPay spike suite: `20` tests passed.
- Remaining Sprint work is frontend integration and Playwright E2E against the approved backend
  contract.
