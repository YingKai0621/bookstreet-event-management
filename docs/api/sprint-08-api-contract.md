# Sprint 08 General Feedback API Contract

> Status: `APPROVED - FROZEN FOR IMPLEMENTATION`.
>
> This contract freezes the approved HTTP, DTO, validation, security, throttle, persistence and
> transaction boundaries for Sprint 08 General Feedback. Semantic changes require documentation
> review before implementation changes.
>
> Sources of truth, in precedence order: `05_Business_Rules.md`, `06_Use_Case_List.md`,
> `sprint-08.md`, `sprint-08-use-case-specifications.md`, the current Physical ERD plus
> `SPRINT_08_GENERAL_FEEDBACK_PHYSICAL_ERD_OVERLAY.md`, then this contract.

## 1. Scope and conventions

- Base path: `/api/v1`.
- Authentication uses the existing Spring Security server-side Session stored in Redis.
- Every browser mutation requires credentials mode and a valid CSRF token, including the public
  Feedback submission route.
- JSON uses camelCase. Timestamps are ISO-8601 UTC instants.
- Backend `Clock` owns every persisted timestamp. UI renders time in `Asia/Ho_Chi_Minh`.
- Unknown JSON properties are rejected.
- IDs are positive signed 64-bit integers.
- Closed response/request enums use uppercase values defined by this contract.
- Optional text that is absent or whitespace-only normalizes to `null`.
- Successful mutation responses represent committed durable state.
- All Sprint 08 responses use `Cache-Control: no-store` because Organizer responses may contain
  contact data and public receipts must not be cached as history.
- General Feedback remains separate from Activity Rating and has no score/rating field.
- General Feedback is one-way. No endpoint sends or exposes a reply to the Guest.

Sprint 08 adds exactly six backend operations:

```text
POST /public/feedbacks
GET  /organizer/feedbacks
GET  /organizer/feedbacks/{feedbackId}
POST /organizer/feedbacks/{feedbackId}/start-handling
POST /organizer/feedbacks/{feedbackId}/resolve
POST /organizer/feedbacks/{feedbackId}/reopen
```

There is no public Feedback list/detail, Guest status lookup, update, reply or delete operation.

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

Rules:

- `page >= 0`.
- `1 <= size <= 100`.
- Default `page=0`, `size=20`.
- Empty valid queries return `200` with empty content and correct metadata.
- Content and count queries use the same authorization, search and filter predicates.
- No endpoint fabricates placeholder rows.

### 1.2 Common error shape

Sprint 08 reuses the current backend `ApiErrorResponse` shape. HTTP status remains in the HTTP
response and is not duplicated in the JSON body.

```json
{
  "code": "FEEDBACK_TRANSITION_CONFLICT",
  "message": "Trạng thái góp ý đã thay đổi. Vui lòng tải lại dữ liệu.",
  "fieldErrors": [],
  "timestamp": "2026-10-31T08:20:00Z",
  "path": "/api/v1/organizer/feedbacks/101/resolve"
}
```

