# Sprint 04 Event Lifecycle and Pre-payment Booth Release

> Status: `COMPLETED` on 2026-10-16. Sprint 4 hardens the Event lifecycle and lets a Partner
> release an uncommitted Booth Hold without introducing post-assignment cancellation, Booth
> change or business-refund execution. Verification evidence is recorded in the
> [Sprint 4 Completion Report](../development/SPRINT_04_COMPLETION_REPORT.md).

## 1 Purpose

Sprint 4 closes two gaps left by the first three Sprints:

1. an Organizer needs safe update, delete and cancellation rules after an Event is published;
2. a selected Partner who no longer wants to pay should not have to occupy a Booth until Hold
   expiry when no payment result or Assignment is at risk.

The Sprint preserves the Sprint 3 rule that uncertain gateway evidence is blocking. It does not
weaken the verified-payment boundary and never releases a Booth while VNPay may still report a
late success.

## 2 Included Use Case slices

| ID | Use Case | Sprint 4 delivery |
|---|---|---|
| UC-O01 | Manage Events | Delete a Draft, safely patch a published Event, cancel an eligible published Event and advance timed lifecycle states |
| UC-E02 | Manage Booth Request | Withdraw a Pending request or release an eligible Selected request before settlement |

No new top-level Use Case is introduced.

## 3 Scope lock

### In scope

- Hard-delete an owned `DRAFT` Event and its Event-scoped Booth configuration only.
- Patch descriptive fields on `PUBLISHED` and `ONGOING` Events.
- Patch operational fields on a `PUBLISHED` Event only before any external participation record
  exists.
- Cancel an owned `PUBLISHED` Event only when no Payment `PENDING`/`SUCCESS`,
  reconciliation-required evidence or Assignment exists.
- Release Active Holds and cancel open Booth requests atomically with Event cancellation.
- Extend the existing Partner Booth-request withdrawal command to an eligible `SELECTED` request.
- Automatically advance `PUBLISHED → ONGOING → COMPLETED` from backend time.
- Update public Event visibility for the expanded lifecycle.
- Post-commit email notification for affected Partner applications when an Event is cancelled.
- Event-rooted serialization for participation, selection, payment and lifecycle mutations.
- A temporal invariant that keeps every new Booth payment window's scheduled expiry within the
  pre-Event period, plus an explicit policy for unresolved gateway evidence crossing Event start.
- V8 migration, authorization, validation, idempotency, concurrency and regression tests.

### Out of scope

- Cancelling an `ONGOING` or `COMPLETED` Event.
- Hard-deleting an Event that has ever been published.
- Booth change or cancellation after Assignment.
- Partner withdrawal from the whole Event after approval.
- Business refund execution or cutoff-based refund policy.
- Releasing a Hold while a Payment is `PENDING`, `SUCCESS` or reconciliation-blocking.
- Admin emergency cancellation of an Event already in progress.
- In-app Notification storage/UI; Sprint 4 uses existing post-commit email delivery.
- Activity and Participant cascading beyond rejecting new work against a non-Published Event.

Post-assignment Booth change/cancellation, Event cancellation after settlement and automatic
refunds remain documented only as post-MVP extensions.

## 4 Event lifecycle

The persisted lifecycle is:

```text
DRAFT ──publish──> PUBLISHED ──startAt reached──> ONGOING ──endAt reached──> COMPLETED
                         └──eligible Organizer cancellation──> CANCELLED
```

Rules:

- transitions never move backwards;
- `COMPLETED` and `CANCELLED` are terminal;
- only `PUBLISHED` can be cancelled by an Organizer in this Sprint;
- lifecycle advancement is idempotent and based on the backend `Clock`;
- a scheduled run may advance overdue `PUBLISHED` directly to `COMPLETED` after a restart;
- request-time guards must also compare backend time so correctness does not depend on scheduler
  timing.

## 5 Event mutations

### 5.1 Draft deletion

- Only the owning Organizer can delete the Event.
- The Event must still be `DRAFT` under a row lock.
- Event-scoped `event_booth_configs` are deleted in the same transaction.
- Physical `locations` and `booths` are never deleted.
- Any unexpected external dependency rejects the command instead of cascading business history.
- Repeating the command after deletion returns ownership-safe `404 EVENT_NOT_FOUND`.

### 5.2 Published update

Descriptive fields may be patched while status is `PUBLISHED` or `ONGOING`:

- `name`
- `description`
- `bannerUrl`

Operational fields may be patched only while status is `PUBLISHED` and no external participation
record exists:

- `startAt`, `endAt`
- application, Booth, Activity and Participant deadlines/cutoffs
- `boothPaymentWindowMinutes`
- `maxBoothsPerPartner`
- `maxActivitiesPerPartner`

For the schema implemented through V7, external participation means any Partner application or
Booth request/Hold/Payment/Assignment belonging to the Event. Event Booth configuration created by
the Organizer is not external participation and does not by itself freeze operational fields.
When Activity or Participant modules are implemented, their first external-participation records
must be added to the same freeze guard before those modules are released.

