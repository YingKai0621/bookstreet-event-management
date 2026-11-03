# BookStreet AI Context

Last updated: `2026-11-03`

## Current implementation status

- Sprint 1 backend and real frontend integration are complete on `main` through merge commit `34a256e`.
- The foundation and Sprint 1 business-schema pull requests are merged into `main`.
- The current implementation includes immutable Flyway migrations V1 through V15. V6 owns the
  Sprint 2 Booth/Hold schema, V7 owns the Sprint 3 Payment/Assignment schema and V8 owns the
  Sprint 4 Event/BoothRequest cancellation metadata and constraints. V9 owns the Sprint 5
  Location/Activity schema and concurrency constraints. V10 owns the Sprint 6 participation
  schema; V11 adds the configurable Activity Attendance early-scan window; V12 owns the Sprint 7
  BoothVisit, PointTransaction, Badge/UserBadge and `BADGE_UNLOCKED` Notification overlay. V13
  adds the Booth image URL used by the demo/public experience. V14 owns the Sprint 8 General
  Feedback schema. V15 owns the Sprint 9 Heritage schema.
- The user manually verified successful PostgreSQL and Redis-backed Session runtime behavior through Spring Boot and Swagger UI.
- Flyway migration tests cover the immutable migration chain through V15 and the relevant prior
  Sprint upgrade/backfill paths.
- Spring Session uses Redis; authentication does not use JWT or bearer tokens.
- Hibernate uses `ddl-auto: validate`.
- Sprint 1 authentication is implemented with JPA entities, repositories, services, REST controllers and Spring Security configuration.
- Implemented authentication APIs cover account registration, login, logout and the current-account endpoint.
- New self-registered accounts receive only the `PARTICIPANT` role.
- Role-protected Organizer and Partner routes use the authenticated principal and server-side Session.
- `PARTNER`, `ORGANIZER` and `ADMIN` authorities require `email_verified_at` to be present.
- Email verification is implemented with 60-minute single-use tokens, SHA-256 token hashes, post-commit registration delivery, authenticated resend limits and atomic confirmation.
- Email-verification delivery was manually verified with both a local mail catcher and a real SMTP mailbox.
- Sprint 1 Event management is implemented with Organizer-owned Draft creation, listing, detail, update and publication APIs.
- Public Event list defaults to Published/Ongoing Events and supports the approved lifecycle
  filters; public detail preserves Completed/Cancelled links and exposes cancellation metadata.
- Event publication validates completeness, time order, deadlines and non-negative limits, and uses a row lock for concurrent publication.
- Sprint 1 Partner Organization profile creation and update are implemented for the authenticated Partner representative.
- Partner application submission, owned queries and Pending withdrawal are implemented with duplicate and concurrency protection.
- Organizer application listing, detail, approval and rejection enforce Event ownership and lock review transitions.
- Partner and Organizer application list pagination exposes separate `page`, `size` and `sort` query parameters. Unsupported sort fields return `400 INVALID_SORT` instead of reaching JPA as a server error.
- Partner integration and concurrency tests cover the Sprint 1 application workflow.
- `AuthenticatedPrincipal` is the shared session-identity boundary used by feature modules; Auth no longer depends on Event security code.
- Role-based authorization failures use the shared `ACCESS_DENIED` response; resource ownership remains enforced inside the owning feature.
- Verified Sprint 1 demo accounts are seeded for the Organizer and Partner roles; their passwords exist in the repository only as BCrypt hashes.
- Swagger/OpenAPI is available for local API exploration.
- Browser security is implemented with an environment-configured CORS allowlist, configurable Session cookie attributes and a public `GET /api/v1/auth/csrf` token endpoint. CSRF remains required for every state-changing browser request.
- GitHub Actions CI runs backend verification, frontend lint/build and an isolated Playwright UI
  regression job for pushes and pull requests targeting `main`. Live-data Playwright tests require
  explicit `E2E_LIVE=true` and do not run merely because local credentials exist.
- GitHub Actions runs `mvn verify` with PostgreSQL 17.11 and Redis. Automated coverage includes
  migrations, Event and Activity lifecycles, ownership, lock ordering, Partner/Booth/Activity
  races, VNPay reconciliation, participation, Attendance, Certificate, Rating and notification
  behavior. Exact test totals are intentionally not frozen in this context file because the suite
  changes during Sprint closure.
