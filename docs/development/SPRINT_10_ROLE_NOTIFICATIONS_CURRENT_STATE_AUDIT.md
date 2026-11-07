# Sprint 10 Role-Scoped Notifications Current-State Audit

- Audit date: `2026-11-02`
- Last audit revision: `2026-11-03`
- Repository baseline: `main` at `0deac77`
- Schema baseline: immutable Flyway `V1` through `V15`
- Result: `GAPS CONFIRMED - PRODUCT BOUNDARY READY FOR DOCUMENTATION`
- Mutation performed by this audit: none

## 1. Purpose

This audit distinguishes implemented notification behavior from frontend placeholders before Sprint 10
defines cross-role inbox behavior. It verifies the database, backend, frontend, security, and automated-test
state and records risks that the implementation contract must address.

## 2. Sources inspected

- `AI_CONTEXT.md` and `docs/sprints/CURRENT_SPRINT.md`
- Business Rules BR-02 through BR-05, BR-09, BR-20 through BR-22, BR-25, BR-31, BR-35, BR-36,
  BR-53, BR-60, BR-68, BR-80 through BR-91, and BR-95 through BR-101
- `docs/requirements/06_Use_Case_List.md`
- Sprint 6 and Sprint 7 notification baselines and API contracts
- current Physical ERD plus the Sprint 9 overlay
- Flyway V10 and V12 notification DDL
- backend notification entity, repository, writer, service, controller, security, producer, and tests
- Partner, Organizer, Admin, and Participant frontend services, layouts, views, routes, and Playwright tests

## 3. Durable database state

The `notifications` table is real and durable. It currently stores:

```text
notification_id
recipient_user_id
notification_type
event_id
activity_id
certificate_id
badge_id
deduplication_key
title
message
created_at
read_at
```

Current guarantees:

- owner identity is `recipient_user_id`
- six exact Participant types are allowed
- each type has exactly one Event, Activity, Certificate, or Badge reference
- unique `(recipient_user_id, deduplication_key)` prevents retry duplicates
- unread is represented by null `read_at`
- indexes support owner-created ordering and owner unread queries

Current gaps:

- no audience role exists, so a multi-role account has no durable separation between workspaces
- the type/reference CHECK cannot represent application, Booth request, proposal, or Activity request items
- deduplication uniqueness cannot store the same transition for two role audiences of one User
- V10 and V12 are applied and immutable; a new migration is required

## 4. Participant implementation

Participant has a genuine vertical slice:

```text
GET  /api/v1/participant/notifications
GET  /api/v1/participant/notifications/unread-count
POST /api/v1/participant/notifications/{notificationId}/read
POST /api/v1/participant/notifications/read-all
```

Implemented producers cover:

- Activity schedule or Location change
- Activity cancellation
- Event cancellation
- Certificate issue
- Certificate revoke
- Badge unlock

The writer uses PostgreSQL `ON CONFLICT` for idempotent creation. Domain services create rows in the same
transaction as the owning state transition. Participant frontend list, preview, unread badge, filters,
mark-one, mark-all, and reference navigation use real API data; section 4.4 records the allowlist hardening
still required before that mapper can be generalized safely.

### 4.1 Read-state concurrency defect

Bulk mark-read is an atomic conditional update, but mark-one currently loads a managed entity and calls
`markRead(clock.instant())`. Two concurrent requests can load null and commit different values; a
mark-one request can also race mark-all. This can overwrite the intended first stable `readAt`.

Sprint 10 must replace mark-one with a conditional update equivalent to:

```text
UPDATE notifications
SET read_at = operationTime
WHERE notification_id = requestedId
  AND recipient_user_id = currentUser
  AND recipient_role = endpointRole
  AND read_at IS NULL
```

The service then reloads the owner-and-role-scoped row. Zero updated rows are separated into already-read
success versus ownership-safe not-found.

### 4.2 Refresh gap

