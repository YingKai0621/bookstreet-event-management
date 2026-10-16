# Sprint 4 Completion Report

- Sprint: Sprint 04 Event Lifecycle and Pre-payment Booth Release
- Status: `COMPLETED`
- Completion date: `2026-10-16`
- Schema baseline: immutable Flyway migrations V1 through V8

## 1 Delivered scope

Sprint 4 completes both approved Use Case slices:

- UC-O01 Manage Events: owned Draft deletion, safe Published/Ongoing update rules, eligible Event
  cancellation, timed lifecycle transitions, public lifecycle queries and post-commit cancellation
  notification;
- UC-E02 Manage Booth Request: Pending withdrawal and safe release of an eligible Selected request
  and Active Hold before settlement.

All 23 Sprint 4 Acceptance Criteria are covered: AC-O01-01 through AC-O01-16 and AC-E02-01 through
AC-E02-07.

## 2 Database and transaction result

- `V8__add_event_and_booth_request_cancellation_metadata.sql` adds the Event cancellation metadata,
  Event consistency constraints and BoothRequest cancellation metadata/status required by Sprint 4.
- Clean V1-to-V8 migration and V7-to-V8 upgrade/backfill paths are covered by migration tests.
- Hibernate continues to use `ddl-auto=validate`.
- Event-scoped mutations use the global lock order `Event → Booth (if needed) → EventBoothConfig
  (if needed) → Hold → Payment by ascending id → BoothRequest`.
- Operational patch, cancellation, Partner application, Booth submission/selection, withdrawal,
  expiry and payment resolution races are covered by deterministic integration tests.

## 3 Verification evidence

Final local verification on 2026-10-16 used an isolated PostgreSQL 17.11 database and Redis:

- backend `mvn test`: 284 tests, zero failures, zero errors and zero skipped;
- disposable VNPay spike `node --test tools/vnpay-sandbox/vnpay-spike.test.mjs`: 20 tests passed;
- frontend `npm run lint`: passed with zero errors and 27 warnings;
- frontend `npm run build`: passed; Vite reported the existing large-chunk warning;
- `git diff --check`: passed.

Manual Swagger acceptance was reported successful for the required Sprint 4 smoke flows:

- delete an owned Draft Event;
- safely patch an eligible Published Event;
- cancel an eligible Published Event and observe cancellation metadata;
- withdraw an owned Selected Booth request before payment, producing `WITHDRAWN` request and
  `RELEASED` Hold state.

## 4 Scope intentionally not delivered

The following remain outside Sprint 4 and must not be reported as incomplete Sprint 4 work:

- Event cancellation after Ongoing/Completed or after blocking financial/Assignment evidence;
- hard deletion of Published Event history;
- Booth change or cancellation after Assignment;
- whole-Event Partner withdrawal after approval;
- business refund execution and Admin emergency cancellation;
- persistent notification inbox/UI and Activity/Participant cascade implementation.

## 5 Tracked technical debt

- Add automated browser-level Payment/Assignment Playwright coverage.
- Reduce the existing frontend lint warnings.
- Split the large frontend production bundle into smaller route/feature chunks.
- Configure production VNPay credentials and deployment webhook behavior outside the repository.

These items do not block Sprint 4 closure because the approved Definition of Done requires the
existing regression, VNPay spike, frontend lint and frontend build to remain green, which they do.