The merged Event must pass the normal Event validation. Operational-field updates also require
`startAt` to remain in the future. A *still-open deadline* is a configured deadline/cutoff that has
not elapsed at command time; if supplied in the patch it must remain strictly in the future. An
elapsed deadline cannot be reopened in Sprint 4. The Booth timing invariant is validated on publish
and every operational patch:

```text
boothRequestDeadlineAt + boothPaymentWindowMinutes <= startAt
```

Because selection is also rejected after `boothRequestDeadlineAt`, every newly created Hold has a
scheduled `expiresAt` no later than Event start. Existing Holds retain their persisted `expiresAt`
and are never extended by an Event update. An unresolved `PENDING` or reconciliation-required
Payment may nevertheless keep a Hold `ACTIVE` after `expiresAt`; section 5.4 defines that safety
exception. A request mixing descriptive and forbidden operational changes fails atomically;
allowed fields are not partially applied.

### 5.3 Event cancellation

Cancellation requires:

- owned Event with status `PUBLISHED`;
- a non-blank normalized reason of 10 to 500 characters;
- no `SUCCESS` Booth Payment;
- no `PENDING` Booth Payment;
- no Payment with `reconciliationRequired=true`;
- no BoothAssignment, including a zero-price Assignment.

Terminal, non-conflicting `FAILED` or `TIMEOUT` attempts do not block cancellation.

The reason is public-facing: it is returned by public Event detail and must therefore be written for
Partners and visitors, without internal credentials, incident secrets or private financial data.
The API normalizes and validates text but cannot infer whether prose contains confidential content.

A provider result that contradicts one of those terminal records after cancellation is not silently
discarded. The existing Sprint 3 settlement boundary records it as reconciliation-required evidence
for manual financial handling; Sprint 4 does not reopen the Event or introduce an automatic refund.

In one transaction, cancellation:

1. locks the Event;
2. rechecks payment and Assignment blockers;
3. records `CANCELLED`, `cancelledAt` and `cancellationReason`;
4. changes open `PENDING` and `SELECTED` Booth requests to `CANCELLED` with `cancelledAt`;
5. changes their Active Holds to `RELEASED` with `releasedAt`;
6. commits before sending email.

Partner applications remain immutable history. The Event status makes them non-actionable.
After commit, notification targets are the verified User emails of representatives whose
PartnerOrganization application for the Event is `PENDING` or `APPROVED`; duplicate normalized
addresses receive at most one cancellation email. Rejected/Withdrawn applications and
missing/unverified addresses are skipped. Notification delivery failure is logged and does not roll
back cancellation or prevent best-effort delivery to the remaining recipients.

Repeating cancellation as the owning Organizer after the Event is already `CANCELLED` returns the
current Event with `200 OK`. It does not change the original reason or timestamp, re-run cascades or
send another email. Normal request-body validation still applies; a syntactically valid retry reason
is ignored rather than replacing the original. Other non-Published states remain conflicts.

### 5.4 Payment resolution across Event start

The payment-window invariant controls when checkout is offered; it does not permit deletion of
uncertain gateway evidence. If a Payment is still `PENDING` or reconciliation-required when its
scheduled Hold expires, the Hold remains `ACTIVE`, blocks another attempt/reassignment and may
cross into `ONGOING`. The Event still advances from backend time and is never held in `PUBLISHED`
just because payment resolution is late.

Payment settlement/reconciliation locks and rechecks the Event before changing financial state:

- trusted success while the Event is `PUBLISHED` or `ONGOING` may complete the existing atomic
  settlement and create the Assignment;
- trusted success after the Event is `COMPLETED` or `CANCELLED` is retained as
  reconciliation-required evidence for manual financial handling and creates no Assignment;
- trusted terminal failure/timeout closes the Payment and lets the normal expiry flow close the
  Hold/request; after the Booth request deadline the system does not auto-select another candidate.

Request-time guards advance/re-evaluate the effective Event status under the Event lock, so a late
scheduler run cannot cause settlement to decide from stale `PUBLISHED` state.

## 6 Pre-payment Booth release

The existing endpoint remains the single withdrawal command.

### Pending request

`PENDING → WITHDRAWN` remains unchanged and has no Hold to release.

### Selected request

`SELECTED → WITHDRAWN` is allowed only when:

- its Hold is `ACTIVE`;
- no Payment is `PENDING` or `SUCCESS`;
- no Payment has reconciliation-required evidence;
- no Assignment exists.

Verified, terminal `FAILED` or `TIMEOUT` attempts do not block withdrawal.

If those terminal states have already expired the Hold, the existing expiry path finishes the
request; the Selected-withdraw command only releases a Hold that is still `ACTIVE`. A later provider
success that contradicts terminal evidence is retained for manual reconciliation and never silently
reassigns the released Booth.

For `PENDING`, the transaction locks `Event → BoothRequest`. For `SELECTED`, it locks
`Event → Hold → Payment rows ordered by boothPaymentId → BoothRequest`, rechecks eligibility,
changes the request to `WITHDRAWN`, records `withdrawnAt`, changes the Hold to `RELEASED` and
records `releasedAt`. It does not auto-select another candidate; the Organizer chooses from
remaining `PENDING` requests.

