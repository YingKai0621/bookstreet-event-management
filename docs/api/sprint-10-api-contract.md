# Sprint 10 Role-Scoped Notification API Contract

> Status: `APPROVED - FROZEN FOR IMPLEMENTATION`.
>
> Sources in precedence order: Business Rules, Use Case List, active Sprint 10 scope and Acceptance
> Criteria, current Physical ERD, then this contract. Sprint 10 API and ERD changes are downstream design
> artifacts and are not treated as their own source of truth.
>
> Review progress: the shared inbox foundation in sections 1, 2, 4 through 8, and 10 plus the Participant
> type/reference/producer contract in sections 3.2 and 9.1 were reviewed against the accepted Acceptance
> Criteria and current implementation on 2026-11-03. The Partner type/reference/producer contract in
> sections 3.3 and 9.3, the Organizer type/reference/producer/navigation contract in sections 3.4 and
> 9.4, and the producer-free Admin foundation in sections 3.5 and 9.5 were also reviewed on 2026-11-03.
> Cross-role frontend integration, traceability, exclusions, and verification completed review on
> 2026-11-03. The downstream ERD overlay, implementation plan, and three-developer assignment have also
> completed review. PR #116 approved the contract; Sprint 10 activation on 2026-11-03 froze it for
> implementation.

## 1. Scope and conventions

- Base path: `/api/v1`.
- Authentication remains Spring Security server-side Session stored in Redis.
- Browser identity comes from the HttpOnly Session cookie.
- JSON uses camelCase; timestamps are ISO-8601 UTC instants.
- Backend `Clock` owns read timestamps and producer timestamps.
- UI displays time in `Asia/Ho_Chi_Minh`.
- These inbox operations accept no JSON request object. Declared query parameters reject invalid values as
  specified by each operation; this contract does not invent a blanket rule for unknown query-parameter
  names.
- IDs are positive signed 64-bit integers.
- All Notification successes and errors use `Cache-Control: no-store`.
- GET operations never mutate data.
- POST operations require the existing CSRF cookie/header proof.
- PostgreSQL is durable truth; Redis stores no Notification data.

Sprint 10 defines exactly 16 inbox operations, four per role:

```text
GET  /participant/notifications
GET  /participant/notifications/unread-count
POST /participant/notifications/{notificationId}/read
POST /participant/notifications/read-all

GET  /partner/notifications
GET  /partner/notifications/unread-count
POST /partner/notifications/{notificationId}/read
POST /partner/notifications/read-all

GET  /organizer/notifications
GET  /organizer/notifications/unread-count
POST /organizer/notifications/{notificationId}/read
POST /organizer/notifications/read-all

GET  /admin/notifications
GET  /admin/notifications/unread-count
POST /admin/notifications/{notificationId}/read
POST /admin/notifications/read-all
```

Every path above is relative to `/api/v1`.

There is no combined `/notifications` endpoint, recipient selector, create endpoint, delete endpoint,
broadcast endpoint, preference endpoint, email endpoint, push endpoint, or WebSocket. The only stream is the
content-free live update signal in section 9.7.

## 2. Exact role security

| Endpoint family | Required effective authority | Persisted audience |
| --- | --- | --- |
| `/participant/notifications` | `ROLE_PARTICIPANT` | `PARTICIPANT` |
| `/partner/notifications` | `ROLE_PARTNER` | `PARTNER` |
| `/organizer/notifications` | `ROLE_ORGANIZER` | `ORGANIZER` |
| `/admin/notifications` | `ROLE_ADMIN` | `ADMIN` |

Rules:

- User id is derived only from the authenticated principal.
- Partner, Organizer, and Admin authority remains effective only with the existing verified-email rule.
- A broad existing Organizer matcher that also admits Admin cannot authorize Organizer Notification paths.
  Specific route matchers and method-level checks enforce the table above.
- Multi-role accounts are accepted for each role they effectively possess, but each endpoint filters one
  persisted audience only.
- Disabled, unauthenticated, unverified, or wrong-role callers receive the existing security outcome.
- Other-owner and other-role Notification identities are indistinguishable from unknown identities.

## 3. Closed role-compatible values

### 3.1 Recipient roles

```text
PARTICIPANT | PARTNER | ORGANIZER | ADMIN
```

The role is server-owned and is not returned as a mutable field or accepted from clients.

### 3.2 Participant types

