# Sprint 05 Backend Work Assignment

> Status: `COMPLETED` on 2026-10-19. Developers A, B and C delivered their assigned slices through
> the Sprint 5 merge sequence; PR `#56` completed the integrated Partner/Organizer workflow.
> V1–V8 remain immutable and the single V9 migration is owned by the delivered Activity foundation.

## 1. Shared implementation boundary

- Implement only the scope in `sprint-05.md`, its Use Case Specifications and API Contract.
- Preserve Spring Security Session, CSRF, PostgreSQL and `ddl-auto=validate` baselines.
- Every command maps to named Sprint 5 Acceptance Criteria.
- Event is the first lock for every Activity mutation.
- Location locks are acquired by ascending ID before Proposal/Activity/request rows.
- Do not use service-only checks as the final defense for schedule conflicts or one-Pending-request
  races.
- Do not add Participant registration/attendance endpoints, payment/refund logic or Booth
  cancellation.
- Do not send email inside a transaction.

## 2. Three-person split

### Developer A — V9, Location and Activity core owner

Responsibilities:

- Own the single `V9__...sql` migration.
- Add/extend Location and Activity domain entities, enums, repositories and schema validation.
- Implement immutable Activity revision persistence and snapshot serialization without secrets.
- Enable `btree_gist` and implement cross-Event half-open schedule exclusion.
- Implement the database-safe one-Pending-request guard shared by Change/Cancellation requests.
- Implement shared Location Organizer APIs and Partner eligible-location query.
- Implement Activity validation, conflict translation, deterministic lock helpers and lifecycle
  scheduler/request-time catch-up.
- Implement Event operational freeze and Event cancellation/completion Activity cascade primitives.
- Coordinate entity/DTO fields consumed by Developers B/C before either starts service code.

Acceptance Criteria ownership:

- AC-O02-01 through AC-O02-04
- AC-O06-02, AC-O06-03, AC-O06-05, AC-O06-06 and shared revision infrastructure for AC-O06-12
- AC-X05-01 through AC-X05-04 for shared transaction/lifecycle infrastructure

Primary packages/files:

- `db/migration/V9__...sql`
- `location`
- Activity core/domain repository package
- Event lifecycle integration
- migration and concurrency tests

### Developer B — Partner Proposal and Partner request owner

Responsibilities:

- Implement Partner Proposal submit/list/detail/edit/resubmit/withdraw.
- Implement Proposal field, deadline, application, shared Location and BoothAssignment guards.
- Implement Partner official Activity list/detail through source Proposal ownership.
- Implement Change Request submit/list/detail/withdraw with full merged validation.
- Implement Cancellation Request submit/list/detail/withdraw and exact late-boundary logic.
- Integrate with Developer A's shared Pending-request guard and lock helpers.
- Add Partner-facing post-commit email triggers where the contract requires them.

Acceptance Criteria ownership:

- AC-E04-01 through AC-E04-09
- AC-E05-01 through AC-E05-06
- AC-E06-01 through AC-E06-05
- Partner side of AC-X05-01/AC-X05-02

Primary packages:

- `partner`
- `activityproposal`
- Partner Activity request services/controllers
- authorization/integration tests

### Developer C — Organizer review, Activity API and public discovery owner

Responsibilities:

- Implement Organizer Proposal list/detail/request-changes/reject/approve.
- Implement idempotent atomic Proposal approval using Developer A locks/constraints.
- Implement direct BTC Activity create, allowed patch, publish and Organizer cancel.
- Expose ownership-safe Activity revision history and ensure every applied change writes audit
  evidence atomically.
- Implement Organizer Change/Cancellation Request lists and review commands.
- Implement public Activity list/detail visibility.
- Implement post-commit Partner representative notifications and failure isolation.
- Own OpenAPI examples and end-to-end Swagger verification script/checklist.
- Coordinate full regression and documentation/completion evidence.

Acceptance Criteria ownership:

- AC-O05-01 through AC-O05-08
- AC-O06-01, AC-O06-04, AC-O06-07 through AC-O06-12
- AC-G01-01 through AC-G01-03
- Organizer/public side of AC-X05-01 through AC-X05-04

Primary packages:

- Organizer Activity/Proposal controllers and services
- `notification`/existing mail infrastructure
- public Activity query package
- integration/OpenAPI tests

