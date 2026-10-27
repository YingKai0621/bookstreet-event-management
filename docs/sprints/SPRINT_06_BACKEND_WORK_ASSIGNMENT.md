# Sprint 06 Backend Work Assignment

> Status: `PROJECT OWNER APPROVED — ACTIVE SPRINT BASELINE` on 2026-10-19.
>
> Implementation is authorized only within the scope, ownership and merge gates below and the
> active Sprint declaration in `docs/sprints/CURRENT_SPRINT.md`.

**Notification inbox amendment (2026-10-27):** Developer C also owns the approved owner-only,
idempotent `POST /participant/notifications/read-all` query-state command and its frontend action.

## 1. Purpose and implementation boundary

Sprint 6 completes the Participant journey around Event registration, Activity registration,
Attendance, Certificate, Rating and notifications. It also gives Organizer the monitoring and
audited-correction tools required to operate that journey.

All implementation must follow these sources of truth, in order:

1. `docs/requirements/05_Business_Rules.md`
2. `docs/requirements/06_Use_Case_List.md`
3. `docs/requirements/08_MVP_Scope_v2.md`
4. `docs/sprints/sprint-06.md`
5. `docs/use-cases/sprint-06-use-case-specifications.md`
6. `docs/design/12_Physical_ERD_Report.md`
7. `docs/design/BookStreet_Physical_ERD_v1.drawio`
8. `docs/api/sprint-06-api-contract.md`
9. This work-assignment document

The API contract approved on 2026-10-19 is frozen for implementation. Any semantic change to a
route, request, response, status transition, validation rule or error code requires a documentation
change and Project Owner approval before code is changed.

### 1.1 In scope

- Close the canonical public Activity read-contract debt.
- Participant Event registration and cancellation.
- Participant Activity registration, cancellation and lifecycle lists.
- Activity QR self check-in with idempotent outcomes and authoritative server time.
- Organizer Attendance monitoring and audited correction/override.
- Deterministic `NO_SHOW` finalization.
- Event and Activity change/cancellation impact on registrations and notifications.
- Certificate generation, lookup and download.
- Activity Rating create/update and public aggregate.
- Participant notification list, unread count and read-state operations.
- Required Participant and Organizer frontend integration, plus regression verification that
  existing Partner Activity views remain consistent with the same Activity source of truth.
- Automated tests, Swagger verification and documentation closure.

### 1.2 Explicitly out of scope

- Event-level QR attendance.
- Participant-specific QR codes.
- Payment, refund or booth-rental changes.
- Waitlists, ticket resale or registration transfer.
- Email, SMS or push-provider delivery; Sprint 6 notifications are in-app records.
- Bulk certificate export.
- Free-form Organizer deletion of Attendance history.
- Rewriting migrations `V1` through `V9`.
- Unapproved route aliases or compatibility endpoints outside the approved contract.

## 2. Shared engineering rules

These rules apply to all three developers.

### 2.1 Database and transaction rules

- Developer A is the sole owner of Sprint 6 migration `V10`. Developers B and C must not create,
  rename or edit Sprint 6 Flyway files.
- Migrations `V1` through `V9` are immutable.
- Business transitions are committed in one transaction with their dependent notification,
  certificate or adjustment records where the approved use case requires atomicity.
- Capacity and first-scan-wins behavior must be protected by database-aware locking or an
  equivalent transaction-safe mechanism; an in-memory count/check is insufficient.
- Every retryable command must return the documented idempotent result and must not create a second
  active registration, Attendance, Certificate, Rating or notification.
- Backend `Clock` is the only authority for deadlines, scan windows, completion and no-show rules.
- Store instants in UTC. `Asia/Ho_Chi_Minh` is a presentation concern.

### 2.2 Security and ownership rules

- Keep the existing Redis-backed server-side Session and CSRF model.
- Public endpoints expose only fields approved in the contract.
- Participant endpoints derive Participant identity from the authenticated session; they never
  accept a caller-selected `participantId`.
- Organizer endpoints verify ownership of the parent Event before exposing or mutating data.
- Partner Activity requests keep their existing organization/Partner ownership rules.
- The raw Activity QR token is returned only by the protected Organizer Activity-detail contract.
  It must not appear in list, public, Partner or Participant payloads or logs.
- Unknown JSON properties, malformed enums and unsupported sort/filter fields are rejected.

### 2.3 Code ownership and conflict prevention

- Each file has one primary owner in a PR. Cross-owner edits require a short coordination note in
  the PR description.
