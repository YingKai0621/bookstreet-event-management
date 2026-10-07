# Sprint 02 Backend Work Assignment

## 1 Goal

Split Sprint 2 into reviewable work without letting multiple people edit the same migration or shared configuration concurrently.

This assignment becomes active only after the Sprint 2 scope, Acceptance Criteria and API Contract are reviewed and merged into `main`.

Sprint 2 ends at Organizer selection, a price-locked BoothHold, selection email delivery trigger and Hold expiry. It does not implement Payment, BoothAssignment, Refund or Activity.

## 2 Approved implementation decisions

- `boothPaymentWindowMinutes` is configured per Event and stored in the existing `events.booth_payment_window_minutes` column.
- Its allowed range is `60` through `10080` minutes, inclusive. The default for a newly created Event is `1440` minutes, equivalent to 24 hours.
- For a newly created Event, the Organizer UI initializes this Event-level duration control to `24 Hours`. When editing an existing Event, it displays the currently persisted `boothPaymentWindowMinutes` value, converted for presentation if necessary; the API and database continue to use minutes.
- When a request is selected, the backend uses one authoritative instant and calculates `BoothHold.expiresAt = selectedAt + boothPaymentWindowMinutes`.
- `expiresAt` is persisted on the Hold and is never recomputed. A later permitted Event setting change applies only to Holds created by later selections.
- Demo and automated-test Events may use a shorter valid window. Expiry tests use a controllable Clock instead of storing a value below 60 minutes.
- Sprint 2 does not define a payment-session duration. Sprint 3 must ensure a payment session never outlives `BoothHold.expiresAt`.
- One Partner cannot have more than one open request for the same Event–Booth. Open statuses are `PENDING` and `SELECTED`.
- After `WITHDRAWN` or `PAYMENT_EXPIRED`, the Partner may create a new request for the same Event–Booth if deadline, quota and availability rules still pass.
- After `REJECTED`, the Partner cannot submit again for the same Event–Booth, but may request another Booth.
- A historical request is never restored or reused.
- Pending requests do not consume Booth quota. Quota counts Active Holds and future Active Assignments.
- Selection locks the physical Booth before EventBoothConfig and checks overlapping allocation time as `[startAt, endAt)`.
- Candidate requests not selected remain `PENDING`.

## 3 Recommended ownership

### Workstream A - Database and Booth catalog

Owns:

- the single Sprint 2 Flyway migration;
- migration verification from both a clean database and an existing V1–V5 database;
- replacement of the old non-negative Event payment-window constraint with the approved `60..10080` range and a `1440` database default;
- backend defaulting and validation for `boothPaymentWindowMinutes` in the existing Event create/update path;
- `Location`, `Booth` and `EventBoothConfig` Java persistence;
- Organizer physical Booth APIs;
- Organizer Event Booth configuration APIs;
- base public Booth queries from physical Booth and Event configuration.

The migration creates:

- `locations`;
- `booths`;
- `event_booth_configs`;
- `booth_requests`;
- `booth_holds`.

V6 creates exactly these five new tables. It also normalizes any legacy Event payment-window value outside `60..10080` to the nearest valid boundary, replaces the existing constraint and sets the column default to `1440`; it does not create a second Event settings table.

V6 must create a partial unique index on `booth_requests (application_id, booth_id)` for rows whose status is `PENDING` or `SELECTED`. This is the database backstop for the one-open-request rule. Because closed rows are intentionally outside that index, Workstream B must still enforce the rule that a `REJECTED` request cannot be resubmitted for the same Event–Booth.

The Sprint 2 form of `booth_holds` supports only `booth_request_id`. A later additive migration may introduce `booth_change_request_id` when Booth Change enters an approved Sprint.

The migration must be merged first so every later workstream rebases onto one schema owner. Workstream A does not own BoothRequest or BoothHold Java persistence.

### Workstream B - Partner Booth requests

Owns:

- `BoothRequest` entity and repository;
- Partner eligibility lookup through the existing PartnerEventApplication;
- BoothRequest creation;
- Partner-owned list and detail;
- Pending withdrawal;
- enforcement of the approved duplicate and resubmission policy;
- validation and integration tests for approval, deadline, quota, availability and ownership.

Submitting a request creates only `PENDING`. It must not create a Hold or change Booth availability.

### Workstream C - Organizer selection, availability and Hold expiry

Owns:

- `BoothHold` entity and repository;
- Organizer candidate list and detail;
- `PENDING → REJECTED` with a required review note;
- transactional selection using physical-Booth then Event-config row locking;
- `PENDING → SELECTED` and `ACTIVE` Hold creation;
- price snapshot and Active Hold uniqueness;
- payment-window snapshot through persisted `selectedAt` and `expiresAt` values calculated from the same backend Clock instant;
- complete availability derivation using Event configuration and Active Holds;
- Spring Scheduler setup and on-demand expiry before availability-sensitive commands;
- selection email triggered only after transaction commit;
- concurrency, expiry, email-after-commit and authorization tests.

