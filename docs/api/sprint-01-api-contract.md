# Sprint 01 API Contract

## 1 Purpose

This contract defines the REST API required by Sprint 1. It is derived from the Sprint 1 Use Case Specifications and Acceptance Criteria. Backend and frontend changes must keep this contract synchronized.

## 2 General conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Time format: ISO 8601 with timezone, stored by the backend as UTC
- Authentication: Spring Security server-side session stored in Redis
- Browser credential: HttpOnly session cookie; frontend requests include credentials
- Cross-origin deployment: allow only configured frontend origins and enable credentialed CORS
- Cookie and CSRF details follow the approved [`browser-security-contract.md`](browser-security-contract.md)
- Session expiry: the user logs in again; Sprint 1 has no JWT or refresh-token endpoint
- Identifier format: numeric IDs matching Physical ERD v1
- Pagination query: `page`, `size`, optional `sort`
- The backend derives the current User and role from authentication; clients must not send `userId` or `organizerUserId` to claim ownership.

### Standard error response

```json
{
  "code": "APPLICATION_ALREADY_EXISTS",
  "message": "An application already exists for this Partner and Event.",
  "fieldErrors": [],
  "timestamp": "2026-09-28T08:00:00Z",
  "path": "/api/v1/events/12/applications"
}
```

Recommended status usage:

| Status | Meaning |
|---|---|
| 200 | Successful query or command |
| 201 | Resource created |
| 204 | Successful command with no response body |
| 400 | Malformed request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but not authorized |
| 404 | Resource does not exist or is hidden by ownership policy |
| 409 | Duplicate or invalid state transition |
| 422 | Field or business validation failed |

## 3 Authentication APIs

The approved parallel email-verification extension is defined separately in [`email-verification-api-contract.md`](email-verification-api-contract.md). It does not change the core Sprint 1 endpoint traceability below.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create Participant account |
| POST | `/auth/login` | Public | Authenticate username/password |
| POST | `/auth/logout` | Authenticated session | Invalidate the current session |
| GET | `/auth/me` | Authenticated | Return current user profile and roles |

### POST `/auth/register`

Request:

```json
{
  "username": "booklover",
  "fullName": "Nguyen Van A",
  "password": "example-password",
  "confirmPassword": "example-password",
  "email": null
}
```

Registration validation:

- `username` contains 3 to 20 characters, starts with an ASCII letter and contains only ASCII letters and digits.
- `fullName` contains 2 to 50 characters after surrounding and repeated whitespace is normalized.
- `password` and `confirmPassword` contain 8 to 64 characters and do not exceed 72 UTF-8 bytes.
- `email` is optional; a supplied value is trimmed, has at most 255 characters and must be a valid email address.
- `password` and `confirmPassword` must match exactly. Password values are never trimmed.

Response `201`:

```json
{
  "userId": 101,
  "username": "booklover",
  "fullName": "Nguyen Van A",
  "email": null,
  "emailVerified": false,
  "status": "ACTIVE",
  "roles": ["PARTICIPANT"]
}
```

Errors:

- `409 USERNAME_ALREADY_EXISTS`
- `409 EMAIL_ALREADY_EXISTS`
- `422 PASSWORD_CONFIRMATION_MISMATCH`
- `422 VALIDATION_FAILED`

Acceptance Criteria: AC-G02-01 through AC-G02-05.

### POST `/auth/login`

Request:

```json
{
  "username": "partnerdemo",
  "password": "example-password"
}
```

Response `200`:

```json
{
  "user": {
    "userId": 22,
    "username": "partnerdemo",
    "fullName": "Demo Partner",
    "roles": ["PARTICIPANT", "PARTNER"]
  }
}
```

Login validation applies the same username format. Password is required and is limited to 64 characters and 72 UTF-8 bytes, but an invalid credential is still reported with the generic authentication error below.

The backend also sets a Secure, HttpOnly session cookie. The session identifier is not returned in the JSON body and is not readable by frontend JavaScript.

Errors:

- `401 INVALID_CREDENTIALS`
- `403 ACCOUNT_NOT_ACTIVE`

Acceptance Criteria: AC-G03-01 and AC-G03-02.

### POST `/auth/logout`

- Invalidates the current server-side session in Redis.
- Clears the session cookie.
- Response: `204`.
- Repeating logout must not expose protected data.

Acceptance Criterion: AC-G03-05.

### GET `/auth/me`

Response `200`:

```json
{
  "userId": 22,
  "username": "partnerdemo",
  "fullName": "Demo Partner",
  "email": "partner@example.com",
  "emailVerified": true,
  "status": "ACTIVE",
  "roles": ["PARTICIPANT", "PARTNER"]
}
```

Acceptance Criteria: AC-G03-03 and AC-G03-04.

