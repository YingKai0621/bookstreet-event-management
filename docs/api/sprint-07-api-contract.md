# Sprint 07 API Contract

> Status: `APPROVED - ACTIVE 2026-10-28`.
>
> This contract freezes the approved HTTP, DTO, error, persistence and transaction boundaries for
> active Sprint 7. Semantic changes require documentation review before implementation changes.
>
> Sources of truth: `05_Business_Rules.md`, `06_Use_Case_List.md`,
> `sprint-07-use-case-specifications.md`, `12_Physical_ERD_Report.md`, then this contract. Existing
> Sprint 1-6 APIs remain backward compatible unless this document explicitly extends the Sprint 6
> Notification representation.

## 1. Scope and conventions

- Base path: `/api/v1`.
- Authentication uses the existing Spring Security server-side Session stored in Redis.
- Browser mutations require credentials and a valid CSRF token.
- JSON uses camelCase; timestamps are ISO-8601 UTC instants.
- Backend `Clock` decides Event lifecycle and Booth-visit boundaries.
- UI displays time in `Asia/Ho_Chi_Minh`; API input/output remains UTC.
- Unknown JSON properties are rejected.
- IDs are positive 64-bit integers unless another type is stated.
- List endpoints use separate `page`, `size` and `sort` query parameters.
- `page >= 0`; `1 <= size <= 100`; invalid filter, page, size or sort returns `400`.
- Every order is deterministic. The endpoint sections define whether the stable ID tiebreaker is
  ascending or descending.
- Aggregate counts and `totalPoints` are non-negative 64-bit integers. A single transaction's
  `points`, Badge `requiredPoints` and `progressPercent` are 32-bit integers within their documented
  bounds.
- Participant identity always comes from the authenticated principal. No Sprint 7 endpoint accepts
  a client-supplied `userId` as identity.
- Organizer Event lookup is ownership-safe: a missing Event and an Event owned by another
  Organizer both return `404 EVENT_NOT_FOUND`.
- Raw Booth QR tokens are bearer-like secrets. They must not appear in response DTOs other than the
  pre-existing authorized Partner Assignment response, Notification content, analytics or
  application/access logs.
- Unknown or malformed nonblank Booth QR tokens share one safe not-found response and disclose no
  Event, Partner, Booth or Assignment context.
- A successful mutation returns committed durable state. The Badge backfill processor starts only
  after its triggering Badge mutation commits.
- Unknown enum values are request errors; response enums are closed by this contract.

### 1.1 Common paged response

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

An empty valid query returns `200` with empty `content` and correct metadata. The backend never
fabricates placeholder rows. `totalElements` and `totalPages` use the same authorization and filter
scope as `content`.

### 1.2 Common error shape

```json
{
  "timestamp": "2026-10-28T08:20:00Z",
  "status": 409,
  "code": "BOOTH_VISIT_WINDOW_NOT_OPEN",
  "message": "Sự kiện chưa mở thời gian ghi nhận lượt ghé gian hàng.",
  "fieldErrors": [],
  "path": "/api/v1/participant/booth-visits/scan"
}
```

Validation failures use the existing field-error shape:

```json
{
  "timestamp": "2026-10-28T08:20:00Z",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ.",
  "fieldErrors": [
    {
      "field": "requiredPoints",
      "code": "RANGE",
      "message": "Ngưỡng điểm phải là số nguyên dương."
    }
  ],
  "path": "/api/v1/admin/badges"
}
```

Messages are localized presentation text and are not client control flow. Clients branch on HTTP
status plus stable `code`.

### 1.3 HTTP classification

- `400 Bad Request`: malformed JSON, unknown property, invalid enum/filter/page/size/sort or a
  syntactically invalid path variable.
- `401 Unauthorized`: Session absent or expired. An unauthenticated QR landing may retain the
  opaque token only in client-only state long enough to resume after login.
- `403 Forbidden`: required role/capability is missing or CSRF validation fails.
- `404 Not Found`: invalid/malformed nonblank Booth QR token, absent Participant-owned resource,
  absent Badge, or absent/not-owned Organizer Event.
- `409 Conflict`: Event/Assignment lifecycle, relationship, Badge current-state or concurrency
  conflict.
- `422 Unprocessable Entity`: request-field validation after JSON binding.

### 1.4 Idempotency rules

- Booth scan is naturally idempotent against durable uniqueness. A duplicate request evaluated
  while the QR is still valid returns the achieved BoothVisit and PointTransaction without new
  Points, UserBadges or Notifications.
- A request evaluated after the valid Event/Assignment window is not a valid-window retry. It
  returns the current lifecycle error and does not use the old QR as a history endpoint.
- Badge synchronization is naturally idempotent against `(userId, badgeId)` and Notification
  recipient/deduplication uniqueness. Retry creates only missing awards.
- Badge create and update do not accept an `Idempotency-Key`; normalized name uniqueness and the
  current Badge identity are the conflict boundaries.
- Database uniqueness violations must map to the documented achieved result or conflict, never an
  unhandled `500` or SQL detail.

## 2. Enumerations and derived values

### 2.1 Request and response enums

```text
EventRegistrationAction = CREATED | REACTIVATED | REUSED
ParticipantBadgeFilter  = ALL | EARNED | IN_PROGRESS
ParticipantBadgeState   = EARNED | IN_PROGRESS
NotificationType        += BADGE_UNLOCKED
NotificationReference   += BADGE
```

Existing enums remain unchanged:

```text
EventRegistrationStatus = ACTIVE | LEFT
BoothAssignmentStatus   = ACTIVE | RELEASED | CANCELLED | ENDED
```