Expiry changes the Hold from `ACTIVE` to `EXPIRED`, changes its source request from `SELECTED` to `PAYMENT_EXPIRED`, and records `releasedAt` when the backend processes the expiry. Processing must be idempotent.

Email rules:

- email is sent only after the selection transaction commits successfully;
- email failure does not roll back Booth selection or BoothHold;
- email failure is logged;
- Sprint 2 does not add an outbox, notification table or complex delivery-retry system;
- tests verify that the mail service is invoked after commit, not that an external provider delivers the email.

Workstream C must leave competing candidates `PENDING` and must not create Payment or Assignment records.

### Workstream D - Frontend integration

Owns:

- Organizer Booth catalog and Event configuration screens;
- an Event payment-window control that defaults to `24 Hours` only for a new Event, displays the persisted value when editing an existing Event, is constrained to 1 hour through 7 days and converts to minutes before calling the existing Event API;
- a simple Event Booth map/grid grouped or sorted by Booth code;
- Booth detail showing code, category, Event price and derived availability;
- Partner BoothRequest submission from an `AVAILABLE` Booth;
- Organizer candidate review and selection screens;
- selected Hold expiry display and countdown;
- migration of Sprint 2 Booth calls away from placeholder endpoints to the shared `apiClient`;
- session cookie, CSRF and standard API error handling;
- Playwright coverage for the approved Sprint 2 demo.

`ON_HOLD`, `ASSIGNED` and `UNAVAILABLE` Booths are visible but cannot be requested. The countdown is informative only; backend `expiresAt` and persisted Hold lifecycle are authoritative.

## 4 Shared-file rules

- One designated owner creates or edits the Sprint 2 migration.
- Coordinate before changing `SecurityConfiguration`, global exception handling, scheduling configuration, `application.yml`, `.env.example` or CI.
- Feature branches must update or add tests with their implementation.
- Do not edit V1, V2, V3 or V4.
- Do not add payment-provider credentials in Sprint 2.
- Do not add Payment, BoothAssignment, Refund or Activity tables as part of this Sprint.
- No secret or real account credential may be committed.

## 5 Suggested pull-request order

1. `docs/sprint-02-booth-allocation-design`
2. `feature/s2-booth-schema`
3. `feature/s2-booth-catalog-config`
4. `feature/s2-partner-booth-requests`
5. `feature/s2-organizer-booth-selection`
6. `feature/s2-booth-availability-integration`
7. `feature/s2-booth-frontend-integration`
8. `test/s2-booth-end-to-end`

The schema PR contains V6 and schema verification only. Every later pull request must rebase or merge the latest `main`, pass CI and preserve the Sprint 1 regression suite.

## 6 Required test groups

- Clean-database V1–V6 migration test
- Existing V1–V5 to V6 upgrade test
- Repository and schema constraint tests
- Booth validation and Event ownership tests
- Event payment-window default, inclusive bounds and invalid-value tests
- Partner approval, deadline, quota, duplicate, resubmission and ownership tests
- `ON_HOLD`, `ASSIGNED` and `UNAVAILABLE` submission rejection tests
- Pending-request non-locking test
- Same-Booth competing candidate test
- Cross-Event overlapping and non-overlapping Booth tests
- Concurrent selection test
- Locked-price snapshot test
- Hold-expiry snapshot test proving a later Event setting change cannot alter an existing Hold
- Hold expiry and idempotency test
- Selection-email after-commit test
- Selection-email failure does not roll back business transaction test
- Role and verified-email authorization tests
- OpenAPI contract test
- Frontend lint/build CI check
- Playwright Sprint 2 happy path as a required local pre-merge check until a dedicated E2E GitHub Actions job is added
- Full Sprint 1 regression suite

All backend test groups above run in CI together with frontend lint/build. Playwright remains local pre-merge until the repository adds its dedicated E2E GitHub Actions job.

## 7 Definition of Done

Sprint 2 is complete only when:

- V6 succeeds on a clean database;
- V6 upgrades an existing V1–V5 database without manual intervention;
- backend and frontend contracts match the approved Sprint 2 API Contract;
- Sprint 1 regression tests pass;
- authorization, ownership and validation tests pass;
- concurrency tests prove that overlapping Events cannot Hold the same physical Booth simultaneously;
- non-overlapping Events can reuse the same physical Booth;
- Hold expiry is idempotent;
- every Event payment window is within `60..10080` minutes, new Event forms default to `1440`, and existing Holds retain their persisted expiry when Event settings change;
- selection email is triggered only after transaction commit;
- backend tests and frontend lint/build pass in CI;
- the Playwright Sprint 2 happy path passes as a required local pre-merge check until a dedicated E2E GitHub Actions job is added;
- the demo runs without manually editing the database;
- no Payment, Refund or BoothAssignment record is created.

After a dedicated E2E GitHub Actions job is added, the team may promote the same Playwright check from the local pre-merge requirement into CI.
