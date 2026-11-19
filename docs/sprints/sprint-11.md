# Sprint 11 System Admin Management

- Status: `ACTIVE - IMPLEMENTATION MERGED, CLOSURE VALIDATION PENDING`
- Approved documentation: PR #141, merge commit `7604f06`
- Prepared date: `2026-11-07`
- Previous completed Sprint: Sprint 10 Role-Scoped In-App Notifications
- Current production schema baseline: immutable Flyway migrations `V1` through `V18`
- Implemented schema change: `V18__create_admin_audit_log.sql`
- Business Rules: `BR-112` through `BR-120` in `docs/requirements/05_Business_Rules.md`
- Use Cases: `UC-A01` through `UC-A05` and the password-reset part of `UC-G03`

This document is the active Sprint 11 baseline. It authorizes only the reviewed delivery units below.

### Editor image upload extension — 2026-11-09

The user requested retaining local image selection and preview while correcting the new upload API's
business boundaries. The feature-scoped extension is specified in
`docs/api/content-image-upload-api-contract.md`. It supports existing UC-A03/UC-O06/UC-E05 image URL
fields, keeps the 51 original criteria and schema unchanged, and adds separate upload verification
criteria in that contract. It does not activate Admin asset management or general media CRUD.

### Booth Payment history extension — 2026-11-10

The user scheduled unit `S11-7` for Booth Payments only: `AC-OPT-S11-01` gives Admin a read-only, system-wide
Payment history. The same request added a read-only history for each Organizer, limited to the Events they own,
as `AC-ORG-PAY-S11-01` through `AC-ORG-PAY-S11-03` in section 7. Both views read existing tables through one
shared query, add no migration, table, column, status or Notification type, and change no Payment.
`AC-OPT-S11-02` (the read-only Event list) stays unscheduled. The operations are specified in section 16 of
`docs/api/sprint-11-api-contract.md` and the flows in section 12 of
`docs/use-cases/sprint-11-use-case-specifications.md`.

The rule is recorded as `BR-121` in `05_Business_Rules.md`, approved by the user on 2026-11-10. In
`06_Use_Case_List.md` the Organizer view belongs to `UC-O08 View Event Reports`, and the Admin view is read-only
oversight in the Admin workspace like the dashboard, so the active Use Case total stays 28.

## 1. Goal

Turn the Admin workspace into a real administration area:

1. Accounts, roles and Badges work through real, validated, audited operations.
2. A locked account or removed role stops working immediately, across the whole system.
3. Admin can lock a Partner organization, and that lock blocks new work without cancelling existing work.
4. Every administrative change appears in an append-only audit log.
5. The dashboard shows only real system-wide data.
6. Users can recover their own account through a safe password-reset flow.

The Sprint adds no refund, no Admin emergency cancellation and no change to the meaning of existing Event, Booth,
Payment or Activity statuses.

## 2. Included Use Case slices

| Use Case | Slice |
| --- | --- |
| `UC-A01 Manage Accounts` | Paged list, create, update, lock and unlock |
| `UC-A02 Manage Roles` | Assign and remove `PARTNER`, `ORGANIZER`, `ADMIN` |
| `UC-A03 Manage Badges` | Keep existing behavior and add audit |
| `UC-A04 Review Audit Logs` | New: read, search and filter the audit log |
| `UC-A05 Manage Partner Organizations` | New: read organizations, lock and unlock them |
| `UC-G03 Manage Account Access` | Complete the missing password reset |

The Admin dashboard and profile are part of the Admin workspace. The Partner and Organizer effects of a locked
organization refine existing Use Cases. The active MVP Use Case count is 28.

## 3. Current state

These findings come from reading `main` at `faac65d`. They were not all confirmed by running the application.

