# Sprint 03 Booth Payment and Assignment

> Design draft. Sprint 2 backend is merged, but Sprint 2 remains the active Sprint until its frontend and Booth E2E Definition of Done are verified on `main`. Sprint 3 remains in planning until the provider spike and all provider-dependent decisions are approved.

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
| UC-E03 | Pay & View Booth | Create and retry Booth payment attempts while a selected Hold is active; view payment history and the resulting BoothAssignment |
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

- One real Payment Gateway sandbox adapter selected by the team.
- Initial Booth rental payments only.
- One durable `BoothPayment` record per gateway attempt.
- Required idempotency for payment creation and gateway callbacks.
- Server-side callback/webhook signature verification or server-side gateway status verification.
- Retry after `FAILED` or attempt `TIMEOUT` while the Hold remains active.
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

These flows remain in the MVP baseline but are deliberately deferred so Sprint 3 can deliver one complete and secure payment-to-assignment path.

## 4 Preserved Sprint 2 decisions

- `BoothHold.lockedRentalPrice` is the amount for every attempt in that Hold.
- A later EventBoothConfig price change never changes an existing Hold or Payment amount.
- A failed or timed-out attempt does not expire or release the Hold.
- Only `BoothHold.expiresAt` ends the payment window.
- Competing candidates stay `PENDING` until verified success creates the Assignment.
- Hold expiry changes only the selected request to `PAYMENT_EXPIRED`; competing requests remain `PENDING`.
- Session authentication, CSRF and ownership continue to follow the existing browser-security contract.
- PostgreSQL is the source of truth; Redis is not used as payment or Assignment storage.

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

V7 must add these database protections after the provider spike confirms the final purpose and checkout-recovery design:

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

These are terminal states for one attempt. A retry is a new `PENDING` record, not a transition back from `FAILED` or `TIMEOUT`.

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
- `TIMEOUT` is terminal only when the gateway confirms that the transaction/session expired and cannot later succeed.
- A network timeout, missing callback or unavailable query result is not a domain `TIMEOUT`; the attempt stays `PENDING` and enters reconciliation.
- The request remains `SELECTED` and the Hold remains `ACTIVE` while the payment window is open.
- For the initial request, or a replay with the same idempotency key, an ambiguous gateway result returns `202 Accepted` with the durable Pending Payment so the frontend can poll it.
- A new idempotency key submitted while an earlier Payment still has an unknown gateway result is rejected with `409 PAYMENT_RESULT_UNKNOWN`; no retry Payment is created.
- Before a new retry, every earlier ambiguous attempt must be resolved to a terminal non-success state by trusted provider evidence.

## 6.4 Payment initiation transaction boundary

Payment initiation uses short database transactions around the external gateway call:

1. In a short transaction, lock/re-check the Hold, enforce idempotency and the one-Pending-attempt rule, create the `PENDING` Payment, then commit.
2. Call the gateway without holding a database transaction or row lock open.
3. If session creation succeeds, persist the provider reference and any approved recoverable checkout metadata in a second short transaction, then return the checkout URL.
4. If the gateway is definitely unavailable and trusted evidence proves that no external transaction/session was created, mark the durable attempt `FAILED` in a second short transaction before returning `502 PAYMENT_GATEWAY_UNAVAILABLE`.
5. If the network result is ambiguous, keep the attempt `PENDING` and query/reconcile it. Return `202 Accepted` for the initial response or a replay with the same key; reject a new key with `409 PAYMENT_RESULT_UNKNOWN` and do not create another attempt.

If the Hold becomes ineligible between steps, the provider-specific design must cancel or reconcile the external session safely. This behavior is part of the gateway spike and must be tested.

Idempotent initiation uses this decision table:

- same key with a usable checkout or terminal Payment: return `200` with that Payment;
- same key while the Payment is under reconciliation: return `202` with that same Pending Payment;
- new key while another Pending Payment has a usable checkout: reject with `409 PAYMENT_ATTEMPT_ALREADY_PENDING`;
- new key while another Pending Payment has an unknown gateway result: reject with `409 PAYMENT_RESULT_UNKNOWN`.

## 7 Concurrency boundary

