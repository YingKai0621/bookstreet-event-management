# Sprint 10 Role-Scoped In-App Notifications

- Status: `COMPLETED - 2026-11-07`
- Closure report: `docs/development/SPRINT_10_CLOSURE_REPORT.md`
- Prepared date: `2026-11-02`
- Activation date: `2026-11-03`
- Approved documentation merge: PR #116, merge commit `3a0a76b`
- Last product-scope revision: `2026-11-03`
- Last Acceptance Criteria revision: `2026-11-06` (section 12 amendment)
- Previous completed Sprint: Sprint 09 Heritage Public Content
- Current production schema baseline: immutable Flyway migrations `V1` through `V17`
- Implemented schema changes: `V16` and amendment `V17`, authored by Developer A (`YingKai0621`)
- Current-state audit: `docs/development/SPRINT_10_ROLE_NOTIFICATIONS_CURRENT_STATE_AUDIT.md`

This document is the completed Sprint 10 baseline. It authorized only the reviewed implementation units and
did not authorize code, producer, type, role, reference, or delivery-channel changes outside this scope.

## 1. Goal

Extend the existing durable Participant notification foundation into one role-scoped in-app inbox:

1. Participant behavior remains compatible with the six implemented notification types.
2. Partner representatives receive important outcomes that affect their organization.
3. Event Organizers receive new owner-scoped work items that require review.
4. Admin receives a real inbox API/UI foundation but no fabricated notification producer.
5. A multi-role account sees only the inbox for the role workspace currently in use.

The Sprint improves delivery and read state. It does not redesign the underlying Event, Booth, Payment,
Activity, Feedback, Reward, or Heritage workflows.

## 2. Included Use Case slices

Sprint 10 refines existing Use Cases only:

- Participant: `UC-P01`, `UC-P03`
- Partner: `UC-E01` through `UC-E06`
- Organizer: `UC-O03` through `UC-O06`
- Admin: access/read-state foundation related to the existing Admin workspace, without a new producer

Notification persistence and delivery remain supporting System behavior. The active MVP Use Case count
stays at 26.

## 3. Scope lock

### 3.1 In scope

- one role-scoped inbox for each exact role code: `PARTICIPANT`, `PARTNER`, `ORGANIZER`, `ADMIN`
- the existing PostgreSQL `notifications` table as the single durable store
- one reviewed Flyway overlay that backfills existing rows as `PARTICIPANT`
- owner-and-role-scoped list, unread count, mark-one-read, and mark-all-read operations
- server-side paging and filtering by read state and role-compatible type
- atomic, retry-safe notification creation with stable deduplication keys
- atomic first-read semantics that preserve the first committed `readAt`
- exact role authorization in addition to owner isolation
- Partner and Organizer producers listed in sections 5 and 6
- Admin list/read UI and API with a genuine empty state and no producer
- real loading, populated, empty, filtered-empty, forbidden, expired-session, and failure UI states
- bounded refresh on workspace entry, when the inbox or notification popover opens, and after a read
  mutation; browser-focus refresh is not required in Sprint 10
- focused migration, backend, frontend, security, transaction, concurrency, and browser verification

### 3.2 Explicitly out of scope

- email changes, SMS, mobile push, WebSocket, background polling, or SSE beyond the `BR-111` signal
- notification preferences, quiet hours, subscriptions, templates, or a broadcast composer
- General Feedback broadcast to every Organizer
- a notification for every Participant registration, Booth visit, point award, or normal self-action
- Admin security alerts, unusual-login detection, account-registration alerts, or system monitoring
- notification deletion, archive, pinning, snooze, reply, assignment, or cross-role combined inbox
- NotificationType table, sender User, delivery-attempt table, or transactional outbox
- changing Event, Booth, Payment, Activity, Feedback, Heritage, Certificate, or Badge lifecycle semantics
- modifying Flyway V1 through V15

## 4. Approved business-rule lock

The rules in this section are defined by active `BR-102` through `BR-109` in
`docs/requirements/05_Business_Rules.md`:

1. `BR-102 — Audience boundary`: every Notification belongs to one User and one exact role audience.
   List, unread count, mark-one, and mark-all use both values. Possessing another role never exposes or
   mutates that role's inbox through the current endpoint.
2. `BR-103 — Participant compatibility`: the six implemented Participant types, recipients,
   references, and producing transitions remain unchanged. Existing Participant rows become
   `PARTICIPANT` rows without losing `readAt`.
3. `BR-104 — Partner outcomes`: only the transitions in section 5 create `PARTNER` rows. The recipient
   is the representative User of the affected Partner organization at the committed transition.
4. `BR-105 — Organizer work items`: only the transitions in section 6 create `ORGANIZER` rows. The
   recipient is the owning `events.organizer_user_id` at the committed transition.