- Organizer Event and Partner application Playwright flows are present for the real frontend/backend integration.
- The focused Sprint 5 Partner/Organizer Activity Playwright suite has 9 passing scenarios.
- Sprint 2 backend Booth selection, price-locked BoothHold and Hold expiry are implemented through
  V6.
- Sprint 3 Payment and Assignment backend and frontend integration are implemented through V7.
  Automated browser-level Playwright payment/assignment E2E remains tracked technical debt.
- Sprint 4 Event lifecycle hardening and pre-payment Booth release are complete through V8. All 23
  Sprint 4 Acceptance Criteria have implementation and automated coverage; required Swagger smoke
  flows were manually accepted on 2026-10-16.
- Sprint 5 Activity Planning and Partner Proposal Workflow is complete on `main` through PR #56
  (merge commit `759a25c`). Its V9 migration, backend APIs/services, Partner and Organizer
  workspaces, public Activity discovery and automated coverage are implemented.
- The delivered Sprint 5 scope covers shared Activity Locations, Partner Proposal review, official
  Activity lifecycle, Partner change/cancellation requests and public Activity discovery.
  Participant registration/attendance/rating/certificate commands remain out of Sprint 5 and are
  delivered in the completed Sprint 6 scope.
- Sprint 6 Participant Activity Registration and Attendance is complete. Its approved
  baseline contains 65 Acceptance Criteria and 30 canonical endpoint headings, including the
  2026-10-27 owner-only Notification bulk-read amendment. The core backend, V10/V11 migrations and
  Participant/Organizer frontend workflows are implemented on `main` through PR #83 (merge commit
  `32e8121`). Delivered slices include Event and Activity registration, shared Activity Attendance
  QR self-scan, Attendance lifecycle and cascade, Certificate issuance/list/detail, Activity
  Rating, Participant notification inbox and Organizer participation monitoring with audited
  Attendance correction.
- The API/frontend reconciliation work through PR #83 removed unsupported Organizer/Partner
  workspace network calls, wired the approved Organizer Event lifecycle/profile flows, aligned the
  Participant registration schedule format and synchronized the selected public Event across
  Event, Booth and map browsing. The implemented
  `POST /participant/notifications/read-all` command is now an approved owner-only, idempotent
  extension rather than contract drift.
- Sprint 6 closure evidence is recorded in `docs/development/SPRINT_06_COMPLETION_REPORT.md`: all
  65 AC are traceably mapped, the PostgreSQL-backed backend run passed 566/566 with no skips, the
  focused Sprint 6 browser run passed 44/44, and lint/build plus migration paths are green.
- Sprint 7 Booth Visit, Points and Badge Progression was activated on 2026-10-28. PR #86 (merge
  commit `27a88e8`) approved and merged its current-state audit, product baseline, 41-AC Use Case
  Specification, 12-endpoint API Contract plus four Notification extensions, and vertical-slice
  three-developer work assignment. PR #92 (merge commit `2178ba6`) implemented V12, the shared
  reward/Notification foundation, Participant Booth scan, Partner QR display, Participant Rewards
  reads/UI and Badge Notification support. PR #93 (merge commit `1b95584`) implemented Organizer
  BoothVisit monitoring plus Admin Badge CRUD and bounded award synchronization. PR #95 (merge
  commit `573f15a`) added Participant reward/Badge Notification integration coverage, Certificate
  PDF font hardening and the final frontend consistency fixes. The physical phone-on-LAN flow
  passed during the 2026-10-30 classroom demo, Sprint 7 is completed, and PR #98 subsequently
  added V13/demo public-experience improvements without changing the reward contract.
- Sprint 7 implementation ownership is vertical: Developer A owns V12/reward writes plus Booth
  scan/Partner QR UI; Developer B owns Organizer monitoring and Admin Badge/backfill APIs plus UI;
  Developer C owns Participant reward reads/UI and integration closure.
- Sprint 8 General Feedback Submission and Organizer Handling was activated on 2026-10-31. PR #100
  (merge commit `a6f070c`) approved and merged the current-state audit, product baseline, Physical
  ERD overlay, 28-AC Use Case Specification, six-operation API Contract, one-developer
  Implementation Plan and clean documentation audit. PR #102 (merge commit `8384fe9`) delivered
  V14, the public API, bounded process-local throttle and Landing Page integration. PR #103 (merge
  commit `071b97a`) delivered the shared Organizer queue, detail, legal transitions and UI states.
  Sprint 8 completed on 2026-11-01 with all 28 Acceptance Criteria traceably covered.
