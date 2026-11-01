# Sprint 08 Use Case Specifications

> Baseline status: `APPROVED - ACTIVE`.
>
> This document refines the approved decisions in `docs/sprints/sprint-08.md` into observable
> General Feedback behavior and 28 Acceptance Criteria. Endpoint paths, DTO fields, exact error
> codes, pagination bounds and throttle values remain governed by the Sprint 08 API Contract.

## 1. Source and traceability

This specification refines, but does not replace:

- `docs/requirements/05_Business_Rules.md`, especially BR-65;
- `docs/requirements/06_Use_Case_List.md`, especially `UC-G04`;
- `docs/requirements/08_MVP_Scope_v2.md`;
- `docs/sprints/sprint-08.md`;
- `docs/design/12_Physical_ERD_Report.md`;
- `docs/design/SPRINT_08_GENERAL_FEEDBACK_PHYSICAL_ERD_OVERLAY.md`;
- `docs/development/SPRINT_08_CURRENT_STATE_AUDIT.md`.

Sprint 08 implements:

- the `BOOK_STREET` and `EVENT` branches of `UC-G04 Submit General Feedback`;
- a bounded Organizer handling path supporting the same General Feedback workflow.

The Organizer path does not introduce a new top-level Use Case. It provides Management Board
handling for submissions created through `UC-G04`.

BR-65 defines only `BOOK_STREET` and `EVENT` as valid General Feedback targets. Heritage content is
independent from Feedback. The UI and API must reject `HERITAGE` rather than expose it as a future
option.

## 2. Shared rules

### 2.1 Identity, authorization and privacy

- Guest submission does not require login.
- Browser submission remains CSRF-protected even though the reviewed submission route is public.
- When a valid authenticated Session exists, `submittedByUserId` comes only from the Security
  context. The command never accepts a caller-selected User identity.
- An anonymous submission stores no fabricated submitter User.
- Optional Guest name and optional contact email are independent of Session identity.
- Organizer list, detail and transition operations require an authenticated Session with effective
  `ORGANIZER` authority issued under the project's verified-email rule.
- Every authorized Organizer uses one shared Feedback queue across the whole Book Street and every
  Event. The query must not filter by `events.organizerUserId`.
- Shared Feedback access does not change ownership checks on Event creation, update, publication,
  cancellation or any previously completed Organizer operation.
- Public responses never expose contact email, internal note, handling Organizer, Session data or
  management timestamps.
- Organizer responses may expose the optional Guest name/contact email and handling metadata only
  after authorization.
- Application and access logs must not contain contact email, Session identifiers, raw CSRF values,
  internal notes or raw client IP values used by throttling.
- General Feedback is not available through a public list or public detail operation.

### 2.2 Target eligibility

Exactly one Sprint 08 target applies:

```text
BOOK_STREET -> eventId is absent
EVENT       -> eventId identifies one public-detail-eligible Event
```

For Sprint 08, an Event is eligible when the existing public Event detail operation may resolve it:

```text
PUBLISHED | ONGOING | COMPLETED | CANCELLED
```

This retains old public links for completed or ever-published cancelled Events. `DRAFT`, missing or
otherwise private Events are not valid Feedback targets. Their rejection must not reveal whether a
private Event exists.

The Landing Page selector enumerates only Events discoverable through the existing public Event
list behavior, currently `PUBLISHED` and `ONGOING`. A public page or deep link that already knows
an Event id may preselect an otherwise public-detail-eligible `COMPLETED` or `CANCELLED` Event after
the existing public detail operation resolves it. Sprint 08 does not widen Event discovery or add
a duplicate Feedback-target endpoint. Submission-time validation is authoritative and always uses
the public-detail eligibility rule above.

The following are not Sprint 08 General Feedback targets:

- `HERITAGE` because it is not a General Feedback target.
- Location, Booth, Facility or Activity;
- a caller-defined arbitrary target name or target identifier.

### 2.3 Content and normalization

General Feedback contains no rating or satisfaction score. Activity Rating remains the separate
completed `UC-P04` feature.

The Sprint 08 limits are:

| Input | Required | Normalization and bounds |
| --- | --- | --- |
| Guest name | No | Trim, collapse repeated whitespace, `1..100` characters after normalization. |
| Contact email | No | Trim, lowercase, valid email syntax, `3..255` characters. |
| Message | Yes | Trim surrounding whitespace, preserve intentional internal line breaks, `10..2000` characters. |
| Internal note | On resolve | Trim, normalize surrounding/repeated whitespace, `1..1000` characters. |

