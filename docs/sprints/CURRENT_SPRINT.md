# Current Sprint

## Sprint 11 System Admin Management

- Status: `ACTIVE - FOUNDATION NEXT`
- Activation date: `2026-11-07`
- Activated by: project owner, Developer A (`YingKai0621`)
- Previous completed Sprint: `Sprint 10 Role-Scoped In-App Notifications`, closed in
  `docs/development/SPRINT_10_CLOSURE_REPORT.md`
- Approved documentation: PR #141, merge commit `7604f06`
- Current implemented schema: Flyway migrations `V1` through `V17`
- Reserved migration: `V18__create_admin_audit_log.sql`, Developer A only
- Sprint baseline: `docs/sprints/sprint-11.md`
- Use Case Specifications: `docs/use-cases/sprint-11-use-case-specifications.md`
- API Contract: `docs/api/sprint-11-api-contract.md`
- Physical ERD source: `docs/design/12_Physical_ERD_Report.md` plus
  `docs/design/SPRINT_11_ADMIN_PHYSICAL_ERD_OVERLAY.md`
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

The active baseline is `BR-112` through `BR-120`, `UC-A01` through `UC-A05`, the password-reset part of `UC-G03`, and
**51 Acceptance Criteria**:

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

Read-only Payment and Event views under `AC-OPT-S11` stay outside the baseline unless recorded as scheduled.

## Ownership

- Developer A is `YingKai0621` and owns V18, the audit foundation, Session enforcement, security, removals, shared guards,
  password reset and closure.
- Developer B owns accounts, roles and the Admin profile, including their screens.
- Developer C owns Partner organizations and their effects, the dashboard, Badge audit and the Sprint 10 debt items, including
  their screens.
- Developers B and C start after Developer A's foundation pull request merges.

## Current implementation unit

Developer A's foundation pull request, PR A1, covering delivery units `S11-1` and `S11-2`.

## Non-negotiable implementation rules

- PostgreSQL remains durable truth; Redis remains Session-only.
- Authentication remains Spring Security Session with an HttpOnly cookie. Do not introduce JWT.
- Hibernate remains `ddl-auto: validate`; V1 through V17 are immutable.
- Only Developer A creates or changes V18. Recheck the next free version immediately before creating it.
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
- a signed-in User changing their own password, which moves with password reset if that unit is deferred
- mobile layout work for the Admin workspace

## Activation result

The project owner activated Sprint 11 on `2026-11-07` after the baseline merged through PR #141. V18 was free on updated `main`,
which holds migrations V1 through V17. Sprint 11 adds two Use Cases, for 28 active MVP Use Cases.
