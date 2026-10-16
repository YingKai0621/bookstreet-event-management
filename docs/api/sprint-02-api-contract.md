# Sprint 02 API Contract

## 1 Purpose

This contract defines the REST API for Sprint 2 Booth setup, Booth requests, Organizer selection and temporary Holds. Backend and frontend changes must keep this document synchronized.

Payment initiation, payment callbacks, BoothAssignment and refunds are intentionally absent from
Sprint 2. Sprint 3 later implemented initial Payment and BoothAssignment; business refund was moved
to Post-MVP reference scope by the Sprint 4 baseline.

## 2 General conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Authentication: the existing Spring Security server-side session
- Browser requests: include credentials and follow `browser-security-contract.md`
- CSRF: required for state-changing requests
- Time: ISO 8601 with timezone; backend stores UTC instants
- Money: JSON decimal number with at most two fraction digits; VND examples use whole numbers
- Pagination: separate `page`, `size` and optional `sort` query parameters
- Ownership: derived from the authenticated principal; clients never send `userId`, `organizerUserId` or `partnerOrganizationId` to claim ownership
- Unknown or forbidden owned resources use the existing ownership-safe `404` policy
- Hold window: stored in the existing `events.booth_payment_window_minutes` column and exposed as `boothPaymentWindowMinutes`; allowed range `60..10080` minutes inclusive and new-Event default `1440`
- Hold expiry: selection uses one backend Clock instant and persists `expiresAt = selectedAt + boothPaymentWindowMinutes`; later Event setting changes never alter an existing Hold
- Payment-session duration: intentionally undefined until Sprint 3 and must never extend beyond `BoothHold.expiresAt`

### Standard error response

```json
{
  "code": "BOOTH_NOT_AVAILABLE",
  "message": "The Booth is not available for selection.",
  "fieldErrors": [],
  "timestamp": "2026-10-06T08:00:00Z",
  "path": "/api/v1/organizer/events/12/booth-requests/42/select"
}
```

### Status usage

| Status | Meaning |
|---|---|
| 200 | Successful query or state-changing command with a response body |
| 201 | Resource created |
| 204 | Successful command without a response body |
| 400 | Malformed request, invalid pagination or unsupported sort |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but missing the required role or business eligibility |
| 404 | Resource does not exist or is hidden by ownership policy |
| 409 | Duplicate, invalid transition, quota or concurrency conflict |
| 422 | Field or business validation failed |

## 3 Shared response models

### Booth response

```json
{
  "boothId": 5,
  "code": "A05",
  "name": "Booth A05",
  "description": "Near the main entrance",
  "maxCapacity": 8,
  "mapX": 120.50,
  "mapY": 80.00,
  "active": true,
  "categoryCode": "PUBLISHER",
  "note": null
}
```

### Event Booth response

```json
{
  "eventBoothConfigId": 31,
  "eventId": 12,
  "booth": {
    "boothId": 5,
    "code": "A05",
    "name": "Booth A05",
    "description": "Near the main entrance",
    "maxCapacity": 8,
    "mapX": 120.50,
    "mapY": 80.00,
    "active": true,
    "categoryCode": "PUBLISHER",
    "note": null
  },
  "rentalPrice": 2000000,
  "enabled": true,
  "availability": "AVAILABLE"
}
```

Allowed `availability` values:

- `UNAVAILABLE`
- `AVAILABLE`
- `ON_HOLD`
- `ASSIGNED` reserved for Sprint 3 compatibility

For a physical Booth that has no EventBoothConfig, `eventBoothConfigId` and `rentalPrice` are `null`, `enabled` is `false`, and availability is `UNAVAILABLE`.

### Booth request response

```json
{
  "boothRequestId": 42,
  "eventId": 12,
  "boothId": 5,
  "boothCode": "A05",
  "partnerOrganizationId": 8,
  "partnerOrganizationName": "Demo Books",
  "status": "SELECTED",
  "requestNote": "We would like a booth near the entrance.",
  "reviewNote": null,
  "submittedAt": "2026-10-06T08:00:00Z",
  "reviewedAt": "2026-10-06T09:00:00Z",
  "selectedAt": "2026-10-06T09:00:00Z",
  "completedAt": null,
  "paymentExpiredAt": null,
  "withdrawnAt": null,
  "hold": {
    "boothHoldId": 19,
    "status": "ACTIVE",
    "lockedRentalPrice": 2000000,
    "createdAt": "2026-10-06T09:00:00Z",
    "expiresAt": "2026-10-07T09:00:00Z",
    "releasedAt": null
  }
}
```

Allowed request statuses in this Sprint:

- `PENDING`
- `SELECTED`
- `PAYMENT_EXPIRED`
- `REJECTED`
- `WITHDRAWN`

