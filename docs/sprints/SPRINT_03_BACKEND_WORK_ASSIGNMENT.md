# Sprint 03 Backend Work Assignment

> Approved implementation assignment. VNPay Sandbox and the V7 provider/reconciliation design are frozen for Sprint 3.

> Implemented Sprint 4 overlay: Payment paths must prepend the Event-root lock and apply the Event
> lifecycle settlement boundary defined by Sprint 4. This historical assignment does not override
> that newer cross-module contract.

## 1 Delivery strategy

Sprint 3 should be delivered as small pull requests in dependency order. One developer owns V7 to avoid duplicate migration numbers. All feature branches start from updated `main`.

## 2 Workstreams

### Workstream A - Design and gateway spike

Deliverables:

- Approve Sprint scope, use cases and API contract.
- Select one real sandbox gateway.
- Record required credentials, callback verification, checkout lifetime and query API without committing secrets.
- Define and verify the durable merchant-order correlation identifier used for session creation, provider queries and callbacks, including callbacks received before `gatewayTransactionRef` is persisted.
- Use the approved reversible identifier `BSP{boothPaymentId}`; no separate V7 `provider_request_id` column is required.
- Verify the HTTP decision table: same-key usable/terminal `200`, same-key reconciliation `202`, new-key usable Pending `409 PAYMENT_ATTEMPT_ALREADY_PENDING`, new-key unknown Pending `409 PAYMENT_RESULT_UNKNOWN`, and definite no-session gateway failure `502 PAYMENT_GATEWAY_UNAVAILABLE` after committing Payment `FAILED`.
- Apply the approved narrow late-success correction rule and retain every unsafe late success as a reconciliation conflict pending compensation.
- Freeze the initial-rental purpose code.
- Choose and prove a checkout URL/session recovery strategy for idempotent replay.
- Define a bounded reconciliation policy for unresolved Pending attempts at Hold expiry.
- Implement the approved expired-checkout rule only after two trusted VNPay QueryDR results at least five minutes apart both return response code `00`, matching reference/amount and raw status `01`, with no verified success.
- Define compensation for any confirmed charge that cannot produce an Assignment.
- Prove sandbox access with a minimal throwaway/local spike before application integration.

Exit criteria:

- No `TBD` remains in provider-specific API behavior or V7 checkout metadata.
- The team can create, query and verify a sandbox transaction.
- A lost initiation response can be recovered without creating a second charge.
- A callback can locate the durable Payment using merchant-order correlation before any gateway transaction reference is stored.
- A same-key reconciliation response returns the durable Payment identifier that the frontend can poll.

### Workstream B - V7 Payment and Assignment schema

Dependencies: Workstream A completion. V7 must wait because checkout recovery may require durable URL/session-expiry fields.

Deliverables:

- `V7__create_sprint3_payment_assignment_schema.sql`.
- `booth_payments` and `booth_assignments` matching the approved Physical ERD slice.
- Foreign keys, CHECK constraints, unique idempotency key and unique provider/reference pair when reference is present.
- Partial unique protection for one unresolved `PENDING` initial-rental attempt per Hold.
- Partial unique protection for one `SUCCESS` initial-rental Payment per Hold.
- Unique Assignment per Hold.
- Indexes for Hold/status, provider reference and owned history queries.
- Clean-database and V6-upgrade migration verification.

Ownership rule:

- Only this workstream creates V7.
- V1 through V6 remain untouched.

### Workstream C - Persistence and owned queries

Dependencies: Workstream B.

Deliverables:

- Payment and Assignment entities/enums/repositories in the Booth/payment feature boundary.
- DTO mappings for Payment history and Assignment detail.
- Partner-owned list/detail queries.
- `ASSIGNED` availability derived from overlapping Active Assignments.
- Sort allowlists and ownership-safe errors.

Tests:

- Mapping and repository constraints.
- Partner ownership isolation.
- Assignment-derived availability.

### Workstream D - Payment initiation and retry

