# Sprint 09 Heritage API Contract

> Status: `APPROVED - FROZEN FOR IMPLEMENTATION`.
>
> This contract freezes the approved HTTP, DTO, validation, security, concurrency, persistence,
> and frontend integration boundaries for Sprint 09 Heritage. Semantic changes require documentation
> review before implementation changes.
>
> Sources of truth, in precedence order: `docs/requirements/05_Business_Rules.md`,
> `docs/requirements/06_Use_Case_List.md`, `docs/sprints/sprint-09.md`,
> `docs/use-cases/sprint-09-use-case-specifications.md`, the current Physical ERD plus
> `docs/design/SPRINT_09_HERITAGE_PHYSICAL_ERD_OVERLAY.md`, then this contract.

## 1. Scope and conventions

- Base path: `/api/v1`.
- Authentication uses the existing Spring Security server-side Session stored in Redis.
- Every Organizer mutation requires credentials mode and a valid CSRF token.
- Public Heritage reads require no Session and no CSRF token.
- JSON uses camelCase.
- Timestamps are ISO-8601 UTC instants.
- PostgreSQL microsecond precision is preserved through Java `Instant`, JSON, and the browser.
- Backend `Clock` owns every persisted timestamp.
- UI renders timestamps in `Asia/Ho_Chi_Minh` when a time is displayed.
- Unknown JSON properties are rejected.
- IDs are positive signed 64-bit integers.
- Closed enums use the uppercase values in this contract.
- Optional text that is absent or whitespace-only normalizes to null when the field is supplied.
- Successful mutation responses represent committed durable state.
- Every Heritage response uses `Cache-Control: no-store` so archive takes effect without an API cache
  exposing previously published content.
- No Heritage response or request introduces Feedback, ownership, QR presentation/persistence, or analytics.
- Organizer image upload is limited to validated local JPG, PNG, and WebP files up to 5 MB.

The amended Heritage contract defines thirteen backend operations:

```text
GET    /heritages
GET    /heritages/{publicCode}
GET    /organizer/heritages
GET    /organizer/heritages/{heritageContentId}
POST   /organizer/heritages
PATCH  /organizer/heritages/{heritageContentId}
POST   /organizer/heritages/{heritageContentId}/publish
POST   /organizer/heritages/{heritageContentId}/archive
POST   /organizer/heritages/{heritageContentId}/republish
DELETE /organizer/heritages/{heritageContentId}
POST   /organizer/heritage-images
DELETE /organizer/heritage-images/{fileName}
GET    /assets/heritage/uploads/{fileName}
```

There is no Admin Heritage API, public content mutation, bulk operation, Feedback target, QR endpoint,
analytics endpoint, external storage-provider operation, or mock fallback operation.

### 1.1 Common paged response

Both public and Organizer list operations use the existing page representation:

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

- `page` is zero-based and must be at least 0.
- `size` must be from 1 through 100.
- Default values are `page=0` and `size=20`.
- Empty valid queries return `200` with empty content and correct metadata.
- Content and count queries use the same visibility, authority, search, and filter predicates.
- No endpoint fabricates placeholder rows.
- A requested page beyond the final page returns a successful empty `content` array with the real
  total metadata.

### 1.2 Common error shape

Sprint 09 reuses the existing backend `ApiErrorResponse`. HTTP status is not duplicated in the body.

```json
{
  "code": "HERITAGE_STALE_WRITE",
  "message": "Nội dung di sản đã được cập nhật. Vui lòng tải lại dữ liệu.",
  "fieldErrors": [],
  "timestamp": "2026-11-01T08:20:00Z",
  "path": "/api/v1/organizer/heritages/21"
}
```

