# Sprint 06 API Contract

**QR window amendment (2026-10-26):** `POST /organizer/activities` and `PATCH /organizer/activities/{activityId}` accept `attendanceEarlyScanMinutes` (integer 0–1440). Omitted or null on creation means 15; the Activity response includes the effective value. PATCH omission retains the current value; explicit null resets it to 15. A value outside the range returns `422 ACTIVITY_ATTENDANCE_WINDOW_INVALID`. A change after the first `VALID` Attendance returns `409 ACTIVITY_ATTENDANCE_WINDOW_FROZEN`. The scan and correction window is `[startAt - attendanceEarlyScanMinutes minutes, endAt)`. Flyway V11 stores the value, default 15.

**Notification inbox amendment (2026-10-27):** The Project Owner approved owner-only bulk
mark-read through `POST /participant/notifications/read-all`. The command updates only unread
Notifications owned by the authenticated Participant, applies one backend timestamp to that
update set and is idempotent on retry. It does not add notification composition, broadcast or a
cross-role inbox.

> Status: `PROJECT OWNER APPROVED — ACTIVE IMPLEMENTATION BASELINE` on 2026-10-19.
> Implementation is authorized only within this contract and the ownership/merge gates referenced
> by `docs/sprints/CURRENT_SPRINT.md`.
>
> Sources of truth: `05_Business_Rules.md`, `06_Use_Case_List.md`,
> `sprint-06-use-case-specifications.md`, `12_Physical_ERD_Report.md`, then this contract.
> Existing Sprint 1–5 endpoints remain backward compatible unless this document explicitly closes
> the Sprint 5 public Activity contract debt.

## 1. Scope and conventions

- Base path: `/api/v1`.
- Authentication: existing Spring Security server-side Session stored in Redis.
- Browser mutations require credentials and a valid CSRF token.
- JSON uses camelCase; timestamps are ISO-8601 UTC instants.
- Backend `Clock` decides lifecycle, deadline and Attendance-window boundaries.
- UI displays time in `Asia/Ho_Chi_Minh`; API input/output remains UTC.
- Unknown JSON properties are rejected.
- IDs are positive 64-bit integers unless another type is stated.
- List endpoints use separate `page`, `size` and `sort` query parameters.
- `page >= 0`; `1 <= size <= 100`; invalid filter/sort/pagination returns 400.
- A stable ascending ID tiebreaker is appended to every requested/default sort.
- Private Participant and Organizer detail lookup is ownership-safe: missing and foreign records
  both return the same 404 response.
- A successful mutation returns the committed durable representation. Optional email and
  Certificate rendering run after commit and cannot turn a committed domain command into failure.
- No endpoint accepts a client-supplied `userId` as the Participant identity.
- No public, Participant, Partner or Organizer list response exposes `attendanceQrToken` or a
  complete token-bearing scan URL. The existing owning-Organizer Activity detail is the only
  response allowed to return the raw token after publication.

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
fabricates placeholder rows. Sorting is represented by request query parameters and is not echoed
as an extra response field, matching the existing `ActivityPageResponse`/`EventPageResponse`
contract.

### 1.2 Common error shape

```json
{
  "timestamp": "2026-10-19T08:20:00Z",
  "status": 409,
  "code": "ACTIVITY_CAPACITY_FULL",
  "message": "Hoạt động đã hết chỗ.",
  "fieldErrors": [],
  "path": "/api/v1/participant/activities/91/register"
}
```

Validation failures include field errors:

```json
{
  "timestamp": "2026-10-19T08:20:00Z",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ.",
  "fieldErrors": [
    {
      "field": "score",
      "code": "RANGE",
      "message": "Điểm đánh giá phải là số nguyên từ 1 đến 5."
    }
  ],
  "path": "/api/v1/participant/activities/91/rating"
}
```

### 1.3 HTTP classification

- `400 Bad Request`: malformed JSON, unknown property, invalid enum/filter/page/size/sort or
  malformed idempotency key.
- `401 Unauthorized`: Session absent or expired. An unauthenticated QR landing page may preserve
  the opaque token only long enough to resume after login; it never treats token data as identity.
- `403 Forbidden`: required role/capability is missing, CSRF validation fails, or Organizer
  authority is rejected where ownership concealment is not applicable.
- `404 Not Found`: absent public resource, invalid opaque QR token, or private resource absent/not
  owned by the caller.
- `409 Conflict`: lifecycle, deadline, capacity, current-state, idempotency-fingerprint or
  concurrency conflict.
- `422 Unprocessable Entity`: request-field or merged-candidate validation.
- `503 Service Unavailable`: optional Certificate file rendering is temporarily unavailable;
  durable Certificate metadata remains unchanged.

### 1.4 Idempotency rules

- Join, Leave, register, cancel and QR scan are naturally idempotent against their durable unique
  identity and current achieved state. Exact retry returns the existing effective result without
  timestamp drift or duplicate side effects.
- Organizer Attendance correction requires `Idempotency-Key: <UUID>`.
- Reusing a correction key with the same normalized command returns the existing result.
- Reusing the key with a different target, effective time, reason or registration returns
  `409 IDEMPOTENCY_KEY_REUSED`.
- Database unique constraints are the final race guard; their violations must map to a documented
  result or conflict, never an unhandled 500.

## 2. Enumerations and derived outcomes

```text
ActivityStatus = DRAFT | PUBLISHED | ONGOING | COMPLETED | CANCELLED

ActivityCancellationSource =
  ORGANIZER | PARTNER_REQUEST | EVENT_CANCELLATION | SYSTEM

EventRegistrationStatus = ACTIVE | LEFT

ActivityRegistrationStatus = ACTIVE | CANCELLED | NO_SHOW

ActivityRegistrationCancellationSource =
  PARTICIPANT | ACTIVITY | EVENT

AttendanceStatus = VALID | VOIDED

AttendanceRecordedSource = SELF_SCAN | ORGANIZER_CORRECTION

ParticipationOutcome = ACTIVE | CANCELLED | ATTENDED | NO_SHOW

CertificateStatus = ISSUED | REVOKED

ActivityRatingStatus = ACTIVE | INVALIDATED

ParticipantNotificationType =
  ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED |
  ACTIVITY_CANCELLED |
  EVENT_CANCELLED |
  CERTIFICATE_ISSUED |
  CERTIFICATE_REVOKED

ParticipantNotificationReferenceType = EVENT | ACTIVITY | CERTIFICATE

RegistrationWarningCode = SCHEDULE_OVERLAP
```

`ATTENDED` is not persisted in `activity_registrations`; it is derived from `Attendance.status =
VALID`.

`ActivityCancellationSource` describes why the Activity itself ended and retains the Sprint 5
values. `ActivityRegistrationCancellationSource` describes why one Participant seat ended; the two
enums are intentionally different and must not be mapped by string coincidence.

