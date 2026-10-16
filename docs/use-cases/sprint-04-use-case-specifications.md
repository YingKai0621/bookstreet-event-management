# Sprint 04 Use Case Specifications

> Implementation status: `COMPLETED` on 2026-10-16. All AC-O01-01 through AC-O01-16 and AC-E02-01
> through AC-E02-07 have implementation and automated coverage; see the
> [Sprint 4 Completion Report](../development/SPRINT_04_COMPLETION_REPORT.md).

## Shared rules

- Authentication uses the existing Spring Security server-side Session.
- Ownership is derived from the authenticated principal, never from request data.
- PostgreSQL is the durable source of truth; Redis stores Session data only.
- Backend time is authoritative.
- V1 through V8 are the immutable current schema baseline.
- Browser or frontend state never overrides Payment/Assignment evidence.
- Event-scoped mutation locks the Event first and rechecks status/backend time. Booth/payment work
  then follows `Event → Booth (if applicable) → EventBoothConfig (if applicable) → Hold → Payment
  by ascending id → BoothRequest`, skipping unused levels without reversing them.
- Publication and operational update require
  `boothRequestDeadlineAt + boothPaymentWindowMinutes <= startAt`.

## UC-O01 Manage Events — Sprint 4 slice

### Goal

Let the responsible Organizer correct and close an Event without rewriting history or creating an
unfunded refund obligation.

### Primary actor

Verified Organizer who owns the Event.

### Preconditions

- The actor has an authenticated Session with effective `ORGANIZER` authority.
- The Event belongs to the actor.

### Main flows

#### A. Delete a Draft

1. Organizer requests deletion.
2. System locks and rechecks the Event.
3. System verifies status `DRAFT` and absence of unexpected business history.
4. System deletes Event Booth configuration and the Event in one transaction.
5. System returns `204 No Content`.

#### B. Update a published Event

1. Organizer submits a presence-aware PATCH.
2. System locks and rechecks the Event.
3. Descriptive fields are allowed for `PUBLISHED` or `ONGOING`.
4. If operational fields are present, system requires `PUBLISHED` and no external participation
   represented by the active schema: no Partner application and no Booth
   request/Hold/Payment/Assignment.
5. System rejects reopening an elapsed deadline and validates the merged Event, including the Booth
   deadline/payment-window invariant.
6. The Event lock serializes this check with the first external-participation command.
7. System commits the full patch atomically and returns the updated Event.

#### C. Cancel a published Event

1. Organizer submits a normalized cancellation reason.
2. System locks the Event. A first transition requires `PUBLISHED`; an already `CANCELLED` Event
   owned by the same Organizer returns its current state without mutation.
3. System checks Payment and Assignment blockers.
4. System releases eligible Active Holds and cancels open Booth requests.
5. System records Event cancellation data and commits atomically.
6. After commit, system deduplicates verified representative-User emails and attempts notification
   for Partner organizations whose application is `PENDING` or `APPROVED`.
7. System returns the cancelled Event even if email delivery fails.

#### D. Advance timed lifecycle

1. A scheduler finds due `PUBLISHED` or `ONGOING` Events.
2. System rechecks status and backend time under a lock.
3. Due Events advance monotonically and idempotently.
4. A late run may advance an Event directly to the correct current state.

### Alternate/error flows

- Non-owner/private Event: ownership-safe `404 EVENT_NOT_FOUND`.
- Delete of non-Draft: `409 EVENT_NOT_DRAFT`.
- Operational patch after external participation: `409 EVENT_OPERATIONAL_FIELDS_LOCKED`.
- Invalid merged dates/deadlines/quotas: existing validation error codes.
- Cancel of non-Published: `409 EVENT_NOT_CANCELLABLE`.
- Blank or invalid reason: `400 VALIDATION_ERROR`.
- Pending Payment: `409 EVENT_PAYMENT_PENDING`.
- Reconciliation-required evidence: `409 EVENT_PAYMENT_RECONCILIATION_REQUIRED`.
- Successful Payment: `409 EVENT_HAS_SUCCESSFUL_PAYMENT`.
- Any Assignment, including free Booth: `409 EVENT_HAS_ASSIGNMENT`.
- Concurrent state change: command rechecks under lock and returns the applicable conflict.
- Invalid Booth deadline/payment-window boundary: `422 EVENT_TIME_INVALID` with the offending
  timing field.
- Repeated cancellation of an owned `CANCELLED` Event: `200 OK` with its original cancellation
  metadata and no repeated cascade/email; other non-Published states return
  `409 EVENT_NOT_CANCELLABLE`.

### Postconditions

- No published business history is physically deleted.
- Cancelled Events reject new application, Booth request, selection and payment operations.
- Email is a post-commit side effect and cannot undo the state transition.

