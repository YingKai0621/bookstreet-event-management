# Sprint 03 Booth Payment and Assignment

> Approved implementation baseline. VNPay Sandbox is the Sprint 3 provider, the local spike is complete, and V7 implementation is authorized on the Sprint 3 branch.

> Implemented Sprint 4 overlay: Payment transactions acquire/recheck the Event root before existing
> domain locks. Unresolved evidence may keep a Hold Active across Event start. Trusted success may
> create an Assignment while the Event is Published/Ongoing; after Completed/Cancelled it is kept
> for manual reconciliation and creates no Assignment. See `sprint-04.md` section 5.4.

## 1 Purpose

Sprint 3 completes the successful Booth allocation path that Sprint 2 intentionally stopped before:

```text
BoothRequest SELECTED + BoothHold ACTIVE
→ Partner creates a real gateway payment attempt for lockedRentalPrice
→ backend verifies the gateway result
→ BoothPayment SUCCESS
→ BoothHold CONSUMED
→ BoothRequest COMPLETED
→ BoothAssignment ACTIVE
→ competing PENDING requests become NOT_SELECTED
```

The Sprint must preserve the Sprint 2 price lock, Hold expiry, ownership and concurrency rules. The browser must never be able to claim payment success or create an Assignment directly.

## 2 Included Use Case slice

| ID | Use Case | Sprint 3 delivery |
|---|---|---|
| UC-E03 | Pay & View Booth | Create and retry Booth payment attempts while a selected Hold is active and its scheduled payment window is open; view payment history and the resulting BoothAssignment |
| UC-E02 | Manage Booth Request | Surface `COMPLETED` and `NOT_SELECTED` states produced by verified payment success |
| UC-O04 | Review Booth Requests | Complete the selected winner and close competing candidates after assignment creation |

### 2.1 Baseline verification

The current source-of-truth documents were rechecked before this draft was updated:

- `06_Use_Case_List.md` defines `UC-E03` as **Pay & View Booth**. It does not define `UC-E09` or `UC-O11`.
- BR-20 defines Organizer selection and competing-candidate behavior; it does not release a Hold after a failed attempt.
- BR-58 permits separate `FAILED` or terminal `TIMEOUT` attempts to be retried while the Hold remains Active.
- BR-59 requires backend verification and forbids trusting frontend success claims.
- BR-60 states that only payment-window/Hold expiry releases the Hold and requires query-before-retry for an unknown result.
- The current demo workflow uses the same retry-until-Hold-expiry model.

Therefore this Sprint does not rename or split the approved Use Case and does not rewrite those Business Rules. Sprint 3 must refine the meaning of an attempt `TIMEOUT` without changing the approved Hold lifecycle.

## 3 Scope lock

### In scope

- One VNPay Sandbox adapter.
- Initial Booth rental payments only.
- One durable `BoothPayment` record per gateway attempt.
- Required idempotency for payment creation and gateway callbacks.
- Server-side callback/webhook signature verification or server-side gateway status verification.
- Retry after `FAILED` or attempt `TIMEOUT` while the Hold remains active and backend time is before
  `expiresAt`.
- Atomic payment-success settlement that creates one `BoothAssignment`.
- Partner-owned payment history and Assignment queries.
- Derived Booth availability becomes `ASSIGNED` for overlapping Active Assignments.
- Integration, authorization, idempotency, expiry-race and concurrency tests.
- Frontend checkout handoff, payment-result screen, payment history and Assignment view.

### Out of scope

- Refund execution.
- Booth change or Booth cancellation.
- Partner withdrawal from the whole Event.
- Event-cancellation refunds.
- Activity, Booth Visit, points, badges and attendance.
- Admin UI for gateway credentials.
- Multiple production gateway providers in the same Sprint.
- Trusting a browser redirect or browser request as proof of payment.

Sprint 4 subsequently moved these flows to Post-MVP reference scope. This Sprint 3 document remains
the historical contract for the implemented payment-to-assignment path and does not authorize them.

## 4 Preserved Sprint 2 decisions