### 2.1 Activity participation outcome precedence

The API and both Participant/Organizer UIs use one precedence:

1. `activityRegistration.status = CANCELLED` produces primary outcome `CANCELLED` even when valid
   historical Attendance exists.
2. Otherwise `attendance.status = VALID` produces `ATTENDED`.
3. Otherwise registration `NO_SHOW` produces `NO_SHOW`.
4. Otherwise registration `ACTIVE` produces `ACTIVE`.

Historical Attendance remains in `attendance` and is exposed as secondary history where the caller
is authorized. Cancellation never deletes Attendance, Certificate, Rating or correction audit.

### 2.2 Seat-active definition

A registration consumes a seat and blocks Leave Event only when:

- `activityRegistration.status = ACTIVE`; and
- parent Activity status is `PUBLISHED` or `ONGOING`.

An `ACTIVE` historical row under `COMPLETED` does not consume a seat and does not block Leave.

## 3. Shared representations

### 3.1 PublicActivityResponse

This is the one canonical public Activity projection used by list and detail.

```json
{
  "activityId": 91,
  "eventId": 7,
  "eventName": "Ngày hội Văn hóa Đọc 2027",
  "location": {
    "locationId": 12,
    "code": "STAGE-A",
    "name": "Sân khấu A",
    "locationType": "STAGE"
  },
  "title": "Giao lưu tác giả trẻ",
  "description": "Trao đổi với độc giả.",
  "activityType": "TALKSHOW",
  "startAt": "2027-01-11T02:00:00Z",
  "endAt": "2027-01-11T03:00:00Z",
  "capacity": 100,
  "imageUrl": null,
  "registrationRequired": true,
  "registrationDeadlineAt": "2027-01-10T17:00:00Z",
  "registrationOpen": true,
  "registeredCount": 82,
  "availableSeats": 18,
  "certificateEnabled": true,
  "attendanceQrAvailable": true,
  "ratingSummary": {
    "averageScore": 4.6,
    "ratingCount": 25
  },
  "status": "PUBLISHED",
  "publishedAt": "2026-10-18T08:00:00Z",
  "completedAt": null,
  "cancelledAt": null,
  "cancellationReason": null,
  "cancellationSource": null
}
```

Rules:

- Public list returns `PUBLISHED`/`ONGOING` by default and may explicitly include `COMPLETED`.
- Public detail remains available for an ever-published `CANCELLED` Activity so an old link can
  explain cancellation.
- `registrationOpen` and `availableSeats` are advisory snapshots. Mutation-time checks under lock
  are authoritative.
- `registeredCount` is the current seat-active count. When `registrationRequired=false`,
  `registrationOpen=false` and both `registeredCount`/`availableSeats` are null.
- `ratingSummary` counts only `ACTIVE` ratings backed by `VALID` Attendance. With no eligible
  ratings it returns `averageScore=null` and `ratingCount=0`; an invalidated Rating never
  contributes to the aggregate.
- Public output never contains Proposal/Partner ownership, review notes, request data, raw QR,
  registration identity, Attendance, Certificate, Rating ownership or Participant data.

### 3.2 EventRegistrationResponse

```json
{
  "eventRegistrationId": 301,
  "event": {
    "eventId": 7,
    "name": "Ngày hội Văn hóa Đọc 2027",
    "startAt": "2027-01-11T02:00:00Z",
    "endAt": "2027-01-12T10:00:00Z",
    "status": "PUBLISHED"
  },
  "status": "ACTIVE",
  "registeredAt": "2026-10-19T08:00:00Z",
  "activatedAt": "2026-10-19T08:00:00Z",
  "leftAt": null,
  "updatedAt": "2026-10-19T08:00:00Z",
  "seatActiveActivityCount": 1
}
```

There is no Event ticket, Event QR, Participant QR or admission barcode in this representation.

### 3.3 AttendanceSummary

```json
{
  "attendanceId": 501,
  "status": "VALID",
  "recordedSource": "SELF_SCAN",
  "attendedAt": "2027-01-11T01:52:10Z",
  "createdAt": "2027-01-11T01:52:10Z",
  "updatedAt": "2027-01-11T01:52:10Z",
  "voidedAt": null
}
```

`recordedSource` is creation provenance. A later void/restore keeps the original source and records
the Organizer action in `attendance_adjustments`; only Attendance first created by correction uses
`ORGANIZER_CORRECTION`.

### 3.4 CertificateSummary

```json
{
  "certificateId": 601,
  "certificateCode": "BKS-2027-8F3KQ2M9",
  "recipientName": "Nguyễn Minh An",
  "status": "ISSUED",
  "issuedAt": "2027-01-11T03:00:05Z",
  "revokedAt": null,
  "downloadAvailable": true
}
```

`downloadAvailable` describes the current state, not whether `fileUrl` cache already exists.
`fileUrl` is not exposed as authoritative state.

### 3.5 ActivityRatingResponse

```json
{
  "activityRatingId": 701,
  "activityId": 91,
  "score": 5,
  "comment": "Nội dung hữu ích và tổ chức tốt.",
  "status": "ACTIVE",
  "createdAt": "2027-01-11T03:10:00Z",
  "updatedAt": "2027-01-11T03:10:00Z",
  "invalidatedAt": null
}
```

### 3.6 ActivityRegistrationResponse

```json
{
  "activityRegistrationId": 401,
  "eventRegistrationId": 301,
  "activity": {
    "activityId": 91,
    "eventId": 7,
    "title": "Giao lưu tác giả trẻ",
    "locationCode": "STAGE-A",
    "locationName": "Sân khấu A",
    "startAt": "2027-01-11T02:00:00Z",
    "endAt": "2027-01-11T03:00:00Z",
    "status": "PUBLISHED"
  },
  "status": "ACTIVE",
  "cancellationSource": null,
  "outcome": "ATTENDED",
  "registeredAt": "2026-10-19T08:05:00Z",
  "activatedAt": "2026-10-19T08:05:00Z",
  "cancelledAt": null,
  "noShowAt": null,
  "updatedAt": "2027-01-11T01:52:10Z",
  "attendance": {
    "attendanceId": 501,
    "status": "VALID",
    "recordedSource": "SELF_SCAN",
    "attendedAt": "2027-01-11T01:52:10Z",
    "createdAt": "2027-01-11T01:52:10Z",
    "updatedAt": "2027-01-11T01:52:10Z",
    "voidedAt": null
  },
  "certificate": null,
  "rating": null,
  "warnings": [
    {
      "code": "SCHEDULE_OVERLAP",
      "message": "Lịch hoạt động trùng với một hoạt động bạn đã đăng ký.",
      "conflictingActivityIds": [88]
    }
  ]
}
```

