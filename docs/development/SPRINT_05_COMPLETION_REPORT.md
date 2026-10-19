# Sprint 5 Completion Report

- Sprint: Sprint 05 Activity Planning and Partner Proposal Workflow
- Status: `COMPLETED`
- Completion date: `2026-10-19`
- Final merge: PR `#56`, merge commit `759a25c`
- Schema baseline: immutable Flyway migrations V1 through V9

## 1. Delivered scope

Sprint 5 completes all seven approved Use Case slices and their 54 Acceptance Criteria:

- UC-E04 Propose Activity;
- UC-E05 Request Activity Change;
- UC-E06 Request Activity Cancellation;
- UC-O02 Manage Activity Locations;
- UC-O05 Review Activity Proposals;
- UC-O06 Manage Activities;
- UC-G01 Discover Public Activities.

The delivered frontend provides one coherent Partner Activity workspace and one Organizer Activity
workspace. Their contextual states distinguish Proposal, official Activity, Change Request and
Cancellation Request instead of presenting every record as the same kind of approval.

## 2. Database and transaction result

- `V9__create_sprint5_activity_schema.sql` extends Location support and creates Activity Proposal,
  official Activity, unified Activity Request and immutable Activity Revision storage.
- Clean V1→V9 and existing V8→V9 migration paths have PostgreSQL-backed automated coverage.
- Hibernate continues to use `ddl-auto=validate`.
- PostgreSQL `btree_gist` and the exclusion constraint reject overlapping non-cancelled Activities
  at one physical Location using half-open intervals; adjacent Activities remain valid.
- Proposal approval is idempotent and atomically creates at most one Draft Activity.
- The database-backed Pending-request invariant permits at most one Pending Change/Cancellation
  Request per Activity.
- Activity mutations preserve the approved Event → Location(s) → domain-row lock order.
- Event cancellation/completion closes or cancels affected Activity records without bypassing the
  Sprint 4 financial blockers.

## 3. Delivered business behavior

- An approved Partner can propose an Activity at an eligible shared Location without owning a
  Booth, or use its own Active Booth Assignment in the same Event.
- Pending Proposals do not reserve schedule slots. Approval revalidates Event, Location, ownership,
  capacity, time, conflict and `maxActivitiesPerPartner` quota under lock.
- Organizer can request Proposal changes, reject, approve, create direct shared-Location Activity,
  edit allowed fields, publish and cancel.
- Partner cannot directly overwrite official Activity data; controlled Change/Cancellation
  Requests preserve review history and the current authoritative Activity state.
- Organizer can review both request types. Approved changes write Activity revisions; approved
  cancellation records the Partner-request source and releases schedule/quota.
- Public list/detail visibility follows Activity lifecycle and does not leak Proposal or review
  information.
- Affected Partner representatives receive post-commit email; delivery failure does not roll back
  domain state.

## 4. Verification evidence

Final implementation verification recorded for the merged Sprint 5 branch:

- backend Surefire inventory: 370 tests, zero failures and zero errors in the latest local report;
  171 PostgreSQL/environment-gated cases were skipped in that local run when its test services were
  unavailable, while the repository CI job is configured to execute `mvn verify` with PostgreSQL
  17.11 and Redis services;
- focused Partner/Organizer Playwright Activity suite: 9 tests passed;
- frontend production build: passed;
- frontend lint: passed with zero errors; pre-existing warnings remain tracked technical debt;
- `git diff --check`: passed;
- manual Partner and Organizer acceptance exercised Proposal creation/review, official Activity
  navigation, Change Request, Cancellation Request, Location selection and synchronized status
  visibility.

Automated Activity coverage includes migration constraints, ownership, deadlines, quota,
half-open scheduling, approval idempotency, request races, lifecycle catch-up, Event cascade,
revision audit, notification isolation, public privacy and OpenAPI exposure.

## 5. Scope intentionally not delivered

These items remain outside Sprint 5 and must not be reported as incomplete Sprint 5 work:

- Participant Activity registration, attendance scanning, rating and certificate issuance;
- paid Activity/tickets, waitlist, seat map, equipment or staff scheduling;
- persistent in-app Notification storage/UI;
- advanced map editing and Location hard-delete;
- Booth change/cancellation, refund execution and whole-Event Partner withdrawal;
- an enforced setup/teardown buffer between adjacent Activities.

The current schedule correctly allows one Activity to start exactly when the preceding Activity at
the same Location ends. Any configurable buffer is a future enhancement requiring a new approved
business rule and migration/API impact review.

## 6. Tracked technical debt

- Run and retain a local PostgreSQL-backed full-suite report when the shared test services are
  available, in addition to CI evidence.
- Add automated browser-level Payment/Assignment coverage retained from Sprint 3.
- Reduce existing frontend lint warnings and split the large production bundle.
- Configure production VNPay, SMTP and deployment webhook values outside the repository.
- Regenerate rendered ERD assets if the team requires diagrams to mirror immutable V9 exactly.

None of these items changes the approved Sprint 5 Activity behavior or blocks its closure.