| Area | Finding | Sprint 11 response |
| --- | --- | --- |
| Account status display | The API returns `locked`/`active`, but `adminApi.getUsers` compares with `DISABLED`, so a locked account appears active | `AC-A01-S11-08` |
| Account status command | `reason` is ignored, any unknown value becomes `ACTIVE`, and nothing prevents self-lock or locking the last Admin | `AC-A01-S11-05`, `AC-A01-S11-06` |
| Create account | An omitted password becomes the fixed value `BookStreet@123`; email is marked verified automatically; an advanced role can be assigned at creation; an invalid role silently becomes `PARTICIPANT` | `AC-A01-S11-02`, `AC-A01-S11-03` |
| Update account | Role can only be added, never removed; status can change without a reason; a verified email can be replaced and stay verified | `AC-A01-S11-04`, `AC-A02-S11-01` |
| Admin password reset | Sets the fixed password `BookStreet@123` and returns `dummy-token` | `AC-A01-S11-09` |
| Disabled Session | Blocked on Notification APIs only | `AC-A01-S11-07` |
| Role removal | A Session keeps its stored authorities | `AC-A02-S11-03` |
| Partner organization | Created as `ACTIVE`; no operation can make it `INACTIVE` | `AC-A05-S11-03` |
| Organization checks | Application, Booth request and selection check `ACTIVE`; Activity proposal does not; Activity requests and Payment initiation were not confirmed | `AC-E-S11-01`, `AC-E-S11-02` |
| Dashboard | Booth and Activity counts and the daily audit series are hard-coded to zero, and it loads together with audit logs that have no API | `AC-D-S11-01`, `AC-D-S11-02` |
| Screens with no backend | Roles & Permissions, System Settings, Audit Logs and Profile call `/admin/roles`, `/admin/permissions`, `/admin/settings`, `/admin/audit-logs`, `/admin/profile` | `AC-ADM-S11-01` to `AC-ADM-S11-03`, `AC-A04-S11-05` |
| Admin access | `/organizer/**` and three Organizer application controllers allow `ADMIN`, contrary to `BR-119` | `AC-S11-REG-03` |
| Password change | No API lets a User change their own password. The Admin profile calls a missing API and the Partner action is a stub | Outside this Sprint; see section 4.2 |

## 4. Scope lock

### 4.1 In scope

- account, role and Badge administration under `BR-112` through `BR-115`
- system-wide enforcement of disabled accounts and removed roles under `BR-114`
- Partner organization lock and unlock with its effects under `BR-116` and `BR-117`
- an append-only audit log under `BR-118`
- a real read-only dashboard under `BR-119`
- removal of Admin screens and APIs outside the approved scope
- password reset under `BR-120`, as the last and separately deferrable delivery unit
- two Sprint 10 debt items: the stale Partner assigned-booth tests and the unused `notificationPreferences` field

### 4.2 Explicitly out of scope

- Permission or RolePermission model, generic System Settings, facilities, assets or booth catalog on Admin
- Admin viewing or resetting another User's password
- a User changing their own password while signed in; the Admin profile drops its broken action, and the Partner
  stub stays recorded as debt
- Admin notification types or producers
- Admin emergency cancellation, refunds, manual Payment or Assignment changes
- Admin editing a Partner profile, deleting an organization, or operating an Event for an Organizer
- automatic cancellation of any record when an organization or account is locked
- audit of non-administrative actions, sign-ins or reads
- Partner notification when an organization is locked or unlocked
- mobile layout work for the Admin workspace
- redrawing Use Case Diagram V2 and the physical ERD drawio, recorded as documentation debt

## 5. Delivery units

Units are delivered in this order. Each needs a focused review with evidence mapped to the criteria it owns.

1. `S11-1` Security and cleanup: enforcement, `/organizer/**` authority, removal of out-of-scope screens and APIs.
2. `S11-2` Audit foundation: migration, writer and read API.
3. `S11-3` Accounts, roles and the Admin profile, with audit.
4. `S11-4` Partner organizations and their effects, with Badge audit.
5. `S11-5` Dashboard and Sprint 10 debt.
6. `S11-6` Password reset. It may move to the next Sprint without affecting units 1 to 5; if it does, its six
   criteria leave this baseline by a recorded amendment.
7. `S11-7` Optional read-only oversight. It is outside the baseline count and enters only by a recorded decision
   after units 1 to 5 are merged. Scheduled on 2026-11-10 for Booth Payments only, together with the Organizer
   Payment history; see section 7.

## 6. Acceptance Criteria

### 6.1 Accounts

1. `AC-A01-S11-01`: Admin lists accounts through server-side paging with search by username, full name or email,
   filters by role and status, and a stable sort. Unsupported query values are rejected. No response contains a
   password hash or token.
2. `AC-A01-S11-02`: creating an account requires a username, full name and initial password that satisfy `BR-64`.
   There is no default password. The account starts `ACTIVE` with only `PARTICIPANT`, and the operation accepts no
   role or status input. A duplicate username or email returns a stable conflict code, and invalid input returns a
   validation error rather than a server error.