An absent or whitespace-only optional value is stored as `NULL`, not as an empty string. Validation
occurs before a durable Feedback row is created or modified.

Unknown or unsupported fields are rejected instead of silently ignored. This includes `rating`,
`score`, `phone`, `subject`, `userId`, `submittedByUserId`, `status`, handling metadata and all
unsupported target references.

### 2.4 Workflow state

The only statuses are:

```text
NEW -> IN_PROGRESS -> RESOLVED
          ^              |
          +--------------+
               reopen
```

Rules:

- every successful submission starts as `NEW`;
- viewing or listing never changes workflow state;
- `NEW -> IN_PROGRESS` is the only start-handling transition;
- `IN_PROGRESS -> RESOLVED` is the only resolve transition and requires an internal note;
- `RESOLVED -> IN_PROGRESS` is the only reopen transition;
- direct `NEW -> RESOLVED`, repeated same-state transitions and all other transitions fail;
- the authenticated Organizer is recorded as the latest handler for every successful transition;
- server time owns all submitted, updated, handling-start and resolved timestamps;
- reopening starts a new current handling cycle, clears `resolvedAt` and retains the existing
  internal note;
- resolving after a reopen may replace the retained note with the newly submitted resolution note;
- Sprint 08 stores only the latest handling actor/current-cycle timestamps and has no transition
  history table;
- no operation hard-deletes General Feedback.

### 2.5 Transaction and concurrency

- PostgreSQL is the durable source of truth. Redis stores temporary Session state only. Sprint 08
  throttle counters are bounded process-local volatile state and are not durable business data.
- One accepted submission creates exactly one durable Feedback row in one transaction.
- A persistence failure returns failure and does not produce a partial row or success UI.
- A transition locks or otherwise serializes the target row, rechecks its current status and then
  updates status, actor, note and timestamps atomically.
- Concurrent transitions from the same original state converge on one committed legal state. A
  stale contender receives the contract-defined conflict and must not overwrite the winner.
- Repeating an already-achieved transition is not treated as a new success because it would
  fabricate a new actor or timestamp.
- Database constraints are the final guard for target, status, workflow metadata and timestamp
  consistency.

### 2.6 Public abuse boundary

- The submission route uses the existing CSRF cookie/header flow; Sprint 08 adds no CSRF exemption.
- A bounded anonymous/public submission throttle returns a stable `429` outcome before persistence.
- The API Contract must define the exact threshold, time window, client key, trusted-proxy rule and
  retry metadata before implementation.
- Throttle state is temporary, process-local and bounded. It resets on backend restart and is not a
  distributed production-grade limit. Sprint 08 does not add raw client IP, fingerprint or CAPTCHA
  fields to PostgreSQL, Redis, limiter keys or logs.
- The throttle is an abuse-control boundary, not proof of identity and not a substitute for
  validation or CSRF protection.

### 2.7 Ordering, filtering and empty results

- Organizer list results use server-side pagination.
- Default ordering is newest `submittedAt`, then descending `generalFeedbackId` as the stable
  tie-breaker.
- Approved filters are target type, Event and status. Event filtering applies only to `EVENT`
  Feedback.
- Search is server-side and bounded to fields explicitly frozen by the API Contract.
- Page content and total counts use the same authorization, search and filter predicate.
- No matching rows return a successful empty page, never placeholder Feedback.
- Invalid page, size, sort or filter values return stable validation errors and never silently
  fall back to a different query.

### 2.8 One-way communication boundary

- Successful submission returns a receipt acknowledgement only.
- Organizer handling is internal; `internalNote` is never presented as a reply to the Guest.
- Resolve and reopen do not send email, SMS, push, Notification or a public response.
- Sprint 08 does not provide Guest tracking, status lookup or processing-result delivery.

## 3. UC-G04 Submit General Feedback — Sprint 08 slice

### Goal

Let a Guest submit a durable message about the Book Street or one public Event without logging in,
while protecting private data and rejecting unsupported Feedback shapes.

### Primary actor

Guest/Public Visitor. An authenticated User may use the same public flow.

### Preconditions

- The client has obtained the current public CSRF cookie/token pair for a state-changing request.
- For an `EVENT` submission, the selected Event is eligible under section 2.2 at submission time.
- The public throttle allows the request.

