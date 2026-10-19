# Sprint 05 API Contract

> Status: `IMPLEMENTED — SPRINT 5 COMPLETED` on 2026-10-19. This contract defines the delivered
> Activity planning API.
> before V9 implementation. Existing Sprint 1–4 endpoints remain backward compatible.

## 1. General conventions

- Base path: `/api/v1`.
- Authentication: existing Spring Security server-side Session.
- Browser mutations require credentials and CSRF.
- JSON uses camelCase; timestamps are ISO-8601 UTC instants.
- Unknown JSON properties are rejected.
- Backend Clock decides lifecycle/deadline/cutoff.
- List endpoints use separate `page`, `size`, `sort` query parameters.
- `page >= 0`; `1 <= size <= 100`; unsupported sort/filter returns 400.
- Default sort is documented per endpoint and a stable ID tiebreaker is always applied.
- Private Partner lookup is ownership-safe: missing and foreign records both return 404.
- A successful mutation returns the committed representation; email runs after commit.

### 1.1 Common error shape

```json
{
  "timestamp": "2026-10-16T08:20:00Z",
  "status": 409,
  "code": "ACTIVITY_LOCATION_TIME_CONFLICT",
  "message": "Địa điểm đã có hoạt động khác trong khoảng thời gian này.",
  "fieldErrors": [],
  "path": "/api/v1/organizer/activity-proposals/42/approve"
}
```

`fieldErrors` is present for 422 validation failures:

```json
{
  "status": 422,
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ.",
  "fieldErrors": [
    { "field": "capacity", "code": "MAX", "message": "Không được vượt sức chứa địa điểm." }
  ]
}
```

### 1.2 HTTP classification

- `400 Bad Request`: malformed JSON, unknown field, invalid enum/filter/page/size/sort.
- `401 Unauthorized`: Session absent/expired.
- `403 Forbidden`: role missing or Organizer authority rejected where concealment is unnecessary.
- `404 Not Found`: absent resource or private Partner resource not owned by caller.
- `409 Conflict`: lifecycle/deadline/quota/ownership-at-state/concurrency conflict.
- `422 Unprocessable Entity`: request field or merged-candidate validation.

## 2. Enumerations

```text
LocationType = BOOTH | STAGE | WORKSHOP | AREA

ActivityProposalStatus =
  PENDING | NEED_CHANGES | APPROVED | REJECTED | WITHDRAWN | CANCELLED

ActivityStatus = DRAFT | PUBLISHED | ONGOING | COMPLETED | CANCELLED

ActivityRequestStatus = PENDING | APPROVED | REJECTED | WITHDRAWN | CANCELLED

ActivityCancellationSource =
  ORGANIZER | PARTNER_REQUEST | EVENT_CANCELLATION | SYSTEM
```

`RESCHEDULED` and request status `CONFIRMED` are invalid.

## 3. Shared representations

### 3.1 LocationSummary

```json
{
  "locationId": 12,
  "code": "STAGE-A",
  "name": "Sân khấu A",
  "locationType": "STAGE",
  "maxCapacity": 120,
  "description": "Sân khấu trung tâm của sự kiện.",
  "mapX": 52.50,
  "mapY": 18.25,
  "active": true,
  "boothAssignmentId": null,
  "eligible": true,
  "ineligibleReason": null
}
```

Partner eligible-location response may contain an owned Booth with `boothAssignmentId`; Organizer
shared-location response keeps it null.

### 3.2 ActivityProposalResponse

```json
{
  "activityProposalId": 42,
  "eventId": 7,
  "eventName": "Ngày hội Văn hóa Đọc 2027",
  "partnerOrganizationId": 3,
  "location": {
    "locationId": 12,
    "code": "STAGE-A",
    "name": "Sân khấu A",
    "locationType": "STAGE",
    "maxCapacity": 120,
    "active": true
  },
  "title": "Giao lưu tác giả trẻ",
  "description": "Trao đổi với độc giả.",
  "activityType": "TALKSHOW",
  "proposedStartAt": "2027-01-11T02:00:00Z",
  "proposedEndAt": "2027-01-11T03:00:00Z",
  "capacity": 100,
  "status": "PENDING",
  "reviewNote": null,
  "submittedAt": "2026-10-16T08:00:00Z",
  "updatedAt": "2026-10-16T08:00:00Z",
  "reviewedAt": null,
  "withdrawnAt": null,
  "cancelledAt": null,
  "activityId": null
}
```

