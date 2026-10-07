# BookStreet AI Context

Last updated: `2026-10-07`

## Current implementation status

- Sprint 1 backend and real frontend integration are complete on `main` through merge commit `34a256e`.
- The foundation and Sprint 1 business-schema pull requests are merged into `main`.
- The current baseline includes Flyway migrations V1 through V5. `V5__seed_all_demo_roles.sql` is retained as the immutable demo-account seed, so the Sprint 2 schema migration is V6.
- The user manually verified successful PostgreSQL and Redis-backed Session runtime behavior through Spring Boot and Swagger UI.
- Flyway validates and applies the merged schema and seed data through version 5. V6 is in progress on the Sprint 2 schema branch.
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
- The latest local Maven verification ran 175 tests against the dedicated PostgreSQL test database with no failures, errors or skips.
- Organizer Event and Partner application Playwright flows are present for the real frontend/backend integration.
- Sprint 2 design is complete in `docs/sprints/sprint-02.md`, `docs/use-cases/sprint-02-use-case-specifications.md` and `docs/api/sprint-02-api-contract.md`; implementation has started with the V6 Booth schema and migration verification.
- Sprint 2 ends at Organizer selection, price-locked BoothHold and Hold expiry. Payment gateway integration and BoothAssignment are deferred to Sprint 3.
- Sprint 2 keeps `boothPaymentWindowMinutes` in the existing Event record, constrains it to `60..10080` minutes inclusive and defaults a new Event to `1440` minutes (24 hours).
- Selection persists `expiresAt = selectedAt + boothPaymentWindowMinutes`; a later permitted Event setting change applies only to future selections and never rewrites an existing Hold.
- Selection email is a post-commit side effect. Email failure is logged and must not roll back the selected request or Hold; Sprint 2 does not add an outbox or notification table.
- Sprint 2 uses a simple public/Partner Booth grid. Advanced drag-and-drop map editing remains out of scope.

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

`V6__create_sprint2_booth_schema.sql` is the in-progress Sprint 2 migration and creates:

- `locations`
- `booths`
- `event_booth_configs`
- `booth_requests`
- `booth_holds`

## Not yet implemented

- Forgot/Reset Password
- Sprint 2 Booth catalog, Event Booth configuration, BoothRequest and BoothHold Java persistence/APIs
- Payment gateway, BoothPayment, BoothAssignment and refund workflows

## Immediate next task

- Merge the Sprint 2 V6 documentation correction before the V6 schema pull request.
- Complete the Booth catalog/Event Booth configuration workstream after the V6 schema is merged.
- Keep BoothRequest submission separate from BoothHold creation: submission creates only `PENDING`; Organizer selection creates the Hold.
- Preserve the selected price in `BoothHold.lockedRentalPrice` and implement safe, idempotent Hold expiry.
- Enforce the approved resubmission policy: new records may follow `WITHDRAWN` or `PAYMENT_EXPIRED`; the same Event–Booth cannot be requested again after `REJECTED`.
- Feature modules must continue deriving the current User ID and roles from the shared authenticated principal; clients must not supply ownership IDs.
- Do not modify applied migrations V1, V2, V3, V4 or V5.

## Active Sprint

Active Sprint: Sprint 02 Booth Selection and Allocation Hold. Design complete; implementation in progress.

Included Use Cases:

- UC-O02 Manage Locations, physical Booth and Event configuration slice
- UC-E02 Manage Booth Request, submit/query/Pending withdrawal slice
- UC-O04 Review Booth Requests, reject/select/Hold-expiry slice

## Current approved baselines

- Requirement baseline: v4
- Use Case Diagram: V2 only
- Conceptual ERD: Baseline 2.1
- Logical ERD: v7
- Physical ERD: v1
- Use Case count: 27

Do not use the old Use Case Diagram V1 or an earlier ERD as an implementation source.

## Authentication baseline

- Authentication uses a Spring Security server-side Session stored in Redis.
- Authentication does not use JWT, bearer access tokens, refresh tokens or `/auth/refresh`.
- The `user_tokens` table stores email-verification token hashes and remains reserved for the future password-reset flow.
- The approved email-verification extension uses the existing `users.email_verified_at` and `user_tokens` schema; it requires no new migration.
- Verification does not grant roles. Existing Sessions are not silently elevated; eligible advanced authorities take effect after re-login.
- Email-verification endpoints, token policy and acceptance criteria are defined in `docs/use-cases/email-verification-use-case-specification.md` and `docs/api/email-verification-api-contract.md`.
- The frontend/backend cookie, CORS and CSRF contract is defined in `docs/api/browser-security-contract.md`.
- Forgot/Reset Password remains outside the active Sprint.

## Sprint 2 scope guard

Sprint 2 excludes:

- Payment gateway integration, BoothPayment, BoothAssignment and refund
- Booth change and cancellation
- Partner withdrawal from the whole Event
- Activity proposal, management, registration and rating
- QR flows
- Attendance and Booth Visit
- Points, Badge and Certificate rewards
- General Feedback
- Reporting
