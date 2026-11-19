# Sprint 11 System Admin — Three-Developer Assignment

- Status: `IMPLEMENTATION DELIVERED - CLOSURE VALIDATION PENDING`
- Prepared date: `2026-11-07`
- Team size: exactly three developers
- Scope baseline: `docs/sprints/sprint-11.md`
- API contract: `docs/api/sprint-11-api-contract.md`
- Implementation plan: `docs/sprints/SPRINT_11_IMPLEMENTATION_PLAN.md`

Developer A is `YingKai0621` and owns Flyway and the shared foundation. The other two teammates take Developer B or Developer C
by coordinating before starting a branch. The role description, files, Acceptance Criteria and merge order below are the
instructions each teammate and their AI follow.

## 1. Shared rules

- Start each task from an updated `main`, use one branch per task, and keep each pull request focused.
- Only Developer A creates or changes the Sprint 11 migration. Applied migrations are never edited.
- Developers B and C start only after Developer A's foundation PR is merged.
- Each package owns the screens for its features, unless the team records a different frontend owner.
- Every administrative change goes through the shared audit writer. Nobody writes audit rows another way.
- Every organization check goes through the shared eligibility guard. Nobody writes a separate status check.
- Run only the tests related to your change. Each pull request needs green CI before merge.
- Never commit `.env`, credentials or local scripts.
- Report a conflict between documents before coding. Business Rules govern.

## 2. Developer A — `YingKai0621` — foundation

### PR A1: foundation, merged first

- Migration: reserve and create V18 from `docs/design/SPRINT_11_ADMIN_PHYSICAL_ERD_OVERLAY.md`, after rechecking the next free version.
- Audit: `AdminAuditLog` entity, `AdminAuditWriter` that requires an existing transaction, closed action and target enums,
  `GET /admin/audit-logs`, and the real audit screen.
- Enforcement: `authenticatedAt` in the Session principal, a filter that applies `BR-114` on every authenticated request, and
  closing Notification streams by User and role.
- Security: restrict `/organizer` operations to `ORGANIZER`, and update the affected tests.
- Removal: the Admin reset-password operation and UI, including its fixed password, and the Facilities, Assets, Booth
  catalog, System Settings and Permission screens with their calls.
- Foundation for Developer B: `AdminGuard` for locking active Admin rows and checking the last active Admin, a reason normalizer
  with its validation, and a shared Admin paging response.
- Foundation for Developer C: `PartnerOrganizationGuard` that raises `PARTNER_ORGANIZATION_INACTIVE`, with no call sites yet.
- Frontend structure: split `adminApi.ts` into `adminUsersApi.ts`, `adminAuditApi.ts` and `adminDashboardApi.ts`, and add the
  `roles` and `organizations` routes with a temporary page that Developers B and C replace. `adminApi.ts` keeps only the
  profile calls until Developer B removes them.

### PR A2: password reset, last and deferrable

- `POST /auth/password-reset/request` and `/confirm`, token issue limits, the mail message, setting `sessions_valid_from`, and the
  public pages.
- If this unit is deferred, record the amendment in `docs/sprints/sprint-11.md`.

### Closure

Developer A runs final cross-role checks, the closure report and the documentation updates.

### Acceptance Criteria

`AC-A01-S11-07`, `AC-A01-S11-09`, `AC-A02-S11-03`, `AC-A04-S11-01` through `AC-A04-S11-05`, `AC-ADM-S11-01`, `AC-ADM-S11-02`,
`AC-G03-S11-01` through `AC-G03-S11-06`, `AC-S11-REG-01` through `AC-S11-REG-04`, and `AC-S11-REG-06`.

`AC-A01-S11-09` is complete only after Developer B removes the create default. `AC-ADM-S11-02` is complete only after
Developer B moves the profile off `/admin/profile`. `AC-A04-S11-01` and `AC-S11-REG-04` are complete only
after Developers B and C merge, because they connect each action and keep existing flows working in their own packages.

## 3. Developer B — accounts and roles owner

### Backend