- `BoothHold.lockedRentalPrice` is the amount for every attempt in that Hold.
- A later EventBoothConfig price change never changes an existing Hold or Payment amount.
- A failed or timed-out attempt does not expire or release the Hold.
- Only `BoothHold.expiresAt` ends the payment window.
- A VNPay checkout expires at `min(now + 15 minutes, BoothHold.expiresAt)`. Do not start a new checkout with less than five minutes remaining on the Hold.
- Competing candidates stay `PENDING` until verified success creates the Assignment.
- Hold expiry changes only the selected request to `PAYMENT_EXPIRED`; competing requests remain `PENDING`.
- Session authentication, CSRF and ownership continue to follow the existing browser-security contract.
- PostgreSQL is the source of truth; Redis is not used as payment or Assignment storage.
- A zero-price Booth bypasses VNPay and is settled atomically during Organizer selection. A
  positive rental price below 5,000 VND is invalid; prices from 5,000 VND use VNPay.

## 5 Main data model

Sprint 3 uses the existing Sprint 2 tables and adds the next Physical ERD slice:

- `booth_payments`
- `booth_assignments`

The proposed next migration is V7. V1 through V6 are immutable.

### 5.1 BoothPayment

The table follows the Physical ERD fields:

- `booth_payment_id`
- `booth_hold_id`
- `original_payment_id`, nullable self-reference for later refunds
- `transaction_type`
- `purpose`
- `amount`
- `status`
- `idempotency_key`
- `gateway_provider`
- `gateway_transaction_ref`, nullable until supplied by the provider
- `failure_code`, nullable
- `failure_message`, nullable
- `created_at`, `updated_at`, `completed_at`

Sprint 3 creates only `transaction_type = PAYMENT` with the initial-rental purpose. Later refund/cancellation source columns are added only with their owning request tables, matching the additive approach already used for Sprint 2 Holds.

Payment statuses are:

- `PENDING`
- `SUCCESS`
- `FAILED`
- `TIMEOUT`

`completed_at` is null while the Payment is `PENDING`. It is recorded when the Payment reaches `SUCCESS`, `FAILED` or `TIMEOUT`.

Every retry creates a new record and a new idempotency key. Repeating the same creation request with the same key returns the original attempt instead of creating another one.

V7 adds the following approved database protections:

- unique `idempotency_key`;
- unique `(gateway_provider, gateway_transaction_ref)` where the reference is not null;
- at most one `PENDING` initial-rental Payment per Hold;
- at most one `SUCCESS` initial-rental Payment per Hold;
- unique `booth_assignments.booth_hold_id`.

The partial indexes must include the approved transaction type and purpose predicates so future refund or Booth-change attempts are not blocked accidentally.

### 5.2 BoothAssignment

The table follows the Physical ERD fields:

- `booth_assignment_id`
- `booth_hold_id`, unique
- `qr_token`, unique
- `cover_image_url`, nullable
- `status`
- `assigned_at`
- `released_at`, nullable
- `release_reason`, nullable

Sprint 3 creates only `ACTIVE` Assignments. Future change/cancellation work owns later Assignment transitions.

## 6 State machines

### 6.1 Payment attempt

```text
PENDING
  ├─→ SUCCESS
  ├─→ FAILED
  └─→ TIMEOUT
```

These are normally terminal states for one attempt. A retry is a new `PENDING` record, not a transition back from `FAILED` or `TIMEOUT`; the only exception is the narrow, stronger-evidence correction described below.

A narrow correction applies when stronger evidence arrives after a locally inferred VNPay `TIMEOUT`: while holding the source Hold lock, the backend may correct that attempt to `SUCCESS` and run normal settlement only when the Hold is still `ACTIVE`, no later attempt exists, no other Payment succeeded and no Assignment exists. Otherwise the attempt is not silently overwritten; the verified late-success evidence is persisted as a reconciliation conflict and the Booth is not reassigned by that processing path. Compensation remains mandatory when settlement is no longer safe.

### 6.2 Successful settlement

In one database transaction, the backend must:

1. lock the source Hold and Payment in a fixed order;
2. verify the Payment is not already terminal;
3. verify the gateway result using trusted server-side evidence;
4. verify the Hold and source request are still eligible for settlement;
5. mark the Payment `SUCCESS` and record its provider reference/completion time;
6. mark the Hold `CONSUMED` and record `consumedAt`;
7. mark the winning BoothRequest `COMPLETED` and record `completedAt`;
8. create exactly one `ACTIVE` BoothAssignment for the Hold;
9. mark competing `PENDING` requests for the same Event Booth as `NOT_SELECTED`;
10. commit all changes atomically.