Field validation uses the existing two-field representation:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ.",
  "fieldErrors": [
    {
      "field": "content",
      "message": "Nội dung phải có từ 20 đến 20000 ký tự."
    }
  ],
  "timestamp": "2026-11-01T08:20:00Z",
  "path": "/api/v1/organizer/heritages"
}
```

Clients branch on HTTP status and stable `code`, never on localized `message` text.

### 1.3 HTTP classification

- `400 Bad Request` covers malformed JSON, unknown JSON properties, invalid enum, page, size, sort,
  filter, unsupported query parameter, and syntactically invalid Organizer identity.
- `401 Unauthorized` means the Organizer Session is absent or expired.
- `403 Forbidden` means effective verified Organizer authority is missing or CSRF proof is invalid.
- `404 Not Found` covers an unknown Organizer record and the public-safe result for a private,
  unknown, or malformed public code.
- `409 Conflict` covers an exhausted generated-code namespace, stale write, illegal lifecycle transition,
  ineligible hard delete, and deletion of a referenced uploaded image.
- `422 Unprocessable Entity` covers bound request fields that fail content, URI, relationship, or
  concurrency-token validation.
- `500 Internal Server Error` covers an unexpected persistence or system failure.

### 1.4 Mutation and retry semantics

- Create accepts no `Idempotency-Key`. The UI disables duplicate submission while one request is pending.
- A second create whose title yields an existing base code receives the next available numeric suffix.
- Update, publish, archive, republish, and delete are state-sensitive and concurrency-sensitive.
- Repeating a successful command with the old token returns `409 HERITAGE_STALE_WRITE`.
- Repeating a lifecycle command with the current token but an illegal current state returns
  `409 HERITAGE_TRANSITION_CONFLICT`.
- Organizer GET operations and all public operations never mutate state.
- If a mutation response is lost, the client reloads durable data and never fabricates success.
- Database failures never return a successful DTO or delete status.

## 2. Closed domain values

### 2.1 Heritage status

```text
HeritageContentStatus = DRAFT | PUBLISHED | ARCHIVED
```

No lowercase alias is accepted. `HIDDEN`, `ACTIVE`, `INACTIVE`, `DELETED`, review, and approval states
are not part of Sprint 09.

### 2.2 Legal transitions

```text
DRAFT     -> PUBLISHED : publish
PUBLISHED -> ARCHIVED  : archive
ARCHIVED  -> PUBLISHED : republish
```

No other source and action pair is valid. Content update does not change status. List and detail reads
never perform an implicit transition.

### 2.3 Identity boundary

- Organizer operations address `heritageContentId`.
- Public detail addresses canonical `publicCode`.
- `publicCode` is immutable after create.
- Public responses never include `heritageContentId`, `createdAt`, `updatedAt`, or another management
  concurrency value.
- Organizer list and detail include `updatedAt` so the client can send the exact token on mutations.

## 3. Normalization and validation

Normalization occurs before length and format validation.

### 3.1 Public code

- Server-generated from the normalized title; it is never accepted from Organizer input.
- Vietnamese diacritics are removed before uppercase conversion.
- Non-alphanumeric runs become one hyphen and surrounding hyphens are removed.
- A numeric suffix (`-2`, `-3`, and so on) is added when required for uniqueness.
- Normalized length is from 3 through 100 characters.
- Must match `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`.
- Must be unique after canonical normalization.
- Cannot be supplied by update or lifecycle requests.

Generated examples:

```text
Normalized title                  Canonical stored value
Bưu điện TP HCM                   BUU-DIEN-TP-HCM
Bưu điện TP HCM (second record)   BUU-DIEN-TP-HCM-2
Đường Sách Nguyễn Văn Bình        DUONG-SACH-NGUYEN-VAN-BINH
```

The generated value is validated against the unchanged V15 canonical constraint before persistence.

### 3.2 Title

- Required on create.
- Optional on partial update, but null is invalid when supplied.
- Trim surrounding whitespace.
- Collapse repeated horizontal whitespace to one ASCII space.
- Normalized length is from 2 through 200 characters.

### 3.3 Summary

- Optional and nullable.
- Trim surrounding whitespace.
- Blank input normalizes to null.
- Normalized non-null length is from 1 through 1000 characters.

### 3.4 Content

- Required on create.
- Optional on partial update, but null is invalid when supplied.
- Normalize CRLF and CR line endings to LF.
- Trim surrounding whitespace while preserving intentional internal line breaks.
- Normalized length is from 20 through 20000 characters.
- Stored and returned as plain text.

### 3.5 Image URL

- Optional and nullable.
- Trim surrounding whitespace.
- Blank input normalizes to null.
- Normalized non-null length is from 1 through 2048 characters.
- An absolute URL must use `http` or `https` and contain a nonblank host.
- A local public asset path must begin with `/assets/heritage/` and have a nonempty suffix.
- A local path cannot contain dot segments, backslashes, or control characters.
- Protocol-relative, data, blob, filesystem, raw-byte, base64, script, and unsupported schemes fail
  validation.
- The backend stores the value but never fetches the remote resource.

### 3.6 Location text

- Optional and nullable.
- Trim surrounding whitespace.
- Blank input normalizes to null.
- Normalized non-null length is from 1 through 255 characters.
- This is display text and never becomes a Location or Map relationship.

### 3.7 Organizer search

- `search` is optional.
- Trim surrounding whitespace and collapse repeated whitespace to one ASCII space.
- Blank input normalizes to no search predicate.
- Normalized non-null length is from 1 through 100 characters.
- A normalized value longer than 100 characters returns `400 INVALID_FILTER`.
- Search is case-insensitive contains matching across `publicCode`, `title`, and `locationText`.
- SQL wildcard characters in caller input are treated as literal characters.
- Search combines with status by logical AND.

### 3.8 Concurrency timestamp

- `expectedUpdatedAt` is required for update, publish, archive, republish, and delete.
- The value is the exact raw `updatedAt` string returned by the latest Organizer list or detail response.
- It must parse as an ISO-8601 instant without losing the persisted PostgreSQL precision.
- Missing or malformed input returns `422 VALIDATION_FAILED` on `expectedUpdatedAt`.
- A valid instant that does not equal the current persisted value returns
  `409 HERITAGE_STALE_WRITE`.
- The browser must not round-trip the token through a lower-precision date formatter.

### 3.9 Unknown and server-owned fields

Unknown JSON properties return `400 UNKNOWN_FIELD`. In particular, callers cannot supply:

```text
heritageContentId, publicCode, status, publishedAt, createdAt, updatedAt,
createdBy, updatedBy, ownerId, reviewerId, approverId,
titleEn, summaryEn, contentEn, category, period, province,
latitude, longitude, mapX, mapY, imageBytes,
qrToken, qrStatus, scanCount, viewCount, feedbackId
```

`expectedUpdatedAt` is accepted only where this contract explicitly requires it.

## 4. Shared representations

### 4.1 PublicHeritageListItemResponse

```json
{
  "publicCode": "BUU-DIEN-TP-HCM",
  "title": "Bưu điện Thành phố Hồ Chí Minh",
  "summary": "Một công trình kiến trúc tiêu biểu bên cạnh Đường Sách.",
  "imageUrl": "/assets/heritage/buu-dien-tp-hcm.webp",
  "locationText": "Công xã Paris, Quận 1",
  "publishedAt": "2026-11-01T07:30:00Z"
}
```

Nullability:

- `summary`, `imageUrl`, and `locationText` may be null.
- `publicCode`, `title`, and `publishedAt` are never null.
- Full `content` is intentionally omitted from list items.
- No internal identity or management timestamp is returned.

### 4.2 PublicHeritageDetailResponse

```json
{
  "publicCode": "BUU-DIEN-TP-HCM",
  "title": "Bưu điện Thành phố Hồ Chí Minh",
  "summary": "Một công trình kiến trúc tiêu biểu bên cạnh Đường Sách.",
  "content": "Công trình được xây dựng vào cuối thế kỷ XIX và là một phần quen thuộc của không gian trung tâm thành phố.",
  "imageUrl": "/assets/heritage/buu-dien-tp-hcm.webp",
  "locationText": "Công xã Paris, Quận 1",
  "publishedAt": "2026-11-01T07:30:00Z"
}
```

The same nullability rules apply. Public detail adds required `content` and still exposes no internal
identity, status, created time, updated time, owner, or concurrency token.

### 4.3 OrganizerHeritageListItemResponse

```json
{
  "heritageContentId": 21,
  "publicCode": "BUU-DIEN-TP-HCM",
  "title": "Bưu điện Thành phố Hồ Chí Minh",
  "summary": "Một công trình kiến trúc tiêu biểu bên cạnh Đường Sách.",
  "imageUrl": "/assets/heritage/buu-dien-tp-hcm.webp",
  "locationText": "Công xã Paris, Quận 1",
  "status": "PUBLISHED",
  "publishedAt": "2026-11-01T07:30:00Z",
  "createdAt": "2026-11-01T07:00:00Z",
  "updatedAt": "2026-11-01T08:15:30.123456Z"
}
```

Rules:

- `summary`, `imageUrl`, `locationText`, and `publishedAt` follow schema nullability.
- `publishedAt` is null only for `DRAFT`.
- `content` is omitted so list paging does not transfer up to 20000 characters per row.
- `updatedAt` is the exact token accepted by Organizer mutations.

### 4.4 OrganizerHeritageDetailResponse

```json
{
  "heritageContentId": 21,
  "publicCode": "BUU-DIEN-TP-HCM",
  "title": "Bưu điện Thành phố Hồ Chí Minh",
  "summary": "Một công trình kiến trúc tiêu biểu bên cạnh Đường Sách.",
  "content": "Công trình được xây dựng vào cuối thế kỷ XIX và là một phần quen thuộc của không gian trung tâm thành phố.",
  "imageUrl": "/assets/heritage/buu-dien-tp-hcm.webp",
  "locationText": "Công xã Paris, Quận 1",
  "status": "PUBLISHED",
  "publishedAt": "2026-11-01T07:30:00Z",
  "createdAt": "2026-11-01T07:00:00Z",
  "updatedAt": "2026-11-01T08:15:30.123456Z"
}
```

This is the canonical response after successful create, update, publish, archive, and republish.

### 4.5 Heritage page responses

Public list returns `HeritagePageResponse<PublicHeritageListItemResponse>`.

Organizer list returns `HeritagePageResponse<OrganizerHeritageListItemResponse>`.

The wire shape is exactly the common page shape in section 1.1.

## 5. Public APIs

### 5.1 GET `/heritages`

Full path: `GET /api/v1/heritages`.

Security:

- Spring Security route authorization is `permitAll`.
- No Session or CSRF token is required.
- A present Session does not change response visibility.

Accepted query parameters:

| Parameter | Default | Rules |
| --- | --- | --- |
| `page` | `0` | Integer, minimum 0. |
| `size` | `20` | Integer from 1 through 100. |

Any unsupported query parameter returns `400 INVALID_FILTER`.

Database predicate and ordering:

```text
status = PUBLISHED
ORDER BY published_at DESC, heritage_content_id DESC
```

Success:

- `200 HeritagePageResponse<PublicHeritageListItemResponse>`.
- Empty published collection returns an empty page.
- `Cache-Control: no-store`.

Errors:

- `400 INVALID_PAGE`
- `400 INVALID_SIZE`
- `400 INVALID_FILTER`
- `500 INTERNAL_ERROR`

No public search, status filter, alternate sort, or mock fallback is added in Sprint 09.

### 5.2 GET `/heritages/{publicCode}`

Full path: `GET /api/v1/heritages/{publicCode}`.

The decoded path segment must already be canonical uppercase and match the public-code format. The backend
does not uppercase or redirect a public detail path.

Database predicate:

```text
public_code = requested canonical publicCode
AND status = PUBLISHED
```

Success:

- `200 PublicHeritageDetailResponse`.
- `Cache-Control: no-store`.

Errors:

- `404 HERITAGE_NOT_FOUND`
- `500 INTERNAL_ERROR`

Canonical codes belonging to `DRAFT` or `ARCHIVED`, unknown codes, empty or noncanonical decoded values,
and decoded values that fail format validation all return the same `404 HERITAGE_NOT_FOUND` body. The
response never reveals whether a private row exists.

Malformed URL encoding rejected by the web container may return the platform `400` before controller
dispatch. No Heritage data is included in that response.

## 6. Organizer security boundary

Every Organizer Heritage endpoint:

- requires an authenticated active account with effective verified `ROLE_ORGANIZER`
- rejects Admin-only, Participant-only, Partner-only, disabled, and unverified accounts
- accepts a multi-role account when effective verified `ROLE_ORGANIZER` is present
- uses the current Security principal and never accepts a caller-selected User or role
- manages one shared collection without Event or Organizer ownership filtering
- uses method-level `hasRole('ORGANIZER')`
- requires a specific `hasRole('ORGANIZER')` route matcher before the broader existing Organizer matcher
- returns `Cache-Control: no-store`

Organizer mutations require the shared CSRF cookie and header flow. Missing or invalid CSRF returns
`403 CSRF_INVALID`. Organizer GET operations do not require CSRF and never mutate state.

## 7. Organizer query APIs

### 7.1 GET `/organizer/heritages`

Full path: `GET /api/v1/organizer/heritages`.

Accepted query parameters:

| Parameter | Default | Rules |
| --- | --- | --- |
| `page` | `0` | Integer, minimum 0. |
| `size` | `20` | Integer from 1 through 100. |
| `sort` | `updatedAt,desc` | Closed allowlist below. |
| `search` | absent | Section 3.7. |
| `status` | absent | `DRAFT`, `PUBLISHED`, or `ARCHIVED`. |

Allowed sort values:

```text
updatedAt,desc -> updated_at DESC, heritage_content_id DESC
updatedAt,asc  -> updated_at ASC,  heritage_content_id ASC
title,asc      -> LOWER(title) ASC,  heritage_content_id ASC
title,desc     -> LOWER(title) DESC, heritage_content_id DESC
```

Rules:

- Search and status are optional and combine by logical AND.
- Blank search normalizes to no search predicate.
- A valid page beyond the final page returns a successful empty page.
- Unsupported query parameters return `400 INVALID_FILTER`.
- Query does not mutate status or timestamps.

Success:

- `200 HeritagePageResponse<OrganizerHeritageListItemResponse>`.

Errors:

- `400 INVALID_PAGE`
- `400 INVALID_SIZE`
- `400 INVALID_SORT`
- `400 INVALID_FILTER`
- `400 INVALID_ENUM_VALUE`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `500 INTERNAL_ERROR`

### 7.2 GET `/organizer/heritages/{heritageContentId}`

Full path: `GET /api/v1/organizer/heritages/{heritageContentId}`.

Success:

- `200 OrganizerHeritageDetailResponse`.

Errors:

- `400 MALFORMED_REQUEST` for a syntactically invalid or non-positive identity
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `404 HERITAGE_NOT_FOUND`
- `500 INTERNAL_ERROR`

The read is side-effect free. Content, status, publication time, and update time remain unchanged.

## 8. Organizer create and content update APIs

### 8.1 POST `/organizer/heritages`

Full path: `POST /api/v1/organizer/heritages`.

Request: `CreateHeritageRequest`.

```json
{
  "title": "Bưu điện Thành phố Hồ Chí Minh",
  "summary": "Một công trình kiến trúc tiêu biểu bên cạnh Đường Sách.",
  "content": "Công trình được xây dựng vào cuối thế kỷ XIX và là một phần quen thuộc của không gian trung tâm thành phố.",
  "imageUrl": "/assets/heritage/buu-dien-tp-hcm.webp",
  "locationText": "Công xã Paris, Quận 1"
}
```

Fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `title` | string | Yes | Section 3.2. |
| `summary` | string or null | No | Section 3.3. |
| `content` | string | Yes | Section 3.4. |
| `imageUrl` | string or null | No | Section 3.5. |
| `locationText` | string or null | No | Section 3.6. |

Persistence result:

```text
status       = DRAFT
publishedAt  = null
createdAt    = operationTime
updatedAt    = operationTime
```

Success:

- `201 Created` with `OrganizerHeritageDetailResponse`.
- `Location: /api/v1/organizer/heritages/{heritageContentId}`.
- Returned `publicCode` is canonical uppercase.
- Returned `publicCode` is generated by the server and is not a request field.

Errors:

- `400 MALFORMED_REQUEST`
- `400 UNKNOWN_FIELD`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `403 CSRF_INVALID`
- `409 HERITAGE_PUBLIC_CODE_GENERATION_FAILED` only when a unique generated code cannot be reserved
- `422 VALIDATION_FAILED`
- `500 INTERNAL_ERROR`

Title-derived code generation is race-safe. Creation serializes allocation for the same base code and
selects the first available numeric suffix without exposing constraints or asking the Organizer for a code.

### 8.2 PATCH `/organizer/heritages/{heritageContentId}`

Full path: `PATCH /api/v1/organizer/heritages/{heritageContentId}`.

Request: `UpdateHeritageRequest`.

```json
{
  "summary": "Công trình kiến trúc tiêu biểu gắn với không gian Đường Sách.",
  "locationText": "Số 2 Công xã Paris, Quận 1",
  "expectedUpdatedAt": "2026-11-01T08:15:30.123456Z"
}
```

Fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `title` | string | No | Section 3.2 when supplied. |
| `summary` | string or null | No | Omitted means unchanged, null or blank clears it. |
| `content` | string | No | Section 3.4 when supplied. |
| `imageUrl` | string or null | No | Omitted means unchanged, null or blank clears it. |
| `locationText` | string or null | No | Omitted means unchanged, null or blank clears it. |
| `expectedUpdatedAt` | string instant | Yes | Section 3.8. |

At least one of `title`, `summary`, `content`, `imageUrl`, or `locationText` must be present. A request
containing only `expectedUpdatedAt` returns `422 VALIDATION_FAILED` and does not advance `updatedAt`.

Update preserves:

```text
heritageContentId
publicCode
status
publishedAt
createdAt
```

Success:

- `200 OrganizerHeritageDetailResponse`.
- Returned `updatedAt` is strictly later than the supplied token.

Errors:

- `400 MALFORMED_REQUEST`
- `400 UNKNOWN_FIELD`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `403 CSRF_INVALID`
- `404 HERITAGE_NOT_FOUND`
- `409 HERITAGE_STALE_WRITE`
- `422 VALIDATION_FAILED`
- `500 INTERNAL_ERROR`

## 9. Organizer lifecycle APIs

All lifecycle APIs accept exactly one `HeritageTransitionRequest` shape:

```json
{
  "expectedUpdatedAt": "2026-11-01T08:15:30.123456Z"
}
```

Unknown properties return `400 UNKNOWN_FIELD`. Missing or malformed `expectedUpdatedAt` returns
`422 VALIDATION_FAILED`.

### 9.1 POST `/organizer/heritages/{heritageContentId}/publish`

Full path: `POST /api/v1/organizer/heritages/{heritageContentId}/publish`.

Required source state: `DRAFT` with null `publishedAt`.

The persisted required content is defensively revalidated before transition.

Atomic success mutation:

```text
status       = PUBLISHED
publishedAt  = operationTime
updatedAt    = operationTime
```

Success: `200 OrganizerHeritageDetailResponse`.

### 9.2 POST `/organizer/heritages/{heritageContentId}/archive`

Full path: `POST /api/v1/organizer/heritages/{heritageContentId}/archive`.

Required source state: `PUBLISHED`.

Atomic success mutation:

```text
status       = ARCHIVED
publishedAt  = preserved
updatedAt    = operationTime
```

Success: `200 OrganizerHeritageDetailResponse`.

Archive removes the record from public list and detail predicates immediately after commit.

### 9.3 POST `/organizer/heritages/{heritageContentId}/republish`

Full path: `POST /api/v1/organizer/heritages/{heritageContentId}/republish`.

Required source state: `ARCHIVED` with non-null original `publishedAt`.

The persisted required content is defensively revalidated before transition.

Atomic success mutation:

```text
status       = PUBLISHED
publishedAt  = preserved
updatedAt    = operationTime
```

Success: `200 OrganizerHeritageDetailResponse`.

The same canonical public URL becomes available again after commit.

### 9.4 Common lifecycle errors

- `400 MALFORMED_REQUEST`
- `400 UNKNOWN_FIELD`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `403 CSRF_INVALID`
- `404 HERITAGE_NOT_FOUND`
- `409 HERITAGE_STALE_WRITE`
- `409 HERITAGE_TRANSITION_CONFLICT`
- `422 VALIDATION_FAILED`
- `500 INTERNAL_ERROR`

Conflict classification order after authority and request validation:

1. unknown internal identity returns `404 HERITAGE_NOT_FOUND`
2. mismatched valid concurrency token returns `409 HERITAGE_STALE_WRITE`
3. illegal current lifecycle state returns `409 HERITAGE_TRANSITION_CONFLICT`
4. invalid persisted required content returns `422 VALIDATION_FAILED`

The rejected command changes no content, status, or timestamp.

## 10. Organizer draft delete API

### 10.1 DELETE `/organizer/heritages/{heritageContentId}`

Full path:

```text
DELETE /api/v1/organizer/heritages/{heritageContentId}?expectedUpdatedAt={encodedInstant}
```

`expectedUpdatedAt` is a required query parameter because the shared frontend API client intentionally
sends no JSON body with `DELETE`. The raw response token is URL-encoded without parsing or reformatting.

Eligibility:

```text
status = DRAFT
publishedAt = null
updatedAt = expectedUpdatedAt
```

Success:

- `204 No Content`.
- No response body.
- The UI must obtain explicit user confirmation before sending the request.

Errors:

- `400 MALFORMED_REQUEST`
- `400 INVALID_FILTER` for unsupported query parameters
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCESS_DENIED`
- `403 CSRF_INVALID`
- `404 HERITAGE_NOT_FOUND`
- `409 HERITAGE_STALE_WRITE`
- `409 HERITAGE_DELETE_CONFLICT`
- `422 VALIDATION_FAILED` for missing or malformed `expectedUpdatedAt`
- `500 INTERNAL_ERROR`