`BADGE_UNLOCKED` and `BADGE` extend the Sprint 6 Notification enums. They do not replace or rename
the five existing Notification types or their `EVENT`, `ACTIVITY` and `CERTIFICATE` references.

### 2.2 Booth scan lifecycle outcome

Before accepting either a first or duplicate scan, the service locks the Event, advances its timed
lifecycle using backend time, and evaluates:

```text
boothAssignment.status = ACTIVE
AND event.status = ONGOING
AND event.startAt <= backendNow < event.endAt
```

- Before `startAt`: `409 BOOTH_VISIT_WINDOW_NOT_OPEN`.
- At `startAt`: the scan may succeed after lifecycle advancement.
- Before `endAt`: the scan may succeed.
- At or after `endAt`: `409 BOOTH_VISIT_WINDOW_CLOSED`.
- Assignment not `ACTIVE`: `409 BOOTH_ASSIGNMENT_INELIGIBLE`.

The opening boundary is inclusive and the closing boundary is exclusive. There is no early scan
window.

### 2.3 Registration action

For an otherwise valid scan:

```text
no EventRegistration       -> CREATED
EventRegistration = LEFT   -> REACTIVATED
EventRegistration = ACTIVE -> REUSED
```

The action describes the transition made by the current scan request. Auto-create/reactivation is
allowed after the ordinary Event registration deadline because this command is valid only on-site
during an ongoing Event. Direct Event Join and Activity registration retain their Sprint 6
deadline rules.

### 2.4 Reward calculations

- A first accepted BoothVisit stores exactly the positive configured value from
  `rewards.booth-visit-points=10` in one PointTransaction.
- The application must fail startup if this property is absent, non-numeric, zero or negative.
- Historical PointTransaction amounts never change after a property change.
- `totalPoints` is `SUM(point_transactions.points)` across all owned EventRegistrations and Events;
  an empty ledger produces zero.
- A first scan awards every active Badge whose `requiredPoints <= totalPoints` and for which the
  User has no UserBadge.
- Deactivation or a threshold increase never revokes a UserBadge.

Badge progress is derived as follows:

```text
remainingPoints = max(requiredPoints - totalPoints, 0)
progressPercent = min(floor(totalPoints * 100 / requiredPoints), 100)
```

The multiplication must use a sufficiently wide numeric type to avoid integer overflow. An earned
Badge always returns `remainingPoints=0` and `progressPercent=100`, including an inactive earned
Badge.

### 2.5 Badge input normalization

- `name`: trim surrounding whitespace, collapse consecutive whitespace to one ASCII space, length
  `1..100`, and compare uniqueness case-insensitively after normalization.
- `description`: null/blank-to-null; otherwise trim surrounding whitespace and require length
  `1..1000`.
- `iconUrl`: null/blank-to-null; otherwise trim, require an absolute `http` or `https` URL and
  length `1..2048`.
- `requiredPoints`: integer `1..2147483647`.
- `isActive`: required Boolean.

The server returns normalized values. Fields `code`, `nameEn`, `perks` and `iconType` are not
accepted Badge fields.

## 3. Shared representations

### 3.1 EventBriefResponse

```json
{
  "eventId": 7,
  "name": "Ngày hội sách cuối tuần"
}
```

### 3.2 BoothBriefResponse

```json
{
  "boothId": 22,
  "code": "A01",
  "name": "Gian hàng Nhà sách Trẻ"
}
```

`code` and `name` are the current safe Booth catalog values. They are not QR material.

### 3.3 ParticipantBadgeResponse

```json
{
  "badgeId": 41,
  "name": "Nhà thám hiểm gian hàng",
  "description": "Ghé thăm ba gian hàng.",
  "iconUrl": "https://cdn.example.test/badges/explorer.png",
  "requiredPoints": 30,
  "isActive": true,
  "state": "EARNED",
  "earned": true,
  "earnedAt": "2026-10-28T08:20:00Z",
  "remainingPoints": 0,
  "progressPercent": 100
}
```

Rules:

- `state` is `EARNED` when a UserBadge exists and `IN_PROGRESS` otherwise.
- For `EARNED`, `earned=true` and `earnedAt` is non-null.
- For `IN_PROGRESS`, `earned=false`, `earnedAt=null`, and the Badge must currently be active.
- Earned inactive Badges remain visible with `isActive=false`.
- Inactive unearned Badges never appear in Participant responses.

### 3.4 BoothVisitResponse

```json
{
  "boothVisitId": 701,
  "eventRegistrationId": 301,
  "boothAssignmentId": 601,
  "event": {
    "eventId": 7,
    "name": "Ngày hội sách cuối tuần"
  },
  "booth": {
    "boothId": 22,
    "code": "A01",
    "name": "Gian hàng Nhà sách Trẻ"
  },
  "visitedAt": "2026-10-28T08:20:00Z"
}
```

### 3.5 BoothScanResponse

First rewarded visit example:

```json
{
  "boothVisit": {
    "boothVisitId": 701,
    "eventRegistrationId": 301,
    "boothAssignmentId": 601,
    "event": {
      "eventId": 7,
      "name": "Ngày hội sách cuối tuần"
    },
    "booth": {
      "boothId": 22,
      "code": "A01",
      "name": "Gian hàng Nhà sách Trẻ"
    },
    "visitedAt": "2026-10-28T08:20:00Z"
  },
  "eventRegistrationAction": "CREATED",
  "visitPoints": 10,
  "newlyAwardedPoints": 10,
  "totalPoints": 30,
  "alreadyVisited": false,
  "newlyUnlockedBadges": []
}
```

Duplicate valid-window scan example:

```json
{
  "boothVisit": {
    "boothVisitId": 701,
    "eventRegistrationId": 301,
    "boothAssignmentId": 601,
    "event": {
      "eventId": 7,
      "name": "Ngày hội sách cuối tuần"
    },
    "booth": {
      "boothId": 22,
      "code": "A01",
      "name": "Gian hàng Nhà sách Trẻ"
    },
    "visitedAt": "2026-10-28T08:20:00Z"
  },
  "eventRegistrationAction": "REUSED",
  "visitPoints": 10,
  "newlyAwardedPoints": 0,
  "totalPoints": 40,
  "alreadyVisited": true,
  "newlyUnlockedBadges": []
}
```

`visitPoints` is the immutable amount stored for this visit. `newlyAwardedPoints` is the amount
created by this request, so it is zero on a duplicate. `totalPoints` is the current ledger total
and may be greater than it was when the returned visit was first created. Newly unlocked Badges
use `ParticipantBadgeResponse`; every returned item is `EARNED` with the current request's
`earnedAt`. `newlyUnlockedBadges` is ordered by ascending `badgeId`, matching the transaction's
Badge lock order.

### 3.6 RewardSummaryResponse

```json
{
  "totalPoints": 40,
  "totalVisits": 4,
  "earnedBadgeCount": 2,
  "activeBadgeCount": 5,
  "nextBadge": {
    "badgeId": 44,
    "name": "Bạn của Đường Sách",
    "description": null,
    "iconUrl": null,
    "requiredPoints": 50,
    "isActive": true,
    "state": "IN_PROGRESS",
    "earned": false,
    "earnedAt": null,
    "remainingPoints": 10,
    "progressPercent": 80
  }
}
```

`activeBadgeCount` counts all active definitions, whether earned or unearned.
`earnedBadgeCount` counts all owned UserBadges, including inactive Badge definitions. `nextBadge`
is the active unearned Badge with the lowest `requiredPoints`, then lowest `badgeId`; it is `null`
when none remains.

### 3.7 PointTransactionResponse

```json
{
  "pointTransactionId": 901,
  "boothVisitId": 701,
  "boothAssignmentId": 601,
  "points": 10,
  "createdAt": "2026-10-28T08:20:00Z",
  "visitedAt": "2026-10-28T08:20:00Z",
  "event": {
    "eventId": 7,
    "name": "Ngày hội sách cuối tuần"
  },
  "booth": {
    "boothId": 22,
    "code": "A01",
    "name": "Gian hàng Nhà sách Trẻ"
  }
}
```

### 3.8 OrganizerBoothVisitSummaryResponse

```json
{
  "eventId": 7,
  "totalVisits": 126,
  "uniqueParticipants": 84,
  "visitedBoothAssignments": 12
}
```

- `totalVisits` counts unique durable BoothVisit rows in the owned Event.
- `uniqueParticipants` counts distinct EventRegistration Users represented by those visits.
- `visitedBoothAssignments` counts distinct BoothAssignments represented by those visits.

### 3.9 OrganizerBoothVisitGroupResponse

```json
{
  "boothAssignmentId": 601,
  "booth": {
    "boothId": 22,
    "code": "A01",
    "name": "Gian hàng Nhà sách Trẻ"
  },
  "assignmentStatus": "ACTIVE",
  "visitCount": 18,
  "lastVisitedAt": "2026-10-28T08:20:00Z"
}
```

The current `assignmentStatus` is presentation context only. It does not retroactively invalidate
historical BoothVisits.

### 3.10 OrganizerBoothVisitResponse

```json
{
  "boothVisitId": 701,
  "eventRegistrationId": 301,
  "visitedAt": "2026-10-28T08:20:00Z",
  "participant": {
    "userId": 88,
    "displayName": "Nguyễn Minh Anh"
  },
  "boothAssignmentId": 601,
  "booth": {
    "boothId": 22,
    "code": "A01",
    "name": "Gian hàng Nhà sách Trẻ"
  },
  "assignmentStatus": "ACTIVE"
}
```

Organizer monitoring returns the Participant display identity needed for Event operations. It does
not return email, QR token, Point balance, Badge collection or Notification content.

### 3.11 AdminBadgeResponse

```json
{
  "badgeId": 41,
  "name": "Nhà thám hiểm gian hàng",
  "description": "Ghé thăm ba gian hàng.",
  "requiredPoints": 30,
  "iconUrl": "https://cdn.example.test/badges/explorer.png",
  "isActive": true,
  "awardedUserCount": 84,
  "remainingEligibleCount": 3,
  "createdAt": "2026-10-28T08:00:00Z",
  "updatedAt": "2026-10-28T08:10:00Z"
}
```

`awardedUserCount` counts UserBadge rows for the Badge. `remainingEligibleCount` counts Users whose
ledger total currently meets the active Badge threshold but who have no UserBadge. For an inactive
Badge, `remainingEligibleCount` is zero because inactive definitions are not currently awardable.

### 3.12 ParticipantNotificationResponse extension

Sprint 7 keeps the Sprint 6 response shape. A Badge unlock example is:

```json
{
  "notificationId": 1201,
  "type": "BADGE_UNLOCKED",
  "title": "Bạn vừa mở khóa huy hiệu",
  "message": "Bạn đã mở khóa huy hiệu Nhà thám hiểm gian hàng.",
  "referenceType": "BADGE",
  "referenceId": 41,
  "createdAt": "2026-10-28T08:20:00Z",
  "readAt": null,
  "read": false
}
```

`referenceId` is the Badge identity. Title and message are server-owned snapshots. Deduplication
uses the UserBadge identity, not title/message text, and is not exposed in the response.

## 4. Participant Booth scan API

