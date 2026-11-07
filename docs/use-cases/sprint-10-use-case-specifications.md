# Sprint 10 Role-Scoped Notification Use Case Specifications

- Status: `APPROVED - ACTIVE`
- Activation date: `2026-11-03`
- Approved documentation merge: PR #116, merge commit `3a0a76b`
- Prepared date: `2026-11-02`
- Last use-case revision: `2026-11-03`
- Last Acceptance Criteria revision: `2026-11-03`
- Scope: durable role-scoped inbox, proposed Partner outcomes, Organizer work items, Admin foundation
- Reviewed boundary: actor goals, preconditions, flows, exceptions, and postconditions in sections 1
  through 7; all shared-foundation and role Acceptance Criteria in sections 4 through 8; and regression
  Acceptance Criteria in section 9. The reviewed API, ERD, UI obligations, implementation plan, and
  three-developer assignment provide the downstream delivery detail.

## 1. Source and traceability

This specification is the active Sprint 10 refinement of existing Use Cases and must be read with:

- `docs/requirements/05_Business_Rules.md`, especially active BR-53 and BR-99
- `docs/requirements/06_Use_Case_List.md`
- `docs/requirements/08_MVP_Scope_v2.md`
- sections 1 through 8 of `docs/sprints/sprint-10.md`, especially active rules `BR-102` through `BR-109`
- `docs/development/SPRINT_10_ROLE_NOTIFICATIONS_CURRENT_STATE_AUDIT.md`
- the current Physical ERD as evidence of the implemented V1–V15 baseline

The approved Sprint 10 API Contract and ERD overlay are downstream implementation contracts. They conform
to this accepted Use Case behavior and do not override higher-priority Business Rules.

If this specification conflicts with an active Business Rule, the active Business Rule governs and the
Sprint document must be corrected. This specification does not silently override the active baseline.

This specification creates no new top-level Use Case:

- Participant Notification refines `UC-P01` and `UC-P03`.
- Partner outcomes support `UC-E01` through `UC-E06` according to the affected workflow.
- Organizer work items support `UC-O03` through `UC-O06`; Event cancellation remains owned by `UC-O01`.
- Admin inbox foundation is shared infrastructure for the existing Admin workspace. Without an Admin
  producer, it does not add an actor goal to `UC-A01` through `UC-A03`.

The active API Contract freezes transport details without widening these accepted actor outcomes and
invariants.

## 2. Shared actors and preconditions

### 2.1 Actors and supporting behavior

- Participant using the Participant workspace
- Partner representative using the Partner workspace
- Event Organizer using the Organizer workspace
- Admin using the Admin workspace

Notification creation is supporting System behavior inside an existing domain Use Case. System is not a
new top-level actor and a scheduler is not added to the Use Case model.

### 2.2 Preconditions

For inbox interaction:

- The User has an active authenticated server-side Session.
- The workspace role is an effective authority on the current Session.
- Partner, Organizer, and Admin authority continues to require verified email.
- The operation derives User identity from Security context and accepts no caller-selected recipient or
  role audience.

For Notification creation:

- The owning domain transition is otherwise valid under the active Business Rules.
- The System derives the recipient and role from durable domain ownership.
- The recipient does not need an active browser Session and may be offline when the transition commits.
- A client cannot call a generic command to create a Notification directly.

### 2.3 Shared postconditions

On successful creation:

- one durable row exists for one User and one role audience
- its type, reference, title, message, and deduplication identity match the committed domain transition
- the domain transition and row commit together

On successful read mutation:

- only the authenticated User's endpoint-role rows may change
- a first read receives one durable backend timestamp
- an existing first-read timestamp never changes

On failure, no other User or role data is disclosed or modified.

## 3. Shared inbox flow

### Main flow A — Open preview

1. Actor enters one role workspace or opens its notification control.
2. System verifies the workspace role and derives the current User.
3. System loads the newest matching rows and unread total for that User and role audience.
4. The workspace displays a genuine loading, empty, failure, or populated state.

### Main flow B — Browse full inbox