A duplicate callback returns the already-settled result and creates no second Assignment.

### 6.3 Failed or unknown attempt

- Verified failure changes only the attempt to `FAILED`.
- A VNPay user cancellation confirmed by a signed IPN with response code `24` and transaction status `02` changes the attempt to `FAILED`.
- VNPay Sandbox may keep an expired checkout at raw transaction status `01` instead of publishing a terminal expiry status. Raw `01` is not mapped directly to `FAILED` or `TIMEOUT`.
- An expired VNPay attempt becomes domain `TIMEOUT` only through the approved bounded reconciliation policy in section 6.4. The last raw provider status remains stored for audit.
- A network timeout, missing callback or unavailable query result is not a domain `TIMEOUT`; the attempt stays `PENDING` and enters reconciliation.
- The request remains `SELECTED` and the Hold remains `ACTIVE` while the payment window is open.
- For the initial request, or a replay with the same idempotency key, an ambiguous gateway result returns `202 Accepted` with the durable Pending Payment so the frontend can poll it.
- A new idempotency key submitted while an earlier Payment still has an unknown gateway result is rejected with `409 PAYMENT_RESULT_UNKNOWN`; no retry Payment is created.
- Before a new retry, every earlier ambiguous attempt must be resolved to a terminal non-success state by trusted provider evidence.

### 6.4 VNPay expired-checkout reconciliation

The sandbox spike established the following provider-specific behavior on 2026-10-08:

- a checkout that reached the OTP screen became unusable when its 15-minute countdown expired;
- no terminal IPN arrived for that expiry;
- signed QueryDR calls approximately six and eleven minutes after checkout expiry both returned query response code `00` with transaction status `01`, matching transaction reference and amount;
- VNPay therefore cannot be expected to convert an abandoned expired checkout into a provider-terminal status promptly.
- VNPay accepted a separately tested five-minute `vnp_ExpireDate`, displayed the matching countdown and rejected the transaction when that shorter countdown ended.

To prevent one attempt from remaining `PENDING` forever without guessing from the browser page alone, Sprint 3 adopts this bounded domain policy:

1. At checkout expiry, keep the Payment `PENDING` under reconciliation. Browser text or a frontend timer is not evidence.
2. Make the first QueryDR no earlier than five minutes after checkout expiry.
3. Make a second QueryDR at least five minutes after the first, respecting VNPay's duplicate-query window.
4. Each result must have a valid provider signature, query response code `00`, matching transaction reference and amount, and raw transaction status `01`. No verified success IPN or QueryDR may have been observed.
5. After both trusted incomplete results, atomically change the local Payment to `TIMEOUT`, record `completedAt`, preserve the latest raw provider result for audit, and allow a new attempt only if the Hold remains Active and unexpired.
6. A transport error, invalid signature, mismatched reference/amount, response code other than `00`, suspicious status, or only one trusted `01` result is insufficient; the Payment remains `PENDING` and blocks retry.

This `TIMEOUT` is a bounded BookStreet lifecycle decision, not a claim that VNPay changed its raw transaction status from `01`. A later verified success follows the narrow correction rule in section 6.1 or is persisted as a reconciliation conflict; it must never create a duplicate Assignment.

### 6.5 Payment initiation transaction boundary

The transaction boundary depends on whether initiation performs remote provider I/O. VNPay PAY
creates a signed URL locally and therefore uses one short atomic database transaction:

1. Lock and re-check the Hold, enforce ownership, idempotency and the one-Pending-attempt rule.
2. Re-check the idempotency key after acquiring the Hold lock so concurrent requests with the
   same key converge on one Payment.
3. Insert and flush the `PENDING` Payment to obtain `boothPaymentId`, derive
   `vnp_TxnRef = BSP{boothPaymentId}`, build the signed VNPay URL locally and attach the exact
   checkout URL and expiry.