Field validation uses the current two-field representation:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ.",
  "fieldErrors": [
    {
      "field": "message",
      "message": "Nội dung góp ý phải có từ 10 đến 2000 ký tự."
    }
  ],
  "timestamp": "2026-10-31T08:20:00Z",
  "path": "/api/v1/public/feedbacks"
}
```

Clients branch on HTTP status plus stable `code`, never on localized `message` text.

### 1.3 HTTP classification

- `400 Bad Request`: malformed JSON, unknown property, invalid enum, page, size, sort, filter or
  syntactically invalid path/query value.
- `401 Unauthorized`: Organizer Session is absent or expired.
- `403 Forbidden`: Organizer authority is missing or CSRF proof is missing/invalid.
- `404 Not Found`: public-safe missing/ineligible Event or missing Organizer Feedback detail.
- `409 Conflict`: requested Feedback transition is not legal from the currently committed state,
  including a stale concurrent transition.
- `422 Unprocessable Entity`: a bound request field fails content/relationship validation.
- `429 Too Many Requests`: the public Feedback submission throttle is exceeded.
- `500 Internal Server Error`: unexpected persistence/system failure; no success receipt may be
  returned.
- `503 Service Unavailable`: the mandatory public submission throttle cannot be evaluated.

### 1.4 Mutation and retry semantics

- Public creation does not accept `Idempotency-Key`. Every accepted POST creates one new Feedback
  identity. The UI disables duplicate clicks while a request is pending.
- If the client loses the response after a commit, it must not claim success without evidence. A
  manual retry may create another Feedback because Sprint 08 adds no durable idempotency-key table.
- Start, resolve and reopen are deliberately state-sensitive rather than idempotent. Repeating an
  achieved transition returns `409 FEEDBACK_TRANSITION_CONFLICT` and does not rewrite actor/time.
- Organizer GET operations never mutate state.
- Database constraint violations map to the documented validation/conflict outcome or a safe
  internal error; SQL text and constraint names never reach the client.

## 2. Enumerations and target rules

### 2.1 Closed enums

```text
GeneralFeedbackTargetType = BOOK_STREET | EVENT
GeneralFeedbackStatus     = NEW | IN_PROGRESS | RESOLVED
GeneralFeedbackAction     = START_HANDLING | RESOLVE | REOPEN
```

`HERITAGE`, `LOCATION`, `BOOTH`, `FACILITY` and `ACTIVITY` are not accepted target enum values in
Sprint 08.

### 2.2 Exact target shape

```text
targetType = BOOK_STREET -> eventId must be null/absent
targetType = EVENT       -> eventId must be a positive public-detail-eligible Event id
```

For Feedback submission, public-detail-eligible Event statuses are:

```text
PUBLISHED | ONGOING | COMPLETED | CANCELLED
```

`DRAFT`, missing or otherwise private Event identifiers all return the same
`404 EVENT_NOT_FOUND` response. No response reveals whether a private Event exists.

The existing public Event APIs remain the source for Event selector/context data. The Landing Page
selector enumerates the Events already discoverable from the public Event list, currently
`PUBLISHED` and `ONGOING`. An existing public context or deep link may preselect a `COMPLETED` or
`CANCELLED` Event only after the existing public Event detail operation resolves that id. The
submission endpoint still validates all four public-detail-eligible statuses. Sprint 08 neither
widens Event discovery nor adds a duplicate “Feedback target options” endpoint.

### 2.3 State transitions

```text
NEW         -> IN_PROGRESS : START_HANDLING
IN_PROGRESS -> RESOLVED    : RESOLVE
RESOLVED    -> IN_PROGRESS : REOPEN
```

No other source/action pair is valid. Listing/detail never performs an implicit transition.

## 3. Normalization and validation

### 3.1 Guest name

- Optional; null/blank-to-null.
- Trim surrounding whitespace.
- Collapse each run of internal whitespace to one ASCII space.
- Normalized length: `1..100` characters.

### 3.2 Contact email

- Optional; null/blank-to-null.
- Trim surrounding whitespace and lowercase with locale-independent rules.
- Normalized length: `3..255` characters.
- Must pass application email-syntax validation; Sprint 08 performs no DNS/mailbox verification.
- Stored email is contact data only and triggers no delivery.

### 3.3 Feedback message

- Required and nonblank.
- Normalize CRLF/CR line endings to LF.
- Trim surrounding whitespace while preserving intentional internal line breaks.
- Normalized length: `10..2000` characters.

### 3.4 Internal note

- Required only by resolve.
- Trim surrounding whitespace and collapse repeated internal whitespace to one ASCII space.
- Normalized length: `1..1000` characters.
- Organizer-only and never sent to the Guest.
- Reopen retains the stored note. A later resolve replaces it with the newly supplied note.

### 3.5 Organizer search inputs

- `search`, `senderSearch` and `eventNameSearch` are independent and optional; each uses
  null/blank-to-null.
- Each value trims surrounding whitespace, collapses repeated whitespace and has normalized length
  `1..100` characters.
- `search` performs case-insensitive contains search only over normalized Feedback `message`.
- `senderSearch` performs case-insensitive contains search over `guestName`, `contactEmail` and the
  authenticated submitter's current full name.
- `eventNameSearch` performs case-insensitive contains search only over the current Event name and
  implies the `EVENT` target.
- When multiple search inputs are supplied, all supplied criteria must match the same Feedback.
- Search is Organizer-only. Public search/list endpoints do not exist.

## 4. Shared representations

### 4.1 FeedbackEventBriefResponse

```json
{
  "eventId": 7,
  "name": "Ngày hội Văn hóa Đọc 2027"
}
```

The name is current Event data, not a snapshot stored on General Feedback.

### 4.2 FeedbackUserBriefResponse

```json
{
  "userId": 31,
  "fullName": "Nguyễn Minh An"
}
```

This representation intentionally excludes username, account email, roles and account status.
`contactEmail` is shown only when the submitter explicitly supplied it on the Feedback command.

### 4.3 PublicFeedbackReceiptResponse

```json
{
  "feedbackId": 101,
  "receivedAt": "2026-10-31T08:20:00Z"
}
```

The receipt does not expose target data, contact data, status, submitter identity, internal note or
Organizer metadata. `receivedAt` maps to the committed `submittedAt` value.

### 4.4 OrganizerFeedbackListItemResponse

```json
{
  "feedbackId": 101,
  "targetType": "EVENT",
  "event": {
    "eventId": 7,
    "name": "Ngày hội Văn hóa Đọc 2027"
  },
  "messagePreview": "Không gian sự kiện rất dễ tìm và phần giao lưu tác giả được tổ chức tốt.",
  "status": "NEW",
  "submittedAt": "2026-10-31T08:20:00Z",
  "updatedAt": "2026-10-31T08:20:00Z"
}
```

Rules:

- For `BOOK_STREET`, `event` is `null`.
- `messagePreview` collapses all whitespace to one ASCII space and has a maximum length of 160
  characters. When truncation is required, the server returns the first 159 characters plus one
  ellipsis character.
- List items exclude Guest name, contact email, submitter identity, internal note and handler.
- `messagePreview` is derived at read time and is not a database column.

### 4.5 OrganizerFeedbackDetailResponse

```json
{
  "feedbackId": 101,
  "targetType": "EVENT",
  "event": {
    "eventId": 7,
    "name": "Ngày hội Văn hóa Đọc 2027"
  },
  "submitter": {
    "userId": 31,
    "fullName": "Nguyễn Minh An"
  },
  "guestName": "Minh An",
  "contactEmail": "minhan@example.com",
  "message": "Không gian sự kiện rất dễ tìm và phần giao lưu tác giả được tổ chức tốt.",
  "status": "IN_PROGRESS",
  "internalNote": null,
  "lastHandledBy": {
    "userId": 12,
    "fullName": "Ban Tổ chức Đường Sách"
  },
  "submittedAt": "2026-10-31T08:20:00Z",
  "updatedAt": "2026-10-31T08:25:00Z",
  "handlingStartedAt": "2026-10-31T08:25:00Z",
  "resolvedAt": null
}
```

Nullability:

- `event` is null for `BOOK_STREET`.
- `submitter` is null for an anonymous submission.
- `guestName` and `contactEmail` are independently nullable.
- `internalNote`, `lastHandledBy`, `handlingStartedAt` and `resolvedAt` follow the workflow-state
  invariants in the Physical ERD overlay.

The same detail representation is returned by successful Organizer transitions.

## 5. Public submission API

### 5.1 POST `/public/feedbacks`

Full path: `POST /api/v1/public/feedbacks`.

Security:

- Spring Security route authorization: `permitAll`.
- CSRF remains enabled and required.
- A valid authenticated Session, when present, is read optionally to associate the current User.
- The request never accepts a User identity.
- Public throttle in section 6 is mandatory.

Request: `CreatePublicFeedbackRequest`.

```json
{
  "targetType": "EVENT",
  "eventId": 7,
  "guestName": "  Minh   An  ",
  "contactEmail": " MINHAN@EXAMPLE.COM ",
  "message": "Không gian sự kiện rất dễ tìm và phần giao lưu tác giả được tổ chức tốt."
}
```

Fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `targetType` | enum | Yes | `BOOK_STREET` or `EVENT`. |
| `eventId` | 64-bit integer | Conditional | Required only for `EVENT`; forbidden for `BOOK_STREET`. |
| `guestName` | string/null | No | Section 3.1. |
| `contactEmail` | string/null | No | Section 3.2. |
| `message` | string | Yes | Section 3.3. |

The following examples are unknown/unsupported properties and return `400 UNKNOWN_FIELD`:

```text
rating, score, comments, phone, subject, source, targetName,
heritageId, boothId, locationId, facilityId, activityId,
userId, submittedByUserId, status, internalNote,
lastHandledByUserId, submittedAt, updatedAt, resolvedAt
```

Success:

- `201 Created` with `PublicFeedbackReceiptResponse`.
- No `Location` header is returned because no public Feedback detail resource exists.
- `Cache-Control: no-store`.

Persistence result:

```text
status                  = NEW
submittedAt             = backendNow
updatedAt               = backendNow
lastHandledByUserId     = null
handlingStartedAt       = null
resolvedAt              = null
internalNote            = null
```

`submittedByUserId` is the current authenticated User id when a valid Session exists; otherwise it
is null. Request-supplied Guest name/email do not replace or determine Session identity.

Errors:

- `400 MALFORMED_REQUEST`
- `400 UNKNOWN_FIELD`
- `400 INVALID_ENUM_VALUE`
- `403 CSRF_INVALID`
- `404 EVENT_NOT_FOUND`
- `422 VALIDATION_FAILED`
- `429 FEEDBACK_RATE_LIMITED`
- `500 INTERNAL_ERROR`
- `503 FEEDBACK_THROTTLE_UNAVAILABLE`

Target-shape and text validation use `422 VALIDATION_FAILED` with field errors. A non-public or
missing Event uses `404 EVENT_NOT_FOUND` after the request target shape is valid.

## 6. Public submission throttle

### 6.1 Frozen policy

The Sprint 08 throttle is:

```text
10 counted submission attempts per client key per 10-minute window
```

- Attempts `1..10` within the active window may proceed.
- Attempt `11` and later return `429 FEEDBACK_RATE_LIMITED` until the key expires.
- The window starts with the first counted attempt and expires exactly 600 seconds later.
- A counted attempt is a request that passed CSRF and JSON binding and reached the Feedback
  submission service. Domain/field validation failures and Event-not-found probes count.
- CSRF failures and malformed JSON rejected before service invocation do not count.
- Throttling occurs before General Feedback persistence.

### 6.2 Client key

```text
valid authenticated Session -> "user:" + current userId
anonymous request           -> "anon:" + HMAC-SHA256(secret, canonical client IP)
```

- Session id is never used as the key.
- Raw client IP is held only in request memory long enough to compute the HMAC and is never stored
  in PostgreSQL, limiter keys or application logs.
- The HMAC secret is deployment configuration, never committed source/default/demo data.
- By default the canonical address is the servlet remote address and untrusted forwarded headers
  are ignored.
- Forwarded client addresses may be used only when the deployment explicitly enables Spring
  forwarded-header handling behind a configured trusted reverse proxy. The application must never
  directly trust arbitrary `X-Forwarded-For` input.

### 6.3 Bounded in-memory algorithm and failure behavior

- Redis remains dedicated to Spring Session and is not used for Feedback throttle counters.
- One backend process stores at most 5,000 active client-key windows in bounded volatile memory.
- Each window stores its first-attempt time and count and expires 600 seconds after that first
  counted attempt. Increment must not extend the original expiry.
- Window creation/increment is atomic for one client key under concurrent requests.
- Expired entries are removed before a new key is rejected for capacity.
- A blocked response includes `Retry-After` as the ceiling of the remaining window duration in
  seconds.
- If 5,000 unexpired keys already exist or the limiter cannot safely evaluate a request, submission
  fails closed with `503 FEEDBACK_THROTTLE_UNAVAILABLE`; no Feedback row is written.
- Restarting the backend clears all counters. Multiple backend instances enforce separate local
  limits; distributed production-grade throttling is explicitly outside Sprint 08.
- No database table, Redis counter, scheduled cleanup job, CAPTCHA or third-party abuse service is
  introduced.

Example `429` response:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 214
Cache-Control: no-store
Content-Type: application/json
```

