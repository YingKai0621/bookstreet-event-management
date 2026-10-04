# Sprint 01 Account and Partner Application

## 1 Purpose

Sprint 1 establishes the technical foundation and completes the first end-to-end business workflow. At the end of the sprint, the team can demonstrate a user account flow, an Organizer publishing an Event, a Partner applying to that Event, and the responsible Organizer approving or rejecting the application.

## 2 Sprint goal

```text
Create account and sign in
→ Organizer creates and publishes an Event
→ Partner submits an application
→ Organizer approves or rejects the application
→ Partner sees the review result
```

The frontend must call the real backend, and the backend must persist data in PostgreSQL. Demo results must not depend on manually editing database records.

## 3 Included Use Cases

| ID | Use Case | Sprint 1 delivery |
|---|---|---|
| UC-G02 | Create Account | Register with username, full name, password, confirm password and optional email |
| UC-G03 | Manage Account Access | Login, current-user lookup and logout using a server-side session |
| UC-O01 | Manage Events | Organizer creates, views, updates and publishes an Event |
| UC-E01 | Apply to Event | Partner creates/updates organization profile and submits an Event application |
| UC-O03 | Review Partner Applications | Responsible Organizer views, approves or rejects applications |

Forgot/Reset Password is intentionally deferred until the team approves the recovery policy for accounts without email. Cancel Event is deferred because it affects Booth, Activity, notification and refund flows outside Sprint 1.

## 4 Supporting setup

- Initialize the ReactJS frontend and Spring Boot backend.
- Connect Spring Boot to PostgreSQL.
- Add database migrations based on the current Physical ERD.
- Seed the four role codes and demo accounts where needed.
- Configure Spring Security, Spring Session Redis and role-based authorization.
- Define consistent API success and error responses.
- Configure environment variables without committing secrets.
- Add Docker support and basic CI checks.
- Add unit tests and integration tests for the Sprint 1 rules.

## 5 Main database tables

- `users`
- `roles`
- `user_roles`
- `partner_organizations`
- `events`
- `partner_event_applications`

Database structure must follow Physical ERD v1. A developer must not add or rename columns merely to make an endpoint easier to implement.

The Physical `user_tokens` table supports the approved parallel email-verification extension and remains reserved for the future password-reset flow. Email verification is implemented in the Auth module with its separate approved Acceptance Criteria; it is not a dependency for completing the Event and Partner Sprint 1 slices. Forgot/Reset Password remains deferred. Login sessions are temporary data stored in Redis through Spring Session, so no session table or JWT refresh-token table is added to the Physical ERD.

## 5.1 Approved parallel Auth extension

- Scope: email-verification token creation, delivery, confirmation and authenticated resend.
- Use Case Specification: `docs/use-cases/email-verification-use-case-specification.md`.
- API Contract: `docs/api/email-verification-api-contract.md`.
- Browser security rules: `docs/api/browser-security-contract.md`.
- Acceptance Criteria: `AC-G03-EV-01` through `AC-G03-EV-10`.
- This extension does not change the Event/Partner demo sequence or add a new condition to the Sprint 1 Definition of Done.

## 6 Demo accounts and role bootstrap

Sprint 1 does not implement the full Admin account/role management screens. Use migrations or seed data to create test users with verified email and the `PARTNER` and `ORGANIZER` roles. A newly self-registered user still receives only the `PARTICIPANT` role.

## 7 Out of scope

- Admin account and role management UI
- Forgot/Reset Password
- Cancel Event and its downstream effects
- Location and Booth configuration
- BoothRequest, BoothHold and BoothAssignment
- Payment and refund
- Booth change and cancellation
- Activity Proposal, Activity and Activity Registration
- QR, Attendance and BoothVisit
- Points, Badge and Certificate
- General Feedback and Activity Rating
- Event reports

## 8 Definition of Done

Sprint 1 is done only when all of the following are true:

- Frontend calls the deployed or locally running backend API.
- Backend persists the expected records in PostgreSQL.
- Passwords are hashed and never returned by an API.
- Username uniqueness is enforced case-insensitively.
- New accounts receive the `PARTICIPANT` role.
- Authorization blocks users without the required role.
- An Organizer can manage only Events for which they are responsible.
- A Partner cannot create duplicate applications for the same Event.
- Application status transitions follow `PENDING → APPROVED / REJECTED / WITHDRAWN`.
- Every Acceptance Criterion in the Sprint 1 specification passes.
- Relevant unit and integration tests pass in CI.
- The demo flow can be executed without manual database edits.

## 9 Demo scenario

1. A visitor creates an account and signs in.
2. A seeded Organizer signs in and creates an Event.
3. The Organizer publishes the Event.
4. A seeded Partner signs in and completes the Partner Organization profile.
5. The Partner views the published Event and submits an application.
6. The Organizer views the application list and opens the application.
7. The Organizer approves or rejects it.
8. The Partner refreshes the application detail and sees the final status and review note.

## 10 Risks to watch

- Do not grant the `PARTNER` or `ORGANIZER` role to an unverified email.
- Do not expose Draft Events through public endpoints.
- Do not identify the responsible Organizer from a request body; use the authenticated user and `events.organizer_user_id`.
- Do not store `confirmPassword`.
- Do not let two submissions create duplicate `partner_event_applications` records.
- Do not implement Booth or Activity fields inside application endpoints.
