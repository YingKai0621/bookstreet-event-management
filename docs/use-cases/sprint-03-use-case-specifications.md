# Sprint 03 Use Case Specifications and Acceptance Criteria

> Approved implementation criteria for initial Booth rental payment and Assignment creation.

> Implemented Sprint 4 overlay: these historical criteria remain valid only with the Event-rooted lock
> and lifecycle boundary in
> [`sprint-04-use-case-specifications.md`](sprint-04-use-case-specifications.md), AC-O01-16.

## UC-E03 Pay & View Booth - initial rental slice

### Goal

Allow the selected Partner to pay the price locked in an Active BoothHold, retry failed or timed-out
attempts while the Hold remains active and backend time is before `expiresAt`, and view the
resulting BoothAssignment after the backend verifies payment success.

### Primary actor

Event Partner

### Supporting actor

Payment Gateway

### Preconditions

- The actor is authenticated with a verified `PARTNER` role.
- The actor represents the PartnerOrganization that owns the selected BoothRequest.
- The BoothRequest is `SELECTED`.
- Its BoothHold is `ACTIVE` and has not reached `expiresAt` according to the backend Clock.

### Main flow

1. The Partner opens the selected BoothRequest and sees the locked price and Hold deadline.
2. The Partner starts payment with a client-generated idempotency key.
3. In one short transaction, the backend verifies ownership, locks/re-checks the Hold, re-checks
   the idempotency key, creates and flushes one `PENDING` BoothPayment for `lockedRentalPrice`, and
   derives `vnp_TxnRef = BSP{boothPaymentId}`.
4. Still in that transaction, the backend locally signs a VNPay checkout expiring at
   `min(now + 15 minutes, hold.expiresAt)` and stores the exact URL and expiry. VNPay PAY URL
   creation performs no remote network call.
5. The Payment and its complete checkout metadata commit atomically.
6. The frontend redirects the Partner to the returned gateway checkout URL.
7. The gateway reports the result to the backend.
8. The backend verifies the signature or queries the gateway server-to-server.
9. For verified success, the backend atomically completes the Payment and request, consumes the Hold, creates the Assignment and closes competing candidates as `NOT_SELECTED`.
10. The Partner views the completed request, Payment history and Active BoothAssignment.

### Alternative and exception flows

- A1. Same idempotency key is repeated: return `200` when the existing Payment has a usable checkout or is terminal; return `202` with the same Pending Payment while it is under reconciliation. Never create a second Payment or unintended second charge.
- A2. Request is not owned by the current Partner: return ownership-safe `404`.
- A3. Request is not `SELECTED`, Hold is not `ACTIVE`, or the Hold is expired: reject initiation and create no Payment.
- A3a. Less than five minutes remains on the Hold: reject a new attempt with `409 BOOTH_HOLD_EXPIRING_SOON`; create no Payment or checkout URL.
- A4. VNPay configuration or local signing fails: mark the new attempt `FAILED` in the same
  transaction and return `502 PAYMENT_GATEWAY_UNAVAILABLE` only after that failure commits. No
  VNPay session exists because URL signing is local. A future provider with ambiguous remote
  initiation must instead remain `PENDING` for reconciliation.
- A5. Gateway reports a safe terminal failure: mark only that attempt `FAILED`; keep request
  `SELECTED` and Hold `ACTIVE` if the window remains open. If later verified success contradicts
  that terminal result, retain the conflict and block another charge pending manual resolution.
- A6. For VNPay, checkout expiry alone does not close the attempt because signed QueryDR may continue returning raw status `01`. Keep the attempt `PENDING` during bounded reconciliation. After two trusted QueryDR results at least five minutes apart both return query response `00`, matching reference/amount and raw status `01`, with no verified success, mark only that attempt `TIMEOUT`; retry remains available only while the Hold is active and backend time is before `expiresAt`.
- A7. Gateway result remains unknown because of a network/query failure or missing callback: keep the attempt `PENDING` and reconcile server-side. Return `202 Accepted` for the initial request or a replay with the same idempotency key. If the Partner submits a new key while that result remains unknown, reject it with `409 PAYMENT_RESULT_UNKNOWN` and create no new attempt.
- A8. Callback is duplicated or reordered: return idempotently without duplicating state transitions.
- A9. Browser returns with a claimed success but backend verification is absent: show processing/unknown; do not create Assignment.
- A10. Hold expiry races with verified success: serialize on the Hold row and follow the approved provider-specific late-callback/reconciliation decision.
- A11. Another successful attempt already settled the Hold: retain the callback for investigation/status reconciliation but create no second Assignment.
- A12. A verified success arrives after local `TIMEOUT`: under the Hold lock, correct and settle only when the Hold remains `ACTIVE`, no later attempt exists, no other Payment succeeded and no Assignment exists. Otherwise persist a reconciliation conflict, create no Assignment and require the approved compensation path.
- A13. A legacy/incomplete Pending Payment has no checkout URL or expiry after the reconciliation
  grace period: mark that attempt `FAILED` with `CHECKOUT_NOT_CREATED`. Because no URL was delivered
  and VNPay created no remote session, a new idempotency key may safely retry while the Hold remains
  eligible.