Warnings are informational. They never change a successful status code into an error and never
cancel another registration.

### 3.7 ParticipantNotificationResponse

```json
{
  "notificationId": 801,
  "type": "ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED",
  "title": "Lịch hoạt động đã thay đổi",
  "message": "Hoạt động Giao lưu tác giả trẻ đã được cập nhật thời gian hoặc địa điểm.",
  "referenceType": "ACTIVITY",
  "referenceId": 91,
  "createdAt": "2026-10-20T08:00:00Z",
  "readAt": null,
  "read": false
}
```

The reference is derived from the one non-null Event/Activity/Certificate FK. The frontend maps
the safe reference type/ID to its own navigation route. Title and message are server-owned and
contain no raw QR token or private secret.

### 3.8 OrganizerParticipationResponse

```json
{
  "activityRegistrationId": 401,
  "eventRegistrationId": 301,
  "eventId": 7,
  "activityId": 91,
  "participant": {
    "userId": 44,
    "displayName": "Nguyễn Minh An"
  },
  "registrationStatus": "ACTIVE",
  "cancellationSource": null,
  "outcome": "ATTENDED",
  "registeredAt": "2026-10-19T08:05:00Z",
  "activatedAt": "2026-10-19T08:05:00Z",
  "cancelledAt": null,
  "noShowAt": null,
  "attendance": {
    "attendanceId": 501,
    "status": "VALID",
    "recordedSource": "SELF_SCAN",
    "attendedAt": "2027-01-11T01:52:10Z",
    "createdAt": "2027-01-11T01:52:10Z",
    "updatedAt": "2027-01-11T01:52:10Z",
    "voidedAt": null
  },
  "certificate": null,
  "ratingStatus": null,
  "latestAdjustmentAt": null
}
```

Organizer monitoring exposes only the minimum Participant identity required for Event operations;
it does not expose password, Session, QR token or unrelated profile data.

### 3.9 AttendanceAdjustmentResponse

```json
{
  "attendanceAdjustmentId": 901,
  "activityRegistrationId": 401,
  "actor": {
    "userId": 9,
    "displayName": "Demo Organizer"
  },
  "idempotencyKey": "71dfb84c-9dad-4e9a-917f-6a48ce734917",
  "previousState": {
    "registrationStatus": "NO_SHOW",
    "cancellationSource": null,
    "attendanceStatus": null,
    "attendedAt": null,
    "derivedDisplayOutcome": "NO_SHOW"
  },
  "newState": {
    "registrationStatus": "ACTIVE",
    "cancellationSource": null,
    "attendanceStatus": "VALID",
    "attendedAt": "2027-01-11T01:55:00Z",
    "derivedDisplayOutcome": "ATTENDED"
  },
  "effectiveAttendedAt": "2027-01-11T01:55:00Z",
  "reason": "Xác nhận lại do thiết bị quét tại cổng bị mất kết nối.",
  "adjustedAt": "2027-01-11T03:20:00Z"
}
```

The database snapshots use the fixed snake_case JSONB keys documented by the Physical ERD. The API
maps them to camelCase DTO fields; it does not expose arbitrary/unvalidated JSON.

### 3.10 OrganizerEventRegistrationResponse

```json
{
  "eventRegistrationId": 301,
  "eventId": 7,
  "participant": {
    "userId": 44,
    "displayName": "Nguyễn Minh An"
  },
  "status": "ACTIVE",
  "registeredAt": "2026-10-19T08:00:00Z",
  "activatedAt": "2026-10-19T08:00:00Z",
  "leftAt": null,
  "updatedAt": "2026-10-19T08:00:00Z",
  "seatActiveActivityCount": 1,
  "activityRegistrationCount": 2,
  "attendedActivityCount": 1,
  "noShowActivityCount": 0
}
```

Counts are ownership-scoped computed projections and do not introduce stored aggregate columns.

## 4. Canonical public Activity APIs

Sprint 6 closes the Sprint 5 contract/implementation debt by making these exact paths canonical:

- `GET /activities`
- `GET /activities/{activityId}`

Frontend must not merge `/public/activities`, Event-detail mock data or another incompatible source.

### 4.1 GET `/activities`

Authentication: public.

Query:

- `page`, `size`, default `sort=startAt,asc`.
- Optional `eventId`, `status`, `activityType`, `locationId`, `search`.
- Allowed status filter: `PUBLISHED`, `ONGOING`, `COMPLETED`.
- No status filter means `PUBLISHED` and `ONGOING`.
- Allowed sort: `startAt`, `endAt`, `title`, `publishedAt`.

Response: `200` paged `PublicActivityResponse`.

`DRAFT` and `CANCELLED` are invalid list filters. Cancelled Activities are omitted from discovery.

### 4.2 GET `/activities/{activityId}`

Authentication: public.

Response: `200 PublicActivityResponse` only when `publishedAt` is non-null. An ever-published
cancelled Activity returns status/cancellation metadata. A never-published Draft or cancelled Draft
returns public-safe `404 ACTIVITY_NOT_FOUND`.

Traceability: AC-G01-01 through AC-G01-04.

## 5. Participant Event participation APIs

All endpoints in this section require authenticated `PARTICIPANT` capability.

### 5.1 GET `/participant/event-registrations`

Purpose: My Events.

Query:

- `page`, `size`, default `sort=activatedAt,desc`.
- Optional `status=ACTIVE|LEFT`, `eventStatus`, `search`.
- Allowed sort: `registeredAt`, `activatedAt`, `updatedAt`, `eventStartAt`, `eventName`.

Response: `200` paged `EventRegistrationResponse` owned by the current User.

### 5.2 GET `/participant/event-registrations/{eventRegistrationId}`

Response: `200 EventRegistrationResponse`; absent/foreign record returns
`404 EVENT_REGISTRATION_NOT_FOUND`.

### 5.3 POST `/participant/events/{eventId}/join`

Request body: none.

Response: `200 EventRegistrationResponse` for first Join, rejoin or exact retry.

Rules checked atomically:

- Event is public and participation-eligible.
- Backend `now <= participantRegistrationDeadlineAt`.
- The unique `(userId,eventId)` row is created or the existing `LEFT` row is reactivated.
- `registeredAt` remains the first Join time; rejoin changes `activatedAt`/`updatedAt` and clears
  `leftAt`.

### 5.4 POST `/participant/events/{eventId}/leave`

Request body: none.

Response: `200 EventRegistrationResponse`. Exact retry of a previously achieved Leave returns the
same `LEFT` state without changing `leftAt`.

The command is rejected when any seat-active ActivityRegistration exists. Completed/cancelled
history does not block Leave and is never deleted.

