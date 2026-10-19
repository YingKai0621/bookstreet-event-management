# Sprint 05 Use Case Specifications

> Baseline status: `IMPLEMENTED — SPRINT 5 COMPLETED` on 2026-10-19. These 54 Acceptance
> Criteria remain the implementation and regression-test contract for Sprint 5 Activity planning.

## 1. Shared rules

- Authentication uses Spring Security server-side Session; state-changing browser calls require
  CSRF.
- Ownership comes from the authenticated principal, never request body/query identity.
- PostgreSQL is durable truth; Redis stores Session only.
- Backend Clock is authoritative and deadline equality is accepted.
- V1–V8 remain immutable; V9 has one migration owner.
- Every Activity mutation locks Event first, then involved Location IDs ascending, then domain row.
- Official non-cancelled Activity conflict is enforced in both service and PostgreSQL.
- Unknown JSON fields fail; commands never silently ignore client mistakes.
- Private Partner resources return ownership-safe 404.
- Email is post-commit; delivery failure never rolls back domain state.

## 2. UC-E04 Propose Activity

### Goal

Allow an approved Partner to propose a scheduled Activity at an eligible shared Location or its own
assigned Booth, then respond to Organizer feedback.

### Primary actor

Verified representative of a PartnerOrganization.

### Preconditions

- Authenticated effective `PARTNER` authority.
- PartnerOrganization profile exists.
- PartnerEventApplication for the Event is `APPROVED`.

### Main flow

1. Partner loads eligible Locations for the Event.
2. Partner submits exact proposal details before/at the proposal deadline.
3. System locks/rechecks Event and ownership eligibility.
4. System validates fields, Event bounds, Location, capacity and early quota.
5. System creates Proposal `PENDING` with non-null submission/update timestamps.
6. Partner lists/views the private Proposal.
7. If Organizer requests changes, Partner revises and resubmits it to `PENDING`.
8. Partner may withdraw an open Proposal.

### Alternate/error flows

- Event not Published for initial submit: `EVENT_NOT_ACCEPTING_ACTIVITY_PROPOSALS`.
- Deadline passed: `ACTIVITY_PROPOSAL_DEADLINE_PASSED`.
- Application not approved: `PARTNER_APPLICATION_NOT_APPROVED`.
- Invalid/foreign/inactive Location: 404 or `LOCATION_NOT_ACTIVE`.
- Booth lacks correct Active Assignment: `BOOTH_ASSIGNMENT_REQUIRED` or
  `BOOTH_NOT_ASSIGNED_TO_PARTNER`.
- Invalid time/capacity/text: 422 field error.
- Quota zero/reached: `ACTIVITY_QUOTA_REACHED`.
- Edit/resubmit/withdraw from disallowed state: `PROPOSAL_NOT_EDITABLE`.

### Postconditions

- Proposal does not reserve a Location and does not consume official Activity quota.
- No official Activity exists until Organizer approval commits.

### Acceptance Criteria

**AC-E04-01 Initial submit creates Pending without Draft**

```gherkin
Given an approved Partner application and a Published Event
And backend time is before or exactly at activityProposalDeadlineAt
When the Partner submits a valid Activity Proposal
Then one Proposal is stored as PENDING
And submittedAt and updatedAt are non-null
And no Activity or Location reservation is created
```

**AC-E04-02 Initial deadline and Event status are authoritative**

```gherkin
Given backend time is after the proposal deadline or the Event is not Published
When a Partner submits an initial Proposal
Then the command returns the matching 409 error
And stores no Proposal
```

**AC-E04-03 Partner does not require a Booth**

```gherkin
Given an approved Partner has no BoothAssignment
And an active shared STAGE WORKSHOP or AREA Location is eligible
When the Partner submits a valid Proposal at that Location
Then the Proposal is accepted
```

**AC-E04-04 Booth selection requires owned Assignment**

```gherkin
Given a Partner selects a BOOTH Location
When no Active BoothAssignment belongs to that Partner in the same Event
Then the system returns BOOTH_ASSIGNMENT_REQUIRED or BOOTH_NOT_ASSIGNED_TO_PARTNER
And creates no Proposal
```

