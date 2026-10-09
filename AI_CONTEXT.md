# BookStreet AI Context

Last updated: `2026-10-09`

## Current implementation status

- Sprint 1 backend and real frontend integration are complete on `main` through merge commit `34a256e`.
- The foundation and Sprint 1 business-schema pull requests are merged into `main`.
- The current implementation includes immutable Flyway migrations V1 through V7. V6 owns the
  Sprint 2 Booth/Hold schema; V7 owns the Sprint 3 Payment/Assignment schema.
- The user manually verified successful PostgreSQL and Redis-backed Session runtime behavior through Spring Boot and Swagger UI.
- Flyway migration tests cover clean V1-to-V7 migration and V6-to-V7 upgrade behavior.
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
- Public Event APIs return only Published Events.
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
- The complete backend suite runs 222 tests against PostgreSQL with no failures or errors; 69 tests
  are intentionally skipped by the current test configuration. The executed tests include Sprint 3
  migration, concurrency, reconciliation, ownership and settlement/expiry-race coverage. The
  disposable VNPay spike suite runs 20 tests with no failures.
- Organizer Event and Partner application Playwright flows are present for the real frontend/backend integration.
- Sprint 2 backend Booth selection, price-locked BoothHold and Hold expiry are implemented through
  V6.
- Sprint 3 backend Payment and Assignment are implemented and verified through V7. Frontend
  integration and Playwright payment E2E remain tracked technical debt.
- Sprint 4 documentation is approved for Event lifecycle hardening and pre-payment Booth release;
  implementation and V8 are pending.
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
- Reconciliation currently claims `lastGatewayQueryAt` under the Sprint 3 `Hold → Payment` lock
  before network I/O, then applies the response in another short transaction. Sprint 4 extends
  Event-scoped mutations to the global order `Event → Booth (if needed) → EventBoothConfig (if
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

## Not yet implemented

- Forgot/Reset Password
- Sprint 3 frontend integration and Playwright payment/assignment E2E
- Sprint 4 Event lifecycle and pre-payment Hold-release backend/frontend work
- Post-MVP refund execution, Booth change/cancellation and Partner Event withdrawal
- Production VNPay credentials and deployment webhook configuration

## Immediate next task

- Implement the approved Sprint 4 documentation baseline.
- Use V8 for Event cancellation metadata and BoothRequest cancellation state; never edit V1–V7.
- Migrate Event-scoped mutations to the approved order `Event → Booth (if needed) →
  EventBoothConfig (if needed) → Hold → Payment by ascending id → BoothRequest`; never acquire a
  skipped level later in reverse.
- Enforce `boothRequestDeadlineAt + boothPaymentWindowMinutes <= startAt` on publish and operational
  patch so every new Hold's scheduled `expiresAt` is no later than Event start. Unresolved Payment
  evidence may keep that Hold `ACTIVE` into `ONGOING` without pausing Event lifecycle. Trusted
  success may settle while the Event is `PUBLISHED`/`ONGOING`; after `COMPLETED`/`CANCELLED`, retain
  the evidence for manual reconciliation and create no Assignment.
- Keep unresolved Payment evidence blocking: it prevents Event cancellation and selected Hold
  release until trusted resolution.
- Keep Sprint 3 frontend/payment E2E debt visible rather than reporting it as completed.

## Active Sprint

Active Sprint: Sprint 04 Event Lifecycle and Pre-payment Booth Release. Documentation is approved;
implementation is pending.

Included Use Case slices:

- UC-O01 Manage Events - Draft delete, safe published update, eligible cancellation and timed
  lifecycle transitions
- UC-E02 Manage Booth Request - Pending withdrawal and safe Selected Hold release before settlement

## Current approved baselines

- Requirement baseline: v5 (Sprint 4 scope clarification)
- Use Case Diagram: V2, with Post-MVP ovals explicitly labelled
- Conceptual ERD: Baseline 2.1
- Logical ERD: v7 with active-MVP/Post-MVP overlay
- Physical implementation source: Flyway V1–V7 plus the active planned V8 overlay in
  `docs/design/12_Physical_ERD_Report.md`; the v1 33-table image is target/reference only
- Active MVP Use Case count: 26

Do not use the old Use Case Diagram V1, an earlier ERD or the 33-table target image as an
implementation source.

## Authentication baseline

- Authentication uses a Spring Security server-side Session stored in Redis.
- Authentication does not use JWT, bearer access tokens, refresh tokens or `/auth/refresh`.
- The `user_tokens` table stores email-verification token hashes and remains reserved for the future password-reset flow.
- The approved email-verification extension uses the existing `users.email_verified_at` and `user_tokens` schema; it requires no new migration.
- Verification does not grant roles. Existing Sessions are not silently elevated; eligible advanced authorities take effect after re-login.
- Email-verification endpoints, token policy and acceptance criteria are defined in `docs/use-cases/email-verification-use-case-specification.md` and `docs/api/email-verification-api-contract.md`.
- The frontend/backend cookie, CORS and CSRF contract is defined in `docs/api/browser-security-contract.md`.
- Forgot/Reset Password remains outside the active Sprint.

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