### Main flow A — Book Street Feedback

1. Guest opens the General Feedback section on the Landing Page.
2. Guest chooses “Toàn Đường Sách”.
3. Guest may provide a name and contact email and must provide a message.
4. Client submits the CSRF-protected command once and disables repeat submission while pending.
5. System validates target shape, content, optional authenticated identity and throttle state.
6. System creates one `NEW` General Feedback row with no Event reference or handling metadata.
7. System returns a privacy-safe receipt acknowledgement.
8. Client renders genuine success only after the durable response succeeds.

### Main flow B — Event Feedback

1. Guest chooses one Event available through the public experience or follows its public context.
2. Guest may provide a name and contact email and must provide a message.
3. Client submits one `EVENT` target with exactly that Event identity.
4. System rechecks public-detail eligibility at command time.
5. System creates one `NEW` General Feedback row referencing the Event.
6. System returns the same privacy-safe receipt shape used for Book Street Feedback.

### Alternate and exception flows

- Missing, invalid or stale CSRF proof: reject before persistence and let the UI offer a deliberate
  refresh/retry path.
- Throttle exceeded: reject with the stable `429` outcome and retry guidance defined by contract.
- Blank, undersized, oversized or malformed content: return field validation and create no row.
- Unsupported/unknown fields or targets: reject the command rather than dropping those values.
- `BOOK_STREET` with an Event reference: reject the inconsistent target.
- `EVENT` without an Event reference: reject the incomplete target.
- Missing, Draft or private Event: return the same public-safe not-found outcome.
- Event becomes ineligible before the transaction validates it: reject and create no row.
- Persistence or network failure: do not show success; preserve safe user-entered text for retry
  where possible without storing contact data in logs.

### Postconditions

On success:

- exactly one General Feedback row exists;
- target/reference consistency is valid;
- status is `NEW`;
- `submittedAt` and `updatedAt` are server-owned and initially equal;
- handling actor, handling start, resolution time and internal note are absent;
- optional Session submitter association and optional contact fields follow the approved rules;
- no outbound Guest message is scheduled.

On failure, no General Feedback row is created.

### Acceptance Criteria

**AC-G04-S8-01 Anonymous Book Street Feedback is durably acknowledged**

```gherkin
Given a Guest has no authenticated Session
And the Guest has valid CSRF proof and is within the throttle limit
And the Guest supplies a valid BOOK_STREET target and message
When the submission succeeds
Then exactly one durable General Feedback row is created
And its targetType is BOOK_STREET
And its eventId and submittedByUserId are null
And the Guest receives a privacy-safe receipt acknowledgement
```

**AC-G04-S8-02 Event Feedback requires a public-detail-eligible Event**

```gherkin
Given an Event status is one of PUBLISHED ONGOING COMPLETED or CANCELLED
And its public detail is resolvable under the existing Event rules
When a Guest submits valid EVENT Feedback for that Event
Then exactly one General Feedback row references that Event
But a Draft or otherwise private Event cannot be used as the target
```

**AC-G04-S8-03 Exactly one target shape is accepted**

```gherkin
Given a General Feedback command
When targetType is BOOK_STREET with an eventId
Or targetType is EVENT without an eventId
Or targetType is unknown
Then the command fails with stable target validation
And no General Feedback row is created
```

**AC-G04-S8-04 Private and missing Events are not disclosed**

```gherkin
Given one requested Event does not exist
And another requested Event exists only as DRAFT or private data
When an unauthenticated Guest attempts EVENT Feedback for either identifier
Then both requests receive the same public-safe not-found outcome
And neither response reveals private Event facts
And neither request creates Feedback
```

**AC-G04-S8-05 Feedback content is normalized and bounded**

```gherkin
Given Guest name and contact email are optional
When valid values are supplied
Then name whitespace is normalized and email is trimmed and lowercased
And whitespace-only optional values become null
And the required message preserves intentional internal line breaks within 10 to 2000 characters
But invalid email or blank or out-of-range required content fails field validation
And failed validation creates no row
```

**AC-G04-S8-06 Unsupported product fields are rejected**

```gherkin
Given a caller supplies rating phone subject Heritage Booth Location Facility Activity
Or caller-selected User status handling or timestamp data
When the command is validated
Then the request is rejected rather than silently ignoring or persisting those fields
And ActivityRating and every existing domain record remain unchanged
```

