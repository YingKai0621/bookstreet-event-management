# Sprint 3 frontend delivery

Date: 2026-10-11
Branch: `codex/sprint3-frontend-completion`

The missing UC-E03 frontend flow is connected to the existing Session/CSRF REST APIs.
No backend, schema, migration or shared context files are changed by this task.

## Delivered behavior

- Partner request history links to `/partner/booth-requests/:requestId/payment`.
- The approved-Event selector allows access to requests for each approved Event.
- A selected, Active Hold can initiate checkout using the locked rental price.
- A Pending attempt is resumed with its backend idempotency key, including from another tab.
- A Failed/Timeout retry gets one durable key per source attempt. Lost responses and reloads
  reuse that retry key; another click does not create another attempt.
- All payment-history pages are checked before enabling checkout. A reconciliation conflict in
  an older attempt also blocks retry.
- `/payment/vnpay/return` parses only the `BSP{paymentId}` correlation. It reads the owned Payment
  from the backend and redirects to the corresponding request. Browser success/failure fields
  never establish payment state or cause a write to the IPN endpoint.
- Login preserves the Return URL and correlation parameters.
- The result page polls backend Payment/Request state while resolution is pending, retries
  transient read errors and offers manual refresh. Polling is cancelled when navigating away.
- Payment history is paginated and exposes per-attempt status, amount, gateway reference,
  failure details and completion timestamps.
- Completed requests load the owned Assignment API and display allocation information, price,
  assignment time, optional cover image and the assignment's QR token.
- Free Booths display their Assignment without inventing a Payment.
- Consumed Holds are labelled as assigned, rather than released.
- Backend-expired Holds have no new-checkout control. A frontend countdown never marks a
  Payment Failed/Timeout or releases a Hold.

## Acceptance-criterion mapping

| Sprint 3 criteria | Frontend contribution |
|---|---|
| AC-E03-01–05 | Owned selected-request checkout, stable idempotency, retry and deadline UI |
| AC-E03-06–08, 11–12 | Results are backend reads; no browser settlement or gateway secret |
| AC-E03-09–10 | Owned payment detail/history, Assignment/QR view and assigned-Hold label |
| AC-E03-13–17 | Reconciling result, blocked duplicate charge, conflict and expiry presentation |
| AC-E03-18 | Free-Booth Assignment without checkout or fabricated payment history |

Backend transactions, locks, signature verification and availability calculations remain owned
by the existing Sprint 3 backend. These frontend tests do not replace backend integration tests.

## Validation

Run from `frontend/`:

```powershell
npm run build
npm run lint
npx tsc -p tsconfig.e2e.json --noEmit
npm run test:sprint3
```

Validation result: build, lint and E2E TypeScript checks passed; Chromium **18/18 passed**.
Lint retains existing project warnings, and the build retains its existing large-bundle warning.

The dedicated Chromium suite covers Return/polling/success, checkout handoff, restoring Pending
keys, retry after a lost response and reload, HTTP 202 reconciliation, contradictory evidence,
free allocation, expiry, history pagination, invalid Return correlation, ownership-safe 404,
cross-request correlation rejection, login recovery, request-list navigation, older conflicts,
unavailable history, short payment windows and a mobile viewport.

The suite uses mocked REST responses and a local checkout destination. It verifies frontend
behavior and API contracts; it does not claim a real VNPay payment was completed. The pre-existing
Sprint 2 UI spec contains selectors for an older page layout and is not this task's acceptance
suite.

## Real sandbox handoff

The full Sprint 3 demo gate additionally requires a live sandbox transaction. Local inspection
found the backend responding, but the root environment did not provide VNPay Sandbox credentials
or E2E Organizer/Partner credentials, so that gate was not executed in this task.

1. Configure sandbox merchant credentials privately in the backend environment.
2. Set `VNPAY_RETURN_URL` to the frontend's `/payment/vnpay/return` URL.
3. Register a public HTTPS IPN ending in `/api/v1/payments/vnpay/ipn` with VNPay.
4. Use an approved Partner request selected by its Organizer, with an Active Hold and a positive
   locked price of at least 5,000 VND.
5. Open **Yêu cầu gian hàng → Yêu cầu của tôi → Xem thanh toán & gian hàng**, start checkout,
   and complete the VNPay Sandbox transaction.
6. On Return, confirm that the frontend remains Pending until trusted backend evidence arrives,
   then displays Success, the Assignment and QR. Reload and confirm the same history/Assignment.
7. Repeat with a sandbox cancellation and retry while the Hold's payment window remains open.

Do not enter merchant secrets in frontend configuration or manually mark a Payment as successful.
Frontend implementation is delivered; final Sprint 3 sandbox/deployment acceptance remains a
separate runtime verification. `AI_CONTEXT.md` and the Sprint status documents should be updated
by their assigned context owner using this report and the live verification evidence.