The Participant layout fetches preview/unread data on layout lifecycle and frontend events. It has no
approved server refresh policy for newly committed rows while the page remains open. The existing interval
updates relative display time rather than server data.

This audit establishes only that a server-data refresh policy is missing. The reviewed Sprint scope must
choose its bounded refresh triggers; browser-focus refresh is not implied by the current implementation.
Polling or WebSocket behavior must not be added silently.

### 4.3 Participant preview state gap

The full Participant inbox already distinguishes loading, filtered-empty, empty, and request failure. The
layout preview does not yet provide the same guarantees:

- opening the popover does not fetch current server data
- a list/count failure is written only to the browser console, leaving the preview able to look empty
- clicking a preview item starts mark-read without awaiting or presenting mutation failure before closing
  the popover and navigating

Sprint 10 Participant compatibility must preserve the real API integration while making preview failure,
refresh, and server-confirmed read state explicit. It must not replace a failed request with a successful
empty or zero-unread presentation.

### 4.4 Participant navigation allowlist gap

The current Participant adapter branches primarily on `referenceType` and treats its final unmatched branch
as Certificate navigation. The V12 CHECK constraint and current four-value Participant reference enum keep
persisted data valid today, but this is not a safe pattern to copy into a generalized cross-role mapper.

Sprint 10 must keep a Participant-specific allowlist for the approved `type` plus `referenceType` pair and
show an unavailable-target state for anything else. It must not let newly introduced Partner or Organizer
reference values fall through to `/participant/certificates` or another default route.

## 5. Partner implementation

Partner currently has visual notification code but no durable inbox integration:

- `partnerApi.getNotifications()` returns an empty array
- mark-read is a no-op
- `/partner/notifications` redirects to `/partner`
- the Partner layout still links to the redirected route
- `PartnerNotificationsPage` exists but is not a reachable real-data page

The Activity partner notification service sends post-commit email events. It does not create in-app rows.
Existing Booth selection and Event cancellation mail paths also do not provide a Partner inbox.

Conclusion: Partner notification UI is a placeholder and must not be treated as implemented behavior.

### 5.1 Partner transition integration points

The required Partner outcomes attach to existing durable transitions rather than new workflows:

- application review changes only a locked `PENDING` application to `APPROVED` or `REJECTED`
- positive-price Booth selection finishes at `SELECTED`; zero-price selection finishes at `COMPLETED` and
  creates the Assignment in the same transaction
- trusted payment settlement changes `SELECTED` to `COMPLETED` and marks competing pending requests
  `NOT_SELECTED`
- Hold expiry changes the request to `PAYMENT_EXPIRED` only when payment/Assignment evidence does not block
  release
- Event cancellation already cancels open Booth, proposal, Activity, and request children in one cascade
- existing Activity Partner messages are post-commit email events, not durable in-app rows

The existing Event-cancellation email recipient query filters by verified email. It is evidence for the
`PENDING`/`APPROVED` application set, but it must not be reused as the in-app ownership boundary: durable
Partner notifications resolve the representative User directly and do not depend on email delivery.

### 5.2 Email-event and final-state hazards

The existing Booth selection, Activity Partner message, and Event cancellation events are consumed
`AFTER_COMMIT` for optional email. They cannot be reused as durable in-app producer events because the
in-app row must commit atomically with the owning transition and must not depend on an email recipient.

There is also a concrete final-state mismatch: zero-price Booth selection commits the request as
`COMPLETED` and creates its Assignment, but still publishes `BoothSelectionMessageRequested` for the
existing email path. An inbox listener attached to that event would incorrectly create a selected-for-
payment row. The Sprint 10 producer must inspect the final durable Booth-request/Hold/Assignment state in
the selection transaction and create only the Assignment-confirmed outcome.

Hold expiry can commit through scheduled expiry and several Payment-settlement/reconciliation paths. The
Partner producer must attach wherever `hold.expire(now)` actually returns a state change, not merely where
a Payment attempt becomes failed or timed out. Likewise, trusted settlement and zero-price selection must
create the `COMPLETED` outcome and all resulting `NOT_SELECTED` competitor outcomes inside their respective
Assignment transactions.

