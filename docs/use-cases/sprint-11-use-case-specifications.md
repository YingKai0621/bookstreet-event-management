# Sprint 11 System Admin Use Case Specifications

- Status: `IMPLEMENTED - CLOSURE VALIDATION PENDING`
- Prepared date: `2026-11-07`
- Scope: `UC-A01` through `UC-A05`, the Admin workspace, the effects of a locked organization, and the password-reset part of `UC-G03`

## 1. Source and traceability

Read this specification with:

- `docs/requirements/05_Business_Rules.md`, especially `BR-64`, `BR-73` through `BR-76` and `BR-112` through `BR-120`
- `docs/requirements/06_Use_Case_List.md` and `docs/requirements/08_MVP_Scope_v2.md`
- `docs/sprints/sprint-11.md`, which owns the Acceptance Criteria referenced here

If this specification conflicts with a Business Rule, the Business Rule governs and this document must be corrected.
Exact paths, fields and error codes belong to the Sprint 11 API Contract.

## 2. Shared actors and preconditions

### 2.1 Actors

- **System Admin**: administers accounts, roles, Badges, Partner organization status and the audit log. Admin does
  not operate Events for an Organizer.
- **Partner representative** and **Event Organizer**: affected by a locked organization.
- **User**: any registered person recovering their own account.
- **System**: enforces access, writes audit rows and sends email after commit.

### 2.2 Admin preconditions

- Admin has a valid Session, an `ACTIVE` account, a verified email and the `ADMIN` role.
- Every mutation carries the existing CSRF proof.

### 2.3 Shared rules for Admin commands

- A rejected command changes nothing and writes no audit row.
- A command that repeats the current state returns that state, changes nothing and writes no audit row.
- A successful change and its audit row commit together. If the audit write fails, the change rolls back.
- A required reason contains 10 to 500 characters after normalization and is stored only in the audit log.
- Email is sent only after commit, and an email failure does not roll back the change.

### 2.4 Shared screen states

Each Admin list or detail distinguishes loading, populated, empty, filtered-empty where filters exist, forbidden,
expired-session and failure states. A failed request is never shown as empty data or zero. A failed action stays
visible and the screen shows no unconfirmed change.

## 3. UC-A01 Manage Accounts

### Goal

Admin keeps accounts accurate and can stop an account from using the system.

### Main flow A: Browse accounts

1. Admin opens account management.
2. System shows a paged list with username, full name, email and verification state, roles and status.
3. Admin may search and filter by role or status. Each page keeps the same search and filters.

### Main flow B: Create an account

1. Admin enters username, full name, initial password and optionally email and phone.
2. System validates the input under `BR-64` and checks uniqueness.
3. System creates an `ACTIVE` account with only `PARTICIPANT` and an unverified email, and writes the audit row.
4. If an email was supplied, System sends a verification message after commit.
5. Admin gives the initial password to the User outside the system. System never shows or stores it in readable form.

### Main flow C: Update an account

1. Admin edits the full name, phone, or an unverified email of another account.
2. System validates the input and saves it with an audit row.
3. If the unverified email changed, System revokes any pending verification and sends a new one after commit.

### Main flow D: Lock or unlock an account

1. Admin chooses lock or unlock and enters a reason.
2. System changes the status with an audit row.
3. After a lock, the account's existing Sessions stop working from their next request, and its open Notification
   streams close.
4. After an unlock, the User signs in again. Sessions from before the lock do not resume.

### Exception flows

- Invalid input, or a duplicate username or email: the command is rejected with a specific error.
- Admin tries to update their own account here: rejected. Admin uses their profile instead.
- Admin tries to change a verified email: rejected.
- Admin tries to lock their own account or the last active Admin: rejected.
- Unknown account: not found.
- A status other than `ACTIVE` or `DISABLED`, or a missing or invalid reason: rejected.

### Postconditions

Locking changes no domain data owned by the account, so its Events, applications and other records stay as they
are. An Organizer who is locked keeps Event ownership.

### Known limit

No flow in Sprint 11 changes a verified email, because neither Admin nor the existing profile API can do so.

### Acceptance Criteria

`AC-A01-S11-01` through `AC-A01-S11-09`.

## 4. UC-A02 Manage Roles

### Goal

Admin gives a User the role they need and removes it when it is no longer appropriate.

### Main flow A: Assign a role