**AC-E04-05 Proposal validation covers exact schedule and capacity**

```gherkin
Given a Proposal has an invalid title type interval Event boundary or capacity
When it is submitted
Then the system returns 422 with field details
And persists no partial record
```

**AC-E04-06 Pending edit obeys the general deadline**

```gherkin
Given the Partner owns a Pending Proposal
When it is edited before or exactly at the deadline
Then the normalized values and updatedAt change atomically
But when backend time is after the deadline
Then the edit returns ACTIVITY_PROPOSAL_DEADLINE_PASSED
```

**AC-E04-07 NeedChanges may be resubmitted after the general deadline**

```gherkin
Given the Organizer returned a Proposal as NEED_CHANGES
And the Event is Published or Ongoing
And backend time is before proposedStartAt
When the Partner submits valid revisions even after the general proposal deadline
Then the Proposal returns to PENDING
And updatedAt changes
```

**AC-E04-08 Open Proposal withdrawal is idempotent**

```gherkin
Given a Partner owns a Pending or NeedChanges Proposal
When the Partner withdraws it
Then it becomes WITHDRAWN with its first withdrawnAt
And repeating withdrawal returns the same record without changing metadata or sending email again
```

**AC-E04-09 Private Proposal ownership is concealed**

```gherkin
Given a Proposal belongs to another Partner
When the current Partner requests detail edit resubmit or withdrawal
Then the system returns ownership-safe 404
```

**AC-E04-10 Stale open Proposal closes at proposed start**

```gherkin
Given a Proposal remains PENDING or NEED_CHANGES
When backend time reaches proposedStartAt and lifecycle cleanup runs
Then the Proposal becomes CANCELLED
And approve edit or resubmit can no longer create an Activity
And repeated cleanup is idempotent
```

## 3. UC-O05 Review Activity Proposals

### Goal

Let the owning Organizer make an auditable decision without rewriting Partner-submitted facts.

### Primary actor

Verified Organizer who owns the Event.

### Main flow

1. Organizer lists/opens Pending proposals for owned Events.
2. Organizer either requests changes, rejects or approves.
3. Approval locks and revalidates Event, Location, Partner application, Booth ownership, capacity,
   quota and conflict.
4. Approval atomically creates one Draft Activity and completes the Proposal.
5. Post-commit email informs the Partner representative.

### Alternate/error flows

- Foreign Event/Proposal: `ACTIVITY_PROPOSAL_NOT_FOUND`.
- Non-Pending Proposal: `PROPOSAL_NOT_REVIEWABLE`.
- Invalid/missing note for change/reject: 422.
- Slot taken after submission: `ACTIVITY_LOCATION_TIME_CONFLICT`.
- Quota/Booth/Location eligibility changed: matching 409.
- Email failure: log only; committed decision remains.

### Acceptance Criteria

**AC-O05-01 Only Pending is reviewable except exact approve retry**

```gherkin
Given a Proposal is not PENDING
When Organizer attempts request-changes or reject
Then the system returns PROPOSAL_NOT_REVIEWABLE
And when approve targets an already APPROVED Proposal with its existing Activity
Then the system idempotently returns that Activity
But approve against every other non-Pending state returns PROPOSAL_NOT_REVIEWABLE
```

**AC-O05-02 Request Changes preserves submitted values**

```gherkin
Given an owned Pending Proposal
When Organizer requests changes with a valid review note
Then status becomes NEED_CHANGES
And Proposal business fields remain unchanged
And the Partner is notified after commit
```

**AC-O05-03 Reject is terminal and audited**

```gherkin
Given an owned Pending Proposal
When Organizer rejects it with a valid review note
Then status becomes REJECTED with reviewedAt and note
And no Activity is created
```

**AC-O05-04 Approve is atomic and exact**

```gherkin
Given an owned Pending Proposal remains eligible
When Organizer approves it
Then Proposal becomes APPROVED
And exactly one Activity DRAFT copies its title description type schedule Location and capacity
And both changes commit or both roll back
```

**AC-O05-05 Approval rechecks mutable eligibility**

