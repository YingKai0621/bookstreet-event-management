# Sprint 11 Closure Report

- Sprint: `Sprint 11 System Admin Management`
- Report date: `2026-11-19`
- Status: `PENDING CLOSURE`
- Reviewed main commit: `d536c53`
- Latest formally completed Sprint: `Sprint 10 Role-Scoped In-App Notifications`

## 1. Decision

Sprint 11 implementation is merged and suitable for deployment validation, but this report does not mark the Sprint complete.
Focused Sprint 11 browser checks were not run during this review, and the Render/Vercel environment has not yet passed the
required manual real-UI smoke. Both gaps are visible closure items, not assumed successes.

## 2. Delivered changes

| Pull request | Delivered scope |
|---|---|
| #143 | V18, Admin audit foundation, shared guards and immediate Session/account enforcement |
| #144 | Staff workspace navigation and event-list preservation |
| #145 | Verified-email password reset backend and public pages |
| #146 | Audited account and role management |
| #147 | Partner organization management/effects, real dashboard and Badge audit integration |
| #149 | Read-only Admin and Organizer Booth Payment histories |
| #150 | Plain-language Admin validation messages |

The unscheduled read-only Admin Event view remains out of scope. No Permission/RolePermission or generic settings model was
introduced, and Admin still does not operate Organizer Events.

## 3. Acceptance evidence map

| Acceptance group | Primary automated evidence |
|---|---|
| Accounts and roles | `AdminUserManagementIntegrationTests`, `SessionEnforcementIntegrationTests`, `admin-accounts-roles-ui.spec.ts` |
| Badge audit | `RewardManagementIntegrationTests`, `admin-audit-ui.spec.ts` |
| Audit list and append-only behavior | `AdminAuditLogIntegrationTests`, `Sprint11SchemaMigrationTests`, `admin-audit-ui.spec.ts` |
| Partner organizations and lock effects | `AdminPartnerOrganizationIntegrationTests`, `AdminGuardIntegrationTests`, `admin-organizations-ui.spec.ts` |
| Real dashboard | `AdminDashboardIntegrationTests`, `admin-dashboard-ui.spec.ts` |
| Admin workspace/navigation | `admin-workspace-ui.spec.ts`, `staff-workspace-navigation-ui.spec.ts`, `partner-assigned-booths-ui.spec.ts` |
| Password reset | `PasswordResetIntegrationTests`, `SessionEnforcementIntegrationTests`, `password-reset-ui.spec.ts` |
| Admin/Organizer Payment history extensions | `AdminBoothPaymentIntegrationTests`, `OrganizerPaymentHistoryIntegrationTests`, `admin-payments-ui.spec.ts`, `organizer-payments-ui.spec.ts` |
| Migration and security regression | `Sprint11SchemaMigrationTests`, `AdminGuardIntegrationTests`, the full backend/frontend CI jobs |

This map identifies the intended evidence; it is not a claim that the browser specs ran in the latest CI job.

## 4. Verification recorded

### Main CI

GitHub Actions run
[`42729853295`](https://github.com/YingKai0621/swp391-bookstreet-event-management/actions/runs/42729853295)
at commit `d536c53` completed successfully:

- Backend tests: passed
- Frontend checks: passed
- Frontend Playwright tests: skipped

### Local review evidence

- The most recent full Maven test reports present in the workspace contain 830 tests, 0 failures, 0 errors and 406 skips.
  Because many integration tests are environment-gated, this count is supporting evidence only and is not a replacement for
  CI or the focused browser run.
- Frontend lint and production build passed in the deployment-preparation review. Three pre-existing lint warnings remain;
  there are no lint errors.
- The separate provider-backed media-storage work passed 41 focused backend tests, backend packaging, frontend lint/build and
  a live upload/read/delete Cloudinary smoke. That work is uncommitted on its own branch at the time of this report and is not
  counted as merged Sprint 11 evidence.

## 5. Documentation and source audit

- Flyway V18 is implemented and immutable. It adds `users.sessions_valid_from` and `admin_audit_logs` exactly as reviewed.
- The current Sprint pointer, AI context, root/documentation indexes and Physical ERD report were reconciled to V18 during this
  closure review.
- The drawio/PNG has not been re-exported for V18. The report states this explicitly and gives migration V18 plus the Sprint 11
  overlay priority for the new column/table; diagram export remains documentation debt, not a runtime deployment blocker.
- The missing editor image upload contract was added by inspecting the real controllers, services and security matchers.
- Fixed-password hints were removed from Organizer and Partner login placeholders.
- Chat guidance was corrected to describe the implemented verified-email password-reset flow.

## 6. Remaining closure gates

1. Run the focused Sprint 11 browser specs for Admin accounts/roles, audit, dashboard, organizations, workspace, password
   reset, staff navigation and both Payment history screens. Record exact pass/fail totals.
2. Deploy backend and frontend, then manually smoke:
   - Admin login, dashboard, account lock/unlock, role change and audit visibility;
   - Partner organization lock effect on a real Partner command without cancelling existing data;
   - password-reset request neutral response, email link, one-time reset and invalidation of an older Session;
   - Admin and Organizer Payment history ownership/filter behavior;
   - Session cookie, CORS and CSRF behavior across the Vercel/Render origins.
3. Confirm Flyway V18 and Hibernate validation on the deployment database, and confirm Redis-backed Sessions.
4. Update this report with deployment URLs, evidence date, browser totals and the project owner's closure decision.

## 7. Closure rule

Do not change this report to `COMPLETE`, change `CURRENT_SPRINT.md` to completed, or start a schema-changing Sprint 12 branch
until the remaining gates are recorded. A deployment that starts successfully is not by itself proof that all 51 required
Acceptance Criteria work through the real UI.
