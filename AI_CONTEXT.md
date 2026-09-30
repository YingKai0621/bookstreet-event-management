# BookStreet AI Context

Last updated: `2026-09-30`

## Current implementation status

- The foundation pull request is merged into `main`.
- `V1__init_auth_schema.sql` and `V2__seed_system_roles.sql` exist in `main`.
- The local PostgreSQL runtime was manually verified by the user through Spring Boot logs showing Flyway version 2.
- The user manually verified a successful PostgreSQL connection and Spring Boot startup.
- Spring Session Redis configuration exists; this does not claim that Codex independently verified Docker or the Redis runtime.
- Hibernate uses `ddl-auto: validate`.
- Java feature implementation has not started.

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

Sprint 1 is still missing these business tables:

- `events`
- `partner_organizations`
- `partner_event_applications`

## Not yet implemented

- JPA Entities
- Repositories
- Services
- Controllers
- Custom Spring Security configuration
- Account registration
- Login and server-side Session flow
- `GET /auth/me`
- Logout and Session invalidation
- Organizer Event management and public Published Event queries
- Partner Organization profile
- Partner Event Application submission and withdrawal
- Organizer application review
- Demo Organizer and Partner accounts
- Sprint 1 integration tests

## Immediate next task

- Branch: `chore/sprint1-business-schema`
- Migration: `backend/src/main/resources/db/migration/V3__init_sprint1_business_schema.sql`
- Tables:
  - `events`
  - `partner_organizations`
  - `partner_event_applications`
- V3 must not modify V1 or V2.
- V3 must not include Java code.
- V3 must not include demo accounts.
- V3 must not include out-of-scope tables.

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
