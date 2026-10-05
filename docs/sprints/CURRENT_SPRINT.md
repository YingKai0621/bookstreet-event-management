# Current Sprint

## Sprint 01 Account and Partner Application

- Status: `BACKEND COMPLETE - FRONTEND INTEGRATION PENDING`
- Sprint file: `docs/sprints/sprint-01.md`
- Use Case Specifications: `docs/use-cases/sprint-01-use-case-specifications.md`
- API Contract: `docs/api/sprint-01-api-contract.md`

## Sprint goal

Deliver the first end-to-end business slice: account creation and access, basic Event management, Partner application submission, and Organizer review.

## Current completion state

- The Sprint 1 backend scope is implemented and merged into `main` through merge commit `7890278`.
- Backend verification passes with 165 tests, 0 failures, 0 errors and 0 skipped tests.
- Flyway validates migrations V1 through V4 and Hibernate validates the mapped schema.
- Authentication, Event management, Partner Organization and Partner application flows were manually exercised through Swagger UI.
- The overall Sprint remains open until the frontend calls the real backend and the complete demo flow is verified end to end.
- Detailed backend evidence and deferred work are recorded in `docs/development/SPRINT_01_BACKEND_COMPLETION_REPORT.md`.
- Frontend setup, integration gaps and the end-to-end checklist are recorded in `docs/development/SPRINT_01_FRONTEND_HANDOFF.md`.

## Included Use Cases

- UC-G02 Create Account
- UC-G03 Manage Account Access - Sprint 1 slice
- UC-O01 Manage Events - create, update and publish slice
- UC-E01 Apply to Event
- UC-O03 Review Partner Applications

## Approved parallel extension

- UC-G03 Email Verification is implemented in the Auth module.
- Its scope and Acceptance Criteria are defined in `docs/use-cases/email-verification-use-case-specification.md` and `docs/api/email-verification-api-contract.md`.
- This extension does not add work to the Event or Partner feature branches and does not block the Sprint 1 Definition of Done.

## Scope guard

Booth, payment, refund, Activity, QR, Attendance, Points, Badge, Certificate, feedback and reporting are not part of Sprint 1.

Before starting a task, verify that it maps to one of the included Use Cases and an Acceptance Criterion.

