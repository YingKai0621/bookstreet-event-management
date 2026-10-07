# Sprint 03 API Contract

> Design draft. Provider-specific callback fields remain pending until the gateway is selected.

## 1 Purpose

This contract extends the Sprint 2 Booth APIs with initial rental Payment attempts and Partner-owned BoothAssignment queries. It does not define refunds, Booth changes or Booth cancellation.

## 2 General conventions

- Base path: `/api/v1`
- Authentication: existing Spring Security server-side Session
- State-changing browser requests require CSRF and credentials
- Ownership comes from the authenticated principal
- Money uses JSON decimal numbers and Java `BigDecimal`
- Time uses ISO 8601 instants stored in UTC
- `Idempotency-Key` is a required UUID header for payment creation
- The exact gateway webhook path is CSRF-exempt only after its provider is selected
- Browser redirect data never proves payment success

## 3 Response models

### Booth Payment response

```json
{
  "boothPaymentId": 81,
  "boothRequestId": 42,
  "boothHoldId": 19,
  "transactionType": "PAYMENT",
  "purpose": "INITIAL_BOOTH_RENTAL",
  "amount": 2000000,
  "status": "PENDING",
  "idempotencyKey": "47d85df4-c665-4a0d-844b-544f34c6d8fd",
  "gatewayProvider": "TBD",
  "gatewayTransactionRef": null,
  "failureCode": null,
  "failureMessage": null,
  "createdAt": "2026-10-08T03:00:00Z",
  "updatedAt": "2026-10-08T03:00:00Z",
  "completedAt": null
}
```

Allowed initial-payment statuses:

- `PENDING`
- `SUCCESS`
- `FAILED`
- `TIMEOUT`

`completedAt` is `null` while the Payment is `PENDING`. It is recorded when the Payment reaches `SUCCESS`, `FAILED` or `TIMEOUT`.

### Payment initiation response

```json
{
  "payment": {
    "boothPaymentId": 81,
    "boothRequestId": 42,
    "boothHoldId": 19,
    "transactionType": "PAYMENT",
    "purpose": "INITIAL_BOOTH_RENTAL",
    "amount": 2000000,
    "status": "PENDING",
    "idempotencyKey": "47d85df4-c665-4a0d-844b-544f34c6d8fd",
    "gatewayProvider": "TBD",
    "gatewayTransactionRef": null,
    "failureCode": null,
    "failureMessage": null,
    "createdAt": "2026-10-08T03:00:00Z",
    "updatedAt": "2026-10-08T03:00:00Z",
    "completedAt": null
  },
  "checkoutUrl": "https://sandbox-gateway.example/checkout/...",
  "sessionExpiresAt": "2026-10-08T03:15:00Z"
}
```

`checkoutUrl` is returned only by successful initiation and is not treated as payment-success proof. `sessionExpiresAt` must be no later than the source Hold's `expiresAt`.

Before V7 is finalized, the selected provider spike must choose one recoverable replay design: persist `checkoutUrl` and `checkoutExpiresAt`, recover them from the gateway, or safely recreate the same provider session for the same Payment/reference. A replay must not leave the Partner with a `PENDING` attempt that cannot be opened or safely resolved.

`INITIAL_BOOTH_RENTAL` is a provisional purpose code in this draft. Its final value must be approved before V7 and Java enums are implemented.

### Ambiguous initiation response

When the Payment is already durable but the gateway initiation result is unknown, the response is `202 Accepted`:

```json
{
  "payment": {
    "boothPaymentId": 81,
    "boothRequestId": 42,
    "boothHoldId": 19,
    "transactionType": "PAYMENT",
    "purpose": "INITIAL_BOOTH_RENTAL",
    "amount": 2000000,
    "status": "PENDING",
    "idempotencyKey": "47d85df4-c665-4a0d-844b-544f34c6d8fd",
    "gatewayProvider": "TBD",
    "gatewayTransactionRef": null,
    "failureCode": null,
    "failureMessage": null,
    "createdAt": "2026-10-08T03:00:00Z",
    "updatedAt": "2026-10-08T03:00:05Z",
    "completedAt": null
  },
  "checkoutUrl": null,
  "sessionExpiresAt": null,
  "resolution": "RECONCILING"
}
```