5. `BR-106 — Atomicity and deduplication`: the domain transition and its in-app Notification commit in
   one transaction. A retry of the same persisted transition creates no duplicate, while a later legitimate
   transition cycle has a distinct stable identity.
6. `BR-107 — First-read semantics`: unread means `readAt` is null. A read command updates only an
   unread row for the authenticated User and endpoint role. The first committed timestamp is preserved
   under retries and concurrent mark-one/mark-all commands.
7. `BR-108 — Cascade suppression`: a parent cancellation or terminal workflow outcome must not create
   both a summary and redundant intermediate/child outcomes. The exact precedence rules are in section 5.2.
8. `BR-109 — Channel and noise boundary`: Sprint 10 adds no email behavior, SMS, push, WebSocket,
   polling, preferences, composer, sender, NotificationType entity, or outbox. General
   Feedback remains a shared queue. Existing email behavior remains unchanged and after commit. Admin has
   a real empty inbox foundation but no producer or fabricated type.

### 4.1 Role-scoped ownership

Every row belongs to one `recipientUserId` and one `recipientRole`. The role is an authorization boundary,
not display metadata.

- Participant inbox operations read only `PARTICIPANT` rows for the authenticated User.
- Partner inbox operations read only `PARTNER` rows for the authenticated User.
- Organizer inbox operations read only `ORGANIZER` rows for the authenticated User.
- Admin inbox operations read only `ADMIN` rows for the authenticated User.

A multi-role User may use more than one workspace, but each endpoint remains isolated. The Sprint does not
introduce a combined inbox or a client-supplied role selector. Exact endpoint paths are defined by the
reviewed API Contract.

### 4.2 Durable creation and read state

The deduplication identity is derived from persisted transition evidence, not message text or a newly
generated clock value. Uniqueness is per recipient User, recipient role, and deduplication key.

Mark-one and mark-all:

- update only rows owned by the authenticated User and endpoint role
- update only rows whose `readAt` is null
- use backend time normalized to PostgreSQL precision
- never change an existing `readAt`
- remain idempotent under retries and concurrent requests

An unknown, other-owner, or other-role identity returns the same ownership-safe not-found outcome.

### 4.3 Reference boundary

Each approved notification has one domain target. The frontend maps an approved reference type and id to a
role-owned route; notification text never stores a navigable URL. Exact response fields and unavailable
target presentation are defined by the reviewed API/UI contract, not promoted to Business Rules here.

### 4.4 Approved refresh policy

Sprint 10 has no background polling. An open workspace also refreshes on the `BR-111` signal (section 13). At minimum, a workspace fetches current data
on workspace entry, when the User opens the inbox or notification popover, and after a read mutation.
Browser-focus refresh is not required and continuous polling is prohibited.

## 5. Proposed Partner producers

The persisted audience is `PARTNER`. Unless section 5.2 overrides it, the recipient is the representative
User of the affected `PartnerOrganization`.

### 5.1 Exact transition matrix

| Domain | Exact committed transition | Notification target | Product meaning |
|---|---|---|---|
| Partner application | `PENDING → APPROVED` or `PENDING → REJECTED` | Partner application | The Organizer completed review. |
| Booth request | final committed state `SELECTED` after selection | Booth request | The Partner may proceed with payment. This applies only when the request remains `SELECTED` after the transaction. |
| Booth request | `PENDING → REJECTED` | Booth request | The Organizer rejected this request. |
| Booth request | `PENDING → NOT_SELECTED` | Booth request | Another candidate received the Assignment. |
| Booth request | `SELECTED → PAYMENT_EXPIRED` | Booth request | The Hold expired without trusted settlement. |
| Booth request | final committed state `COMPLETED` after trusted settlement or zero-price selection | Booth request | The Assignment was confirmed. Zero-price selection suppresses its intermediate `SELECTED` outcome and creates only this confirmation. |
| Activity proposal | `PENDING → NEED_CHANGES`, `PENDING → APPROVED`, or `PENDING → REJECTED` | Activity proposal | The Organizer reviewed the submitted proposal. |
| Activity proposal | `PENDING/NEED_CHANGES → CANCELLED` by System | Activity proposal | An open proposal was closed because its proposed time was reached or the Event completed. |
| Activity change request | `PENDING → APPROVED`, `PENDING → REJECTED`, or `PENDING → CANCELLED` | Activity request | The request was reviewed or became invalid through lifecycle progression. |
| Activity cancellation request | `PENDING → APPROVED`, `PENDING → REJECTED`, or `PENDING → CANCELLED` | Activity request | The request was reviewed or became invalid through lifecycle progression. |
| Event | `PUBLISHED → CANCELLED` | Event | The Partner has a `PENDING` or `APPROVED` application for the cancelled Event. |
| Partner-owned official Activity | non-terminal Activity `→ CANCELLED` with source `ORGANIZER` or `SYSTEM` outside Event cancellation | Activity | The official Activity was cancelled independently of a Partner cancellation request. |

