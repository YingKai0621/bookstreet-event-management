# Sprint 06 Use Case Specifications

**QR window amendment (2026-10-26):** Organizer may configure `attendanceEarlyScanMinutes` on an Activity (integer 0–1440, default 15). Every Attendance boundary below uses that stored value. Cases that say 15 minutes describe the default. Once an Activity has `VALID` Attendance, the value cannot change.

**Notification inbox amendment (2026-10-27):** Participant may mark one owned Notification or all
owned unread Notifications as read. Bulk mark-read is owner-only and idempotent; it preserves
existing `readAt` values and returns the number of rows changed by that call.

> Baseline status: `PROJECT OWNER APPROVED — ACTIVE IMPLEMENTATION BASELINE` on 2026-10-19. This
> document specifies the Sprint 6 Participant Activity slice approved in `sprint-06.md`. It defines
> observable business behavior and 65 Acceptance Criteria; endpoint paths, DTO shapes and final
> error codes are frozen in `docs/api/sprint-06-api-contract.md`.

## 1. Source and traceability

This specification refines, but does not replace:

- `docs/requirements/05_Business_Rules.md`, especially BR-09, BR-13, BR-38–BR-47, BR-51–BR-53,
  BR-66, BR-78, BR-86, BR-90 and BR-93–BR-101;
- `docs/requirements/06_Use_Case_List.md`;
- `docs/requirements/08_MVP_Scope_v2.md`;
- `docs/sprints/sprint-06.md`.

Sprint 6 refines these existing Use Cases:

- `UC-G01` Explore Book Street;
- `UC-P01` Manage Event Participation;
- `UC-P02` Manage Activity Registrations;
- `UC-P03` Track Participation;
- `UC-P04` Rate Activity;
- `UC-O01` Manage Events;
- `UC-O06` Manage Activities;
- `UC-O07` Monitor Participation.

No new Actor or top-level Use Case is introduced. Automatic lifecycle processing, No-show,
Certificate issuance and Notification persistence are system behavior supporting these Use Cases.

## 2. Shared rules

### 2.1 Identity, authorization and privacy

- Authentication uses Spring Security server-side Session. State-changing browser requests require
  CSRF protection.
- User and Organizer ownership come from the authenticated principal, never from a body, path or
  query identity supplied as a substitute for the Session.
- A Participant may read or mutate only their own EventRegistration, ActivityRegistration,
  Attendance, Certificate, ActivityRating and Notification read state.
- An Organizer may monitor or correct participation only for an Event where
  `event.organizerUserId` is the authenticated User.
- Ownership-safe lookup must not reveal whether another User's private record exists.
- Public and Participant responses never expose a raw `attendanceQrToken` or complete token-bearing
  scan URL. Only the owning Organizer may retrieve the shared Activity QR.
- Application and access logs must not contain a raw Attendance token.

### 2.2 Time and lifecycle

- Backend `Clock` is authoritative. UI time and client lifecycle labels are advisory only.
- Persisted instants use the project time policy; UI renders them in `Asia/Ho_Chi_Minh`.
- Equality at an inclusive deadline is accepted. A rule expressed as `now > deadline` rejects only
  after that instant.
- The Attendance self-scan window is exactly
  `[activity.startAt - attendanceEarlyScanMinutes minutes, activity.endAt)`.
- The opening boundary is inclusive and the closing boundary is exclusive.
- Activity completion, No-show classification, Certificate eligibility and their required
  Notification changes are one idempotent finalization command.

### 2.3 State vocabulary

EventRegistration statuses:

```text
ACTIVE
LEFT
```

ActivityRegistration statuses:

```text
ACTIVE
CANCELLED
NO_SHOW
```

ActivityRegistration cancellation sources:

```text
PARTICIPANT
ACTIVITY
EVENT
```

Attendance statuses:

```text
VALID
VOIDED
```

Certificate statuses:

```text
ISSUED
REVOKED
```

ActivityRating statuses:

```text
ACTIVE
INVALIDATED
```

`ATTENDED` is not an ActivityRegistration status. It is an outcome derived from a valid Attendance.

Seat-active means:

```text
activityRegistration.status = ACTIVE
AND activity.status IN (PUBLISHED, ONGOING)
```

Participant-facing outcome precedence is:

1. Activity/Event cancellation is the primary current outcome; prior valid Attendance is secondary
   history.
2. Otherwise valid Attendance means Attended.
3. Otherwise `NO_SHOW` means No-show.
4. Otherwise `CANCELLED/PARTICIPANT` means Participant-cancelled.
5. Otherwise the outcome follows the current Activity lifecycle.

### 2.4 Transaction, concurrency and idempotency

- PostgreSQL is durable truth. Redis stores Session only.
- Mutations follow BR-90 and BR-101 lock ordering. No flow may reverse that order.
- Unique constraints are the final duplicate guard for EventRegistration, ActivityRegistration,
  Attendance, Certificate, ActivityRating and Notification deduplication identity.
- Direct Join racing Activity auto-join converges on one EventRegistration.
- Concurrent requests for the final Activity seat cannot both succeed.
- Duplicate/concurrent valid scans converge on one Attendance.
- Exact command retry returns the achieved result without duplicating history, audit or
  Notification. A semantically incompatible later command returns a business conflict.
- Optional email and Certificate rendering occur after commit. Their failure cannot roll back or
  make the domain transition appear unsuccessful.