- Hold expiry and payment settlement use the same Hold row as their serialization point.
- Code paths lock the Hold before changing Hold, Request, Payment or Assignment state.
- At most one Assignment exists per Hold through a database unique constraint.
- At most one successful initial-rental Payment is accepted for one Hold.
- A duplicate or reordered callback is idempotent.
- A payment creation command re-checks the current backend Clock against `expiresAt`; the frontend countdown is informational only.
- The expiry job must not decide solely from local Payment timestamps. Before releasing a due Hold with a `PENDING` attempt, it follows the selected provider's approved query/reconciliation policy.
- An unresolved provider result must not permit a competing Assignment that could conflict with a later confirmed charge. The exact bounded reconciliation behavior is a provider-selection blocker.

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
- `FAILED` and attempt `TIMEOUT` are preserved as history and allow retry while the Hold is active.
- Backend-verified `SUCCESS` atomically produces Payment SUCCESS, Hold CONSUMED, Request COMPLETED and one Active Assignment.
- Competing Pending requests become `NOT_SELECTED` only after Assignment creation.
- Duplicate callbacks and concurrent success/expiry processing produce no duplicate Assignment or invalid mixed state.
- Public availability reports `ASSIGNED` for an overlapping Active Assignment.
- Partner payment and Assignment queries enforce ownership.
- Gateway secrets are environment-only and callback verification is covered by tests.
- Backend tests, frontend lint/build and the Sprint 3 Playwright happy path pass.
- The primary demo uses a real gateway sandbox; a callback simulator is test-only or a clearly labelled offline backup.

## 10 Open decisions before gateway implementation

The following choices are intentionally not guessed by this draft:

1. Payment Gateway provider and sandbox account.
2. Provider-supported checkout/session lifetime; the effective expiry must not exceed `BoothHold.expiresAt`.
3. Provider-specific webhook path, signature fields, query API and status mapping.
4. The durable merchant-order correlation identifier sent during session creation, provider queries and callbacks. It may be `boothPaymentId` when the provider format permits, otherwise V7 may need a unique `provider_request_id`.
5. The provider-specific evidence that safely distinguishes ambiguous initiation (`202` with the durable Pending Payment) from definite unavailability (`502` only after committing the Payment as `FAILED` because no external transaction/session exists).
6. Precedence for a verified provider success that was paid before Hold expiry but whose callback arrives after expiry processing.
7. Whether the expiry job can authoritatively query every Pending attempt before releasing the Hold, and what bounded reconciliation policy applies when that query is unavailable.
8. How a charge confirmed after the Hold can no longer produce an Assignment is handled. The provider spike must choose one safe boundary: allow an eligible pre-expiry payment to settle, add minimum automatic compensation/refund to Sprint 3, or retain the Booth in manual reconciliation without reassignment.
9. The exact stable purpose code for the initial Booth rental payment.
10. Whether checkout replay uses persisted `checkout_url`/`checkout_expires_at`, provider recovery, or safe session recreation for the same Payment/reference.

V7, the gateway adapter and final API examples must not be marked approved until these decisions are recorded. The checkout-replay choice can change V7, and the success-expiry choice can change both state handling and the eventual refund boundary.

Until item 8 is resolved, the system must never silently discard a confirmed charge or release/reassign the Booth while the corresponding Payment remains unresolved.

## 10.1 V6 readiness audit

The merged V6 schema was checked before planning V7:

- `booth_holds.status` already allows `CONSUMED`;
- `booth_holds.consumed_at` already exists;
- `booth_requests.status` already allows `COMPLETED` and `NOT_SELECTED`;
- `booth_requests.completed_at` already exists;
- the corresponding Java status enums and entity fields already exist.

V7 does not need to alter those fields. It still needs the two new tables, Payment/Assignment constraints and any checkout-recovery columns approved by the provider spike.

## 11 Recommended implementation sequence

1. Approve this scope and resolve all provider-dependent open decisions.
2. Freeze the Sprint 3 use cases and API contract.
3. Add and verify the V7 Payment/Assignment schema.
4. Add Payment and Assignment persistence models.
5. Implement the gateway adapter and payment initiation.
6. Implement verified, idempotent success settlement.
7. Add payment history, Assignment queries and `ASSIGNED` availability.
8. Integrate frontend checkout/result/history views.
9. Run authorization, retry, duplicate callback, expiry-race and concurrency tests.
10. Run the Sprint 2 regression suite and Sprint 3 E2E demo.