- Do not create a second generic registration, Attendance or notification abstraction beside the
  package named in this document.
- Shared enums and DTOs are added once and reused. Do not duplicate lifecycle mappings in frontend
  and backend with different names.
- Frontend API adapters are owned by Developer C after the corresponding backend contract is
  available. Developers A and B provide examples/tests, not competing adapter implementations.
- Exceptions use the approved error code, HTTP status and field-error shape. Raw SQL, stack traces
  and internal exception messages must never be returned to the UI.

## 3. Developer A — Foundation, public Activity and registration owner

Developer A owns the schema foundation and Flow A. This work must merge before Flow B or Flow C
implementation is merged.

### 3.1 Sole migration ownership

Sprint 6 schema is delivered by exactly these two immutable migrations:

- `backend/src/main/resources/db/migration/V10__create_sprint6_participation_schema.sql`
- `backend/src/main/resources/db/migration/V11__activity_attendance_early_scan_minutes.sql`

`V10` implements the approved physical ERD for:

- `event_registrations`
- `activity_registrations`
- `attendances`
- `attendance_adjustments`
- `certificates`
- `activity_ratings`
- `notifications`

The migration must include all approved foreign keys, status checks, positive-value checks, unique
constraints, partial/functional indexes and notification target/payload constraints. Names and
types must match the physical ERD report exactly.

`V11` adds the Activity `attendance_early_scan_minutes` setting approved by the 2026-10-26 QR
window amendment, with default 15 and range `0..1440`.

Developer A must prove both upgrade paths:

- clean database: `V1 -> V11`
- existing Sprint 5 database: `V9 -> V11`

### 3.2 Shared persistence foundation

Create the minimal entity/repository/enums required by the physical ERD, organized by feature:

- registration persistence for Event and Activity registrations
- notification persistence plus a small deduplicating notification-writer boundary
- common lifecycle enums used by later Attendance, Certificate and Rating modules

The notification writer is a shared command boundary. Developer A owns its persistence semantics;
Developer B and Developer C own the domain events that call it.

### 3.3 Canonical public Activity contract debt

Implement and test the approved public endpoints:

- `GET /api/v1/activities`
- `GET /api/v1/activities/{activityId}`

Required behavior includes:

- only publicly visible lifecycle states
- approved filters, pagination and stable sort
- no raw QR token or protected operational fields
- registration availability derived from server time and capacity
- public Rating aggregate when present
- compatible Activity detail links from public Event views

Do not preserve a phantom frontend route by adding an unapproved backend alias.

### 3.4 Event and Activity registration commands

Implement the approved Participant registration endpoints and their queries:

- Event registration create, cancel, detail and list operations
- Activity registration create, cancel, detail and list operations
- registration eligibility/capacity evaluation described by the contract
- Event and Activity registration uniqueness and re-registration semantics
- deadline, Event-ownership, Event-registration prerequisite and Activity-capacity validation
- transaction-safe final-seat handling
- idempotent cancel/retry behavior

### 3.5 Event update-freeze and cancellation integration

Developer A owns the Event-registration side of the operational-update freeze and Event
cancellation propagation:

- reject protected Event operational changes after Participant participation exists, as defined by
  the approved Event rules
- update affected Event registrations according to the approved transition matrix
- update dependent Activity registrations where the use case requires it
- invoke the shared notification writer with deterministic deduplication keys
- preserve history rather than deleting participation records
- make a repeated Event cancellation command safe

### 3.6 Primary acceptance-criteria ownership

Developer A is the primary owner of these 29 criteria:

- `G01-01` through `G01-04`
- `P01-01` through `P01-07`
- `P02-01` through `P02-12`
- `P03-01`
- `O01-S6-01` through `O01-S6-05`

Primary ownership means the developer supplies the implementation and direct automated tests. It
does not remove the obligation of Developers B and C to test their integration with these flows.

### 3.7 Developer A completion gate

Developer A is complete only when:

- migration verification passes on clean and upgrade databases
- Hibernate schema validation passes
- public Activity payloads contain no protected fields
- concurrency tests prove one final Activity seat cannot be oversold
- Event and Activity re-registration/cancellation behavior matches the approved state machine
- Event cancellation propagation and notification deduplication are tested
- all 29 primary criteria have traceable automated or explicitly documented manual evidence

## 4. Developer B — Attendance, Organizer operations and Activity lifecycle owner

Developer B begins from Developer A's merged schema/persistence foundation. Developer B must not
fork or replace registration or notification persistence.