1. Actor opens the role's full notification page.
2. System shows a deterministic newest-first inbox for the current User and role.
3. Actor may page through results and filter by read state or a notification category valid for that role.
4. System applies the same owner-and-role boundary to every page and filter.
5. No match displays a genuine empty or filtered-empty state.

### Main flow C — Mark one read

1. Actor selects one notification in the current role inbox.
2. System verifies that the item belongs to the current User and role audience.
3. If unread, System stores the first read time; if already read, System preserves the existing time.
4. The inbox reconciles the item and unread total from the confirmed durable state.

### Main flow D — Mark all read

1. Actor chooses mark all in the current role inbox.
2. System sets one backend timestamp on all currently unread rows for that User and role.
3. Existing read timestamps and every other role remain unchanged.
4. The inbox shows the confirmed number of rows changed and the resulting unread total.

### Alternate and exception flows

- Missing Session returns authentication required.
- Missing exact role returns forbidden.
- A read mutation without the existing browser-security protection fails and changes no row.
- Unsupported paging or filtering input is rejected according to the later API Contract; System does not
  silently run a different query.
- Unknown, other-owner, or other-role identity returns the same not-found response.
- Repeating mark-one returns the existing row without changing `readAt`.
- Concurrent mark-one and mark-all converge on one first committed timestamp per row.
- An unavailable target leaves the Notification readable and does not redirect to an unsafe route.
- A loading failure remains a failure state; the workspace does not replace it with an empty success.

## 4. Participant extension

### Goal

Preserve the completed Participant notification experience while adding role isolation and fixing first-read
concurrency.

### Primary actor

Authenticated User with effective `PARTICIPANT` authority.

### Preconditions

- The shared inbox preconditions apply when the Participant opens or reads the inbox.
- Existing Participant-producing transitions remain governed by BR-99 and the completed Sprint 7 Badge
  extension.

### Creation behavior

The six existing producers and recipient rules remain exactly those in BR-99 and Sprint 7. No new
Participant producer is approved.

### Main and alternate flows

1. Participant uses the shared preview, browse, mark-one, and mark-all flows in section 3.
2. Existing Activity change/cancellation, Event cancellation, Certificate, and Badge transitions continue
   creating the same Participant outcomes.
3. Partner, Organizer, and Admin audience rows never appear in Participant results.
4. Existing ownership-safe, retry, concurrency, and unavailable-target behavior follows the shared flows.

### Postconditions

- Existing Participant notification meaning and history remain unchanged.
- A read mutation affects only the current User's `PARTICIPANT` audience.
- No Partner, Organizer, or Admin producer is reachable through Participant behavior.

### Acceptance Criteria — reviewed 2026-11-03

- `AC-P-S10-01`: the only Participant types remain
  `ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED`, `ACTIVITY_CANCELLED`, `EVENT_CANCELLED`,
  `CERTIFICATE_ISSUED`, `CERTIFICATE_REVOKED`, and `BADGE_UNLOCKED`. Activity changes notify seat-active
  Activity registrations with an Activity reference; Activity cancellation notifies registrations
  affected by that cancellation with an Activity reference; Event cancellation notifies active Event
  registrations with an Event reference; Certificate state changes notify the Certificate owner with a
  Certificate reference; and Badge unlock notifies the earning User with a Badge reference.
- `AC-P-S10-02`: the existing Participant list, unread-count, mark-one, and mark-all operations and DTO
  field meanings remain backward compatible. Paging, the approved `createdAt`/`readAt` sort choices,
  read-state filtering, and filtering by each of the six Participant types continue to return only
  current-User Participant results, and `read` remains consistent with whether `readAt` is non-null.
- `AC-P-S10-03`: every approved Participant-producing transition in `AC-P-S10-01`, including a newly
  persisted UserBadge from scan or approved backfill, creates the corresponding Notification for each
  approved recipient in the same transaction and creates no duplicate when that same business transition
  is retried. No row is created when there is no approved recipient.
- `AC-P-S10-04`: the Participant unread badge, preview popover, and full inbox load genuine backend data
  and distinguish loading, populated, empty, filtered-empty, expired-session/forbidden, and failure
  states. A list/count failure is not displayed as a successful empty/zero result, and a failed read
  mutation is visible and does not present the item or unread total as durably updated.