Partner submit, edit, resubmit, withdraw, and payment initiation do not notify that same Partner. The
`COMPLETED` row above is an explicit exception because it confirms the durable Assignment and may be
committed asynchronously or during zero-price selection.

### 5.2 Cancellation and duplicate precedence

The following precedence is mandatory:

1. Event cancellation creates at most one Partner Notification per representative and Event. It suppresses
   Booth request, proposal, Activity request, and Activity cancellation outcomes caused by that cascade.
2. Approving a Partner Activity cancellation request creates only the request outcome. The resulting
   Activity cancellation with source `PARTNER_REQUEST` does not create a second impact Notification.
3. Direct Organizer Activity cancellation creates one Activity impact and suppresses outcomes for pending
   child requests cancelled by the same transaction.
4. System cancellation of an official Partner Activity outside Event cancellation creates one Activity
   impact and suppresses outcomes for child requests cancelled by that same transition.
5. System closure of an open proposal that never became an official Activity remains one proposal outcome.
6. A request closed independently by lifecycle progression remains one request outcome when no parent
   Event or Activity cancellation already represents that impact.
7. Zero-price Booth selection creates only the final Assignment-confirmed outcome; it does not also create
   an intermediate selected-for-payment Notification.

## 6. Proposed Organizer producers

The persisted audience is `ORGANIZER`, and the recipient is the owning `events.organizer_user_id`.

| Domain event | Required condition | Notification target | Product meaning |
|---|---|---|---|
| Partner application submitted | A new application commits as `PENDING`. | Partner application | A new application is waiting for review. |
| Booth request submitted | An approved Partner application submits a new request as `PENDING`. | Booth request | A new Booth candidate is waiting for review. |
| Activity proposal submitted | A new proposal commits as `PENDING`. | Activity proposal | A new proposal is waiting for review. |
| Activity proposal resubmitted | `NEED_CHANGES → PENDING` commits as a distinct resubmission cycle. | Activity proposal | A revised proposal is waiting for another review. |
| Activity change request submitted | A new change request commits as `PENDING`. | Activity request | A new change request is waiting for review. |
| Activity cancellation request submitted | A new cancellation request commits as `PENDING`. | Activity request | A new cancellation request is waiting for review. If a stored compatibility cutoff exists and `isLate=true`, user-facing text says the request was sent late without exposing developer terminology. |
| Selected Booth released or expires | The selected request becomes `WITHDRAWN` or `PAYMENT_EXPIRED` and another `PENDING` candidate passes the same eligibility guards as a selection command at that backend time. | The released Booth request, used as stable context for its Event/Booth candidate queue | Another candidate can now be selected. |

The re-selection producer references the released terminal request rather than an arbitrary candidate. A
candidate may later withdraw or become ineligible; the released request and its transition timestamp remain
stable deduplication evidence and retain the Event/Booth context needed to reopen the live queue.

Organizer exclusions:

- no notification for each Participant registration, Attendance, BoothVisit, Point, rating, or other
  high-volume Participant transition
- no notification for an Organizer action that already returned its outcome synchronously
- no per-Organizer notification for General Feedback because Sprint 8 defines one shared queue
- no re-selection alert after the deadline, without a pending candidate, or while payment/reconciliation
  evidence still blocks release
- no notification merely because a Partner withdraws a still-pending application, proposal, or Activity
  request; those records leave the actionable queue through their existing state

## 7. Participant compatibility

The following types remain unchanged in meaning and reference:

```text
ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED
ACTIVITY_CANCELLED
EVENT_CANCELLED
CERTIFICATE_ISSUED
CERTIFICATE_REVOKED
BADGE_UNLOCKED
```

Existing creation rules, ownership, links, filters, UI behavior, and transaction boundaries remain valid.
The only intended behavior correction is atomic first-read handling under concurrency. The only added
Participant trigger is `ACTIVITY_STARTING_SOON`, approved by the section 12 amendment.

## 8. Admin foundation

Admin receives the same four owner-and-role-scoped inbox operations and genuine UI states. Sprint 10 does
not define an Admin notification type or producer. Therefore a normal Sprint 10 Admin inbox is empty and
its unread count is zero.

This is intentional. A future Admin producer requires its own approved actionable workflow and migration
extension. The frontend must not display invented security, login, role-change, digest, or system-health
items. A failed or missing API must render an error state rather than being converted into an empty result.

## 9. Acceptance Criteria review