`EventActivityCascadeService.completeEvent` can cancel a still-Draft official Activity with source
`SYSTEM` and then close its pending requests. The in-app integration must recognize that parent Activity
impact and suppress those child request outcomes. For an Activity that instead reaches `COMPLETED`, an
independently cancelled pending request may retain its own request outcome because no Activity-cancellation
row represents that result.

## 6. Organizer implementation

Organizer has a placeholder view and fake service methods:

- `organizerApi.getNotifications()` returns an empty array
- mark-read is a no-op
- `ManagementPortal` never loads the notification list on workspace entry, popover open, or full-inbox open
- `organizerRoutes.ts` declares `/organizer/notifications`, but omits `notifications` from
  `SUPPORTED_TABS`; the current route therefore resolves as invalid and redirects the full inbox to the
  Organizer overview
- the full view applies only client-side `all`/`unread`/`important` filters; `important` is not an approved
  server filter and its displayed count is hard-coded as `1`
- the full view navigates without marking the selected item read, while the popover fires mark-read without
  awaiting or presenting a failure before navigation
- empty placeholder data is rendered as a successful empty inbox; loading, filtered-empty, forbidden,
  expired-session, and failure states are not represented
- current copy and categories imply Participant, Feedback, and System alerts outside the reviewed owner-work
  scope
- no Organizer notification controller or producer exists
- the shared draft response originally exposed only `referenceId`; application and Booth-request Organizer
  screens require an Event id, while their current APIs cannot resolve owner-scoped detail from the
  reference id alone. A client-side scan across all Events would be inefficient and ownership-fragile, so
  Sprint 10 must return server-derived Event navigation context instead of guessing or embedding an
  arbitrary target URL

Actionable owner-scoped domain inputs already exist: Partner applications, Booth requests, Activity
proposals, and Activity change/cancellation requests. Each resolves to one Event owner.

General Feedback is different. Sprint 8 defines one shared queue visible to every verified Organizer and
explicitly avoids Event-owner filtering. Creating one notification row per Organizer for each Feedback
would introduce a broadcast model and duplicate an existing queue. Sprint 10 therefore excludes it.

### 6.1 Organizer transition integration points

The approved Organizer work items attach to existing durable transitions rather than a new workflow:

- application submission creates one new `PENDING` PartnerEventApplication under a locked Event
- Booth request submission creates one new `PENDING` request for an approved Partner application
- proposal submission creates a new `PENDING` proposal; resubmission is the distinct
  `NEED_CHANGES → PENDING` transition, while editing in `NEED_CHANGES` is not a resubmission
- Activity change and cancellation submissions each create one new typed `PENDING` request after locking
  the Activity/Event root; cancellation also persists the legacy compatibility `isLate` result
- safe withdrawal of a selected Booth request commits `SELECTED → WITHDRAWN`; Hold expiry commits
  `SELECTED → PAYMENT_EXPIRED` only when Payment/reconciliation/Assignment evidence does not block it

Every source resolves to one durable `events.organizer_user_id`. A re-selection item is actionable only
when another `PENDING` request for that Booth still passes the same Event, deadline, application, quota,
configuration, Location, Hold, and Assignment guards as the Organizer selection command at that backend
time. A pending-request withdrawal, or a release after selection is no longer legal, must not create a
false work item.

The current code has no single reusable selection-eligibility component. The checks are embedded in
`OrganizerBoothRequestService.select`, while selected withdrawal is handled by
`PartnerBoothRequestService.withdraw` and Hold expiry occurs in both `BoothHoldExpiryTransactions` and
several `PaymentSettlementService` branches. Adding a notification independently to those release paths
would either miss transitions or create false work items. Sprint 10 must reuse/extract the same guarded
predicate under the Event-root lock, after a release truly changes the request, and write at most one row
inside that transaction.