```text
ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED
ACTIVITY_CANCELLED
EVENT_CANCELLED
CERTIFICATE_ISSUED
CERTIFICATE_REVOKED
BADGE_UNLOCKED
ACTIVITY_STARTING_SOON
```

The Participant type/reference/producer matrix is closed and preserves the implemented Sprint 6/7
contract, plus the 2026-11-06 amendment in section 9.6:

| Type | Required reference | Approved producing transition and recipient |
| --- | --- | --- |
| `ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED` | `ACTIVITY` | A committed schedule or Location revision notifies each User with a seat-active registration for that Activity. |
| `ACTIVITY_CANCELLED` | `ACTIVITY` | A committed Activity cancellation notifies each User whose active Activity registration is cancelled by that transition. |
| `EVENT_CANCELLED` | `EVENT` | A committed Event cancellation notifies each User whose Event registration was active when the cancellation was applied. |
| `CERTIFICATE_ISSUED` | `CERTIFICATE` | A Certificate transition to issued notifies that Certificate's owning Participant. |
| `CERTIFICATE_REVOKED` | `CERTIFICATE` | A Certificate transition to revoked notifies that Certificate's owning Participant. |
| `BADGE_UNLOCKED` | `BADGE` | A newly persisted UserBadge from an approved award path notifies the earning User. |
| `ACTIVITY_STARTING_SOON` | `ACTIVITY` | A server reminder job notifies each User with an active registration of a Published Activity inside the reminder window. |

`GET /participant/notifications` accepts exactly these seven values for `type`. Sprint 10 does not rename
them or introduce another Participant producer. Event cancellation retains its Event summary behavior;
the child Activity-registration cancellations performed by that same Event transition do not create
additional `ACTIVITY_CANCELLED` rows.

### 3.3 Partner types

```text
PARTNER_APPLICATION_STATUS_CHANGED
PARTNER_BOOTH_REQUEST_STATUS_CHANGED
PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED
PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED
PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED
PARTNER_EVENT_CANCELLED
PARTNER_ACTIVITY_CANCELLED
PARTNER_EVENT_PUBLISHED
PARTNER_BOOTH_HOLD_EXPIRING
```

The Partner endpoint accepts exactly the nine values above for `type`. Their type/reference/transition
matrix is closed:

| Type | Required reference | Approved committed outcomes |
| --- | --- | --- |
| `PARTNER_APPLICATION_STATUS_CHANGED` | `PARTNER_APPLICATION` | Application `PENDING → APPROVED` or `PENDING → REJECTED`. |
| `PARTNER_BOOTH_REQUEST_STATUS_CHANGED` | `BOOTH_REQUEST` | Final `SELECTED` with an active positive-price Hold; `PENDING → REJECTED`; `PENDING → NOT_SELECTED` after another Assignment commits; `SELECTED → PAYMENT_EXPIRED` after safe Hold expiry; or final `COMPLETED` after trusted settlement/Assignment or zero-price Assignment. |
| `PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED` | `ACTIVITY_PROPOSAL` | Proposal `PENDING → NEED_CHANGES/APPROVED/REJECTED`, or independent System closure `PENDING/NEED_CHANGES → CANCELLED`. |
| `PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED` | `ACTIVITY_REQUEST` | Change request `PENDING → APPROVED/REJECTED`, or independent lifecycle `PENDING → CANCELLED`. |
| `PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED` | `ACTIVITY_REQUEST` | Cancellation request `PENDING → APPROVED/REJECTED`, or independent lifecycle `PENDING → CANCELLED`. |
| `PARTNER_EVENT_CANCELLED` | `EVENT` | Event `PUBLISHED → CANCELLED` summary for a representative whose organization has a `PENDING` or `APPROVED` application. |
| `PARTNER_ACTIVITY_CANCELLED` | `ACTIVITY` | Partner-owned official non-terminal Activity `→ CANCELLED` with source `ORGANIZER` or `SYSTEM`, outside Event cancellation and outside an approved Partner cancellation request. |
| `PARTNER_EVENT_PUBLISHED` | `EVENT` | Event `DRAFT → PUBLISHED` for each `ACTIVE` organization representative except the Event Organizer. |
| `PARTNER_BOOTH_HOLD_EXPIRING` | `BOOTH_REQUEST` | Server reminder for an eligible Active Hold inside the reminder window. |