All endpoints in this section require authenticated `PARTICIPANT` capability. The request never
accepts `userId`, `eventId`, `boothId`, `boothAssignmentId`, `points` or `badgeId` as truth.

### 4.1 QR application route

The displayed QR encodes a frontend application route such as:

```text
https://<frontend-host>/participant/booth-scan#token=<opaque-token>
```

The fragment is client-only and is not sent to the frontend server, backend path or backend query
string. The frontend may retain the pending token in memory or equivalent short-lived client-only
state while authentication completes. After capturing the fragment, the frontend immediately
removes it from the visible URL with history replacement; it must also remove the token from
retained state after the scan result is reached or the flow is abandoned.

Opening this route while unauthenticated creates no EventRegistration, BoothVisit,
PointTransaction, UserBadge or Notification. After login, the frontend submits the token in the
HTTPS JSON body below. The `token` field must be omitted or fully redacted by request-body and
exception logging.

### 4.2 POST `/participant/booth-visits/scan`

Request:

```json
{
  "token": "0ad9ec56-5566-4b4d-91c0-4ea995896d2b"
}
```

Validation and resolution:

- An absent or unreadable JSON request body returns `400 MALFORMED_REQUEST`.
- `token` is required and nonblank; missing/null/blank returns `422 VALIDATION_FAILED` with field
  code `REQUIRED`.
- The controller binds it as an opaque String rather than exposing UUID parsing behavior.
- A nonblank token is resolved as opaque input and is never whitespace-normalized into a different
  token.
- A nonblank malformed or unknown value returns the same `404 BOOTH_QR_NOT_FOUND` response.
- Maximum accepted transport length is 200 characters; a longer nonblank token also returns the
  same safe `404 BOOTH_QR_NOT_FOUND` response.
- Token resolution happens before any response context is assembled, but lifecycle and
  relationship checks happen under the transaction locks in section 12.

Responses:

- `200 BoothScanResponse` for a first accepted visit.
- `200 BoothScanResponse` for a duplicate valid-window visit with `alreadyVisited=true`,
  `newlyAwardedPoints=0` and no new unlocks.
- The response's `eventRegistrationAction` may be `CREATED`, `REACTIVATED` or `REUSED`.
- A first visit and every side effect commit atomically. There is no `202` partial reward result.

Errors:

- `401 AUTHENTICATION_REQUIRED`.
- `403 ACCESS_DENIED` or `403 CSRF_INVALID`.
- `404 BOOTH_QR_NOT_FOUND`.
- `409 BOOTH_VISIT_WINDOW_NOT_OPEN`.
- `409 BOOTH_VISIT_WINDOW_CLOSED`.
- `409 BOOTH_ASSIGNMENT_INELIGIBLE`.
- `409 BOOTH_VISIT_RELATIONSHIP_INVALID`.

No error message includes the raw token or resolved private Assignment context.

## 5. Participant Rewards APIs

All endpoints require authenticated `PARTICIPANT` capability and scope data to the authenticated
User.

### 5.1 GET `/participant/rewards/summary`

Response: `200 RewardSummaryResponse`.

An account with no reward history receives:

```json
{
  "totalPoints": 0,
  "totalVisits": 0,
  "earnedBadgeCount": 0,
  "activeBadgeCount": 0,
  "nextBadge": null
}
```

`activeBadgeCount` may be nonzero when active definitions exist even if the User has no points.

### 5.2 GET `/participant/rewards/point-transactions`

Query:

- `page`, `size`; default `page=0`, `size=20`.
- Default sort: `createdAt,desc`, then `pointTransactionId,desc`.
- Allowed sort fields: `createdAt`, `visitedAt`, `points`.
- Optional `eventId` and `boothId`, each a positive 64-bit integer.

Every explicit sort appends `pointTransactionId,desc` as its stable tiebreaker.

Response: `200` paged `PointTransactionResponse` owned by the current User.

An unknown filter identity produces a successful empty page rather than revealing whether that
Event or Booth exists outside the User's ledger.

### 5.3 GET `/participant/rewards/badges`

Query:

- `page`, `size`; default `page=0`, `size=20`.
- Optional `state=ALL|EARNED|IN_PROGRESS`; default `ALL`.
- Optional `sort` with allowed fields `earnedAt`, `requiredPoints`, `name`.

Default order:

1. earned items before in-progress items;
2. earned items by `earnedAt,desc`, then `badgeId,desc`;
3. in-progress items by `requiredPoints,asc`, then `badgeId,asc`.

For explicit sorting, null `earnedAt` values sort last and the endpoint appends `badgeId,asc` unless
the default earned ordering applies.

Response: `200` paged `ParticipantBadgeResponse`.

- `EARNED` returns all owned UserBadges, including inactive definitions.
- `IN_PROGRESS` returns only active unearned Badge definitions.
- `ALL` is the union of those two sets.

## 6. Participant Notification extension

No new Notification endpoint is introduced. Sprint 7 extends these existing Sprint 6 APIs:

- `GET /participant/notifications` accepts `type=BADGE_UNLOCKED` and returns the representation in
  section 3.12.
- `GET /participant/notifications/unread-count` includes unread Badge unlock Notifications.
- `POST /participant/notifications/{notificationId}/read` marks an owned Badge unlock as read.
- `POST /participant/notifications/read-all` includes owned unread Badge unlocks in the update.

Creation rules:

- Every newly inserted UserBadge creates one `BADGE_UNLOCKED` Notification in the same transaction.
- Deduplication key format is `badge-unlocked:user-badge:{userBadgeId}`.
- The key remains within the existing 200-character limit.
- The Notification is initially unread.
- Only the transaction that inserts UserBadge inserts the Notification.
- UserBadge or Notification persistence failure rolls back both, including the scan transaction
  when the award came from a scan.
