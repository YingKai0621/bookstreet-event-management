# Sprint 8 Closure Report

- Sprint: Sprint 08 General Feedback Submission and Organizer Handling
- Status: `COMPLETED`
- Completion date: `2026-11-01`
- Public and schema implementation: PR #102, merge commit `8384fe9`
- Organizer implementation: PR #103, merge commit `071b97a`
- Schema baseline: immutable Flyway migrations V1 through V14
- Acceptance baseline: 28 Acceptance Criteria and 6 API operations

Sprint 8 is complete. The public contribution flow and the shared Organizer handling flow now use
durable PostgreSQL data through the real API. This report closes the approved Sprint scope without
adding Heritage, Guest replies, reports or distributed throttling.

## 1. Delivered scope

- V14 creates `general_feedbacks` with exact target, status, relationship, timestamp and privacy
  constraints plus three Organizer queue indexes.
- Guests and authenticated Participants can submit one-way Feedback for the whole Book Street or
  an eligible public Event through the existing CSRF flow.
- Public submission applies normalized validation and a bounded process-local HMAC-keyed throttle.
  Redis remains dedicated to Spring Session.
- The Landing Page uses the real create API and exposes success, validation, throttled and failure
  states without a mock-success fallback.
- Every verified Organizer shares one server-paged queue with distinct content/sender search and
  Event-name filtering.
- Organizer detail exposes private contact and internal processing data only to the authorized role.
- Explicit start, resolve and reopen commands enforce the approved lifecycle, actor metadata,
  timestamps, internal-note requirement and stale/concurrent conflict behavior.
- Organizer loading, empty, forbidden, conflict and retryable failure states are represented in the
  real UI.
- Feedback access does not broaden Event mutation ownership and no result is sent back to the Guest.

## 2. Acceptance Criteria traceability

### 2.1 Public criteria `AC-G04-S8-01` through `AC-G04-S8-12`

- `Sprint08SchemaMigrationTests`, `Sprint08HibernateValidationTests` and `GeneralFeedbackTests`
  cover clean/upgrade schema behavior, target XOR, status metadata and persistence invariants.
- `CreatePublicFeedbackRequestTests`, `PublicFeedbackServiceTests` and
  `PublicFeedbackControllerTests` cover anonymous and authenticated submission, Event eligibility,
  normalization, unknown fields, privacy-safe receipt, database failure and stable error mapping.
- `FeedbackCsrfHandlerTests` and `FeedbackRateLimiterTests` cover CSRF rejection, bounded attempt
  counting, reset behavior and the process-local HMAC-keyed throttle boundary.
- `sprint8-general-feedback-ui.spec.ts` covers the public desktop and mobile form, authenticated
  prefill, native and server validation, duplicate-click protection, real success and failure
  presentation.

### 2.2 Organizer criteria `AC-O-S8-01` through `AC-O-S8-12`

- `OrganizerFeedbackServiceTests` covers the shared cross-Event queue, server pagination and
  filters, detail privacy, all legal transitions, required resolve note, reopen metadata and
  invalid or stale transition conflicts.
- `OrganizerFeedbackControllerTests` covers role authorization, request mapping and stable API
  responses without weakening Event-owner authorization.
- `sprint8-general-feedback-ui.spec.ts` covers queue and detail interaction, separated search
  controls, loading, empty, forbidden and server failure states, legal actions and pagination
  correction after a transition shrinks the result set.
- Service and migration coverage confirm that no public result delivery, hard delete or transition
  history table was introduced.

### 2.3 Schema and regression criteria `AC-X-S8-01` through `AC-X-S8-04`

- `Sprint08SchemaMigrationTests` covers both clean V1-to-V14 and V13-to-V14 upgrade paths plus
  database constraint rejection.
- `Sprint08HibernateValidationTests` proves the JPA model validates against the applied V14 schema.
- PR #103 full backend CI completed with 696 tests, 0 failures, 0 errors and 1 explicit opt-in smoke
  test skipped.
- Focused closure verification adds a direct database-persistence failure assertion and explicit
  Organizer loading, empty, forbidden and server failure browser scenarios.

## 3. Verification evidence

The closure branch was verified without using the local demo database as test data.

- focused Sprint 8 backend suite: **39 passed, 0 failed, 0 skipped**
- focused Sprint 8 Playwright suite: **16 passed**
- PR #103 backend CI: **696 tests, 0 failures, 0 errors, 1 opt-in smoke skipped**
- PR #103 frontend lint: **0 errors and 28 pre-existing warnings**
- PR #103 frontend production build: **passed**
- clean V1-to-V14, V13-to-V14 and Hibernate validation: **passed**

The browser pagination scenario now waits for the observable page transition before issuing the
next navigation action. This removes a test timing race without changing product behavior.

## 4. Manual acceptance already confirmed

During local real-API review, the project owner confirmed:

- anonymous public submission success
- invalid email handling without a blank page
- authenticated Participant email prefill and successful submission
- duplicate-click protection
- Organizer queue scrolling, detail display and revised search/filter layout
- Event-name filtering instead of exposing internal Event identifiers

No credential, Session value, contact email, local address or demo Feedback row is recorded in this
report.

## 5. Remaining debt and out-of-scope work

- Heritage content remains independent from General Feedback. `HERITAGE` is not a supported or
  planned Feedback target.
- Guest reply, status lookup, email/SMS/push delivery and public Feedback list/detail remain out of
  scope.
- Reporting, statistics, Admin Feedback management, transition history and hard delete remain out
  of scope.
- The bounded throttle is intentionally process-local. Distributed multi-instance enforcement is
  a later architecture decision, not unfinished Sprint 8 work.
- Existing frontend lint warnings and production bundle splitting remain general technical debt.
- No Sprint 9 baseline is active. New feature work requires a separate approved Sprint baseline.

## 6. Closure decision

All 28 Acceptance Criteria have automated or explicitly confirmed manual evidence. V14 is
immutable, the focused verification set is green, the role and privacy boundaries remain intact,
and the project-control documents now reflect the applied implementation. Sprint 8 is therefore
closed as `COMPLETED` on `2026-11-01`.