Conflict classification uses unknown identity, stale token, then delete eligibility in that order.
`PUBLISHED` and `ARCHIVED` records return `409 HERITAGE_DELETE_CONFLICT` and remain durable.

## 10.2 Heritage image media APIs

### 10.2.1 POST `/organizer/heritage-images`

Full path: `POST /api/v1/organizer/heritage-images`.

- Requires effective verified Organizer authority and CSRF.
- Consumes `multipart/form-data` with one `file` part.
- Accepts signature-validated JPG, PNG, or WebP content up to 5 MB.
- Ignores the caller filename and stores a server-generated UUID filename.
- Success is `201` with `{ "imageUrl": "/assets/heritage/uploads/{generatedFileName}" }`.
- Invalid, empty, mismatched, or oversized content returns `422 HERITAGE_IMAGE_INVALID`.
- Storage failure returns `500 HERITAGE_IMAGE_STORAGE_FAILED`.

### 10.2.2 GET `/assets/heritage/uploads/{fileName}`

- Anonymous read for server-generated filenames only.
- Returns the stored image with its validated media type and immutable public cache headers.
- Unsafe, malformed, or missing filenames return `404 HERITAGE_IMAGE_NOT_FOUND`.

### 10.2.3 DELETE `/organizer/heritage-images/{fileName}`