```json
{
  "code": "FEEDBACK_RATE_LIMITED",
  "message": "Bạn đã gửi quá nhiều góp ý. Vui lòng thử lại sau.",
  "fieldErrors": [],
  "timestamp": "2026-10-31T08:20:00Z",
  "path": "/api/v1/public/feedbacks"
}
```

## 7. Organizer query APIs

All Organizer endpoints:

- require effective `ROLE_ORGANIZER` from the authenticated Session;
- require a verified email under the existing role/session rule;
- do not grant access merely because the Session has `ROLE_ADMIN` without `ROLE_ORGANIZER`;
- are protected by method-level `hasRole('ORGANIZER')` in addition to route configuration;
- use one shared queue and never filter by Event owner;
- return `Cache-Control: no-store`.

### 7.1 GET `/organizer/feedbacks`

Full path: `GET /api/v1/organizer/feedbacks`.

Query parameters:

| Parameter | Default | Rules |
| --- | --- | --- |
| `page` | `0` | Integer, minimum 0. |
| `size` | `20` | Integer, `1..100`. |
| `sort` | `submittedAt,desc` | Closed allowlist below. |
| `search` | absent | Feedback message search from Section 3.5. |
| `senderSearch` | absent | Guest/account name or contact email search from Section 3.5. |
| `eventNameSearch` | absent | Event name search from Section 3.5; implies `EVENT`. |
| `targetType` | absent | `BOOK_STREET` or `EVENT`. |
| `eventId` | absent | Positive 64-bit integer; implies `EVENT`. |
| `status` | absent | `NEW`, `IN_PROGRESS` or `RESOLVED`. |

