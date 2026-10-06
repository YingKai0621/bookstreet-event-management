# Sprint 1 Backend Completion Report

Date: `2026-10-06`

## 1. Closure decision

The Sprint 1 backend scope is complete on `main` through merge commit `7890278`.

This report does not close the whole Sprint. The Sprint remains in frontend integration because its Definition of Done requires the React frontend to call the real backend and complete the end-to-end demo without manual database edits.

## 2. Delivered backend scope

### Authentication and account access

- Account registration with validation, BCrypt password hashing and the default `PARTICIPANT` role.
- Login, current-account lookup and logout using Spring Security server-side Sessions stored in Redis.
- Role protection for `PARTNER`, `ORGANIZER` and `ADMIN`, including the verified-email requirement.
- Email verification with 60-minute, single-use tokens stored only as SHA-256 hashes.
- Local mail-catcher and real SMTP delivery were manually verified.

### Event management

- Organizer-owned Draft Event creation, listing, detail and update.
- Event publication with completeness, time-order, deadline and non-negative-limit validation.
- Public listing and detail expose only Published Events.
- Ownership and concurrent publication protections are covered by tests.

### Partner Organization and applications

- Partner Organization profile creation, retrieval and update for the authenticated representative.
- Application submission to a Published Event before its application deadline.
- Duplicate application prevention at service and database levels.
- Partner-owned application listing, detail and Pending withdrawal.
- Organizer-owned application listing, detail, approval and rejection.
- Application review and withdrawal transitions use row locks for concurrent requests.
- Application pagination uses separate `page`, `size` and `sort` query parameters.
- Allowed sort fields are `submittedAt`, `status`, `eventId`, `reviewedAt` and `withdrawnAt`; other fields return `400 INVALID_SORT`.

### Supporting foundation

- PostgreSQL is the durable source of truth and Hibernate uses `ddl-auto: validate`.
- Flyway migrations V1 through V4 provide the Sprint 1 schema, system roles and verified demo accounts.
- Swagger/OpenAPI supports local API exploration with CSRF handling.
- Browser security provides the public CSRF bootstrap endpoint, an environment-driven CORS allowlist and configurable Session cookie attributes.
- GitHub Actions checks the backend and frontend on pushes and pull requests targeting `main`.

## 3. Verification evidence

The final backend verification was run from `backend/` with the dedicated Event test database configured:

```powershell
$env:EVENT_TEST_DATABASE_URL="jdbc:postgresql://localhost:5432/bookstreet_event_test"
mvn clean verify
```

Result:

```text
Tests run: 165
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

Flyway successfully validated all four migrations and reported schema version 4 with no pending migration.

The browser-security follow-up discovered 172 tests with no failures or errors
in local verification. The 24 Event tests that require
`EVENT_TEST_DATABASE_URL` were skipped locally; CI configures their dedicated
database and enables them.

Manual Swagger verification covered:

- Authentication and Session behavior.
- Email verification through local and real mail delivery.
- Organizer Event creation, update and publication.
- Partner Organization creation and application submission.
- Organizer application listing and review.
- Partner application result lookup and Pending withdrawal.
- Valid application sorting returning HTTP 200.
- Unsupported application sorting returning HTTP 400 with `INVALID_SORT` and no stack trace.

## 4. Current state-transition boundary

Sprint 1 supports only these Partner application transitions:

```text
PENDING -> APPROVED
PENDING -> REJECTED
PENDING -> WITHDRAWN
```

A withdrawn application cannot currently be resubmitted for the same Partner Organization and Event. Supporting resubmission later requires an approved business rule and API design before changing the current unique constraint or transition model.

## 5. Remaining work before full Sprint closure

- Connect the React frontend to the real Sprint 1 backend APIs.
- Run the full demo through the frontend, Redis Session and PostgreSQL without manual database edits.
- Confirm CI remains green for the frontend integration pull request.

## 6. Deferred beyond Sprint 1

- Forgot/Reset Password.
- Partner application resubmission after withdrawal.
- Admin account and role management UI.
- Event cancellation and its downstream effects.
- Booth, payment, refund, Activity, QR, Attendance, reward, feedback and reporting flows.

Applied migrations V1, V2, V3 and V4 remain immutable.
