# BookStreet AI Context

## Current implementation scope

- Active sprint: `Sprint 01`
- Sprint status: `READY FOR IMPLEMENTATION`
- Read first: `docs/sprints/CURRENT_SPRINT.md`
- Do not implement features outside the active sprint unless the team explicitly changes the sprint scope.

## Required reading order

1. `docs/sprints/CURRENT_SPRINT.md`
2. `docs/sprints/sprint-01.md`
3. `docs/use-cases/sprint-01-use-case-specifications.md`
4. `docs/api/sprint-01-api-contract.md`
5. The current requirement and design documents under `docs/requirements` and `docs/design`

## Current baseline

- Requirement baseline: v4
- Use Case Diagram: V2 only
- Conceptual ERD: Baseline 2.1
- Logical ERD: v7
- Physical ERD: v1
- Use Case count: 27

Do not use the old Use Case Diagram V1 or an earlier ERD as an implementation source.

## Source-of-truth order

When documents appear inconsistent, use this order and report the conflict before coding:

1. `05_Business_Rules`
2. `06_Use_Case_List`
3. Active Sprint Use Case Specifications and Acceptance Criteria
4. Physical ERD
5. Active Sprint API Contract
6. Overview, demo and supporting reports

Sprint documents limit what is implemented now. They do not silently change the business baseline.

## Hard implementation rules

- Do not invent new roles, statuses, tables, relationships or business flows.
- Do not change the Physical ERD without updating the design documents first.
- Use the exact role codes `PARTICIPANT`, `PARTNER`, `ORGANIZER` and `ADMIN`.
- A new account receives the `PARTICIPANT` role by default.
- `PARTNER`, `ORGANIZER` and `ADMIN` require a verified email.
- Username uniqueness is case-insensitive.
- `confirmPassword` is validated by the client/server request flow but is never stored.
- Passwords must be hashed and never logged or stored as plaintext.
- Authentication uses Spring Security server-side sessions stored in Redis. The browser receives only a Secure, HttpOnly session cookie; do not introduce JWT or refresh-token flows without a baseline change.
- Every feature must satisfy its Acceptance Criteria before it is marked complete.
- If a requirement is unclear, stop and ask the team instead of assuming.