## 4 Public Event APIs

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/events` | Public | List Published/visible Events |
| GET | `/events/{eventId}` | Public | View one Published/visible Event |

Draft Events must not be returned by these endpoints.

### Event summary response

```json
{
  "eventId": 12,
  "name": "Book Street Festival 2026",
  "description": "Annual book street event",
  "startAt": "2026-11-01T08:00:00+07:00",
  "endAt": "2026-11-03T21:00:00+07:00",
  "partnerApplicationDeadlineAt": "2026-10-10T23:59:59+07:00",
  "bannerUrl": null,
  "status": "PUBLISHED"
}
```

Acceptance Criterion: AC-O01-05.

## 5 Organizer Event APIs

All endpoints require role `ORGANIZER` and verified email.

| Method | Path | Purpose |
|---|---|---|
| POST | `/organizer/events` | Create Draft Event |
| GET | `/organizer/events` | List Events owned by current Organizer |
| GET | `/organizer/events/{eventId}` | Get owned Event detail |
| PATCH | `/organizer/events/{eventId}` | Update owned Draft Event |
| POST | `/organizer/events/{eventId}/publish` | Publish owned Draft Event |

### Event create/update request

```json
{
  "name": "Book Street Festival 2026",
  "description": "Annual book street event",
  "startAt": "2026-11-01T08:00:00+07:00",
  "endAt": "2026-11-03T21:00:00+07:00",
  "partnerApplicationDeadlineAt": "2026-10-10T23:59:59+07:00",
  "boothRequestDeadlineAt": "2026-10-20T23:59:59+07:00",
  "activityProposalDeadlineAt": "2026-10-20T23:59:59+07:00",
  "participantRegistrationDeadlineAt": "2026-11-01T07:30:00+07:00",
  "partnerWithdrawalCutoffAt": "2026-10-20T23:59:59+07:00",
  "boothCancellationCutoffAt": "2026-10-20T23:59:59+07:00",
  "activityCancellationCutoffAt": "2026-10-25T23:59:59+07:00",
  "boothPaymentWindowMinutes": 1440,
  "maxBoothsPerPartner": 1,
  "maxActivitiesPerPartner": 5,
  "bannerUrl": null
}
```

Create response: `201` with Event detail and `status = DRAFT`.

Update response: `200` with updated Event detail.

Publish response: `200` with `status = PUBLISHED`.

Errors:

- `403 ACCESS_DENIED`
- `404 EVENT_NOT_FOUND`
- `409 EVENT_NOT_DRAFT`
- `422 EVENT_TIME_INVALID`
- `422 EVENT_CONFIGURATION_INVALID`
- `422 EVENT_INCOMPLETE_FOR_PUBLISH`

Acceptance Criteria: AC-O01-01 through AC-O01-05.

### Event deadline policy (updated 2026-11-02)

Concrete scheduling policy selected for the requested realistic deadline validation,
supporting UC-O01 alternative A2 and AC-O01-01/03/04:

- Every supplied active Event deadline must be at or before `startAt`.
- Draft create/PATCH may retain an unfinished or contradictory publication timeline so the
  Organizer can save work in progress. Publication and operational updates enforce the full policy.
- `partnerApplicationDeadlineAt` and `participantRegistrationDeadlineAt` are always required to publish.
- When `maxBoothsPerPartner > 0`, `boothRequestDeadlineAt` and a valid
  `boothPaymentWindowMinutes` are required. When the quota is zero, the deadline may be null.
- When `maxActivitiesPerPartner > 0`, `activityProposalDeadlineAt` is required. When the quota is zero,
  the deadline may be null.
- Each enabled downstream deadline (`boothRequestDeadlineAt` and `activityProposalDeadlineAt`) must be
  at least 24 hours after `partnerApplicationDeadlineAt`. Equality at exactly 24 hours is valid.
- `participantRegistrationDeadlineAt` must be strictly before `startAt`.
- When Booth is enabled, the invariant is
  `boothRequestDeadlineAt + boothPaymentWindowMinutes + 24 hours <= startAt`.
  The final 24 hours are reserved for Booth setup after payment closes.
- Missing required publication fields return `422 EVENT_INCOMPLETE_FOR_PUBLISH`. Contradictory
  publication timing returns `422 EVENT_TIME_INVALID` with the field that must be corrected.
- Publication requires `startAt` and every active required deadline to be strictly later than one
  server UTC timestamp captured for that validation. Equal-to-now or past values return
  `422 EVENT_TIME_INVALID`.
- The legacy `partnerWithdrawalCutoffAt`, `boothCancellationCutoffAt`, and
  `activityCancellationCutoffAt` fields remain compatibility data. They are not configured by the
  current Organizer Event form, are not required, and do not decide publication eligibility.
- Description and banner remain optional. Existing name/time/non-negative quota
  requirements still apply. Failed publication leaves the Event DRAFT.
- Drafts may retain past dates while being edited; this does not permit publication.
- This publication policy does not change Partner withdrawal, Booth withdrawal, Activity cancellation,
  or refund workflows.

## 6 Partner Organization APIs

All endpoints require role `PARTNER` and verified email.

| Method | Path | Purpose |
|---|---|---|
| GET | `/partner/organization` | Get organization represented by current User |
| PUT | `/partner/organization` | Create or update represented organization |

### PUT `/partner/organization`

Request:

```json
{
  "name": "Example Publishing House",
  "description": "Publisher and bookseller",
  "categoryCode": "PUBLISHER",
  "logoUrl": null,
  "contactEmail": "contact@example.com",
  "contactPhone": "0900000000",
  "address": "Ho Chi Minh City"
}
```

Response `200` or `201` contains the organization summary and status. The backend sets `representativeUserId` from authentication.

Errors:

- `403 ACCESS_DENIED`
- `409 REPRESENTATIVE_ALREADY_HAS_ORGANIZATION`
- `422 VALIDATION_FAILED`

## 7 Partner Application APIs

All endpoints require role `PARTNER` and verified email.

| Method | Path | Purpose |
|---|---|---|
| POST | `/events/{eventId}/applications` | Apply to Event |
| GET | `/partner/applications` | List current Partner applications |
| GET | `/partner/applications/{applicationId}` | Get owned application detail |
| POST | `/partner/applications/{applicationId}/withdraw` | Withdraw owned Pending application |

### POST `/events/{eventId}/applications`

Request:

```json
{
  "applicationNote": "We would like to join this event."
}
```

Response `201`:

```json
{
  "applicationId": 5001,
  "eventId": 12,
  "partnerOrganizationId": 33,
  "status": "PENDING",
  "applicationNote": "We would like to join this event.",
  "reviewNote": null,
  "submittedAt": "2026-09-28T08:00:00+07:00",
  "reviewedAt": null,
  "withdrawnAt": null
}
```

Errors:

- `403 ACCESS_DENIED`
- `404 EVENT_NOT_FOUND`
- `409 PARTNER_ORGANIZATION_REQUIRED`
- `409 EVENT_NOT_ACCEPTING_APPLICATIONS`
- `409 APPLICATION_DEADLINE_PASSED`
- `409 APPLICATION_ALREADY_EXISTS`

Acceptance Criteria: AC-E01-01 through AC-E01-04.

### POST `/partner/applications/{applicationId}/withdraw`

- Valid transition: `PENDING → WITHDRAWN`.
- Response `200` contains updated application detail.
- Errors: `404 APPLICATION_NOT_FOUND`, `409 APPLICATION_NOT_PENDING`.

Acceptance Criterion: AC-E01-05.

### Partner application list pagination

`GET /partner/applications` accepts these optional query parameters:

- `page`
- `size`
- `sort`, using the format `field,direction`

The allowed sort fields are `submittedAt`, `status`, `eventId`, `reviewedAt` and
`withdrawnAt`. An unsupported sort field returns `400 INVALID_SORT`.

## 8 Organizer Application Review APIs

All endpoints require role `ORGANIZER`. The current Organizer must own the related Event.

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/events/{eventId}/applications` | List applications for owned Event |
| GET | `/organizer/applications/{applicationId}` | Get one application detail |
| POST | `/organizer/applications/{applicationId}/approve` | Approve Pending application |
| POST | `/organizer/applications/{applicationId}/reject` | Reject Pending application |

