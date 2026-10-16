# Sprint 02 Booth Selection and Allocation Hold

## 1 Purpose

Sprint 2 delivers the Booth workflow from physical Booth setup through Organizer selection and a
temporary payment hold. It intentionally stops before payment processing and final Booth
assignment. Sprint 3 later implemented initial Payment and Assignment; the Sprint 4 baseline moved
business-refund behavior to Post-MVP reference scope.

## 2 Sprint goal

```text
Organizer manages physical Booths
→ Organizer enables Booths and sets Event-specific prices
→ Approved Partner views the Event Booth map
→ Partner submits a BoothRequest without locking the Booth
→ Organizer reviews competing requests and selects one
→ System creates one ACTIVE BoothHold and locks the price
→ System emails the selected Partner after the transaction commits
→ Hold expiry releases the Booth and marks the selected request PAYMENT_EXPIRED
```

## 3 Included Use Case slices

| ID | Use Case | Sprint 2 delivery |
|---|---|---|
| UC-O02 | Manage Locations | CRUD for physical Booth locations and Event-specific Booth configuration; derive runtime availability |
| UC-E02 | Manage Booth Request | Approved Partner browses Booths, submits a request, views its state and withdraws while Pending |
| UC-O04 | Review Booth Requests | Responsible Organizer lists candidates, rejects a Pending request or selects one to create a price-locked Hold |

UC-E03 Pay & View Booth is not implemented in this Sprint. Sprint 2 only exposes the selected Hold information required by the future payment flow.

## 4 Main database tables

- `locations`
- `booths`
- `event_booth_configs`
- `booth_requests`
- `booth_holds`

The migration must be V6, after the applied V5 demo-role seed. Applied migrations V1 through V5 must not be edited.

The Sprint 2 form of `booth_holds` supports `booth_request_id` as its only source. A future additive migration may introduce `booth_change_request_id` when the Booth-change workflow is implemented. This keeps Sprint 2 inside its approved scope while preserving the Physical ERD lifecycle.

### 4.1 Required database protections

- `locations.code` is unique.
- A Booth uses the same identifier as its Location: `booths.booth_id` is both primary key and foreign key to `locations.location_id`.
- `event_booth_configs` is unique on `(event_id, booth_id)`.
- Capacity is positive; rental price and locked rental price are non-negative.
- `booth_requests` references the approved PartnerEventApplication and target physical Booth.
- V6 creates a partial unique index on `booth_requests (application_id, booth_id)` where status is `PENDING` or `SELECTED`, preventing more than one open request for the same Partner application and Booth.
- One BoothRequest cannot own more than one Hold.
- At most one `ACTIVE` Hold may exist for one EventBoothConfig.
- The service additionally prevents Active Holds for the same physical Booth when their Events overlap. Selection locks the physical Booth row before checking overlapping Holds so concurrent requests cannot bypass this rule.
- The existing `events.booth_payment_window_minutes` column is constrained to `60..10080` minutes inclusive and defaults to `1440` for a new Event. V6 replaces the earlier non-negative constraint and normalizes legacy out-of-range values to the nearest valid boundary before adding the new constraint.
- Hold creation uses one backend Clock instant for `selected_at` and `created_at`, then calculates `expires_at = selected_at + booth_payment_window_minutes`.
- `expires_at` is persisted and never recalculated from the Event after Hold creation.
- Indexes must support request lookup by Booth/status and expiry lookup by Hold status/expiry time.

## 5 Core business decisions

### 5.1 Physical Booth and Event configuration are different

- A Booth is a reusable physical location such as `A05`.
- A Booth does not have a global rental price or a global `ASSIGNED` status.
- `EventBoothConfig` decides whether that Booth is offered in one Event and stores that Event's rental price.
- The same physical Booth may have different prices in different non-overlapping Events.

### 5.2 Availability is derived

For the requested Event:

- no configuration or `isEnabled = false` → `UNAVAILABLE`
- an overlapping Active assignment → `ASSIGNED`
- an overlapping Active hold → `ON_HOLD`
- otherwise → `AVAILABLE`