### 3.3 ActivityResponse

```json
{
  "activityId": 91,
  "eventId": 7,
  "sourceProposalId": 42,
  "partnerOrganizationId": 3,
  "location": {
    "locationId": 12,
    "code": "STAGE-A",
    "name": "Sân khấu A",
    "locationType": "STAGE",
    "maxCapacity": 120,
    "active": true
  },
  "title": "Giao lưu tác giả trẻ",
  "description": "Trao đổi với độc giả.",
  "activityType": "TALKSHOW",
  "startAt": "2027-01-11T02:00:00Z",
  "endAt": "2027-01-11T03:00:00Z",
  "capacity": 100,
  "imageUrl": null,
  "registrationRequired": false,
  "registrationDeadlineAt": null,
  "certificateEnabled": false,
  "attendanceQrAvailable": false,
  "status": "DRAFT",
  "createdAt": "2026-10-16T08:10:00Z",
  "updatedAt": "2026-10-16T08:10:00Z",
  "publishedAt": null,
  "completedAt": null,
  "cancelledAt": null,
  "cancellationReason": null,
  "cancellationSource": null
}
```

Raw Attendance QR token is private and is not returned by public endpoints. Organizer detail may
receive the token only after publication; Partner list/detail receives only availability in Sprint
5 because Participant scan is out of scope.

### 3.4 ActivityChangeRequestResponse

```json
{
  "activityChangeRequestId": 15,
  "activityId": 91,
  "status": "PENDING",
  "reason": "Cần dời lịch để tác giả kịp tham dự.",
  "requestedTitle": null,
  "requestedDescriptionIncluded": false,
  "requestedDescription": null,
  "requestedActivityType": null,
  "requestedLocationId": 14,
  "requestedStartAt": "2027-01-11T04:00:00Z",
  "requestedEndAt": "2027-01-11T05:00:00Z",
  "requestedCapacity": null,
  "requestedImageUrlIncluded": false,
  "requestedImageUrl": null,
  "reviewNote": null,
  "submittedAt": "2026-10-20T07:00:00Z",
  "handledAt": null,
  "withdrawnAt": null,
  "cancelledAt": null
}
```

### 3.5 ActivityCancellationRequestResponse

```json
{
  "activityCancellationRequestId": 16,
  "activityId": 91,
  "status": "PENDING",
  "reason": "Diễn giả không thể tham dự vì lý do sức khỏe.",
  "late": true,
  "reviewNote": null,
  "submittedAt": "2027-01-10T13:00:00Z",
  "handledAt": null,
  "withdrawnAt": null,
  "cancelledAt": null
}
```

### 3.6 ActivityRevisionResponse

```json
{
  "activityRevisionId": 8,
  "activityId": 91,
  "revisionSource": "PARTNER_REQUEST",
  "sourceRequestId": 15,
  "actorUserId": 6,
  "changeReason": "Cần dời lịch để tác giả kịp tham dự.",
  "oldSnapshot": {
    "locationId": 12,
    "startAt": "2027-01-11T02:00:00Z",
    "endAt": "2027-01-11T03:00:00Z"
  },
  "newSnapshot": {
    "locationId": 14,
    "startAt": "2027-01-11T04:00:00Z",
    "endAt": "2027-01-11T05:00:00Z"
  },
  "changedAt": "2026-10-21T08:00:00Z"
}
```

Snapshots contain Activity business/config fields only and never Session, CSRF, secrets or private
user data. Organizer revision detail may include `actorUserId`; Partner revision responses omit it
and expose only `revisionSource` so internal User identity is not leaked.

## 4. Organizer shared Location APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/locations` | List shared Activity Locations |
| POST | `/organizer/locations` | Create shared Activity Location |
| PATCH | `/organizer/locations/{locationId}` | Update/deactivate shared Activity Location |
| GET | `/partner/events/{eventId}/activity-locations` | List Locations eligible for current Partner |

### 4.1 GET `/organizer/locations`

Query: `page`, `size`, `sort=code,asc`, optional `type`, `active`, `search`.

Allowed sort: `code`, `name`, `locationType`, `maxCapacity`, `createdAt`.

### 4.2 POST `/organizer/locations`