- Badge deactivation or threshold increase does not remove or rewrite the Notification.

## 7. Organizer BoothVisit monitoring APIs

All endpoints require authenticated `ORGANIZER` authority and ownership of `{eventId}`. Missing and
foreign Events both return `404 EVENT_NOT_FOUND`. These endpoints are UC-O07 operational
monitoring, not the broad UC-O08 reporting module.

### 7.1 GET `/organizer/events/{eventId}/booth-visits/summary`

Response: `200 OrganizerBoothVisitSummaryResponse`.

An owned Event with no visits returns all three counts as zero.

### 7.2 GET `/organizer/events/{eventId}/booth-visit-groups`

Query:

- `page`, `size`; default `page=0`, `size=20`.
- Default sort: `visitCount,desc`, then `boothAssignmentId,asc`.
- Allowed sort fields: `visitCount`, `lastVisitedAt`, `boothCode`.
- Optional `boothId` positive 64-bit filter.
- Optional normalized `search` length `1..100`, matched case-insensitively against Booth code and
  name.

Every explicit sort appends `boothAssignmentId,asc` as its stable tiebreaker.

Response: `200` paged `OrganizerBoothVisitGroupResponse`.

Only Assignments represented by at least one BoothVisit appear. A non-ACTIVE current Assignment
still appears when it has historical visits.

### 7.3 GET `/organizer/events/{eventId}/booth-visits`

Query:

- `page`, `size`; default `page=0`, `size=20`.
- Default sort: `visitedAt,desc`, then `boothVisitId,desc`.
- Allowed sort fields: `visitedAt`, `participantDisplayName`, `boothCode`.
- Optional `boothId` positive 64-bit filter.
- Optional normalized `search` length `1..100`, matched case-insensitively against Participant
  display name and Booth code/name.

Every explicit sort appends `boothVisitId,desc` as its stable tiebreaker.

Response: `200` paged `OrganizerBoothVisitResponse`.

Grouping/list filters never broaden beyond the owned Event. An unknown `boothId` or unmatched
search returns an empty page. No monitoring response exposes raw QR tokens, Point ledger values,
UserBadges or Notification content.

## 8. Admin Badge APIs

All endpoints require authenticated `ADMIN` authority. Browser mutations require CSRF. Sprint 7
replaces the frontend's phantom `/admin/badge-rules` and `/admin/settings` dependencies with the
real Badge catalog below.

### 8.1 GET `/admin/badges`

Query:

- `page`, `size`; default `page=0`, `size=20`.
- Default sort: `createdAt,desc`, then `badgeId,desc`.
- Allowed sort fields: `name`, `requiredPoints`, `isActive`, `createdAt`, `updatedAt`.
- Optional `active=true|false`.
- Optional normalized `search` length `1..100`, matched case-insensitively against Badge name.

Every explicit sort appends `badgeId,asc` as its stable tiebreaker; only the default newest-first
order uses `badgeId,desc`.

Response: `200` paged `AdminBadgeResponse`.

### 8.2 GET `/admin/badges/{badgeId}`

Response: `200 AdminBadgeResponse`.

Missing Badge returns `404 BADGE_NOT_FOUND`.

### 8.3 POST `/admin/badges`

Request:

```json
{
  "name": "Nhà thám hiểm gian hàng",
  "description": "Ghé thăm ba gian hàng.",
  "requiredPoints": 30,
  "iconUrl": "https://cdn.example.test/badges/explorer.png",
  "isActive": true
}
```

Response: `201`:

```json
{
  "badge": {
    "badgeId": 41,
    "name": "Nhà thám hiểm gian hàng",
    "description": "Ghé thăm ba gian hàng.",
    "requiredPoints": 30,
    "iconUrl": "https://cdn.example.test/badges/explorer.png",
    "isActive": true,
    "awardedUserCount": 0,
    "remainingEligibleCount": 3,
    "createdAt": "2026-10-28T08:00:00Z",
    "updatedAt": "2026-10-28T08:00:00Z"
  },
  "synchronizationTriggered": true
}
```

- `synchronizationTriggered=true` only when the newly created Badge is active.
- The response means the Badge committed and after-commit synchronization was scheduled; it does
  not mean all eligible Users have already been processed.
- An inactive Badge returns `synchronizationTriggered=false` and
  `remainingEligibleCount=0`.
- Duplicate normalized name returns `409 BADGE_NAME_CONFLICT`.

### 8.4 PUT `/admin/badges/{badgeId}`

The request is a full replacement of mutable Badge fields and has the same shape/validation as
create. Omitted required fields are validation errors; explicit null is allowed only for
`description` and `iconUrl`.

Response: `200` with the same envelope as create.

Synchronization trigger rules use the locked before/after Badge state:

- inactive to active: trigger;
- active to active with lower `requiredPoints`: trigger;
- name, description or icon-only change: do not trigger;
- threshold increase: do not trigger;
- final inactive state: do not trigger;
- lowering threshold while remaining inactive: do not trigger.

Existing UserBadges and their `earnedAt` values are never changed or deleted.

Errors:

- `404 BADGE_NOT_FOUND`.
- `409 BADGE_NAME_CONFLICT`.
- `422 VALIDATION_FAILED`.

### 8.5 POST `/admin/badges/{badgeId}/synchronize-awards`

Request body: none.

The command processes at most one batch of 100 eligible Users synchronously in stable ascending
User identity order. After that batch commits, the same after-commit processor may continue later
batches until no eligible User remains or a batch fails.

Response: `200 BadgeSynchronizationResponse`:

```json
{
  "badgeId": 41,
  "processedCount": 100,
  "awardedCount": 97,
  "remainingEligibleCount": 23,
  "completed": false
}
```

- `processedCount` is the number of candidate Users examined by this command's batch.
- `awardedCount` is the number of new UserBadges committed by this batch.
- `remainingEligibleCount` is recalculated after the batch commits.
- `completed` is true exactly when `remainingEligibleCount=0`.
- A converged retry returns `200` with all counts zero except `badgeId`, and `completed=true`.
- Concurrent scans/backfills may make `awardedCount < processedCount`; uniqueness and recheck make
  that a successful convergence, not an error.
- Inactive Badge returns `409 BADGE_NOT_ACTIVE` and does not process a batch.
- Missing Badge returns `404 BADGE_NOT_FOUND`.

There is no Badge hard-delete endpoint, manual Point adjustment endpoint, manual UserBadge
grant/revoke endpoint or generic System Settings endpoint.

## 9. Backfill processing contract

The automatic and explicit synchronization paths call one shared batch service.

### 9.1 Trigger and scheduling

- Active Badge creation, active threshold reduction and Badge reactivation schedule processing
  only through an after-commit hook.
- A rolled-back Badge mutation schedules nothing.
- Automatic processing repeatedly invokes separate batches until remaining eligibility is zero or
  one batch fails.
- Failure is logged without secrets and stops that automatic run. Admin detail/list exposes
  nonzero `remainingEligibleCount`; the explicit endpoint resumes safely.
- Sprint 7 does not persist a job table. Remaining work is derived from active Badge eligibility and
  missing UserBadge rows.

### 9.2 Batch transaction

- One transaction locks the current Badge, rechecks `isActive` and `requiredPoints`, and selects at
  most 100 eligible missing Users in ascending `userId`.
- Eligibility uses ledger-derived total Points; no cached User balance is trusted.
- For each still-missing award, the transaction creates UserBadge and its `BADGE_UNLOCKED`
  Notification atomically.
- A batch failure rolls back that whole batch. Previously committed batches remain valid.
- No transaction spans two batches.
- Scan/backfill races converge through UserBadge and Notification unique constraints; only the
  UserBadge-inserting transaction inserts the Notification.

## 10. Validation boundary matrix

The following boundaries are normative:

- QR transport: missing/null/blank token is validation failure; every nonblank malformed, too-long
  or unknown token is the same safe not-found outcome.
- Booth scan: `event.startAt <= backendNow < event.endAt`, after lifecycle advancement under lock.
- BoothAssignment: exactly `ACTIVE` for first or duplicate scan evaluation.
- Point award property: positive integer and approved runtime value `10`; invalid configuration
  fails startup.
- Badge name: normalized length `1..100`, case-insensitively unique.
- Badge description: null or normalized length `1..1000`.
- Badge icon URL: null or absolute `http(s)` URL length `1..2048`.
- Badge threshold: integer `1..2147483647`.
- Organizer/Participant search: null/blank-to-null or normalized length `1..100`.
- Pagination: page at least zero, size `1..100`, closed sort allowlist.
- Backfill: at most 100 candidate Users per transaction.

All time comparisons use backend time. Client time and UI Event labels cannot rescue or reject a
scan.

## 11. Canonical error codes

The same business condition maps to the same code across paths.

### 11.1 Common request/security

- `MALFORMED_REQUEST` — 400
- `UNKNOWN_FIELD` — 400
- `INVALID_PAGE` — 400
- `INVALID_SIZE` — 400
- `INVALID_SORT` — 400
- `INVALID_FILTER` — 400
- `INVALID_ENUM_VALUE` — 400
- `AUTHENTICATION_REQUIRED` — 401
- `ACCESS_DENIED` — 403
- `CSRF_INVALID` — 403
- `VALIDATION_FAILED` — 422

### 11.2 Booth scan and reward

- `BOOTH_QR_NOT_FOUND` — 404
- `BOOTH_VISIT_WINDOW_NOT_OPEN` — 409
- `BOOTH_VISIT_WINDOW_CLOSED` — 409
- `BOOTH_ASSIGNMENT_INELIGIBLE` — 409
- `BOOTH_VISIT_RELATIONSHIP_INVALID` — 409

`BOOTH_VISIT_RELATIONSHIP_INVALID` is intentionally generic. It covers an inconsistent
EventRegistration, Assignment, BoothHold/EventBoothConfig or Event relationship without revealing
which private link failed.

### 11.3 Organizer monitoring

- `EVENT_NOT_FOUND` — 404

Filtering an owned Event to no matches is a successful empty result, not an error.

### 11.4 Badge management

- `BADGE_NOT_FOUND` — 404
- `BADGE_NAME_CONFLICT` — 409
- `BADGE_NOT_ACTIVE` — 409

Badge field failures use `422 VALIDATION_FAILED` with field codes:

```text
REQUIRED
NOT_BLANK
LENGTH
RANGE
URL
```

No error response includes SQL constraint names, raw QR tokens or foreign ownership detail.

## 12. Transaction, locking and side effects

### 12.1 First Booth scan

The first valid scan is one transaction in this order:

```text
Event
  -> BoothAssignment
  -> EventRegistration
  -> BoothVisit
  -> PointTransaction
  -> Badge rows by ascending badgeId
  -> UserBadge rows by ascending badgeId
  -> Notification
```

Repository traversal may resolve BoothHold and EventBoothConfig, but state-changing Event work locks
the Event root first. The service rechecks every relationship and lifecycle fact after locks.

If any registration, visit, point, badge or Notification step fails, the first-scan transaction
rolls back completely. A committed BoothVisit without its PointTransaction is invalid.