### Acceptance Criteria

**AC-O01-01 Draft deletion is ownership-safe**

```gherkin
Given an Organizer owns a Draft Event with Event Booth configuration
When the Organizer deletes the Event
Then the Event and its Event Booth configuration are removed atomically
And physical Booths and Locations remain
And another Organizer receives EVENT_NOT_FOUND
```

**AC-O01-02 Published history is never hard-deleted**

```gherkin
Given an Event is not Draft
When its Organizer calls delete
Then the system returns EVENT_NOT_DRAFT
And removes no record
```

**AC-O01-03 Descriptive published update is allowed**

```gherkin
Given an owned Event is Published or Ongoing
When the Organizer patches only name, description or bannerUrl
Then the merged Event is validated and updated
```

**AC-O01-04 Operational update freezes after participation**

```gherkin
Given an owned Published Event has an external participation record
When the Organizer patches a time, deadline, cutoff, quota or payment window
Then the system returns EVENT_OPERATIONAL_FIELDS_LOCKED
And applies none of the submitted fields
```

**AC-O01-05 An untouched published Event can be corrected**

```gherkin
Given an owned Published Event has no external participation record
When the Organizer submits a valid operational patch before the Event starts
Then the system updates the Event atomically
```

**AC-O01-06 Eligible Event cancellation is atomic**

```gherkin
Given an owned Published Event has no Payment or Assignment blocker
And it has open Booth requests and Active Holds
When the Organizer cancels it with a valid reason
Then the Event becomes CANCELLED with cancellation metadata
And open Booth requests become CANCELLED
And Active Holds become RELEASED
And all changes commit atomically
```

**AC-O01-07 Financial uncertainty blocks cancellation**

```gherkin
Given an owned Published Event has a Pending, Successful or reconciliation-blocking Payment
When the Organizer attempts cancellation
Then the system returns the matching conflict
And does not release a Hold or cancel the Event
```

**AC-O01-08 Every Assignment blocks cancellation**

```gherkin
Given an Event has a BoothAssignment including one from a zero-price Booth
When the Organizer attempts cancellation
Then the system returns EVENT_HAS_ASSIGNMENT
```

**AC-O01-09 Lifecycle advancement is monotonic**

```gherkin
Given backend time passes startAt and later endAt
When lifecycle processing runs one or more times
Then the Event advances to ONGOING and then COMPLETED
And never transitions backwards
And repeated processing is idempotent
```

**AC-O01-10 Cancellation notification is post-commit**

```gherkin
Given an eligible Event cancellation commits
When email delivery fails
Then the Event remains CANCELLED
And the failure is logged without exposing secrets
And each verified representative email from PENDING or APPROVED Partner applications is attempted
at most once
And one recipient failure does not prevent attempts to the remaining recipients
```

**AC-O01-11 Late contradictory success is retained**

```gherkin
Given an Event was cancelled after its Payment evidence was terminal and non-conflicting
When VNPay later reports a contradictory success
Then the system records reconciliation-required evidence
And does not reopen the Event or silently recreate a Hold or Assignment
And manual financial handling is required
```

**AC-O01-12 Operational update and first participation are serialized**

```gherkin
Given a Published Event has no external participation
When an operational patch races the first Partner application or Booth request submission
Then both commands lock the Event before their eligibility check
And either the patch commits first and the submission revalidates against the updated Event
Or participation commits first and the patch returns EVENT_OPERATIONAL_FIELDS_LOCKED
And no command decides from stale Event state
```

**AC-O01-13 Cancellation and new Event work are serialized**

```gherkin
Given an eligible Published Event
When cancellation races application submission, Booth-request submission, selection or payment work
Then all commands serialize on the Event lock
And either cancellation commits first and the later command rejects the Cancelled Event
Or the other command commits first and cancellation observes the resulting state or blocker
```

**AC-O01-14 Booth payment window ends before Event start**

```gherkin
Given an Organizer publishes or operationally patches an Event
When boothRequestDeadlineAt plus boothPaymentWindowMinutes is after startAt
Then the system returns EVENT_TIME_INVALID
And persists none of the command
And a boundary equal to startAt is valid
```

**AC-O01-15 Repeated cancellation is idempotent**

```gherkin
Given an owned Event is already CANCELLED
And the repeated request has a syntactically valid reason
When its Organizer repeats cancellation
Then the system returns the current Event with its original cancellation reason and timestamp
And changes no request or Hold
And sends no additional cancellation email
```

**AC-O01-16 Unresolved payment crosses Event start safely**

