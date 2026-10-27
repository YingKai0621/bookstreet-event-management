# BookStreet AI Context

Last updated: `2026-10-27`

## Current implementation status

- Sprint 1 backend and real frontend integration are complete on `main` through merge commit `34a256e`.
- The foundation and Sprint 1 business-schema pull requests are merged into `main`.
- The current implementation includes immutable Flyway migrations V1 through V11. V6 owns the
  Sprint 2 Booth/Hold schema, V7 owns the Sprint 3 Payment/Assignment schema and V8 owns the
  Sprint 4 Event/BoothRequest cancellation metadata and constraints. V9 owns the Sprint 5
  Location/Activity schema and concurrency constraints. V10 owns the Sprint 6 participation
  schema; V11 adds the configurable Activity Attendance early-scan window.
- The user manually verified successful PostgreSQL and Redis-backed Session runtime behavior through Spring Boot and Swagger UI.
- Flyway migration tests cover the immutable migration chain through V11 and the relevant prior
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
- GitHub Actions CI runs backend verification, including PostgreSQL-backed Event and Partner integration tests, and frontend lint/build for pushes and pull requests targeting `main`.
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
  now the approved active Sprint 6 scope.
- Sprint 6 Participant Activity Registration and Attendance remains the active Sprint. Its approved
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
- Sprint 6 is not yet formally closed. Implementation scope is substantially complete, but the
  full 65-AC traceability record, backend/frontend verification evidence and focused manual demo
  smoke results still need to be recorded before changing the Sprint status to complete.
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

## Not yet implemented

- Forgot/Reset Password
- Automated browser-level Playwright payment/assignment E2E
- Post-MVP refund execution, Booth change/cancellation and Partner Event withdrawal
- Production VNPay credentials and deployment webhook configuration
- Frontend lint-warning cleanup and production bundle splitting
- Formal Sprint 6 closure evidence across all 65 Acceptance Criteria and required manual smoke flows
- General feedback/reporting, points/badges, persisted heritage/map data and notifications for
  Organizer/Partner/Admin remain absent from the approved Sprint 6 backend contract

## Active implementation task

- Formally close Sprint 6 from the reconciled `main` baseline after PR #83 and the approved
  Notification inbox documentation amendment.
- Re-run backend verification and frontend lint/build, then execute focused Participant,
  Organizer, Partner and public demo smoke flows.
- Record implementation/test evidence against all 65 Acceptance Criteria and publish the Sprint 6
  completion report before changing the Sprint status to complete.
- Keep unrelated placeholder Admin/Organizer/Partner/Public modules out of scope; do not create
  backend APIs merely to satisfy unapproved UI concepts.
- Keep the approved Sprint 6 exclusions closed: no Event QR, Participant-specific QR, BoothVisit,
  Points, Badge, generic notification composer or unapproved compatibility route.
- Preserve the Sprint 4 Event-root lock order, unresolved-Payment safety rules, Sprint 5
  Event → Location(s) → Activity/request lock order and approved Sprint 6 Participant lock order.

## Active and latest completed Sprint

Sprint 06 Participant Activity Registration and Attendance is the active implementation Sprint as
of 2026-10-27. Sprint 05 Activity Planning and Partner Proposal Workflow remains the latest
completed Sprint.

Sprint 6 includes these approved Use Case slices:

- UC-G01 public Activity discovery debt
- UC-P01 Event participation
- UC-P02 Activity registration
- UC-P03 participation tracking, notification and Certificate slice
- UC-P04 Activity Rating
- UC-O01 Sprint 6 Event update/cancellation slice
- UC-O06 Sprint 6 Activity lifecycle/cascade slice
- UC-O07 participation monitoring and audited correction

## Current approved baselines

- Requirement baseline: active MVP rules plus approved Sprint 6 Participant refinements
- Use Case Diagram: V2, with Post-MVP ovals explicitly labelled
- Conceptual ERD: Baseline 2.1
- Logical ERD: v8 plus the approved Sprint 6 Participant interpretation in the active Use Cases
- Physical implementation source: immutable Flyway V1–V11. V10 implements the Sprint 6
  participation overlay and V11 adds the Activity early-scan configuration.
- Active MVP Use Case count: 26

Do not use the old Use Case Diagram V1, an earlier ERD or an old target PNG as an implementation
source. Use the active Sprint 6 Physical ERD report and drawio source.

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