```json
{
  "code": "stage-a",
  "name": "Sân khấu A",
  "locationType": "STAGE",
  "maxCapacity": 120,
  "description": "Sân khấu trung tâm của sự kiện.",
  "mapX": 52.50,
  "mapY": 18.25
}
```

- Code is trimmed and uppercased.
- Code must be 1–30 characters from `A-Z`, `0-9`, `_` or `-`; name normalizes to 1–100
  characters.
- Type must be `STAGE`, `WORKSHOP` or `AREA`; `BOOTH` uses Booth API.
- Capacity must be positive.
- Description is optional, maximum 5,000 characters. Map coordinates are optional decimals from
  0 through 100 inclusive with at most two fractional digits.

Success: `201 Created`.

### 4.3 PATCH `/organizer/locations/{locationId}`

Presence-aware optional fields: `code`, `name`, `description`, `maxCapacity`, `mapX`, `mapY`,
`active`.

This endpoint manages only `STAGE`/`WORKSHOP`/`AREA`; a BOOTH Location must be updated through the
existing Booth API and is not retyped through either endpoint.

- Setting inactive is blocked while a current/future non-cancelled Activity exists.
- Reducing capacity below an applicable non-cancelled Activity is blocked.
- A mixed invalid patch applies nothing.

Errors include:

- `409 LOCATION_CODE_ALREADY_EXISTS`
- `409 LOCATION_HAS_ACTIVE_ACTIVITIES`
- `409 LOCATION_CAPACITY_IN_USE`
- `422 VALIDATION_FAILED`

### 4.4 GET `/partner/events/{eventId}/activity-locations`

Returns active shared Locations plus Active BoothAssignments owned by the caller's Partner in that
Event. It never exposes a different Partner's Booth assignment. Optional `startAt` and `endAt` may
annotate availability for UI convenience; they must appear together with `startAt < endAt` or the
endpoint returns 400. Response eligibility is advisory; mutations always recheck.

## 5. Partner Activity Proposal APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/partner/activity-proposals` | Submit initial Proposal |
| GET | `/partner/activity-proposals` | List owned Proposals |
| GET | `/partner/activity-proposals/{proposalId}` | Get owned Proposal |
| PATCH | `/partner/activity-proposals/{proposalId}` | Edit Pending/NeedChanges content |
| POST | `/partner/activity-proposals/{proposalId}/resubmit` | Resubmit NeedChanges |
| POST | `/partner/activity-proposals/{proposalId}/withdraw` | Withdraw open Proposal |

### 5.1 Proposal write body

POST requires every field. PATCH is presence-aware but `proposedStartAt` and `proposedEndAt` must
appear together.

```json
{
  "eventId": 7,
  "locationId": 12,
  "title": "Giao lưu tác giả trẻ",
  "description": "Trao đổi với độc giả.",
  "activityType": "TALKSHOW",
  "proposedStartAt": "2027-01-11T02:00:00Z",
  "proposedEndAt": "2027-01-11T03:00:00Z",
  "capacity": 100
}
```

Success POST: `201 Created`. Successful PATCH/resubmit/withdraw: `200 OK`.

Initial submission requires Published Event and open general deadline. PATCH:

- `PENDING`: permitted only through the general deadline.
- `NEED_CHANGES`: permitted while Event Published/Ongoing and before proposed start; a PATCH keeps
  it NeedChanges until explicit resubmit.
- other states: conflict.

Resubmit validates the entire Proposal and moves `NEED_CHANGES → PENDING`. Withdraw accepts
`PENDING`/`NEED_CHANGES`; an already Withdrawn retry is idempotent.

### 5.2 Proposal list query

`page`, `size`, `sort=submittedAt,desc`, optional `eventId`, `status`, `search`.

Allowed sort: `submittedAt`, `updatedAt`, `proposedStartAt`, `title`, `status`.

Errors include:

- `404 ACTIVITY_PROPOSAL_NOT_FOUND`
- `409 EVENT_NOT_ACCEPTING_ACTIVITY_PROPOSALS`
- `409 ACTIVITY_PROPOSAL_DEADLINE_PASSED`
- `409 PARTNER_APPLICATION_NOT_APPROVED`
- `409 ACTIVITY_QUOTA_REACHED`
- `409 LOCATION_NOT_ACTIVE`
- `409 BOOTH_ASSIGNMENT_REQUIRED`
- `409 BOOTH_NOT_ASSIGNED_TO_PARTNER`
- `409 PROPOSAL_NOT_EDITABLE`
- `422 ACTIVITY_TIME_INVALID`
- `422 ACTIVITY_TIME_OUTSIDE_EVENT`
- `422 ACTIVITY_CAPACITY_INVALID`