Traceability: AC-P01-01, AC-P01-02, AC-P01-04 through AC-P01-07. Activity auto-join
AC-P01-03 is attached to section 6.3.

## 6. Participant Activity registration APIs

All endpoints require authenticated `PARTICIPANT` capability.

### 6.1 GET `/participant/activity-registrations`

Purpose: My Activities.

Query:

- `page`, `size`, default `sort=activityStartAt,desc`.
- Optional `eventId`, `registrationStatus`, `outcome`, `activityStatus`, `search`.
- Allowed sort: `registeredAt`, `activatedAt`, `updatedAt`, `activityStartAt`, `activityTitle`.

Response: `200` paged `ActivityRegistrationResponse` owned by the current User.

### 6.2 GET `/participant/activity-registrations/{activityRegistrationId}`

Response: `200 ActivityRegistrationResponse`; absent/foreign record returns
`404 ACTIVITY_REGISTRATION_NOT_FOUND`.

### 6.3 POST `/participant/activities/{activityId}/register`

Request body: none.

Response: `200 ActivityRegistrationResponse` for first registration, eligible re-registration or
exact retry. Successful overlap returns warning `SCHEDULE_OVERLAP` in the same 200 response.

Rules checked in one transaction under Event/Activity lock:

- Activity is `PUBLISHED`, belongs to an eligible Event and has `registrationRequired=true`.
- Backend `now` is before or exactly at both Event and Activity registration deadlines. The earlier
  deadline is the effective cutoff.
- If no active EventRegistration exists, create/reactivate it in the same transaction. A failed
  Activity registration must not leave an unintended Join.
- Capacity counts only seat-active registrations and is rechecked under lock.
- No existing row: create one `ACTIVE` row.
- Existing `ACTIVE` row: return it without consuming capacity twice.
- Existing `CANCELLED/PARTICIPANT` row: rerun every current check and reactivate the same row.
- Existing `CANCELLED/ACTIVITY`, `CANCELLED/EVENT` or `NO_SHOW` row: reject.

### 6.4 POST `/participant/activities/{activityId}/cancel-registration`

Request body: none.

Response: `200 ActivityRegistrationResponse` with `CANCELLED/PARTICIPANT`.

Rules:

- Only the caller's existing `ACTIVE` registration may be cancelled.
- Backend `now < activity.startAt`; equality closes cancellation.
- Activity registration deadline does not prevent returning a seat.
- A `VALID` Attendance blocks Participant cancellation.
- Exact retry of an already `CANCELLED/PARTICIPANT` row returns the achieved result without
  timestamp drift.
- A system-cancelled or No-show row is a conflict, not an exact retry.

Traceability: AC-P01-03, AC-P02-01 through AC-P02-12, and AC-P03-01 for My Activities separation.

## 7. Participant Attendance self-scan API

### 7.1 QR landing behavior

The Organizer QR encodes a frontend route such as:

```text
https://<frontend-host>/participant/attendance/scan?token=<opaque-activity-token>
```

The frontend may preserve the token through authentication and then calls the API below. The URL
does not contain `userId`, EventRegistration ID or ActivityRegistration ID. The token identifies
the Activity; Session identifies the Participant.

Outside local development the scan URL is HTTPS. The landing page must capture the token and remove
it from the visible URL/history with `history.replaceState` before rendering third-party content,
use a no-referrer policy and never send the token to analytics or application logs.

### 7.2 POST `/participant/attendance-scans`

Authentication: `PARTICIPANT` capability.

Request:

```json
{
  "token": "c2b5a120-4d96-4a37-8e36-22d90a7bcfe8"
}
```

The token is treated as opaque even if the current implementation stores UUID. It must never be
logged, echoed in a response or included in an error message.

Successful first scan:

```json
{
  "activityRegistrationId": 401,
  "activityId": 91,
  "activityTitle": "Giao lưu tác giả trẻ",
  "attendance": {
    "attendanceId": 501,
    "status": "VALID",
    "recordedSource": "SELF_SCAN",
    "attendedAt": "2027-01-11T01:52:10Z",
    "createdAt": "2027-01-11T01:52:10Z",
    "updatedAt": "2027-01-11T01:52:10Z",
    "voidedAt": null
  },
  "alreadyRecorded": false
}
```

Exact/concurrent repeat returns `200` with the same Attendance identity and
`alreadyRecorded=true`.

Scan eligibility:

- Matching owned, seat-active ActivityRegistration exists.
- Event is not cancelled.
- Activity is `PUBLISHED` or `ONGOING`; `PUBLISHED` is valid during the early window.
- Registration is `ACTIVE`, not `CANCELLED` or `NO_SHOW`.
- Window is `[startAt - attendanceEarlyScanMinutes minutes, endAt)` using backend time.
- At exact opening time scan may succeed; at exact `endAt` it is closed.
- First valid scan creates one `VALID/SELF_SCAN` Attendance.
- No Certificate or Rating is created merely because an early scan succeeds.

Malformed and unknown token use the same public-safe `404 ATTENDANCE_QR_NOT_FOUND` response.

Traceability: AC-P03-02 through AC-P03-07 and AC-O06-S6-07/09.

## 8. Participant Certificate APIs

All endpoints require authenticated `PARTICIPANT` capability.

### 8.1 GET `/participant/certificates`

Query:

- `page`, `size`, default `sort=issuedAt,desc`.
- Optional `eventId`, `activityId`, `status=ISSUED|REVOKED`.
- Allowed sort: `issuedAt`, `updatedAt`, `activityTitle`.

Response: `200` paged Certificate summaries owned through the caller's Attendance.

### 8.2 GET `/participant/certificates/{certificateId}`

Response:

```json
{
  "certificate": {
    "certificateId": 601,
    "certificateCode": "BKS-2027-8F3KQ2M9",
    "recipientName": "Nguyễn Minh An",
    "status": "ISSUED",
    "issuedAt": "2027-01-11T03:00:05Z",
    "revokedAt": null,
    "downloadAvailable": true
  },
  "activity": {
    "activityId": 91,
    "title": "Giao lưu tác giả trẻ",
    "startAt": "2027-01-11T02:00:00Z",
    "endAt": "2027-01-11T03:00:00Z"
  },
  "event": {
    "eventId": 7,
    "name": "Ngày hội Văn hóa Đọc 2027"
  }
}
```

An owned revoked Certificate remains visible with `status=REVOKED`.

### 8.3 GET `/participant/certificates/{certificateId}/download`

- `ISSUED`: return `200 application/pdf` with safe `Content-Disposition` filename. The file may be
  rendered lazily and cached without changing Certificate identity/status.
- `REVOKED`: return `409 CERTIFICATE_REVOKED`.
- Temporary rendering failure: return `503 CERTIFICATE_RENDER_UNAVAILABLE`; metadata remains
  issued and later retry is allowed.