## 3. UC-G01 Explore Book Street — Sprint 6 Activity slice

### Goal

Let Guest and authenticated Users discover the canonical public Activity schedule without exposing
private participation or Attendance secrets.

### Primary actor

Guest. Participant has the same public discovery capability.

### Preconditions

- None for public list/detail.

### Main flow

1. Actor opens an eligible public Event or Activity discovery view.
2. System returns only public Activities under the canonical public contract.
3. Actor filters, searches, sorts or pages through public results.
4. Actor opens Activity detail and sees current schedule, Location, capacity/configuration and
   public descriptive information.
5. If authenticated as Participant, a separate ownership-safe projection may show the actor's
   registration state without changing the public Activity representation.

### Alternate and exception flows

- Draft, non-public or foreign private Activity is omitted or returned as public-safe not found.
- Invalid page/filter/sort input is rejected by the shared validation envelope.
- No public Activity matches: return a successful empty result, not a fabricated placeholder.
- Participant enrichment fails authorization: public data may still be returned, but private state
  is not disclosed.

### Postconditions

- No participation record is created by browsing.
- No Attendance token, registration identity, email, Certificate or Rating ownership is exposed.

### Acceptance Criteria

**AC-G01-01 Public Activity discovery uses one canonical data source**

```gherkin
Given public Activities exist for an eligible Event
When a Guest lists or opens an Activity
Then the response uses the canonical public Activity projection
And the frontend does not merge a second incompatible Activity source
```

**AC-G01-02 Non-public Activity is concealed**

```gherkin
Given an Activity is Draft or otherwise not public
When a Guest requests its detail or public list
Then the Activity is omitted or returned as public-safe not found
```

**AC-G01-03 Public payload does not leak participation secrets**

```gherkin
Given an Activity has registrations Attendance and a shared QR token
When any public Activity response is produced
Then it contains no raw Attendance token or complete scan URL
And it contains no private registration Attendance Certificate or Rating ownership
```

**AC-G01-04 Empty discovery is a valid result**

```gherkin
Given no Activity matches valid filters
When public discovery is requested
Then the response succeeds with an empty result and correct paging metadata
And no placeholder Activity is invented
```

## 4. UC-P01 Manage Event Participation — Sprint 6 slice

### Goal

Allow a Participant to Join, Leave and rejoin an Event while preserving one historical identity and
protecting active Activity seats.

### Primary actor

Authenticated Participant.

### Preconditions

- Actor has a valid authenticated Session with Participant capability.
- Target Event is public and eligible for the requested transition.

### Main flows

#### A. Direct Join

1. Participant opens an eligible Event.
2. Participant requests Join before or exactly at the participant-registration deadline.
3. System locks/rechecks Event and current EventRegistration.
4. System creates one `ACTIVE` EventRegistration or reactivates the existing `LEFT` row.
5. My Events shows the joined Event.

#### B. Activity auto-join

1. Participant registers an eligible Activity without an active EventRegistration.
2. The Activity command applies both Event and Activity eligibility rules.
3. System creates/reactivates the one EventRegistration in the same transaction.
4. System creates/reactivates the ActivityRegistration only if all checks pass.

#### C. Leave and rejoin

1. Participant requests Leave.
2. System locks/rechecks Event and the Participant's Activity registrations.
3. If none are seat-active, EventRegistration changes `ACTIVE -> LEFT` without deletion.
4. Historical ActivityRegistration, Attendance, Certificate and Rating remain linked.
5. Participant may later rejoin through the same row while direct Join remains eligible.

### Alternate and exception flows

- Event missing, non-public, ineligible or cancelled: Join is rejected without a row.
- Backend time after participant-registration deadline: Join/rejoin/auto-join is rejected.
- Join at exact deadline: accepted if all other rules pass.
- Leave with any seat-active ActivityRegistration: rejected; no partial state changes.
- Completed historical ActivityRegistration does not block Leave merely because its stored status is
  `ACTIVE` beside valid Attendance.
- Exact Join or Leave retry returns the current achieved state without a new row or timestamp drift.
- Cross-Participant access returns ownership-safe not found.

### Postconditions

- At most one EventRegistration exists for `(userId, eventId)`.
- Leaving never deletes participation history.

### Acceptance Criteria

**AC-P01-01 Direct Join creates one active identity**

```gherkin
Given an eligible public Event and no EventRegistration for the Participant
And backend time is before or exactly at the participant-registration deadline
When the Participant joins
Then one EventRegistration is stored as ACTIVE
And My Events includes the Event
```

**AC-P01-02 Join closes only after the Event deadline**

```gherkin
Given an otherwise eligible Event
When backend time is exactly the participant-registration deadline
Then Join may succeed
But when backend time is after that deadline
Then Join is rejected and no new registration is stored
```

**AC-P01-03 Activity registration auto-joins atomically**

```gherkin
Given the Participant has no active EventRegistration
And both Event and Activity registration rules are satisfied
When the Participant registers the Activity
Then one ACTIVE EventRegistration and one ACTIVE ActivityRegistration commit together
But if Activity registration fails
Then the command does not leave an unintended new EventRegistration
```

**AC-P01-04 Direct Join and auto-join race converge**

```gherkin
Given no EventRegistration exists
When direct Join races Activity registration auto-join
Then both commands resolve to one EventRegistration identity
And no unique-constraint failure is exposed as a generic server error
```