The generic `*_STATUS_CHANGED` names group filters by owned workflow; they do not authorize every status
transition. Title and message record the approved historical outcome in user-facing language, while the
referenced resource remains the source for its current state. A client must not derive business authority
or payment evidence from message text.

### 3.4 Organizer types

```text
ORGANIZER_NEW_PARTNER_APPLICATION
ORGANIZER_NEW_BOOTH_REQUEST
ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED
ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST
ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST
ORGANIZER_BOOTH_RESELECTION_REQUIRED
ORGANIZER_BOOTH_PAYMENT_CONFIRMED
```

The Organizer endpoint accepts exactly the seven values above for `type`. Their type/reference/transition
matrix is closed:

| Type | Required reference | Approved committed transition |
| --- | --- | --- |
| `ORGANIZER_NEW_PARTNER_APPLICATION` | `PARTNER_APPLICATION` | Creation of a new application in `PENDING`. |
| `ORGANIZER_NEW_BOOTH_REQUEST` | `BOOTH_REQUEST` | Creation of a new Booth request in `PENDING` for an approved application. |
| `ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED` | `ACTIVITY_PROPOSAL` | Initial proposal creation in `PENDING`, or a distinct `NEED_CHANGES → PENDING` resubmission. |
| `ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST` | `ACTIVITY_REQUEST` | Creation of a new change request in `PENDING`. |
| `ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST` | `ACTIVITY_REQUEST` | Creation of a new cancellation request in `PENDING`; user-facing content may say it was sent late only when the persisted compatibility `isLate` value is true. |
| `ORGANIZER_BOOTH_RESELECTION_REQUIRED` | `BOOTH_REQUEST` | A safely released selected request commits as `WITHDRAWN` or `PAYMENT_EXPIRED`, and at least one different `PENDING` request for the same Booth passes the canonical selection eligibility check at that backend time. |
| `ORGANIZER_BOOTH_PAYMENT_CONFIRMED` | `BOOTH_REQUEST` | Trusted settlement completes a Booth request and creates its Assignment. Zero-price selection creates no row. |

The re-selection row references the released terminal Booth request, not an arbitrary pending candidate.
That terminal request and its persisted release time provide a stable transition identity and durable
Event/Booth context even if a candidate later withdraws. The Organizer client opens the owner-scoped Booth
request queue for the referenced request's Event and may narrow to its Booth; it never treats the
referenced terminal request as the candidate to select.

### 3.5 Admin types

There is no Admin type in Sprint 10. An Admin list accepts no `type` filter value and normally returns an
empty page. Future Admin producers require an approved contract and migration.

The Admin endpoint therefore has an empty closed type set. Omitting `type`, or supplying only whitespace
where the shared parser treats it as absent, executes the real role-scoped query. Any nonblank `type` value
returns `400 INVALID_ENUM_VALUE`; it is never converted into a fabricated Security, Account, Role, System,
login, verification, health, audit-log, or Badge notification category.

`ADMIN` remains a valid inbox audience so the four role APIs share one ownership model, but the Sprint 10
database type/role/reference constraint deliberately makes an Admin row impossible. Adding one later
requires an approved Admin workflow, a named type and reference, a producer contract, and a new migration;
it is not enabled by reusing a Partner, Organizer, or Participant type.

### 3.6 Reference types

```text
EVENT
ACTIVITY
CERTIFICATE
BADGE
PARTNER_APPLICATION
BOOTH_REQUEST
ACTIVITY_PROPOSAL
ACTIVITY_REQUEST
```

The response mapper derives `referenceType` and `referenceId` from the validated physical FK. No generic
caller-supplied reference exists.

## 4. Shared representations

### 4.1 NotificationResponse

Participant response compatibility is preserved:

```json
{
  "notificationId": 901,
  "type": "EVENT_CANCELLED",
  "title": "Sự kiện đã bị hủy",
  "message": "Sự kiện đã đăng ký không còn diễn ra.",
  "referenceType": "EVENT",
  "referenceId": 73,
  "contextEventId": 73,
  "createdAt": "2026-11-02T08:30:00Z",
  "readAt": null,
  "read": false
}
```

Rules:

- `notificationId`, `type`, `title`, `message`, `referenceType`, `referenceId`, and `createdAt` are non-null.
- `contextEventId` is a positive Event identity derived server-side through the validated domain reference.
  It is non-null for every Sprint 10 Organizer type and nullable when a role-compatible target has no Event
  context, such as a Badge or Certificate. It is navigation context only and grants no authority.
