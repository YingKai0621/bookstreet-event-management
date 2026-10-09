# VNPay Sandbox Local Spike

This is the disposable provider spike retained as reproducible evidence for Sprint 3 Workstream A.
It proved VNPay payment-URL signing, durable merchant correlation, Return URL verification and IPN
verification before the backend integration was implemented.

It is not a production Payment implementation:

- it does not use the BookStreet database;
- it does not create a `BoothPayment` or `BoothAssignment`;
- it does not change the Spring Security configuration;
- it stores test orders only in ignored `local-data/vnpay-spike-orders.json`;
- it never updates a test order from the browser Return URL.

## Local configuration

Copy the VNPay sandbox values into the repository-root `.env` file. Never commit real values.

```dotenv
VNPAY_TMN_CODE=your_sandbox_terminal_code
VNPAY_HASH_SECRET=your_sandbox_hash_secret
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_QUERY_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
VNPAY_CHECKOUT_DURATION_SECONDS=900
VNPAY_QUERY_MIN_INTERVAL_SECONDS=300
VNPAY_RECONCILIATION_DELAY_SECONDS=300
VNPAY_SPIKE_RETURN_URL=http://localhost:8090/vnpay/return
VNPAY_SPIKE_PORT=8090
```

The script loads the root `.env` without printing either credential.

## Run

```powershell
node tools/vnpay-sandbox/vnpay-spike.mjs
```

Open `http://localhost:8090`, create a test payment, and complete it in the VNPay sandbox.

`VNPAY_CHECKOUT_DURATION_SECONDS` defaults to `900` (15 minutes). For the targeted short-Hold experiment, start a fresh spike process with this value set to `300`, create one payment, and verify that VNPay displays a five-minute countdown. This setting is only for the disposable spike; production checkout expiry must never exceed the source Hold expiry.

Each local order also has a **Query VNPay** button. It sends a signed `querydr` request to VNPay, verifies the response signature, and compares both `vnp_TxnRef` and `vnp_Amount` before the result is considered trusted. This is the reconciliation path to test when an IPN is delayed or missing.

The Return URL can remain localhost because VNPay redirects the user's browser. The IPN is a server-to-server request and therefore needs a public HTTPS tunnel to:

```text
https://<temporary-tunnel-host>/vnpay/ipn
```

Start the tunnel only after the local health check succeeds. Do not expose PostgreSQL, Redis, the Docker socket, or the whole workstation.

The repository-local Cloudflare binary can be started with:

```powershell
.\local-data\bin\cloudflared.exe tunnel --url http://localhost:8090
```

Copy the generated `https://...trycloudflare.com` host and append `/vnpay/ipn`. Quick Tunnel URLs change whenever the tunnel is restarted, so this is suitable only for the provider spike. Stop it with `Ctrl+C` when testing ends.

## Verify locally

```powershell
node --test tools/vnpay-sandbox/vnpay-spike.test.mjs
```

Expected provider behavior captured by this spike:

- `vnp_TxnRef` is created and stored before redirecting to VNPay.
- The amount sent to VNPay is the VND amount multiplied by 100.
- VNPay timestamps use GMT+7 and `yyyyMMddHHmmss`.
- Incoming checksum verification occurs before order lookup or mutation.
- Success requires both `vnp_ResponseCode=00` and `vnp_TransactionStatus=00`.
- Unknown, incomplete or suspicious provider states remain `PENDING`; they are not guessed to be failures.
- Verified provider transaction status `02` maps to local `FAILED` in the spike.
- Provider transaction status `04` stays `PENDING` for reconciliation because VNPay documents it as a reversal where the bank may already have debited the customer. It is unsafe to allow an immediate retry.
- A duplicate IPN returns `RspCode=02` and performs no second transition.
- Invalid-signature, unknown-order and amount-mismatch IPNs return `97`, `01` and `04` respectively without mutating the order.
- The Return URL verifies and displays data but never changes durable state.
- QueryDR results are trusted only when the response signature, transaction reference, amount and query response code all match.
- QueryDR network errors, non-2xx responses and malformed JSON leave the order `PENDING` and are recorded as an observable transport error.
- A checkout stores its durable `checkoutExpiresAt`. The first trusted status `01` result counts only at least five minutes after that expiry; a second qualifying result must be at least another five minutes later.
- Two qualifying signed QueryDR status `01` results change the spike's local state to `TIMEOUT`, record `completedAt`, and retain the raw provider fields for audit.
- A late contradictory QueryDR result is recorded as a state conflict and never overwrites a previously terminal local state.
- A late signed success IPN after local `TIMEOUT` is acknowledged as already confirmed, stored as `lateProviderResult`, and never silently overwrites the local terminal state in this database-free spike.

The automated suite covers malformed payment input, signature tampering, duplicate and concurrent callbacks, terminal failure, in-progress results, QueryDR mismatches, QueryDR transport failures, bounded local timeout, late success conflict and reordered contradictory terminal results.

## Observed sandbox evidence

Observed against VNPay Sandbox on 2026-10-08:

- A completed test payment returned a valid signed browser success before the IPN arrived. The local state correctly remained `PENDING` until the signed IPN arrived, then became `SUCCESS`.
- A later signed QueryDR returned response code `00`, transaction status `00`, and matching transaction reference and amount for that completed payment.
- A checkout request that reached a VNPay error page was still reported by signed QueryDR as response code `00` with transaction status `01` (not completed). The spike conservatively kept the local order `PENDING` instead of guessing `FAILED`.
- A user-cancelled sandbox checkout produced a signed IPN with response code `24` and transaction status `02`; the spike safely changed that attempt to `FAILED`. QueryDR for the same transaction was signed and matched the order and amount, but returned transaction status `11`, which is not listed in VNPay's documented QueryDR transaction-status table. The IPN result remains authoritative and the undocumented QueryDR value is not allowed to overwrite it.
- Re-querying the same transaction inside VNPay's duplicate-request window produced QueryDR response code `94`. Reconciliation must therefore be throttled and must not poll the provider continuously.
- A clean checkout reached the OTP screen, received no user action, and became unusable when its 15-minute countdown expired. No terminal IPN arrived. Signed QueryDR calls approximately six and eleven minutes after expiry both returned response code `00`, transaction status `01`, and matching transaction reference and amount.
- A second clean checkout used `vnp_ExpireDate = vnp_CreateDate + 5 minutes`. VNPay displayed a five-minute countdown at the OTP screen and changed to its expired-transaction page when that countdown ended, proving that a checkout can be capped to a short remaining Hold lifetime.
- Sprint 3 therefore keeps the attempt `PENDING` at checkout expiry and uses a bounded domain policy: two trusted `01` QueryDR results at least five minutes apart, with no verified success, close the local attempt as `TIMEOUT`. The raw VNPay status remains `01` for audit. One result, an invalid/mismatched result or a transport failure is insufficient.
- The sandbox Merchant/SIT portal did not consistently list the observed payment, so portal visibility is not treated as settlement evidence. Signed IPN and signed QueryDR are the authoritative integration signals for this spike.

Interactive sandbox runs covered verified success, user cancellation, a normal abandoned checkout
and a five-minute abandoned checkout. Their approved decisions—durable correlation, checkout
replay, Hold-capped lifetime, bounded local timeout, conservative status mapping and narrow
late-success precedence—are implemented in the Sprint 3 backend. Unsafe verified late charges
remain a manual-refund concern outside the automatic settlement path.