## 6. Organizer Proposal review APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/activity-proposals` | List proposals for owned Events |
| GET | `/organizer/activity-proposals/{proposalId}` | Review detail |
| POST | `/organizer/activity-proposals/{proposalId}/request-changes` | Return to Partner |
| POST | `/organizer/activity-proposals/{proposalId}/reject` | Reject Proposal |
| POST | `/organizer/activity-proposals/{proposalId}/approve` | Atomically create Draft Activity |

List query: `page`, `size`, `sort=submittedAt,asc`, optional `eventId`, `status`, `locationId`,
`search`.

Request-changes/reject body:

```json
{ "reviewNote": "Vui lòng điều chỉnh thời lượng và mô tả nội dung." }
```

`reviewNote` is normalized 10–1,000 characters.

Approve body: none. Success: `200 OK` returning both Proposal and Activity:

```json
{
  "proposal": { "activityProposalId": 42, "status": "APPROVED" },
  "activity": { "activityId": 91, "status": "DRAFT", "sourceProposalId": 42 }
}
```

Approve does not accept replacement Proposal fields. Mutable eligibility is rechecked. Duplicate
approve returns the existing Activity. Errors include:

- `404 ACTIVITY_PROPOSAL_NOT_FOUND`
- `409 PROPOSAL_NOT_REVIEWABLE`
- `409 ACTIVITY_QUOTA_REACHED`
- `409 LOCATION_NOT_ACTIVE`
- `409 BOOTH_ASSIGNMENT_REQUIRED`
- `409 BOOTH_NOT_ASSIGNED_TO_PARTNER`
- `409 ACTIVITY_LOCATION_TIME_CONFLICT`
- time/capacity 422 codes from section 5.

## 7. Organizer Activity APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/organizer/activities` | Create direct BTC Draft |
| GET | `/organizer/activities` | List Activities for owned Events |
| GET | `/organizer/activities/{activityId}` | Organizer Activity detail |
| PATCH | `/organizer/activities/{activityId}` | Configure/edit an eligible Activity |
| POST | `/organizer/activities/{activityId}/publish` | Publish Draft |
| POST | `/organizer/activities/{activityId}/cancel` | Cancel official Activity |
| GET | `/organizer/activities/{activityId}/revisions` | Read immutable revision history |

### 7.1 POST `/organizer/activities`

```json
{
  "eventId": 7,
  "locationId": 12,
  "title": "Lễ khai mạc",
  "description": "Chương trình khai mạc chính thức.",
  "activityType": "CEREMONY",
  "startAt": "2027-01-11T01:00:00Z",
  "endAt": "2027-01-11T01:30:00Z",
  "capacity": 120,
  "imageUrl": "https://cdn.example.test/opening.jpg",
  "registrationRequired": false,
  "registrationDeadlineAt": null,
  "certificateEnabled": false
}
```

The Location must be active `STAGE`, `WORKSHOP` or `AREA`. Parent Event may be `DRAFT`/`PUBLISHED`,
or `ONGOING` only when Activity start remains in the future; `COMPLETED`/`CANCELLED` is rejected.
Success: `201 Created` Draft Activity.

Invalid parent lifecycle returns `409 EVENT_NOT_ACCEPTING_ACTIVITIES`.

### 7.2 PATCH `/organizer/activities/{activityId}`

Presence-aware fields:

- `title`, `description`, `activityType`, `locationId`
- `startAt` + `endAt` as a pair
- `capacity`, `imageUrl`
- `registrationRequired`, `registrationDeadlineAt`, `certificateEnabled`

Rules:

- Organizer may fully configure `DRAFT` Activities for its Event.
- For a source-Proposal Activity, core schedule/content changes must remain auditable and are not a
  substitute for Partner request. Before first publication, Organizer may set presentation and
  registration fields; changing approved core fields requires returning/reopening before approval
  and is therefore not accepted here.