- Requires effective verified Organizer authority and CSRF.
- Deletes an abandoned uploaded image only when no Heritage row references its URL.
- Referenced images return `409 HERITAGE_IMAGE_IN_USE`.
- The Organizer UI uses this operation after canceling an unsaved upload or replacing a committed image.

## 11. Canonical error codes

### 11.1 Common request and security

- `MALFORMED_REQUEST` maps to 400.
- `UNKNOWN_FIELD` maps to 400.
- `INVALID_PAGE` maps to 400.
- `INVALID_SIZE` maps to 400.
- `INVALID_SORT` maps to 400.
- `INVALID_FILTER` maps to 400.
- `INVALID_ENUM_VALUE` maps to 400.
- `AUTHENTICATION_REQUIRED` maps to 401.
- `ACCESS_DENIED` maps to 403.
- `CSRF_INVALID` maps to 403.
- `VALIDATION_FAILED` maps to 422.
- `INTERNAL_ERROR` maps to 500.

### 11.2 Heritage-specific

- `HERITAGE_NOT_FOUND` maps to 404.
- `HERITAGE_STALE_WRITE` maps to 409.
- `HERITAGE_TRANSITION_CONFLICT` maps to 409.
- `HERITAGE_DELETE_CONFLICT` maps to 409.
- `HERITAGE_PUBLIC_CODE_GENERATION_FAILED` maps to 409.
- `HERITAGE_IMAGE_INVALID` maps to 422.
- `HERITAGE_IMAGE_NOT_FOUND` maps to 404.
- `HERITAGE_IMAGE_IN_USE` maps to 409.
- `HERITAGE_IMAGE_STORAGE_FAILED` and `HERITAGE_IMAGE_DELETE_FAILED` map to 500.

