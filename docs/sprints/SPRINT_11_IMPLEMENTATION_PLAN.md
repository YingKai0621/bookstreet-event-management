# Sprint 11 System Admin Implementation Plan

- Status: `IMPLEMENTED - CLOSURE VALIDATION PENDING`
- Prepared date: `2026-11-07`
- Scope baseline: `docs/sprints/sprint-11.md`
- API contract: `docs/api/sprint-11-api-contract.md`
- Physical ERD overlay: `docs/design/SPRINT_11_ADMIN_PHYSICAL_ERD_OVERLAY.md`
- Three-developer ownership: `docs/sprints/SPRINT_11_TEAM_ASSIGNMENT.md`

## 1. Delivery principles

- Close the most dangerous gaps first: the fixed password, Sessions of locked accounts, and Admin access to `/organizer`.
- Deliver the foundation before the features that depend on it.
- Keep Partner and Organizer behavior unchanged for `ACTIVE` organizations.
- Keep each pull request reviewable and mapped to its criteria.

## 2. Pre-implementation gates

1. Done: the project owner approved this baseline and activated it on `2026-11-07`.
2. Done: V18 was reserved, implemented and merged through PR #143; V1 through V18 are immutable.
3. Open: Developers B and C read the behavior changes in section 6 and claim their packages before starting.

## 3. Delivery sequence

| Step | Unit | Owner | Depends on | Result |
| --- | --- | --- | --- | --- |
| 1 | `S11-1`, `S11-2` in PR A1 | A | Activation | Migration, audit, enforcement, security, removals, shared guards |
| 2 | `S11-3` | B | PR A1 | Accounts, roles, profile |
| 3 | `S11-4`, `S11-5` | C | PR A1 | Organizations and effects, Badge audit, dashboard, Sprint 10 debt |
| 4 | `S11-6` in PR A2 | A | PR A1 | Password reset; deferrable |
| 5 | Closure | A | All above | Evidence, closure report, documentation |
| Optional | `S11-7` | Team decision | Steps 1 to 3 | Read-only Payment and Event views |

Developers B and C may work at the same time. If time runs short, drop `S11-7` first, then `S11-6`. Dropping `S11-6` needs a recorded
amendment, and the signed-in password change then moves with it to the next Sprint.

## 4. Backend design boundaries

### 4.1 Session enforcement

- A single filter runs after the Security context loads, and only for an authenticated request.
- It reads status, roles, email verification and `sessions_valid_from` by User ID with one query.
- It ends the Session and returns `401` for a `DISABLED` account or a stale Session.
- It narrows the request's authorities to the ones stored in the Session that the User still holds. It never adds a role, so `BR-76`
  still holds.
- `NotificationCurrentUser` keeps its own check as a second layer.
- The `ASYNC` dispatch rule for streams stays.

### 4.2 Audit writer

- The writer requires an existing transaction, so the audit row and its change commit or roll back together.
- It accepts only the closed actions and targets, and takes the actor from the Session.
- It is called after a real change, never on a repeated state.
- A scheduled or Partner action does not call it.

### 4.3 Last active Admin

- The guard locks active Admin `users` rows in `user_id` order, then counts accounts that are `ACTIVE`, verified and hold `ADMIN`.
- Lock and role removal share this guard.

### 4.4 Organization guard

- Each blocked operation calls the guard after loading the organization and before creating any row.
- It runs under the operation's existing Event root lock and adds no new lock order.
- Replaying an idempotent Payment returns the existing result before the guard runs.
- The settlement, Hold expiry and lifecycle services do not call it.

### 4.5 Dashboard

Figures use aggregate queries, not loading all rows into memory. Today's implementation loads every User, which stops.

### 4.6 Password reset

- Reuse the hashing, single-use, revocation and issue-limit approach of `EmailVerificationTokenService`, with `PASSWORD_RESET`.
- The request response is the same in every case, and mail is sent after commit.
- Success sets `sessions_valid_from`, so earlier Sessions end through the enforcement filter.
- A reset does not change `status`, and the confirm step rejects a token of a locked account.

## 5. Migration delivery