- Direct BTC `DRAFT` fields are mutable. A direct BTC `PUBLISHED` Activity may receive safe
  descriptive/config changes only before start and after merged validation; time/Location changes
  use the same conflict lock path.
- PATCH accepts optional `changeReason`. It is required and normalized to 10–500 characters when
  a core field of a Published Activity changes; Draft configuration may omit it.
- Every applied business/config patch writes an immutable revision with old/new snapshots in the
  same transaction. Approval of a Partner Change Request does the same with source
  `PARTNER_REQUEST` and its request reason.
- `ONGOING`, `COMPLETED`, `CANCELLED` are not patchable.

### 7.3 POST `/organizer/activities/{activityId}/publish`

Body: none. First publication requires `DRAFT`, parent Event `PUBLISHED`/`ONGOING`, active Location,
future schedule and complete registration config; when registration is required,
`now <= registrationDeadlineAt <= startAt`.
Creates Attendance QR exactly once only if registration is required. Repeating against the same
ever-published Activity in `PUBLISHED`, `ONGOING` or `COMPLETED` is `200 OK` idempotent and returns
its current state; `CANCELLED` is not republished.

Errors:

- `409 ACTIVITY_NOT_PUBLISHABLE`
- `409 ACTIVITY_ALREADY_STARTED`
- `409 LOCATION_NOT_ACTIVE`
- `409 ACTIVITY_LOCATION_TIME_CONFLICT`

### 7.4 POST `/organizer/activities/{activityId}/cancel`

```json
{ "reason": "Diễn giả chính không thể tiếp tục tham gia chương trình." }
```

Reason normalizes to 10–500 characters. Success sets source `ORGANIZER`. Already-cancelled retry
returns original metadata. Completed is not cancellable.

Revision history is paginated with default `sort=changedAt,desc`; allowed sort fields are
`changedAt`, `revisionSource` and `activityRevisionId`. It is read-only.

## 8. Partner official Activity APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/partner/activities` | List official Activities originating from owned Proposals |
| GET | `/partner/activities/{activityId}` | Owned Activity detail |
| GET | `/partner/activities/{activityId}/revisions` | Owned immutable revision history |

List query: `page`, `size`, `sort=startAt,asc`, optional `eventId`, `status`, `search`.

These endpoints do not return direct BTC Activities as Partner-owned and do not permit Activity
PATCH. Ownership is derived through `sourceProposal → application → PartnerOrganization`.
Revision responses are read-only and ownership-safe.
Partner revision history uses the same pagination/sort contract as Organizer history.

## 9. Partner Change Request APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/partner/activities/{activityId}/change-requests` | Submit change request |
| GET | `/partner/activity-change-requests` | List owned change requests |
| GET | `/partner/activity-change-requests/{requestId}` | Owned detail |
| POST | `/partner/activity-change-requests/{requestId}/withdraw` | Withdraw Pending request |

Submit body:

```json
{
  "reason": "Cần dời lịch để tác giả kịp tham dự.",
  "requestedLocationId": 14,
  "requestedStartAt": "2027-01-11T04:00:00Z",
  "requestedEndAt": "2027-01-11T05:00:00Z"
}
```

- At least one requested field must cause a normalized change.
- Start/end appear together.
- Explicit `null` for `requestedDescription` or `requestedImageUrl` means clear the value; omission
  means no change. Response `...Included` flags preserve that distinction.
- Merged candidate is fully validated at submit.
- Pending request does not reserve the requested new Location; the existing Activity continues to
  reserve its current slot until an approval atomically moves it.
- Activity must be Partner-owned and `DRAFT`/`PUBLISHED`.
- One Pending request total across both request tables.

Success submit: `201 Created`. Withdraw: `200 OK`, idempotent once Withdrawn.

Errors include:

- `404 ACTIVITY_NOT_FOUND`
- `409 ACTIVITY_NOT_CHANGEABLE`
- `409 ACTIVITY_REQUEST_ALREADY_PENDING`
- `409 ACTIVITY_LOCATION_TIME_CONFLICT`
- `422 ACTIVITY_CHANGE_HAS_NO_EFFECT`
- standard time/capacity/Booth ownership errors.

## 10. Partner Cancellation Request APIs