Field validation uses these `fieldErrors.field` values where applicable:

```text
publicCode
title
summary
content
imageUrl
locationText
expectedUpdatedAt
search
status
page
size
sort
```

Cross-field validation may return `VALIDATION_FAILED` with an empty `fieldErrors` array when no single
field accurately identifies the problem, including an update with no mutable field.

No error response includes private Heritage content, Session or CSRF values, SQL text, constraint names,
filesystem paths, credentials, or account data.

## 12. Transaction and concurrency contract

### 12.1 Create

Order:

```text
authorized Organizer Session
  -> CSRF
  -> JSON binding and unknown-field rejection
  -> normalization and validation
  -> title-derived public-code generation and serialized uniqueness allocation
  -> Heritage insert
  -> flush and commit
  -> committed detail response
```

- Generated-code allocation remains race-safe through a transaction-scoped namespace lock and the
  database unique constraint.
- One `operationTime` is reused for `createdAt` and `updatedAt`.
- A failed insert cannot return `201`.

### 12.2 Guarded mutations

Update and every lifecycle command use one guarded database mutation whose predicate includes:

```text
heritage_content_id = requested identity
AND updated_at = expectedUpdatedAt
```

Lifecycle mutations also include the exact expected source status. Draft delete additionally includes
`status = DRAFT` and `published_at IS NULL`.