- Sprint 8 delivers only `BOOK_STREET` and `EVENT` General Feedback. It uses one shared Organizer
  queue, the `NEW -> IN_PROGRESS -> RESOLVED` lifecycle with reopen, one-way Guest communication
  and a bounded process-local public-submission throttle. Redis remains dedicated to Session
  storage and General Feedback has no rating/score.
- Sprint 9 Heritage Public Content completed on 2026-11-01. PR #105 (merge commit `7e46809`)
  approved its documentation baseline. PR #107 (merge commit `7ed4e0e`) delivered V15, the
  PostgreSQL-backed Heritage domain, thirteen approved API operations, the real public
  list/detail experience, shared Organizer management and focused automated coverage for all
  28 Acceptance Criteria.
- Sprint 9 delivers one shared Organizer-managed Heritage collection plus public reads for
  published content. Its statuses are exactly `DRAFT`, `PUBLISHED` and `ARCHIVED`. Heritage remains
  independent from General Feedback and is not a Feedback target.
- Sprint 10 Role-Scoped In-App Notifications was activated on 2026-11-03 after PR #116 (merge commit
  `3a0a76b`) approved its 52-Acceptance-Criteria baseline, Use Case Specifications, 16-operation API
  Contract, Physical ERD overlay, implementation plan and three-developer ownership model.
- Sprint 10 keeps the existing `notifications` table as the only durable inbox store. It preserves the
  six Participant types, adds only the approved Partner outcome and Organizer work-item families, and
  provides Admin with real role-isolated list/read infrastructure but no type or producer.
- Developer A is `YingKai0621` and exclusively owns the shared Notification foundation, Participant/Admin
  integration and reserved migration V16. Developer B and Developer C are stable work-package labels;
  teammates claim and coordinate the documented Partner or Organizer role before starting its branch.
- V16 is reserved but not implemented. The applied database baseline remains immutable V1 through V15
  until the foundation PR is reviewed and merged.
- The Project Owner exclusively owns the Heritage Flyway migration SQL after reserving the next
  free version. One assigned Heritage Owner consumes that migration and owns the entity,
  repository, APIs, public and Organizer UI, focused tests and evidence for all 28 Acceptance
  Criteria.
- Sprint 5 Activity invariants: Proposal Pending does not reserve a slot; approval atomically
  creates one Draft Activity; every non-cancelled official Activity conflicts by physical Location
  and half-open interval across Events; one Pending Activity request exists across change and
  cancellation types; direct Organizer Activity cannot commandeer a Booth.
- Current MVP policy does not permit Booth change/cancellation after Assignment, whole-Event
  Partner withdrawal after approval or business-refund execution. Those designs are retained only
  as post-MVP references.
- Sprint 2 keeps `boothPaymentWindowMinutes` in the existing Event record, constrains it to `60..10080` minutes inclusive and defaults a new Event to `1440` minutes (24 hours).
- Selection persists `expiresAt = selectedAt + boothPaymentWindowMinutes`; a later permitted Event setting change applies only to future selections and never rewrites an existing Hold.
- Selection email is a post-commit side effect. Email failure is logged and must not roll back the selected request or Hold; Sprint 2 does not add an outbox or notification table.
- Sprint 2 uses a simple public/Partner Booth grid. Advanced drag-and-drop map editing remains out of scope.
- Sprint 3 uses VNPay Sandbox with `vnp_TxnRef = BSP{boothPaymentId}`, verified Return/IPN/QueryDR,
  a bounded two-query rule for raw `01`, and one atomic Assignment after trusted success.
- VNPay PAY checkout creation is local HMAC signing. The Payment and complete checkout URL/expiry
  commit atomically; known signing failure commits the attempt as `FAILED` before returning 502.
- Initial-payment status `02` is the only safe generic VNPay terminal-failure mapping. Status `04`
  may follow a debit/reversal; `04`, `07`, `09` and unknown combinations remain `PENDING` for
  reconciliation and cannot enable an unsafe retry.
- Verified success contradicting a terminal local Payment is retained with
  `reconciliationRequired=true` and blocks new attempts until manual resolution.
- Reconciliation claims `lastGatewayQueryAt` before network I/O, then applies the response in
  another short transaction. The implemented Sprint 4 contract uses the global order `Event →
  Booth (if needed) → EventBoothConfig (if
  needed) → Hold → Payment by ascending id → BoothRequest`. Unknown results retain the Active Hold.