- `readAt` is nullable; `read` is exactly `readAt != null`.
- `deduplicationKey`, recipient User, recipient role, FK column names, internal review notes, contact data,
  payment evidence, raw QR tokens, Session data, and CSRF values are never returned.
- Title and message are escaped text snapshots, not HTML or navigation URLs.

### 4.2 NotificationPageResponse

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

### 4.3 NotificationUnreadCountResponse

```json
{
  "unreadCount": 0
}
```

### 4.4 NotificationBatchReadResponse

```json
{
  "updatedCount": 3
}
```

## 5. List operation

The contract below applies to each role-specific `GET /{role}/notifications` path.

Accepted parameters:

| Parameter | Default | Rules |
| --- | --- | --- |
| `page` | `0` | Integer, minimum 0 |
| `size` | `20` | Integer from 1 through 100 |
| `sort` | `createdAt,desc` | `createdAt` or `readAt`, optionally followed by `,asc` or `,desc`; field-only form defaults to descending |
| `read` | absent | `true` or `false` |
| `type` | absent | Exact type compatible with the endpoint role |

Database predicate always contains:

```text
recipient_user_id = authenticatedUserId
AND recipient_role = endpointRole
```

Optional `read` and `type` predicates combine by logical AND. Ordering always appends
`notification_id ASC` as the final deterministic tie-breaker, regardless of the primary sort direction.
When `readAt` is the primary field, unread rows have null `readAt` and are ordered `NULLS LAST` for both
directions.

Success: `200 NotificationPageResponse<NotificationResponse>`.

Empty collection, filtered empty, and a valid page after the last page return a successful empty `content`
array with real metadata. The server does not replace invalid input with defaults.

Errors:

- `400 INVALID_PAGE`
- `400 INVALID_SIZE`
- `400 INVALID_SORT`
- `400 INVALID_FILTER`
- `400 INVALID_ENUM_VALUE`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `500 INTERNAL_ERROR`

## 6. Unread-count operation

The contract applies to each `GET /{role}/notifications/unread-count` path.

Predicate:

```text
recipient_user_id = authenticatedUserId
AND recipient_role = endpointRole
AND read_at IS NULL
```

Success: `200 NotificationUnreadCountResponse`.

This operation declares no query parameters. It never loads another role's rows and never changes state.

## 7. Mark-one-read operation

The contract applies to each `POST /{role}/notifications/{notificationId}/read` path.

Request body: none.

Processing:

1. authenticate and verify exact endpoint role
2. verify CSRF
3. validate positive `notificationId`
4. obtain one backend operation timestamp at PostgreSQL microsecond precision
5. atomically update only the matching unread owner-and-role row
6. reload the same owner-and-role row
7. return its durable representation

Conditional mutation:

```text
UPDATE notifications
SET read_at = operationTime
WHERE notification_id = notificationId
  AND recipient_user_id = authenticatedUserId
  AND recipient_role = endpointRole
  AND read_at IS NULL
```

Success: `200 NotificationResponse`.

If the row is already read, success returns its original `readAt` unchanged. Concurrent mark-one and
mark-all commands may race, but the first committed value remains stable and every successful retry returns
that value.

Unknown, other-owner, or other-role identity returns `404 NOTIFICATION_NOT_FOUND`.

Errors:

- `400 INVALID_IDENTIFIER`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `404 NOTIFICATION_NOT_FOUND`
- `500 INTERNAL_ERROR`

Missing or invalid CSRF proof follows the existing Notification security behavior and returns
`403 ACCESS_DENIED`; Sprint 10 does not silently change the established Participant error code.

## 8. Mark-all-read operation

The contract applies to each `POST /{role}/notifications/read-all` path.

Request body: none.

One conditional update sets one operation timestamp where User and role match and `read_at IS NULL`.
Existing read timestamps remain unchanged.

Success: `200 NotificationBatchReadResponse`.

- `updatedCount` is the number of rows changed by this command.
- A retry after success returns `updatedCount: 0`.
- The command never changes another role audience.

Errors:

- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `500 INTERNAL_ERROR`

Missing or invalid CSRF proof follows the same existing `403 ACCESS_DENIED` behavior as mark-one.

## 9. Producer contract

Clients cannot create Notifications. Approved domain services call one internal writer with a validated
command containing:

```text
recipientUserId
recipientRole
notificationType
exactly one approved reference
deduplicationKey
title
message
createdAt
```

The writer:

