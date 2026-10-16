# Sprint 4 — Developer B handoff

> Historical handoff: this contribution has been integrated into the completed Sprint 4 baseline.
> See the [Sprint 4 Completion Report](../development/SPRINT_04_COMPLETION_REPORT.md) for final
> cross-module verification.

- Branch: `feature/s4-booth-prepayment-release`
- Base: updated `main` at `2fac4cf`
- Scope: backend Booth mutations and pre-payment Hold release.

## Behavior

- Owned `PENDING` withdrawal records `WITHDRAWN` without creating a Hold.
- Owned `SELECTED` withdrawal atomically records `WITHDRAWN` and releases its Active Hold.
- Repeating an owned withdrawal preserves the response and timestamps.
- An existing Assignment, successful Payment, Pending Payment or reconciliation-required
  evidence blocks selected release. A usable Pending checkout returns
  `PAYMENT_ATTEMPT_ALREADY_PENDING`; unresolved evidence returns `PAYMENT_RESULT_UNKNOWN`.
- Verified `FAILED`/`TIMEOUT` attempts permit release while the Hold remains Active.
- Release permits a later request/selection; it never automatically selects another candidate.
- Hold expiry preserves Pending, successful and reconciliation-blocking evidence and Assignments.
- Submission and review require a Published Event before its start, checked under the Event lock.
  Non-actionable Events return `EVENT_NOT_FOUND` on these commands. Configuration accepts Draft
  or Published before start; other lifecycle states return `EVENT_NOT_EDITABLE`.

## Transaction boundaries

- Submission/configuration: `Event → Booth → EventBoothConfig`, then request insertion/config update.
- Selection: `Event → Booth → EventBoothConfig → existing Pending requests by id`.
  The Hold is newly inserted in this transaction. Free selection locks competing Pending requests
  in ascending order before changing them.
- Rejection: `Event → BoothRequest`.
- Withdrawal: scalar ownership lookup, then `Event → optional Hold → Payments by id → BoothRequest`.
- Expiry: discover due Event ids without row locks; process each Event in a separate transaction
  using `Event → Holds by id → Payments by id → Selected requests by id`.
- Opportunistic expiry executes before mutation locks, including physical Booth deactivation,
  so its separate transactions cannot wait on the caller's locks.

## Acceptance criteria and tests

Integration coverage is in `PartnerBoothRequestIntegrationTests`,
`OrganizerBoothSelectionIntegrationTests`, `BoothCatalogIntegrationTests` and
`PaymentSprint03IntegrationTests`. The payment fixture is reused for cross-module tests through
the existing settlement API; production settlement/QueryDR code is unchanged.

| Criteria | Coverage |
|---|---|
| AC-E02-01, AC-E02-05 | Pending withdrawal, ownership, retry, unchanged timestamps/no Hold |
| AC-E02-02 | Selected release, immediate availability, subsequent submission/selection |
| AC-E02-03 | Trusted failure and bounded-query timeout permit release |
| AC-E02-04 | Usable/expired Pending checkout and contradictory terminal evidence retain Hold |
| AC-E02-05 | Selected retry preserves response and timestamps; terminal requests conflict |
| AC-E02-06 | Concurrent settlement/withdrawal; expiry/withdrawal convergence |
| AC-E02-07 | Late contradictory success preserves reconciliation evidence and leaves new Hold intact |
| AC-O01-12/13, Booth scope | Shared Event lock, cancellation/submission race, submission waiting for cancellation commit, lifecycle recheck on review/configuration |

## Review and merge notes

Validation on 2026-10-14 used isolated PostgreSQL 17.11 and Redis 7.4.11 containers:

- `mvn verify`: BUILD SUCCESS; 271 tests, zero failures/errors/skips; executable JAR packaged.
- After the final microsecond timestamp adjustment, targeted Partner/Payment regression:
  41 tests, zero failures/errors/skips. This includes exact response equality on withdrawal retry.
- `git diff --check`: passed.
- Initial full-suite attempt used an incomplete environment and failed DB connections for the
  non-Event tests. The successful run explicitly set all PostgreSQL/Redis variables like CI.
- Local logs: `backend/target/s4b-verify.log`, `backend/target/s4b-final-targeted.log`.

- V1–V8, frontend and Payment settlement/reconciliation implementation are unchanged.
- The only Payment production addition is an ordered repository query for locking a Hold's attempts.
- Developer C still owns Partner application locking, public Event lifecycle queries and cancellation
  notification. Full cross-module verification must run again after their changes are integrated.
- At this handoff point, `AI_CONTEXT.md`, `CURRENT_SPRINT.md` and the Sprint baseline still described
  implementation as pending. The shared context was synchronized with the combined completed Sprint
  status on 2026-10-16.
- Interactive Swagger/manual verification and remote PR/merge are separate from this local handoff.