- Zero-price Booths bypass VNPay and settle atomically during Organizer selection. Positive Booth
  prices below 5,000 VND are invalid.

## Current database state

`V1__init_auth_schema.sql` creates:

- `users`
- `roles`
- `user_roles`
- `user_tokens`

`V2__seed_system_roles.sql` seeds:

- `PARTICIPANT`
- `PARTNER`
- `ORGANIZER`
- `ADMIN`

`V3__create_sprint1_business_schema.sql` creates:

- `events`
- `partner_organizations`
- `partner_event_applications`

`V4__seed_sprint1_demo_accounts.sql` seeds:

- `organizerdemo` with `PARTICIPANT` and `ORGANIZER`
- `partnerdemo` with `PARTICIPANT` and `PARTNER`

`V5__seed_all_demo_roles.sql`:

- updates the existing Organizer and Partner demo credentials;
- seeds `admindemo` with `PARTICIPANT` and `ADMIN`;
- seeds `participantdemo` with `PARTICIPANT`.

`V6__create_sprint2_booth_schema.sql` creates:

- `locations`
- `booths`
- `event_booth_configs`
- `booth_requests`
- `booth_holds`

`V7__create_sprint3_payment_assignment_schema.sql` creates:

- `booth_payments`
- `booth_assignments`
- the checkout recovery, QueryDR evidence and reconciliation fields/indexes required by Sprint 3

`V8__add_event_and_booth_request_cancellation_metadata.sql`:

- adds `events.cancelled_at` and `events.cancellation_reason` with consistent status constraints;
- backfills legacy Cancelled Event metadata before enforcing the constraints;
- adds BoothRequest `CANCELLED` support and `cancelled_at` consistency constraints.

`V9__create_sprint5_activity_schema.sql` implements:

- extends `locations` type/code constraints for BOOTH/STAGE/WORKSHOP/AREA;
- creates `activity_proposals`, `activities`, a unified physical `activity_requests` table and
  immutable `activity_revisions` audit snapshots;
- uses the unified request table plus a partial unique index for one Pending Change/Cancellation
  request per Activity;
- enables `btree_gist` and adds a cross-Event half-open Location/time exclusion constraint for
  every non-cancelled official Activity;
- prepares registration/certificate/Attendance-QR configuration without implementing Participant
  registration or scan commands.

`V10__create_sprint6_participation_schema.sql` creates:

- `event_registrations`
- `activity_registrations`
- `attendances`
- `attendance_adjustments`
- `certificates`
- `activity_ratings`
- `notifications`

`V11__activity_attendance_early_scan_minutes.sql`:

- adds `activities.attendance_early_scan_minutes`;
- defaults the early-scan window to 15 minutes and constrains it to `0..1440` minutes.

`V12__create_sprint7_reward_schema.sql` is the implemented Sprint 7 migration. It creates
BoothVisit, PointTransaction, Badge and UserBadge persistence and adds the smallest compatible
`BADGE_UNLOCKED` Notification extension.

`V13__add_booth_image_url.sql` adds the optional Booth image URL used by the current public/demo
experience.

`V14__create_sprint8_general_feedback_schema.sql` creates `general_feedbacks` with exact
`BOOK_STREET`/`EVENT` target constraints, workflow metadata and Organizer queue indexes. V1
through V14 are now immutable.

`V15__create_sprint9_heritage_content_schema.sql` creates `heritage_contents` with the approved
11-column shape, exact Draft/Published/Archived lifecycle constraints and public/Organizer query
indexes. V1 through V15 are now immutable.

## Not yet implemented

- Forgot/Reset Password
- Automated browser-level Playwright payment/assignment E2E
- Post-MVP refund execution, Booth change/cancellation and Partner Event withdrawal
- Production VNPay credentials and deployment webhook configuration
- Frontend lint-warning cleanup and production bundle splitting
- General Feedback reporting and map data
- Notification behavior outside the approved Sprint 10 type/reference/producer matrices, including any
  Admin producer, combined inbox, composer, polling or real-time delivery

## Next implementation task

- Merge the Sprint 10 activation/context update before application implementation.
- Developer A then updates from `main`, reconfirms exclusive ownership of reserved V16 and implements only
  PR 1: role-scoped persistence, shared backend APIs/security/read concurrency, Participant compatibility
  and real producer-free Admin foundation.
- Before Partner PR 2 or Organizer PR 3 begins, each teammate claims the corresponding Developer B or C
  role and follows its documented scope, shared-file boundaries, Acceptance Criteria and merge order.