```gherkin
Given a Proposal was valid when submitted
But its Location became inactive capacity decreased Booth Assignment ended quota filled or slot conflicted
When Organizer approves it
Then the system returns the matching conflict
And leaves the Proposal Pending
And creates no Activity
```

**AC-O05-06 Concurrent approval is idempotent**

```gherkin
Given two approve commands race for the same Proposal
When both complete
Then sourceProposal uniqueness permits exactly one Activity
And both successful/idempotent responses identify that same Activity
And quota is consumed once
```

**AC-O05-07 Competing Proposals do not reserve a slot**

```gherkin
Given two Pending Proposals overlap at one Location
When one is approved first
Then it creates the Draft Activity
And approval of the other returns ACTIVITY_LOCATION_TIME_CONFLICT
And the second Proposal remains Pending for an explicit Organizer decision
```

**AC-O05-08 Notification failure does not undo review**

```gherkin
Given a Proposal decision commits
When Partner email delivery fails
Then the committed status and Activity remain
And the failure is logged without secrets
```

## 4. UC-O02 Manage Activity Locations — Sprint 5 slice

### Goal

Maintain safe shared Locations while preserving Booth ownership and scheduled Activities.

### Acceptance Criteria

**AC-O02-01 Generic Location API excludes Booth creation**

```gherkin
Given an Organizer creates a shared Location
When locationType is STAGE WORKSHOP or AREA and data is valid
Then the Location is created with an uppercased code
But locationType BOOTH returns validation failure and must use the Booth API
```

**AC-O02-02 Code uniqueness is case-insensitive**

```gherkin
Given Location code STAGE-A exists
When another Location is created or renamed to stage-a
Then the system rejects it as duplicate
```

**AC-O02-03 Deactivation protects scheduled work**

```gherkin
Given a Location has a current or future non-cancelled Activity
When Organizer attempts to deactivate it
Then the system returns LOCATION_HAS_ACTIVE_ACTIVITIES
And keeps the Location active
```

**AC-O02-04 Capacity reduction protects Activity capacity**

```gherkin
Given a non-cancelled applicable Activity capacity is 80
When Organizer lowers Location maxCapacity below 80
Then the system returns LOCATION_CAPACITY_IN_USE
And applies no update
```

## 5. UC-O06 Manage Activities

### Goal

Let Organizer create Book Street activities, configure Drafts, publish/cancel safely and process
Partner requests.

### Main flows

- Create direct BTC Activity at shared non-Booth Location.
- Patch a Draft Activity configuration.
- Publish a complete Draft.
- Timed lifecycle advances public Activity.
- Organizer cancels a non-terminal Activity.
- Review Partner Change/Cancellation Request.

### Acceptance Criteria

**AC-O06-01 Direct BTC Activity cannot use Booth**

```gherkin
Given Organizer creates an Activity directly
When Location is active STAGE WORKSHOP or AREA and data is valid
Then one DRAFT Activity without sourceProposal is created
But when Location is BOOTH
Then the command returns BOOTH_ASSIGNMENT_REQUIRED
```

**AC-O06-02 Official conflict is cross-Event and half-open**

```gherkin
Given a non-cancelled Activity occupies one Location from 09:00 to 10:00
When another official Activity at that Location starts before 10:00
Then it is rejected with ACTIVITY_LOCATION_TIME_CONFLICT even if it belongs to another Event
But a second Activity starting exactly at 10:00 is accepted
```

**AC-O06-03 Database resolves concurrent conflict**

```gherkin
Given two valid commands concurrently create overlapping official Activities at one Location
When both transactions race after service prechecks
Then the exclusion constraint permits at most one
And the loser receives 409 ACTIVITY_LOCATION_TIME_CONFLICT rather than 500
```

**AC-O06-04 Publish validates completeness and creates QR once**

```gherkin
Given a Draft Activity is complete and registrationRequired is true
And backend time is not after registrationDeadlineAt
And registrationDeadlineAt is not after startAt
When Organizer publishes it
Then it becomes PUBLISHED with publishedAt and one Attendance QR token
And repeated publish returns the same token and timestamp without duplicate email
```