- `AC-P-S10-05`: Participant data refreshes on workspace entry, full-inbox or popover open, and after a
  successful mark-one or mark-all command. The UI reconciles the returned durable state without adding
  background polling, WebSocket behavior, or an unapproved browser-focus requirement.
- `AC-P-S10-06`: Participant navigation uses only the approved reference mapping: Event to Participant
  Event detail, Activity to Participant Activity detail, Certificate to the Participant Certificate area,
  and Badge to Participant Rewards. Message text never supplies a URL or exposes a raw QR token or other
  private security data; an unavailable target leaves the Notification readable and does not redirect to
  an unsafe route.
- `AC-P-S10-07`: Participant APIs and UI expose only `PARTICIPANT` audience rows and Participant-compatible
  types, including for a multi-role User. Partner, Organizer, and Admin rows never appear and no new
  Participant producer is introduced.

## 5. Partner outcomes extension

### Goal

Let a Partner representative learn important committed outcomes that affect the represented organization
without receiving a duplicate for their own normal command.

### Primary actor

Authenticated User with effective verified `PARTNER` authority representing one PartnerOrganization.

### Preconditions

- The affected record belongs to the PartnerOrganization represented by the recipient User.
- The owning domain transition is legal and commits under its existing Event, Booth, Payment, or Activity
  rules.
- Notification creation derives the representative from durable organization ownership and does not
  require the representative to be online.

### Main flow A — Application review outcome

1. Organizer approves or rejects a pending Partner application.
2. The application transition and one Partner-role Notification commit atomically.
3. The representative opens the item and navigates to the owned application context.

### Main flow B — Booth outcome

1. BoothRequest commits one of the final outcomes allowed by the Sprint 10 transition matrix.
2. If the committed state remains `SELECTED`, one Notification explains that payment may proceed.
3. If trusted settlement or zero-price selection commits `COMPLETED`, one Notification confirms the durable
   Assignment. Zero-price selection does not also create an intermediate `SELECTED` Notification.
4. `REJECTED`, `NOT_SELECTED`, and `PAYMENT_EXPIRED` each create one durable result Notification without
   exposing internal reconciliation evidence.

### Main flow C — Proposal outcome

1. Organizer sets a proposal to `NEED_CHANGES`, `APPROVED`, or `REJECTED`, or System closes it as
   `CANCELLED` because its proposed time was reached or the Event completed.
2. One transition-specific Notification commits.
3. A later resubmit and another review use a new persisted transition identity, so repeated NEED_CHANGES
   cycles are distinct but retries of one cycle are not.

### Main flow D — Activity request outcome

1. Organizer approves or rejects a pending change/cancellation request, or lifecycle closes it.
2. One request-outcome Notification commits.
3. Approval of a cancellation request suppresses a second Partner Activity-cancelled row, and a parent
   Event/Activity cancellation suppresses child request rows caused by that same transition.

### Main flow E — Cancellation impact

1. Event cancellation creates one Partner Event-cancelled Notification per representative and Event when
   the organization has a `PENDING` or `APPROVED` application, regardless of the number of affected child
   records.
2. Direct or System Activity cancellation outside that Event cascade and outside an approved Partner
   cancellation request creates one Activity-cancelled Notification for the owning Partner representative
   and suppresses child request-cancelled rows caused by the same transition.

### Partner exception flows

- Submit, edit, resubmit, withdraw, checkout initiation, and other normal Partner self-actions create no
  inbox echo. Assignment confirmation at `COMPLETED` is the explicit exception because the trusted result
  may commit asynchronously or during zero-price selection.
- Representative ownership is resolved from durable organization ownership at the committed transition;
  callers cannot supply a recipient.
- Event cascade suppresses Booth request, proposal, Activity request, and Activity cancellation child rows
  produced by that same cancellation. The single Event-level Partner outcome remains the summary.
- An outcome retry uses the original persisted transition identity.

### Postconditions

- After suppression, at most one Partner row represents one committed transition for one representative
  and role audience.
- A normal Partner self-command creates no redundant inbox echo.
- Event and Activity cancellation never produce both a parent impact and redundant child outcomes for the
  same recipient and transition.