Repeating withdrawal on an already owned `WITHDRAWN` request returns the current state with no
additional mutation. Other terminal states return a conflict.

## 7 Public Event visibility

- Default discovery lists `PUBLISHED` and `ONGOING` Events.
- A status filter may request `COMPLETED` history.
- `DRAFT` and `CANCELLED` do not appear in discovery lists.
- Public detail returns any Event that has been published, including `ONGOING`, `COMPLETED` and
  `CANCELLED`, so an existing link can explain that an Event was cancelled.
- A Draft or another Organizer's private data remains ownership-safe `404`.

## 8 Data model

Sprint 4 owns V8. V1 through V7 are immutable.

V8 adds:

- `events.cancelled_at TIMESTAMPTZ NULL`;
- `events.cancellation_reason TEXT NULL`;
- Event cancellation consistency checks;
- `CANCELLED` to the `booth_requests.status` constraint;
- `booth_requests.cancelled_at TIMESTAMPTZ NULL`;
- Booth-request cancellation consistency checks.

`events.status` has allowed `CANCELLED` since V3, before cancellation metadata existed. Therefore
the V7→V8 migration first backfills any legacy/manual `CANCELLED` Event with
`cancelled_at = updated_at` and the public-safe fallback reason
`Sự kiện đã được hủy trước khi hệ thống lưu lý do.`. It then adds the consistency CHECK requiring
both cancellation fields for `CANCELLED` and requiring both to be null for every other status.
V6 does not permit a legacy `CANCELLED` BoothRequest, so no BoothRequest backfill is needed before
its status CHECK is replaced.

V8 does not remove the already-applied `REFUND`-capable columns from `booth_payments`. They remain
unused extension points, not an active MVP workflow. V8 creates no Booth-change, Booth-cancellation
or Partner-withdrawal request table.

## 9 Concurrency and transaction boundaries

- Every state-changing Event-scoped command that can affect participation or money locks the Event
  row first and rechecks Event status/backend time. This includes application submit/review, Booth
  request submit/review/selection/withdrawal, payment creation/settlement/reconciliation/expiry and
  Event update/delete/cancel/lifecycle advancement.
- Within the Booth/payment domain, the remaining global order is
  `Event → Booth (when applicable) → EventBoothConfig (when applicable) → Hold → Payment rows by
  ascending id → BoothRequest`.
  Multiple rows at any level are locked by ascending primary key. A command skips irrelevant levels
  but never acquires them in reverse order.
- Event-root locking serializes an operational patch with the first external-participation insert:
  either the patch commits first and the command revalidates against the new Event, or participation
  commits first and freezes operational fields.
- Event-root locking also serializes cancellation with application/Booth request submission,
  selection and payment work. After cancellation wins, later work rechecks `CANCELLED` and fails;
  if eligible work commits first, cancellation observes it and applies the documented blocker.
- VNPay/network calls never occur while database locks are held.
- Event cancellation racing payment creation has one valid winner: either cancellation commits and
  later payment creation is rejected, or the Payment becomes durable and cancellation is rejected.
- Selected withdrawal racing IPN settlement has one valid winner: either withdrawal releases the
  Hold before any eligible payment result exists, or settlement blocks withdrawal.
- Hold expiry and selected withdrawal converge on one terminal Hold transition.
- Scheduler transitions use locked, status-qualified updates and are safe to retry.

## 10 Definition of Done

- [x] Source-of-truth documents no longer describe post-assignment Booth change/refund as current MVP.
- [x] V8 applies cleanly after V7 and Hibernate validation succeeds.
- [x] Draft delete, published update, cancellation and lifecycle transition rules are covered by tests.
- [x] Publish and operational patch reject a Booth deadline/payment-window combination that extends
  beyond `startAt`; selection after the Booth request deadline is rejected.
- [x] An unresolved Payment may keep its Hold Active across Event start without pausing lifecycle;
  trusted success settles while the Event is Published or Ongoing, while terminal-Event success is
  retained for manual reconciliation without creating an Assignment.
- [x] Operational patch, cancellation and the first external-participation command are race-tested
  under the Event-root lock.
- [x] Payment initiation, IPN settlement, QueryDR reconciliation and expiry are race-tested against
  lifecycle advancement under the shared Event-rooted lock order.
- [x] Event cancellation never succeeds with a successful, unknown or reconciliation-blocking Payment
  or any Assignment.
- [x] Cancellation releases eligible Holds and closes open Booth requests atomically.
- [x] A selected Partner can release an eligible Hold immediately without waiting for expiry.
- [x] No withdrawal can race a trusted success into an unowned charge or reassigned Booth.
- [x] Duplicate cancellation is mutation-free and cancellation email recipients are deduplicated.
- [x] Public Event list/detail behavior matches section 7.
- [x] Existing Sprint 1–3 regression, VNPay spike, frontend lint and frontend build remain green.