Sprint 2 has no BoothAssignment table yet, but the availability service must be designed so the assignment check can be added without changing the public API.

### 5.3 Request does not reserve a Booth

- Submitting creates only a `PENDING` BoothRequest.
- Multiple approved Partners may have Pending requests for the same Booth.
- A Pending request does not change runtime Booth availability.
- A Partner may withdraw only its own Pending request.
- One Partner may have at most one open request for the same Event–Booth; open means `PENDING` or `SELECTED`.
- After `WITHDRAWN` or `PAYMENT_EXPIRED`, the Partner may create a new record if deadline, quota and availability rules still pass.
- After `REJECTED`, the Partner cannot submit again for that same Event–Booth but may request another Booth.
- Historical requests are never restored or reused.
- Because closed rows are outside the V6 partial unique index, service validation remains responsible for rejecting same-Event–Booth resubmission after `REJECTED`.

### 5.4 Organizer selection creates the Hold

The selection transaction must follow the steps below. Sprint 4 additionally prefixes the active
transaction lock order with the Event row and rechecks Event status/backend time before these
Sprint 2 checks.

1. identify the Organizer from the authenticated session;
2. verify ownership of the Event;
3. lock the physical Booth and Event Booth configuration in a fixed order;
4. verify the request is still `PENDING`;
5. re-check Partner approval, deadline, quota, configuration and availability;
6. change the winner to `SELECTED`;
7. create one `ACTIVE` BoothHold;
8. copy `rentalPrice` to `lockedRentalPrice`;
9. use the same backend Clock instant for `selectedAt` and Hold creation, then calculate `expiresAt = selectedAt + boothPaymentWindowMinutes`;
10. commit the request and Hold atomically.
11. after commit, trigger an email to the selected Partner with the Event, Booth, locked price and expiry time.

Competing requests remain `PENDING`. They do not become `NOT_SELECTED` until a future Sprint creates a successful BoothAssignment.

### 5.5 Hold expiry

- An expired Active Hold becomes `EXPIRED`.
- Its source request becomes `PAYMENT_EXPIRED`.
- The Booth becomes available again when no other Active Hold or assignment blocks it.
- `releasedAt` records the time when the backend processes the expiry.
- Expiry processing must be idempotent and safe when multiple application instances run.

The implementation should combine a scheduled expiry job with an expiry check before availability-sensitive commands. PostgreSQL remains the source of truth; Redis must not be the only place where a Hold is stored.

### 5.6 Hold window and selection email

- `boothPaymentWindowMinutes` is configured per Event and stored as minutes in `events.booth_payment_window_minutes`.
- Its valid inclusive range is `60..10080` minutes (1 hour through 7 days).
- A newly created Event defaults to `1440` minutes, equivalent to 24 hours, so a Partner selected outside business hours has a reasonable response window.
- For a newly created Event, the Organizer UI initializes the control to `24 Hours`. When editing an existing Event, it displays the currently persisted value, converted from `boothPaymentWindowMinutes` for presentation when needed.
- The UI may display a numeric value plus Hours/Days selector, but it converts the value to minutes for the existing Event create/update API.
- A permitted change affects only future selections. It must not update `expiresAt` for an existing Hold.
- Under the implemented Sprint 4 baseline, publish and operational update require
  `boothRequestDeadlineAt + boothPaymentWindowMinutes <= startAt`; selection remains rejected after
  `boothRequestDeadlineAt`, so a new Hold's scheduled `expiresAt` cannot be later than Event start.
  Unresolved Payment evidence may preserve that Hold as `ACTIVE` past `expiresAt` under the Sprint
  3/4 reconciliation policy; this does not pause the Event lifecycle.
- Demo Events may use a shorter valid window. Automated expiry tests advance an injected Clock rather than storing an invalid sub-hour window.
- Sprint 2 does not define or implement a payment-session duration. Sprint 3 must ensure that every payment session ends no later than `BoothHold.expiresAt`.
- Selection email is triggered only after the database transaction commits.
- Email failure is logged and does not roll back the request or Hold.
- Sprint 2 does not add an outbox, notification table or complex email retry system.