### 4.1 Participant QR self check-in

Implement the approved Activity self-scan command and outcomes:

- authenticate Participant and validate active Activity registration
- hash/compare the scanned Activity token without exposing the stored token
- enforce the approved early/open/late/closed window using backend `Clock`
- implement first-valid-scan-wins transaction semantics
- return the documented success, idempotent repeat and failure outcomes
- never create Attendance for an ineligible/cancelled registration

### 4.2 No-show finalization

Implement deterministic `NO_SHOW` handling:

- only after the approved Attendance window has closed
- idempotent across retries and concurrent job/request execution
- excludes cancelled/ineligible registrations
- keeps history needed for audit and reporting
- exposes no undocumented public mutation endpoint

Scheduler and request-time guards must call the same internal finalization command. Sprint 6 adds no
separate public No-show mutation endpoint. The command must be directly testable using an injected
`Clock`.

### 4.3 Organizer Attendance monitoring and correction

Implement Organizer endpoints for:

- Activity participation/Attendance summary
- paginated Participant registration and Attendance rows
- approved filters and stable sorting
- correction/override command with required reason
- append-only `attendance_adjustments` audit history
- authorization against Organizer ownership of the parent Event

Every correction must record actor, before state, after state, reason and timestamp. Corrections do
not overwrite or delete prior adjustment history.

### 4.4 Activity lifecycle and impact propagation

Developer B owns the Activity side of publish/change/cancellation/completion integration:

- apply registration transitions required by Activity cancellation
- retain registrations when an approved schedule change requires retention
- invoke the shared notification writer for impacted Participants
- coordinate completion with Developer C's Certificate service
- prevent completion before its documented lifecycle boundary
- keep Partner and Organizer views consistent with the Activity source of truth
- make repeated lifecycle commands safe and free of duplicate downstream records

### 4.5 Primary acceptance-criteria ownership

Developer B is the primary owner of these 27 criteria:

- `P03-02` through `P03-09`
- `O06-S6-01` through `O06-S6-09`
- `O07-01` through `O07-10`

### 4.6 Developer B completion gate

Developer B is complete only when:

- scan-boundary tests cover immediately before, at and after each approved window boundary
- concurrent scan tests create at most one Attendance
- no-show finalization is repeatable without duplicate state changes
- Organizer cross-Event access is denied and tested
- every correction produces an immutable audit row
- Activity change/cancellation/completion propagation is transactionally tested
- all 27 primary criteria have traceable automated or explicitly documented manual evidence

## 5. Developer C — Certificate, Rating, notifications and frontend integration owner

Developer C owns Flow C backend modules and is the sole owner of Sprint 6 frontend API-adapter and
screen integration. Backend work may begin on the approved contract, but integration merges follow
the dependency order in section 7.

### 5.1 Certificate module

Implement Certificate behavior exactly as approved:

- issue only for an eligible attended registration after Activity completion
- create once and return the same Certificate on retries
- validate Participant ownership for lookup/download
- render/download through the approved content contract
- revoke or suppress eligibility only through documented lifecycle/correction rules
- never use Participant page opening as an uncontrolled duplicate-creation trigger

Developer B calls the Certificate command boundary during Activity completion. Developer C owns
that boundary and its idempotency.

### 5.2 Activity Rating module

Implement:

- create/update the authenticated Participant's Activity Rating
- eligibility based on approved Attendance and Activity-completion rules
- one logical Rating per Participant registration/Activity
- range, text-length and lifecycle validation
- public aggregate updates without exposing reviewer identity
- cancellation/correction consequences defined by the contract

### 5.3 Participant notification query API

Using Developer A's persistence/writer foundation, implement:

- notification list with approved filters/pagination/sort
- unread count
- mark-one-read
- mark-all-read for the authenticated Participant's unread rows
- Participant ownership enforcement
- idempotent read operations

Developer C also owns Certificate-related notification producers. Developer A owns Event-impact
producers; Developer B owns Activity/Attendance-impact producers.

### 5.4 Frontend integration ownership

Developer C owns the final integration of approved routes into frontend services and screens:

- replace phantom public Activity calls with canonical public Activity endpoints
- Participant Event registration and cancellation controls
- Participant Activity registration and cancellation controls
- separate My Events and My Activities states without ambiguous labels
- Activity scan UI with explicit early, success, repeated, invalid, late and closed outcomes
- Certificate view/download and Rating form states
- Participant notification list/unread/read behavior
- Organizer Attendance monitoring and audited correction UI
- lifecycle-aware disabled/hidden actions with a visible explanation
- loading, empty, validation, conflict, forbidden and retry states