### Postconditions after verified success

- Exactly one BoothPayment attempt is `SUCCESS` for the initial rental Hold.
- BoothHold is `CONSUMED`.
- Winning BoothRequest is `COMPLETED`.
- Exactly one BoothAssignment for that Hold is `ACTIVE`.
- Competing `PENDING` requests for the same Event Booth are `NOT_SELECTED`.
- Public Event Booth availability is `ASSIGNED` for overlapping allocation time.

### Related rules

- BR-55
- BR-57
- BR-58
- BR-59
- BR-60
- BR-68
- BR-69

## Acceptance Criteria

**AC-E03-01 Start payment from an owned selected request**

```gherkin
Given the verified Partner owns a SELECTED BoothRequest
And its BoothHold is ACTIVE and unexpired
When the Partner starts payment with a new idempotency key
Then one PENDING BoothPayment is created for lockedRentalPrice
And the backend returns a gateway checkout URL
And the checkout session expires no later than the Hold
```

**AC-E03-02 Payment creation is idempotent**

```gherkin
Given a Payment attempt exists for an idempotency key
When the owning Partner repeats payment creation with the same key
Then the backend returns the same BoothPayment
And creates no second attempt
And does not create an unintended second charge
And returns a usable recovered checkout path or an explicit terminal/reconciliation result
And does not leave the Partner with an unusable silent PENDING attempt
And returns HTTP 200 when that Payment has a usable checkout or is terminal
And returns HTTP 202 when that same Payment remains under reconciliation
When that key is reused for a different request
Then the command is rejected as an idempotency conflict
```

**AC-E03-03 Ownership and Hold state are enforced**

```gherkin
Given the request belongs to another Partner
When the current Partner attempts payment
Then the system returns ownership-safe HTTP 404
Given the owned request is not SELECTED or its Hold is not ACTIVE or is expired
When the Partner attempts payment
Then the system returns HTTP 409
And creates no BoothPayment
Given backend time has advanced the Event beyond PUBLISHED or the Event is CANCELLED
When the Partner attempts payment with a new idempotency key
Then the system returns EVENT_NOT_ACCEPTING_PAYMENTS
And creates no BoothPayment
```

**AC-E03-04 Failed attempt preserves the Hold**

```gherkin
Given an unexpired Active Hold has a Pending Payment
When the gateway verifiably reports failure
Then that Payment becomes FAILED
And the request remains SELECTED
And the Hold remains ACTIVE
And the Partner may create a new attempt with a new idempotency key
```

**AC-E03-05 Terminal attempt timeout is not Hold expiry**

```gherkin
Given a VNPay checkout has reached its signed checkout expiry
And no verified success IPN or QueryDR has been received
And two signed QueryDR results made at least five minutes apart each return response code 00
And both results match the transaction reference and amount
And both results report raw transaction status 01
When the bounded reconciliation policy closes that attempt
Then the Payment becomes TIMEOUT
And the latest raw provider result remains available for audit
And the Hold remains ACTIVE while expiresAt is in the future
And the request does not become PAYMENT_EXPIRED
And if expiresAt has already passed, the same transaction expires the Hold and source request only after the Payment reaches TIMEOUT
Given the provider result is still unknown
When the Partner attempts to retry
Then the existing Payment remains PENDING
And the system returns HTTP 409 with PAYMENT_RESULT_UNKNOWN
And creates no new attempt
```

Browser expiry text, one QueryDR result, a transport failure, invalid signature, mismatched reference or amount, or a non-`00` QueryDR response is insufficient to produce `TIMEOUT`.

**AC-E03-06 Browser claims are not trusted**

```gherkin
Given the browser returns from checkout with a success-looking query parameter
And the backend has no verified gateway success
When the result page queries the Payment
Then no BoothAssignment exists
And the backend reports the durable Payment state only
```

**AC-E03-07 Verified success settles atomically**

```gherkin
Given a Pending Payment belongs to an eligible Active Hold
When the backend verifies gateway SUCCESS
Then the Payment becomes SUCCESS
And the Hold becomes CONSUMED
And the winning request becomes COMPLETED
And exactly one ACTIVE BoothAssignment is created
And all competing Pending requests for the same Event Booth become NOT_SELECTED
And all changes commit atomically
```

**AC-E03-08 Duplicate callback is idempotent**

```gherkin
Given a verified callback already settled a Payment successfully
When the same callback is delivered again
Then the backend returns a successful acknowledgement
And no second Assignment is created
And no timestamps or competing request states are corrupted
```

**AC-E03-09 Payment history and Assignment ownership**

```gherkin
Given the Partner owns a BoothRequest with multiple Payment attempts
When the Partner views its payment history
Then every attempt is returned in deterministic newest-first order
And the successful Assignment is visible after settlement
When another Partner requests those resources
Then the system returns ownership-safe HTTP 404
```