### Acceptance Criteria — reviewed 2026-11-03

- `AC-E-S10-01`: only `PENDING → APPROVED` and `PENDING → REJECTED` Partner application reviews create
  one Partner outcome with the application reference for the affected organization's representative.
  Application submission and `PENDING → WITHDRAWN` create no Partner inbox echo.
- `AC-E-S10-02`: Booth selection creates one selected-for-payment outcome with the Booth request reference
  only when the transaction finishes with the request still `SELECTED` and an active positive-price Hold.
  It is not emitted when the same transaction finishes at `COMPLETED`.
- `AC-E-S10-03`: trusted settlement and zero-price selection each create one Assignment-confirmed outcome
  with the Booth request reference only after the request is `COMPLETED` and its BoothAssignment exists.
  Zero-price selection creates no intermediate `SELECTED` outcome, and settlement retry creates no
  duplicate confirmation.
- `AC-E-S10-04`: `PENDING → REJECTED`, `PENDING → NOT_SELECTED`, and
  `SELECTED → PAYMENT_EXPIRED` each create one transition-specific outcome with the Booth request
  reference. `NOT_SELECTED` is emitted only after another candidate's Assignment commits;
  `PAYMENT_EXPIRED` is emitted only after expiry is durable and no success, pending/reconciliation
  evidence, or Assignment blocks it. An individual failed or timed-out payment attempt is not this
  terminal outcome.
- `AC-E-S10-05`: proposal review transitions `PENDING → NEED_CHANGES`, `PENDING → APPROVED`, and
  `PENDING → REJECTED`, plus System closure `PENDING/NEED_CHANGES → CANCELLED` at proposed start or Event
  completion, create one proposal-referenced outcome unless a parent Event-cancellation summary suppresses
  it. A later resubmission/review cycle has a distinct persisted transition identity; retrying one cycle
  does not duplicate it.
- `AC-E-S10-06`: an Activity change request transition `PENDING → APPROVED`, `PENDING → REJECTED`, or an
  independently represented lifecycle `PENDING → CANCELLED` creates one request-referenced outcome.
  Partner withdrawal and a cancellation already represented by a parent Event or Activity impact create
  no additional row.
- `AC-E-S10-07`: an Activity cancellation request transition `PENDING → APPROVED`,
  `PENDING → REJECTED`, or an independently represented lifecycle `PENDING → CANCELLED` creates one
  request-referenced outcome. Approval is the sole Partner outcome for that action; the resulting Activity
  cancellation with source `PARTNER_REQUEST` creates no second Activity-impact row.
- `AC-E-S10-08`: `PUBLISHED → CANCELLED` Event cancellation creates at most one Event-referenced Partner
  outcome per representative and Event when the organization has a `PENDING` or `APPROVED` application.
  That summary suppresses Booth request, proposal, Activity request, and Activity cancellation outcomes
  caused by the same cascade; repeated Event cancellation creates no new row.
- `AC-E-S10-09`: a non-terminal official Partner Activity changing to `CANCELLED` with source `ORGANIZER`
  or `SYSTEM`, outside Event cancellation, creates one Activity-referenced impact outcome and suppresses
  child request cancellations caused by the same transition. Sources `PARTNER_REQUEST` and
  `EVENT_CANCELLATION` create no separate Activity-impact row.
- `AC-E-S10-10`: Partner submit, edit, resubmit, withdraw, Booth checkout initiation, and individual
  payment failure/timeout create no inbox echo for that Partner. The final `COMPLETED` Assignment
  confirmation is the explicit exception because it is a trusted durable outcome.
- `AC-E-S10-11`: every Partner outcome in `AC-E-S10-01` through `AC-E-S10-09` derives the recipient from
  the affected PartnerOrganization's durable representative at commit time, uses the `PARTNER` audience,
  commits atomically with the transition, remains creatable while the representative is offline, does not
  depend on email address or delivery, and is deduplicated by that persisted transition rather than
  message text or request time.