Frontend must display backend error codes in user-friendly Vietnamese without treating localized
message text as program logic. A successful command must invalidate/refetch all affected lists and
details so Partner, Participant and Organizer views converge on the same server state.

### 5.5 Primary acceptance-criteria ownership

Developer C is the primary owner of these 9 backend criteria plus all Sprint 6 frontend integration
and closure evidence:

- `P03-10` through `P03-12`
- `P04-01` through `P04-06`

The lower criterion count is intentional: Certificate rendering, notifications, Rating aggregation,
cross-role frontend integration and end-to-end verification are assigned to Developer C.

### 5.6 Developer C completion gate

Developer C is complete only when:

- completion/retry produces exactly one Certificate
- ineligible Participants cannot view/download another Participant's Certificate
- Rating eligibility, uniqueness and public aggregation are tested
- notification ownership and unread counters are tested
- all Sprint 6 UI paths use approved endpoints with no mock/fallback production data
- refresh after each mutation shows the same authoritative state across roles
- all 9 primary criteria and frontend requirements have traceable evidence

## 6. Cross-developer integration contracts

### 6.1 Notification responsibility split

- Developer A: table/entity/repository, deduplication primitive and Event-impact producers.
- Developer B: Activity, Attendance and correction-impact producers.
- Developer C: Certificate-impact producers and all notification read-state/query endpoints.

All producers use deterministic deduplication keys. No developer inserts notification rows directly
outside the shared writer.

### 6.2 Completion-to-Certificate boundary

- Developer B owns Activity completion transaction orchestration.
- Developer C owns the idempotent Certificate issuance command.
- Developer C's internal Certificate/Rating/Notification cascade boundary must merge before
  Developer B merges completion or Attendance-correction orchestration that calls it.
- The boundary must return an existing Certificate for an already-issued eligible registration.
- Partial completion that marks the Activity completed but loses required Certificates is not an
  acceptable outcome.

### 6.3 Event/Activity cancellation boundary

- Developer A owns Event-level registration cascade.
- Developer B owns Activity-level registration/Attendance cascade.
- Developer C owns Certificate/Rating consequences and affected UI refresh behavior.
- No cascade hard-deletes history.

### 6.4 Frontend handoff package

Before Developer C integrates an endpoint, its backend owner supplies:

- final OpenAPI operation and DTO examples
- success example
- validation example
- conflict/lifecycle example
- forbidden/ownership example
- any cache invalidation relationships

## 7. Mandatory delivery and merge order

Do not merge around an unmet earlier gate.

1. **S6-0 — Documentation baseline**
   - Sprint brief, requirements, use cases, physical ERD, API contract and this assignment.
   - Activate Sprint 6 in `CURRENT_SPRINT.md` only after Project Owner review.
2. **S6-1 — Database and shared foundation (Developer A)**
   - `V10`, schema tests, shared enums/entities/repositories and notification writer foundation.
3. **S6-2 — Public Activity debt and Flow A backend (Developer A)**
   - canonical public Activity plus Event/Activity registration APIs and tests.
4. **S6-3 — Flow A frontend integration (Developer C)**
   - public Activity and Participant registration screens against merged APIs.
5. **S6-4 — Flow B downstream command foundation (Developer C)**
   - internal Certificate issue/revoke, Rating invalidate/restore and Certificate-notification
     commands required for atomic completion and Attendance correction; no Flow C actor API yet.
6. **S6-5 — Flow B backend (Developer B, with Developer A Event integration)**
   - scan, no-show, Organizer monitoring/correction and lifecycle propagation using the merged
     downstream command boundary.
7. **S6-6 — Flow B frontend integration (Developer C)**
   - Participant scan and Organizer Attendance operations.
8. **S6-7 — Flow C backend (Developer C)**
   - Certificate, Rating and notification query/read APIs.
9. **S6-8 — Flow C frontend and cross-role regression (Developer C)**
   - Certificate, Rating, notifications and state-consistency refinement.
10. **S6-9 — Closure**
   - full backend/frontend tests, Swagger evidence, migration verification and documentation update.

Each PR must be reviewable independently, keep unrelated formatting out, and identify its owned AC
IDs. A later PR may not silently repair an earlier PR's missing contract behavior without recording
the defect and adding regression coverage.

## 8. Required automated verification

### 8.1 Migration and persistence