### 12.2 Duplicate and concurrent scan

- Unique `(event_registration_id, booth_assignment_id)` is the final BoothVisit guard.
- Unique `booth_visit_id` is the final PointTransaction guard.
- Duplicate requests that remain lifecycle-valid reuse achieved identities.
- If EventRegistration is LEFT, a valid duplicate scan may reactivate it while still creating no
  second reward.
- Concurrent requests either serialize through locks or recover a uniqueness race into the same
  achieved response.

### 12.3 Badge mutation, scan and backfill

- Admin mutation locks the affected Badge.
- Scan evaluation locks eligible Badge rows in ascending `badgeId`.
- Backfill locks its Badge, then candidate Users/UserBadge identities in ascending stable order.
- Every path rechecks current `isActive` and `requiredPoints` under the Badge lock.
- If Admin mutation commits first, its new rule controls later evaluation.
- If an award commits first, that historical UserBadge remains earned.
- Scan/backfill race on `(userId,badgeId)` converges to one UserBadge and one Notification.

### 12.4 After-commit work

Only the continuation of Badge synchronization runs after commit. It cannot turn an already
committed Badge mutation response into rollback. UserBadge and Notification creation themselves are
not optional after-commit work; they commit atomically inside each scan/backfill transaction.

## 13. V12 persistence overlay

The first Sprint 7 migration is proposed as `V12`. V1 through V11 are immutable. The audit found no
physical-name or Flyway-version conflict with the current V11 baseline; the names below are
normative.

### 13.1 `booth_visits`

```text
booth_visit_id       BIGINT identity primary key
event_registration_id BIGINT not null FK event_registrations ON DELETE RESTRICT
booth_assignment_id  BIGINT not null FK booth_assignments ON DELETE RESTRICT
visited_at           TIMESTAMPTZ not null
```

Constraints and indexes:

- unique `(event_registration_id, booth_assignment_id)`;
- index `(event_registration_id, visited_at DESC, booth_visit_id DESC)`;
- index `(booth_assignment_id, visited_at DESC, booth_visit_id DESC)`.

### 13.2 `point_transactions`

```text
point_transaction_id BIGINT identity primary key
booth_visit_id       BIGINT not null FK booth_visits ON DELETE RESTRICT
points               INTEGER not null CHECK (points > 0)
created_at           TIMESTAMPTZ not null
```

Constraints and indexes:

- unique `booth_visit_id`;
- index `(created_at DESC, point_transaction_id DESC)`.

User ownership is derived through BoothVisit to EventRegistration. No `user_id` or mutable balance
is duplicated in this table.

### 13.3 `badges`

```text
badge_id        BIGINT identity primary key
name            VARCHAR(100) not null
description     TEXT null
required_points INTEGER not null CHECK (required_points > 0)
icon_url        TEXT null
is_active       BOOLEAN not null
created_at      TIMESTAMPTZ not null
updated_at      TIMESTAMPTZ not null
```

Constraints and indexes:

- `name = REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')` and
  `CHAR_LENGTH(name) BETWEEN 1 AND 100`;
- unique functional index on `LOWER(name)`;
- description, when non-null, satisfies `description = BTRIM(description)` and
  `CHAR_LENGTH(description) BETWEEN 1 AND 1000`;
- icon URL, when non-null, satisfies `icon_url = BTRIM(icon_url)` and
  `CHAR_LENGTH(icon_url) BETWEEN 1 AND 2048`; protocol validation also occurs in the service;
- `updated_at >= created_at`;
- index `(is_active, required_points, badge_id)`.

### 13.4 `user_badges`

```text
user_badge_id BIGINT identity primary key
user_id       BIGINT not null FK users ON DELETE RESTRICT
badge_id      BIGINT not null FK badges ON DELETE RESTRICT
earned_at     TIMESTAMPTZ not null
```

Constraints and indexes:

- unique `(user_id, badge_id)`;
- index `(user_id, earned_at DESC, user_badge_id DESC)`;
- index `(badge_id, user_id)` for synchronization progress.

### 13.5 `notifications` extension

V12 adds:

```text
badge_id BIGINT null FK badges ON DELETE RESTRICT
```

The existing `ck_notifications_type` is replaced atomically so it permits the original five types
plus `BADGE_UNLOCKED`. The existing reference CHECK is replaced atomically so:

- Activity types require only `activity_id`;
- `EVENT_CANCELLED` requires only `event_id`;
- Certificate types require only `certificate_id`;
- `BADGE_UNLOCKED` requires only `badge_id`;
- every other reference FK is null in each branch.

Existing rows remain valid. V12 does not weaken recipient ownership, deduplication, nonblank
title/message or read-time checks. Add index `(badge_id, notification_id)` for Badge-reference
maintenance/query support.

### 13.6 Explicit schema exclusions

V12 must not add:

- `users.total_points`;
- a Badge job table;
- generic System Settings;
- Permission/RolePermission tables;
- Event entrance QR or Participant-specific QR tables;
- manual Point adjustment or redemption tables.

V12 must not seed environment-specific accounts or credentials.

## 14. Acceptance Criteria traceability

All 41 Sprint 7 Acceptance Criteria are mapped:

- `AC-P01-S7-01`, `AC-P01-S7-02`, `AC-P01-S7-03` — sections 2.3, 3.5, 4 and 12.
- `AC-P03-S7-01`, `AC-P03-S7-02`, `AC-P03-S7-03` — sections 1, 4.1 and 4.2.
- `AC-P03-S7-04`, `AC-P03-S7-05` — sections 2.2, 4.2 and 10.
- `AC-P03-S7-06`, `AC-P03-S7-07`, `AC-P03-S7-08` — sections 2.4, 3.4, 3.5, 4.2 and
  12.1.