For stable deduplication and navigation, the re-selection Notification must reference the just-released
terminal Booth request and its `withdrawnAt`/`paymentExpiredAt`, not whichever pending candidate happens
to be found first. `BoothRequestResponse` already exposes the released request's Event and Booth ids, and
the Organizer UI already has an Event-scoped Booth-request route. That route currently has no request-id
deep link, so the Sprint 10 navigation adapter must open the correct Event queue (optionally narrowed to
the Booth) and revalidate live candidates rather than presenting the terminal request as selectable.

All six Organizer sources can derive the owning Event through existing durable relationships. The reviewed
API therefore adds nullable `contextEventId` to the shared response, requires it for Organizer types, and
uses an exact type/reference allowlist to select the Event detail, Booth-request queue, proposal queue,
change-request queue, or cancellation-request queue. This is additive to the current Participant DTO and
does not persist a duplicate Event FK or expose a generic URL.

## 7. Admin implementation

Admin frontend calls endpoints that do not exist in the backend:

```text
GET   /api/v1/admin/notifications
PATCH /api/v1/admin/notifications/{id}/read
PATCH /api/v1/admin/notifications/read-all
```

The portal catches list failure and converts it to an empty array. This hides the missing backend as a
successful empty inbox. The Badge route also forces the chrome notification state to an empty array rather
than loading an Admin inbox result. Opening the top-bar popover does not fetch current data, and item clicks
do not await or present mark-read failure before closing/navigating.

The current Admin client expects an unpaged raw array, applies local categories, and renders Security,
Account, and System tabs. Its copy promises system alerts, unusual-login logs, and user-verification work.
No approved Admin Notification type, producer, detector, or response workflow exists for any of those
claims. These labels are fabricated product behavior, not a harmless empty-state design.

The client also uses `PATCH` for both read mutations even though the established Notification contract uses
CSRF-protected `POST`, never calls an unread-count endpoint, and derives the badge from whichever local
array happened to load. The Admin notification route itself is reachable, unlike the current Organizer
route, so its empty rendering can convincingly hide all of these API failures.

Current Admin Use Cases manage accounts, roles, and Badges. They do not define a separate inbound action
queue. Sprint 10 should implement real list/read infrastructure and a genuine empty state but no producer,
fake row, or speculative security detector.

### 7.1 Admin foundation boundary

Admin still needs genuine owner-and-role-scoped list, unread-count, mark-one, and mark-all endpoints so the
shared inbox architecture is complete and failure is observable. Under the Sprint 10 type matrix:

- a normal Admin list is an empty page and unread count is zero
- mark-all succeeds idempotently with zero changed rows
- mark-one has no valid Admin row to target and follows ownership-safe not-found behavior
- unsupported type filters are rejected rather than mapped to invented Security/Account/System categories
- no frontend fallback may synthesize a row or convert request failure into empty success

This foundation does not authorize a generic create endpoint, an Admin Notification type, or a producer.
Adding any of those later requires an approved actionable Admin workflow and its own scope review.

The implementation must query the database with User plus `ADMIN` audience rather than return hard-coded
empty values. The accepted schema makes Admin rows impossible because it defines no compatible
type/reference branch; therefore truthful queries still return an empty page, count zero, mark-all count
zero, and ownership-safe mark-one not-found. This preserves one reusable inbox architecture while keeping
the product promise honest.

## 8. Security findings

- Current Participant operations resolve the User from the authenticated Session and are owner-safe.
- Advanced demo accounts may carry `PARTICIPANT` plus an advanced role, confirming that User-only scoping
  is insufficient for cross-role delivery.
- Broad Organizer route configuration admits Organizer or Admin in some existing areas. Notification
  endpoints must have explicit role matchers and method-level authority so Admin does not inherit the
  Organizer inbox.
- Partner, Organizer, and Admin roles require verified email under the existing authority model.
- CSRF remains required for mark-one and mark-all commands.