3. `AC-A01-S11-03`: a supplied email on a new account stays unverified and receives a verification email after
   commit. An email failure does not roll back the account.
4. `AC-A01-S11-04`: updating another account changes only full name, phone and an unverified email. Changing an
   unverified email clears any pending verification and issues a new one after commit. A verified email or the
   Admin's own account is rejected with a stable code. The operation accepts no role or status input.
5. `AC-A01-S11-05`: the status command accepts only `ACTIVE` and `DISABLED` and requires a reason of 10 to 500
   characters after normalization. Any other value is rejected without change. Repeating the current status returns
   that status, changes nothing and writes no audit row.
6. `AC-A01-S11-06`: Admin cannot lock their own account or the last active Admin. Concurrent commands cannot leave
   the system with no active Admin.
7. `AC-A01-S11-07`: from the next request after a lock commits, the account's existing Sessions cannot use any
   authenticated API, and its open Notification streams close. The account cannot sign in until unlocked, and after
   unlocking it must sign in again because earlier Sessions do not resume. Public endpoints stay available without
   authentication.
8. `AC-A01-S11-08`: the Admin user screen shows the real status, verification state and every role of each account,
   uses server paging, and distinguishes loading, empty, filtered-empty, forbidden, expired-session and failure
   states. Lock and unlock require a reason in the UI, and a failed action is visible and changes nothing on screen.
9. `AC-A01-S11-09`: the Admin password-reset operation and its UI no longer exist, and no fixed password remains in
   application code. Admin has no operation that reads or sets another User's password.

### 6.2 Roles

10. `AC-A02-S11-01`: dedicated operations assign and remove only `PARTNER`, `ORGANIZER` and `ADMIN`. `PARTICIPANT` or
    an unknown role is rejected with a stable code. Repeating an assign or remove returns the current roles, changes
    nothing and writes no audit row.
11. `AC-A02-S11-02`: assigning a role requires an `ACTIVE` account with a verified email. A newly assigned role takes
    effect only after the User signs in again, as `BR-76` requires.
12. `AC-A02-S11-03`: a removed role stops granting access from the next request, in existing Sessions, without
    signing in again, and open Notification streams for that role close.
13. `AC-A02-S11-04`: Admin cannot remove their own `ADMIN` role or the `ADMIN` role of the last active Admin.
    Concurrent commands cannot leave the system with no active Admin.
14. `AC-A02-S11-05`: `ORGANIZER` cannot be removed while the User owns a `DRAFT`, `PUBLISHED` or `ONGOING` Event, and
    `PARTNER` cannot be removed while the User represents an `ACTIVE` organization. Each returns its own stable code
    and changes nothing.
15. `AC-A02-S11-06`: the Admin role screen assigns and removes roles per User, explains why an action is unavailable,
    and shows no Permission concept.

### 6.3 Badges

16. `AC-A03-S11-01`: Badge create, update and award synchronization keep their current behavior and also write audit
    rows. Reads write no audit row.
17. `AC-A03-S11-02`: the frontend uses only the real Badge API, and the retired `/admin/badge-rules` calls are removed.

### 6.4 Audit log

18. `AC-A04-S11-01`: each action listed in `BR-118` writes one audit row in the same transaction with the acting
    Admin, action, target type, target id, reason when required, and backend time.
19. `AC-A04-S11-02`: if the audit write fails, the administrative change rolls back. A rejected command or a repeat that
    changes nothing writes no row.
20. `AC-A04-S11-03`: audit rows contain no password, password hash, token or Session data.
21. `AC-A04-S11-04`: only Admin can read the audit log, through server-side paging with filters by actor, action, target
    and date range and a stable newest-first order. Unsupported values are rejected. No API updates or deletes a row.
22. `AC-A04-S11-05`: the Admin audit screen uses the real API with the same filters and genuine loading, empty,
    filtered-empty, forbidden, expired-session and failure states.

### 6.5 Partner organizations

23. `AC-A05-S11-01`: Admin lists organizations through server-side paging with search by name or representative and
    a status filter. Unsupported values are rejected.
24. `AC-A05-S11-02`: Admin reads an organization's profile, status and representative. No operation edits the profile
    or deletes the organization.