- `AC-P03-S7-09`, `AC-P03-S7-10`, `AC-P03-S7-11` — sections 1.4, 3.5, 4.2 and 12.2.
- `AC-P03-S7-12`, `AC-P03-S7-13`, `AC-P03-S7-14` — sections 2.4, 5 and 12.3.
- `AC-P03-S7-15`, `AC-P03-S7-16` — sections 3.12, 6 and 12.
- `AC-P03-S7-17`, `AC-P03-S7-18`, `AC-P03-S7-19` — sections 3.3, 3.6, 3.7 and 5.
- `AC-P03-S7-20` — sections 1 and 4.
- `AC-O07-S7-01`, `AC-O07-S7-02`, `AC-O07-S7-03` — sections 3.8, 3.9 and 7.
- `AC-O07-S7-04`, `AC-O07-S7-05`, `AC-O07-S7-06` — sections 1.1, 3.10 and 7.
- `AC-A03-01`, `AC-A03-02`, `AC-A03-03`, `AC-A03-04` — sections 2.5, 3.11 and 8.1-8.4.
- `AC-A03-05`, `AC-A03-06`, `AC-A03-07`, `AC-A03-08` — sections 8.3, 8.4 and 9.
- `AC-A03-09`, `AC-A03-10` — sections 2.4 and 8.4.
- `AC-A03-11` — sections 8.5, 9 and 12.3.
- `AC-A03-12` — sections 8 and 13.6.

## 15. Frontend route and integration obligations

The approved implementation must reconcile these current placeholders:

- Participant QR landing submits the fragment token only through
  `POST /participant/booth-visits/scan`.
- Participant “Điểm & Đổi thưởng” becomes a real rewards view and may be renamed “Điểm & Huy hiệu”.
- Participant reward totals, history and Badge cards come only from sections 5.1-5.3.
- Existing Participant Notification models add `BADGE_UNLOCKED` and `BADGE` navigation support.
- Organizer Event participation monitoring adds the section 7 summary/group/list slice without
  turning it into a broad report screen.
- Admin Badge Rules stops calling phantom `/admin/badge-rules` and `/admin/settings`; it uses
  `/admin/badges` and the explicit synchronization command.
- Loading, empty, first-scan success, duplicate-scan success and every documented error require
  deliberate UI states; placeholder rows are not allowed.

## 16. Compatibility and explicit exclusions

- Existing Event, Activity, Booth, Partner, Payment, Attendance, Certificate, Rating and
  Notification endpoint paths are not renamed.
- Existing authorized Partner BoothAssignment QR retrieval remains the only pre-existing raw Booth
  token response; Sprint 7 does not broaden its roles.
- There is no public Badge catalog API in Sprint 7.
- There is no Event entrance ticket/QR, Participant-specific QR, check-out, dwell duration or
  Attendance change.
- BoothVisit is not Activity Attendance and does not issue a Certificate.
- There is no Point spend, transfer, deduction, expiry, redemption catalog or manual adjustment.
- There is no Badge hard delete, manual award/revoke or historical recalculation that removes an
  earned Badge.
- There is no notification composer, preference API, broadcast, email/push requirement or outbox.
- Organizer APIs do not expose unrelated Events, reward ledgers, UserBadges or Notification bodies.
- Admin APIs do not create generic Roles/Permissions or System Settings capabilities.

## 17. Contract review gate

Reviewers confirmed these conditions before activation on 2026-10-28:

- every one of the 41 Acceptance Criteria maps to a frozen API or shared invariant;
- first and duplicate scan response semantics are unambiguous;
- QR transport and every error path avoid raw-token leakage;
- V12 constraints support all idempotency and historical-retention rules;
- Notification extension preserves all Sprint 6 rows and type/reference invariants;
- backfill trigger, one-batch response and automatic continuation semantics agree;
- Participant, Organizer and Admin list ordering is deterministic and bounded;
- endpoint ownership can be divided among three developers without parallel edits to the scan
  transaction, V12 migration or shared Badge award service.

This gate is approved. Later semantic changes require the same checks and Project Owner review
before implementation diverges from this contract.

## 18. Author self-audit result

Self-audited on 2026-10-28 against the committed Sprint 7 baseline and current V11 implementation:

- source alignment: PASS — BR-12, BR-43, BR-44 and BR-48 through BR-50 remain intact;
- approved decisions: PASS — D1 through D7 each have explicit API, transaction or persistence
  treatment;
- Acceptance Criteria: PASS — all 41 unique Sprint 7 AC IDs appear exactly once in section 14;
- HTTP completeness: PASS — 12 new endpoints and the four existing Notification operations have
  closed authentication, request, response, ordering and error behavior;
- JSON examples: PASS — all 21 fenced JSON examples parse successfully;
- QR privacy: PASS — fragment capture, immediate URL cleanup, redacted body transport, ownership
  resolution and safe invalid-token behavior are defined;
- schema feasibility: PASS — V12 is available after V11 and the proposed relationships match the
  current EventRegistration, BoothAssignment and Notification schema;
- idempotency/concurrency: PASS — first scan, duplicate scan, concurrent scan, Badge mutation and
  bounded backfill have one compatible lock/uniqueness model;
- scope control: PASS — no Event QR, Attendance change, Point redemption, manual reward editing,
  generic System Settings or broad reporting capability was introduced;
- repository hygiene: PASS — Markdown fences/headings and whitespace validation pass, and no
  existing backend endpoint collides with the proposed paths.

The author audit supported Project Owner approval; the review gate in section 17 was accepted when
Sprint 7 was activated on 2026-10-28.