This response lets the frontend retain `boothPaymentId` and poll the durable Payment. The provider spike must verify what trusted evidence permits `502` instead and whether `resolution` belongs in the final response model.

### Booth Assignment response

```json
{
  "boothAssignmentId": 27,
  "boothHoldId": 19,
  "boothRequestId": 42,
  "eventId": 12,
  "boothId": 5,
  "boothCode": "A05",
  "partnerOrganizationId": 8,
  "partnerOrganizationName": "Demo Books",
  "lockedRentalPrice": 2000000,
  "qrToken": "ac898499-51b1-4d6c-a4bb-d33d81fb3034",
  "coverImageUrl": null,
  "status": "ACTIVE",
  "assignedAt": "2026-10-08T03:04:00Z",
  "releasedAt": null,
  "releaseReason": null
}
```

Sprint 3 creates only `ACTIVE` Assignments. QR scanning is outside this Sprint.

## 4 Partner APIs

All endpoints require a verified `PARTNER` role and ownership of the BoothRequest through the current PartnerOrganization.

| Method | Path | Purpose |
|---|---|---|
| POST | `/partner/booth-requests/{boothRequestId}/payments` | Create or replay an idempotent payment attempt |
| GET | `/partner/booth-requests/{boothRequestId}/payments` | List owned payment attempts |
| GET | `/partner/booth-payments/{boothPaymentId}` | Get one owned payment attempt |
| GET | `/partner/booth-requests/{boothRequestId}/assignment` | Get the Assignment created from an owned request |

### POST `/partner/booth-requests/{boothRequestId}/payments`

Headers:

```text
Idempotency-Key: 47d85df4-c665-4a0d-844b-544f34c6d8fd
```

Request body: none.

Behavior:

- Derives Partner ownership from the Session.
- Requires a `SELECTED` request with an unexpired `ACTIVE` Hold.
- Uses `BoothHold.lockedRentalPrice`; the client cannot submit an amount.
- The first accepted key creates a `PENDING` BoothPayment and gateway checkout session.
- The session-creation request includes a durable merchant-order correlation identifier already linked to the committed Payment. The provider must return that identifier in callbacks or query results so the backend can locate the Payment even if `gatewayTransactionRef` has not yet been persisted.
- Repeating the same key for the same owned request returns the original Payment and never creates a second attempt. The approved provider design must also return a usable checkout URL, recover the existing provider session, or return a terminal/reconciliation response that does not strand the Partner.
- Reusing the key for another request is rejected instead of returning unrelated Payment data.
- A retry after `FAILED` or `TIMEOUT` uses a new idempotency key.
- Ambiguous earlier attempts are queried according to the provider policy before a retry is created.
- A network timeout or unavailable gateway query leaves the attempt `PENDING`; it is not converted to domain `TIMEOUT` and blocks another attempt with `PAYMENT_RESULT_UNKNOWN`.
- Domain `TIMEOUT` is used only after trusted provider evidence confirms that the transaction/session expired and cannot later succeed.
- The backend commits the idempotency/Payment record before the gateway call, does not hold a database transaction open during the network call, and persists the provider result afterward.
- If the gateway is definitely unavailable and definitely created no external transaction/session, the backend commits the Payment transition from `PENDING` to `FAILED` before returning `502 PAYMENT_GATEWAY_UNAVAILABLE`.
- An ambiguous initiation result remains `PENDING` for reconciliation and must not be reported as a definite gateway failure.

Initiation and idempotent replay response mapping:

- `201 Created`: gateway session was created and a checkout URL is returned.
- `200 OK`: the same idempotency key returns its existing Payment when the checkout remains usable or the Payment is already terminal.
- `202 Accepted`: the same idempotency key returns its existing `PENDING` Payment while gateway reconciliation is still in progress; the body includes `boothPaymentId` for polling.
- `409 PAYMENT_ATTEMPT_ALREADY_PENDING`: a new idempotency key is rejected because another Pending Payment for the Hold already has a usable checkout.
- `409 PAYMENT_RESULT_UNKNOWN`: a new idempotency key is rejected because another Pending Payment has an unknown gateway result under reconciliation.
- `502 PAYMENT_GATEWAY_UNAVAILABLE`: the gateway is definitely unavailable and no external transaction/session was created; the corresponding durable Payment is committed as `FAILED` before this response is returned.