- validates positive identities, lengths, role/type/reference compatibility, and time
- normalizes surrounding display whitespace without using text for identity
- inserts within the caller's domain transaction
- uses `ON CONFLICT (recipient_user_id, recipient_role, deduplication_key) DO NOTHING`
- returns whether a row was created or already existed
- never starts a separate transaction that could commit after a domain rollback

### 9.1 Participant producer compatibility — reviewed 2026-11-03

The six Participant producers in section 3.2 remain the existing producers rather than a generalized
replacement. Each resolves the recipient and approved physical reference from durable domain ownership,
joins the transaction that commits the source transition, and creates no row when there is no approved
recipient.

Their retry identities remain based on durable transition evidence:

- Activity schedule or Location change: the persisted Activity revision identity
- Activity cancellation: the terminal Activity cancellation identity
- Event cancellation: the Event cancellation identity
- Certificate issue or revoke: Certificate identity, resulting state, and persisted transition identity
- Badge unlock: the newly persisted UserBadge identity

The Sprint 10 migration adds the `PARTICIPANT` audience to existing rows and extends uniqueness with the
recipient role; it preserves every Participant type, reference, deduplication key, timestamp, and response
field. The generalized writer must retain the existing atomic insert-if-absent behavior and must not add a
seventh Participant producer.

### 9.2 Shared stable deduplication identities — reviewed 2026-11-03

Examples of identity sources:

- application id plus persisted review outcome/time
- BoothRequest id plus persisted resulting status/transition time
- proposal id plus persisted review or submission cycle time
- ActivityRequest id plus persisted submission or handled/cancelled time
- Event id plus Event cancellation transition
- Activity id plus cancellation transition or revision identity
- existing Participant revision, Certificate state, or UserBadge identity

The exact string format is implementation-owned but deterministic, at most 200 characters, tested, and
never regenerated from a new retry timestamp.

### 9.3 Partner recipient, transition identity, and suppression — reviewed 2026-11-03

Partner producers resolve `partner_organizations.representative_user_id` through the affected durable
resource. Application and Booth-request ownership follow their PartnerOrganization; proposal ownership
follows its application; Activity-request and Activity ownership follow the official Activity's source
proposal and application. A direct Organizer Activity without Partner provenance has no Partner recipient.
Recipient resolution does not use an email-recipient query and does not require an email address or active
browser Session.

The committed result, not a pre-transition command or post-commit email event, selects the outcome:

- positive-price Booth selection emits `SELECTED` only after the active Hold exists
- zero-price selection emits only `COMPLETED` after the Assignment exists
- trusted settlement emits `COMPLETED` and emits `NOT_SELECTED` for each competing request changed by that
  same Assignment transaction
- a Payment failure or timeout alone emits nothing; if the same operation also safely expires the Hold and
  changes the Booth request, it emits only the resulting `PAYMENT_EXPIRED` terminal outcome

Stable identities use the aggregate identity, resulting state, and its persisted transition evidence:
application `reviewedAt`; Booth-request `selectedAt`, `reviewedAt`, `completedAt`, or `paymentExpiredAt` as
applicable; proposal `reviewedAt` or `cancelledAt`; Activity-request `handledAt` or `cancelledAt`; Event
`cancelledAt`; and Activity `cancelledAt`. A later legitimate proposal review cycle therefore remains
distinct while retrying one committed transition does not create another row.

The in-app write joins the domain transaction. Existing `AFTER_COMMIT` email events remain separate and
cannot be used as durable inbox producers. Notification content exposes no email address, reconciliation
flag, provider response, raw payment evidence, Session value, or internal suppression label.

Suppression precedence is mandatory:

1. Event cancellation creates at most one Partner row per representative/Event and suppresses application,
   Booth-request, proposal, Activity-request, and Activity child outcomes from that cascade.
2. Approval of a Partner cancellation request emits the request outcome and suppresses the resulting
   Activity-impact row with source `PARTNER_REQUEST`.
3. Direct Organizer or independent System Activity cancellation emits one Activity-impact row and
   suppresses request-cancelled rows caused by that same transition.
4. Zero-price Booth selection emits only Assignment confirmation, never an intermediate selected-for-
   payment row.

### 9.4 Organizer recipient, transition identity, and actionability — reviewed 2026-11-03

Every Organizer producer resolves `events.organizer_user_id` through the affected durable resource. The
application and Booth request resolve their Event directly; a proposal resolves its application and Event;
an Activity request resolves its official Activity and Event. No request body, current browser Session, or
email recipient supplies the Organizer identity.