## 6 Roles and ownership

- Public users may view Booth availability for a Published Event.
- Only an authenticated, verified `PARTNER` may create or manage its Partner Organization's Booth requests.
- The Partner must have an `APPROVED` PartnerEventApplication for the Event.
- Only an authenticated, verified `ORGANIZER` may manage Booth resources and configurations.
- Only the Organizer responsible for an Event may configure its Booths or review its Booth requests.
- Request bodies must not contain user IDs or Organizer IDs for claiming ownership.

## 7 Out of scope

- Payment gateway initiation, callback or webhook
- Payment-session duration policy
- `booth_payments`
- `booth_assignments`
- Marking competing requests `NOT_SELECTED`
- Booth change and cancellation
- Partner withdrawal from the whole Event
- Refunds
- Advanced graphical map editor, drag/drop and map versions
- Activity Location conflict management
- Activity Proposal and Activity lifecycle

## 8 Definition of Done

Sprint 2 is done only when all of the following are true:

- Physical Booths and Event-specific Booth configurations persist in PostgreSQL.
- A Published Event exposes Booths with derived availability.
- Public users can view a simple Booth grid with Booth code, category, Event price, details and derived availability.
- Only an approved Partner can submit a Booth request before the Event deadline.
- An approved Partner can submit from an `AVAILABLE` Booth; `ON_HOLD`, `ASSIGNED` and `UNAVAILABLE` Booths cannot be requested.
- A Pending request does not lock the Booth.
- Multiple Partners can request the same available Booth.
- Partner ownership is enforced for list, detail and withdrawal.
- Organizer Event ownership is enforced for configuration and review.
- Concurrent selection cannot create conflicting Active Holds for the same physical Booth across overlapping Events.
- Selection snapshots the configured rental price.
- Selection snapshots the effective payment deadline into `BoothHold.expiresAt`; later Event setting changes do not alter existing Holds.
- Competing requests stay Pending during the payment window.
- Hold expiry releases availability and moves only the selected request to `PAYMENT_EXPIRED`.
- Selection email is triggered only after transaction commit; tests verify the mail-service invocation rather than external provider delivery.
- Every Sprint 2 Acceptance Criterion passes.
- Backend tests and frontend lint/build pass in CI.
- The Playwright Sprint 2 happy path passes as a required local pre-merge check until a dedicated E2E GitHub Actions job is added.
- Swagger/OpenAPI describes separate pagination parameters and valid sort fields.
- No payment success or Booth assignment can be fabricated by a frontend request.

## 9 Demo scenario

1. An Organizer signs in and creates or updates physical Booth `A05`.
2. The Organizer configures a 24-hour payment window, enables `A05` for a Published Event and sets its rental price.
3. Two approved Partners view `A05` in the Booth grid as `AVAILABLE`, open its details and each submits a request.
4. Both requests remain `PENDING`, and `A05` is still `AVAILABLE`.
5. The responsible Organizer views both candidates and selects one.
6. The selected request becomes `SELECTED`; an Active Hold contains the locked price and expiry time.
7. After commit, the mail service is invoked for the selected Partner.
8. The other request remains `PENDING`; `A05` appears as `ON_HOLD` and cannot receive a new request.
9. The demo advances through the configured valid payment window, or an automated test advances its controllable Clock.
10. The selected request becomes `PAYMENT_EXPIRED`, the Hold becomes `EXPIRED`, and `A05` is available for another candidate.

## 10 Implementation sequence

1. Add the Sprint 2 migration and persistence model.
2. Implement Booth catalog and Event Booth configuration.
3. Implement public Event Booth queries with derived availability.
4. Implement Partner BoothRequest commands and owned queries.
5. Implement Organizer review, selection and rejection.
6. Implement safe Hold expiry and post-commit selection email.
7. Add integration, concurrency and authorization tests.
8. Integrate frontend screens against the approved API contract.
9. Run the full Sprint 1 regression suite and Sprint 2 end-to-end demo.