- clean `V1 -> V11` migration
- upgrade `V9 -> V11` migration
- Hibernate schema validation
- foreign-key, unique, check and notification-target constraint tests
- repository tests for all status filters and ownership queries

### 8.2 Registration and capacity

- deadline and lifecycle boundaries using a fixed `Clock`
- duplicate create/cancel/re-register behavior
- Event prerequisite and Activity ownership validation
- final-seat concurrent registration race
- unauthorized and cross-user access

### 8.3 Attendance and correction

- every QR time-window boundary
- wrong, malformed and expired token behavior
- first-scan-wins concurrency and repeated-scan idempotency
- deterministic no-show finalization
- Organizer ownership checks
- immutable correction history and required-reason validation

### 8.4 Certificate, Rating and notifications

- single Certificate under concurrent/repeated completion
- Certificate ownership and eligibility
- Rating create/update/range/lifecycle/ownership
- public aggregate accuracy
- notification deduplication and unread counters
- Event/Activity change and cancellation impact

### 8.5 Controller and security

- public endpoints need no session and expose no protected field
- protected endpoints reject anonymous/wrong-role users
- browser mutations enforce CSRF
- malformed JSON, unknown fields, unsupported filters/sorts and invalid pagination
- documented HTTP status and error-code pairs

### 8.6 Frontend

- TypeScript build and lint
- service adapter unit tests where present
- critical role-based component/page tests
- Playwright happy paths and at least one alternative/error path per Flow A, B and C
- no production fallback to demo/mock data after an API error

## 9. Manual Swagger and browser verification

The closure PR must attach evidence for this ordered smoke flow:

1. Organizer prepares/publishes an eligible Activity and obtains its protected Activity QR token.
2. Public user lists and opens the Activity without seeing the raw token.
3. Participant registers for the Event.
4. Participant registers for the Activity.
5. A second registration/retry proves idempotent or documented conflict behavior.
6. Participant checks My Events and My Activities.
7. Participant scans too early and receives the documented non-success outcome.
8. Participant scans inside the valid window and receives success.
9. Participant repeats the same scan and receives the idempotent outcome.
10. Organizer sees Attendance and its source in the monitoring view.
11. Organizer corrects Attendance with a reason and can see the audit history.
12. Activity is completed; eligible Participant receives exactly one Certificate notification.
13. Participant opens/downloads the Certificate.
14. Participant submits then updates a Rating; the public aggregate changes correctly.
15. Activity schedule/Location change creates one impact notification.
16. Activity or Event cancellation produces the documented registration state and no duplicate
    notification.
17. Cross-Participant and cross-Organizer resource access is rejected.

Use fresh IDs and record request/response examples. Do not put credentials, session cookies, CSRF
tokens or raw QR tokens in committed evidence.

## 10. Pull-request checklist

Every Sprint 6 implementation PR must confirm:

- [ ] The PR names its Flow, primary owner and acceptance-criteria IDs.
- [ ] No route, DTO, error code or lifecycle rule diverges from the approved API contract.
- [ ] No migration `V1` through `V9` was edited.
- [ ] Only Developer A edited `V10`.
- [ ] Ownership/role/CSRF checks are covered where applicable.
- [ ] Server time comes from injected `Clock` in testable business logic.
- [ ] Concurrency/idempotency behavior is tested for commands that can race or retry.
- [ ] Public responses and logs contain no raw Activity QR token.
- [ ] No history is hard-deleted when a status transition is required.
- [ ] Backend tests pass.
- [ ] Frontend build/tests pass when frontend code is touched.
- [ ] OpenAPI examples and Swagger smoke evidence are updated.
- [ ] Documentation is updated if an approved clarification was required.

## 11. Sprint completion gate

Sprint 6 is complete only when all of the following are true:

- all 65 acceptance criteria are traceably covered with no duplicate or unowned criterion
- all 30 approved endpoint headings are implemented or verified as existing-compatible behavior
- all documented alternative and exception paths return the approved status/error code
- the `V1 -> V11` clean and `V9 -> V11` upgrade migration paths pass verification
- Flow A, Flow B and Flow C pass automated and manual end-to-end verification
- Participant and Organizer screens converge after refresh on the same backend state, while
  existing Partner Activity views pass lifecycle-state regression verification
- no raw Activity QR token, credentials or local test data is committed
- `CURRENT_SPRINT.md`, traceability/reporting documents and Sprint status are updated only after the
  evidence above is reviewed

Until that gate passes, Sprint 6 must remain active and must not be marked complete merely because
the happy path works.