- `AC-E-S10-12`: the Partner unread badge, preview, and reachable full inbox replace placeholder arrays,
  no-op read actions, and the redirected notification route with real paged list, unread-count, mark-one,
  mark-all, read-state filter, and role-compatible type-filter behavior. They distinguish loading,
  populated, empty, filtered-empty, expired-session/forbidden, and failure states; failures are not
  presented as empty success, and read state changes only after server confirmation.
- `AC-E-S10-13`: Partner data refreshes on workspace entry, full-inbox or popover open, and successful
  read mutation without polling or fake real-time behavior. Each item navigates only through an
  allowlisted Partner-owned application, Booth request, proposal, Activity request, Event, or Activity
  target; unavailable targets remain readable, wording exposes no developer/internal payment evidence,
  and a multi-role User sees only `PARTNER` audience rows.

## 6. Organizer work-item extension

### Goal

Let the Event owner notice newly submitted work that needs review without turning high-volume monitoring or
shared queues into inbox spam.

### Primary actor

Authenticated User with effective verified `ORGANIZER` authority who owns the affected Event.

### Preconditions

- The affected work item belongs to an Event whose durable `organizerUserId` is the recipient.
- The Partner submission or Booth release/expiry transition is otherwise legal under the active workflow.
- Notification creation derives the Event owner from durable ownership and does not require the Organizer
  to be online.

### Main flow A — New review item

1. Partner submits an application, Booth request, proposal, Activity change request, or Activity
   cancellation request.
2. Submission and one Organizer-role Notification for `event.organizerUserId` commit atomically.
3. Organizer opens the item and navigates to the corresponding owner-scoped review screen.

Proposal resubmission creates another work item because `NEED_CHANGES → PENDING` is a distinct persisted
resubmission transition. Retrying that same resubmission does not duplicate it.

### Main flow B — Booth re-selection required

1. A selected request commits `SELECTED → WITHDRAWN` or `SELECTED → PAYMENT_EXPIRED` with no blocking
   payment evidence.
2. System confirms another candidate remains `PENDING` and passes the same eligibility guards as a
   selection command at that backend time.
3. One re-selection work item commits with the release/expiry transition.
4. The work item references the released terminal Booth request as stable Event/Booth context, not an
   arbitrary candidate that may later withdraw or become ineligible.
5. Organizer opens the relevant live Booth candidate queue, where current eligibility is checked again.

### Organizer exception flows

- No item is created for each Participant registration, Attendance, BoothVisit, Point, rating, or other
  monitoring fact.
- No item is created for the Organizer's own synchronous review command.
- No item is created when Booth re-selection is no longer legal or useful.
- General Feedback remains a shared queue and creates no per-Organizer Notification.
- Withdrawal of a still-pending application, proposal, or Activity request creates no Organizer
  Notification; the existing queue reflects its durable state.
- For a legacy Event with a stored compatibility cutoff, an Activity cancellation request with
  `isLate=true` may use plain wording such as “gửi trễ”. It does not display `isLate`, `cutoff`, or another
  developer-oriented label.

### Postconditions

- One new actionable submission creates at most one work item for the owning Organizer.
- A proposal resubmission creates a distinct work item, while retrying that same resubmission does not.
- Booth release/expiry creates no alert when re-selection is no longer legal or useful.
- Shared Feedback and high-volume Participant facts remain outside the Organizer inbox.

### Acceptance Criteria — reviewed 2026-11-03

- `AC-O-S10-01`: committing a new Partner application as `PENDING` creates one application-referenced
  work item for that Event's owning Organizer. A rejected duplicate submission, Partner withdrawal, or
  retry of the same persisted application creates no additional Organizer row.
- `AC-O-S10-02`: committing a new Booth request as `PENDING` creates one Booth-request-referenced work item
  for that Event's owning Organizer. A rejected duplicate submission or withdrawal of a pending request
  creates no additional Organizer row.
- `AC-O-S10-03`: an initial proposal committed as `PENDING` and each distinct
  `NEED_CHANGES → PENDING` resubmission create proposal-referenced work items for the owning Organizer.
  Editing while still `NEED_CHANGES`, withdrawing, or retrying the same persisted submit/resubmit
  transition creates no additional row.
