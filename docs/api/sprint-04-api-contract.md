# Sprint 04 API Contract

> Implemented contract for the completed Sprint 4 Event lifecycle hardening and pre-payment Booth
> release scope. Completion evidence is in
> [`SPRINT_04_COMPLETION_REPORT.md`](../development/SPRINT_04_COMPLETION_REPORT.md).

## 1 General conventions

- Base path: `/api/v1`.
- Authentication uses the existing server-side Session.
- State-changing browser requests require credentials and CSRF.
- Time is ISO 8601 and stored as UTC instants.
- Ownership-safe lookup returns `404` for absent and foreign-owned resources.
- Every Event-scoped mutation locks the Event first and rechecks status/backend time. Booth/payment
  mutations then preserve the shared order `Event → Booth (if needed) → EventBoothConfig (if
  needed) → Hold → Payment by ascending id → BoothRequest`.
- V1–V7 response fields remain backward compatible unless this contract explicitly adds a field.

## 2 Event response additions

Both the Organizer `EventResponse` and public `EventSummaryResponse` add the following fields. The
public list does not return Cancelled Events, so these values are normally `null` there; public
detail uses them to explain a cancelled link.

```json
{
  "eventId": 21,
  "status": "CANCELLED",
  "cancelledAt": "2026-10-10T03:20:00Z",
  "cancellationReason": "Địa điểm không thể tiếp tục tổ chức theo kế hoạch."
}
```

`cancelledAt` and `cancellationReason` are `null` unless status is `CANCELLED`.
`cancellationReason` is public content: public detail returns it verbatim after normal output
escaping. Organizer clients must not put credentials, incident secrets or private financial data in
this field.

