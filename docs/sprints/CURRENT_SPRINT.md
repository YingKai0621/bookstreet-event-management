# Current Sprint

## Sprint 11 System Admin Management

- Status: `ACTIVE - IMPLEMENTATION MERGED, CLOSURE VALIDATION PENDING`
- Activation date: `2026-11-07`
- Last status review: `2026-11-19`
- Previous completed Sprint: `Sprint 10 Role-Scoped In-App Notifications`, closed in
  `docs/development/SPRINT_10_CLOSURE_REPORT.md`
- Approved documentation baseline: PR #141, merge commit `7604f06`
- Current implemented schema: immutable Flyway migrations `V1` through `V18`
- Sprint baseline: `docs/sprints/sprint-11.md`
- Use Case Specifications: `docs/use-cases/sprint-11-use-case-specifications.md`
- API Contract: `docs/api/sprint-11-api-contract.md`
- Editor image contract: `docs/api/content-image-upload-api-contract.md`
- Physical ERD source: `docs/design/12_Physical_ERD_Report.md`
- Implementation plan: `docs/sprints/SPRINT_11_IMPLEMENTATION_PLAN.md`
- Three-developer assignment: `docs/sprints/SPRINT_11_TEAM_ASSIGNMENT.md`

## Sprint goal

Turn the Admin workspace into a real administration area:

1. Accounts, roles and Badges work through real, validated, audited operations.
2. A locked account or removed role stops working immediately, across the whole system.
3. Admin can lock a Partner organization, which blocks new work without cancelling existing work.
4. Every administrative change appears in an append-only audit log.
5. The dashboard shows only real system-wide data.
6. Users can recover their own account through a safe password-reset flow.

## Scope and acceptance baseline

The 51 required criteria use `BR-112` through `BR-120`, `UC-A01` through `UC-A05` and the password-reset part of
`UC-G03`:

- 9 account criteria: `AC-A01-S11-01` through `AC-A01-S11-09`
- 6 role criteria: `AC-A02-S11-01` through `AC-A02-S11-06`
- 2 Badge criteria: `AC-A03-S11-01` and `AC-A03-S11-02`
- 5 audit criteria: `AC-A04-S11-01` through `AC-A04-S11-05`
- 5 organization criteria: `AC-A05-S11-01` through `AC-A05-S11-05`
- 6 locked organization criteria: `AC-E-S11-01` through `AC-E-S11-06`
- 3 dashboard criteria: `AC-D-S11-01` through `AC-D-S11-03`
- 3 workspace criteria: `AC-ADM-S11-01` through `AC-ADM-S11-03`
- 6 password-reset criteria: `AC-G03-S11-01` through `AC-G03-S11-06`
- 6 regression criteria: `AC-S11-REG-01` through `AC-S11-REG-06`

`BR-121` separately governs the scheduled read-only extensions: Admin Booth Payment history (`AC-OPT-S11-01`) and
Organizer-owned Payment history (`AC-ORG-PAY-S11-01` through `03`). The Event oversight view (`AC-OPT-S11-02`) remains
unscheduled.

## Implemented delivery

- PR #143: V18, append-only audit foundation, immediate Session/account enforcement and shared guards.
- PR #144: staff workspace navigation and registration-list preservation.
- PR #145: verified-email password reset and public reset pages.
- PR #146: audited account and role management.
- PR #147: Partner organization management/effects, real dashboard and Badge audit integration.
- PR #149: read-only Admin and Organizer Booth Payment histories.
- PR #150: plain-language Admin validation messages.

## Current implementation unit

Sprint closure and deployment validation. Implementation is merged, but Sprint 11 is not formally closed until:

1. focused Sprint 11 browser checks are run or explicitly recorded as deferred;
2. the deployed Render/Vercel environment passes a manual real-UI smoke for Admin, password reset and organization lock effects;
3. `docs/development/SPRINT_11_CLOSURE_REPORT.md` records final evidence and the owner approves closure.

## Non-negotiable implementation rules

- PostgreSQL remains durable truth; Redis remains Session-only.
- Authentication remains Spring Security Session with an HttpOnly cookie. Do not introduce JWT.
- Hibernate remains `ddl-auto: validate`; V1 through V18 are immutable.
- Every administrative change uses the shared audit writer, and every organization check uses the shared guard.
- Admin never reads or sets another User's password, and no fixed password stays in application code.
- Locking an account or organization never cancels records or creates a refund.
- Admin does not operate Events for an Organizer.
- Do not commit `.env`, credentials, local database URLs, demo-only data or local scripts.

## Explicitly out of scope

- Permission or RolePermission, generic System Settings, facilities, assets or booth catalog on Admin
- Admin Notification types or producers
- Admin emergency cancellation, refunds, manual Payment or Assignment changes
- Admin editing a Partner profile or deleting an organization
- signed-in self-service password change
- Admin Event operation and the unscheduled read-only Event oversight view
- mobile layout work for the Admin workspace

## Status result

Sprint 11 code is present on `main` through merge commit `d536c53`, with V18 applied and the scheduled Payment history
extension included. The latest main CI is green for backend and frontend checks; its Playwright job was skipped. Therefore
the implementation is ready for focused deployment validation, but the Sprint remains active until the closure gates above
are recorded.