| Method | Path | Purpose |
|---|---|---|
| POST | `/partner/activities/{activityId}/cancellation-requests` | Submit cancellation request |
| GET | `/partner/activity-cancellation-requests` | List owned cancellation requests |
| GET | `/partner/activity-cancellation-requests/{requestId}` | Owned detail |
| POST | `/partner/activity-cancellation-requests/{requestId}/withdraw` | Withdraw Pending request |

Submit:

```json
{ "reason": "Diễn giả không thể tham dự vì lý do sức khỏe." }
```

- Reason 10–500 after normalization.
- Once approved, the reason becomes the public Activity cancellation explanation; clients must not
  include credentials, private health details or financial secrets.
- At `now <= activityCancellationCutoffAt`, `late=false`; after it, accepted with `late=true`.
- Submit never cancels Activity.
- The Activity continues to reserve its current Location/time while the request is Pending.
- One Pending request total across both request types.

## 11. Organizer Activity Request review APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/activity-change-requests` | List Change Requests for owned Events |
| GET | `/organizer/activity-change-requests/{requestId}` | Review Change Request |
| POST | `/organizer/activity-change-requests/{requestId}/approve` | Apply merged change atomically |
| POST | `/organizer/activity-change-requests/{requestId}/reject` | Reject with note |
| GET | `/organizer/activity-cancellation-requests` | List Cancellation Requests |
| GET | `/organizer/activity-cancellation-requests/{requestId}` | Review Cancellation Request |
| POST | `/organizer/activity-cancellation-requests/{requestId}/approve` | Cancel Activity atomically |
| POST | `/organizer/activity-cancellation-requests/{requestId}/reject` | Reject with note |

List query: `page`, `size`, `sort=submittedAt,asc`, optional `eventId`, `status`, `late`, `search`.

Reject body:

```json
{ "reviewNote": "Chưa có phương án thay thế phù hợp." }
```

Approve body: none.

Change approval re-merges current Activity with requested values and reruns every guard under
locks. Cancellation approval copies request reason into Activity cancellation metadata and uses
source `PARTNER_REQUEST`. A request must still be `PENDING`; otherwise
`ACTIVITY_REQUEST_NOT_REVIEWABLE`.

## 12. Public Activity APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/activities` | Public discovery |
| GET | `/activities/{activityId}` | Public detail for ever-published Activity |

### 12.1 GET `/activities`

Query:

- `page`, `size`, `sort=startAt,asc`
- optional `eventId`, `status=PUBLISHED|ONGOING|COMPLETED`, `activityType`, `locationId`, `search`

No status filter means `PUBLISHED` and `ONGOING`. `DRAFT`/`CANCELLED` filter returns
`400 INVALID_ACTIVITY_STATUS_FILTER`. Cancelled Activities are never listed.

Public summary omits QR token, Proposal/Partner ownership, review notes and private requests.

### 12.2 GET `/activities/{activityId}`

Returns only when `publishedAt` is non-null. Therefore an ever-published Activity remains
explainable after cancellation:

```json
{
  "activityId": 91,
  "status": "CANCELLED",
  "cancelledAt": "2027-01-10T14:00:00Z",
  "cancellationReason": "Diễn giả chính không thể tiếp tục tham gia chương trình.",
  "cancellationSource": "ORGANIZER"
}
```

Never-published Draft/Cancelled Activity returns 404.

## 13. Event lifecycle integration

Existing Event APIs retain their paths. Sprint 5 changes internal eligibility/cascade:

- ActivityProposal, Activity and Activity requests count as external participation for operational
  Event patch freeze.
- A Draft Event with any Activity returns `409 EVENT_HAS_ACTIVITY_DEPENDENCIES` on hard-delete.
- A Draft Event time patch is accepted only when every non-cancelled Activity remains inside the
  merged Event interval; otherwise it returns `422 ACTIVITY_TIME_OUTSIDE_EVENT` atomically.
- Eligible Event cancellation first satisfies every Sprint 4 Payment/Assignment blocker.
- In the same Event-cancellation transaction:
  - Proposal `PENDING`/`NEED_CHANGES → CANCELLED`;
  - Activity `DRAFT`/`PUBLISHED`/`ONGOING → CANCELLED` with source `EVENT_CANCELLATION`;
  - Pending Activity requests → `CANCELLED`.