## 9. Trigger feasibility and exclusions

### 9.1 Feasible Partner recipients

Partner-owned workflows resolve to `partner_organizations.representative_user_id`. Application, Booth
request, proposal, and Activity request transitions already have stable persisted identities and terminal
or audited transition timestamps suitable for deduplication.

### 9.2 Feasible Organizer recipients

Application, Booth request, proposal, and Activity request flows resolve to `events.organizer_user_id`.
Booth re-selection is actionable only if release is safe, another candidate is pending, the Event remains
eligible, and backend time has not passed the Booth request deadline.

### 9.3 Deliberate exclusions

- Participant registrations are high volume and already visible through monitoring.
- Organizer self-actions have synchronous results.
- Partner self-actions have synchronous results.
- Feedback is a shared queue rather than an owner-scoped work item.
- Payment reconciliation has no approved Admin workflow.
- Admin login/security alerts have no implemented detector or response workflow.

## 10. Test baseline

Participant notification backend tests already cover owner isolation, list/filter/paging, unread count,
mark-one, mark-all, idempotent writes, type validation, Badge unlock, and transaction behavior. Participant
frontend Playwright scenarios cover the full inbox and preview behaviors.

There is no equivalent Partner, Organizer, or Admin notification backend integration or browser suite.
Some existing E2E mocks intentionally expect Partner/Organizer notification calls not to occur, while the
Admin empty-array catch masks its missing backend. These expectations must be replaced deliberately, not
worked around.

The focused Sprint 10 regression boundary is larger than the Notification package because producers are
inserted into existing transactions. Verification must therefore cover:

- Partner application submit/review and Event cancellation
- Booth request submit/review/select/withdraw, Hold expiry, Payment settlement/reconciliation, and
  Assignment creation
- proposal submit/resubmit/review/lifecycle and Activity change/cancellation request review/lifecycle
- the six existing Participant producers, Badge award, read state, and reference navigation
- Session authentication, verified advanced roles, exact endpoint authority, CSRF, owner isolation, and
  multi-role isolation
- clean and upgrade Flyway/Hibernate validation
- frontend lint/build plus focused browser flows for the four role inboxes and their existing owned targets
- Sprint 8 Feedback, optional after-commit email, and Sprint 9 Heritage route regressions

Tests that currently assert Partner/Organizer calls never occur may be changed only where Sprint 10 now
requires a real request. Unrelated test expectations must not be weakened, and a failed request must not be
mocked or caught into an empty-success state merely to keep a browser scenario green.

## 11. Documentation conflicts and stale sources

1. The Physical ERD report is now corrected through immutable V15, but the next migration version remains
   unreserved until activation and an updated `main` check.
2. BR-53 is broad while active BR-99 freezes the Participant slice. The approved cross-role candidate rule
   must be promoted into the active Business Rules during Sprint activation; the candidate Sprint document
   cannot silently override the current baseline.
3. Placeholder frontend labels and methods are implementation evidence, not product authority.
4. BR-81 says Organizer selection is allowed "không muộn hơn" the Booth request deadline, while the current
   selection command requires `selectedAt.isBefore(boothRequestDeadlineAt)` and therefore rejects exact
   equality. Sprint 10 must not widen the selection workflow implicitly: the re-selection producer uses
   the actual selection eligibility predicate at the same backend time. The deadline-boundary discrepancy
   remains a pre-implementation domain clarification unless the active Business Rule is made exact.

## 12. Audit conclusion

The existing Participant foundation is reusable, but generalizing only by User would leak notifications
between role workspaces. The safe minimum is:

- one table with persisted recipient role
- four exact role endpoint families
- explicit role-compatible types and references
- stable per-User/per-role deduplication
- atomic first-read updates
- Partner and Organizer producers only where a recipient and actionable transition are unambiguous
- Admin infrastructure with no producer

No production code, migration, configuration, `.env`, or local script was changed by this audit.