A zero-row mutation is resolved to the documented not-found, stale, transition, or delete conflict without
exposing the newer content in the error response. The client reloads detail after conflict.

### 12.3 Strictly advancing update time

Every accepted mutation must create an `updatedAt` strictly later than the previous persisted value at
PostgreSQL precision.

The operation time is equivalent to:

```text
max(
  backend Clock instant normalized to PostgreSQL precision,
  previous updatedAt plus one microsecond
)
```

- Create uses the same operation time for `createdAt` and `updatedAt`.
- First publish uses the same operation time for `publishedAt` and `updatedAt`.
- Archive and republish preserve original `publishedAt`.
- The committed persisted timestamp is returned as the next raw concurrency token.
- No browser-formatted date is accepted as a substitute for that raw token.

### 12.4 Public reads

- Public list and detail include `status = PUBLISHED` in the PostgreSQL predicate.
- Private rows are never loaded into a public DTO and filtered only in memory.
- Public reads acquire no write lock and create no view or QR analytics.

## 13. Persistence mapping

The API maps to `heritage_contents` exactly as defined by the Sprint 09 Physical ERD overlay:

| API concept | Physical field |
| --- | --- |
| `heritageContentId` | `heritage_content_id` |
| `publicCode` | `public_code` |
| `title` | `title` |
| `summary` | `summary` |
| `content` | `content` |
| `imageUrl` | `image_url` |
| `locationText` | `location_text` |
| `status` | `status` |
| `publishedAt` | `published_at` |
| `createdAt` | `created_at` |
| `updatedAt` and `expectedUpdatedAt` | `updated_at` |