1. Admin selects an account and one of `PARTNER`, `ORGANIZER` or `ADMIN`.
2. System verifies that the account is `ACTIVE` with a verified email.
3. System adds the role with an audit row.
4. The role takes effect after the User signs in again, under `BR-76`.

### Main flow B: Remove a role

1. Admin selects a role the account holds.
2. System checks the removal guards.
3. System removes the role with an audit row.
4. The role stops granting access from the next request, and open Notification streams for that role close.

### Exception flows

- `PARTICIPANT` or an unknown role: rejected.
- Assign to an account that is locked or has no verified email: rejected, and the screen explains why.
- Remove their own `ADMIN`, or the `ADMIN` of the last active Admin: rejected.
- Remove `ORGANIZER` while the User owns a `DRAFT`, `PUBLISHED` or `ONGOING` Event: rejected.
- Remove `PARTNER` while the User represents an `ACTIVE` organization: rejected. Admin locks the organization first.

### Postconditions

Removing a role deletes no domain data. An Organizer's `COMPLETED` or `CANCELLED` Events keep their
`organizerUserId` as history.

### Acceptance Criteria

`AC-A02-S11-01` through `AC-A02-S11-06`.

## 5. UC-A03 Manage Badges

### Goal

Admin manages Badge definitions and thresholds as today, with each change now recorded.

### Main flow

1. Admin lists, creates or updates a Badge, or runs award synchronization, through the existing behavior.
2. System writes an audit row for each committed create, update and synchronization. Reads write none.

### Exception flows

Existing Badge validation and conflict behavior stay unchanged.

### Acceptance Criteria

`AC-A03-S11-01` and `AC-A03-S11-02`.

## 6. UC-A04 Review Audit Logs

### Goal

Admin finds out who changed what, when and why.

### Main flow

1. Admin opens the audit log.
2. System shows a paged, newest-first list with acting Admin, action, target, reason and time.
3. Admin may filter by actor, action, target and date range. Dates follow `Asia/Ho_Chi_Minh`.

### Exception flows

- A non-Admin is denied.
- An unsupported filter or date value is rejected rather than ignored.
- No match shows a genuine filtered-empty state.

### Postconditions

Reading changes nothing. No flow edits or deletes a row, and rows contain no password, token or Session data.

### Acceptance Criteria

`AC-A04-S11-01` through `AC-A04-S11-05`.

## 7. UC-A05 Manage Partner Organizations

### Goal

Admin sees Partner organizations and can stop one from taking on new work.

### Main flow A: Browse and read

1. Admin opens Partner organizations.
2. System shows a paged list with name, category, status and representative. Admin may search and filter by status.
3. Admin opens one organization to read its profile, status and representative.

### Main flow B: Lock or unlock

1. Admin chooses lock or unlock and enters a reason.
2. System changes the status with an audit row.
3. The effects in section 8 apply from the next command that checks the status.

### Exception flows

- Unlock while the representative lacks `PARTNER`: rejected, and the screen explains why.
- A status other than `ACTIVE` or `INACTIVE`, or a missing or invalid reason: rejected.
- Unknown organization: not found.
- A non-Admin, including the representative, is denied.

### Postconditions

No flow edits the profile or deletes the organization. The representative's account and roles do not change.

### Acceptance Criteria

`AC-A05-S11-01` through `AC-A05-S11-05`.

## 8. Effects of a locked organization

This section refines existing Partner and Organizer Use Cases under `BR-117` and creates no new Use Case.

### 8.1 What stops

| Actor | Blocked while `INACTIVE` |
| --- | --- |
| Partner representative | Submit an application, Booth request, Activity proposal or resubmission, or Activity change or cancellation request; start a new Payment |
| Organizer | Approve an application, select a Booth request, approve a proposal, request changes to a proposal, approve an Activity request |
| System | Send `PARTNER_EVENT_PUBLISHED` and `PARTNER_BOOTH_HOLD_EXPIRING` to that organization |

### 8.2 What continues

| Actor | Still allowed while `INACTIVE` |
| --- | --- |
| Partner representative | Sign in, read history, edit the organization profile, withdraw open requests |
| Organizer | Reject a pending item, directly cancel an Activity, cancel an Event under `BR-09` |
| System | Process a trusted callback for a Payment already started, expire Holds, run lifecycle closures, create `BR-104` outcome Notifications |

### 8.3 Exception flows

- A blocked command returns one stable error and creates no row.
- If a Payment already started succeeds while the organization is locked, the Assignment is created as usual, because
  money was already taken and refunds are out of scope.