25. `AC-A05-S11-03`: Admin changes status between `ACTIVE` and `INACTIVE` with a reason of 10 to 500 characters after
    normalization, and the change writes an audit row. Repeating the current status returns it, changes nothing and
    writes no audit row. Only Admin can do this; the representative cannot.
26. `AC-A05-S11-04`: an organization cannot be unlocked while its representative lacks `PARTNER`; the command returns a
    stable code and changes nothing.
27. `AC-A05-S11-05`: the Admin organization screen provides the list, detail, and lock and unlock with a required
    reason, and distinguishes loading, empty, filtered-empty, forbidden, expired-session and failure states.

### 6.6 Effects of a locked organization

28. `AC-E-S11-01`: while an organization is `INACTIVE`, its representative cannot submit an application, Booth request,
    Activity proposal or resubmission, or Activity change or cancellation request. Each returns one stable code and
    creates no row.
29. `AC-E-S11-02`: while `INACTIVE`, a new Payment cannot start. A trusted callback for a Payment already started is
    still processed, and a Hold still expires through the existing flow.
30. `AC-E-S11-03`: while `INACTIVE`, Organizer cannot approve an application, select a Booth request, approve a proposal,
    request changes to a proposal, or approve an Activity request of that organization. Organizer can still reject a
    pending item and directly cancel an Activity.
31. `AC-E-S11-04`: a locked organization receives neither `PARTNER_EVENT_PUBLISHED` nor `PARTNER_BOOTH_HOLD_EXPIRING`
    while `INACTIVE`. Outcome Notifications under `BR-104` are still created. Locking and unlocking create no
    Notification.
32. `AC-E-S11-05`: locking changes no existing application, request, Hold, Payment, Assignment or Activity, and creates
    no refund. The representative can still sign in, read history, edit the organization profile and withdraw open
    requests. Unlocking restores eligibility with no other data change.
33. `AC-E-S11-06`: the Partner workspace explains that the organization is locked and disables blocked actions. The
    Organizer queue labels the organization as locked and disables blocked actions. The backend enforces every block
    regardless of the UI.

### 6.7 Dashboard

34. `AC-D-S11-01`: the dashboard returns accounts per role, with a multi-role User counted in each role, Events by status,
    active Booth assignments, revenue as the sum of `SUCCESS` Payments of type `PAYMENT`, and audit rows per day in
    `Asia/Ho_Chi_Minh`, all calculated from durable data.
35. `AC-D-S11-02`: no dashboard value is hard-coded or simulated, and the dashboard needs no recent-activity endpoint
    outside this baseline. It changes no data.
36. `AC-D-S11-03`: the dashboard screen distinguishes loading, genuine zero values, forbidden, expired-session and
    failure states. A failure is never shown as zero.

### 6.8 Admin workspace

37. `AC-ADM-S11-01`: Facilities, Assets, Booth catalog and System Settings leave the Admin navigation and routes. Their
    former URLs lead to a safe Admin page rather than a broken one.
38. `AC-ADM-S11-02`: the Admin workspace calls no endpoint missing from the backend, including `/admin/permissions`,
    `/admin/settings`, `/admin/badge-rules` and `/admin/feedbacks/stats`.
39. `AC-ADM-S11-03`: the Admin profile reads and updates through the existing `/auth/profile` API and offers no password
    action.

### 6.9 Password reset

40. `AC-G03-S11-01`: a public request accepts an email and always returns the same response, whether the email exists,
    is unverified, or belongs to a locked account. Only an `ACTIVE` account with that verified email receives mail,
    after commit.
41. `AC-G03-S11-02`: a reset token uses `user_tokens` type `PASSWORD_RESET`, stores only a SHA-256 hash, expires after 30
    minutes, works once, and never appears in logs. A new token revokes earlier ones of that type.
42. `AC-G03-S11-03`: each User has at least 60 seconds between issued tokens and at most 5 per hour, without revealing
    through the response whether a limit applied.
43. `AC-G03-S11-04`: a valid token and a new password that satisfies `BR-64` change the password. A wrong, expired, used
    or revoked token returns the same generic error and changes nothing.
44. `AC-G03-S11-05`: a successful reset invalidates the remaining tokens and makes that User's earlier Sessions unusable.
45. `AC-G03-S11-06`: public pages provide the request and reset steps with validation, neutral confirmation and clear
    failure states. Sign-in links to the request page.

### 6.10 Regression and scope