`COMPLETED` and `NOT_SELECTED` remain valid lifecycle values but are produced only after Sprint 3 payment and assignment behavior exists.

Allowed Hold statuses in this Sprint:

- `ACTIVE`
- `EXPIRED`
- `RELEASED` reserved for future cancellation flows
- `CONSUMED` reserved for Sprint 3 payment success

## 4 Organizer physical Booth APIs

All endpoints require a verified `ORGANIZER` role.

| Method | Path | Purpose |
|---|---|---|
| POST | `/organizer/booths` | Create a physical Booth |
| GET | `/organizer/booths` | List physical Booths |
| GET | `/organizer/booths/{boothId}` | Get physical Booth detail |
| PATCH | `/organizer/booths/{boothId}` | Update or deactivate a physical Booth |

### POST `/organizer/booths`

Request:

```json
{
  "code": "A05",
  "name": "Booth A05",
  "description": "Near the main entrance",
  "maxCapacity": 8,
  "mapX": 120.50,
  "mapY": 80.00,
  "categoryCode": "PUBLISHER",
  "note": null
}
```

Response: `201` with Booth response.

Validation:

- `code`: required, trimmed, 1 to 30 characters and unique
- `name`: required, trimmed, 1 to 100 characters
- `maxCapacity`: positive integer
- `mapX`, `mapY`: optional decimal coordinates
- `categoryCode`: optional, at most 50 characters
- Physical creation always uses `locationType = BOOTH`; clients do not send that discriminator.

Errors:

- `409 BOOTH_CODE_ALREADY_EXISTS`
- `422 VALIDATION_FAILED`

Acceptance Criteria: AC-O02-01 and AC-O02-02.

### GET `/organizer/booths`

Query:

- `page`, default `0`
- `size`, default `20`, maximum `100`
- `sort`, allowed fields: `code`, `name`, `createdAt`, `updatedAt`; default `code,asc`
- `active`, optional Boolean filter

Response: paginated Booth responses.

Unsupported sort returns `400 INVALID_SORT`.

### PATCH `/organizer/booths/{boothId}`

All fields are optional, but at least one field must be supplied:

```json
{
  "name": "Booth A05 - Entrance",
  "description": "Updated description",
  "maxCapacity": 10,
  "mapX": 125.00,
  "mapY": 80.00,
  "active": true,
  "categoryCode": "PUBLISHER",
  "note": null
}
```

The Booth code is immutable in Sprint 2 so external references remain stable.

Response: `200` with updated Booth response.

Errors:

- `404 BOOTH_NOT_FOUND`
- `409 BOOTH_HAS_ACTIVE_HOLD`
- `422 VALIDATION_FAILED`

## 5 Organizer Event Booth configuration APIs

All endpoints require a verified `ORGANIZER` role and ownership of the Event.

The Event payment window remains part of the existing Event create/update contract (`POST /organizer/events` and `PATCH /organizer/events/{eventId}`); it is not stored on each EventBoothConfig. For Sprint 2:

- omitting `boothPaymentWindowMinutes` during Event creation applies `1440`;
- supplying it requires an integer from `60` through `10080`, inclusive;
- omitting it during Event PATCH leaves the value unchanged;
- responses continue returning the effective integer value in minutes;
- an invalid value returns `422 EVENT_CONFIGURATION_INVALID` with a field error for `boothPaymentWindowMinutes`;
- the create-Event UI initializes the field to `24 Hours`, while an edit screen displays the Event's currently persisted value rather than resetting it to 24 Hours;
- the Organizer UI may present Hours or Days but must convert to whole minutes before sending the request;
- the existing Event lifecycle and ownership rules still apply to Event updates.

Acceptance Criterion: AC-O02-08.

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/events/{eventId}/booth-configs` | List Booth configurations for an owned Event |
| PUT | `/organizer/events/{eventId}/booth-configs/{boothId}` | Create or replace one Event–Booth configuration |

### PUT `/organizer/events/{eventId}/booth-configs/{boothId}`

Request:

```json
{
  "rentalPrice": 2000000,
  "enabled": true
}
```

Behavior:

- Creates the unique configuration if it does not exist.
- Updates the same configuration if it exists.
- Does not mutate an already locked Hold price.
- Cannot disable the configuration while an Active Hold blocks it.
- Event payment-window changes never update the persisted `expiresAt` of an existing Hold; only later selections use the new value.

Response: `200` with Event Booth response. A newly created configuration also uses `200` because this endpoint is idempotent replacement.

Errors:

- `404 EVENT_NOT_FOUND`
- `404 BOOTH_NOT_FOUND`
- `409 BOOTH_HAS_ACTIVE_HOLD`
- `422 EVENT_BOOTH_CONFIGURATION_INVALID`

Acceptance Criteria: AC-O02-03, AC-O02-04 and AC-O02-06.

## 6 Public Event Booth APIs

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/events/{eventId}/booths` | Public | List physical Booths and derived availability for a Published Event |
| GET | `/events/{eventId}/booths/{boothId}` | Public | Get one physical Booth and its Event availability |