Allowed sort values:

```text
submittedAt,desc -> submittedAt DESC, generalFeedbackId DESC
submittedAt,asc  -> submittedAt ASC,  generalFeedbackId ASC
```

Rules:

- `eventId` or `eventNameSearch` plus `targetType=BOOK_STREET` returns `400 INVALID_FILTER`.
- An unknown positive `eventId` filter returns a successful empty page, not `404`.
- A blank search input normalizes to no filter for that field.
- Invalid enum, page, size, sort or filter returns its stable `400` error.
- Query does not mutate lifecycle state or timestamps.

Success: `200` paged `OrganizerFeedbackListItemResponse`.

Errors:

- `400 INVALID_PAGE`
- `400 INVALID_SIZE`
- `400 INVALID_SORT`
- `400 INVALID_FILTER`
- `400 INVALID_ENUM_VALUE`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`

### 7.2 GET `/organizer/feedbacks/{feedbackId}`

Full path: `GET /api/v1/organizer/feedbacks/{feedbackId}`.

Success: `200 OrganizerFeedbackDetailResponse`.

Errors:

- `400 MALFORMED_REQUEST` for a syntactically invalid/non-positive id.
- `401 AUTHENTICATION_REQUIRED`.
- `403 ACCESS_DENIED`.
- `404 FEEDBACK_NOT_FOUND`.

The read is side-effect free. Status, note, actor and timestamps remain unchanged.

## 8. Organizer transition APIs

All transition APIs require CSRF and return the committed
`OrganizerFeedbackDetailResponse` on success.

### 8.1 POST `/organizer/feedbacks/{feedbackId}/start-handling`

Full path: `POST /api/v1/organizer/feedbacks/{feedbackId}/start-handling`.

Request body: none. A nonempty JSON object with properties returns `400 UNKNOWN_FIELD`.

Required source state: `NEW`.

Atomic success mutation:

```text
status                  = IN_PROGRESS
lastHandledByUserId     = current Organizer
handlingStartedAt       = backendNow
updatedAt               = backendNow
resolvedAt              = null
internalNote            = null
```

Success: `200 OrganizerFeedbackDetailResponse`.

### 8.2 POST `/organizer/feedbacks/{feedbackId}/resolve`

Full path: `POST /api/v1/organizer/feedbacks/{feedbackId}/resolve`.

Request: `ResolveFeedbackRequest`.

```json
{
  "internalNote": "Đã chuyển góp ý cho nhóm vận hành sự kiện và hoàn tất kiểm tra khu vực."
}
```

Required source state: `IN_PROGRESS`.

Atomic success mutation:

```text
status                  = RESOLVED
internalNote            = normalized request note
lastHandledByUserId     = current Organizer
resolvedAt              = backendNow
updatedAt               = backendNow
handlingStartedAt       = preserved
```

Success: `200 OrganizerFeedbackDetailResponse`.

Blank, missing or out-of-range note returns `422 VALIDATION_FAILED` on `internalNote` and leaves
the row unchanged.

### 8.3 POST `/organizer/feedbacks/{feedbackId}/reopen`

Full path: `POST /api/v1/organizer/feedbacks/{feedbackId}/reopen`.

Request body: none. A nonempty JSON object with properties returns `400 UNKNOWN_FIELD`.

Required source state: `RESOLVED`.

Atomic success mutation:

```text
status                  = IN_PROGRESS
lastHandledByUserId     = current Organizer
handlingStartedAt       = backendNow
resolvedAt              = null
updatedAt               = backendNow
internalNote            = preserved
message/target/contact  = preserved
```

Success: `200 OrganizerFeedbackDetailResponse`.

### 8.4 Common transition errors

- `400 MALFORMED_REQUEST`
- `400 UNKNOWN_FIELD`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `403 CSRF_INVALID`
- `404 FEEDBACK_NOT_FOUND`
- `409 FEEDBACK_TRANSITION_CONFLICT`
- `422 VALIDATION_FAILED` for resolve note
- `500 INTERNAL_ERROR`

`FEEDBACK_TRANSITION_CONFLICT` is intentionally generic. The detail may be reloaded after conflict
to obtain the currently committed state. The rejected request never overwrites actor, note or
timestamps.

## 9. Canonical error codes

### 9.1 Common request and security

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
- `INTERNAL_ERROR` — 500

### 9.2 Feedback-specific

- `EVENT_NOT_FOUND` — 404
- `FEEDBACK_NOT_FOUND` — 404
- `FEEDBACK_TRANSITION_CONFLICT` — 409
- `FEEDBACK_RATE_LIMITED` — 429
- `FEEDBACK_THROTTLE_UNAVAILABLE` — 503

Field validation uses `fieldErrors.field` values from this closed set where applicable:

```text
targetType
eventId
guestName
contactEmail
message
internalNote
search
senderSearch
eventNameSearch
```

No error response includes contact values, internal notes, private Event facts, User account data,
Session/CSRF values, throttle keys, client addresses, SQL text or constraint names.

## 10. Transaction and locking contract

### 10.1 Public create

Order:

```text
CSRF
  -> JSON binding/unknown-field validation
  -> bounded in-memory throttle
  -> field and exact-target validation
  -> public Event eligibility lookup when EVENT
  -> optional current Session User association
  -> GeneralFeedback insert
  -> flush/commit
  -> receipt response
