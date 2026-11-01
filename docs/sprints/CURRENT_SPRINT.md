# Current Sprint

## Sprint 08 General Feedback Submission and Organizer Handling

- Status: `COMPLETED`
- Activation date: `2026-10-31`
- Completion date: `2026-11-01`
- Latest completed Sprint: `Sprint 08 General Feedback Submission and Organizer Handling`
- Implemented schema baseline: immutable Flyway migrations `V1` through `V14`
- Implemented Sprint 8 migration: `V14__create_sprint8_general_feedback_schema.sql`
- Sprint baseline: `docs/sprints/sprint-08.md`
- Current-state audit: `docs/development/SPRINT_08_CURRENT_STATE_AUDIT.md`
- Documentation audit: `docs/development/SPRINT_08_DOCUMENTATION_AUDIT.md`
- Use Case Specifications: `docs/use-cases/sprint-08-use-case-specifications.md`
- API Contract: `docs/api/sprint-08-api-contract.md`
- Physical ERD source: `docs/design/12_Physical_ERD_Report.md` plus
  `docs/design/SPRINT_08_GENERAL_FEEDBACK_PHYSICAL_ERD_OVERLAY.md`
- Implementation and ownership plan: `docs/sprints/SPRINT_08_IMPLEMENTATION_PLAN.md`
- Sprint 7 closure evidence: `docs/development/SPRINT_07_CLOSURE_REPORT.md`
- Sprint 8 closure evidence: `docs/development/SPRINT_08_CLOSURE_REPORT.md`
- Implementation merges: PR #102 (`8384fe9`) and PR #103 (`071b97a`)

## Sprint goal

Deliver General Feedback as one coherent PostgreSQL-backed vertical slice:

1. A Guest submits one-way Feedback for the whole Book Street or an eligible public Event.
2. Optional Guest name/email and the required message are normalized without collecting a phone
   number or satisfaction score.
3. A valid authenticated Session may associate the current User without accepting caller-selected
   identity.
4. Every verified Organizer sees the same Management Board queue across the Book Street and all
   Events.
5. Organizer handling uses explicit `NEW -> IN_PROGRESS -> RESOLVED` transitions with the approved
   reopen path and internal note behavior.
6. The existing Landing Page and Organizer Feedback surfaces use the real API without mock success,
   placeholder rows or Guest-reply wording.
7. Existing Event ownership, Activity Rating, Session/CSRF and Sprint 7 reward behavior remain
   unchanged.

## Scope and acceptance baseline

The delivered implementation is limited to:

- the `BOOK_STREET` and `EVENT` branches of `UC-G04 Submit General Feedback`;
- the bounded Organizer handling extension for the same General Feedback workflow;
- one `general_feedbacks` table and its exact constraints/indexes;
- public CSRF-protected submission with a bounded process-local abuse throttle;
- one shared Organizer queue, detail and three explicit workflow actions;
- real Landing Page and Organizer portal integration;
- focused migration, backend, frontend and browser verification.

The completed baseline contains **28 Acceptance Criteria**:

- 12 Guest/Public criteria: `AC-G04-S8-01` through `AC-G04-S8-12`;
- 12 Organizer criteria: `AC-O-S8-01` through `AC-O-S8-12`;
- 4 schema/regression criteria: `AC-X-S8-01` through `AC-X-S8-04`.

The API Contract defines exactly six operations: one public create, two Organizer reads and three
Organizer transitions. The implementation PRs identify their owned AC IDs and preserve the
approved route, DTO, error, authorization, transaction, privacy and throttle contract.

## Ownership

One assigned **Sprint 08 General Feedback Owner** owned the complete vertical slice, including:

- the single Sprint 8 migration and General Feedback persistence model;
- backend Feedback service, security/CSRF and process-local throttle integration;
- public submission and Organizer query/transition APIs;
- Landing Page and Organizer Feedback UI integration;
- focused tests and closure evidence.

Reviewers reviewed without creating a competing migration, throttle, entity or transition
implementation. The owner started from updated `main` on dedicated feature branches.

## Delivery record

1. `S8-1 Public vertical slice and foundation` — recheck migration availability, create the
   migration/persistence model, implement the public CSRF/throttle boundary, public create API,
   Landing Page integration and focused public/schema tests.
2. `S8-2 Organizer vertical slice` — implement the shared queue/detail/transitions, wire the
   existing Organizer Feedback screen and add focused authorization/concurrency tests.
3. `S8-3 Verification and closure` — run focused browser and affected regression checks, perform
   real-API smoke, then update the applied Physical ERD/context and closure evidence.

These units were delivered sequentially. No migration or application implementation was added to
the Sprint activation branch.

## Non-negotiable implementation rules

- PostgreSQL is durable truth; Redis stores server-side Session only.
- Authentication remains Spring Security Session with HttpOnly cookie; do not introduce JWT.
- Hibernate remains `ddl-auto: validate`. V1 through V14 are immutable.
- Any later schema change requires a new Flyway migration after the next version is rechecked.
- General Feedback targets are only `BOOK_STREET` and `EVENT`. `HERITAGE` is excluded from the
  current business baseline and is not a future Feedback target.
- General Feedback has no score/rating and does not change completed Activity Rating behavior.
- Public submission is `permitAll` but remains CSRF-protected.
- The abuse throttle is bounded process-local volatile state: 10 counted attempts per client key
  in 600 seconds and at most 5,000 active windows. Redis is not used for throttle counters.
- Every verified Organizer shares the Feedback queue, but Feedback access never widens Event
  mutation ownership.
- Statuses are exactly `NEW`, `IN_PROGRESS` and `RESOLVED`; viewing never changes status.
- Resolve requires an internal note; no processing result is sent to the Guest.
- Do not commit `.env`, credentials, HMAC secrets, local IPs, contact data or demo Feedback.

## Explicitly out of scope

- Heritage, Location, Booth, Facility or Activity General Feedback targets
- General Feedback rating, phone number, attachment or arbitrary custom fields
- Guest reply, status lookup, email, SMS, push or Notification delivery
- Feedback hard delete, edit-after-submit or public list/detail
- transition-history table
- reports, statistics, dashboards or Admin Feedback API/UI
- CAPTCHA, third-party moderation or distributed throttling
- unrelated frontend refactors or changes to completed Sprint 1–7 behavior

## Completion result

The Project Owner approved and merged the Sprint 8 current-state audit, baseline, Physical ERD
overlay, 28-AC Use Case Specification, six-operation API Contract, one-developer Implementation
Plan and clean documentation audit through PR #100 (merge commit `a6f070c`). The activation check
on `2026-10-31` confirmed that the repository contains immutable migrations V1 through V13 and no
V14 file yet.

The public vertical slice and schema were implemented through PR #102. The shared Organizer queue,
detail, legal transitions and UI states were implemented through PR #103. Flyway V14 is now an
immutable applied migration. Focused migration, backend and browser verification plus the affected
frontend build checks are recorded in the Sprint 8 closure report.

Sprint 8 is closed. No Sprint 9 baseline is active yet, so new feature implementation must wait for
an approved Sprint baseline instead of extending Sprint 8 implicitly.