- `AC-O-S10-04`: committing a new Activity change request as `PENDING` creates one change-request-referenced
  work item for the owning Organizer. A rejected duplicate submission or Partner withdrawal creates no
  additional Organizer row.
- `AC-O-S10-05`: committing a new Activity cancellation request as `PENDING` creates one
  cancellation-request-referenced work item for the owning Organizer. When the persisted compatibility
  result is late, user-facing text may say the request was sent late but never exposes `isLate`, `cutoff`,
  or another developer-oriented label; withdrawal creates no additional row.
- `AC-O-S10-06`: a safe `SELECTED → WITHDRAWN` or `SELECTED → PAYMENT_EXPIRED` Booth release creates
  one Booth-candidate-queue work item only when another `PENDING` request for that Booth passes the same
  Event, selection-window, application, quota, configuration, Location, Hold, and Assignment eligibility
  guards as a selection command at that backend time. A pending-request withdrawal, blocked release,
  unavailable or ineligible candidate, expired selection window, or retry creates no work item.
- `AC-O-S10-07`: every Organizer work item in `AC-O-S10-01` through `AC-O-S10-06` derives its recipient
  from the affected Event's durable `organizerUserId` at commit time, uses the `ORGANIZER` audience,
  commits atomically with the source transition, remains creatable while the owner is offline, and is
  deduplicated by that persisted transition rather than message text or request time.
- `AC-O-S10-08`: Participant registration, Attendance, BoothVisit, Point, rating, normal Organizer
  self-actions, pending-item withdrawal, and shared General Feedback create no Organizer Notification.
  Existing owner-scoped queues continue to show current durable state without a second withdrawal echo.
- `AC-O-S10-09`: the Organizer unread badge, preview, and full inbox replace empty-array/no-op behavior,
  client-only placeholder filters, and hard-coded counts with real paged list, unread-count, mark-one,
  mark-all, read-state filter, and role-compatible type-filter behavior. They distinguish loading,
  populated, empty, filtered-empty, expired-session/forbidden, and failure states; failures are not
  presented as empty success, and read state changes only after server confirmation.
- `AC-O-S10-10`: Organizer data refreshes on workspace entry, full-inbox or popover open, and successful
  read mutation without polling or fake real-time behavior. Each item navigates only to an allowlisted
  owner-scoped application, Booth request/candidate queue, proposal, or Activity request target; an
  unavailable or withdrawn target remains readable, wording exposes no developer terminology, and a
  multi-role User sees only `ORGANIZER` audience rows.

## 7. Admin foundation extension

### Goal

Replace the misleading missing-endpoint placeholder with a real role-isolated inbox foundation while
honestly showing that no Admin workflow currently produces notifications.

### Primary actor

Authenticated User with effective verified `ADMIN` authority.

### Preconditions

- The shared inbox interaction preconditions apply.
- Sprint 10 defines no Admin notification type or producer.

### Main flow

1. Effective Admin opens the notification preview or full page.
2. System applies the current User and `ADMIN` audience boundary.
3. System shows a genuine empty inbox and unread total zero under normal Sprint 10 data.
4. Mark-all completes idempotently with zero changed rows. Mark-one for an unknown or non-Admin-audience
   identity follows the shared ownership-safe not-found behavior.

### Alternate and exception flows

- A loading failure remains an error and is not converted into an empty success.
- Participant, Partner, and Organizer rows remain invisible even when the same User also holds those roles.
- A non-Admin account cannot use Admin inbox behavior.

### Postconditions

- Normal Sprint 10 Admin state remains a genuine empty inbox with unread total zero.
- No fabricated security, login, account, role-change, digest, or system-health item is displayed.
- No new Admin producer or top-level domain Use Case is implied by this foundation.

### Acceptance Criteria — reviewed 2026-11-03

- `AC-A-S10-01`: an effective verified Admin can use real paged list, unread-count, mark-one, and mark-all
  operations fixed to the authenticated User and `ADMIN` audience. The list uses the shared approved
  paging/sort/read-state rules, while an unsupported type filter is rejected because Sprint 10 defines no
  Admin-compatible Notification type.