### Application list filters

Optional query parameters:

- `status=PENDING|APPROVED|REJECTED|WITHDRAWN`
- `page`
- `size`
- `sort`, using the format `field,direction`

The allowed sort fields are `submittedAt`, `status`, `eventId`, `reviewedAt` and
`withdrawnAt`. An unsupported sort field returns `400 INVALID_SORT`.

### Review request

```json
{
  "reviewNote": "Application meets the event requirements."
}
```

Approve/reject response `200` returns application detail with final status and `reviewedAt`.

Errors:

- `403 EVENT_ACCESS_DENIED`
- `404 APPLICATION_NOT_FOUND`
- `409 APPLICATION_NOT_PENDING`

Acceptance Criteria: AC-O03-01 through AC-O03-05.

## 9 Endpoint to Acceptance Criteria traceability

| Endpoint group | Acceptance Criteria |
|---|---|
| Register | AC-G02-01 to AC-G02-05 |
| Login, logout, me | AC-G03-01 to AC-G03-05 |
| Public and Organizer Events | AC-O01-01 to AC-O01-05 |
| Partner Organization and Applications | AC-E01-01 to AC-E01-05 |
| Organizer Application Review | AC-O03-01 to AC-O03-05 |

## 10 Deferred APIs

The following are intentionally absent from Sprint 1:

- Forgot/Reset Password
- Admin account and role management
- Cancel Event
- Booth, payment and refund
- Activity and registration
- QR and participation tracking
- Feedback, rating, Badge and reporting