**AC-G04-S8-07 Submitter identity comes only from Security context**

```gherkin
Given one valid authenticated Session submits General Feedback
When the row is created
Then submittedByUserId is the current Security principal
And the caller cannot select a different User
But the same valid command without a Session remains accepted anonymously
```

**AC-G04-S8-08 New Feedback has server-owned initial workflow state**

```gherkin
Given a valid Feedback command
When persistence commits
Then status is NEW
And submittedAt equals the initial updatedAt using server time
And lastHandledByUserId handlingStartedAt resolvedAt and internalNote are null
```

**AC-G04-S8-09 Public acknowledgement and logs preserve privacy**

```gherkin
Given valid Feedback includes an optional contact email
When the public response and application logs are inspected
Then they do not expose contact email internal note Organizer identity Session id or raw CSRF data
And no public list or detail operation can retrieve the Feedback
```

**AC-G04-S8-10 CSRF and throttle controls apply before persistence**

```gherkin
Given a public Feedback submission
When CSRF proof is missing or invalid
Then the request is rejected and creates no row
And when the approved throttle is exceeded
Then the stable 429 contract is returned and creates no row
And no raw client IP is persisted in PostgreSQL
```

**AC-G04-S8-11 Failure cannot produce partial success**

```gherkin
Given a valid Feedback command reaches persistence
When the database transaction fails
Then no partial General Feedback row is committed
And the API does not return a success acknowledgement
And the Landing Page does not render a success state
```

**AC-G04-S8-12 Landing Page uses the real Feedback API**

```gherkin
Given the General Feedback section is shown in a production build
When a Guest submits or encounters validation throttle network or server failure
Then the UI renders the corresponding real API state
And repeat submission is disabled while one request is pending
And no mock success fallback or star-rating control is used
```

## 4. Organizer handling extension for UC-G04

### Goal

Let the Management Board share one authorized queue, inspect private Feedback details and move each
record through the approved handling lifecycle without creating a Guest reply channel.

### Primary actor

Authenticated Organizer with effective verified `ORGANIZER` authority.

### Preconditions

- The Organizer has a valid server-side Session with the required authority.
- The target Feedback exists for detail or transition operations.
- A transition additionally requires the Feedback to be in its exact source state.

### Main flow A — List and inspect the shared queue

1. Organizer opens “Phản hồi/Góp ý” in the Organizer portal.
2. Client requests the first server-side page using the default stable ordering.
3. System authorizes the Organizer without applying Event ownership.
4. System returns real Feedback rows and total count under one identical predicate.
5. Organizer may independently search by Feedback content, sender/email or Event name and may
   filter by target, exact Event and status.
6. Organizer opens one Feedback detail.
7. System returns message, optional contact values and current handling metadata.
8. The read leaves status, actor, note and timestamps unchanged.

### Main flow B — Start handling

1. Organizer opens one `NEW` Feedback item.
2. Organizer explicitly chooses “Xử lý góp ý”.
3. System locks/rechecks the row.
4. System changes it to `IN_PROGRESS`, records the current Organizer and starts the current
   handling cycle using server time.
5. System returns the committed state.

### Main flow C — Resolve

1. Organizer opens one `IN_PROGRESS` Feedback item.
2. Organizer provides an internal processing note and chooses “Đánh dấu đã giải quyết”.
3. System normalizes and validates the note, then locks/rechecks the row.
4. System changes it to `RESOLVED` and atomically records the current Organizer, note, resolution
   time and update time.
5. UI clearly states that the note is internal and no result was sent to the Guest.

### Main flow D — Reopen

1. Organizer opens one `RESOLVED` Feedback item.
2. Organizer explicitly chooses reopen.
3. System locks/rechecks the row.
4. System returns it to `IN_PROGRESS`, records the current Organizer, starts a new current handling
   cycle, clears the active resolution time and retains the submitted message/internal note.

### Alternate and exception flows

- No Session: return the standard authentication outcome.
- Session without effective Organizer authority: deny without returning Feedback data.
- Feedback not found: return the contract-defined not-found outcome.
- Invalid page/filter/sort/search: return validation; do not substitute a different query.
- Empty result: return a successful empty page with total zero.
- Resolve with blank/oversized note: return field validation without mutation.
- Unsupported direct/repeated transition: return conflict without changing actor or timestamps.
- Concurrent stale transition: only the first legal transition commits; the loser receives conflict
  and refreshes the current state.