- Missing/foreign: `404 CERTIFICATE_NOT_FOUND`.

Sprint 6 does not define a public Certificate-verification endpoint.

Traceability: AC-P03-12, AC-O06-S6-08, AC-O07-08 and AC-O07-09.

## 9. Participant Activity Rating APIs

All endpoints require authenticated `PARTICIPANT` capability.

### 9.1 GET `/participant/activities/{activityId}/rating`

Response: `200 ActivityRatingResponse` for the Rating attached to the caller's Attendance. Missing
owned Rating returns `404 ACTIVITY_RATING_NOT_FOUND`; the lookup never exposes another User's
Attendance/Rating.

### 9.2 PUT `/participant/activities/{activityId}/rating`

Request:

```json
{
  "score": 5,
  "comment": "Nội dung hữu ích và tổ chức tốt."
}
```

Validation:

- `score` is required and must be an integer from 1 through 5.
- `comment` is optional. Blank after trim becomes null; otherwise normalized length is 1–1000.
- Activity must be `COMPLETED`.
- Caller must own `VALID` Attendance for the Activity.

Response: `200 ActivityRatingResponse`. First write creates one identity; later writes update the
same row. Concurrent first writes converge on one identity. Organizer Attendance void/restore may
change the same Rating `ACTIVE <-> INVALIDATED`; Participant does not directly choose status.

Traceability: AC-P04-01 through AC-P04-06.

## 10. Participant Notification APIs

All endpoints require authenticated `PARTICIPANT` capability. Sprint 6 supports only the five
types in section 2; it does not include broadcast composition, preferences, SMS/push or an outbox.

### 10.1 GET `/participant/notifications`

Query:

- `page`, `size`, default `sort=createdAt,desc`.
- Optional `read=true|false`, `type`.
- Allowed sort: `createdAt`, `readAt`.

Response: `200` paged `ParticipantNotificationResponse` owned by the current User.

### 10.2 GET `/participant/notifications/unread-count`

Response:

```json
{
  "unreadCount": 3
}
```

### 10.3 POST `/participant/notifications/{notificationId}/read`

Request body: none.

Response: `200 ParticipantNotificationResponse` with stable first `readAt`. Exact retry returns the
same result. Missing/foreign returns `404 NOTIFICATION_NOT_FOUND`.

### 10.4 POST `/participant/notifications/read-all`

Request body: none.

Response:

```json
{
  "updatedCount": 3
}
```

The command scopes its update by the authenticated Participant and `read=false`; it never accepts
a caller-supplied User ID. Every row changed by one command receives the same backend-generated
`readAt`. Already-read rows keep their original `readAt`, and an exact retry after convergence
returns `updatedCount=0`. Read state remains presentation state and does not change Event,
Activity, registration, Attendance or Certificate lifecycle state.

Notification creation is part of the related domain transaction and is deduplicated by recipient
plus a stable business-transition key. Message wording is never the uniqueness key. Optional email
is after commit and cannot replace or roll back the durable in-app row.

Traceability: AC-P03-10, AC-P03-11, AC-O01-S6-04, AC-O06-S6-05/08 and AC-O07-08/09.

## 11. Organizer QR and participation monitoring APIs

All endpoints require verified `ORGANIZER` and ownership of the parent Event. Foreign private
Activity/registration/Attendance data returns ownership-safe 404.

### 11.1 GET `/organizer/activities/{activityId}` — existing protected detail

Sprint 6 preserves the Sprint 5 Organizer detail path and its protected token field. It must use a
detail-only projection; Organizer Activity list uses `attendanceQrAvailable` and null/omitted token.

Relevant detail fields:

```json
{
  "activityId": 91,
  "attendanceQrAvailable": true,
  "attendanceQrToken": "c2b5a120-4d96-4a37-8e36-22d90a7bcfe8",
  "publishedAt": "2026-10-18T08:00:00Z"
}
```

Rules:

- Token is returned only after first publication for Activity with `registrationRequired=true`.
- The stored token is stable; repeated reads do not rotate it.
- The response must use `Cache-Control: no-store` and must not be logged.
- Partner, Participant, public and Organizer list APIs receive only `attendanceQrAvailable`, never
  the token.
- Before eligible publication, Organizer detail still returns the Activity for management with
  `attendanceQrAvailable=false` and `attendanceQrToken=null`. Missing or foreign Activity returns
  ownership-safe `404 ACTIVITY_NOT_FOUND`.

The Organizer frontend constructs the configured frontend scan route from this token, displays or
downloads the shared QR locally and must not persist the raw token in browser storage.

### 11.2 GET `/organizer/events/{eventId}/event-registrations`

Query:

- `page`, `size`, default `sort=activatedAt,desc`.
- Optional `status=ACTIVE|LEFT`, `search` by normalized participant display name.

Response: `200` paged `OrganizerEventRegistrationResponse` scoped to the owned Event.

### 11.3 GET `/organizer/activities/{activityId}/registrations`

Query:

- `page`, `size`, default `sort=registeredAt,asc`.
- Optional `registrationStatus`, `outcome`, `attendanceStatus`, `search`.
- Allowed sort: `registeredAt`, `activatedAt`, `participantDisplayName`, `attendedAt`, `updatedAt`.

Response: `200` paged `OrganizerParticipationResponse` using the same outcome precedence as the
Participant API.

### 11.4 GET `/organizer/activity-registrations/{activityRegistrationId}`

Response: `200 OrganizerParticipationResponse`; missing or outside an Event owned by the Organizer
returns `404 ACTIVITY_REGISTRATION_NOT_FOUND`.

### 11.5 GET `/organizer/activity-registrations/{activityRegistrationId}/attendance-adjustments`

Purpose: read the immutable correction audit for participation detail.

Query: `page`, `size`, default `sort=adjustedAt,desc`. Allowed sort: `adjustedAt` and
`attendanceAdjustmentId`.

Response: `200` paged `AttendanceAdjustmentResponse`. The endpoint is scoped through the parent
Activity/Event owner. It provides no update/delete operation and returns an empty page when no
correction exists.

Traceability: AC-P03-02, AC-O07-01 through AC-O07-04 and AC-O07-10.

## 12. Organizer Attendance correction API

### 12.1 POST `/organizer/activity-registrations/{activityRegistrationId}/attendance-adjustments`

Required header:

```text
Idempotency-Key: 71dfb84c-9dad-4e9a-917f-6a48ce734917
```

Correct/restore to Attended request:

```json
{
  "targetAttendanceStatus": "VALID",
  "effectiveAttendedAt": "2027-01-11T01:55:00Z",
  "reason": "Xác nhận lại do thiết bị quét tại cổng bị mất kết nối."
}
```