The production migration version is rechecked from updated `main` immediately before implementation.
At activation, `V15__create_sprint9_heritage_content_schema.sql` is only a candidate and is not reserved by
this contract. V1 through V14 remain immutable.

No production or demo Heritage rows belong in the schema migration. There is no Heritage foreign key in
`general_feedbacks` and no Feedback foreign key in `heritage_contents`.

## 14. Security and privacy obligations

- Public Heritage GET routes must be explicitly `permitAll`.
- Organizer Heritage routes require `hasRole('ORGANIZER')` before the broader Organizer matcher that also
  permits Admin.
- Organizer controller methods also require method-level `hasRole('ORGANIZER')`.
- Heritage mutation routes remain under the shared CSRF protection.
- The access-denied handler must return `CSRF_INVALID` for Organizer Heritage CSRF failures.
- Heritage controller and security error responses must also include `Cache-Control: no-store`.
- Heritage binding, validation, persistence, authentication, and access-denied failures must all use the
  canonical error shape from section 1.2.
- No caller-supplied User id, role, owner, creator, reviewer, or approver is accepted.
- Public responses expose only the public DTO fields in section 4.
- Public errors do not distinguish draft, archived, missing, or noncanonical codes.
- Stored text is rendered as text and not executable HTML.
- Logs exclude request bodies, content, Session cookies, CSRF tokens, credentials, SQL, and full stack
  details in client responses.
- Redis remains Session-only for this feature. Sprint 09 adds no Heritage cache, queue, counter, or lock.
- No browser local storage is used as a Heritage mock or offline mutation queue.

## 15. Frontend integration obligations

### 15.1 Public API adapter

- Replace the empty `publicApi.getHeritages()` implementation with paged `GET /heritages` requests.
- Replace the unused `/public/heritages/{slug}` stub with `GET /heritages/{publicCode}`.
- Replace the legacy generic-record adapter with typed public list and detail DTOs.
- Use `publicCode` as the route identity and never use list position or internal numeric id.
- Keep `/di-san` as the public list route.
- Keep `/di-san/:publicCode` as the direct public detail route.
- Direct detail initializes from its route parameter and does not require Landing Page state.
- Landing Page and collection screens distinguish loading, genuine empty, failure, and populated states.
- Detail distinguishes loading, not-found, failure, and populated states.
- Remove the current public search and category controls because Sprint 09 defines no public search or
  category API. They must not filter only the currently loaded page and imply complete results.
- Remove unsupported category, period, province, translation, map, source, license, highlight, view-count,
  and scan-count assumptions from the canonical API model.
- Optional display adaptation may reuse Vietnamese content for the current language shell but must not
  invent persisted translated content.
- No API failure or empty page falls back to local Heritage records.

### 15.2 Organizer API adapter and route

- Add `public_content` to the Organizer route allowlist so `/organizer/public-content` resolves normally.
- Replace the empty and unsupported Heritage methods in `organizerApi` with the eight Organizer operations
  in this contract.
- Replace `ExtendedHeritageProfile` persistence assumptions with the canonical management DTOs.
- Keep list query state in the URL for search, status, sort, and page when practical.
- Fetch Organizer detail before opening an edit form because list items omit full content.
- Send the latest raw `updatedAt` unchanged as `expectedUpdatedAt`.
- URL-encode the raw token for draft delete without parsing it through `Date`.
- Show lifecycle actions strictly by canonical status.
- Require explicit confirmation before archive and hard delete.
- Preserve safe form input after validation or retryable failure.
- On `HERITAGE_STALE_WRITE`, reload durable detail and do not replay the stale mutation.
- Never apply an optimistic success that the backend did not confirm.

### 15.3 Public presentation and image upload

- Public cards and detail pages use `publicCode` only in links and do not render it as a technical label.
- Heritage pages render no QR block.
- Organizer forms hide `publicCode`; the server returns it after create.
- Organizer forms upload local image files, show a preview and allow replacement or removal.
- Abandoned temporary uploads are deleted when possible; persisted rows store only the returned URL.

## 16. Acceptance Criteria traceability

### 16.1 Organizer management

| Acceptance Criteria | Contract coverage |
| --- | --- |
| `AC-O09-S9-01` | Sections 6 and 7 shared authenticated collection. |
| `AC-O09-S9-02` | Sections 1.1, 3.7, and 7.1 query behavior. |
| `AC-O09-S9-03` | Sections 3.1, 8.1, and 12.1 valid draft create. |
| `AC-O09-S9-04` | Sections 3, 8.1, and 11 validation and duplicate handling. |
| `AC-O09-S9-05` | Sections 3.8, 8.2, and 12.2 guarded content update. |
| `AC-O09-S9-06` | Sections 9.1 and 12.3 first publish. |
| `AC-O09-S9-07` | Sections 9.4 and 12.2 rejected publish and transition. |
| `AC-O09-S9-08` | Sections 5, 9.2, and 12.4 archive visibility. |
| `AC-O09-S9-09` | Sections 5.2 and 9.3 stable republish. |
| `AC-O09-S9-10` | Sections 10 and 12.2 guarded draft delete. |
| `AC-O09-S9-11` | Sections 10 and 11.2 published-history delete conflict. |
| `AC-O09-S9-12` | Sections 6 and 7 shared collection without owner filter. |
| `AC-O09-S9-13` | Sections 6 and 14 effective verified Organizer authority. |
| `AC-O09-S9-14` | Section 15.2 genuine Organizer UI states. |