- `AC-A-S10-02`: Sprint 10 defines no Admin Notification type, producer, detector, generic create command,
  or persisted Admin row. Consequently a successful normal Admin list is a genuine empty page, unread
  count is zero, mark-all succeeds idempotently with zero changed rows, and mark-one follows the shared
  ownership-safe not-found behavior.
- `AC-A-S10-03`: the Admin unread badge, preview, and full inbox use the real operations in
  `AC-A-S10-01` and distinguish loading, genuine empty, expired-session/forbidden, and failure states.
  Missing endpoints or request failures are never converted to empty success, and no mock/fallback row,
  hard-coded count, or fabricated Security, Account, System, login, verification, or health category is
  displayed.
- `AC-A-S10-04`: Admin data refreshes on workspace entry, full-inbox or popover open, and successful read
  mutation without polling or fake real-time behavior. Read state changes only after server confirmation;
  opening another Admin route, including Badge management, does not clear or replace inbox state locally.
- `AC-A-S10-05`: a non-Admin cannot use Admin inbox operations; an Admin role on a multi-role account sees
  only `ADMIN` audience rows and cannot read or mutate Participant, Partner, or Organizer rows. Unknown,
  other-owner, and other-role identities remain indistinguishable through the shared ownership-safe
  not-found response, and mutations retain existing CSRF protection.

## 8. Shared foundation acceptance — reviewed 2026-11-03

- `AC-N-S10-01`: list, unread-count, mark-one, and mark-all derive the User from the authenticated Session
  and use the exact workspace role fixed by that operation; no request may select another recipient or
  audience role.
- `AC-N-S10-02`: for a User holding multiple roles, list and unread-count return only the requested role
  audience, while mark-one and mark-all cannot change any row belonging to another role audience.
- `AC-N-S10-03`: a valid list query uses an approved sort with Notification identity ascending as its
  final stable tie-breaker; the default primary sort is `createdAt` descending. For an
  unchanged result set it pages without overlap or omission, supports read-state and role-compatible type
  filters, and returns a genuine empty page when no row matches. Unsupported query values are rejected
  rather than silently replaced.
- `AC-N-S10-04`: unread-count equals the durable rows whose `readAt` is null for the same authenticated
  User and exact role audience; no match returns a genuine zero.
- `AC-N-S10-05`: mark-one conditionally writes one backend `readAt` only while the owned role-scoped row is
  unread. Retry, concurrent mark-one, and concurrent mark-all preserve the first committed timestamp and
  return the resulting durable state.
- `AC-N-S10-06`: mark-all conditionally updates only unread rows for the authenticated User and exact role,
  gives every row changed by that command one backend timestamp, preserves existing timestamps, reports
  the changed-row count, and changes zero rows on an immediate retry.
- `AC-N-S10-07`: Notification creation is internal to an approved domain transition. Recipient and role
  come from durable domain ownership, the recipient may be offline, and no generic client command can
  create a row or supply its recipient/audience.
- `AC-N-S10-08`: the domain transition and its Notification commit atomically. A persistence failure rolls
  both back; retrying the same persisted transition creates at most one row per recipient/role, while a
  later legitimate transition cycle may create a distinct row.
- `AC-N-S10-09`: every persisted row uses an approved role-compatible type and exactly one supported,
  non-null domain reference; persistence rejects invalid role, type, reference, or mismatched combinations.
- `AC-N-S10-10`: unauthenticated access, a disabled account, missing exact authority, an unverified
  account attempting an advanced-role operation, and mutation without the existing CSRF protection
  disclose no Notification data and change no row. Unknown, other-owner, and other-role Notification
  identities return the same ownership-safe not-found outcome.
- `AC-N-S10-11`: one new Flyway migration after the then-current latest version applies both to an
  existing V1–V15 database and a clean Flyway build without modifying an applied migration. It backfills
  every existing Notification as `PARTICIPANT`, preserves identity, type, reference, deduplication key,
  content, `createdAt`, and `readAt`, and enforces the accepted role/type/reference constraints plus
  uniqueness by recipient User, recipient role, and deduplication key.

## 9. Regression acceptance — reviewed 2026-11-03

