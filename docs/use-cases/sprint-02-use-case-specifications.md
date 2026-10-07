# Sprint 02 Use Case Specifications and Acceptance Criteria

## 1 Scope

This document specifies the Sprint 2 slices of UC-O02, UC-E02 and UC-O04. The Sprint ends with a price-locked BoothHold. Payment and BoothAssignment belong to Sprint 3.

---

## UC-O02 Manage Locations - Booth slice

### Goal

Allow an Organizer to maintain reusable physical Booths and configure which Booths are offered in an Event.

### Primary actor

Event Organizer

### Preconditions

- The actor is authenticated with a verified `ORGANIZER` role.
- The Event exists and is owned by the current Organizer for Event-specific commands.

### Main flow

1. The Organizer creates or updates a physical Booth with code, name, capacity, map coordinates and optional category/note.
2. The system stores the shared Location and Booth subtype atomically.
3. The Organizer reviews the Event payment window, which defaults to 24 hours, and may choose a value from 1 hour through 7 days.
4. The frontend converts the selected duration to minutes and updates the existing Event-level `boothPaymentWindowMinutes` field.
5. The Organizer enables the Booth for an owned Event and provides the rental price.
6. The system creates or updates the unique Event–Booth configuration.
7. Query APIs derive availability from configuration and Active Holds.

### Alternative and exception flows

- A1. Booth code already exists: reject as duplicate.
- A2. Capacity is not positive, price is negative or coordinates are invalid: reject validation.
- A3. The Organizer does not own the Event: hide the Event or deny access according to the existing ownership policy.
- A4. The Organizer disables a configuration with an Active Hold: reject the state transition.
- A5. A Booth has historical references: deactivate it instead of deleting history.
- A6. Payment window is below 60 or above 10080 minutes: reject validation without changing the Event.

### Postconditions

- Physical Booth data remains reusable across Events.
- Each Event–Booth pair has at most one configuration.
- Rental price belongs to EventBoothConfig, not Booth.
- The payment window belongs to the Event and is stored in minutes; no second settings record is created.

### Related rules

- BR-03
- BR-17
- BR-19
- BR-57
- BR-70

### Acceptance Criteria

**AC-O02-01 Create a physical Booth**

```gherkin
Given a verified Organizer is authenticated
And no Location uses code "A05"
When the Organizer creates Booth A05 with valid capacity and coordinates
Then the system creates one Location and one Booth subtype atomically
And returns HTTP 201
```

**AC-O02-02 Unique Booth code**

```gherkin
Given a Location with code "A05" exists
When an Organizer attempts to create another Booth with code "A05"
Then the system returns HTTP 409 with BOOTH_CODE_ALREADY_EXISTS
And creates no records
```

**AC-O02-03 Configure a Booth for an Event**

```gherkin
Given the current Organizer owns an Event
And Booth A05 exists and is active
When the Organizer enables A05 with a valid rental price
Then exactly one EventBoothConfig exists for that Event and Booth
And a later update changes that same configuration instead of creating a duplicate
```

**AC-O02-04 Event ownership**

```gherkin
Given another Organizer owns the Event
When the current Organizer tries to change its Booth configuration
Then the system returns HTTP 404 or the established ownership-safe denial
And persists no change
```

**AC-O02-05 Derived availability**

```gherkin
Given A05 is enabled for a Published Event
And no Active Hold blocks it
When a user views the Event Booth list
Then A05 is AVAILABLE
When an Active Hold is created for A05
Then A05 is ON_HOLD
```

**AC-O02-06 Cannot disable a held Booth**

```gherkin
Given an Active Hold exists for an Event Booth configuration
When the responsible Organizer tries to disable that configuration
Then the system returns HTTP 409 with BOOTH_HAS_ACTIVE_HOLD
And the configuration remains enabled
```

**AC-O02-07 Public Booth grid**

```gherkin
Given an Event is Published
When a public user opens its Booth grid
Then the system returns active physical Booths with code, category, Event price, details and derived availability
And no drag-and-drop map editor is required
```

**AC-O02-08 Configure the Event payment window**

```gherkin
Given the current Organizer opens the create-Event form
Then the payment-window control initially shows 24 Hours
When the Organizer saves that value
Then the frontend submits boothPaymentWindowMinutes as 1440
Given an existing Event persists boothPaymentWindowMinutes as 720
When the Organizer opens that Event for editing
Then the payment-window control displays the persisted 720-minute value as 12 Hours
Given the Organizer creates another Event and omits boothPaymentWindowMinutes
When the backend applies Event defaults
Then the effective boothPaymentWindowMinutes is 1440
Given the Organizer supplies a payment window from 60 through 10080 inclusive
When the Event is saved
Then the backend stores that exact value in minutes
Given the Organizer supplies a payment window below 60 or above 10080
When the Event is saved
Then the system returns HTTP 422 with EVENT_CONFIGURATION_INVALID
And the invalid value is not persisted
```

---