**AC-P01-05 Seat-active Activity blocks Leave**

```gherkin
Given the Participant has an ACTIVE registration for a Published or Ongoing Activity
When the Participant leaves the Event
Then Leave is rejected
And EventRegistration and ActivityRegistration remain unchanged
```

**AC-P01-06 Completed history does not block Leave forever**

```gherkin
Given every Activity registration in the Event belongs to a Completed or Cancelled Activity
When the Participant leaves the Event
Then EventRegistration becomes LEFT
And all historical Attendance Certificate Rating and registration records remain linked
```

**AC-P01-07 Rejoin reuses the row and obeys current eligibility**

```gherkin
Given the Participant previously left an Event
When the Participant rejoins while direct Join remains eligible
Then the existing EventRegistration returns to ACTIVE
And no second row is inserted
But when the current Event deadline or lifecycle is ineligible
Then rejoin is rejected and the row remains LEFT
```

## 5. UC-P02 Manage Activity Registrations

### Goal

Allow a Participant to acquire, return and reacquire one Activity seat safely under lifecycle,
deadline, capacity and ownership rules.

### Primary actor

Authenticated Participant.

### Preconditions

- Target Activity belongs to an eligible Event.
- Activity has `registrationRequired=true` for registration flows.

### Main flows

#### A. Register

1. Participant opens a public Activity and requests registration.
2. System locks Event and Activity, resolves/creates the EventRegistration, and rechecks current
   lifecycle and both deadlines.
3. System counts seat-active registrations under the Activity lock.
4. System creates one `ACTIVE` ActivityRegistration or reactivates the same eligible row.
5. System computes schedule overlap against the Participant's other seat-active registrations.
6. Command returns the registration plus a non-blocking warning when overlap exists.

#### B. Cancel

1. Participant requests cancellation before Activity start.
2. System rechecks ownership, registration status, Attendance and backend time under lock.
3. System changes registration to `CANCELLED`, source `PARTICIPANT`, records cancellation time and
   returns the seat.

#### C. Re-register

1. Participant requests registration for the previously cancelled Activity.
2. System requires cancellation source `PARTICIPANT` and reruns every current eligibility check.
3. If capacity remains, the same row returns to `ACTIVE` and records latest activation time.

### Alternate and exception flows

- `registrationRequired=false`: reject and create no ActivityRegistration/Attendance/Certificate.
- Activity not `PUBLISHED`, Event ineligible or either deadline passed: reject.
- Event deadline earlier than Activity deadline: Event deadline is the effective cutoff.
- Capacity full: reject; no waitlist or placeholder row.
- Schedule overlap: accept with warning; never auto-cancel another registration.
- Cancel with no owned registration or foreign registration: ownership-safe not found.
- Cancel at or after `startAt`, after valid Attendance, or from non-`ACTIVE` status: reject.
- Re-register after source `ACTIVITY` or `EVENT`: reject.
- Re-register after source `PARTICIPANT` when capacity/deadline/lifecycle changed: reject while
  retaining the cancelled history.
- Activity/Event cancellation racing register/cancel: lock-time authoritative state wins; no active
  registration may survive a committed cancellation.

### Postconditions

- At most one ActivityRegistration exists per `(eventRegistrationId, activityId)`.
- Capacity counts only seat-active registrations.
- No successful flow creates an Event entrance QR or Participant-specific Attendance QR.

### Acceptance Criteria

**AC-P02-01 Registration requires an eligible published Activity**

```gherkin
Given an Activity is not Published or registrationRequired is false
When a Participant registers
Then the request is rejected
And no ActivityRegistration or Attendance identity is created
```

**AC-P02-02 Both deadlines apply with inclusive equality**

```gherkin
Given Event and Activity registration deadlines exist
When backend time is before or exactly at both deadlines
Then registration may proceed
But when backend time is after either deadline
Then registration is rejected
And the later deadline never extends the earlier cutoff
```

**AC-P02-03 Capacity is protected under final-seat concurrency**

```gherkin
Given exactly one Activity seat remains
When two eligible Participants register concurrently
Then exactly one new seat-active registration commits
And the other request receives a capacity conflict
And no waitlist or placeholder row is created
```

**AC-P02-04 Existing active registration is idempotent**

```gherkin
Given the Participant already owns the ACTIVE ActivityRegistration
When the exact registration command is retried
Then the existing registration is returned
And capacity is not consumed twice
And no duplicate row is inserted
```

**AC-P02-05 Schedule overlap warns without blocking**

```gherkin
Given the Participant has another seat-active Activity with an overlapping interval
When a new eligible registration succeeds
Then the new registration is ACTIVE
And the response presents a schedule-overlap warning
And neither registration is automatically cancelled
```

**AC-P02-06 Participant can return a seat before start**

```gherkin
Given an owned ACTIVE ActivityRegistration has no valid Attendance
And backend time is before activity.startAt
When the Participant cancels
Then status becomes CANCELLED with source PARTICIPANT and cancellation time
And the seat no longer counts toward capacity
```

**AC-P02-07 Activity deadline does not block cancellation**

```gherkin
Given the Activity registration deadline has passed
But backend time is still before activity.startAt
And the owned registration is otherwise cancellable
When the Participant cancels
Then cancellation succeeds because the acquisition deadline does not prevent returning a seat
```