- `AC-S10-REG-01`: existing Event, Partner application, Booth request/Hold/Payment/Assignment, proposal,
  Activity/request, Participant Notification, and Reward transitions retain their approved statuses,
  guards, lock order, deadlines, response meaning, and idempotency except for the explicitly approved
  Notification side effect. A rejected or rolled-back source transition creates no row, while an approved
  Notification persistence failure rolls back its owning transition as required by `AC-N-S10-08`.
- `AC-S10-REG-02`: clean and V1–V15 upgrade Flyway/Hibernate validation, server-side Session
  authentication, verified-email requirements for advanced roles, exact endpoint authority, owner and
  multi-role isolation, and existing CSRF behavior pass with the Sprint 10 schema and endpoints. No JWT,
  bearer token, refresh token, or client-selected audience is introduced.
- `AC-S10-REG-03`: frontend lint/build and focused browser verification cover genuine loading, populated,
  empty, filtered-empty where applicable, expired-session/forbidden, and failure states; bounded refresh,
  server-confirmed read mutations, and safe role-owned navigation work in Participant, Partner, Organizer,
  and Admin workspaces without breaking existing Event, Booth, Payment, Activity, Reward, Feedback, or
  Heritage routes.
- `AC-S10-REG-04`: Sprint 8 General Feedback remains one shared Organizer queue with its existing access,
  status, rate-limit, and CSRF behavior. Feedback submission or resolution creates no Notification row and
  no per-Organizer broadcast.
- `AC-S10-REG-05`: existing optional Event, Booth, Activity, authentication, and verification email
  behavior remains unchanged and after commit. Email address/verification and delivery success are not
  prerequisites for an approved in-app recipient; an email failure neither rolls back the committed
  domain transition/Notification nor causes another in-app row.
- `AC-S10-REG-06`: Sprint 10 introduces no mock/fallback Notification array, `localStorage` read state,
  SMS, mobile push, WebSocket, SSE beyond the `BR-111` signal, polling, preference/quiet-hour model, broadcast
  composer, NotificationType table, sender User, delivery-attempt table, transactional outbox, or change
  to Event, Booth, Payment, Activity, Feedback, Reward, Heritage, Certificate, or Badge lifecycle meaning.

## 10. UI obligations — reviewed 2026-11-03

Every role experience must:

- use real APIs and typed DTOs
- distinguish loading, empty, filtered-empty, forbidden/session-expired, failure, and populated states
- show unread state from `readAt`, not a local-only flag
- reconcile mark-one and mark-all from server responses
- use role-compatible human wording and avoid developer labels
- navigate only through allowlisted type/reference mappings
- fetch on workspace entry, inbox/popover open, and successful read mutation
- avoid continuous polling and fake real-time claims

The Admin experience must additionally distinguish real empty from request failure. Partner and Organizer
placeholder arrays and no-op mutations must be removed rather than retained as fallback behavior.

## 11. Acceptance Criteria inventory — reviewed 2026-11-03

The active set contains **52 Acceptance Criteria** matching `docs/sprints/sprint-10.md`:

- 11 reviewed shared-foundation criteria
- 7 reviewed Participant criteria
- 13 reviewed Partner criteria
- 10 reviewed Organizer criteria
- 5 reviewed Admin criteria
- 6 reviewed regression criteria

These 52 criteria were approved on 2026-11-03. The 2026-11-06 amendment in `docs/sprints/sprint-10.md`
section 12 adds `AC-E-S10-14`, `AC-E-S10-15`, `AC-O-S10-11`, and `AC-P-S10-08` for the four producers defined
by `BR-110`, and section 13 adds `AC-N-S10-12` and `AC-N-S10-13` for the live signal defined by `BR-111`, for
an active total of **58 Acceptance Criteria**. These amendments govern over earlier closed-type
wording in this document. Developer A may implement the shared foundation after the
activation update is merged. Teammates may implement Partner or Organizer delivery by claiming the
documented Developer B or C work package and coordinating its branch and merge order. No later change may
add a producer, role, type, reference, delivery channel, or combined inbox
outside the accepted actor flows in sections 1 through 7 without a new documentation review.