Section 9.1 has been audited against the accepted actor flows and current V1–V15 implementation evidence.
Section 9.2 has been audited against BR-99, the Sprint 6 baseline, the Sprint 7 Badge extension, and current
implementation evidence. Section 9.3 has been audited against the Partner workflow transitions, durable
ownership, suppression rules, and current backend/frontend integration evidence. Section 9.4 has been
audited against owner-scoped submission/re-selection transitions and the current Organizer frontend/backend
integration evidence. Section 9.5 has been audited against the no-producer Admin decision and current
frontend/backend integration evidence. Section 9.6 has been audited against the affected transaction,
security, migration, frontend, Feedback, email, and scope-exclusion regression boundaries.

### 9.1 Shared foundation — reviewed 2026-11-03

1. `AC-N-S10-01`: list, unread-count, mark-one, and mark-all derive the User from the authenticated Session
   and use the exact workspace role fixed by that operation; no request may select another recipient or
   audience role.
2. `AC-N-S10-02`: for a User holding multiple roles, list and unread-count return only the requested role
   audience, while mark-one and mark-all cannot change any row belonging to another role audience.
3. `AC-N-S10-03`: a valid list query uses an approved sort with Notification identity ascending as its
   final stable tie-breaker; the default primary sort is `createdAt` descending. For an
   unchanged result set it pages without overlap or omission, supports read-state and role-compatible type
   filters, and returns a genuine empty page when no row matches. Unsupported query values are rejected
   rather than silently replaced.
4. `AC-N-S10-04`: unread-count equals the durable rows whose `readAt` is null for the same authenticated
   User and exact role audience; no match returns a genuine zero.
5. `AC-N-S10-05`: mark-one conditionally writes one backend `readAt` only while the owned role-scoped row is
   unread. Retry, concurrent mark-one, and concurrent mark-all preserve the first committed timestamp and
   return the resulting durable state.
6. `AC-N-S10-06`: mark-all conditionally updates only unread rows for the authenticated User and exact role,
   gives every row changed by that command one backend timestamp, preserves existing timestamps, reports
   the changed-row count, and changes zero rows on an immediate retry.
7. `AC-N-S10-07`: Notification creation is internal to an approved domain transition. Recipient and role
   come from durable domain ownership, the recipient may be offline, and no generic client command can
   create a row or supply its recipient/audience.
8. `AC-N-S10-08`: the domain transition and its Notification commit atomically. A persistence failure rolls
   both back; retrying the same persisted transition creates at most one row per recipient/role, while a
   later legitimate transition cycle may create a distinct row.
9. `AC-N-S10-09`: every persisted row uses an approved role-compatible type and exactly one supported,
   non-null domain reference; persistence rejects invalid role, type, reference, or mismatched combinations.
10. `AC-N-S10-10`: unauthenticated access, a disabled account, missing exact authority, an unverified
    account attempting an advanced-role operation, and mutation without the existing CSRF protection
    disclose no Notification data and change no row. Unknown, other-owner, and other-role Notification
    identities return the same ownership-safe not-found outcome.
11. `AC-N-S10-11`: one new Flyway migration after the then-current latest version applies both to an
    existing V1–V15 database and a clean Flyway build without modifying an applied migration. It backfills
    every existing Notification as `PARTICIPANT`, preserves identity, type, reference, deduplication key,
    content, `createdAt`, and `readAt`, and enforces the accepted role/type/reference constraints plus
    uniqueness by recipient User, recipient role, and deduplication key.

### 9.2 Participant compatibility — reviewed 2026-11-03

12. `AC-P-S10-01`: the only Participant types remain
    `ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED`, `ACTIVITY_CANCELLED`, `EVENT_CANCELLED`,
    `CERTIFICATE_ISSUED`, `CERTIFICATE_REVOKED`, and `BADGE_UNLOCKED`. Activity changes notify seat-active
    Activity registrations with an Activity reference; Activity cancellation notifies registrations
    affected by that cancellation with an Activity reference; Event cancellation notifies active Event
    registrations with an Event reference; Certificate state changes notify the Certificate owner with a
    Certificate reference; and Badge unlock notifies the earning User with a Badge reference.
13. `AC-P-S10-02`: the existing Participant list, unread-count, mark-one, and mark-all operations and DTO
    field meanings remain backward compatible. Paging, the approved `createdAt`/`readAt` sort choices,
    read-state filtering, and filtering by each of the six Participant types continue to return only
    current-User Participant results, and `read` remains consistent with whether `readAt` is non-null.
14. `AC-P-S10-03`: every approved Participant-producing transition in `AC-P-S10-01`, including a newly
    persisted UserBadge from scan or approved backfill, creates the corresponding Notification for each
    approved recipient in the same transaction and creates no duplicate when that same business transition
    is retried. No row is created when there is no approved recipient.
15. `AC-P-S10-04`: the Participant unread badge, preview popover, and full inbox load genuine backend data
    and distinguish loading, populated, empty, filtered-empty, expired-session/forbidden, and failure
    states. A list/count failure is not displayed as a successful empty/zero result, and a failed read
    mutation is visible and does not present the item or unread total as durably updated.