**AC-P02-08 Cancellation closes exactly at Activity start**

```gherkin
Given an owned ACTIVE registration without valid Attendance
When backend time is just before activity.startAt
Then cancellation may succeed
But when backend time equals or exceeds activity.startAt
Then cancellation is rejected
```

**AC-P02-09 Valid Attendance blocks Participant cancellation**

```gherkin
Given the registration already has VALID Attendance
When the Participant requests cancellation
Then cancellation is rejected
And Attendance and registration history remain unchanged
```

**AC-P02-10 Eligible re-registration reuses the same row**

```gherkin
Given a registration was cancelled by the Participant
And lifecycle deadlines and capacity are currently eligible
When the Participant registers again
Then the same ActivityRegistration returns to ACTIVE
And latest activation metadata is recorded
And no second row is inserted
```

**AC-P02-11 System cancellation cannot be self-reactivated**

```gherkin
Given a registration is CANCELLED with source ACTIVITY or EVENT
When the Participant attempts re-registration
Then the request is rejected
And cancellation source and history remain unchanged
```

**AC-P02-12 Re-registration reruns capacity and deadline checks**

```gherkin
Given a Participant-cancelled registration exists
When the Activity is now full or a current cutoff has passed
Then re-registration is rejected
And the existing row remains CANCELLED with source PARTICIPANT
```

## 6. UC-P03 Track Participation — Sprint 6 slice

### Goal

Let a Participant see authoritative Event/Activity participation outcomes, self-record Attendance,
receive impact notifications and access eligible Certificate state.

### Primary actor

Authenticated Participant.

### Preconditions

- Private views require an authenticated Participant Session.
- Self-scan additionally requires an owned seat-active ActivityRegistration and matching token.

### Main flows

#### A. View participation

1. Participant opens My Events or My Activities.
2. System returns owned registrations using explicit outcome precedence.
3. Participant opens Activity participation detail to see schedule, registration outcome,
   Attendance and Certificate state.

#### B. Self-scan Attendance

1. Owning Organizer displays the shared Activity QR at the venue.
2. Participant scans the QR and authenticates if necessary.
3. Backend resolves Participant identity from Session and token to Activity.
4. System locks/rechecks Event, Activity, ActivityRegistration and backend time.
5. First valid scan creates one `VALID` Attendance.
6. Repeated valid scan returns the existing result with `alreadyRecorded=true`.

#### C. Track Notifications and Certificate

1. Participant lists their durable participation Notifications and unread count.
2. Participant marks one owned Notification or all owned unread Notifications read.
3. After an eligible completed Activity, Participant views or downloads the issued Certificate.
4. Revoked Certificate remains visible as revoked history rather than disappearing.

### Alternate and exception flows

- Unauthenticated scan: require authentication without trusting identity embedded in the QR.
- Malformed, unknown or mismatched token: reject without disclosing Activity/private state.
- Before opening boundary: reject as window not open.
- At/after `endAt`: reject as window closed.
- Activity `DRAFT`, `COMPLETED` or `CANCELLED`, cancelled Event, or registration not seat-active:
  reject new self-scan.
- `CANCELLED` or `NO_SHOW` registration: reject self-scan.
- Completion racing final scan: shared lock order and exclusive `endAt` determine one consistent
  result; frontend time cannot rescue a late scan.
- Certificate rendering/email failure: durable issued metadata remains successful.
- Cross-Participant Notification/Certificate/Attendance access: ownership-safe failure.

### Postconditions

- One Attendance exists at most per ActivityRegistration.
- Read/unread changes do not mutate underlying business state.
- No-show is assigned only by completion finalization or a valid post-completion correction outcome,
  never by frontend time.

### Acceptance Criteria

**AC-P03-01 My Events and My Activities remain distinct**

```gherkin
Given the Participant has Event and Activity registrations
When private participation screens load
Then My Events presents EventRegistration records
And My Activities presents ActivityRegistration outcomes
And neither screen fabricates an Event ticket or Event QR
```

**AC-P03-02 Shared QR identifies Activity, not Participant**

```gherkin
Given an owning Organizer displays the Activity Attendance QR
When a Participant scans it
Then the backend identifies the Participant from authenticated Session
And the token identifies the Activity
And the request does not accept a client-supplied userId as identity
```

**AC-P03-03 Scan-window boundaries are exact**

```gherkin
Given a seat-active registration and matching token
When backend time is before startAt minus attendanceEarlyScanMinutes minutes
Then scan is rejected as not open
When backend time equals startAt minus attendanceEarlyScanMinutes minutes
Then scan may succeed
When backend time is before endAt
Then scan may succeed
When backend time equals or exceeds endAt
Then scan is rejected as closed
```

**AC-P03-04 Early scan accepts Published Activity**

```gherkin
Given backend time is inside the configured early window
And the Activity remains PUBLISHED and all other facts are valid
When the Participant scans
Then one VALID Attendance is recorded
```

**AC-P03-05 First valid scan records one Attendance**

```gherkin
Given no Attendance exists for the owned seat-active registration
When a valid scan is processed
Then one Attendance is stored as VALID
And attendedAt reflects the effective scan time
And no Certificate or Rating is created before its own eligibility
```

**AC-P03-06 Duplicate and concurrent scan are idempotent**