**AC-O06-05 Non-registration Activity has no registration artifacts**

```gherkin
Given registrationRequired is false
When Organizer configures or publishes the Activity
Then registrationDeadlineAt and Attendance QR are null
And isCertificateEnabled is false
```

**AC-O06-06 Timed lifecycle is monotonic and catches up**

```gherkin
Given a Published Activity passes startAt and endAt
When scheduled or request-time lifecycle processing runs repeatedly
Then it advances to ONGOING and COMPLETED or directly to COMPLETED when overdue
And never moves backwards
```

**AC-O06-07 Organizer cancellation preserves first metadata**

```gherkin
Given an owned non-terminal Activity
When Organizer cancels it with a valid public-safe reason
Then it becomes CANCELLED with source ORGANIZER and first cancellation metadata
And repeated cancellation returns the same metadata without repeated email
```

**AC-O06-08 Change Request approval applies a valid merged candidate**

```gherkin
Given a Pending Change Request for a Partner Activity
When Organizer approves it and the merged candidate remains valid
Then request becomes APPROVED
And Activity is atomically updated
And a Published Activity remains Published
And the change is auditable without status RESCHEDULED
```

**AC-O06-09 Change Request approval rechecks conflict and ownership**

```gherkin
Given a Pending Change Request became invalid because slot Location capacity or Booth ownership changed
When Organizer approves it
Then the command returns the matching conflict
And neither Activity nor request changes
```

**AC-O06-10 Cancellation Request approval is atomic**

```gherkin
Given a Pending Cancellation Request and a non-terminal Activity
When Organizer approves it
Then request becomes APPROVED
And Activity becomes CANCELLED with source PARTNER_REQUEST and the request reason
And both changes commit or both roll back
```

**AC-O06-11 Reject leaves official Activity unchanged**

```gherkin
Given a Pending Change or Cancellation Request
When Organizer rejects it with a valid review note
Then request becomes REJECTED
And Activity business state is unchanged
```

**AC-O06-12 Applied changes have durable revision evidence**

```gherkin
Given Organizer applies an allowed Activity patch or approves a Partner Change Request
When the Activity changes
Then the same transaction stores one immutable revision with old and new snapshots
And identifies the actor source request when applicable reason and changedAt
And no API permits editing or deleting that revision
```

## 6. UC-E05 Request Activity Change

### Acceptance Criteria

**AC-E05-01 Only owned Partner Draft/Published Activity is eligible**

```gherkin
Given an Activity traces to the Partner through its source Proposal
And status is DRAFT or PUBLISHED
When Partner submits a valid change
Then one Pending Change Request is created
But direct BTC foreign Ongoing Completed or Cancelled Activity returns the matching safe error
```

**AC-E05-02 Request requires an actual normalized change**

```gherkin
Given requested fields are absent or normalize to current Activity values
When Partner submits the Change Request
Then the system returns ACTIVITY_CHANGE_HAS_NO_EFFECT
And creates no request
```

**AC-E05-03 Start and end form a pair**

```gherkin
Given only one of requestedStartAt or requestedEndAt is supplied
When Partner submits the request
Then validation returns 422
And creates no request
```

**AC-E05-04 Merged validation runs on submit**

```gherkin
Given a partial request would make the merged Activity invalid or conflicting
When submitted
Then the matching 422 or 409 is returned
And no Pending request is created
```

**AC-E05-05 One Pending request exists across both types**

```gherkin
Given an Activity already has a Pending Change or Cancellation Request
When Partner submits either request type concurrently or sequentially
Then at most one Pending request exists
And the other command returns ACTIVITY_REQUEST_ALREADY_PENDING
```

**AC-E05-06 Withdrawal is idempotent**

```gherkin
Given Partner owns a Pending Change Request
When Partner withdraws it one or more times
Then status is WITHDRAWN with the original withdrawnAt
And Activity remains unchanged
```

**AC-E05-07 Ongoing transition closes an obsolete Change Request**

```gherkin
Given a Published Activity has a Pending Change Request
When backend time reaches Activity start and it becomes ONGOING
Then the Change Request becomes CANCELLED
And the same Activity may still receive or retain a Cancellation Request according to its rules
```