```

- Event eligibility and insertion occur in one database transaction.
- A foreign-key or check-constraint failure cannot produce `201`.
- No email, Notification, reply or after-commit delivery event is published.

### 10.2 Organizer transition

Order:

```text
authorized Session Organizer
  -> GeneralFeedback SELECT FOR UPDATE
  -> current-status recheck
  -> note validation when resolving
  -> actor/status/timestamp update
  -> flush/commit
  -> detail response
```

- The row lock is the serialization boundary for concurrent transitions.
- The current Organizer id comes only from Security context.
- One `backendNow` value is reused for all timestamps changed by one transition.
- If two requests race from the same source state, at most one succeeds. The other rechecks the
  committed state and returns `409 FEEDBACK_TRANSITION_CONFLICT`.
- Reads never acquire a write lock merely to view Feedback.

## 11. Persistence mapping

The API maps to `general_feedbacks` exactly as defined in
`SPRINT_08_GENERAL_FEEDBACK_PHYSICAL_ERD_OVERLAY.md`:

| API concept | Physical field |
| --- | --- |
| `feedbackId` | `general_feedback_id` |
| authenticated submitter | `submitted_by_user_id` |
| `targetType` | `target_type` |
| `eventId` | `event_id` |
| `guestName` | `guest_name` |
| `contactEmail` | `contact_email` |
| `message` | `message` |
| `status` | `status` |
| `internalNote` | `internal_note` |
| latest Organizer | `last_handled_by_user_id` |
| `handlingStartedAt` | `handling_started_at` |
| `receivedAt`/`submittedAt` | `submitted_at` |
| `updatedAt` | `updated_at` |
| `resolvedAt` | `resolved_at` |

The next migration is expected to be `V14` only if that version remains free immediately before
implementation. V1 through V13 are immutable. No production/demo Feedback rows belong in the
schema migration.

## 12. Security and privacy obligations

- `POST /public/feedbacks` must be explicitly `permitAll` but never added to the CSRF ignore list.
- Organizer controller methods require `hasRole('ORGANIZER')`; the broader existing Organizer path
  matcher must not accidentally grant Admin-only Sessions access.
- Optional authenticated identity is obtained without turning the public route into
  `authenticated()`.
- Public receipt and every public error omit contact and management fields.
- Organizer list omits direct contact fields; only authorized detail returns them.
- Logging filters/redaction must cover `contactEmail`, `internalNote`, Session/CSRF headers and the
  raw address used for throttle hashing.
- Swagger/OpenAPI examples use synthetic contact data only.
- No Feedback data is written to local browser storage as a mock/offline queue.
- No hard-delete endpoint or repository deletion path is introduced.

## 13. Frontend integration obligations

### 13.1 Landing Page

- Replace the current unsupported payload at `publicApi.submitFeedback` with
  `CreatePublicFeedbackRequest` without keeping a legacy fallback.
- Use `POST /public/feedbacks` through the shared API client so credentials and CSRF retry are
  preserved.
- Remove rating/star, Heritage and arbitrary `targetName/source` inputs.
- Offer `BOOK_STREET` plus `PUBLISHED`/`ONGOING` choices from the existing public Event list; a
  contextually known `COMPLETED`/`CANCELLED` id may be preselected only after public-detail
  resolution, without adding a new target-discovery endpoint.
- Add optional Guest name and email inputs and required message input with the contract limits.
- Render `201`, field validation, `EVENT_NOT_FOUND`, CSRF retry failure, `429` with retry guidance,
  network failure and server failure as distinct real states.
- Disable submission while pending and never show success before the `201` response.
- Feedback QR remains navigation to `/#gop-y`; it carries no identity or target secret.