```gherkin
Given a valid first scan is submitted more than once or concurrently
When processing completes
Then exactly one Attendance exists
And later successful responses return alreadyRecorded true with the same identity
And no duplicate downstream record or Notification is created
```

**AC-P03-07 Invalid registration or lifecycle closes scan**

```gherkin
Given the registration is CANCELLED or NO_SHOW
Or the Activity or Event is cancelled or otherwise ineligible
When the Participant scans
Then no new Attendance is created
And the current historical state is preserved
```

**AC-P03-08 Completion assigns No-show only when Attendance is absent**

```gherkin
Given an Activity reaches COMPLETED
When completion finalization runs
Then each remaining ACTIVE registration without VALID Attendance becomes NO_SHOW
And a registration with VALID Attendance remains the source of an Attended outcome
And existing CANCELLED registrations remain CANCELLED
```

**AC-P03-09 Outcome precedence preserves cancelled attendance history**

```gherkin
Given a valid Attendance existed before Activity or Event cancellation
When the Participant views My Activities
Then cancellation is the primary current outcome
And prior Attendance is shown only as secondary historical participation
And neither record is deleted
```

**AC-P03-10 Participant notification ownership is enforced**

```gherkin
Given durable participation Notifications exist for two Users
When one Participant lists, marks one Notification read or marks all unread Notifications read
Then only that Participant's Notifications are returned or changed
And another User's Notification is concealed
And bulk retry changes zero rows without replacing an existing readAt
```

**AC-P03-11 Notification retry is deduplicated**

```gherkin
Given a business transition already persisted its in-app Notification
When the same transition command or processor retries
Then no duplicate Notification is stored for the same recipient and transition
And optional email failure does not roll back the business state
```

**AC-P03-12 Certificate presentation reflects durable status**

```gherkin
Given the Participant owns an eligible Certificate
When Certificate detail or download is requested
Then ISSUED and REVOKED states are distinguished
And rendering failure does not revoke or delete issued metadata
And another Participant cannot access the Certificate
```

## 7. UC-P04 Rate Activity

### Goal

Allow an attended Participant to create or update one verified Activity Rating after the Activity
has completed.

### Primary actor

Authenticated Participant.

### Preconditions

- Activity is `COMPLETED`.
- Participant owns `VALID` Attendance for that Activity.

### Main flow

1. Participant opens a completed attended Activity.
2. Participant supplies integer score 1–5 and optional comment.
3. System validates Activity completion and Attendance ownership/status under lock.
4. System creates one `ACTIVE` ActivityRating or updates the existing one.
5. Eligible public/report aggregate includes the active Rating.

### Alternate and exception flows

- Activity not completed: reject even when Participant scanned early or during the Activity.
- Missing/foreign/voided Attendance: ownership-safe or eligibility failure.
- Score outside 1–5 or non-integer: validation failure.
- Comment after trim exceeds 1,000 characters: validation failure.
- Concurrent first submissions: converge on one Rating identity.
- Attendance later voided/restored: Rating becomes `INVALIDATED`/`ACTIVE` without row replacement.

### Postconditions

- At most one ActivityRating exists per Attendance.
- Invalidated Rating is excluded from aggregate but retained for audit/history.

### Acceptance Criteria

**AC-P04-01 Rating requires completed Activity**

```gherkin
Given the Participant already has VALID Attendance
But the Activity is Published or Ongoing
When a Rating is submitted
Then the request is rejected
And no Rating is stored
```

**AC-P04-02 Rating requires owned valid Attendance**

```gherkin
Given an Activity is Completed
When a non-attendee or a User owning VOIDED Attendance submits a Rating
Then the request is rejected without exposing another User's Attendance
```

**AC-P04-03 Score and comment are validated**

```gherkin
Given an eligible Participant
When score is not an integer from 1 to 5 or normalized comment exceeds 1000 characters
Then validation fails
And no partial Rating change is stored
```

**AC-P04-04 Later submission updates one Rating**

```gherkin
Given an ACTIVE Rating already exists for the owned Attendance
When the Participant submits a new valid score or comment
Then the same Rating is updated with updatedAt
And no second Rating is inserted
```

**AC-P04-05 Concurrent first submission converges**

```gherkin
Given no Rating exists for an eligible Attendance
When two first submissions race
Then one Rating identity remains
And no unique-constraint failure is exposed as a generic server error
```

**AC-P04-06 Attendance correction controls Rating validity**

```gherkin
Given an ACTIVE Rating exists
When Organizer correction changes Attendance to VOIDED
Then the same Rating becomes INVALIDATED and leaves aggregates
When the same Attendance is validly restored
Then the same Rating may return to ACTIVE without a replacement row
```

## 8. UC-O01 Manage Events — Sprint 6 participation impact

### Goal

Preserve the established Event lifecycle while adding complete Participant cancellation cascade and
Notification behavior.

### Primary actor

Verified Organizer who owns the Event.

### Preconditions

- Existing Sprint 4 Event update/cancellation eligibility remains authoritative.
- Cancellation is available only for an eligible owned `PUBLISHED` Event without financial or
  Assignment blockers.

### Main flow

1. Organizer submits eligible Event cancellation with valid reason.
2. System locks Event and all affected rows in approved order.
3. Existing Booth request/Hold cancellation behavior runs.
4. Every seat-active ActivityRegistration becomes `CANCELLED` with source `EVENT` and timestamp.
5. Participant-cancelled ActivityRegistration retains source `PARTICIPANT`.
6. Existing Attendance, Certificate, Rating and correction history is preserved.
7. One durable `EVENT_CANCELLED` Notification is stored for every `ACTIVE` EventRegistration owner.
8. Transaction commits; optional verified-email delivery runs after commit.