Void request:

```json
{
  "targetAttendanceStatus": "VOIDED",
  "effectiveAttendedAt": null,
  "reason": "Bản ghi được tạo nhầm cho người tham gia không có mặt."
}
```

Validation:

- Normalized `reason` is required and 10–500 characters inclusive.
- Target is exactly `VALID` or `VOIDED`.
- Target `VALID` requires `effectiveAttendedAt` inside
  `[activity.startAt - attendanceEarlyScanMinutes minutes, activity.endAt)`.
- Target `VOIDED` requires existing `VALID` Attendance and null `effectiveAttendedAt`.
- A cancelled Activity/Event cannot gain brand-new historical Attendance. An existing `VOIDED`
  Attendance may be restored under the same audit rules.
- Organizer cannot manually assign `NO_SHOW` before completion.
- A new idempotency key requesting the already-effective state without any state change returns
  `409 ATTENDANCE_CORRECTION_HAS_NO_EFFECT`. Only an exact replay of the original key/fingerprint
  returns the prior successful result.

Response:

```json
{
  "participation": {
    "activityRegistrationId": 401,
    "registrationStatus": "ACTIVE",
    "cancellationSource": null,
    "outcome": "ATTENDED"
  },
  "attendance": {
    "attendanceId": 501,
    "status": "VALID",
    "recordedSource": "ORGANIZER_CORRECTION",
    "attendedAt": "2027-01-11T01:55:00Z",
    "createdAt": "2027-01-11T03:20:00Z",
    "updatedAt": "2027-01-11T03:20:00Z",
    "voidedAt": null
  },
  "adjustment": {
    "attendanceAdjustmentId": 901,
    "idempotencyKey": "71dfb84c-9dad-4e9a-917f-6a48ce734917",
    "previousState": {
      "registrationStatus": "NO_SHOW",
      "cancellationSource": null,
      "attendanceStatus": null,
      "attendedAt": null,
      "derivedDisplayOutcome": "NO_SHOW"
    },
    "newState": {
      "registrationStatus": "ACTIVE",
      "cancellationSource": null,
      "attendanceStatus": "VALID",
      "attendedAt": "2027-01-11T01:55:00Z",
      "derivedDisplayOutcome": "ATTENDED"
    },
    "effectiveAttendedAt": "2027-01-11T01:55:00Z",
    "reason": "Xác nhận lại do thiết bị quét tại cổng bị mất kết nối.",
    "adjustedAt": "2027-01-11T03:20:00Z"
  },
  "certificate": {
    "certificateId": 601,
    "status": "ISSUED"
  },
  "ratingStatus": null,
  "idempotentReplay": false
}
```

Correction effects are atomic:

- Void before completion: registration remains/returns `ACTIVE`.
- Void after completion: registration becomes `NO_SHOW`.
- Void after Activity/Event cancellation: registration remains `CANCELLED` with original source.
- Void changes existing Certificate to `REVOKED`, Rating to `INVALIDATED` and creates required
  Certificate Notification in the same transaction.
- Valid restore after completion reruns Certificate eligibility, reuses the same Certificate
  identity/code/issuedAt and may return the same Rating to `ACTIVE`.
- One successful correction appends one immutable adjustment. There is no update/delete endpoint
  for `attendance_adjustments`.
- Exact retry returns `idempotentReplay=true` without a second adjustment or Notification.

Traceability: AC-O07-03 through AC-O07-10.

## 13. Existing Organizer Event/Activity API integration

Sprint 6 does not rename these existing Sprint 5 command paths. It adds the following mandatory
guards and atomic effects.

### 13.1 PATCH `/organizer/events/{eventId}`

- Any EventRegistration, ActivityRegistration or Attendance freezes operational Event fields under
  BR-78.
- A rejected merged candidate changes no field.
- Conflict: `409 EVENT_OPERATIONAL_FIELDS_LOCKED`.

### 13.2 POST `/organizer/events/{eventId}/cancel`

Existing Sprint 4 financial/Assignment blockers remain authoritative. On eligible cancellation,
the same transaction:

- cancels the Event and existing Booth/Activity domain rows under prior contracts;
- changes seat-active ActivityRegistration rows to `CANCELLED/EVENT`;
- preserves `CANCELLED/PARTICIPANT` source and all Attendance/downstream history;
- creates one `EVENT_CANCELLED` Notification for every User whose EventRegistration is `ACTIVE`.

Exact retry returns the existing cancellation without duplicate cascade/Notification/email.

### 13.3 PATCH `/organizer/activities/{activityId}`

The same domain command is used by direct PATCH and existing
`POST /organizer/activity-change-requests/{requestId}/approve`; approval must not bypass any guard
or Notification below. In addition to Sprint 5 validation:

- schedule or Location change is rejected after first `VALID` Attendance;
- capacity cannot be lower than current seat-active registration count;
- schedule/Location change preserves registrations and recalculates overlap warnings;
- actual schedule/Location change creates one deduplicated Notification per seat-active User;
- message wording is not the deduplication identity.

Canonical new conflicts:

- `409 ACTIVITY_ATTENDANCE_FREEZES_SCHEDULE_OR_LOCATION`
- `409 ACTIVITY_CAPACITY_BELOW_ACTIVE_REGISTRATIONS`

### 13.4 POST `/organizer/activities/{activityId}/cancel`

The same cancellation command/cascade is used by direct cancellation and existing
`POST /organizer/activity-cancellation-requests/{requestId}/approve`. In the Activity cancellation
transaction:

- seat-active registrations become `CANCELLED/ACTIVITY`;
- prior `CANCELLED/PARTICIPANT` rows retain their source;
- Attendance, adjustments, Certificate and Rating history remains linked;
- new registration and scan close immediately;
- each affected User receives one `ACTIVITY_CANCELLED` Notification.

### 13.5 Activity completion finalization

There is no new public actor endpoint for completion. Scheduler and every relevant request-time
guard invoke the same idempotent internal finalization command when backend time requires it. In one
transaction it:

- moves Activity to `COMPLETED`;
- changes remaining `ACTIVE` registrations without `VALID` Attendance to `NO_SHOW`;
- leaves cancelled registrations cancelled;
- issues eligible Certificate metadata;
- creates `CERTIFICATE_ISSUED` Notifications once.

Final scan and completion use the common lock order. A scan evaluated before `endAt` may commit
before finalization; a scan evaluated at/after `endAt` is rejected.

Traceability: AC-O01-S6-01 through AC-O01-S6-05 and AC-O06-S6-01 through AC-O06-S6-09.

## 14. Canonical error codes

The same business condition maps to the same code across list/detail/command paths.

### 14.1 Common request/security