## 3 Organizer Event APIs

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/organizer/events/{eventId}` | Update Draft or eligible published Event fields |
| DELETE | `/organizer/events/{eventId}` | Delete an owned Draft |
| POST | `/organizer/events/{eventId}/cancel` | Cancel an eligible published Event |

### PATCH `/organizer/events/{eventId}`

The existing presence-aware PATCH remains. Sprint 4 expands its status rules.

- `DRAFT`: all existing mutable fields are allowed.
- `PUBLISHED` with no external participation represented by the active schema (no Partner
  application and no Booth request/Hold/Payment/Assignment): descriptive and operational fields
  are allowed.
- `PUBLISHED` with external participation: only `name`, `description`, `bannerUrl`.
- `ONGOING`: only `name`, `description`, `bannerUrl`.
- `COMPLETED` or `CANCELLED`: no updates.

An operational patch also requires backend time to remain before the current `startAt`. A
*still-open deadline* is a configured deadline/cutoff not yet elapsed when the command begins. If a
deadline/cutoff is supplied in the patch, it must remain strictly in the future; an elapsed deadline
cannot be reopened. The merged Event must also satisfy:

```text
boothRequestDeadlineAt + boothPaymentWindowMinutes <= startAt
```

Equality is valid. A violation returns `422 EVENT_TIME_INVALID` and identifies the offending timing
field. Existing Holds keep their persisted `expiresAt`.

A mixed patch containing one forbidden field fails atomically.

Additional errors:

- `409 EVENT_OPERATIONAL_FIELDS_LOCKED`
- `409 EVENT_NOT_EDITABLE`

Acceptance Criteria: AC-O01-03 through AC-O01-05.

### DELETE `/organizer/events/{eventId}`

Request body: none.

Success: `204 No Content`.

Behavior:

- requires owner and `DRAFT` under a lock;
- deletes Event-scoped Booth configuration first in the same transaction;
- never deletes shared physical Booth/Location data;
- never deletes published history.

Errors:

- `404 EVENT_NOT_FOUND`
- `409 EVENT_NOT_DRAFT`
- `409 EVENT_HAS_DEPENDENCIES`

Acceptance Criteria: AC-O01-01 and AC-O01-02.

### POST `/organizer/events/{eventId}/cancel`

Request:

```json
{
  "reason": "Địa điểm không thể tiếp tục tổ chức theo kế hoạch."
}
```

`reason` is trimmed, internal whitespace is normalized and the result must contain 10–500
characters.

Success: `200 OK` with the updated Event response.

Behavior:

- requires an owned `PUBLISHED` Event for the first transition, with the idempotent `CANCELLED`
  retry exception below;
- rejects every Payment `PENDING`/`SUCCESS` and every reconciliation-required record;
- rejects every BoothAssignment, including zero-price settlement;
- atomically cancels open Booth requests and releases their Active Holds;
- sends affected-Partner email only after commit;
- selects recipients from verified emails of representative Users for PartnerOrganization
  applications in `PENDING` or `APPROVED`, deduplicates case-insensitively and skips
  missing/unverified addresses;
- treats an owning Organizer's retry against an already `CANCELLED` Event as `200 OK`, returning the
  original state without changing metadata, repeating cascades or sending email again.

Request-body validation runs for both first attempts and retries. A malformed retry reason still
returns `400 VALIDATION_ERROR`; a syntactically valid retry reason is ignored when the Event is
already `CANCELLED`.

Errors:

- `400 VALIDATION_ERROR`
- `404 EVENT_NOT_FOUND`
- `409 EVENT_NOT_CANCELLABLE`
- `409 EVENT_PAYMENT_PENDING`
- `409 EVENT_PAYMENT_RECONCILIATION_REQUIRED`
- `409 EVENT_HAS_SUCCESSFUL_PAYMENT`
- `409 EVENT_HAS_ASSIGNMENT`

Acceptance Criteria: AC-O01-06 through AC-O01-11.

Concurrency, idempotency and lifecycle/payment-boundary Acceptance Criteria: AC-O01-12 through
AC-O01-16.

## 4 Partner Booth Request API

### POST `/partner/booth-requests/{boothRequestId}/withdraw`

Request body: none.

Success: `200 OK` with the updated Booth request.

Sprint 4 behavior:

- `PENDING`: transition to `WITHDRAWN` as before;
- eligible `SELECTED`: transition to `WITHDRAWN` and release its Active Hold atomically;
- `WITHDRAWN`: idempotently return the current request without changing timestamps.

A Selected request is eligible only when it has no `PENDING` or `SUCCESS` Payment, no
reconciliation-required evidence and no Assignment. Terminal, non-conflicting `FAILED` and
`TIMEOUT` attempts are permitted.

Errors:

- `404 BOOTH_REQUEST_NOT_FOUND`
- `409 BOOTH_REQUEST_NOT_WITHDRAWABLE`
- `409 BOOTH_HOLD_NOT_ACTIVE`
- `409 PAYMENT_ATTEMPT_ALREADY_PENDING`
- `409 PAYMENT_RESULT_UNKNOWN`
- `409 PAYMENT_ALREADY_COMPLETED`
- `409 BOOTH_ALREADY_ASSIGNED`

`PAYMENT_ATTEMPT_ALREADY_PENDING` means a usable checkout is still open;
`PAYMENT_RESULT_UNKNOWN` means gateway evidence is unresolved or requires reconciliation.

For this withdrawal endpoint only, Sprint 4 replaces the legacy catch-all
`BOOTH_REQUEST_NOT_PENDING` response with `BOOTH_REQUEST_NOT_WITHDRAWABLE`, because `SELECTED` is now
an eligible source state. Organizer selection/rejection endpoints keep their existing
`BOOTH_REQUEST_NOT_PENDING` contract.

Acceptance Criteria: AC-E02-01 through AC-E02-07.

## 5 Public Event APIs

### GET `/events`

Default discovery returns `PUBLISHED` and `ONGOING` Events.

Optional query:

- `status=PUBLISHED|ONGOING|COMPLETED`

`DRAFT` and `CANCELLED` are invalid discovery filters.
An unsupported or non-discoverable status value returns `400 INVALID_EVENT_STATUS_FILTER`.

### GET `/events/{eventId}`

Returns an Event that has been published and is now `PUBLISHED`, `ONGOING`, `COMPLETED` or
`CANCELLED`. Draft Events remain `404`.

## 6 Booth request response addition

Sprint 4 adds `CANCELLED` to the response status set and adds:

```json
{
  "status": "CANCELLED",
  "cancelledAt": "2026-10-10T03:20:00Z"
}
```

`cancelledAt` is used only for system cancellation caused by Event cancellation. Partner
withdrawal continues to use `WITHDRAWN` and `withdrawnAt`.

## 7 Payment resolution across Event start

Sprint 4 does not add a Payment endpoint or change the Sprint 3 response shape. It tightens the
existing initiation, IPN, QueryDR and expiry behavior at the Event lifecycle boundary:

- the scheduled Hold `expiresAt` is no later than `startAt`;
- unresolved `PENDING` or reconciliation-required evidence may keep the Hold `ACTIVE` after
  `expiresAt` and into `ONGOING` while blocking a new attempt/reassignment;
- Event lifecycle still advances from backend time;
- trusted success may settle normally while Event status is `PUBLISHED` or `ONGOING`;
- trusted success after `COMPLETED` or `CANCELLED` records reconciliation-required evidence and
  creates no Assignment;
- trusted terminal failure/timeout lets the normal expiry flow close the Hold/request, with no
  automatic candidate selection after the Booth request deadline.

Payment mutation rechecks effective Event status under the Event lock. No gateway/network call is
made while database locks are held.

Acceptance Criterion: AC-O01-16.

## 8 Compatibility and exclusions

- Sprint 3 Payment/IPN/QueryDR endpoint and request/response shapes remain unchanged; their
  lifecycle guards follow section 7.
- No refund, Booth-change, Booth-assignment cancellation or whole-Event Partner-withdrawal endpoint
  is introduced.
- Existing `REFUND`-capable database fields are not exposed as an active workflow.
- Cancellation cannot be used as a shortcut around reconciliation.
- A contradictory provider success received after an otherwise safe release is retained as
  reconciliation-required evidence for manual handling; it never silently recreates an Assignment.