**AC-E03-10 Assignment drives availability**

```gherkin
Given verified success created an ACTIVE BoothAssignment
When a user views the Event Booth
Then its derived availability is ASSIGNED
And no new BoothRequest or conflicting selection is accepted for the overlap
```

**AC-E03-11 Success and expiry cannot both win**

```gherkin
Given verified payment processing and Hold expiry run concurrently
When both attempt to finalize the same Hold
Then row locking permits only one approved terminal outcome
And the database never contains both an expired Hold and a new Active Assignment
And an unresolved Pending gateway result prevents unsafe reassignment
And a provider-confirmed charge is never silently discarded
And the operation is safe to retry
```

**AC-E03-12 Gateway secrets remain server-side**

```gherkin
Given payment initiation or callback processing occurs
When requests, responses and application logs are inspected
Then merchant secrets and signature secrets are absent
And callback authenticity is verified before trusted state changes
```

**AC-E03-13 Ambiguous initiation remains observable**

```gherkin
Given the backend durably created a Pending Payment
And the gateway initiation call ends with an ambiguous network result
When the backend responds to the Partner
Then the response identifies the same boothPaymentId
And reports that reconciliation is in progress
And does not report gateway success or create an Assignment
And a new attempt is blocked until the existing attempt is resolved
```

This response is HTTP `202 Accepted`. The completed provider spike reserves the separate
`502 PAYMENT_GATEWAY_UNAVAILABLE` path for definite local configuration/signing failure where no
checkout URL or remote VNPay session can exist.

**AC-E03-14 New keys cannot bypass an existing Pending attempt**

```gherkin
Given an owned Hold already has a Pending Payment with a usable checkout
When the Partner submits a new idempotency key for that Hold
Then the system returns HTTP 409 with PAYMENT_ATTEMPT_ALREADY_PENDING
And creates no new Payment
Given the existing Pending Payment has an unknown gateway result
When the Partner submits a new idempotency key for that Hold
Then the system returns HTTP 409 with PAYMENT_RESULT_UNKNOWN
And creates no new Payment
```

**AC-E03-15 Definite gateway unavailability closes the attempt before responding**

```gherkin
Given the backend durably created a Pending Payment
And trusted gateway/network evidence proves no external transaction or checkout session was created
When initiation cannot continue
Then the backend changes that Payment to FAILED
And commits the state change before responding
And returns HTTP 502 with PAYMENT_GATEWAY_UNAVAILABLE
And the Partner may retry with a new key while the Hold remains Active and backend time is before expiresAt
```

**AC-E03-16 Late success never creates duplicate settlement**

```gherkin
Given a VNPay Payment was locally closed as TIMEOUT or FAILED
When a later signed IPN or trusted QueryDR verifies SUCCESS
Then the backend locks the source Hold before deciding the outcome
And it may correct and settle that Payment only when the Hold is ACTIVE
And no later attempt exists
And no other Payment is SUCCESS
And no Assignment exists
Otherwise the backend persists a reconciliation conflict
And creates no Assignment
And does not silently discard the confirmed charge
And blocks a new Payment attempt until the conflict is resolved
```

**AC-E03-17 Unresolved Payment keeps an expired Hold from being reassigned**

```gherkin
Given an Active Hold has reached expiresAt
And it has a Payment whose trusted provider result is still unknown
When Hold expiry processing runs
Then the Payment remains PENDING
And the Hold remains ACTIVE
And the source request remains SELECTED
And availability remains ON_HOLD
And no competing Hold or Assignment may be created
When reconciliation later obtains a trusted terminal non-success result
Then the backend locks the Hold before the Payment
And closes the Payment attempt
And expires the already-due Hold and source request in the same transaction
```

Within the Sprint 3 payment domain, before QueryDR the worker atomically claims the query slot by
locking `Hold → Payment`, checking
that the attempt is still eligible and recording `lastGatewayQueryAt`. It releases those locks
before network I/O, then uses another short `Hold → Payment` transaction to apply the response.
The implemented Sprint 4 concurrency contract prefixes both short transactions with the Event row; the
gateway call remains outside every database transaction.
Concurrent workers therefore cannot query the same Payment inside VNPay's minimum interval. An
unavailable, invalid or mismatched result never releases the Hold; it retains
`reconciliationRequired` and is retried no sooner than that interval.

**AC-E03-18 Zero-price Booth settles without a gateway**

```gherkin
Given the Organizer selects a valid Pending request
And the locked rental price is exactly 0 VND
When selection commits
Then the Hold is immediately CONSUMED
And the winning request becomes COMPLETED
And exactly one ACTIVE BoothAssignment is created
And competing Pending requests become NOT_SELECTED
And no BoothPayment or VNPay checkout is created
```

A positive Event Booth price below 5,000 VND is rejected during configuration. A price of zero
is the only free value; a price of at least 5,000 VND follows the normal VNPay flow.