- `MALFORMED_REQUEST` — 400
- `UNKNOWN_FIELD` — 400
- `INVALID_PAGE` — 400
- `INVALID_SIZE` — 400
- `INVALID_SORT` — 400
- `INVALID_FILTER` — 400
- `INVALID_ACTIVITY_STATUS_FILTER` — 400
- `INVALID_ENUM_VALUE` — 400
- `INVALID_IDEMPOTENCY_KEY` — 400
- `AUTHENTICATION_REQUIRED` — 401
- `ACCESS_DENIED` — 403
- `CSRF_INVALID` — 403
- `VALIDATION_FAILED` — 422
- `IDEMPOTENCY_KEY_REUSED` — 409

### 14.2 Event participation

- `EVENT_NOT_FOUND` — 404
- `EVENT_REGISTRATION_NOT_FOUND` — 404
- `EVENT_NOT_OPEN_FOR_PARTICIPATION` — 409
- `EVENT_REGISTRATION_DEADLINE_PASSED` — 409
- `EVENT_LEAVE_BLOCKED_BY_ACTIVE_ACTIVITY` — 409
- `EVENT_OPERATIONAL_FIELDS_LOCKED` — 409

### 14.3 Activity registration and lifecycle

- `ACTIVITY_NOT_FOUND` — 404
- `ACTIVITY_REGISTRATION_NOT_FOUND` — 404
- `ACTIVITY_NOT_PUBLISHED` — 409
- `ACTIVITY_REGISTRATION_NOT_REQUIRED` — 409
- `ACTIVITY_REGISTRATION_DEADLINE_PASSED` — 409
- `ACTIVITY_CAPACITY_FULL` — 409
- `ACTIVITY_REGISTRATION_CANCELLATION_CLOSED` — 409
- `ACTIVITY_REGISTRATION_HAS_ATTENDANCE` — 409
- `ACTIVITY_REGISTRATION_SYSTEM_CANCELLED` — 409
- `ACTIVITY_REGISTRATION_NO_SHOW` — 409
- `ACTIVITY_ATTENDANCE_FREEZES_SCHEDULE_OR_LOCATION` — 409
- `ACTIVITY_CAPACITY_BELOW_ACTIVE_REGISTRATIONS` — 409

### 14.4 Attendance and correction

- `ATTENDANCE_QR_NOT_FOUND` — 404
- `ATTENDANCE_WINDOW_NOT_OPEN` — 409
- `ATTENDANCE_WINDOW_CLOSED` — 409
- `ATTENDANCE_ACTIVITY_INELIGIBLE` — 409
- `ATTENDANCE_REGISTRATION_INELIGIBLE` — 409
- `ATTENDANCE_CORRECTION_NOT_ALLOWED` — 409
- `ATTENDANCE_CORRECTION_HAS_NO_EFFECT` — 409
- `ATTENDANCE_HISTORY_REQUIRED` — 409
- `ATTENDANCE_EFFECTIVE_TIME_OUTSIDE_WINDOW` — 422
- `ATTENDANCE_CORRECTION_REASON_INVALID` — 422

### 14.5 Certificate, Rating and Notification

- `CERTIFICATE_NOT_FOUND` — 404
- `CERTIFICATE_REVOKED` — 409
- `CERTIFICATE_RENDER_UNAVAILABLE` — 503
- `ACTIVITY_RATING_NOT_FOUND` — 404
- `RATING_ACTIVITY_NOT_COMPLETED` — 409
- `RATING_ATTENDANCE_REQUIRED` — 409
- `RATING_ATTENDANCE_VOIDED` — 409
- `RATING_SCORE_INVALID` — 422
- `RATING_COMMENT_TOO_LONG` — 422
- `NOTIFICATION_NOT_FOUND` — 404

## 15. Concurrency, locking and side effects

- Event-scoped Participant mutations lock in the approved order:
  `Event -> Location when required -> Activity -> EventRegistration -> ActivityRegistration ->`
  `Attendance -> AttendanceAdjustment -> Certificate/ActivityRating -> Notification`.
- Multiple rows at one level lock by ascending ID.
- Direct Join racing Activity auto-join converges on one EventRegistration.
- Final-seat registrations serialize on Activity; exactly one may consume the final seat.
- Register/cancel/re-register and Event/Activity cancellation recheck authoritative state after
  locks. A committed cancellation leaves no seat-active registration behind.
- QR scan, schedule/Location change and completion use compatible Event/Activity lock order.
- Attendance unique identity makes duplicate/concurrent scan idempotent.
- Rating unique identity makes concurrent first submission converge.
- Certificate unique Attendance identity/code and Notification recipient/dedup constraints prevent
  duplicate completion/correction side effects.
- Event cancellation commits Booth, Activity, Participant and Notification cascade together or
  rolls back all of it.
- Optional email and Certificate PDF rendering happen only after commit and outside database locks.

## 16. Validation boundary matrix

The following boundaries are normative:

- Join Event: accept when `now <= participantRegistrationDeadlineAt`; reject after it.
- Register Activity: accept only when `now` is at/before both Event and Activity deadlines.
- Cancel Activity registration: accept only when `now < startAt` and no `VALID` Attendance.
- Self-scan: accept when `startAt - attendanceEarlyScanMinutes minutes <= now < endAt`.
- Organizer effective Attendance: same half-open window as self-scan.
- Rating: Activity must already be `COMPLETED` and owned Attendance must be `VALID`.
- Correction reason: normalized length 10–500 inclusive.
- Rating score: integer 1–5 inclusive.
- Rating comment: null/blank-to-null or normalized length 1–1000.

All comparisons use backend time. Client time is display-only and cannot rescue a late request.

## 17. Acceptance Criteria traceability

All 65 Sprint 6 Acceptance Criteria are covered:

- `AC-G01-01`, `AC-G01-02`, `AC-G01-03`, `AC-G01-04` — section 4.
- `AC-P01-01`, `AC-P01-02`, `AC-P01-04`, `AC-P01-05`, `AC-P01-06`, `AC-P01-07` — section 5.
- `AC-P01-03` — section 6.3.
- `AC-P02-01`, `AC-P02-02`, `AC-P02-03`, `AC-P02-04`, `AC-P02-05`, `AC-P02-06`,
  `AC-P02-07`, `AC-P02-08`, `AC-P02-09`, `AC-P02-10`, `AC-P02-11`, `AC-P02-12` — section 6.
- `AC-P03-01` — sections 5 and 6.
- `AC-P03-02`, `AC-P03-03`, `AC-P03-04`, `AC-P03-05`, `AC-P03-06`, `AC-P03-07` — sections 7
  and 11.1.