16. `AC-P-S10-05`: Participant data refreshes on workspace entry, full-inbox or popover open, and after a
    successful mark-one or mark-all command. The UI reconciles the returned durable state without adding
    background polling, WebSocket behavior, or an unapproved browser-focus requirement.
17. `AC-P-S10-06`: Participant navigation uses only the approved reference mapping: Event to Participant
    Event detail, Activity to Participant Activity detail, Certificate to the Participant Certificate area,
    and Badge to Participant Rewards. Message text never supplies a URL or exposes a raw QR token or other
    private security data; an unavailable target leaves the Notification readable and does not redirect to
    an unsafe route.
18. `AC-P-S10-07`: Participant APIs and UI expose only `PARTICIPANT` audience rows and Participant-compatible
    types, including for a multi-role User. Partner, Organizer, and Admin rows never appear and no new
    Participant producer is introduced.

### 9.3 Partner outcomes — reviewed 2026-11-03

19. `AC-E-S10-01`: only `PENDING → APPROVED` and `PENDING → REJECTED` Partner application reviews create
    one Partner outcome with the application reference for the affected organization's representative.
    Application submission and `PENDING → WITHDRAWN` create no Partner inbox echo.
20. `AC-E-S10-02`: Booth selection creates one selected-for-payment outcome with the Booth request reference
    only when the transaction finishes with the request still `SELECTED` and an active positive-price Hold.
    It is not emitted when the same transaction finishes at `COMPLETED`.
21. `AC-E-S10-03`: trusted settlement and zero-price selection each create one Assignment-confirmed outcome
    with the Booth request reference only after the request is `COMPLETED` and its BoothAssignment exists.
    Zero-price selection creates no intermediate `SELECTED` outcome, and settlement retry creates no
    duplicate confirmation.
22. `AC-E-S10-04`: `PENDING → REJECTED`, `PENDING → NOT_SELECTED`, and
    `SELECTED → PAYMENT_EXPIRED` each create one transition-specific outcome with the Booth request
    reference. `NOT_SELECTED` is emitted only after another candidate's Assignment commits;
    `PAYMENT_EXPIRED` is emitted only after expiry is durable and no success, pending/reconciliation
    evidence, or Assignment blocks it. An individual failed or timed-out payment attempt is not this
    terminal outcome.
23. `AC-E-S10-05`: proposal review transitions `PENDING → NEED_CHANGES`, `PENDING → APPROVED`, and
    `PENDING → REJECTED`, plus System closure `PENDING/NEED_CHANGES → CANCELLED` at proposed start or Event
    completion, create one proposal-referenced outcome unless a parent Event-cancellation summary suppresses
    it. A later resubmission/review cycle has a distinct persisted transition identity; retrying one cycle
    does not duplicate it.
24. `AC-E-S10-06`: an Activity change request transition `PENDING → APPROVED`, `PENDING → REJECTED`, or an
    independently represented lifecycle `PENDING → CANCELLED` creates one request-referenced outcome.
    Partner withdrawal and a cancellation already represented by a parent Event or Activity impact create
    no additional row.
25. `AC-E-S10-07`: an Activity cancellation request transition `PENDING → APPROVED`,
    `PENDING → REJECTED`, or an independently represented lifecycle `PENDING → CANCELLED` creates one
    request-referenced outcome. Approval is the sole Partner outcome for that action; the resulting Activity
    cancellation with source `PARTNER_REQUEST` creates no second Activity-impact row.
26. `AC-E-S10-08`: `PUBLISHED → CANCELLED` Event cancellation creates at most one Event-referenced Partner
    outcome per representative and Event when the organization has a `PENDING` or `APPROVED` application.
    That summary suppresses Booth request, proposal, Activity request, and Activity cancellation outcomes
    caused by the same cascade; repeated Event cancellation creates no new row.
27. `AC-E-S10-09`: a non-terminal official Partner Activity changing to `CANCELLED` with source `ORGANIZER`
    or `SYSTEM`, outside Event cancellation, creates one Activity-referenced impact outcome and suppresses
    child request cancellations caused by the same transition. Sources `PARTNER_REQUEST` and
    `EVENT_CANCELLATION` create no separate Activity-impact row.
28. `AC-E-S10-10`: Partner submit, edit, resubmit, withdraw, Booth checkout initiation, and individual
    payment failure/timeout create no inbox echo for that Partner. The final `COMPLETED` Assignment
    confirmation is the explicit exception because it is a trusted durable outcome.
29. `AC-E-S10-11`: every Partner outcome in `AC-E-S10-01` through `AC-E-S10-09` derives the recipient from
    the affected PartnerOrganization's durable representative at commit time, uses the `PARTNER` audience,
    commits atomically with the transition, remains creatable while the representative is offline, does not
    depend on email address or delivery, and is deduplicated by that persisted transition rather than
    message text or request time.