### 13.2 Organizer portal

- Replace `organizerApi.getFeedbacks()` empty mock and unsupported `updateFeedback()` with the six
  contract operations as applicable.
- Replace legacy lowercase statuses `new/in_progress/responded/closed` with the closed API enum.
- Remove star rendering, Heritage/Booth target assumptions and “reply sent to reader” wording.
- Present separate message, sender/email and Event-name search controls and apply their predicates
  server-side together with page/filter/sort instead of filtering a full local array.
- Fetch detail before showing contact/internal handling data.
- Show exactly one legal action for the current state: start, resolve or reopen.
- Clearly label resolve note as internal and not sent to the Guest.
- On `409`, reload detail and queue state rather than applying an optimistic fabricated result.
- Preserve genuine loading, empty, forbidden and retryable failure states on desktop/mobile.

## 14. Acceptance Criteria traceability

### 14.1 Guest/Public

| Acceptance Criteria | Contract coverage |
| --- | --- |
| `AC-G04-S8-01` | Sections 4.3 and 5.1 anonymous `BOOK_STREET` create/receipt. |
| `AC-G04-S8-02` | Sections 2.2 and 5.1 public Event eligibility. |
| `AC-G04-S8-03` | Sections 2.2, 3 and 5.1 exact target validation. |
| `AC-G04-S8-04` | `404 EVENT_NOT_FOUND` non-disclosure rule. |
| `AC-G04-S8-05` | Section 3 normalization and bounds. |
| `AC-G04-S8-06` | Section 5.1 unknown/unsupported field list. |
| `AC-G04-S8-07` | Section 5.1 optional trusted Session association. |
| `AC-G04-S8-08` | Section 5.1 initial durable state. |
| `AC-G04-S8-09` | Sections 4.3, 9 and 12 privacy. |
| `AC-G04-S8-10` | Sections 5.1 and 6 CSRF/throttle. |
| `AC-G04-S8-11` | Sections 1.4 and 10.1 commit-before-success. |
| `AC-G04-S8-12` | Section 13.1 real Landing Page integration. |

