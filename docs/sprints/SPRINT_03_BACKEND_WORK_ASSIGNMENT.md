# Sprint 03 Backend Work Assignment

> Planning draft. Do not start gateway implementation until the provider and expiry-race decisions in `sprint-03.md` are approved.

## 1 Delivery strategy

Sprint 3 should be delivered as small pull requests in dependency order. One developer owns V7 to avoid duplicate migration numbers. All feature branches start from updated `main`.

## 2 Workstreams

### Workstream A - Design and gateway spike

Deliverables:

- Approve Sprint scope, use cases and API contract.
- Select one real sandbox gateway.
- Record required credentials, callback verification, checkout lifetime and query API without committing secrets.
- Define and verify the durable merchant-order correlation identifier used for session creation, provider queries and callbacks, including callbacks received before `gatewayTransactionRef` is persisted.
- Decide whether that identifier can be derived from `boothPaymentId` or requires a unique V7 `provider_request_id` column.
- Verify the HTTP decision table: same-key usable/terminal `200`, same-key reconciliation `202`, new-key usable Pending `409 PAYMENT_ATTEMPT_ALREADY_PENDING`, new-key unknown Pending `409 PAYMENT_RESULT_UNKNOWN`, and definite no-session gateway failure `502 PAYMENT_GATEWAY_UNAVAILABLE` after committing Payment `FAILED`.
- Resolve late callback versus Hold expiry precedence.
- Freeze the initial-rental purpose code.
- Choose and prove a checkout URL/session recovery strategy for idempotent replay.
- Define a bounded reconciliation policy for unresolved Pending attempts at Hold expiry.
- Define compensation for any confirmed charge that cannot produce an Assignment.
- Prove sandbox access with a minimal throwaway/local spike before application integration.

Exit criteria:

- No `TBD` remains in provider-specific API behavior or V7 checkout metadata.
- The team can create, query and verify a sandbox transaction.
- A lost initiation response can be recovered without creating a second charge.
- A callback can locate the durable Payment using merchant-order correlation before any gateway transaction reference is stored.
- An ambiguous initiation returns an observable Payment identifier that the frontend can poll.

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
- Unknown results remain Pending and block retries until reconciled.
- Definite gateway unavailability with proof that no external session exists changes the attempt to `FAILED` before returning `502`.
- Environment-only configuration and startup validation for required provider settings.
- Short database transactions before and after the external call; no row lock is held across gateway I/O.

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

Tests:

- Valid and invalid signatures.
- SUCCESS, FAILED and TIMEOUT mappings.
- Duplicate callback.
- Concurrent duplicate callbacks.
- Payment success versus Hold expiry race.
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
- [ ] Gateway provider selected.
- [ ] Sandbox merchant access verified.
- [ ] Webhook signature rules documented.
- [ ] Status mapping documented.
- [ ] Durable merchant-order correlation identifier verified end to end.
- [ ] `201`/same-key `200`/same-key `202`/new-key `409`/definite `502` initiation matrix verified against the provider.
- [ ] Query-before-retry policy documented.
- [ ] Checkout lifetime documented and capped by Hold expiry.
- [ ] Late callback/expiry precedence approved.
- [ ] Checkout replay/recovery strategy approved, including any V7 columns.
- [ ] Unknown-result reconciliation and retry blocking approved.
- [ ] Compensation path for a late confirmed charge approved.
- [ ] Initial-rental purpose code approved.
- [ ] V7 owner assigned.
- [ ] API contract reviewed by backend and frontend owners.

## 6 Definition of handoff readiness

Backend implementation, including V7, may begin only after Workstream A closes every provider-dependent decision and the docs PR is reviewed. One assigned migration owner then creates V7 from the approved schema.