46. `AC-S11-REG-01`: the new migration applies to a clean database and to a V17 database. Hibernate validation passes, V1
    through V17 are unchanged, and no table or column is added beyond the reviewed Physical ERD overlay.
47. `AC-S11-REG-02`: every `/admin` operation requires a verified `ADMIN` Session and every mutation requires existing
    CSRF proof. No JWT, bearer token or client-selected actor is introduced.
48. `AC-S11-REG-03`: an Admin without `ORGANIZER` cannot use `/organizer` operations, including application review and the
    Organizer dashboard. Organizer access to those operations is unchanged.
49. `AC-S11-REG-04`: for `ACTIVE` organizations and accounts, existing Event, Partner, Booth, Payment, Activity, Reward,
    Feedback, Heritage and Notification behavior keeps its statuses, guards, response meaning and idempotency.
50. `AC-S11-REG-05`: `partner-assigned-booths-ui.spec.ts` is corrected to match current behavior and passes, and the unused
    `notificationPreferences` field is removed.
51. `AC-S11-REG-06`: frontend lint and build pass, and focused browser tests cover the new and changed Admin, Partner and
    Organizer states.

The baseline contains **51 Acceptance Criteria**: 9 accounts, 6 roles, 2 Badges, 5 audit, 5 organizations, 6 locked
organization effects, 3 dashboard, 3 workspace, 6 password reset, and 6 regression.

## 7. Optional oversight

These read-only criteria are outside the 51 and enter only under section 5, unit `S11-7`.

- `AC-OPT-S11-01` (scheduled 2026-11-10): Admin lists Booth Payments across Events with status and date filters,
  including `PENDING` ones, and cannot change them. Responses contain no gateway secret or raw callback data.
- `AC-OPT-S11-02` (not scheduled): Admin lists all Events with their status and responsible Organizer, and cannot
  change them.

### 7.1 Organizer Payment history

Added with `S11-7` on 2026-11-10, also outside the 51:

- `AC-ORG-PAY-S11-01`: an Organizer lists the Booth Payments of the Events they own, through server-side paging with
  status, Event, date and search filters and a stable sort. A Payment of another Organizer's Event never appears,
  and naming such an Event matches nothing rather than revealing that it exists. The Organizer cannot change a Payment.
- `AC-ORG-PAY-S11-02`: the response includes the money collected, the sum of `SUCCESS` Payments of type `PAYMENT` under
  the same filters except status, so looking at failed or pending attempts does not change the total. It uses the
  same definition as the Admin dashboard revenue in `BR-119`.
- `AC-ORG-PAY-S11-03`: the Organizer view leaves gateway details to Admin oversight. It contains no reconciliation
  flag, gateway reference, provider, failure code, checkout URL, idempotency key or failure text. The screen
  distinguishes loading, empty, filtered-empty and failure states, and a failure is never shown as zero collected.

## 8. Decisions recorded

| Decision | Result |
| --- | --- |
| Accounts created by Admin | Must verify email; demos use seeded verified accounts |
| Pending items of a locked organization | Organizer may reject; approving and requesting changes are blocked |
| Password reset | Included as the last deferrable unit, using the existing token table |
| Changing a password while signed in | Next Sprint; if password reset is deferred, both move together so a User always gains a way to change a password in the same delivery |
| Admin access to `/organizer` | Removed; a person who needs both gets both roles |
| Staff accounts and the reader workspace | An account with `ADMIN`, `ORGANIZER` or `PARTNER` works only in its staff workspaces. The frontend hides the reader menu, sends reader URLs to the staff workspace and explains that staff accounts do not join events as readers. `PARTICIPANT` stays in the database, so no rule, API or data changes; this is a navigation fix outside the 51 criteria |
| Admin password reset | Removed because it sets a fixed known password |
| Facilities, Assets, Booth catalog on Admin | Removed; Organizer manages Locations and Booths |
| Audit log | Kept as a real feature; requires a new migration |
| `S11-7` scope (2026-11-10) | Booth Payment history scheduled at the user's request; the read-only Event list (`AC-OPT-S11-02`) is not |
| Organizer Payment history (2026-11-10) | Added beside the Admin view, limited to owned Events and without gateway details; recorded as `BR-121` and within `UC-O08` |
| `TIMEOUT` Payment label | Shown as "Hết hạn". It is a real status: the reconciliation worker sets it after the checkout expires and two trusted gateway queries still report the payment incomplete (`BR-58`, `BR-60`) |