```gherkin
Scenario: Unresolved evidence does not pause Event lifecycle
  Given a Payment remains PENDING or reconciliation-required when its scheduled Hold expires
  When backend time reaches startAt
  Then the Event advances to ONGOING
  And the Hold remains ACTIVE
  And no new payment attempt or Booth reassignment is allowed

Scenario: Trusted success arrives while the Event is Ongoing
  Given the unresolved Payment and its Hold still belong to an ONGOING Event
  When trusted gateway evidence proves success
  Then normal atomic settlement may create the Assignment

Scenario: Trusted success arrives after the Event is terminal
  Given a Payment belongs to a COMPLETED or CANCELLED Event
  When trusted gateway evidence proves success before normal settlement created an Assignment
  Then the system retains reconciliation-required evidence for manual handling
  And creates no Assignment

Scenario: Trusted terminal failure resolves the uncertainty
  Given the unresolved Payment has kept its Hold ACTIVE after scheduled expiry
  When trusted gateway evidence proves terminal failure or timeout
  Then the Payment and Hold/request close through the normal expiry flow
  And the system does not auto-select another candidate after the Booth request deadline
```

## UC-E02 Manage Booth Request — Sprint 4 slice

### Goal

Let an owning Partner release a selected but unsettled Booth safely instead of waiting for Hold
expiry.

### Primary actor

Verified Partner representing the organization that owns the Booth request.

### Preconditions

- The Partner owns the request through the current PartnerOrganization.
- The request is `PENDING`, `SELECTED` or already `WITHDRAWN`.

### Main flow

1. Partner requests withdrawal.
2. System locks the Event first. For `PENDING` it then locks the BoothRequest; for `SELECTED` it
   locks Hold, Payment rows by ascending id and BoothRequest in that order.
3. A Pending request becomes `WITHDRAWN`.
4. An eligible Selected request becomes `WITHDRAWN` and its Active Hold becomes `RELEASED`.
5. System records the transition time and returns the updated request.
6. Organizer may later select another Pending candidate; selection is not automatic.

### Alternate/error flows

- Unknown/not-owned request: `404 BOOTH_REQUEST_NOT_FOUND`.
- Already Withdrawn: `200 OK` with current state and no new mutation.
- Selected without Active Hold: `409 BOOTH_HOLD_NOT_ACTIVE`.
- Usable Pending checkout: `409 PAYMENT_ATTEMPT_ALREADY_PENDING`.
- Unknown Pending result or reconciliation conflict: `409 PAYMENT_RESULT_UNKNOWN`.
- Successful Payment: `409 PAYMENT_ALREADY_COMPLETED`.
- Existing Assignment: `409 BOOTH_ALREADY_ASSIGNED`.
- Other terminal request state: `409 BOOTH_REQUEST_NOT_WITHDRAWABLE`.

### Acceptance Criteria

**AC-E02-01 Pending withdrawal remains supported**

```gherkin
Given an owned Booth request is PENDING
When the Partner withdraws it
Then it becomes WITHDRAWN with withdrawnAt
And no Hold is changed
```

**AC-E02-02 Selected request releases safely**

```gherkin
Given an owned Booth request is SELECTED with an Active Hold
And it has no Pending, Successful or reconciliation-blocking Payment
And it has no Assignment
When the Partner withdraws it
Then the request becomes WITHDRAWN
And the Hold becomes RELEASED
And the Booth becomes available subject to other overlaps
```

**AC-E02-03 Verified failed attempts do not force waiting**

```gherkin
Given every Payment attempt for the Active Hold is terminal FAILED or TIMEOUT
And none carries reconciliation-required evidence
When the Partner withdraws the selected request
Then withdrawal succeeds
```

**AC-E02-04 Unknown money blocks release**

```gherkin
Given the Hold has a Pending or reconciliation-blocking Payment
When the Partner withdraws the request
Then the system returns PAYMENT_ATTEMPT_ALREADY_PENDING for a usable checkout
Or PAYMENT_RESULT_UNKNOWN for unknown or reconciliation-blocking evidence
And retains the request and Hold
```

**AC-E02-05 Withdrawal is idempotent**

```gherkin
Given an owned request is already WITHDRAWN
When the Partner repeats withdrawal
Then the system returns the same Withdrawn request
And does not change timestamps or create records
```

**AC-E02-06 Withdrawal and settlement cannot both win**

```gherkin
Given selected withdrawal and trusted payment settlement run concurrently
When both transactions complete
Then either withdrawal releases the Hold before settlement is eligible
Or settlement consumes the Hold and withdrawal is rejected
And no successful charge exists without its valid Assignment or reconciliation evidence
```

**AC-E02-07 Late success after release is never silently settled**

```gherkin
Given a Selected request was safely withdrawn after all known attempts were terminal and non-conflicting
When VNPay later reports a contradictory success for an old attempt
Then the system retains reconciliation-required evidence
And does not recreate the released Hold or create an Assignment
And does not alter any later Hold or Assignment
And requires manual financial handling
```