## UC-E02 Manage Booth Request - Sprint 2 slice

### Goal

Allow an approved Partner to request a specific Booth without reserving it and to manage the request while it is Pending.

### Primary actor

Event Partner

### Preconditions

- The actor is authenticated with a verified `PARTNER` role.
- The actor represents an Active PartnerOrganization.
- That organization has an `APPROVED` application for the Published Event.
- The Booth request deadline has not passed.

### Main flow

1. The Partner views the Event Booth grid and derived availability.
2. The Partner opens an `AVAILABLE` Booth to view its code, category, Event price and details.
3. The Partner submits an optional request note from the selected Booth.
4. The backend derives the PartnerOrganization from the authenticated user.
5. The backend verifies application approval, deadline, Booth configuration, current availability and quota.
6. The system creates a `PENDING` BoothRequest.
7. The Partner views its request status.
8. While still Pending, the Partner may withdraw it.

### Alternative and exception flows

- A1. Partner application is missing or not Approved: reject with forbidden business eligibility.
- A2. Deadline has passed: reject without creating a request.
- A3. Booth is not enabled or has an Active Hold/Assignment overlapping the Event: reject as unavailable.
- A4. The request would exceed `maxBoothsPerPartner`: reject quota validation.
- A5. The same Partner already has a `PENDING` or `SELECTED` request for the same Event and Booth: reject duplicate.
- A6. Another Partner already has a Pending request: allow the new request because Pending does not lock the Booth.
- A7. Partner attempts to withdraw a Selected or closed request: reject invalid transition.
- A8. Partner accesses another organization's request: return ownership-safe not found.
- A9. A previous request for the same Event–Booth is `REJECTED`: reject resubmission for that Booth; the Partner may request another Booth.
- A10. A previous request is `WITHDRAWN` or `PAYMENT_EXPIRED`: allow a new record only if deadline, quota and availability rules still pass.

### Postconditions

- A successful submission creates a Pending request only.
- No Hold is created during submission.
- Withdrawal preserves history and sets `WITHDRAWN` with `withdrawnAt`.
- Historical requests are never restored or reused.

### Related rules

- BR-04
- BR-08
- BR-14
- BR-18
- BR-21
- BR-22
- BR-25
- BR-68

### Acceptance Criteria

**AC-E02-01 Approved Partner submits a request**

```gherkin
Given a verified Partner has an Approved Event application
And the Booth is enabled and the request deadline is open
When the Partner submits a valid Booth request
Then the system creates a PENDING BoothRequest
And returns HTTP 201
And creates no BoothHold
```

**AC-E02-02 Pending requests do not lock the Booth**

```gherkin
Given Partner A has a Pending request for A05
When Partner B with the same eligibility requests A05
Then Partner B also receives a Pending request
And A05 remains AVAILABLE until an Organizer selects a candidate
```

**AC-E02-03 Approval and deadline are enforced**

```gherkin
Given the Partner application is not Approved or the request deadline has passed
When the Partner submits a Booth request
Then the system rejects the command
And creates neither a BoothRequest nor a BoothHold
```

**AC-E02-04 Quota is enforced**

```gherkin
Given the Partner's current Active Holds and future Active Assignments have reached the Event quota
When the Partner submits the request
Then the system returns HTTP 409 with BOOTH_QUOTA_EXCEEDED
And creates no request
```

A Pending request does not consume quota by itself. The quota is checked again during Organizer selection.

**AC-E02-05 Withdraw a Pending request**

```gherkin
Given the current Partner owns a Pending BoothRequest
When the Partner withdraws it
Then the request becomes WITHDRAWN
And no Hold needs to be released
```

**AC-E02-06 Request ownership**

```gherkin
Given a BoothRequest belongs to another PartnerOrganization
When the current Partner requests its detail or withdrawal
Then the system returns HTTP 404
And reveals no request data
```

**AC-E02-07 Request from an available Booth**

```gherkin
Given an approved Partner views the Event Booth grid
When the Partner opens an AVAILABLE Booth
Then the Partner can view its code, category, Event price and details
And can submit a Booth request from that Booth
When the Booth is ON_HOLD, ASSIGNED or UNAVAILABLE
Then request submission is not allowed
```

**AC-E02-08 Resubmission policy**

```gherkin
Given a historical request exists for the same Partner, Event and Booth
When its status is WITHDRAWN or PAYMENT_EXPIRED
Then the Partner may create a new request record if every current rule passes
When its status is REJECTED
Then the Partner cannot request that same Event–Booth again
But may request another eligible Booth
```

V6 enforces one open request with a partial unique index on `(application_id, booth_id)` for `PENDING` and `SELECTED` rows. Because `REJECTED` is not covered by that index, the service must explicitly enforce the `REJECTED` resubmission rule in AC-E02-08.

---

## UC-O04 Review Booth Requests - selection slice

### Goal

Allow the responsible Organizer to compare Booth candidates, reject a request or select one candidate and create an exclusive, price-locked Hold.