- `AC-P03-08`, `AC-P03-09` — sections 2.1 and 13.5.
- `AC-P03-10`, `AC-P03-11` — section 10.
- `AC-P03-12` — section 8.
- `AC-P04-01`, `AC-P04-02`, `AC-P04-03`, `AC-P04-04`, `AC-P04-05`, `AC-P04-06` — sections 9
  and 12.
- `AC-O01-S6-01`, `AC-O01-S6-02`, `AC-O01-S6-03`, `AC-O01-S6-04`, `AC-O01-S6-05` — sections
  13.1, 13.2 and 15.
- `AC-O06-S6-01`, `AC-O06-S6-02`, `AC-O06-S6-03`, `AC-O06-S6-04`, `AC-O06-S6-05`,
  `AC-O06-S6-06`, `AC-O06-S6-07`, `AC-O06-S6-08`, `AC-O06-S6-09` — sections 7, 10,
  13.3–13.5 and 15.
- `AC-O07-01`, `AC-O07-02` — section 11.
- `AC-O07-03`, `AC-O07-04`, `AC-O07-05`, `AC-O07-06`, `AC-O07-07`, `AC-O07-08`,
  `AC-O07-09`, `AC-O07-10` — section 12.

## 18. Compatibility and explicit exclusions

- Existing Event, Partner, Booth, Payment and Sprint 5 Activity endpoints are not renamed.
- This contract closes only the missing canonical public Activity implementation at
  `/api/v1/activities` and `/api/v1/activities/{activityId}`.
- There is no Event entrance ticket/QR, Participant-specific Attendance QR, Attendance Operator,
  check-out, Attendance duration, waitlist or reconfirm-registration state.
- There is no Participant endpoint to assign No-show, issue/revoke Certificate, invalidate Rating
  or compose Notification.
- There is no public Certificate-verification endpoint in Sprint 6.
- There is no generic Notification composer, preference API, SMS/push or transactional outbox.
- Booth QR/visit/points/badge flows remain outside Sprint 6.
- No hard-delete endpoint is provided for EventRegistration, ActivityRegistration, Attendance,
  AttendanceAdjustment, Certificate, Rating or Notification history.

### 18.1 Frontend route reconciliation

The current Participant/Organizer frontend contains placeholder routes from before the Sprint 6
domain was approved. Implementation must replace them as one coordinated integration, not keep two
competing contracts:

- `GET /public/activities` becomes canonical `GET /activities`.
- The canonical public Activity list is paged; the current frontend array adapter must read
  `content` and paging metadata instead of assuming a raw array.
- `GET /participant/events` becomes `GET /participant/event-registrations`.
- `GET /participant/activities` and `GET /participant/registrations` become
  `GET /participant/activity-registrations`.
- Existing Join may keep its current UI action but calls the canonical POST in section 5.3.
- `DELETE /participant/events/{eventId}/leave` becomes the state-transition command
  `POST /participant/events/{eventId}/leave`.
- `DELETE /participant/registrations/{registrationId}` becomes
  `POST /participant/activities/{activityId}/cancel-registration` after the UI resolves the owned
  registration/activity detail.
- `PATCH /participant/notifications/{id}/read` becomes the canonical mark-one command in section
  10.3. Owner-only mark-all-read uses the approved `POST /participant/notifications/read-all`
  command in section 10.4; neither command accepts a caller-selected User ID.
- Existing `/participant/certificates` and `/participant/notifications` UI adapters must consume
  paged responses. Notification fields become `type`, `read`, `referenceType` and `referenceId`;
  the frontend derives navigation instead of accepting a server-owned route string.
- The Participant page that displays/downloads a personal check-in QR is removed. It is replaced by
  the scan landing behavior in section 7.1.
- Organizer `POST /organizer/checkin` is removed; Organizer does not scan Participant tickets.
- Organizer `POST /organizer/participants/{id}/override-attendance` is replaced by the explicit,
  audited correction command in section 12.
- Existing Organizer Activity service keeps `GET /organizer/activities/{activityId}` for protected
  detail/QR retrieval, but its paged list projection must no longer serialize raw QR tokens.

No compatibility alias is required for a placeholder route that has never had a reviewed backend
contract. API clients and frontend services change together in the later implementation phase.

## 19. Focused API contract audit result

The focused review against Business Rules, all 65 Acceptance Criteria, the Physical ERD, Sprint 5
API conventions and current frontend services resolved these contract-level findings:

1. Page responses now use only the existing `content/page/size/totalElements/totalPages` shape;
   request sorting is not invented as a response field.
2. Public Activity capacity now has an explicit computed `registeredCount` and `availableSeats`
   projection while mutation-time capacity remains authoritative.
3. Public Activity now carries an eligible Rating aggregate and excludes invalidated Ratings.
4. Organizer monitoring now exposes paged, ownership-safe AttendanceAdjustment history; the audit
   table is no longer write-only from the Actor workflow.
5. Attendance creation provenance is stable across later correction, while correction history
   remains in the append-only adjustment records.
6. JSONB snapshot snake_case persistence is explicitly mapped to camelCase API DTOs.
7. Existing protected Organizer Activity detail remains the one QR-token retrieval API; list and
   non-Organizer projections cannot expose the token.
8. Direct Organizer Activity mutation and approval of Partner requests invoke the same guarded
   change/cancellation commands and Participant cascades.
9. Existing placeholder frontend paths and reversed QR behavior have one documented replacement
   path each and do not receive compatibility aliases.
10. All 65 Acceptance Criterion identifiers appear exactly in both the Use Case Specification and
   this contract; no unknown identifier is introduced.
11. The 2026-10-27 Notification inbox amendment documents the implemented owner-only,
    idempotent bulk mark-read command without expanding notification creation or cross-role scope.

No unresolved contradiction was found between the reviewed requirements, Use Cases, ERD and this
contract. The Project Owner accepted the baseline endpoint and DTO decisions on 2026-10-19 and the
Notification inbox amendment on 2026-10-27; `CURRENT_SPRINT.md` activates both as the
implementation contract.

## 20. Documentation gate result

Contract-level review is complete:

- [x] Every path was checked against the current frontend route/service inventory.
- [x] Every request/response maps to the reviewed Physical ERD without inventing persisted fields.
- [x] Every error maps to a validation, lifecycle or ownership branch.
- [x] All 65 AC references were independently audited for omission and contradiction.
- [x] The Project Owner approved the contract on 2026-10-19.

The Sprint-level gate is also complete:

- [x] `SPRINT_06_BACKEND_WORK_ASSIGNMENT.md` assigns the sole migration owner and dependency-safe
  merge order.
- [x] `CURRENT_SPRINT.md` was changed only after the entire Sprint 6 documentation baseline was
  reviewed.

Flyway, Entity, Controller and frontend work may now begin only in the approved delivery order and
without semantic divergence from this contract.