### 14.2 Organizer

| Acceptance Criteria | Contract coverage |
| --- | --- |
| `AC-O-S8-01` | Section 7 shared queue without Event ownership. |
| `AC-O-S8-02` | Sections 7, 9 and 12 authority boundary. |
| `AC-O-S8-03` | Sections 1.1 and 7.1 pagination/filter/count/sort. |
| `AC-O-S8-04` | Sections 4.5 and 7.2 authorized detail. |
| `AC-O-S8-05` | Sections 7.2 and 10.2 read-only detail. |
| `AC-O-S8-06` | Section 8.1 start-handling mutation. |
| `AC-O-S8-07` | Sections 3.4 and 8.2 resolve/note mutation. |
| `AC-O-S8-08` | Section 8.3 reopen preservation. |
| `AC-O-S8-09` | Sections 8.4 and 10.2 stale transition conflict. |
| `AC-O-S8-10` | Sections 1, 10 and 12 no delete/delivery. |
| `AC-O-S8-11` | Section 13.2 real Organizer integration. |
| `AC-O-S8-12` | Sections 7 and 12 Feedback-only shared authorization. |

### 14.3 Schema and regression

| Acceptance Criteria | Contract coverage |
| --- | --- |
| `AC-X-S8-01` | Section 11 migration baseline and Hibernate mapping. |
| `AC-X-S8-02` | Sections 2, 10 and 11 database invariant mapping. |
| `AC-X-S8-03` | Sections 1, 12 and 15 compatibility boundaries. |
| `AC-X-S8-04` | Section 16 required verification. |