### 16.2 Public discovery

| Acceptance Criteria | Contract coverage |
| --- | --- |
| `AC-G01-S9-01` | Section 5.1 published-only anonymous list. |
| `AC-G01-S9-02` | Sections 2.3 and 5.2 canonical public detail. |
| `AC-G01-S9-03` | Sections 5.2 and 14 public-safe non-disclosure. |
| `AC-G01-S9-04` | Sections 1.1 and 5.1 deterministic paging. |
| `AC-G01-S9-05` | Section 15.1 real loading, empty, not-found, and failure states. |
| `AC-G01-S9-06` | Sections 5.2 and 15.1 direct detail loading. |
| `AC-G01-S9-07` | Sections 4.1, 4.2, and 15.1 optional fields. |
| `AC-G01-S9-08` | Sections 2.3 and 15.3 omission of QR and technical-code labels. |

### 16.3 Persistence and regression

| Acceptance Criteria | Contract coverage |
| --- | --- |
| `AC-S9-DB-01` | Section 13 clean migration and Hibernate validation boundary. |
| `AC-S9-DB-02` | Section 13 V14 upgrade and immutable prior migrations. |
| `AC-S9-DB-03` | Sections 3, 12, and 13 database invariant mapping. |
| `AC-S9-REG-01` | Sections 14, 17, and 18 existing-feature compatibility. |
| `AC-S9-REG-02` | Sections 1, 13, and 17 Feedback separation. |
| `AC-S9-REG-03` | Sections 5 and 15 no mock fallback. |

## 17. Compatibility and explicit exclusions

Sprint 09 must not change:

- Event, Booth, Activity, Payment, Attendance, Certificate, Reward, Rating, and Feedback API behavior
- Event ownership and existing Organizer authorization outside Heritage
- Participant, Partner, Admin, or other Organizer routes
- server-side Session, Redis Session storage, CSRF cookie, or CSRF header behavior
- General Feedback targets `BOOK_STREET` and `EVENT`
- Activity Rating behavior

Explicitly excluded:

- Heritage as a General Feedback target
- Admin Heritage API or UI
- per-Organizer ownership
- approval, review, assignment, or version-history workflows
- new roles or statuses
- bilingual persistence
- public search or category filter
- map coordinates or marker editing
- rich text or executable HTML
- external storage-provider integration or a general asset library
- QR presentation, persisted QR data or scan analytics
- view count, reports, or dashboards
- notifications, comments, likes, or subscriptions
- scheduled publish, expiration, or rollback
- bulk import, export, or deletion
- Redis Heritage data
- production migration seed rows
- modification of Flyway V1 through V14

## 18. Required verification

Focused backend evidence must cover:

- clean migration and V14 upgrade with Hibernate validation
- all database constraints and valid lifecycle states
- anonymous published list and direct detail
- draft, archived, unknown, and noncanonical public-code non-disclosure
- deterministic public ordering when `publishedAt` ties
- Organizer-only shared list and identical count predicate
- search, status, sort, page, size, and unsupported-query validation
- create normalization, every field boundary, unknown properties, and duplicate-code race
- partial update, optional-field clearing, empty update, immutable fields, and stale write
- every legal lifecycle transition and every illegal or repeated transition
- original `publishedAt` preservation through archive and republish
- strictly advancing microsecond-precision concurrency tokens
- guarded draft delete and rejection for published or archived records
- Admin-only denial and multi-role Organizer acceptance
- CSRF failure classification
- absence of Heritage Feedback relationships and regressions in completed features

Focused frontend evidence must cover:

- Landing Page loading, populated, empty, and failure states
- `/di-san` paging and genuine empty state
- direct `/di-san/:publicCode` load in a fresh browser context
- public detail not-found and failure states
- optional image, summary, and location rendering
- absence of Heritage QR and technical public-code labels
- Organizer local image upload, preview, replacement, removal, validation and abandoned-upload cleanup
- Organizer route resolution
- Organizer list search, filter, sort, page, and empty states
- create, edit, publish, archive, republish, and eligible delete UI
- validation, forbidden, stale conflict, server failure, and success states
- no mock fallback or legacy unsupported fields

Focused Sprint 09 browser tests plus affected shared smoke checks are required. A full historical Playwright
suite is not required for this slice. Backend and frontend CI remain required.

## 19. Contract review gate

Before migration or application implementation begins, reviewers must confirm:

- all thirteen routes and exact DTO field names
- public and Organizer response separation
- canonical immutable `publicCode`
- exact normalization and validation limits
- public page bounds and fixed ordering
- Organizer search, status, sort, page, and size behavior
- Organizer-only shared authority and Admin-only denial
- all three lifecycle commands and guarded draft delete
- exact `expectedUpdatedAt` transport for body and delete query
- microsecond precision and strictly increasing update time
- stable error codes and conflict precedence
- public-safe not-found behavior
- no Feedback, Admin, QR presentation/persistence, external storage provider, analytics, or mock scope
- complete traceability to all 28 Sprint 09 Acceptance Criteria

Approval of this contract is followed by the implementation and ownership plan, then the requested full
cross-document audit. No Sprint 09 migration or application code should begin before that audit reports a
clean implementation baseline.