The in-app write joins the transaction that commits the submission or release. Stable identities use the
aggregate identity plus persisted transition evidence:

- application id plus `submittedAt`
- Booth-request id plus `submittedAt` for a new request
- proposal id plus `submittedAt` for initial submission, or the `updatedAt` written by the committed
  `NEED_CHANGES → PENDING` resubmission
- Activity-request id plus `submittedAt`
- released Booth-request id, resulting `WITHDRAWN` or `PAYMENT_EXPIRED` state, and its persisted
  `withdrawnAt` or `paymentExpiredAt`

Editing a proposal while it remains `NEED_CHANGES`, withdrawing a pending item, retrying a committed
submission, and an Organizer's own synchronous review command create no Organizer row. The cancellation-
request message may translate persisted `isLate=true` into human wording such as "gửi trễ"; it does not
expose `isLate`, cutoff, compatibility, or other developer terminology.

Re-selection is stricter than observing a terminal status. Within the release transaction and existing
Event-root lock order, the backend must confirm all of the following after the Hold/request transition:

1. the selected request was actually and safely changed to `WITHDRAWN` or `PAYMENT_EXPIRED`;
2. selection is still legal for the owning published Event under the canonical deadline boundary;
3. no active Hold or overlapping active Assignment still occupies the Event Booth;
4. a different `PENDING` request for that same Booth has an approved application and active Partner
   organization, remains within that application's Booth quota, and passes the same enabled
   EventBoothConfig and active Location guards as `OrganizerBoothRequestService.select`;
5. at most one work item is inserted for the release transition even when several candidates qualify.

The implementation must extract or reuse one canonical selection-eligibility check; it must not copy a
weaker approximation into withdrawal, scheduler, or payment paths. A payment failure/timeout alone, a
blocked release, release after selection closes, pending-request withdrawal, or release with no eligible
alternative creates no re-selection row. The row references the released request as specified in section
3.4 and opens the owner-scoped candidate queue, where live state is revalidated before any selection.

### 9.5 Admin no-producer boundary — reviewed 2026-11-03

Sprint 10 creates no Admin Notification. The internal writer rejects `recipientRole=ADMIN` because no
role-compatible type/reference combination exists, and the database constraint is the final guard. Audit
logs, failed logins, account changes, verification, role changes, Badge management, system settings,
health checks, payment reconciliation, and General Feedback are not silently promoted into producers.

The Admin endpoints are nevertheless real database operations rather than hard-coded placeholders:

- list queries `recipient_user_id = authenticatedUserId AND recipient_role = 'ADMIN'` and returns an empty
  page with truthful paging metadata under the Sprint 10 schema;
- unread-count executes the matching unread query and returns zero;
- mark-all executes the shared conditional update and returns `updatedCount: 0`;
- mark-one applies the same positive-id validation and owner/role lookup, and therefore returns the shared
  ownership-safe `404 NOTIFICATION_NOT_FOUND` for every id while no Admin row can exist.

This keeps authorization, CSRF, paging, validation, error handling, and future migration seams testable
without inventing product events. It also proves an Admin on a multi-role User cannot list or mutate rows
from another audience.

### 9.6 Actionable Notification amendment — approved 2026-11-06

`BR-110` and `docs/sprints/sprint-10.md` section 12 add four producers through migration `V17`. No endpoint,
request field, response field, or delivery channel changes.

Stable identities:

- `PARTNER_EVENT_PUBLISHED`: Event id, because publication occurs once
- `PARTNER_BOOTH_HOLD_EXPIRING`: Hold id plus `expiresAt`
- `ORGANIZER_BOOTH_PAYMENT_CONFIRMED`: Booth-request id plus `completedAt`
- `ACTIVITY_STARTING_SOON`: Activity id plus the epoch second of `startAt`

Publication and settlement rows join the owning transaction. Reminder rows are written by server schedulers,
which leave the source lifecycle unchanged and rely on the same insert-if-absent writer.

Navigation additions:

| Type | Allowed destination |
| --- | --- |
| `PARTNER_EVENT_PUBLISHED` | Partner Event discovery focused on the Event reference |
| `PARTNER_BOOTH_HOLD_EXPIRING` | Owned Booth-request area for the context Event |
| `ORGANIZER_BOOTH_PAYMENT_CONFIRMED` | Booth-request queue for `contextEventId` |
| `ACTIVITY_STARTING_SOON` | Participant Activity detail |