- Rewrite `AdminUserController`, `AdminUserService` and their DTOs to match sections 4 and 5 of the API contract.
- Remove the fixed default password from `AdminUserService` and `AdminPortal.tsx`, and remove automatic email verification and
  role and status input from create and update.
- Add status, role assignment and role removal with their guards, using `AdminGuard`.
- Reuse the existing verification mail flow after commit.
- Write audit rows for `USER_CREATED`, `USER_UPDATED`, `USER_LOCKED`, `USER_UNLOCKED`, `ROLE_ASSIGNED` and `ROLE_REMOVED`.

### Frontend

- `AdminUserManagementView` with server paging, real status, verification state and all roles, and a required lock reason.
- Replace `AdminRolesPermissionsView` with per-User role assignment and an explanation for unavailable actions.
- `AdminProfileView` uses `/auth/profile`, and its password action is removed.

### Acceptance Criteria

`AC-A01-S11-01` through `AC-A01-S11-06`, `AC-A01-S11-08`, `AC-A02-S11-01`, `AC-A02-S11-02`, `AC-A02-S11-04` through
`AC-A02-S11-06`, and `AC-ADM-S11-03`.

## 4. Developer C — organizations, dashboard and Badge audit owner

### Backend

- `GET /admin/partner-organizations`, its detail and its status command, writing `ORGANIZATION_LOCKED` and `ORGANIZATION_UNLOCKED`.
- Call `PartnerOrganizationGuard` in every operation listed in section 8 of the API contract, including the ones that have no check
  today: Activity proposal, Activity requests and Payment initiation.
- Skip `INACTIVE` organizations in the event-publication and hold-reminder producers.
- Add `partnerOrganizationStatus` to the Organizer responses.
- Rewrite `GET /admin/dashboard` to match section 9 of the API contract.
- Write audit rows for `BADGE_CREATED`, `BADGE_UPDATED` and `BADGE_AWARDS_SYNCHRONIZED`.

### Frontend

- The Admin organization list, detail, and lock and unlock with a required reason.
- A Partner workspace notice and disabled actions for a locked organization.
- Organizer queue labels and disabled actions for a locked organization.
- `AdminDashboardView` with real figures and separate failure states.
- Remove the retired `/admin/badge-rules` calls.

### Sprint 10 debt

- Correct `partner-assigned-booths-ui.spec.ts`.
- Remove `notificationPreferences` from `ManagementPortal.tsx` and `types/organizer.ts`.

### Acceptance Criteria

`AC-A03-S11-01`, `AC-A03-S11-02`, `AC-A05-S11-01` through `AC-A05-S11-05`, `AC-E-S11-01` through `AC-E-S11-06`, `AC-D-S11-01` through
`AC-D-S11-03`, and `AC-S11-REG-05`.

## 5. Shared-file ownership

| File or area | Owner | Other developers |
| --- | --- | --- |
| `db/migration` | A | Request a change through A |
| `SecurityConfiguration` | A | Request a change through A |
| `AdminAuditWriter`, `AdminGuard`, `PartnerOrganizationGuard` | A | Call them; report any change they need |
| `AdminPortal.tsx`, `AdminSidebar.tsx`, `adminRoutes.ts` | A in PR A1 | B and C change only their own tab content |
| `adminUsersApi.ts` | B | |
| `adminOrganizationsApi.ts`, created by C, and `adminDashboardApi.ts` | C | |
| Partner, Booth, Payment and Activity services | C, for the guard call only | Do not change other logic |

## 6. Merge order

1. Developer A merges the baseline activation, then PR A1.
2. Developers B and C update from `main` and work in parallel. Their packages share no service, and they can merge in either order.
3. Developer A merges PR A2, if it stays in this Sprint.
4. Developer A merges the closure.

If B or C finds that the foundation needs a change, A delivers it as a small separate pull request rather than changing it in
their branch.

## 7. Handoff checklist

Each pull request states:

- the Acceptance Criteria it covers
- the tests run, with results
- any existing test it changed, and why
- what was not verified
- confirmation that no unapproved table, status, role, endpoint or Notification type was added