## 7. UC-E06 Request Activity Cancellation

### Acceptance Criteria

**AC-E06-01 Submit does not cancel Activity**

```gherkin
Given Partner owns a non-terminal official Activity
When a valid Cancellation Request is submitted
Then one request becomes PENDING
And Activity status and public visibility remain unchanged
```

**AC-E06-02 Cutoff boundary is exact**

```gherkin
Given backend time equals activityCancellationCutoffAt
When Partner submits a Cancellation Request
Then isLate is false
But when backend time is later than the cutoff
Then the request is still accepted with isLate true
```

**AC-E06-03 Reason is normalized and bounded**

```gherkin
Given cancellation reason normalizes outside 10 to 500 characters
When submitted
Then the system returns 422 VALIDATION_FAILED
And creates no request
```

**AC-E06-04 Pending cancellation can be withdrawn**

```gherkin
Given Partner owns a Pending Cancellation Request
When withdrawn
Then request becomes WITHDRAWN
And Activity remains unchanged
And repeating withdrawal is idempotent
```

**AC-E06-05 Terminal cascade closes request**

```gherkin
Given a Pending Activity request
When its Event or Activity is terminalized by another valid system command
Then the request becomes CANCELLED
And a later review attempt returns conflict
```

## 8. UC-G01 Discover Public Activities — Sprint 5 slice

### Acceptance Criteria

**AC-G01-01 Public list hides Draft and Cancelled**

```gherkin
Given Activities exist in all lifecycle states
When Guest lists Activities without a status filter
Then only PUBLISHED and ONGOING are returned
And no private Proposal or review data is exposed
```

**AC-G01-02 Completed is an explicit discovery filter**

```gherkin
Given completed Activities exist
When Guest requests status COMPLETED
Then matching completed Activities are returned with valid pagination
But DRAFT or CANCELLED filters return INVALID_ACTIVITY_STATUS_FILTER
```

**AC-G01-03 Cancelled historical detail explains an old link**

```gherkin
Given an Activity was Published and later Cancelled
When Guest opens its public detail URL
Then detail returns the Activity with cancellation timestamp reason and source
But a never-published Draft or Cancelled Draft returns 404
```

## 9. Cross-cutting Event behavior

**AC-X05-01 Activity records freeze Event operational fields**

```gherkin
Given a Published Event has an Activity Proposal Activity or Activity request
When Organizer patches an operational Event field
Then the system returns EVENT_OPERATIONAL_FIELDS_LOCKED
And applies none of the patch
```

**AC-X05-02 Event cancellation cascade is atomic**

```gherkin
Given an Event independently satisfies every Sprint 4 cancellation blocker
And has open Activity records
When Organizer cancels the Event
Then open Proposals and requests become CANCELLED
And Draft Published and Ongoing Activities become CANCELLED with source EVENT_CANCELLATION
And either the entire Event and Activity cascade commits or none of it does
```

**AC-X05-03 Activity does not weaken financial cancellation blockers**

```gherkin
Given an Event has a Pending Successful or reconciliation-blocking Payment or any Assignment
When Organizer attempts Event cancellation regardless of Activity state
Then the existing Sprint 4 blocker rejects cancellation
And no Activity record is cascaded
```

**AC-X05-04 Event completion cleans stale private work**

```gherkin
Given Event end time passes with Draft Activity or open Activity Proposal or request
When lifecycle processing completes the Event
Then open Proposals and requests become CANCELLED
And a remaining Draft Activity becomes CANCELLED with source SYSTEM and the stable completion reason
And overdue Published or Ongoing Activity reaches COMPLETED from backend time
And no Draft becomes public
And repeated cleanup is idempotent
```

**AC-X05-05 Draft Event mutation preserves Activity dependencies**

```gherkin
Given an Organizer prepared a direct Activity under a Draft Event
When the Organizer deletes that Event
Then the system returns EVENT_HAS_ACTIVITY_DEPENDENCIES and deletes nothing
And when Event time is patched
Then the patch succeeds only if every non-cancelled Activity remains inside the merged interval
```