### 9.7 Live inbox update signal — approved 2026-11-06

`BR-111` adds exactly three Server-Sent Events operations:

```text
GET /participant/notifications/stream
GET /partner/notifications/stream
GET /organizer/notifications/stream
```

- Each uses the same Session and exact role authority as its inbox. An anonymous request returns `401`; a
  missing role or disabled account returns `403`. Admin has no stream because it has no producer.
- The response is `text/event-stream` with `Cache-Control: no-store`.
- After a transaction commits a new row, the recipient's connections for that exact role receive
  `event: notifications-changed` with `data: {}`. A rollback or a deduplicated retry sends nothing.
- The signal contains no Notification data. The client refreshes through sections 5 and 6 only.
- A connection lasts up to one hour with a 25-second heartbeat, and each User and role keeps at most five
  connections. Connections are per application instance; a multi-instance deployment needs shared delivery.
- The frontend closes the connection while a tab is hidden and reloads once on every reconnect. If the stream
  is unavailable, the existing refresh triggers in section 11 continue to work.

## 10. Error envelope

The existing `ApiErrorResponse` is reused:

```json
{
  "code": "NOTIFICATION_NOT_FOUND",
  "message": "Không tìm thấy thông báo.",
  "fieldErrors": [],
  "timestamp": "2026-11-02T08:30:00Z",
  "path": "/api/v1/partner/notifications/901/read"
}
```

Clients branch on status and stable code, never localized message text. No error exposes whether a row
belongs to another User or role.

## 11. Frontend integration contract

Each role layout must:

- fetch preview and unread count on entry
- refresh when the full inbox or popover opens
- reconcile preview/count after confirmed mark-one or mark-all
- avoid continuous polling and fake WebSocket behavior
- render API failure separately from empty state

Each full inbox must:

- use server paging and filters
- preserve Participant behavior
- remove Partner and Organizer empty-array/no-op adapters
- replace Admin failure-swallowing with typed real operations
- navigate through a role-specific allowlist keyed by `type` and `referenceType`
- show a safe unavailable-target message if the referenced route cannot be opened

The API never returns an arbitrary `targetUrl` for direct navigation.

Participant navigation preserves the existing closed mapping:

| Reference | Allowed Participant destination |
| --- | --- |
| `EVENT` | Participant Event detail |
| `ACTIVITY` | Participant Activity detail |
| `CERTIFICATE` | Participant Certificate area |
| `BADGE` | Participant Rewards area |

The adapter validates both Participant type and reference rather than treating every unknown reference as
a Certificate. Raw QR tokens, message text, and caller-supplied URLs never participate in routing.

Partner navigation is likewise a closed type/reference mapping and may use server-derived
`contextEventId` to select the owned Event workspace:

| Notification family | Allowed Partner destination |
| --- | --- |
| Application outcome | Owned Event-application detail/list, focused by application reference where supported |
| Booth-request outcome | Owned Booth-request area; live state decides whether payment or assignment actions remain available |
| Proposal outcome | Owned Activity workspace proposal queue for the context Event |
| Activity change-request outcome | Owned Activity workspace change-request queue for the context Event |
| Activity cancellation-request outcome | Owned Activity workspace cancellation-request queue for the context Event |
| Event cancellation | Owned Event-application area for the context Event |
| Activity cancellation | Owned Activity detail for the Activity reference |

The Partner client must activate the currently redirected `/partner/notifications` route. It must not
derive a payment action from historical message text: every destination loads current owned state and
shows an unavailable/current-state result when the referenced action is no longer valid.

Organizer navigation is an exact allowlist and uses the server-derived `contextEventId`:

| Notification type | Allowed Organizer destination |
| --- | --- |
| `ORGANIZER_NEW_PARTNER_APPLICATION` | Event detail, Partner/application section for `contextEventId` |
| `ORGANIZER_NEW_BOOTH_REQUEST` | Booth-request queue for `contextEventId` |
| `ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED` | Activity workspace proposal queue for `contextEventId` |
| `ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST` | Activity workspace change-request queue for `contextEventId` |
| `ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST` | Activity workspace cancellation-request queue for `contextEventId` |
| `ORGANIZER_BOOTH_RESELECTION_REQUIRED` | Booth-request queue for `contextEventId`, optionally narrowed to the released request's Booth |

