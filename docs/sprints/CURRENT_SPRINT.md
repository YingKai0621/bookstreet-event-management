# Current Sprint

## Sprint 01 Account and Partner Application

- Status: `READY FOR IMPLEMENTATION`
- Sprint file: `docs/sprints/sprint-01.md`
- Use Case Specifications: `docs/use-cases/sprint-01-use-case-specifications.md`
- API Contract: `docs/api/sprint-01-api-contract.md`

## Sprint goal

Deliver the first end-to-end business slice: account creation and access, basic Event management, Partner application submission, and Organizer review.

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