## 3. Mandatory coordination points

### Before parallel feature work

Developer A merges or publishes a reviewed foundation containing:

- final V9 table/column/enums;
- Activity validation value objects/helpers;
- lock-order API;
- schedule-conflict exception translation;
- one-Pending-request database mechanism;
- stable DTO field names shared across controllers.

Developers B/C must not invent alternate enum values, migration fragments or lock orders.

### Shared race tests

- Developer A owns database primitives.
- Developer B provides concurrent Partner request creation scenarios.
- Developer C provides concurrent Proposal approval/direct Activity creation scenarios.
- Cross-module tests are reviewed by at least two developers because passing isolated service
  tests is insufficient.

## 4. Merge order

1. Sprint 5 documentation baseline.
2. V9 migration and entity/repository compatibility.
3. Location API, validation/lock primitives and conflict translation.
4. Partner Proposal commands/queries.
5. Organizer Proposal review and atomic approval.
6. Organizer Activity create/configure/publish/cancel and lifecycle.
7. Partner Change/Cancellation Requests and Organizer review.
8. Event cascade, public discovery and post-commit notifications.
9. Cross-module concurrency, full regression, frontend integration and completion report.

Only the V9 owner resolves migration conflicts. No `V9_fix`, alternate V9 or edited historical
migration is permitted.

## 5. Required V9 verification

- Clean V1→V9 migration.
- Existing V8→V9 upgrade.
- `btree_gist` availability and exclusion constraint behavior.
- Half-open adjacency accepted; cross-Event overlap rejected.
- Existing legacy Location/Booth rows remain valid.
- Location code normalization preflight detects case-insensitive collisions before adding the new
  functional unique index; migration must not silently merge rows.
- New cancellation/request/status consistency checks reject invalid manual SQL.
- Unique source Proposal creates at most one Activity.
- One Pending request across both request types survives concurrent inserts.
- Activity revision old/new snapshots persist atomically with the applied change and expose no
  secret/session fields.
- Hibernate `ddl-auto=validate` passes.

## 6. Required automated coverage

- Every AC has at least one named automated test or explicit cross-reference to a shared test.
- Authorization matrix for Guest/Participant/Partner/Organizer and cross-owner access.
- Backend Clock tests for equality and one-tick-after deadline/cutoff boundaries.
- Proposal state transition matrix.
- Activity and request state transition matrices.
- Booth ownership lost between submit and approve.
- Capacity/Location state changed between submit and approve.
- Quota race at approval.
- Schedule conflict race through PostgreSQL.
- Change/cancellation request race for the same Activity.
- Event cancel versus proposal/request/activity mutation.
- Lifecycle catch-up after delayed scheduler/restart.
- Publish/cancel/withdraw/approve idempotency and no duplicate mail/QR.
- Public detail of ever-published cancelled Activity and privacy of Draft/private data.
- Full existing backend regression, including VNPay spike tests.

## 7. Manual Swagger smoke flows

1. Organizer creates a shared Stage.
2. Partner with approved application and no Booth submits a valid Proposal.
3. Organizer requests changes; Partner revises/resubmits after general deadline but before start.
4. Organizer approves; verify one Draft Activity and no duplicate on retry.
5. Organizer configures registration settings and publishes; retry publish and compare QR/timestamp.
6. Create adjacent Activity at same Location successfully; overlapping Activity fails with 409.
7. Partner submits Change Request; Organizer approves and verifies Published state remains.
8. Partner submits a late Cancellation Request; verify Activity remains until approval.
9. Organizer approves cancellation; verify source/reason and public historical detail.
10. Verify foreign Partner private endpoints return 404.
11. Verify eligible Event cancellation cascades Activity records without bypassing Sprint 4
    financial blockers.

## 8. Pull request checklist

- Scope references exact AC IDs.
- No production secrets, `.env`, Postman local output or generated build artifacts committed.
- No historical migration edited.
- Error codes match API contract.
- Ownership is server-derived.
- Locks follow Event → Location(s) → domain row.
- Database constraint violations are translated, not leaked as 500.
- External I/O occurs after commit/outside locks.
- Tests use PostgreSQL where database behavior matters.
- Documentation is updated if and only if reviewed behavior changed.

