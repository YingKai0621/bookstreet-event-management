# BookStreet AI Context

Last updated: `2026-10-02`

## Current implementation status

- The foundation and Sprint 1 business-schema pull requests are merged into `main`.
- `V1__init_auth_schema.sql`, `V2__seed_system_roles.sql` and `V3__create_sprint1_business_schema.sql` exist in `main`.
- The user manually verified successful PostgreSQL and Redis-backed Session runtime behavior through Spring Boot and Swagger UI.
- Flyway validates and applies the current schema through version 3.
- Spring Session uses Redis; authentication does not use JWT or bearer tokens.
- Hibernate uses `ddl-auto: validate`.
- Sprint 1 authentication is implemented with JPA entities, repositories, services, REST controllers and Spring Security configuration.
- Implemented authentication APIs cover account registration, login, logout and the current-account endpoint.
- New self-registered accounts receive only the `PARTICIPANT` role.
- Role-protected Organizer and Partner routes use the authenticated principal and server-side Session.
- `PARTNER`, `ORGANIZER` and `ADMIN` authorities require `email_verified_at` to be present.
- Swagger/OpenAPI is available for local API exploration.
- The current Maven test suite passes with 39 tests and no failures or errors.

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

## Not yet implemented

- Organizer Event management and public Published Event queries
- Partner Organization profile
- Partner Event Application submission and withdrawal
- Organizer application review
- Demo Organizer and Partner accounts
- Event and Partner feature tests
- Email-verification mail delivery and verification endpoints; `user_tokens` is reserved for this future flow
- Forgot/Reset Password

## Immediate next task

- Implement Organizer Event management and public Published Event queries on the Event feature branch.
- Implement Partner Organization, Partner Event Application and Organizer application review on the Partner feature branch.
- Both feature modules must derive the current User ID and roles from the shared authenticated principal; clients must not supply ownership IDs.
- Add demo Organizer and Partner accounts only through a separately reviewed migration or seed-data pull request.
- Do not modify applied migrations V1, V2 or V3.

## Active Sprint

Active Sprint: Sprint 01 Account and Partner Application.

Included Use Cases:

- UC-G02 Create Account
- UC-G03 Manage Account Access, Sprint 1 slice
- UC-O01 Manage Events, create/update/publish slice
- UC-E01 Apply to Event
- UC-O03 Review Partner Applications

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
- Sprint 1 does not use JWT, bearer access tokens, refresh tokens or `/auth/refresh`.
- The `user_tokens` table is reserved for future email-verification and password-reset flows.
- Forgot/Reset Password is outside Sprint 1.

## Sprint 1 scope guard

Sprint 1 excludes:

- Booth configuration, request, hold, assignment, change and cancellation
- Payment and refund
- Activity proposal, management, registration and rating
- QR flows
- Attendance and Booth Visit
- Points, Badge and Certificate rewards
- General Feedback
- Reporting