- An Organizer screen labels the organization as locked and disables blocked actions; the backend still enforces each
  block.

### 8.4 Postconditions

Locking changes no existing application, request, Hold, Payment, Assignment or Activity. Unlocking restores
eligibility and changes nothing else. Items that closed during the lock stay closed.

### Acceptance Criteria

`AC-E-S11-01` through `AC-E-S11-06`.

## 9. Admin workspace

### Main flow A: Dashboard

1. Admin opens the dashboard.
2. System calculates accounts per role, Events by status, active Booth assignments, revenue and audit rows per day from
   durable data, and may show recent audit rows from `UC-A04`.

### Main flow B: Profile

1. Admin opens their profile, which uses the existing self-service profile behavior.
2. Admin edits the full name and phone. The screen offers no password action.

### Exception flows

- A dashboard failure is shown as a failure, never as zero.
- A former Facilities, Assets, Booth catalog or System Settings URL leads to a safe Admin page.

### Acceptance Criteria

`AC-D-S11-01` through `AC-D-S11-03` and `AC-ADM-S11-01` through `AC-ADM-S11-03`.

## 10. UC-G03 Reset a forgotten password

This delivery unit is last and may move to the next Sprint.

### Goal

A User who forgot their password regains access through their own verified email.

### Main flow A: Request a reset

1. User opens the request page from sign-in and enters an email.
2. System always shows the same neutral confirmation.
3. If the email belongs to an `ACTIVE` account and is verified, and the issue limits allow it, System issues a token and
   sends a link after commit.

### Main flow B: Set a new password

1. User opens the link and enters a new password that satisfies `BR-64`, with confirmation.
2. System verifies the token, changes the password and marks the token used.
3. System revokes remaining reset tokens and makes the User's earlier Sessions unusable.
4. User signs in with the new password.

### Exception flows

- A wrong, expired, used or revoked token: the same generic error, and nothing changes.
- An unknown, unverified or locked email, or a reached issue limit: the same neutral confirmation, and no mail.
- A mail failure: the token is revoked and the response stays neutral.
- A User with no verified email cannot use this flow, and Admin cannot reset the password for them.

### Postconditions

Raw tokens never appear in logs. A reset does not unlock a locked account and writes no audit row, because it is not an
Admin action.

### Acceptance Criteria

`AC-G03-S11-01` through `AC-G03-S11-06`.

## 11. Regression boundary

`AC-S11-REG-01` through `AC-S11-REG-06` apply across all sections. For `ACTIVE` organizations and accounts, existing
behavior keeps its statuses, guards and response meaning. An Admin without `ORGANIZER` cannot use `/organizer`
operations.

## 12. Booth Payment history (`S11-7`, scheduled 2026-11-10)

### Goal

Admin oversees every Booth Payment in the system, and each Organizer follows the Payments of their own Events. Neither
changes a Payment: the gateway flow and the reconciliation worker remain the only writers.

### Main flow A: Admin oversight

1. Admin opens Payment history.
2. System shows a paged list, newest first, of every Booth Payment with its Event, Partner organization, Booth, amount,
   status and whether it needs reconciliation, including `PENDING` ones.
3. Admin may search, filter by status, Event, reconciliation or date, and sort by time or amount.
4. Admin opens one Payment to read its gateway, gateway reference, failure code and times.

### Main flow B: Organizer follow-up

1. The Organizer opens Payment history in their workspace.
2. System shows only the Booth Payments of the Events this Organizer owns, with the money collected under the current
   filters.
3. The Organizer may choose one of their Events, search, filter by status or date, and sort by time or amount. The
   collected total ignores the status filter.

### Exception flows

- An unsupported filter or sort, or a start date after the end date: rejected; the screen explains a reversed date
  range before sending it.
- An Event the Organizer does not own: matches nothing.
- A load failure: shown as an error, never as an empty history or zero collected.
- Any attempt to change a Payment: no such operation exists.

### Postconditions

Nothing changes and no audit row is written. The Organizer view never shows gateway details.

### Source note

Both views follow `BR-121`. Admin oversight also answers the optional criterion `AC-OPT-S11-01` and, like the dashboard of
`BR-119`, is part of the Admin workspace rather than a separate Use Case. The Organizer view belongs to
`UC-O08 View Event Reports`.

### Acceptance Criteria

`AC-OPT-S11-01` and `AC-ORG-PAY-S11-01` through `AC-ORG-PAY-S11-03`.