30. `AC-E-S10-12`: the Partner unread badge, preview, and reachable full inbox replace placeholder arrays,
    no-op read actions, and the redirected notification route with real paged list, unread-count, mark-one,
    mark-all, read-state filter, and role-compatible type-filter behavior. They distinguish loading,
    populated, empty, filtered-empty, expired-session/forbidden, and failure states; failures are not
    presented as empty success, and read state changes only after server confirmation.
31. `AC-E-S10-13`: Partner data refreshes on workspace entry, full-inbox or popover open, and successful
    read mutation without polling or fake real-time behavior. Each item navigates only through an
    allowlisted Partner-owned application, Booth request, proposal, Activity request, Event, or Activity
    target; unavailable targets remain readable, wording exposes no developer/internal payment evidence,
    and a multi-role User sees only `PARTNER` audience rows.

### 9.4 Organizer work items — reviewed 2026-11-03

32. `AC-O-S10-01`: committing a new Partner application as `PENDING` creates one application-referenced
    work item for that Event's owning Organizer. A rejected duplicate submission, Partner withdrawal, or
    retry of the same persisted application creates no additional Organizer row.
33. `AC-O-S10-02`: committing a new Booth request as `PENDING` creates one Booth-request-referenced work item
    for that Event's owning Organizer. A rejected duplicate submission or withdrawal of a pending request
    creates no additional Organizer row.
34. `AC-O-S10-03`: an initial proposal committed as `PENDING` and each distinct
    `NEED_CHANGES → PENDING` resubmission create proposal-referenced work items for the owning Organizer.
    Editing while still `NEED_CHANGES`, withdrawing, or retrying the same persisted submit/resubmit
    transition creates no additional row.
35. `AC-O-S10-04`: committing a new Activity change request as `PENDING` creates one change-request-referenced
    work item for the owning Organizer. A rejected duplicate submission or Partner withdrawal creates no
    additional Organizer row.
36. `AC-O-S10-05`: committing a new Activity cancellation request as `PENDING` creates one
    cancellation-request-referenced work item for the owning Organizer. When the persisted compatibility
    result is late, user-facing text may say the request was sent late but never exposes `isLate`, `cutoff`,
    or another developer-oriented label; withdrawal creates no additional row.
37. `AC-O-S10-06`: a safe `SELECTED → WITHDRAWN` or `SELECTED → PAYMENT_EXPIRED` Booth release creates
    one Booth-candidate-queue work item only when another `PENDING` request for that Booth passes the same
    Event, selection-window, application, quota, configuration, Location, Hold, and Assignment eligibility
    guards as a selection command at that backend time. A pending-request withdrawal, blocked release,
    unavailable or ineligible candidate, expired selection window, or retry creates no work item.
38. `AC-O-S10-07`: every Organizer work item in `AC-O-S10-01` through `AC-O-S10-06` derives its recipient
    from the affected Event's durable `organizerUserId` at commit time, uses the `ORGANIZER` audience,
    commits atomically with the source transition, remains creatable while the owner is offline, and is
    deduplicated by that persisted transition rather than message text or request time.
39. `AC-O-S10-08`: Participant registration, Attendance, BoothVisit, Point, rating, normal Organizer
    self-actions, pending-item withdrawal, and shared General Feedback create no Organizer Notification.
    Existing owner-scoped queues continue to show current durable state without a second withdrawal echo.
40. `AC-O-S10-09`: the Organizer unread badge, preview, and full inbox replace empty-array/no-op behavior,
    client-only placeholder filters, and hard-coded counts with real paged list, unread-count, mark-one,
    mark-all, read-state filter, and role-compatible type-filter behavior. They distinguish loading,
    populated, empty, filtered-empty, expired-session/forbidden, and failure states; failures are not
    presented as empty success, and read state changes only after server confirmation.
41. `AC-O-S10-10`: Organizer data refreshes on workspace entry, full-inbox or popover open, and successful
    read mutation without polling or fake real-time behavior. Each item navigates only to an allowlisted
    owner-scoped application, Booth request/candidate queue, proposal, or Activity request target; an
    unavailable or withdrawn target remains readable, wording exposes no developer terminology, and a
    multi-role User sees only `ORGANIZER` audience rows.

### 9.5 Admin foundation — reviewed 2026-11-03

42. `AC-A-S10-01`: an effective verified Admin can use real paged list, unread-count, mark-one, and mark-all
    operations fixed to the authenticated User and `ADMIN` audience. The list uses the shared approved
    paging/sort/read-state rules, while an unsupported type filter is rejected because Sprint 10 defines no
    Admin-compatible Notification type.
