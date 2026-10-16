# Sprint 04 Backend Work Assignment

> Status: `COMPLETED`. This file preserves the approved implementation split and review checklist;
> final combined evidence is in the
> [Sprint 4 Completion Report](../development/SPRINT_04_COMPLETION_REPORT.md).

## 1 Shared implementation boundary

- Branch from updated `main`; do not modify V1–V7.
- V8 has one owner.
- Preserve the global Event-rooted order: `Event → Booth (if needed) → EventBoothConfig (if
  needed) → Hold → Payment by ascending id → BoothRequest`.
- Do not add refund, Booth-change or post-assignment cancellation endpoints.
- Every change maps to Sprint 4 Acceptance Criteria.

## 2 Three-person split

### Developer A — Event lifecycle, V8 and Payment-lock integration owner

- Own V8 cancellation columns/status constraints.
- Implement Event response additions.
- Implement Draft delete, published update and Event cancellation transaction.
- Implement scheduler lifecycle transitions.
- Add the publish/update timing invariant and Event-root locking contract used by cross-module
  commands.
- Refactor `PartnerPaymentService`/`PaymentAttemptTransactions`, `PaymentSettlementService` and
  `VnPayReconciliationWorker` so Payment initiation, settlement, QueryDR reconciliation and
  payment-side terminal/expiry transitions acquire/recheck the Event root before existing domain
  locks, without holding a database lock across VNPay network I/O.
- Implement the cross-start policy: unresolved evidence may preserve an Active Hold into Ongoing;
  trusted success may settle in Published/Ongoing, while success after Completed/Cancelled creates
  no Assignment and is retained for manual reconciliation.
- Cover AC-O01-01 through AC-O01-16 for the Event/Payment responsibilities above, including
  contradictory-late-success handling after Event cancellation and the payment/Event-start
  boundary; coordinate the shared AC-O01-12/AC-O01-13 paths with Developers B and C.

Primary packages:

- `event`
- Event-facing additions in `booth`
- Event-lock orchestration in `payment`
- `db/migration/V8__...sql`

### Developer B — Booth mutation and pre-payment release owner

- Adapt every Booth mutation to the shared Event-root contract: Event-Booth configuration,
  Booth-request submission, Organizer selection/rejection and Partner withdrawal.
- Extend owned Booth-request withdrawal to the eligible `SELECTED` state.
- Add deterministic Event/Booth/EventBoothConfig/Hold/Payment/Request locking and blocker queries
  for configuration, submission, review, selection and withdrawal.
- Own `BoothHoldExpiryService`/scheduler adaptation to the shared Event-root contract and use the
  Payment blocker/terminal-resolution semantics owned by Developer A.
- Preserve the documented Hold-expiry result without independently changing settlement behavior.
- Cover AC-E02-01 through AC-E02-07 and the Booth side of AC-O01-12/AC-O01-13, including
  concurrency and contradictory-late-success tests.

Primary packages:

- `booth`
- read-only Payment repository/query collaboration where required

Developer B must not change Payment settlement/reconciliation semantics independently; shared
Payment changes are coordinated through Developer A's Event-lock integration boundary.

### Developer C — Partner application, public API and cross-module verification owner

- Adapt Partner application submission and Organizer application review to lock/recheck the Event
  root before application-domain locks.
- Implement public Event list/detail lifecycle behavior.
- Implement deduplicated post-commit cancellation email to verified representatives of
  PENDING/APPROVED Partner applications.
- Add API/documentation examples and integration tests.
- Run migration upgrade, authorization and full regression verification.
- Own cross-module race tests for payment resolution versus Event start/completion/cancellation.
- Cover the Partner-application side of AC-O01-12/AC-O01-13 and verify the complete cross-module
  outcomes after Developers A and B merge.

Primary packages:

- `partner`
- `event`
- `notification`/existing mail infrastructure
- integration tests

## 3 Merge order

1. Documentation baseline.
2. V8 and entity/DTO compatibility.
3. Shared Event-root lock infrastructure, including Payment-path integration.
4. Event lifecycle commands.
5. Partner-application and Booth-mutation Event-lock adaptations, including Selected withdrawal.
6. Public query and notification behavior.
7. Cross-module concurrency and full regression tests.

Only the V8 owner rebases migration work. Other developers must not invent V8 variants.

## 4 Required verification

- Clean V1→V8 migration.
- V7→V8 upgrade migration.
- Legacy/manual `CANCELLED` Event metadata backfill before V8 consistency constraints.
- Hibernate `ddl-auto=validate`.
- Full backend suite against PostgreSQL.
- VNPay spike suite.
- Frontend lint and production build.
- Targeted manual Swagger flow for Draft delete, safe patch, Event cancellation and Selected Hold
  withdrawal.
- Targeted race tests for operational patch versus first participation, cancellation versus new
  Event work, Partner-application/Booth-request submission versus cancellation, and selected
  withdrawal versus settlement.
- Targeted Clock/race tests proving an unresolved Payment can cross `startAt` without pausing Event
  lifecycle, can settle during `PUBLISHED`/`ONGOING`, and cannot create an Assignment after
  `COMPLETED`/`CANCELLED`.