The client validates the type/reference pair before using this mapping. It must not scan every Organizer
Event to infer context, treat message text as a route, or follow a caller-supplied URL. The destination
rechecks current owner access and live resource state; a withdrawn, handled, or otherwise unavailable
target remains readable and produces a safe unavailable/current-state presentation rather than an unsafe
redirect.

The Organizer client must add `notifications` to the supported route set so the already-declared
`/organizer/notifications` path does not redirect to the overview.

The Admin adapter consumes `NotificationPageResponse`, unread-count, mark-one, and mark-all using the same
GET/POST methods as section 1. It must not expect a raw array, send the current placeholder `PATCH`
commands, derive the unread badge from an incomplete local page, or map nonexistent `kind`/`link` fields
into categories and routes. The normal full view has no Security/Account/Role/System tabs or promised
alerts: it shows one genuine producer-free empty state. Loading, expired Session/forbidden, and request
failure remain distinct, retryable states. Opening Badge management or another Admin route must not clear
or replace confirmed inbox state; refresh occurs only at the accepted entry, popover/full-inbox open, and
successful read-mutation boundaries.

## 12. Acceptance Criteria traceability — reviewed 2026-11-03

The accepted Sprint 10 baseline contains 58 criteria. `AC-E-S10-14`, `AC-E-S10-15`, `AC-O-S10-11`, and
`AC-P-S10-08` map to section 9.6; `AC-N-S10-12` and `AC-N-S10-13` map to section 9.7. The original 52 are
traced by responsibility group:

| Acceptance Criteria | Contract sections |
| --- | --- |
| `AC-N-S10-01` through `AC-N-S10-11` | Sections 1, 2, 3.1, 3.6, 4 through 10, and backend/migration verification in section 14 |
| `AC-P-S10-01` through `AC-P-S10-07` | Sections 3.2, 4 through 8, 9.1, Participant navigation in section 11, and section 14 |
| `AC-E-S10-01` through `AC-E-S10-13` | Sections 3.3, 9.2, 9.3, Partner navigation in section 11, and section 14 |
| `AC-O-S10-01` through `AC-O-S10-10` | Sections 3.4, 9.2, 9.4, Organizer navigation in section 11, and section 14 |
| `AC-A-S10-01` through `AC-A-S10-05` | Sections 2, 3.5, 5 through 8, 9.5, Admin integration in section 11, and section 14 |
| `AC-S10-REG-01` through `AC-S10-REG-06` | Sections 1, 2, 9, 11, 13, and 14 |

No criterion maps to a combined inbox, generic create operation, Admin producer, unapproved delivery
channel, or client-selected recipient/role.

## 13. Compatibility and exclusions

Sprint 10 preserves:

- existing Participant route names, DTO field names, type values, and behavior
- Session, verified-role authority, cookie, CORS, and CSRF contracts
- existing domain statuses and ownership rules
- optional after-commit email behavior
- the shared General Feedback queue

Apart from the section 9.7 signal, Sprint 10 adds no email API, SMS, push, WebSocket, SSE, polling, preferences, templates, composer,
NotificationType entity/table, sender, delivery attempt, outbox, Redis Notification state, mock fallback,
or localStorage inbox.

## 14. Required verification

Backend and migration evidence must cover:

- clean and V15 upgrade migration paths with Participant read-state preservation
- Hibernate validation and exact constraints/indexes
- all 16 routes and exact role authority
- multi-role isolation across list, count, mark-one, and mark-all
- invalid query and ownership-safe not-found behavior
- concurrent mark-one/mark-all first-read stability
- every approved producer transition, retry, rollback, recipient, reference, and suppression rule
- Admin real DB-backed empty page/count, zero-row mark-all, mark-one not-found, nonblank type rejection,
  exact-role isolation, and absence of every Admin producer/writer-compatible type
- existing Participant notification regression

Frontend and browser evidence must cover:

- all four role previews and full inboxes
- genuine empty versus API failure
- unread count, mark-one, mark-all, filter, paging, and safe navigation
- bounded refresh triggers without polling
- multi-role workspace separation
- Partner/Organizer real API replacement and Admin missing-endpoint removal
- Admin API failure versus genuine empty, removal of fabricated categories/copy, and preservation of inbox
  state when opening Badge management or another Admin route
- Participant compatibility on desktop and mobile affected views

Normal backend and frontend CI are required. Focused Playwright is required; the full historical browser
suite is not a default local requirement.