- Network failure after an uncertain client result: UI reloads the durable detail instead of
  fabricating success.

### Postconditions

- Reads do not mutate General Feedback.
- Each successful transition leaves one database-valid workflow state.
- Latest handler and current-cycle timestamps reflect the committed transition.
- No transition deletes Feedback or creates Guest delivery work.
- No existing Event authorization rule is widened.

### Acceptance Criteria

**AC-O-S8-01 Every Organizer shares the same authorized queue**

```gherkin
Given two verified Organizers own different Events
And Feedback exists for BOOK_STREET and for Events owned by each Organizer
When either Organizer lists General Feedback with the same query
Then both receive the same authorized content and total count
And Event organizerUserId is not used to filter the Feedback queue
```

**AC-O-S8-02 Non-Organizers cannot read or transition Feedback**

```gherkin
Given an unauthenticated request and authenticated Users without ORGANIZER authority
When they call Organizer Feedback list detail or transition operations
Then the standard authentication or forbidden outcome is returned
And no private Feedback data is exposed
And no Feedback state changes
```

**AC-O-S8-03 List content and counts use one stable predicate**

```gherkin
Given an Organizer supplies valid search target Event status pagination and sort parameters
When the queue is queried
Then content and total counts use the same authorization and filters
And rows use deterministic server-side ordering
And an empty match returns an empty page rather than placeholder rows
```

**AC-O-S8-04 Organizer detail includes authorized private context**

```gherkin
Given an authorized Organizer requests an existing Feedback detail
When the response succeeds
Then it includes the submitted message target current workflow metadata
And it may include optional Guest name contact email and Session-associated submitter context
But the same detail is unavailable from every public endpoint
```

**AC-O-S8-05 Viewing Feedback is read-only**

```gherkin
Given an existing Feedback item in any status
When an authorized Organizer lists or opens it
Then status handler internalNote submittedAt updatedAt handlingStartedAt and resolvedAt are unchanged
```

**AC-O-S8-06 Starting handling is atomic**

```gherkin
Given Feedback is NEW
When an authorized Organizer starts handling it
Then status becomes IN_PROGRESS
And lastHandledByUserId is the current Session Organizer
And handlingStartedAt and updatedAt use the same server transition time
And resolvedAt remains null
```

**AC-O-S8-07 Resolve requires and records an internal note**

```gherkin
Given Feedback is IN_PROGRESS
When an authorized Organizer resolves it with a valid normalized internal note
Then status becomes RESOLVED
And the note current Organizer resolvedAt and updatedAt commit atomically
But a blank or out-of-range note fails without changing the row
```

**AC-O-S8-08 Reopen preserves content and clears active resolution**

```gherkin
Given Feedback is RESOLVED with an internal note
When an authorized Organizer reopens it
Then status becomes IN_PROGRESS
And lastHandledByUserId is the reopening Organizer
And handlingStartedAt begins a new current cycle
And resolvedAt is cleared
And the submitted message and internal note are preserved
```

**AC-O-S8-09 Stale and unsupported transitions cannot overwrite state**

```gherkin
Given two Organizers race from the same original Feedback state
When one legal transition commits first
Then the stale transition returns the contract-defined conflict
And it does not overwrite the committed status actor note or timestamps
And direct NEW to RESOLVED and repeated same-state transitions also fail
```

**AC-O-S8-10 Handling has no delete or outbound-delivery side effect**

```gherkin
Given an Organizer starts resolves or reopens Feedback
When the transaction commits
Then the General Feedback row remains durable
And no email SMS push Notification or public reply is sent or scheduled
And no Organizer Feedback hard-delete operation exists
```

**AC-O-S8-11 Organizer UI renders genuine backend states**

```gherkin
Given the Organizer Feedback route is available to an authorized Organizer
When queue detail or transition requests load succeed conflict fail or return empty data
Then the UI renders the corresponding real API state
And it refreshes durable state after a conflict or uncertain result
And it contains no mock rows client-only pagination or false sent-to-Guest wording
```

**AC-O-S8-12 Feedback access does not widen Event authorization**

```gherkin
Given an Organizer can inspect Feedback for an Event owned by another Organizer
When that Organizer attempts an existing owner-scoped Event or Organizer operation
Then the pre-Sprint-08 ownership rule still applies
And shared Feedback access grants no Event mutation or monitoring permission
```