Dependencies: Workstreams A through C.

Deliverables:

- A focused gateway boundary interface because this is a real external integration seam.
- One selected provider adapter.
- Idempotent payment creation using `Idempotency-Key`.
- Locked amount sourced only from the Active Hold.
- Checkout expiry capped by Hold expiry.
- Query-before-retry handling for ambiguous attempts.
- Bounded expired-checkout reconciliation that preserves raw VNPay evidence and changes the local attempt to `TIMEOUT` only after both required trusted `01` results.
- Unknown results remain Pending and block retries until reconciled.
- Due Holds with unresolved Pending Payments remain Active and keep availability `ON_HOLD`; ordinary expiry skips them until trusted reconciliation closes the attempt.
- Reconciliation performs gateway I/O outside a transaction, then locks `Hold → Payment` to apply
  the result. For initial payments, trusted status `02` is the safe terminal failure that closes the
  attempt; `04`, `07`, `09` and unknown combinations stay Pending for reconciliation. A closed
  non-success attempt expires an already-due Hold atomically.
- Definite gateway unavailability with proof that no external session exists changes the attempt to `FAILED` before returning `502`.
- Environment-only configuration and startup validation for required provider settings.
- For VNPay PAY, insert/flush the Payment, locally sign the URL and persist the complete checkout
  metadata in one short atomic transaction; URL construction has no remote I/O.
- Re-check the idempotency key after the Hold lock so concurrent same-key requests converge on one
  Payment and one signed checkout.
- Claim a QueryDR slot by recording `lastGatewayQueryAt` under the `Hold → Payment` lock before
  releasing the transaction and calling VNPay. Apply the result in a second short transaction; no
  row lock is held across gateway I/O.

> Historical Sprint 3 assignment note: Sprint 4 preserves this relative `Hold → Payment` order but
> prefixes Event-scoped transactions with an Event row lock.
- Close legacy/incomplete Pending rows without checkout metadata after the grace period as
  `CHECKOUT_NOT_CREATED`, because no VNPay session or delivered checkout can exist for those rows.

Tests:

- Happy-path initiation.
- Same-key replay.
- New-key retry after FAILED/TIMEOUT.
- Rejection for foreign, non-selected, consumed or expired Holds.
- No client-controlled amount.
- Gateway unavailable behavior.
- Same-key `200` versus `202` replay behavior.
- New-key `PAYMENT_ATTEMPT_ALREADY_PENDING` versus `PAYMENT_RESULT_UNKNOWN` rejection behavior.
- `502` is returned only after the durable Payment is committed as `FAILED`.
- Lost-response checkout recovery.
- Concurrent same-key initiation creates one Payment and returns one creation plus one replay.
- Reusing one idempotency key for another BoothRequest is rejected.
- Concurrent reconciliation workers obtain only one QueryDR claim inside the provider interval.
- Pending checkout-metadata orphans are closed safely and permit an eligible retry.
- One trusted expired-checkout `01` result remains Pending; two qualifying results close the attempt as TIMEOUT.
- Transport, signature, response-code and reference/amount failures never satisfy the timeout counter.
- A due Hold with unknown Payment evidence is not released, does not appear AVAILABLE and blocks a competing selection.
- After trusted FAILED/TIMEOUT evidence, a due Hold and its source request expire in the same transaction as the Payment transition.

### Workstream E - Verified callback and atomic Assignment

Dependencies: Workstreams A through D.

Deliverables:

- Exact provider webhook with narrow CSRF exemption.
- Signature/server-side result verification.
- Fixed row-lock order shared with expiry processing.
- Atomic SUCCESS settlement.
- Competing candidates moved from PENDING to NOT_SELECTED.
- Duplicate and reordered callback idempotency.
- Reconciliation/query path for uncertain results if supported by the provider.
- Narrow late-success correction only when the Hold is Active and no later attempt, successful Payment or Assignment exists; all other late success evidence becomes a persisted reconciliation conflict.

Tests:

- Valid and invalid signatures.
- SUCCESS, FAILED and TIMEOUT mappings.
- VNPay cancellation is accepted only for the exact `vnp_ResponseCode=24` and
  `vnp_TransactionStatus=02` pair; inconsistent pairs remain under reconciliation.
- Duplicate callback.
- Concurrent duplicate callbacks.
- Payment success versus Hold expiry race.
- Partner-owned Payment and Assignment queries do not disclose another Partner's resources.
- Due Hold with an unresolved Pending gateway result.
- Provider-confirmed charge that cannot produce an Assignment follows the approved compensation path.
- Transaction rollback leaves no partial Assignment state.

### Workstream F - Frontend integration and E2E

Dependencies: approved API contract; mock responses may be used before D/E merge.

Deliverables:

- Pay action only for owned `SELECTED` requests with Active Holds.
- Countdown uses backend `expiresAt` and never decides validity itself.
- Idempotency key per user payment action.
- Redirect to sandbox checkout.
- Result page polls/queries durable backend status rather than trusting redirect parameters.
- Payment-attempt history.
- Assignment detail after success.
- Clear FAILED/TIMEOUT retry states.
- Playwright happy path plus one failure/retry path using the test adapter, not production callback simulation.

## 3 Suggested PR order

1. `docs/sprint-03-payment-assignment-design`
2. `feature/s3-payment-assignment-schema`
3. `feature/s3-payment-assignment-persistence`
4. `feature/s3-payment-initiation`
5. `feature/s3-payment-settlement`
6. `feature/s3-payment-frontend-integration`
7. `test/s3-payment-e2e`

## 4 Shared invariants

- Frontend never submits amount, ownership IDs or SUCCESS state.
- Payment amount always equals `BoothHold.lockedRentalPrice` for this Sprint.
- One attempt is one durable history record and is never reused for a retry. Its status and provider-result fields may be updated through the approved lifecycle.
- Failed/timeout attempt does not release the Hold.
- Verified success and Hold expiry cannot both finalize the same Hold.
- Assignment creation, winner completion and competitor closure are one transaction.
- Secrets are environment-only.
- A callback simulator is never enabled as a production endpoint.

## 5 Pre-implementation checklist

- [ ] Sprint 2 frontend/E2E completion status is known.
- [x] Gateway provider selected: VNPay.
- [x] Sandbox merchant access verified.
- [x] Webhook signature rules documented.
- [x] Status mapping documented.
- [x] Durable merchant-order correlation selected: `BSP{boothPaymentId}`; no extra provider-request ID column.
- [x] VNPay initiation matrix documented: local signed-URL `201`, same-key usable/terminal `200`, same-key reconciliation `202`, new-key `409`, definite local no-session failure `502`.
- [x] Expired-checkout QueryDR-before-retry policy documented.
- [x] Checkout lifetime documented and sandbox-verified: `min(now + 15 minutes, hold.expiresAt)`, with no new checkout below five minutes remaining.
- [x] Late callback/expiry precedence approved for automatic settlement; unsafe late charges still require the compensation decision below.
- [x] Checkout replay strategy approved: persist and return the original signed URL plus its expiry.
- [x] Expired-checkout status `01` reconciliation and retry blocking approved; non-expiry unknown-result behavior remains Pending.
- [x] Unresolved-Payment Hold retention approved: keep Hold Active/ON_HOLD, block reassignment and release only after trusted reconciliation.
- [x] Compensation boundary for a late confirmed charge approved: persist conflict and route to manual refund review.
- [x] Initial-rental purpose code approved: `INITIAL_BOOTH_RENTAL`.
- [x] V7 owner assigned to the active Sprint 3 implementation branch.
- [x] API contract approved for implementation; frontend integration follows the backend contract.

## 6 Definition of handoff readiness

Backend implementation, including V7, may begin only after Workstream A closes every provider-dependent decision and the docs PR is reviewed. One assigned migration owner then creates V7 from the approved schema.