## 15. Compatibility and explicit exclusions

Sprint 08 must not change:

- Activity Rating endpoints, score/comment behavior or invalidation lifecycle;
- Event public visibility and existing Event owner mutation rules;
- Participant, Partner, Admin or existing Organizer API authorization;
- server-side Session, Redis Session storage or CSRF cookie/header behavior;
- Sprint 7 BoothVisit, Points, Badge and Notification behavior.

Explicitly excluded:

- `HERITAGE` Feedback persistence, API or UI because Heritage is not a General Feedback target.
- Location, Booth, Facility or Activity General Feedback targets;
- Guest reply/status lookup, email, SMS, push or Notification delivery;
- Feedback hard delete, edit-after-submit or public listing;
- transition-history table;
- report/summary/statistics endpoints;
- Admin Feedback APIs/UI;
- CAPTCHA, third-party moderation or distributed abuse platform;
- client-selected submitter, status, actor or timestamps.

## 16. Required verification

Focused implementation evidence must cover:

- anonymous `BOOK_STREET` success and optional authenticated association;
- `EVENT` success for every eligible status and safe Draft/missing rejection;
- exact target, unknown-field and all normalized input boundaries;
- CSRF rejection and one client-side token refresh retry;
- throttle attempts 10/11, expiry/`Retry-After`, key separation, 5,000-key capacity and fail-closed
  behavior;
- public receipt/log privacy and absence of public Feedback reads;
- Organizer-only shared list, identical count/filter predicate and stable ordering;
- list search/target/Event/status filters and successful empty page;
- authorized detail and read-without-mutation;
- every legal transition and every illegal/repeated direct transition;
- two-Organizer stale transition race with one winner;
- resolve note validation and reopen timestamp/note behavior;
- clean migration, V13 upgrade and Hibernate validation;
- Landing Page and Organizer focused desktop/mobile browser scenarios;
- Activity Rating, Event ownership, Session/CSRF and Sprint 7 reward regression checks.

No full historical Playwright suite is required. Focused Sprint 08 browser tests plus affected
shared smoke checks are mandatory; backend/frontend CI remains required.

## 17. Contract review gate

Before migration or application implementation begins, reviewers must confirm:

- all six routes and DTO field names;
- `201` receipt without a public Location/detail resource;
- `10 attempts / 10 minutes` throttle, client-key and trusted-proxy behavior;
- exact normalization limits and unknown-field rejection;
- public Event eligibility including completed/cancelled detail links;
- Organizer-only shared queue and Admin-without-Organizer denial;
- page/search/filter/sort semantics;
- state-sensitive action endpoints and generic conflict behavior;
- no delete, Guest delivery, report or Heritage scope;
- complete traceability to all 28 Sprint 08 Acceptance Criteria.

Approval of this contract and the remaining one-developer delivery/ownership document is followed
by the requested full cross-document audit. No Sprint 08 code or migration should begin before that
audit reports a clean implementation baseline.