43. `AC-A-S10-02`: Sprint 10 defines no Admin Notification type, producer, detector, generic create command,
    or persisted Admin row. Consequently a successful normal Admin list is a genuine empty page, unread
    count is zero, mark-all succeeds idempotently with zero changed rows, and mark-one follows the shared
    ownership-safe not-found behavior.
44. `AC-A-S10-03`: the Admin unread badge, preview, and full inbox use the real operations in
    `AC-A-S10-01` and distinguish loading, genuine empty, expired-session/forbidden, and failure states.
    Missing endpoints or request failures are never converted to empty success, and no mock/fallback row,
    hard-coded count, or fabricated Security, Account, System, login, verification, or health category is
    displayed.
45. `AC-A-S10-04`: Admin data refreshes on workspace entry, full-inbox or popover open, and successful read
    mutation without polling or fake real-time behavior. Read state changes only after server confirmation;
    opening another Admin route, including Badge management, does not clear or replace inbox state locally.
46. `AC-A-S10-05`: a non-Admin cannot use Admin inbox operations; an Admin role on a multi-role account sees
    only `ADMIN` audience rows and cannot read or mutate Participant, Partner, or Organizer rows. Unknown,
    other-owner, and other-role identities remain indistinguishable through the shared ownership-safe
    not-found response, and mutations retain existing CSRF protection.

### 9.6 Regression and scope — reviewed 2026-11-03

47. `AC-S10-REG-01`: existing Event, Partner application, Booth request/Hold/Payment/Assignment, proposal,
    Activity/request, Participant Notification, and Reward transitions retain their approved statuses,
    guards, lock order, deadlines, response meaning, and idempotency except for the explicitly approved
    Notification side effect. A rejected or rolled-back source transition creates no row, while an approved
    Notification persistence failure rolls back its owning transition as required by `AC-N-S10-08`.
48. `AC-S10-REG-02`: clean and V1–V15 upgrade Flyway/Hibernate validation, server-side Session
    authentication, verified-email requirements for advanced roles, exact endpoint authority, owner and
    multi-role isolation, and existing CSRF behavior pass with the Sprint 10 schema and endpoints. No JWT,
    bearer token, refresh token, or client-selected audience is introduced.
49. `AC-S10-REG-03`: frontend lint/build and focused browser verification cover genuine loading, populated,
    empty, filtered-empty where applicable, expired-session/forbidden, and failure states; bounded refresh,
    server-confirmed read mutations, and safe role-owned navigation work in Participant, Partner, Organizer,
    and Admin workspaces without breaking existing Event, Booth, Payment, Activity, Reward, Feedback, or
    Heritage routes.
50. `AC-S10-REG-04`: Sprint 8 General Feedback remains one shared Organizer queue with its existing access,
    status, rate-limit, and CSRF behavior. Feedback submission or resolution creates no Notification row and
    no per-Organizer broadcast.
51. `AC-S10-REG-05`: existing optional Event, Booth, Activity, authentication, and verification email
    behavior remains unchanged and after commit. Email address/verification and delivery success are not
    prerequisites for an approved in-app recipient; an email failure neither rolls back the committed
    domain transition/Notification nor causes another in-app row.
52. `AC-S10-REG-06`: Sprint 10 introduces no mock/fallback Notification array, `localStorage` read state,
    SMS, mobile push, WebSocket, SSE beyond the `BR-111` signal, polling, preference/quiet-hour model, broadcast
    composer, NotificationType table, sender User, delivery-attempt table, transactional outbox, or change
    to Event, Booth, Payment, Activity, Feedback, Reward, Heritage, Certificate, or Badge lifecycle meaning.

Sections 9.1 through 9.6 contain the original 52 reviewed criteria: 11 shared-foundation, 7 Participant,
13 Partner, 10 Organizer, 5 Admin, and 6 regression. Section 12 adds four and section 13 adds two, so the
active baseline contains **58 Acceptance Criteria**.

## 10. Delivery units

1. `S10-N1` — approved migration and shared role-scoped backend foundation.
2. `S10-N2` — Participant compatibility and atomic read-state correction.
3. `S10-N3` — Partner producers, APIs, preview, and inbox.
4. `S10-N4` — Organizer producers, APIs, preview, and inbox.
5. `S10-N5` — Admin foundation with no producer.
6. `S10-N6` — focused cross-role verification, documentation, and closure.

Each unit requires a focused staged-diff audit and evidence mapped to the criteria it owns. Migration
ownership is exclusive and the version is rechecked immediately before implementation.

## 11. Activation result

The documentation activation completed on `2026-11-03`:

1. PR #116 merged the approved documentation at `3a0a76b`.
2. `docs/sprints/CURRENT_SPRINT.md`, `AI_CONTEXT.md`, and the active requirement context were promoted.
3. Developer A (`YingKai0621`) confirmed V1 through V15 on updated `main` and reserved `V16` exclusively.
4. No competing migration existed at reservation time.
5. PR 1 foundation work is authorized after this activation update merges.
6. PR 2 and PR 3 use the stable Developer B and C work-package labels. Teammates claim and coordinate the
   relevant role before starting; the assignment document requires no personal-name registry.
