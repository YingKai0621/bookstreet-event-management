# Current Sprint

## Sprint 06 Participant Activity Registration and Attendance

- Status: `ACTIVE — IMPLEMENTATION AUTHORIZED WITHIN APPROVED BASELINE`
- Activation date: `2026-10-19`
- Previous completed Sprint: `Sprint 05 Activity Planning and Partner Proposal Workflow`
- Implemented schema baseline: immutable Flyway migrations `V1` through `V11`
- Sprint 6 migrations: `V10` participation schema and `V11` configurable Attendance early-scan
  window, both already implemented
- Sprint baseline: `docs/sprints/sprint-06.md`
- Use Case Specifications: `docs/use-cases/sprint-06-use-case-specifications.md`
- API Contract: `docs/api/sprint-06-api-contract.md`
- Physical ERD: `docs/design/12_Physical_ERD_Report.md`
- Backend Work Assignment: `docs/sprints/SPRINT_06_BACKEND_WORK_ASSIGNMENT.md`

## Sprint goal

Connect the official Activity planning delivered in Sprint 5 to the Participant journey:

1. Join/Leave Event and manage My Events.
2. Register, cancel and re-register capacity-controlled Activities.
3. Self-scan the shared Activity QR within the authoritative Attendance window.
4. Finalize No-show, issue/revoke Certificate and preserve audited Organizer correction history.
5. Submit or update one eligible Activity Rating.
6. Deliver durable, deduplicated in-app notifications for the approved participation impacts.
7. Integrate real Participant and Organizer screens without phantom endpoints or mock fallbacks.

## Scope and acceptance baseline

Implementation is limited to the eight approved Use Case slices:

- `UC-G01` public Activity discovery debt
- `UC-P01` Event participation
- `UC-P02` Activity registration
- `UC-P03` participation tracking, notification and Certificate slice
- `UC-P04` Activity Rating
- `UC-O01` Sprint 6 Event update/cancellation slice
- `UC-O06` Sprint 6 Activity lifecycle/cascade slice
- `UC-O07` participation monitoring and audited correction

The active baseline contains **65 Acceptance Criteria** and **30 canonical endpoint headings**.
Every implementation PR must identify its owned AC IDs and use the exact route, DTO, error-code,
ownership, lifecycle and idempotency behavior in the approved API Contract.

## Ownership

- **Developer A:** sole Sprint 6 migration owner (`V10` and `V11`); shared schema/persistence
  foundation; canonical public Activity; Event/Activity registration; Event update-freeze and
  cancellation propagation. Primary owner of 29 AC.
- **Developer B:** Activity QR Attendance, No-show, Organizer monitoring/correction and Activity
  lifecycle propagation. Primary owner of 27 AC.
- **Developer C:** Certificate, Rating, notification query/read operations, downstream cascade
  commands and all Sprint 6 Participant/Organizer frontend integration. Primary owner of 9 backend
  AC plus frontend and end-to-end closure evidence.

Only Developer A may create or edit the Sprint 6 `V10`/`V11` migrations. Migrations `V1` through
`V9` are immutable.

## Mandatory delivery order

1. `S6-1` — Developer A: `V10`/`V11`, migration verification and shared persistence foundation.
2. `S6-2` — Developer A: canonical public Activity and Flow A registration backend.
3. `S6-3` — Developer C: Flow A frontend integration.
4. `S6-4` — Developer C: internal Certificate/Rating/Notification cascade commands required by
   atomic completion and Attendance correction; no Flow C actor API yet.
5. `S6-5` — Developer B with Developer A Event integration: Flow B backend.
6. `S6-6` — Developer C: Flow B frontend integration.
7. `S6-7` — Developer C: Flow C actor/query backend APIs.
8. `S6-8` — Developer C: Flow C frontend and cross-role regression.
9. `S6-9` — full migration, concurrency, security, Swagger/browser and regression closure.

Do not merge around an unmet earlier gate. The detailed handoff rules and completion checks are in
`SPRINT_06_BACKEND_WORK_ASSIGNMENT.md`.

## Non-negotiable implementation rules

- PostgreSQL is the durable source of truth; Redis stores Session only.
- Use the existing Spring Security Session and CSRF model; do not introduce JWT.
- Backend `Clock` decides every deadline, scan window, completion and No-show boundary.
- Capacity, scan, completion and correction races require the approved Event-rooted lock order.
- Public, Partner and Participant responses never expose the raw Activity QR token.
- Participant identity comes from the authenticated Session, never a caller-selected user ID.
- Correction history is append-only; cancellation and correction never hard-delete participation
  evidence.
- Notifications are in-app, owner-only and deduplicated. Sprint 6 supports list, unread count,
  mark-one-read and owner-only idempotent mark-all-read; it does not add a generic notification
  composer.
- Participant and Organizer UI must use real approved endpoints and must not fall back to demo data
  after an API error.

## Explicitly out of scope

- Event QR or Participant-specific QR
- BoothVisit, points, badges and cross-Event loyalty
- paid Activity tickets, waitlist, seat transfer or resale
- Attendance Operator, check-out, GPS, face recognition or device fingerprinting
- generic announcements, notification preferences, SMS/push or transactional outbox
- public Certificate verification and bulk Certificate export
- migration rewrites or unapproved compatibility endpoints

## Completion gate

Sprint 6 remains active until all 65 AC are traceably verified, the migration chain passes both
clean `V1 -> V11` and upgrade `V9 -> V11`, backend/frontend automated checks pass, Swagger/browser
role flows pass and the Sprint 6 completion report records delivered scope and remaining debt. A
working happy path is not sufficient to mark the Sprint complete.