### Primary actor

Event Organizer

### Preconditions

- The actor is authenticated with a verified `ORGANIZER` role.
- The current Organizer owns the Event.
- Candidate requests belong to Approved Partner applications for that Event.

### Main flow

1. The Organizer lists requests for an owned Event and may filter by Booth or status.
2. The Organizer opens a candidate detail.
3. The Organizer selects a `PENDING` candidate.
4. Inside one transaction, the backend locks the physical Booth and Event Booth configuration in a fixed order, then re-checks eligibility, deadline, quota and overlapping availability.
5. The request becomes `SELECTED`.
6. The system creates an `ACTIVE` BoothHold with the Event price copied to `lockedRentalPrice`.
7. Using the same backend Clock instant as `selectedAt`, the system persists `expiresAt = selectedAt + boothPaymentWindowMinutes`.
8. Competing candidates stay `PENDING`.
9. After the transaction commits, the system triggers a selection email to the Partner representative.

### Alternative and exception flows

- A1. Request is no longer Pending: reject invalid transition.
- A2. Booth has become unavailable: reject selection and leave the request Pending.
- A3. Deadline, Partner approval or quota is no longer valid: reject selection.
- A4. Concurrent Organizers select candidates for the same Booth: at most one transaction creates an Active Hold.
- A5. Organizer rejects a Pending request with a review note: mark only that request `REJECTED`.
- A6. Payment window expires: expire the Hold and move its source request to `PAYMENT_EXPIRED`; other candidates remain Pending.
- A7. Selection email fails: log the failure without rolling back the selected request or Hold.

### Postconditions

- Successful selection creates exactly one Active Hold for the Event Booth configuration.
- The Hold price does not change when the Event Booth configuration price changes later.
- The selection email is triggered only after the transaction commits.
- No BoothAssignment is created in Sprint 2.

### Related rules

- BR-03
- BR-19
- BR-20
- BR-21
- BR-25
- BR-57
- BR-60
- BR-68

### Acceptance Criteria

**AC-O04-01 Organizer sees candidates**

```gherkin
Given multiple Partners have Pending requests for an owned Event Booth
When the responsible Organizer lists requests for that Booth
Then all matching candidates are returned with Partner and request information
And no other Organizer can access the list
```

**AC-O04-02 Select and lock price atomically**

```gherkin
Given a valid Pending request and an AVAILABLE Event Booth
When the responsible Organizer selects the request
Then the request becomes SELECTED
And exactly one ACTIVE BoothHold is created
And lockedRentalPrice equals the current configured rentalPrice
And expiresAt equals selectedAt plus the Event boothPaymentWindowMinutes
```

**AC-O04-03 Competing requests remain Pending**

```gherkin
Given several Pending requests target A05
When one candidate is selected
Then only the winner becomes SELECTED
And every competing candidate remains PENDING
```

**AC-O04-04 Concurrent selection is safe**

```gherkin
Given two valid Pending candidates target the same physical Booth in overlapping Events
When two selection commands execute concurrently
Then at most one conflicting ACTIVE Hold is committed
And the losing command returns HTTP 409
```

**AC-O04-05 Reject a Pending request**

```gherkin
Given a request is Pending and belongs to an owned Event
When the Organizer rejects it with a valid review note
Then the request becomes REJECTED
And no Hold is created
```

**AC-O04-06 Expire a Hold**

```gherkin
Given a selected request has an Active Hold whose expiresAt has passed
When expiry processing runs or an availability-sensitive command checks the Booth
Then the Hold becomes EXPIRED
And its source request becomes PAYMENT_EXPIRED
And releasedAt records when the backend processes the expiry
And competing requests remain PENDING
And the operation is safe to repeat
```

**AC-O04-07 Configuration price changes do not change a Hold**

```gherkin
Given an Active Hold locked the price at 2000000
When the Organizer changes the Event Booth price to 2500000
Then the existing Hold still reports 2000000
And only future selections use 2500000
```

**AC-O04-08 Selection email runs after commit**

```gherkin
Given the responsible Organizer selects a valid Pending request
When the selection transaction commits successfully
Then the mail service is invoked with the Event, Booth, locked price and expiresAt
When the selection transaction rolls back
Then the mail service is not invoked
When email sending fails after commit
Then the failure is logged
And the SELECTED request and ACTIVE Hold remain committed
```

**AC-O04-09 Event window changes do not alter an existing Hold**

```gherkin
Given an Active Hold was created with expiresAt based on a 1440-minute Event window
When the Event payment-window setting is later changed through a permitted operation
Then the existing Hold keeps its persisted expiresAt
And only a later selection uses the new payment-window value
```

The Event stores `boothPaymentWindowMinutes` in the existing `events.booth_payment_window_minutes` column. The valid inclusive range is `60..10080`, and a newly created Event defaults to `1440` minutes. Demo Events may use a shorter valid value; automated expiry tests should advance a controllable Clock. Sprint 2 does not define payment-session duration.