### Alternate and exception flows

- External participation exists and Organizer tries an operational Event patch: full patch fails
  under BR-78; sending a Notification is not a substitute for the freeze.
- Financial/Assignment blocker: existing Event cancellation conflict applies; no Participant state
  or Notification changes.
- Exact cancellation retry: returns existing cancellation without repeating cascade/Notification.
- Concurrent register/scan/cancel: Event-rooted lock determines one authoritative result.

### Postconditions

- No Participant registration or history is hard-deleted.
- New Activity registration and Attendance self-scan are closed for the cancelled Event.

### Acceptance Criteria

**AC-O01-S6-01 Participant participation freezes Event operational update**

```gherkin
Given a Published Event has any EventRegistration ActivityRegistration or Attendance
When its Organizer patches an operational field
Then the full patch is rejected as operational fields locked
And no field is changed merely by promising to notify Participants
```

**AC-O01-S6-02 Eligible Event cancellation cascades registrations atomically**

```gherkin
Given an owned Event is eligible for cancellation
And it has seat-active Activity registrations
When Organizer cancellation commits
Then the Event is CANCELLED
And affected registrations are CANCELLED with source EVENT and cancellation time
And no partial Participant cascade remains
```

**AC-O01-S6-03 Event cancellation preserves historical facts**

```gherkin
Given an affected registration has Attendance Certificate Rating or correction history
When the Event is cancelled
Then those records remain linked and unchanged except any explicitly governed current presentation
And Participant-cancelled source is not rewritten as EVENT
```

**AC-O01-S6-04 Every active Event participant is notified once**

```gherkin
Given an eligible Event cancellation affects direct joiners and Activity registrants
When cancellation commits
Then each User with an ACTIVE EventRegistration receives one EVENT_CANCELLED in-app Notification
And exact retry creates no duplicate
And optional email failure does not roll back cancellation
```

**AC-O01-S6-05 Cancellation race cannot leave active participation**

```gherkin
Given Event cancellation races a new Activity registration or Attendance scan
When commands serialize under the approved lock order
Then either the participant command commits first and cancellation cascades it
Or cancellation commits first and the participant command is rejected
And no seat-active registration or new scan survives the cancelled Event
```

## 9. UC-O06 Manage Activities — Sprint 6 participation impact

### Goal

Allow the owning Organizer to change, cancel and complete Activities without corrupting active
Participant reservations, Attendance history or downstream outcomes.

### Primary actor

Verified Organizer who owns the Event. Lifecycle processor may invoke the same completion command.

### Preconditions

- Existing Sprint 5 Activity ownership, lifecycle, conflict and proposal rules remain authoritative.

### Main flows

#### A. Change schedule, Location or capacity

1. Organizer submits a valid Activity change.
2. System locks Event, involved Location rows and Activity in approved order.
3. System rejects schedule/Location change after the first `VALID` Attendance.
4. System rejects capacity below seat-active registration count.
5. System revalidates Event bounds, conflict and registration configuration.
6. Existing registrations remain active; overlap warnings are recalculated.
7. Each affected seat-active Participant receives one schedule/Location-change Notification when
   those fields actually change.

#### B. Cancel Activity

1. Organizer submits an eligible Activity cancellation.
2. System changes affected seat-active registrations to `CANCELLED/ACTIVITY`.
3. Existing participation and audit history remains.
4. System closes new registration and scan.
5. Each affected Participant receives one Activity-cancelled Notification.

#### C. Complete Activity

1. Request-time guard or scheduler invokes the same completion-finalization command.
2. System locks/rechecks Event and Activity.
3. Activity becomes `COMPLETED`.
4. Remaining active registrations without valid Attendance become `NO_SHOW`.
5. Eligible Certificate metadata and state-change Notifications are created idempotently.
6. Transaction commits before optional rendering/email work.

### Alternate and exception flows

- First Attendance races schedule/Location change: whichever commits first under the common lock
  determines whether scan uses new facts or change is rejected.
- Capacity reduction races final-seat registration: common Activity lock prevents capacity falling
  below committed seat-active count.
- New start would precede `registrationDeadlineAt` or violate Event bounds/conflict: reject entire
  change.
- Schedule change introduces Participant overlap: retain registration and warn; no reconfirm state.
- Cancellation retry/completion retry: converge without duplicate cascade, Certificate or
  Notification.
- Rendering/email failure after completion: completed domain state remains committed.

### Postconditions

- Activity change never silently invalidates an existing registration.
- Cancelled Activity accepts no new registration or self-scan.
- Completion finalization leaves no active registration without either valid Attendance or No-show
  outcome.

### Acceptance Criteria

**AC-O06-S6-01 Change preserves registration identity**

```gherkin
Given a Published Activity has seat-active registrations and no valid Attendance
When Organizer applies an otherwise valid schedule or Location change
Then existing ActivityRegistration rows remain ACTIVE with the same identities
And no reconfirmation status is introduced
And overlap warnings are recalculated from the new interval
```

**AC-O06-S6-02 Schedule or Location freezes after first Attendance**