- Event completion closes stale open Proposal/request and Draft Activity with source `SYSTEM` and
  reason `Sự kiện đã kết thúc trước khi hoạt động được công bố.`.
- Proposal lifecycle cleanup changes `PENDING`/`NEED_CHANGES → CANCELLED` when
  `proposedStartAt <= now`.
- Activity transition to `ONGOING` closes only a Pending Change Request; a Pending Cancellation
  Request remains reviewable. Activity terminal transition closes either Pending request type.
- Activity lifecycle processing is idempotent and runs from backend time.

## 14. Canonical error codes

### 14.1 Validation — 422

- `VALIDATION_FAILED`
- `ACTIVITY_TIME_INVALID`
- `ACTIVITY_TIME_OUTSIDE_EVENT`
- `ACTIVITY_CAPACITY_INVALID`
- `ACTIVITY_CHANGE_HAS_NO_EFFECT`

### 14.2 State/deadline/conflict — 409

- `EVENT_NOT_ACCEPTING_ACTIVITY_PROPOSALS`
- `EVENT_NOT_ACCEPTING_ACTIVITIES`
- `ACTIVITY_PROPOSAL_DEADLINE_PASSED`
- `PARTNER_APPLICATION_NOT_APPROVED`
- `ACTIVITY_QUOTA_REACHED`
- `LOCATION_NOT_ACTIVE`
- `LOCATION_HAS_ACTIVE_ACTIVITIES`
- `LOCATION_CAPACITY_IN_USE`
- `LOCATION_CODE_ALREADY_EXISTS`
- `BOOTH_ASSIGNMENT_REQUIRED`
- `BOOTH_NOT_ASSIGNED_TO_PARTNER`
- `ACTIVITY_LOCATION_TIME_CONFLICT`
- `PROPOSAL_NOT_EDITABLE`
- `PROPOSAL_NOT_REVIEWABLE`
- `ACTIVITY_NOT_CHANGEABLE`
- `ACTIVITY_NOT_PUBLISHABLE`
- `ACTIVITY_ALREADY_STARTED`
- `ACTIVITY_REQUEST_ALREADY_PENDING`
- `ACTIVITY_REQUEST_NOT_REVIEWABLE`
- `ACTIVITY_ALREADY_CANCELLED`
- `ACTIVITY_NOT_CANCELLABLE`
- `EVENT_HAS_ACTIVITY_DEPENDENCIES`

### 14.3 Request/query — 400

- `MALFORMED_REQUEST`
- `UNKNOWN_FIELD`
- `INVALID_PAGE`
- `INVALID_SIZE`
- `INVALID_SORT`
- `INVALID_FILTER`
- `INVALID_ACTIVITY_STATUS_FILTER`

### 14.4 Not found — 404

- `LOCATION_NOT_FOUND`
- `ACTIVITY_PROPOSAL_NOT_FOUND`
- `ACTIVITY_NOT_FOUND`
- `ACTIVITY_CHANGE_REQUEST_NOT_FOUND`
- `ACTIVITY_CANCELLATION_REQUEST_NOT_FOUND`

## 15. Concurrency and idempotency contract

- Event row is the first mutation lock.
- Old/new Location rows lock by ascending ID.
- Proposal approval relies on unique `source_proposal_id`.
- One-Pending-request invariant must survive a race across two request tables; V9 provides a shared
  guard mechanism described in the Physical ERD overlay, not only an application count query.
- Activity schedule exclusion is database-enforced and constraint violation maps to 409.
- Approve/publish/withdraw/cancel retries preserve first timestamps and side effects.
- No external email/network call occurs while database locks are held.

Post-commit Partner email triggers are Proposal NeedChanges/Approved/Rejected, Activity request
Approved/Rejected, direct Organizer cancellation of a Partner Activity and Event cancellation
cascade, plus system closure of an open Proposal/request. Only verified representative addresses
are normalized/deduplicated; missing addresses are
skipped and per-recipient failure is isolated. Participant notification remains out of Sprint 5.

## 16. Compatibility and exclusions

- No existing Event, Partner, Booth or Payment endpoint is renamed.
- Activity has no payment endpoint.
- Sprint 5 does not expose ActivityRegistration, Attendance, rating or certificate endpoints.
- Participant-facing notification remains deferred.
- No generic Location endpoint may create a Booth.
- No hard-delete endpoint is provided for Activity domain history.