- One migration, in PR A1, from the overlay's reviewed DDL. The DDL was run once on the test database inside a rolled-back transaction.
- Verify a clean migration, a V17 upgrade, the constraint rejections and Hibernate validation.
- `V1` through `V18` stay unchanged after merge.

## 6. Behavior changes to existing code and tests

| Change | Affects |
| --- | --- |
| `GET /admin/users` is paged | Admin frontend and its specs |
| Status values are `ACTIVE` and `DISABLED` | Admin frontend, which also fixes the wrong locked display |
| Create no longer accepts role, status or a missing password | Admin frontend and its specs |
| A disabled Session returns `401` on every authenticated API | `AuthAuthorizationIntegrationTests`, Notification tests |
| Admin without `ORGANIZER` is denied on `/organizer` | `adminKeepsExistingOrganizerAccess...` |
| A locked organization returns `PARTNER_ORGANIZATION_INACTIVE` | Booth request and selection tests |
| Admin Booth, Facilities and Settings screens are removed | `admin-workspace-ui.spec.ts` and related specs |

## 7. Test plan

Run focused tests per pull request against the isolated `*_event_test` database. Never use the demo database.

| Package | Backend | Browser |
| --- | --- | --- |
| PR A1 | Migration, audit writer and rollback, enforcement through a running server, stream closure, `/organizer` denial | Audit screen, removed routes |
| B | Every account and role operation, guards, audit rows, concurrency on the last active Admin | User and role screens, profile |
| C | Organization operations, each blocked and each allowed command, producers, dashboard figures, Badge audit | Organization screens, Partner notice, Organizer labels, dashboard states |
| PR A2 | Token rules, neutral responses, limits, Session end | Request and reset pages |

## 8. Manual real-UI smoke

Run on a real backend before closure:

1. Admin creates an account with an email. The account has only Participant, and the Organizer role cannot be assigned yet.
2. The User verifies the email. Admin assigns Organizer, and the User signs in again to get it.
3. Admin locks a signed-in User. That User's next action returns to sign-in, and signing in is refused.
4. Admin unlocks the User, who signs in again.
5. Admin tries to lock themselves and to remove their own Admin role. Both are refused.
6. Admin locks a Partner organization. The Partner cannot send a new Booth request and sees why.
7. The Organizer sees the lock label, cannot approve, and can reject.
8. Admin unlocks the organization, and the Partner can send the request.
9. The audit log shows each step with the correct actor and reason.
10. The dashboard figures match the data.
11. The User resets a forgotten password, and an earlier Session stops working.
12. An Admin without Organizer cannot reach Organizer data.

## 9. Acceptance Criteria delivery map

| Criteria | Unit |
| --- | --- |
| `AC-A01-S11-07`, `AC-A01-S11-09`, `AC-A02-S11-03`, `AC-A04-S11-01` to `05`, `AC-ADM-S11-01`, `02`, `AC-S11-REG-01` to `03` | PR A1 |
| `AC-A01-S11-01` to `06`, `08`, `AC-A02-S11-01`, `02`, `04` to `06`, `AC-ADM-S11-03` | Developer B |
| `AC-A03-S11-01`, `02`, `AC-A05-S11-01` to `05`, `AC-E-S11-01` to `06`, `AC-D-S11-01` to `03`, `AC-S11-REG-05` | Developer C |
| `AC-G03-S11-01` to `06` | PR A2 |
| `AC-S11-REG-04`, `06` | Every pull request, closed by Developer A |

## 10. Commit and PR audit checklist

- The diff contains only the package's files and the criteria it claims.
- No fixed password, token or credential appears in code, logs or tests.
- Each new command has rejection, repeat and audit coverage.
- Each screen has its loading, empty, forbidden, expired-session and failure states.
- No call remains to an endpoint missing from the backend.
- Docs are updated if behavior differs from the contract.

## 11. Completion gate

Sprint 11 closes when every remaining criterion has evidence, focused tests and CI are green on merged code, the smoke steps above are
done, and `SPRINT_11_CLOSURE_REPORT.md`, `12_Physical_ERD_Report.md`, `CURRENT_SPRINT.md` and `AI_CONTEXT.md` reflect the result. Any
criterion moved out of the Sprint must be recorded by amendment, not silently dropped.