Errors:

- `400 INVALID_IDEMPOTENCY_KEY`
- `404 BOOTH_REQUEST_NOT_FOUND`
- `409 BOOTH_REQUEST_NOT_SELECTED`
- `409 BOOTH_HOLD_NOT_ACTIVE`
- `409 BOOTH_HOLD_EXPIRED`
- `409 PAYMENT_ALREADY_COMPLETED`
- `409 PAYMENT_RESULT_UNKNOWN`
- `409 PAYMENT_ATTEMPT_ALREADY_PENDING`
- `409 IDEMPOTENCY_KEY_REUSED`
- `502 PAYMENT_GATEWAY_UNAVAILABLE`

Acceptance Criteria: AC-E03-01 through AC-E03-05 and AC-E03-13 through AC-E03-15.

### GET `/partner/booth-requests/{boothRequestId}/payments`

Query:

- `page`, default `0`
- `size`, default `20`, maximum `100`
- `sort`, allowed fields: `createdAt`, `status`, `amount`; default `createdAt,desc`

Response: paginated Booth Payment responses owned by the current Partner.

Errors:

- `400 INVALID_SORT`
- `404 BOOTH_REQUEST_NOT_FOUND`

### GET `/partner/booth-payments/{boothPaymentId}`

Response: one owned Booth Payment response.

Errors:

- `404 BOOTH_PAYMENT_NOT_FOUND`

### GET `/partner/booth-requests/{boothRequestId}/assignment`

Response: one Booth Assignment response after verified success.

Errors:

- `404 BOOTH_REQUEST_NOT_FOUND`
- `404 BOOTH_ASSIGNMENT_NOT_FOUND`

Acceptance Criteria: AC-E03-09.

## 5 Gateway callback contract

The exact provider route, request body, headers, signature algorithm and acknowledgement response are pending the gateway decision. The approved implementation must satisfy all of the following independent requirements:

- The endpoint is public only because the gateway cannot use the browser Session.
- CSRF exemption is limited to the exact callback path.
- The backend verifies the provider signature and/or performs a server-to-server status query.
- Callback/query correlation uses the durable merchant-order identifier sent during initiation; it cannot depend only on `gatewayTransactionRef` having been saved first.
- The backend maps provider results into `SUCCESS`, `FAILED` or `TIMEOUT` without trusting browser data.
- `TIMEOUT` requires provider-confirmed terminal expiry; an unknown result stays `PENDING` for query/reconciliation.
- Callback processing is idempotent.
- Unknown Payment references reveal no internal data.
- Secrets and raw sensitive payment data are not logged.
- A verified success invokes the atomic settlement described by AC-E03-07.

Acceptance Criteria: AC-E03-06 through AC-E03-08 and AC-E03-11 through AC-E03-12.

## 6 Existing response changes

Sprint 2 response shapes remain backward compatible.

- Booth request responses may now produce `COMPLETED` and `NOT_SELECTED`.
- Hold responses may now produce `CONSUMED` and should expose `consumedAt` when present.
- Event Booth responses now actively produce `ASSIGNED` when an overlapping Active Assignment exists.
- A selected BoothRequest detail may include a lightweight payment summary, but full history remains under the Payment endpoints.

## 7 Provider-dependent items not yet approved

- Concrete `gatewayProvider` value.
- Durable merchant-order correlation format and whether V7 needs `provider_request_id` or can use `boothPaymentId` directly.
- Callback path and payload.
- Checkout/session creation fields.
- Session-duration cap and return/cancel URLs.
- Provider status-to-domain status mapping.
- Query-before-retry policy and timeout duration.
- Late verified-success behavior when callback delivery crosses Hold expiry.
- Checkout URL/session recovery strategy for idempotent replay and its possible V7 columns.
- Expiry-job behavior while a Payment remains unresolved `PENDING`.
- Compensating/refund handling if a provider confirms a charge after Assignment can no longer be created.
- Provider-specific evidence that safely distinguishes ambiguous reconciliation from definite unavailability where no external transaction/session was created.

No implementation should hard-code examples marked `TBD`.
