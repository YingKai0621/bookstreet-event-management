# Sprint 03 API Contract

> Approved implementation contract for the Sprint 3 VNPay Sandbox integration.

> Implemented Sprint 4 overlay: endpoint and payload shapes below remain unchanged, but Payment
> mutations use the Event-rooted lock and lifecycle guards in
> [`sprint-04-api-contract.md`](sprint-04-api-contract.md#7-payment-resolution-across-event-start).

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
- `GET /api/v1/payments/vnpay/ipn` is public and CSRF-exempt only for that exact path
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
  "gatewayProvider": "VNPAY",
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
    "gatewayProvider": "VNPAY",
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

`checkoutUrl` is returned only by successful initiation and is not treated as payment-success proof. For VNPay, `sessionExpiresAt = min(now + 15 minutes, hold.expiresAt)`. A new checkout is rejected when less than five minutes remains on the Hold.

The approved replay design persists the exact signed `checkoutUrl` and `checkoutExpiresAt`. A same-key replay returns that URL while it remains usable and never signs a replacement attempt.

`INITIAL_BOOTH_RENTAL` is the approved stable purpose code.

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
    "gatewayProvider": "VNPAY",
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

This response lets the frontend retain `boothPaymentId` and poll the durable Payment. The
completed provider spike established that `502 PAYMENT_GATEWAY_UNAVAILABLE` is reserved for a
definite local configuration/signing failure before any checkout can be delivered; `resolution`
is retained so the frontend can distinguish this `202` reconciliation response.

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
- The first accepted key creates a `PENDING` BoothPayment and a complete signed checkout URL.
- The backend inserts and flushes the Payment inside the transaction to obtain its durable ID, then
  uses that ID as the provider correlation identifier before the transaction commits.
- For VNPay, that correlation identifier is `vnp_TxnRef = BSP{boothPaymentId}`;
  `gatewayTransactionRef` stores the separate `vnp_TransactionNo` returned later by VNPay.
- The exact signed checkout URL and `checkoutExpiresAt` are persisted. Replaying the same idempotency key while the URL remains usable returns that same URL and never signs a second attempt.
- Repeating the same key for the same owned request returns the original Payment and never creates
  a second attempt. It returns the stored URL while usable, the terminal Payment when already
  closed, or an explicit `202 RECONCILING` response when the result is still unknown.
- Reusing the key for another request is rejected instead of returning unrelated Payment data.
- A retry after an ordinary `FAILED` or `TIMEOUT` uses a new idempotency key. A terminal attempt
  carrying contradictory verified-success evidence has `reconciliationRequired=true` and blocks
  new attempts with `PAYMENT_RESULT_UNKNOWN` until manual resolution.
- Ambiguous earlier attempts are queried according to the provider policy before a retry is created.
- A network timeout or unavailable gateway query leaves the attempt `PENDING`; it is not converted to domain `TIMEOUT` and blocks another attempt with `PAYMENT_RESULT_UNKNOWN`.
- VNPay raw transaction status `01` is not directly mapped to `FAILED` or `TIMEOUT`. After checkout expiry, domain `TIMEOUT` requires two trusted QueryDR results at least five minutes apart, each with valid signature, query response code `00`, matching transaction reference and amount, raw status `01`, and no verified success result. Any weaker evidence keeps the attempt `PENDING`.
- VNPay PAY URL construction and HMAC signing are local and perform no network call. The new
  Payment, signed URL and checkout expiry commit atomically, so a visible Pending attempt always has
  recoverable checkout metadata.
- If VNPay configuration or local signing fails, the same transaction records the attempt as
  `FAILED`; `502 PAYMENT_GATEWAY_UNAVAILABLE` is returned only after that transaction commits.
- A pre-existing incomplete Pending row without a checkout URL or expiry is marked `FAILED` after
  the reconciliation grace period. No external session exists and no checkout URL was delivered,
  so this cleanup cannot abandon a VNPay charge.
- An ambiguous initiation result remains `PENDING` for reconciliation and must not be reported as a definite gateway failure.

Initiation and idempotent replay response mapping:

- `201 Created`: a durable Payment and its signed checkout URL were created atomically.
- `200 OK`: the same idempotency key returns its existing Payment when the checkout remains usable or the Payment is already terminal.
- `202 Accepted`: the same idempotency key returns its existing `PENDING` Payment while gateway reconciliation is still in progress; the body includes `boothPaymentId` for polling.
- `409 PAYMENT_ATTEMPT_ALREADY_PENDING`: a new idempotency key is rejected because another Pending Payment for the Hold already has a usable checkout.
- `409 PAYMENT_RESULT_UNKNOWN`: a new idempotency key is rejected because another Pending Payment has an unknown gateway result under reconciliation.
- `502 PAYMENT_GATEWAY_UNAVAILABLE`: the gateway is definitely unavailable and no external transaction/session was created; the corresponding durable Payment is committed as `FAILED` before this response is returned.

VNPay PAY creates and signs its checkout URL locally. It has no remote session-creation call in this integration, so a new valid attempt normally returns `201`; local signing/configuration failure is a definite no-session `502`, while `202` applies to same-key replay of an expired checkout still under reconciliation.

Errors:

- `400 INVALID_IDEMPOTENCY_KEY`
- `404 BOOTH_REQUEST_NOT_FOUND`
- `409 EVENT_NOT_ACCEPTING_PAYMENTS`
- `409 BOOTH_REQUEST_NOT_SELECTED`
- `409 BOOTH_HOLD_NOT_ACTIVE`
- `409 BOOTH_HOLD_EXPIRED`
- `409 BOOTH_HOLD_EXPIRING_SOON`
- `409 PAYMENT_ALREADY_COMPLETED`
- `409 PAYMENT_RESULT_UNKNOWN`
- `409 PAYMENT_ATTEMPT_ALREADY_PENDING`
- `409 IDEMPOTENCY_KEY_REUSED`
- `502 PAYMENT_GATEWAY_UNAVAILABLE`

Acceptance Criteria: AC-E03-01 through AC-E03-05 and AC-E03-13 through AC-E03-15.

### Hold expiry while a Payment is unresolved

- A due Hold with no unresolved `PENDING` Payment follows the existing expiry flow.
- A due Hold with an unresolved `PENDING` Payment is not changed to `EXPIRED`. It remains `ACTIVE`, its source request remains `SELECTED`, and all payment-initiation endpoints reject new attempts.
- Event Booth availability and Organizer selection treat every `ACTIVE` Hold as blocking even when `expiresAt` is in the past. The expiry/reconciliation services, not read queries, own the transition to `EXPIRED`.
- Before QueryDR, the reconciliation worker opens a short transaction and locks `Hold → Payment`
  within the Sprint 3 payment domain,
  re-checks eligibility and records `lastGatewayQueryAt` to claim the provider-query interval. It
  releases those locks before the network call, then opens another short `Hold → Payment`
  transaction and applies only the still-current trusted result. Concurrent workers therefore
  cannot issue duplicate QueryDR calls inside the configured minimum interval.
- Under the implemented Sprint 4 contract, both short reconciliation transactions first lock the Event
  row; the network call remains outside the transaction.
- Trusted success settles normally. Trusted terminal failure or the approved two-query `TIMEOUT` closes the attempt and expires the already-due Hold and source request atomically.
- Transport errors, invalid signatures, mismatched reference/amount or other unknown results retain `PENDING` and `reconciliationRequired`; they never restore Booth availability.

Acceptance Criteria: AC-E03-11 and AC-E03-17.

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

### GET `/payments/vnpay/ipn`

The public VNPay callback is `/api/v1/payments/vnpay/ipn`. It accepts VNPay query parameters,
verifies `vnp_SecureHash` with HMAC-SHA512 over the canonical signed fields and returns the VNPay
acknowledgement shape `{"RspCode":"..","Message":".."}`.

Status mapping:

- signed `vnp_ResponseCode=00` and `vnp_TransactionStatus=00`: `SUCCESS` and atomic settlement;
- raw transaction status `01`: retain `PENDING` and reconcile with QueryDR;
- signed `24/02`: customer cancellation, mapped to `FAILED`;
- transaction status `02`: `FAILED` (with response/status pair `24/02` recorded specifically as
  customer cancellation);
- status `04` remains `PENDING` because it can represent a reversal after the customer was
  debited; suspicious or flow-inapplicable statuses such as `07` and refund status `09` also remain
  under reconciliation instead of enabling an unsafe retry;
- unknown or inconsistent combinations: retain `PENDING`, set `reconciliationRequired` and
  persist a safe diagnostic without trusting the callback.

Acknowledgements use `00/Confirm Success`, `01/Order not Found`, `02/Order already confirmed`,
`04/Invalid Amount` and `97/Invalid Checksum` as applicable.

The implementation must satisfy all of the following independent requirements:

- The endpoint is public only because the gateway cannot use the browser Session.
- CSRF exemption is limited to the exact callback path.
- The backend verifies the provider signature and/or performs a server-to-server status query.
- Callback/query correlation uses the durable merchant-order identifier sent during initiation; it cannot depend only on `gatewayTransactionRef` having been saved first.
- The backend maps provider results into `SUCCESS`, `FAILED` or `TIMEOUT` without trusting browser data.
- VNPay checkout expiry initially remains `PENDING`. Domain `TIMEOUT` follows the approved two-query bounded reconciliation rule; the raw provider status remains stored separately for audit.
- Callback processing is idempotent.
- A verified success after local `TIMEOUT` follows AC-E03-16. It is never treated as an ordinary duplicate and its evidence must be retained even when automatic settlement is unsafe.
- A verified success that contradicts any other terminal local attempt is likewise retained as a
  reconciliation conflict and blocks another charge; it is never silently discarded.
- Unknown Payment references reveal no internal data.
- Secrets and raw sensitive payment data are not logged.
- A verified success invokes the atomic settlement described by AC-E03-07.

Acceptance Criteria: AC-E03-06 through AC-E03-08 and AC-E03-11 through AC-E03-12.

## 6 Existing response changes

Sprint 2 response shapes remain backward compatible.

- Booth request responses may now produce `COMPLETED` and `NOT_SELECTED`.
- Hold responses may now produce `CONSUMED` and should expose `consumedAt` when present.
- Event Booth responses now actively produce `ASSIGNED` when an overlapping Active Assignment exists.
- Disabling an Event Booth configuration or deactivating a physical Booth with an Active
  Assignment returns `409 BOOTH_HAS_ACTIVE_ASSIGNMENT`. Existing Active-Hold conflicts retain
  the Sprint 2 code `409 BOOTH_HAS_ACTIVE_HOLD`.
- A selected BoothRequest detail may include a lightweight payment summary, but full history remains under the Payment endpoints.

## 7 Operational follow-up outside the implementation gate

- Alerting for a Payment whose QueryDR remains repeatedly unavailable.
- Manual refund processing for an unsafe verified late charge retained as a reconciliation
  conflict. Automatic refund execution is outside Sprint 3.
- The environment-specific browser Return URL is configuration; browser Return data remains
  display-only and never settles a Payment.