4. Commit the Payment and complete checkout metadata together, then return the checkout URL.
5. If local configuration/signing fails, change that attempt to `FAILED` in the same transaction;
   return `502 PAYMENT_GATEWAY_UNAVAILABLE` only after the failure record commits.

No remote network call occurs in these steps, so there is no reason to expose a committed
`PENDING` Payment without a usable checkout. A legacy/incomplete Pending row that has no checkout
URL or expiry and is older than the reconciliation grace period is changed to `FAILED` with
`CHECKOUT_NOT_CREATED`; it is safe to retry because no URL was delivered and VNPay has no remote
session to recover.

For a future provider whose initiation really performs remote I/O, create the durable correlation
record in a short transaction, release database locks before calling the provider, then persist the
result in another short transaction. An ambiguous network result must remain `PENDING` and be
reconciled instead of being guessed as failed.

Idempotent initiation uses this decision table:

- same key with a usable checkout or terminal Payment: return `200` with that Payment;
- same key while the Payment is under reconciliation: return `202` with that same Pending Payment;
- new key while another Pending Payment has a usable checkout: reject with `409 PAYMENT_ATTEMPT_ALREADY_PENDING`;
- new key while another Pending Payment has an unknown gateway result: reject with `409 PAYMENT_RESULT_UNKNOWN`.

For VNPay PAY, checkout initiation is local URL construction and HMAC signing; it does not call a
remote session-creation API. `vnp_TxnRef` is `BSP` followed by the decimal `boothPaymentId`. This
value is globally unique, within VNPay's length/character rules, and lets IPN/QueryDR locate the
Payment before `vnp_TransactionNo` exists. The exact signed checkout URL and
`checkoutExpiresAt` commit atomically with the new Payment so a same-key replay can return the
identical usable checkout without minting another attempt.

The normal new-attempt response is therefore `201`. Local signing/configuration failure proves that no external session was created, so the Payment is committed as `FAILED` before `502`. `202` is used for same-key replay only after the stored checkout is no longer usable and the Payment is still under reconciliation.

## 7 Concurrency boundary

- Hold expiry and payment settlement use the same Hold row as their serialization point.
- Code paths lock the Hold before changing Hold, Request, Payment or Assignment state.
- At most one Assignment exists per Hold through a database unique constraint.
- At most one successful initial-rental Payment is accepted for one Hold.
- A duplicate or reordered callback is idempotent.
- A payment creation command re-checks the current backend Clock against `expiresAt`; the frontend countdown is informational only.
- The expiry job must not decide solely from local Payment timestamps. Before releasing a due Hold with a `PENDING` attempt, it follows the selected provider's approved query/reconciliation policy.
- A due Hold with no unresolved `PENDING` Payment expires normally.
- A due Hold with an unresolved `PENDING` Payment remains `ACTIVE`, its source request remains `SELECTED`, and no new payment attempt is permitted. Every availability and selection query treats that `ACTIVE` row as blocking even though `expiresAt` is in the past.
- Gateway I/O is never performed while holding a database lock. Before QueryDR, the reconciliation
  worker atomically claims the due Payment by locking `Hold → Payment` within the Sprint 3 payment
  domain, re-checking eligibility and
  recording `lastGatewayQueryAt` in a short transaction. It then releases the locks, calls QueryDR,
  and opens another short `Hold → Payment` transaction to apply only the still-current result. The
  implemented Sprint 4 contract prefixes both short transactions with the Event row. This
  claim prevents concurrent workers or a crash/retry loop from violating VNPay's minimum query
  interval.
- Trusted SUCCESS follows atomic settlement. Trusted FAILED or the approved two-query local TIMEOUT closes the attempt and, when the Hold is already due, expires the Hold and source request in that same transaction.
- An invalid, unavailable or still-unknown provider result keeps Payment `PENDING`, sets or retains `reconciliationRequired`, and leaves the Hold blocking the Booth. It is retried no sooner than the provider query interval and is never auto-released merely to restore availability.

## 8 Security boundary

- Payment initiation requires an authenticated, verified `PARTNER` who owns the selected request.
- Payment history and Assignment detail use ownership-safe `404` behavior.
- The gateway webhook is not authenticated by the browser Session and is exempt from CSRF only for its exact provider path.
- Webhook authenticity must be verified using the selected provider's signature/secret rules.
- Gateway credentials and secrets are environment configuration and must never be returned, logged or committed.
- Redirect query parameters from the user's browser are display hints only; they are never authoritative payment proof.