7. The BR-81 exact-deadline equality decision was resolved on `2026-11-05`: selection is allowed at the
   exact Booth request deadline and rejected only after it. Boundary tests preserve this inclusive rule.

## 12. Actionable Notification amendment — 2026-11-06

Manual review showed that the closed producer matrix left out information recipients need in order to act.
The project owner approved adding exactly the following producers to Sprint 10 through migration `V17`,
defined by active `BR-110`. Where this section conflicts with an earlier Sprint 10 statement that lists the
closed types or forbids a further Participant producer, this section governs.

| Type | Audience and recipient | Trigger | Reference | Deduplication |
|---|---|---|---|---|
| `PARTNER_EVENT_PUBLISHED` | `PARTNER`; representative of each `ACTIVE` organization except the Event Organizer | Event `DRAFT → PUBLISHED` commits | `EVENT` | Event id; publication happens once |
| `PARTNER_BOOTH_HOLD_EXPIRING` | `PARTNER`; representative of the selected request's organization | Server job finds an eligible Hold inside the reminder window | `BOOTH_REQUEST` | Hold id plus `expiresAt` |
| `ORGANIZER_BOOTH_PAYMENT_CONFIRMED` | `ORGANIZER`; Event `organizerUserId` | Trusted settlement completes the request and creates its Assignment | `BOOTH_REQUEST` | Request id plus `completedAt` |
| `ACTIVITY_STARTING_SOON` | `PARTICIPANT`; each User with an `ACTIVE` ActivityRegistration | Server job finds a `PUBLISHED` Activity inside the reminder window | `ACTIVITY` | Activity id plus `startAt` |

Configuration defaults are `bookstreet.booth.hold-reminder-window-minutes=120` and
`bookstreet.activity.reminder-window-hours=24`. Time-based reminders run in existing-style server schedulers.
They are not client polling or a lifecycle change, so `BR-109` remains intact. The
Partner workspace sidebar also exposes the existing inbox with its unread count under `AC-E-S10-12`.

Amended Acceptance Criteria:

53. `AC-E-S10-14`: publishing an Event creates one `PARTNER_EVENT_PUBLISHED` row per `ACTIVE` organization
    representative in the publication transaction and creates none for an `INACTIVE` organization or for the
    Event's own Organizer. It opens the owned Event discovery target for that Event.
54. `AC-E-S10-15`: an eligible Hold creates exactly one `PARTNER_BOOTH_HOLD_EXPIRING` row inside the reminder
    window. A Hold outside the window, a Hold whose full lifetime is not longer than the window, and a Hold
    with `PENDING`/`SUCCESS` payment or reconciliation evidence create none.
55. `AC-O-S10-11`: trusted settlement creates one `ORGANIZER_BOOTH_PAYMENT_CONFIRMED` row for the Event owner
    in the settlement transaction; a retried callback creates no duplicate and zero-price selection creates
    none. It opens the owner-scoped Booth request queue.
56. `AC-P-S10-08`: a `PUBLISHED` Activity inside the reminder window creates one `ACTIVITY_STARTING_SOON` row
    for each `ACTIVE` registration and none for cancelled registrations or Activities outside the window.
    Changing `startAt` permits one new reminder. It opens Participant Activity detail.

The four new types extend `AC-P-S10-01`, `AC-P-S10-02`, `AC-P-S10-07`, `AC-E-S10-12`, `AC-E-S10-13`,
`AC-O-S10-09`, `AC-O-S10-10`, and `AC-S10-REG-06` without otherwise changing them.

## 13. Live inbox update amendment — 2026-11-06

Manual review showed that a recipient had to reload the page to see a new Notification. The project owner
approved one Server-Sent Events signal, defined by active `BR-111`. It adds no table, migration, type, producer,
or lifecycle change.

Amended Acceptance Criteria:

57. `AC-N-S10-12`: the Participant, Partner, and Organizer streams use the exact authority of their inbox and
    reject anonymous, wrong-role, and disabled-account requests. A new row signals only that User's connections
    for that exact role, only after commit, and with no Notification data. A rollback, another role's row, and a
    deduplicated retry send no signal, and signal delivery cannot affect the source transition.
58. `AC-N-S10-13`: an open workspace updates its unread badge, preview, and full inbox without a page reload,
    using only the existing inbox APIs and without flashing the loading state. A hidden tab releases its
    connection and reloads once when shown again. An unavailable stream leaves the existing refresh triggers
    working, and Admin opens no connection.

Bounded refresh criteria continue to apply
as the fallback when no connection is open.