### GET `/events/{eventId}/booths`

Query:

- `page`, default `0`
- `size`, default `20`, maximum `100`
- `sort`, allowed fields: `code`, `name`, `rentalPrice`; default `code,asc`
- `availability`, optional: `UNAVAILABLE`, `AVAILABLE`, `ON_HOLD`, `ASSIGNED`
- `categoryCode`, optional

All active physical Booths are returned so the frontend can render the complete map. A missing or disabled EventBoothConfig produces `UNAVAILABLE`; it does not hide the physical Booth. Draft or hidden Events use the existing public Event visibility policy.

Response: paginated Event Booth responses.

Errors:

- `400 INVALID_SORT`
- `404 EVENT_NOT_FOUND`

Acceptance Criteria: AC-O02-05 and AC-O02-07.

### GET `/events/{eventId}/booths/{boothId}`

Returns one active physical Booth with its Event-specific price, configuration state and derived availability for a publicly visible Event. If the physical Booth exists but has no EventBoothConfig or its configuration is disabled, the response still uses the Event Booth response model with `rentalPrice = null` when no configuration exists, `enabled = false` and `availability = UNAVAILABLE`.

Response: `200` with one Event Booth response.

Errors:

- `404 EVENT_NOT_FOUND`
- `404 EVENT_BOOTH_NOT_FOUND`

Acceptance Criteria: AC-O02-05 and AC-O02-07.

## 7 Partner Booth request APIs

All command and owned-query endpoints require a verified `PARTNER` role.

| Method | Path | Purpose |
|---|---|---|
| POST | `/events/{eventId}/booth-requests` | Submit a request for one Booth |
| GET | `/partner/booth-requests` | List requests owned by the current Partner |
| GET | `/partner/booth-requests/{boothRequestId}` | Get owned request detail |
| POST | `/partner/booth-requests/{boothRequestId}/withdraw` | Withdraw an owned Pending request |

### POST `/events/{eventId}/booth-requests`

Request:

```json
{
  "boothId": 5,
  "requestNote": "We would like a booth near the entrance."
}
```

Response: `201` with Booth request response and `status = PENDING`; `hold = null`.

Errors:

- `403 PARTNER_APPLICATION_NOT_APPROVED`
- `404 EVENT_NOT_FOUND`
- `404 EVENT_BOOTH_NOT_FOUND`
- `409 BOOTH_REQUEST_ALREADY_OPEN`
- `409 BOOTH_REQUEST_RESUBMISSION_NOT_ALLOWED`
- `409 BOOTH_QUOTA_EXCEEDED`
- `409 BOOTH_REQUEST_DEADLINE_PASSED`
- `409 BOOTH_NOT_ENABLED`
- `409 BOOTH_NOT_AVAILABLE`
- `422 VALIDATION_FAILED`

An existing Pending request from another Partner is not an error.

`BOOTH_REQUEST_ALREADY_OPEN` applies when the same Partner already has a `PENDING` or `SELECTED` request for the same Event and Booth.

V6 backs this rule with a partial unique index on `booth_requests (application_id, booth_id)` where status is `PENDING` or `SELECTED`. The service still checks the historical `REJECTED` rule because closed requests are intentionally outside the partial index.

After `WITHDRAWN` or `PAYMENT_EXPIRED`, the Partner may create a new request record if deadline, quota and availability rules still pass. After `REJECTED`, the Partner cannot submit again for that same Event–Booth and receives `BOOTH_REQUEST_RESUBMISSION_NOT_ALLOWED`; another eligible Booth may still be requested. Historical records are never restored or reused.

Pending requests do not consume quota. At submission and again at selection, quota counts the Partner's Active Holds plus future Active Assignments for the Event.

Acceptance Criteria: AC-E02-01 through AC-E02-04.

### GET `/partner/booth-requests`

Query:

- `page`, default `0`
- `size`, default `20`, maximum `100`
- `sort`, allowed fields: `submittedAt`, `status`, `boothCode`; default `submittedAt,desc`
- `eventId`, optional
- `status`, optional

Response: paginated Booth request responses belonging only to the current PartnerOrganization.

### POST `/partner/booth-requests/{boothRequestId}/withdraw`

- Allowed only from `PENDING`.
- Response: `200` with the updated request.

Errors:

- `404 BOOTH_REQUEST_NOT_FOUND`
- `409 BOOTH_REQUEST_NOT_PENDING`