- The BR-81 exact-deadline equality discrepancy must be resolved separately before Organizer Booth
  re-selection implementation; it does not block the shared PR 1 foundation.
- General Feedback targets remain permanently limited to `BOOK_STREET` and `EVENT`; Heritage remains
  independent and creates no Notification broadcast.

## Latest completed Sprint

Sprint 09 Heritage Public Content is the latest completed Sprint as of 2026-11-01.

Sprint 10 Role-Scoped In-App Notifications is the active Sprint as of 2026-11-03. It is not yet complete
and has no applied migration or implementation merge.

Sprint 8 includes these approved Use Case slices:

- `UC-G04` public General Feedback submission for `BOOK_STREET` and `EVENT`
- shared Organizer General Feedback queue and detail
- explicit start, resolve and reopen workflow actions
- real Landing Page and Organizer portal integration

Sprint 9 includes these completed Use Case slices:

- `UC-G01` public Heritage list and detail for published content
- `UC-O09` shared Organizer Heritage management
- exact Draft, Published and Archived lifecycle with optimistic concurrency
- real public and Organizer Heritage frontend integration

## Current approved baselines

- Requirement baseline: active MVP rules plus completed Sprint 7 reward, completed Sprint 8 General
  Feedback, completed Sprint 9 Heritage and active Sprint 10 role-scoped Notification decisions
- Use Case Diagram: V2, with Post-MVP ovals explicitly labelled
- Conceptual ERD: Baseline 2.1
- Logical ERD: v8 plus approved Sprint 6 Participant, Sprint 7 reward and Sprint 8 General Feedback
  interpretations
- Physical implementation source: immutable Flyway V1–V15. V10 implements the Sprint 6
  participation overlay, V11 adds the Activity early-scan configuration and V12 implements the
  approved Sprint 7 reward/Notification overlay. V13 adds the Booth image URL and V14 implements
  the Sprint 8 General Feedback overlay. V15 applies the Sprint 9 Heritage overlay.
- Active Sprint baseline: `docs/sprints/sprint-10.md`
- Active Sprint Use Cases: `docs/use-cases/sprint-10-use-case-specifications.md`
- Active Sprint API Contract: `docs/api/sprint-10-api-contract.md`
- Active Sprint Physical ERD overlay:
  `docs/design/SPRINT_10_ROLE_NOTIFICATIONS_PHYSICAL_ERD_OVERLAY.md`
- Active Sprint implementation plan: `docs/sprints/SPRINT_10_IMPLEMENTATION_PLAN.md`
- Active Sprint assignment: `docs/sprints/SPRINT_10_TEAM_ASSIGNMENT.md`
- Latest completed Sprint remains Sprint 9 with closure evidence in
  `docs/development/SPRINT_09_CLOSURE_REPORT.md`
- Active MVP Use Case count: 26

Do not use the old Use Case Diagram V1, an earlier ERD or an old target PNG as an implementation source.
Use immutable V1–V15 and the current Physical ERD report as current physical truth. For Sprint 10 use the
active Sprint 10 baseline, Use Case Specifications, API Contract and approved overlay; V16 remains a
reserved target until its implementation PR merges.

## Authentication baseline

- Authentication uses a Spring Security server-side Session stored in Redis.
- Authentication does not use JWT, bearer access tokens, refresh tokens or `/auth/refresh`.
- The `user_tokens` table stores email-verification token hashes and remains reserved for the future password-reset flow.
- The approved email-verification extension uses the existing `users.email_verified_at` and `user_tokens` schema; it requires no new migration.
- Verification does not grant roles. Existing Sessions are not silently elevated; eligible advanced authorities take effect after re-login.
- Email-verification endpoints, token policy and acceptance criteria are defined in `docs/use-cases/email-verification-use-case-specification.md` and `docs/api/email-verification-api-contract.md`.
- The frontend/backend cookie, CORS and CSRF contract is defined in `docs/api/browser-security-contract.md`.
- Forgot/Reset Password remains unimplemented and is not assigned to an active Sprint.

## Sprint 4 scope guard

Sprint 4 excludes:

- Business refund execution
- Booth change or cancellation after Assignment
- Partner withdrawal from the whole Event after approval
- Event cancellation after any Payment `PENDING`/`SUCCESS`, reconciliation-required evidence or
  any Assignment
- Cancellation of an Ongoing or Completed Event
- Admin emergency cancellation
- Activity, attendance, reward and reporting implementation