## 9 Definition of Done

- V7 applies cleanly after V6 and Hibernate validation succeeds.
- A selected Partner can create a sandbox payment attempt for the locked price.
- Repeating the same idempotency key creates no duplicate attempt.
- Ordinary `FAILED` and attempt `TIMEOUT` records are preserved as history and allow retry while
  the Hold is active. A terminal attempt with contradictory verified-success evidence remains
  reconciliation-blocking and does not permit another charge.
- Backend-verified `SUCCESS` atomically produces Payment SUCCESS, Hold CONSUMED, Request COMPLETED and one Active Assignment.
- Competing Pending requests become `NOT_SELECTED` only after Assignment creation.
- Duplicate callbacks and concurrent success/expiry processing produce no duplicate Assignment or invalid mixed state.
- Public availability reports `ASSIGNED` for an overlapping Active Assignment.
- Partner payment and Assignment queries enforce ownership.
- Gateway secrets are environment-only and callback verification is covered by tests.
- Backend tests, frontend lint/build and the Sprint 3 Playwright happy path pass.
- The primary demo uses a real gateway sandbox; a callback simulator is test-only or a clearly labelled offline backup.

## 10 Approved VNPay implementation decisions

- The exact public callback is `GET /api/v1/payments/vnpay/ipn`; only this path is exempt from
  CSRF and every callback still requires valid VNPay HMAC verification.
- `00/00` is success. Raw transaction status `01` remains Pending and enters reconciliation.
  Signed `24/02` is customer cancellation and becomes Failed; transaction status `02` is the only
  safe terminal failure mapping in the initial-payment flow. Status `04` can follow a customer
  debit/reversal, while suspicious or flow-inapplicable statuses such as `07` and refund status
  `09` remain Pending with `reconciliationRequired`; they never enable an unsafe retry or create
  an Assignment.
- The stable initial-rental purpose is `INITIAL_BOOTH_RENTAL`.
- V7 is approved to add `checkout_url`, `checkout_expires_at`, `provider_response_code`,
  `provider_transaction_status`, `last_gateway_query_at`, `trusted_incomplete_query_count`,
  `reconciliation_required` and nullable `reconciliation_detail`.
- `vnp_TxnRef` needs no separate column because it is reversibly derived from
  `booth_payment_id`; `gateway_transaction_ref` stores VNPay `vnp_TransactionNo`.
- When a verified late charge cannot satisfy the narrow automatic correction, the Payment keeps
  its safe local terminal state, stores the provider evidence in `reconciliation_detail`, sets
  `reconciliation_required = true`, creates no Assignment, blocks another Payment attempt and
  enters manual refund review.
  Refund execution remains outside Sprint 3.

## 10.1 V6 readiness audit

The merged V6 schema was checked before planning V7:

- `booth_holds.status` already allows `CONSUMED`;
- `booth_holds.consumed_at` already exists;
- `booth_requests.status` already allows `COMPLETED` and `NOT_SELECTED`;
- `booth_requests.completed_at` already exists;
- the corresponding Java status enums and entity fields already exist.

V7 does not alter those existing fields. It creates the two new tables, their Payment/Assignment
constraints and the checkout/reconciliation columns approved by the provider spike.

## 11 Implementation status and remaining sequence

Completed backend work:

1. Provider decisions, scope, use cases and API contract are frozen.
2. V7 Payment/Assignment schema and persistence models are implemented.
3. VNPay initiation, verified IPN, QueryDR reconciliation and idempotent settlement are implemented.
4. Payment history, Assignment queries, free-Booth settlement and `ASSIGNED` availability are implemented.
5. Authorization, retry, duplicate callback, expiry-race, query-claim concurrency and the full
   backend regression suite pass.

Remaining delivery work:

1. Integrate frontend checkout, return/result, history and Assignment views.
2. Add Playwright happy-path and failure/retry E2E coverage.
3. Configure deployed VNPay credentials, frontend Return URL and public HTTPS IPN URL.