```gherkin
Given an Activity has at least one VALID Attendance
When Organizer changes schedule or Location
Then the command is rejected
And Activity and registrations remain unchanged
Even when the scan occurred in the configured early window before startAt
```

**AC-O06-S6-03 Scan and change race is serialized**

```gherkin
Given a valid early scan races a valid schedule or Location change
When both commands execute
Then both lock Event and Activity in compatible order
And if change commits first the scan evaluates the new schedule
And if scan commits first the change is rejected
```

**AC-O06-S6-04 Capacity cannot fall below active seats**

```gherkin
Given an Activity has N seat-active registrations
When Organizer changes capacity to a value below N
Then the change is rejected
And when a capacity change races the final-seat registration
Then the Activity lock prevents a committed capacity below the final seat count
```

**AC-O06-S6-05 Valid Activity change notifies affected Users once**

```gherkin
Given schedule or Location actually changes before any valid Attendance
When the change commits
Then each seat-active Participant receives one durable change Notification
And mutable message text is not used as the deduplication identity
And optional email failure does not undo the change
```

**AC-O06-S6-06 Activity cancellation cascades without deleting history**

```gherkin
Given an Activity has active and Participant-cancelled registrations
When eligible Organizer cancellation commits
Then seat-active registrations become CANCELLED with source ACTIVITY
And Participant-cancelled rows retain source PARTICIPANT
And Attendance Certificate Rating and correction history remain
```

**AC-O06-S6-07 Cancelled Activity closes register and scan**

```gherkin
Given an Activity is CANCELLED
When a Participant registers or attempts a new self-scan
Then the command is rejected
And no new registration Attendance or Certificate is created
```

**AC-O06-S6-08 Completion finalization is complete and idempotent**

```gherkin
Given an Activity reaches its completion transition
When completion finalization runs one or more times
Then Activity is COMPLETED
And active registrations without VALID Attendance are NO_SHOW
And eligible Certificate metadata and Notifications exist once
And retries do not rewrite stable identities or timestamps
```

**AC-O06-S6-09 Final scan and completion cannot contradict**

```gherkin
Given completion processing races a Participant scan near endAt
When both commands serialize on Event and Activity
Then a scan evaluated before endAt may create VALID Attendance before finalization
But a scan evaluated at or after endAt is rejected
And the final registration outcome is consistent with the committed Attendance
```

## 10. UC-O07 Monitor Participation

### Goal

Let the owning Organizer inspect real registration/Attendance outcomes and correct exceptional
Attendance mistakes through an explicit append-only audit.

### Primary actor

Verified Organizer who owns the Event.

### Preconditions

- Organizer has an authenticated Session and owns the parent Event.

### Main flows

#### A. Monitor

1. Organizer selects an owned Event/Activity.
2. System returns paged real EventRegistration, ActivityRegistration and Attendance data.
3. Organizer searches/filters by supported outcome without placeholder or cross-Event data.
4. Detail distinguishes Active, Cancelled, Attended and No-show using shared precedence.

#### B. Correct to Attended

1. Organizer chooses an eligible registration and explicitly selects correction to Attended.
2. Organizer supplies normalized reason of 10–500 characters and effective `attendedAt`.
3. System confirms ownership and validates effective time inside the Attendance window.
4. System creates/restores `VALID` Attendance and returns registration to `ACTIVE` where allowed.
5. System appends one AttendanceAdjustment with prior/new outcome, actor and timestamps.
6. For a completed Activity, Certificate eligibility runs idempotently.

#### C. Void Attendance

1. Organizer explicitly chooses Void with valid reason and confirmation.
2. System changes existing Attendance to `VOIDED`.
3. Before completion, registration returns to `ACTIVE`; after completion it becomes `NO_SHOW`;
   after Activity/Event cancellation it remains `CANCELLED` with original source.
4. Existing Certificate becomes `REVOKED` and Rating becomes `INVALIDATED` atomically.
5. System appends one AttendanceAdjustment and required Certificate Notification.

### Alternate and exception flows

- Foreign Event/Activity/registration: ownership-safe not found.
- Blank/short/long correction reason after normalization: validation failure.
- Missing or out-of-window effective `attendedAt` for adding Attendance: validation failure.
- Assign No-show manually before completion: rejected.
- Cancelled Activity/Event and no historical Attendance ever existed: cannot create Attendance.
- Cancelled Activity/Event with historical Attendance: Organizer may restore/void that same history.
- Exact correction retry: return achieved result without a duplicate AttendanceAdjustment.
- Conflicting correction racing scan/completion/cancellation: lock-time facts and common order decide;
  no partial Certificate/Rating cascade.

### Postconditions

- Every effective correction has an append-only audit record.
- Direct unchecked Attendance database update is not an Actor flow.
- No Attendance Operator role is introduced.

### Acceptance Criteria

**AC-O07-01 Monitoring is Event-owner scoped**

```gherkin
Given participation exists in Events owned by different Organizers
When one Organizer lists or opens participation data
Then only data from that Organizer's Event is returned
And a foreign private record is concealed
```

**AC-O07-02 Monitoring uses real paged outcomes**

```gherkin
Given an owned Activity has Active Cancelled Attended and No-show outcomes
When Organizer searches filters or pages the participation view
Then results come from durable registration and Attendance data
And outcome precedence is consistent with Participant view
And no placeholder row or phantom endpoint result is shown
```