## 5. Schema and regression acceptance

The following criteria support both actor-facing paths and are not separate top-level Use Cases.

**AC-X-S8-01 Migration supports clean install and V13 upgrade**

```gherkin
Given one empty database and one database at the immutable V13 baseline
When the approved next Flyway migration is applied
Then both schemas reach the same General Feedback shape
And Hibernate ddl-auto validate succeeds
And no applied V1 through V13 migration is modified
```

**AC-X-S8-02 Database constraints preserve Feedback invariants**

```gherkin
Given service validation is bypassed in a persistence test
When invalid target status workflow metadata foreign key or timestamp combinations are inserted
Then PostgreSQL rejects those rows
And valid BOOK_STREET EVENT and lifecycle states remain persistable
```

**AC-X-S8-03 Completed behavior remains backward compatible**

```gherkin
Given the Sprint 08 feature is installed
When existing Activity Rating Event ownership Session CSRF and Sprint 7 reward scenarios run
Then their approved behavior remains unchanged
And General Feedback does not reuse ActivityRating or broaden Event authorization
```

**AC-X-S8-04 Focused automated and browser evidence covers the slice**

```gherkin
Given Sprint 08 implementation is ready for review
When focused backend frontend and browser checks run
Then they cover public success validation privacy CSRF throttle and failure
And Organizer shared access filtering detail transitions and concurrency conflict
And mobile Guest form behavior
And no full historical Playwright suite is required for this slice
```

## 6. API Contract conformance checklist

The Sprint 08 API Contract must map, without weakening, all of these outcomes:

- public CSRF bootstrap/reuse and missing/invalid CSRF failure;
- anonymous and optional authenticated submission identity;
- exact `BOOK_STREET`/`EVENT` target shapes;
- public-detail-eligible Event statuses and private/missing Event non-disclosure;
- exact text limits, normalization and unknown-field rejection;
- privacy-safe receipt acknowledgement;
- exact throttle threshold, window, key, proxy policy and `429` retry behavior;
- Organizer authentication/authority and shared-queue authorization;
- list fields, search scope, filters, pagination bounds and stable sorting;
- private Organizer detail fields;
- legal start, resolve and reopen commands;
- note validation and workflow-state conflict;
- concurrent stale-transition behavior;
- stable error envelope and field-error representation;
- absence of delete, public detail, Guest reply and delivery endpoints.

The API Contract must not introduce Heritage persistence, Activity Rating changes, CAPTCHA, broad
Notification behavior, reporting, Admin Feedback UI or Event authorization changes.

## 7. Required UI behavior

### 7.1 Guest/Public

- Keep the Feedback QR as navigation to the Landing Page section only.
- Offer “Toàn Đường Sách” and eligible public Event targets.
- Remove Heritage and star/rating controls from the Sprint 08 form.
- Show optional name/email and required message labels with approved limits.
- Explain that Feedback is a one-way contribution and no direct response is promised.
- Preserve safe form input after recoverable failure and prevent duplicate clicks while pending.
- Render validation, CSRF-refresh, throttle, network and server failures distinctly enough for
  deliberate retry.

### 7.2 Organizer

- Route and navigation are visible only to effective Organizer sessions, while backend authority
  remains the final guard.
- Queue rows show target, status, submitted time and a privacy-safe message summary.
- Detail shows full message, optional contact values and current handling metadata.
- Actions shown depend on current status: start, resolve or reopen.
- Resolve labels the note as internal and never says a response was sent.
- Conflict reloads the current durable record so one Organizer can see another's committed action.
- Loading, empty, forbidden, conflict and retryable failures use real API state.

## 8. Acceptance Criteria audit

- `UC-G04` Guest/Public Sprint 08 slice: 12 Acceptance Criteria.
- Organizer handling extension: 12 Acceptance Criteria.
- Schema and regression support: 4 Acceptance Criteria.

Total: **28 Sprint 08 Acceptance Criteria**.

Review gate before API or code implementation:

- verify all 28 IDs are unique and match `docs/sprints/sprint-08.md`;
- confirm every alternate/exception flow maps to an Acceptance Criterion or shared invariant;
- confirm the API Contract freezes every deferred route, DTO, error, pagination and throttle value;
- confirm the Physical ERD overlay supports each stored state and timestamp rule;
- confirm the shared Organizer queue does not alter Event ownership;
- confirm General Feedback remains one-way and separate from Activity Rating.