Acceptance Criteria: AC-E02-05 and AC-E02-06.

> Implemented Sprint 4 override: the same endpoint also accepts an eligible `SELECTED` request, releases
> its Hold safely and uses `BOOTH_REQUEST_NOT_WITHDRAWABLE` as the withdrawal-specific catch-all.
> See [`sprint-04-api-contract.md`](sprint-04-api-contract.md#4-partner-booth-request-api).

## 8 Organizer Booth review APIs

All endpoints require a verified `ORGANIZER` role and ownership of the Event.

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/events/{eventId}/booth-requests` | List candidates for an owned Event |
| GET | `/organizer/events/{eventId}/booth-requests/{boothRequestId}` | Get candidate detail |
| POST | `/organizer/events/{eventId}/booth-requests/{boothRequestId}/select` | Select candidate and create Hold |
| POST | `/organizer/events/{eventId}/booth-requests/{boothRequestId}/reject` | Reject a Pending candidate |

### GET `/organizer/events/{eventId}/booth-requests`

Query:

- `page`, default `0`
- `size`, default `20`, maximum `100`
- `sort`, allowed fields: `submittedAt`, `status`, `boothCode`, `partnerOrganizationName`; default `submittedAt,asc`
- `boothId`, optional
- `status`, optional

Response: paginated Booth request responses for the owned Event.

Errors:

- `400 INVALID_SORT`
- `404 EVENT_NOT_FOUND`

Acceptance Criterion: AC-O04-01.

### POST `/organizer/events/{eventId}/booth-requests/{boothRequestId}/select`

Request: no body.

Response: `200` with the updated Booth request and non-null Hold.

After the selection transaction commits, the backend triggers an email to the Partner representative's verified account email. The email contains the Event, Booth, locked price and `expiresAt`.

The transaction obtains one authoritative backend time, stores it as `selectedAt` and the Hold creation time, and calculates `expiresAt = selectedAt + boothPaymentWindowMinutes`. The computed instant is persisted on the Hold and is not derived again when the response is read.

Under the implemented Sprint 4 concurrency contract, selection first locks the Event and rechecks its
status/backend time before the Sprint 2 configuration, availability and request checks.

Email failure is logged and does not roll back the committed request or Hold. Sprint 2 does not add an outbox, notification table or complex email retry mechanism.

Errors:

- `404 EVENT_NOT_FOUND`
- `404 BOOTH_REQUEST_NOT_FOUND`
- `409 BOOTH_REQUEST_NOT_PENDING`
- `409 BOOTH_NOT_AVAILABLE`
- `409 BOOTH_QUOTA_EXCEEDED`
- `409 BOOTH_REQUEST_DEADLINE_PASSED`
- `409 PARTNER_APPLICATION_NOT_APPROVED`

Acceptance Criteria: AC-O04-02, AC-O04-03, AC-O04-04, AC-O04-07, AC-O04-08 and AC-O04-09.

### POST `/organizer/events/{eventId}/booth-requests/{boothRequestId}/reject`

Request:

```json
{
  "reviewNote": "The proposed setup does not meet this Event's operating requirements."
}
```

Validation: `reviewNote` is required, trimmed and limited to 1000 characters.

Response: `200` with the updated request and `status = REJECTED`.

Errors:

- `404 EVENT_NOT_FOUND`
- `404 BOOTH_REQUEST_NOT_FOUND`
- `409 BOOTH_REQUEST_NOT_PENDING`
- `422 VALIDATION_FAILED`

Acceptance Criterion: AC-O04-05.

## 9 Hold expiry contract

Hold expiry is a backend responsibility and has no public command endpoint.

- A scheduled process finds `ACTIVE` Holds where `expiresAt <= now`.
- The process locks each Hold before changing it.
- It changes the Hold to `EXPIRED`, records `releasedAt` as the actual backend processing time and changes the source request to `PAYMENT_EXPIRED` in one transaction.
- Reprocessing the same Hold produces no additional change.
- Availability-sensitive reads or selection commands must not treat a past-due Active Hold as a valid lock while waiting for the next scheduled run.

Acceptance Criterion: AC-O04-06.

## 10 Sprint 3 compatibility boundary

Sprint 3 will add server-verified payment attempts and BoothAssignment. It may add payment links to the selected request response, but it must not change these Sprint 2 meanings:

- Pending request does not reserve a Booth.
- Selection creates the Hold and snapshots the price.
- Competing candidates stay Pending until assignment success.
- Payment-window expiry, not one failed attempt, moves the selected request to `PAYMENT_EXPIRED`.
- Frontend claims never create `COMPLETED`, `CONSUMED` or `ASSIGNED` states.
- Payment-session duration is chosen in Sprint 3 and is capped by the remaining BoothHold lifetime.