**AC-O07-03 Correction reason is mandatory and normalized**

```gherkin
Given an Organizer begins an Attendance correction
When normalized reason is shorter than 10 or longer than 500 characters
Then validation fails and no state or audit row changes
But a reason within the inclusive bounds may proceed
```

**AC-O07-04 Correcting to Attended records effective and processing times**

```gherkin
Given an eligible ACTIVE or NO_SHOW registration
And effective attendedAt is inside the Activity Attendance window
When Organizer corrects it to Attended
Then Attendance becomes VALID with that effective attendedAt
And created or adjustment time records when correction was processed
And one append-only adjustment records actor previous outcome new outcome and reason
```

**AC-O07-05 Out-of-window effective Attendance is rejected**

```gherkin
Given Organizer supplies attendedAt before startAt minus attendanceEarlyScanMinutes minutes or at or after endAt
When correcting a registration to Attended
Then the correction is rejected
And no Attendance adjustment Certificate or Notification is changed
```

**AC-O07-06 Void outcome depends on Activity lifecycle**

```gherkin
Given VALID Attendance exists
When Organizer voids it before Activity completion
Then registration returns to ACTIVE
When Organizer voids it after Activity completion
Then registration becomes NO_SHOW
When Organizer voids historical Attendance after Activity or Event cancellation
Then registration remains CANCELLED with its original source
```

**AC-O07-07 Cancelled Activity cannot gain new historical Attendance**

```gherkin
Given Activity or Event is cancelled
And a registration never had Attendance
When Organizer attempts to correct it to Attended
Then the request is rejected
But when that registration had a prior VOIDED Attendance
Then restoring that same Attendance may proceed under audit rules
```

**AC-O07-08 Correction cascades Certificate and Rating atomically**

```gherkin
Given VALID Attendance has an ISSUED Certificate and ACTIVE Rating
When Organizer voids Attendance
Then Attendance is VOIDED Certificate is REVOKED and Rating is INVALIDATED in one transaction
And required Certificate Notification is stored once
And any failure rolls back the whole domain mutation
```

**AC-O07-09 Late restore reruns Certificate eligibility idempotently**

```gherkin
Given a completed Activity with certificate enabled and VOIDED historical Attendance
When Organizer validly restores that Attendance
Then the same Attendance returns to VALID
And the existing Certificate identity may return to ISSUED with stable code and issuedAt
And exact retry creates no second Certificate adjustment or Notification
```

**AC-O07-10 Exact retry and conflicting correction are distinguished**

```gherkin
Given an audited correction already achieved its requested outcome
When the exact command is retried
Then the existing effective result is returned without another adjustment
But when a different correction races scan completion or cancellation
Then commands serialize and one revalidates current facts
And no partial or contradictory history commits
```

## 11. Required Notification transitions

Sprint 6 requires these durable in-app Notification types:

```text
ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED
ACTIVITY_CANCELLED
EVENT_CANCELLED
CERTIFICATE_ISSUED
CERTIFICATE_REVOKED
```

Every required Notification:

- belongs to exactly one recipient User;
- has a stable entity/transition reference suitable for deduplication;
- is stored atomically with the domain state change;
- contains server-owned title/message snapshots without raw QR token or private secrets;
- supports owner-only list, unread count, mark-one-read and mark-all-read;
- does not depend on optional Participant email;
- may trigger verified-email delivery only after commit.

General broadcast composition, notification preferences, SMS/push and a transactional message
outbox remain outside Sprint 6.

## 12. API contract conformance checklist

The API contract must map, without weakening, all of these outcomes:

- authentication required, CSRF failure and authority mismatch;
- ownership-safe not found for private cross-User/cross-Organizer resources;
- Event/Activity lifecycle ineligible;
- Event and Activity registration cutoffs, including equality boundaries;
- Activity full and final-seat concurrency;
- schedule-overlap warning on successful registration;
- cancellation before start versus at/after start;
- re-register source and current eligibility;
- malformed/unknown Attendance token and token secrecy;
- Attendance window not open/closed with exact boundary behavior;
- already-recorded Attendance success;
- No-show and cancelled registration scan rejection;
- Activity change blocked by existing valid Attendance;
- capacity reduction floor;
- correction reason/effective-time validation;
- Certificate and Rating eligibility/status;
- Notification ownership and duplicate transition handling.

The approved API contract names HTTP paths, request/response fields and error codes after review of
the Sprint 6 Physical ERD overlay. It introduces no Participant QR, Event entrance QR, Attendance
Operator, waitlist or generic notification composer.

## 13. Acceptance Criteria audit

- `UC-G01`: 4 Acceptance Criteria.
- `UC-P01`: 7 Acceptance Criteria.
- `UC-P02`: 12 Acceptance Criteria.
- `UC-P03`: 12 Acceptance Criteria.
- `UC-P04`: 6 Acceptance Criteria.
- `UC-O01` Sprint 6 slice: 5 Acceptance Criteria.
- `UC-O06` Sprint 6 slice: 9 Acceptance Criteria.
- `UC-O07`: 10 Acceptance Criteria.

Total: **65 Sprint 6 Acceptance Criteria**.

Focused review passed: all 65 IDs are unique, every ID traces to an active Use Case, all required
alternative/exception paths from `sprint-06.md` appear above, and the approved ERD/API artifacts
contain no contradictory endpoint or persisted-field decision.
