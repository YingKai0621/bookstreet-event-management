# Sprint 07 Use Case Specifications

> Baseline status: `APPROVED - ACTIVE 2026-10-28`.
>
> This document refines the approved decisions in `docs/sprints/sprint-07.md` into observable
> behavior and 41 Acceptance Criteria. Endpoint paths, DTO fields and error codes remain governed
> by the active Sprint 7 API Contract.

## 1. Source and traceability

This specification refines, but does not replace:

- `docs/requirements/05_Business_Rules.md`, especially BR-12, BR-43, BR-44 and BR-48 through
  BR-50;
- `docs/requirements/06_Use_Case_List.md`;
- `docs/requirements/08_MVP_Scope_v2.md`;
- `docs/design/12_Physical_ERD_Report.md`;
- `docs/sprints/sprint-07.md`.

Sprint 7 refines these existing Use Cases:

- `UC-P01` Manage Event Participation;
- `UC-P03` Track Participation;
- `UC-O07` Monitor Participation;
- `UC-A03` Manage Badges.

No new Actor or top-level Use Case is introduced. Point calculation, Badge eligibility evaluation,
Badge backfill and `BADGE_UNLOCKED` Notification persistence are system behavior supporting these
Use Cases.

## 2. Shared rules

### 2.1 Identity, authorization and privacy

- Authentication uses Spring Security server-side Session. State-changing browser requests require
  CSRF protection.
- Participant, Organizer and Admin identity comes from the authenticated principal. No command may
  accept `userId` as a substitute for Session identity.
- A Participant may scan for and read rewards only for themselves.
- An Organizer may read BoothVisit monitoring only for an Event where `event.organizerUserId`
  matches the authenticated User.
- Badge catalog mutation requires ADMIN authority.
- Ownership-safe lookup must not reveal whether another User's private BoothVisit,
  PointTransaction, UserBadge or Notification exists.
- Raw BoothAssignment QR tokens are bearer-like secrets. Participant responses, public catalog
  responses, Notifications, analytics and application/access logs must not expose the full token.
- The QR application route keeps the token in a URI fragment or equivalent client-only state, not
  in a backend URL path/query. The authenticated scan command receives it in an HTTPS request body
  whose field is omitted or redacted from request logging.
- Partner Assignment views may retrieve their authorized QR for venue display; Sprint 7 does not
  broaden QR visibility to public or unrelated roles.

### 2.2 Time and lifecycle

- Backend `Clock` is authoritative. UI time and client lifecycle labels are advisory only.
- Persisted instants follow the project time policy; UI renders them in `Asia/Ho_Chi_Minh`.
- Before validating a Booth scan, the backend advances the locked Event's timed lifecycle.
- A new BoothVisit is accepted only when:

```text
boothAssignment.status = ACTIVE
AND event.status = ONGOING
AND event.startAt <= backendNow < event.endAt
```

- The opening boundary is inclusive and the closing boundary is exclusive.
- Sprint 7 has no early Booth scan window.
- QR validity ending does not delete a BoothVisit, PointTransaction, UserBadge or Notification that
  was validly committed earlier.

### 2.3 State and identity vocabulary

EventRegistration statuses reused from Sprint 6:

```text
ACTIVE
LEFT
```

BoothAssignment statuses reused from the Booth/Payment baseline:

```text
ACTIVE
RELEASED
CANCELLED
ENDED
```

Badge state is represented by `isActive`:

```text
true  = eligible for progress display and new awards
false = no new award; existing UserBadge history remains
```

Stable uniqueness:

```text
BoothVisit       = (eventRegistrationId, boothAssignmentId)
PointTransaction = boothVisitId
Badge name       = normalized case-insensitive name
UserBadge        = (userId, badgeId)
Notification     = (recipientUserId, stable UserBadge-derived deduplication key)
```

There is no mutable Point balance column on User. Current total Points is the sum of owned
PointTransactions.

### 2.4 Point and Badge policy

- One first valid BoothVisit awards exactly `10` Points.
- The server reads the positive configured value from `rewards.booth-visit-points=10`; the client
  cannot submit or override it.
- PointTransaction snapshots the awarded amount. A future configuration change does not rewrite
  historical transactions.
- Points accumulate across Events and do not reset at Event boundaries.
- Every active Badge with `requiredPoints <= totalPoints` is eligible for award.
- One scan may cross and award more than one Badge threshold.
- UserBadge is historical evidence. Badge deactivation or threshold increase never revokes or
  deletes an already earned UserBadge.

### 2.5 Transaction, concurrency and idempotency

- PostgreSQL is durable truth. Redis stores Session only.
- The first valid Booth scan is one atomic transaction following the approved order:

```text
Event
  -> BoothAssignment
  -> EventRegistration
  -> BoothVisit
  -> PointTransaction
  -> Badge by badgeId
  -> UserBadge by badgeId
  -> Notification
```

- Unique constraints are the final duplicate guard for BoothVisit, PointTransaction, UserBadge and
  Notification deduplication identity.
- Duplicate/concurrent valid scans converge on one BoothVisit and one PointTransaction.
- A newly created UserBadge and its `BADGE_UNLOCKED` Notification commit together or both roll
  back.
- Admin Badge mutation, scan evaluation and backfill lock affected Badge rows by ascending
  `badgeId` and recheck `isActive` and `requiredPoints` under lock.
- If Admin mutation commits before evaluation, its new Badge state controls that evaluation. If an
  award commits first, the resulting UserBadge remains earned under the historical rule.
- Scan and backfill racing to award the same User/Badge converge on unique `(userId, badgeId)`.
  Only the transaction that inserts UserBadge inserts its Notification; the other reuses the
  committed result.
- Exact retry returns the achieved result without duplicating Points, Badges or Notifications.
- A later request evaluated when the QR is no longer valid is not an exact valid-window retry; it
  is rejected while the prior visit remains available through reward history.
- Badge backfill processes bounded User batches. Each User's missing UserBadge and Notification are
  atomic; one batch handles at most 100 Users in stable User order, and retry skips already-created
  rows and continues safely.

### 2.6 Ordering, pagination and empty results

- Private lists are paginated with validated page size and server-owned sort options.
- Point history defaults to newest `createdAt`, then descending stable identity.
- Earned Badges default to newest `earnedAt`, then descending stable identity.
- Organizer visit rows default to newest `visitedAt`, then descending BoothVisit identity.
- Empty owned results return a successful empty page/summary, never placeholder records.
- Current total, grouping counts and pagination totals are calculated from durable rows under the
  same ownership scope as their lists.

## 3. UC-P01 Manage Event Participation — Sprint 7 Booth-scan slice

### Goal

Ensure a Participant has one reusable EventRegistration when an eligible on-site Booth scan proves
participation, without weakening direct Join or Activity registration deadlines.

### Primary actor

Authenticated Participant.

### Preconditions

- The BoothAssignment QR resolves to an eligible ongoing Event.
- The Participant has an authenticated Session.

### Main flow

1. Participant scans an eligible BoothAssignment QR.
2. System resolves the Event and User from trusted data.
3. If no EventRegistration exists, System creates one ACTIVE row.
4. If the existing row is LEFT, System reactivates that same row.
5. If it is already ACTIVE, System reuses it.
6. The scan transaction continues to BoothVisit and reward processing.

### Alternate and exception flows

- Invalid Booth QR or Event lifecycle: no EventRegistration is created/reactivated.
- Cross-Event relationship inconsistency: reject and roll back the command.
- Direct Join and Activity registration continue to use their existing deadlines and rules.
- Concurrent direct Join and Booth auto-join converge on one EventRegistration.

### Postconditions

- At most one EventRegistration exists for the Participant and Event.
- Auto-registration has no Event ticket or Event-level QR side effect.

### Acceptance Criteria

**AC-P01-S7-01 First eligible Booth scan creates EventRegistration**

```gherkin
Given an authenticated Participant has no EventRegistration for the Event
And the Booth scan is otherwise valid
When the scan is processed
Then one ACTIVE EventRegistration is created for that User and Event
And BoothVisit reward processing uses that registration
And no Event ticket or Event QR is created
```

**AC-P01-S7-02 A LEFT EventRegistration is reactivated**

```gherkin
Given the Participant has one LEFT EventRegistration for the Event
And the Booth scan is otherwise valid
When the scan is processed
Then the same EventRegistration returns to ACTIVE
And activation metadata is updated according to the Sprint 6 registration baseline
And no second EventRegistration row is inserted
```

**AC-P01-S7-03 Booth auto-registration is limited to a valid on-site scan**

```gherkin
Given the Event participant-registration deadline has passed
When a valid Booth scan is processed during the ongoing Event window
Then EventRegistration is created or reactivated as required
But when the same User performs direct Join or Activity registration
Then those commands retain their existing deadline rules
And Booth scan does not become a general deadline bypass
```

## 4. UC-P03 Track Participation — Sprint 7 reward slice

### Goal

Let a Participant self-record one rewarded visit per assigned Booth, accumulate Points across
Events, unlock Badges and receive durable unlock Notifications.

### Primary actor

Authenticated Participant.

### Supporting actors

- Partner displays the authorized BoothAssignment QR at the assigned Booth.
- System evaluates Points, Badge thresholds and Notification persistence.

### Preconditions

- Private reward views require an authenticated Participant Session.
- First scan additionally requires a resolvable ACTIVE BoothAssignment in an ONGOING Event window.

### Main flows

#### A. First Booth visit

1. Partner displays the BoothAssignment-owned QR at the Booth.
2. Participant scans the application URL and authenticates if necessary.
3. Backend resolves User from Session and BoothAssignment from the opaque token.
4. System locks and refreshes the Event lifecycle, then revalidates Assignment and relationships.
5. System creates/reactivates EventRegistration when needed.
6. System creates one BoothVisit and one 10-Point PointTransaction.
7. System calculates the new cumulative total.
8. System creates each missing eligible UserBadge and one matching `BADGE_UNLOCKED` Notification.
9. System returns visit result, awarded Points, total Points and newly unlocked Badges.

#### B. Duplicate Booth scan

1. Participant repeats the same QR scan while it remains valid.
2. System resolves the existing BoothVisit and PointTransaction.
3. System returns the achieved reward outcome with `alreadyVisited` semantics.
4. No new visit, Points, UserBadge or Notification is created.

#### C. View Rewards

1. Participant opens Points and Badges.
2. System returns ledger-derived total Points and paginated Point history.
3. System returns earned Badges, including retained inactive Badge history.
4. System returns progress only for active unearned Badges.
5. Participant sees `BADGE_UNLOCKED` in the existing owner-only Notification inbox.

### Alternate and exception flows

- Unauthenticated scan: require login and preserve a safe return target containing only the opaque
  scan token; no reward mutation occurs before authentication.
- Malformed or unknown token: return the same public-safe invalid-token outcome and reveal no
  Assignment/Event/Partner details.
- Event before `startAt`, at/after `endAt`, completed or cancelled: reject a new scan.
- Assignment RELEASED, CANCELLED or ENDED: reject a new scan.
- Event/Assignment/EventRegistration relationship mismatch: roll back without partial repair.
- A previously rewarded QR scanned after it expires: reject scan but preserve existing history.
- Persistence failure in Point, Badge or Notification stage: roll back the first-scan transaction.
- Cross-Participant reward/history access: ownership-safe failure.

### Postconditions

- One rewarded BoothVisit exists at most per EventRegistration and BoothAssignment.
- One immutable PointTransaction exists at most per BoothVisit.
- Every newly persisted UserBadge has one durable `BADGE_UNLOCKED` Notification.
- Total Points is derived from ledger history and never from frontend state.

### Acceptance Criteria

**AC-P03-S7-01 QR identifies Assignment while Session identifies Participant**

```gherkin
Given a Partner displays an authorized BoothAssignment QR
When a Participant scans it
Then the opaque token identifies the BoothAssignment
And authenticated Session identifies the Participant
And the command does not accept client-supplied userId eventId boothId points or badgeId as truth
```

**AC-P03-S7-02 Authentication may resume a pending scan safely**

```gherkin
Given an unauthenticated User opens a Booth scan URL
When authentication is required
Then no EventRegistration BoothVisit PointTransaction or UserBadge is created yet
And after successful login the application may resume the same client-side opaque-token state
And the token is not placed in a backend path or query string
And no Participant identity is encoded into that return state
```

**AC-P03-S7-03 Malformed and unknown tokens disclose no private context**

```gherkin
Given a token is malformed or does not match a BoothAssignment
When a scan is attempted
Then the scan returns a stable invalid-token outcome
And no Event Booth Partner or Assignment existence detail is disclosed
And no participation or reward row changes
```

**AC-P03-S7-04 Event scan boundaries are exact**

```gherkin
Given an ACTIVE BoothAssignment and all other facts are valid
When backend time is before event startAt
Then a new visit is rejected as not open
When backend time equals startAt
Then lifecycle advances and the visit may succeed
When backend time is before endAt
Then the visit may succeed
When backend time equals or exceeds endAt
Then lifecycle advances and a new visit is rejected as closed
```

**AC-P03-S7-05 Non-ACTIVE Assignment rejects a new visit**

```gherkin
Given the matching BoothAssignment is RELEASED CANCELLED or ENDED
When the Participant scans its former QR
Then no EventRegistration BoothVisit or reward is created
And any earlier valid visit history remains unchanged
```

**AC-P03-S7-06 First valid scan commits the complete reward outcome**

```gherkin
Given no BoothVisit exists for the Participant EventRegistration and BoothAssignment
And the Event and Assignment are eligible
When the Participant scans successfully
Then one BoothVisit is stored with backend visitedAt
And one PointTransaction stores 10 Points
And the response returns awarded Points and the new ledger-derived total
```

**AC-P03-S7-07 Auto-registration and reward are one transaction**

```gherkin
Given the scan must create or reactivate EventRegistration
When a later BoothVisit Point Badge or Notification step fails
Then the registration transition and all scan mutations roll back
And retry starts from one consistent pre-scan state
```

**AC-P03-S7-08 Cross-Event relationship mismatch is rejected**

```gherkin
Given resolved registration Assignment configuration and Event facts do not describe one Event
When reward processing revalidates relationships
Then the command is rejected as inconsistent
And no row is repaired or partially committed from client input
```

**AC-P03-S7-09 Duplicate valid-window scan is idempotent**

```gherkin
Given the Participant already has a rewarded BoothVisit for the Assignment
And the QR is still inside its valid Event window
When the same QR is scanned again
Then the existing visit and PointTransaction are returned with alreadyVisited true
And total Points remain unchanged
And no UserBadge or Notification is duplicated
```

**AC-P03-S7-10 Expired QR does not act as a history endpoint**

```gherkin
Given the Participant validly visited the Booth earlier
And the Assignment or Event is no longer eligible
When the old QR is scanned again
Then the scan is rejected under current lifecycle rules
And the prior visit remains visible only through owned reward history
And no new reward is created
```

**AC-P03-S7-11 Concurrent duplicate scans converge**

```gherkin
Given the same Participant submits the same valid Booth QR concurrently
When all requests complete
Then exactly one BoothVisit exists for the registration and Assignment
And exactly one PointTransaction exists for that BoothVisit
And each eligible Badge and unlock Notification exists at most once
And successful retries return the same achieved identities
```

**AC-P03-S7-12 Point amount is server-owned and historically stable**

```gherkin
Given rewards.booth-visit-points is the approved positive value 10
When a first valid visit is processed
Then PointTransaction stores 10 regardless of client payload
And a later server configuration change does not rewrite that stored amount
```

**AC-P03-S7-13 Points accumulate across Events**

```gherkin
Given the Participant has valid rewarded visits in more than one Event
When total Points is requested
Then the total equals the sum of all owned PointTransactions across Events
And completing or leaving one Event does not reset or subtract those Points
```

**AC-P03-S7-14 One scan may unlock multiple active Badges**

```gherkin
Given one 10-Point visit raises total Points across multiple active Badge thresholds
When reward evaluation runs
Then every newly eligible Badge creates one UserBadge
And previously earned or inactive Badges are not inserted again
And all awards commit with the visit or the transaction rolls back
```

**AC-P03-S7-15 Each new UserBadge creates one unlock Notification**

```gherkin
Given reward evaluation creates a new UserBadge
When the transaction commits
Then one BADGE_UNLOCKED Notification belongs to the same User
And its deduplication identity is derived from stable UserBadge identity
And it contains Badge display context but no QR token
And it initially appears unread in the existing owner inbox and unread count
And existing mark-one-read and mark-all-read behavior applies
And exact retry creates no second Notification
```

**AC-P03-S7-16 Notification failure cannot leave a silent new Badge**

```gherkin
Given a first scan would create a UserBadge
When persistence of its required BADGE_UNLOCKED Notification fails
Then that UserBadge and the first-scan transaction roll back
And no partial Point or visit outcome is reported as successful
```

**AC-P03-S7-17 Rewards summary and history use durable data**

```gherkin
Given the Participant has PointTransactions and UserBadges
When the Rewards view loads
Then total Points is ledger-derived
And Point history is paginated in stable newest-first order
And earned Badges include earnedAt
And no placeholder Point or Badge is fabricated
```

**AC-P03-S7-18 Badge progress includes only active unearned Badges**

```gherkin
Given active and inactive Badge definitions exist
And the Participant has earned some of them
When Badge progress is requested
Then active unearned Badges show their threshold and remaining progress
And inactive unearned Badges are omitted
And earned Badges remain visible even if their definitions are now inactive
```

**AC-P03-S7-19 Reward data is owner-only**

```gherkin
Given two Participants have different reward histories
When one Participant requests summary ledger Badge or unlock Notification data
Then only the authenticated Participant's records are returned
And a foreign private identity is concealed
```

**AC-P03-S7-20 Raw Booth QR tokens never enter reward output or logs**

```gherkin
Given a Booth scan succeeds or fails
When responses Notifications application logs and analytics are inspected
Then none contains the full raw BoothAssignment QR token
And the frontend route keeps the token in a URI fragment or equivalent client-only state
And the authenticated backend scan receives it in a redacted HTTPS request body
And authorized Partner QR retrieval remains a separate protected capability
```

## 5. UC-O07 Monitor Participation — Sprint 7 BoothVisit slice

### Goal

Let the owning Organizer inspect real BoothVisit outcomes for one Event without exposing raw QR
tokens or expanding into the full UC-O08 analytics module.

### Primary actor

Verified Organizer who owns the Event.

### Preconditions

- Organizer has an authenticated Session and owns the selected Event.

### Main flow

1. Organizer selects an owned Event.
2. System returns total rewarded Booth visits for that Event.
3. System returns visit counts grouped by BoothAssignment/Booth.
4. Organizer filters by Booth and searches supported Participant display fields.
5. System returns paginated durable visit rows in stable order.

### Alternate and exception flows

- Foreign Event: ownership-safe not found.
- Event has no visits: successful zero summary and empty page.
- Assignment was later released/cancelled/ended: historical visit remains attributed to its Booth.
- Invalid filter/page/sort: validation failure without fallback to unbounded data.

### Postconditions

- Monitoring is read-only.
- No QR token or another Organizer's participation data is disclosed.

### Acceptance Criteria

**AC-O07-S7-01 Monitoring is Event-owner scoped**

```gherkin
Given BoothVisits exist in Events owned by different Organizers
When one Organizer opens Booth visit monitoring
Then only visits from that Organizer's selected Event are returned
And a foreign Event or private visit is concealed
```

**AC-O07-S7-02 Event summary counts rewarded visits once**

```gherkin
Given an owned Event has first visits and duplicate scan attempts
When Organizer requests the Event BoothVisit summary
Then total visits counts durable unique BoothVisit rows
And duplicate attempts do not increase the count
```

**AC-O07-S7-03 Grouping preserves historical Assignment context**

```gherkin
Given visits were recorded for multiple BoothAssignments
And one Assignment later became non-ACTIVE
When Organizer views Booth grouping
Then each visit remains grouped under its historical Assignment and Booth context
And current Assignment status is distinguishable from visit validity at visitedAt
```

**AC-O07-S7-04 Visit records are real paginated data**

```gherkin
Given an owned Event has more visit rows than one page
When Organizer filters searches sorts or changes page
Then results and total come from durable BoothVisit relationships
And default order is visitedAt then BoothVisit identity descending
And no placeholder row is returned
```

**AC-O07-S7-05 Empty Event monitoring succeeds**

```gherkin
Given the Organizer owns an Event with no BoothVisit
When monitoring loads
Then total visits is zero
And Booth grouping and visit page are empty successful results
```

**AC-O07-S7-06 Monitoring never exposes reward secrets**

```gherkin
Given Organizer is authorized to view visit operations
When summary grouping or records are returned
Then no raw Booth QR token is present
And no unrelated Point ledger UserBadge or Notification content is exposed
```

## 6. UC-A03 Manage Badges

### Goal

Let System Admin manage the global Badge catalog and synchronize threshold awards without editing
Participant Points or deleting earned history.

### Primary actor

Authenticated System Admin.

### Preconditions

- Badge mutations require ADMIN authority and CSRF protection.

### Main flows

#### A. View Badge catalog

1. Admin opens the Badge catalog.
2. System returns paginated Badge definitions with active state and threshold.
3. Admin searches by supported normalized name and filters by active state.

#### B. Create Badge

1. Admin enters normalized nonblank unique `name`, positive `requiredPoints`, optional
   `description`, optional `iconUrl` and requested `isActive` state.
2. Admin chooses active or inactive state.
3. System stores one Badge.
4. If active, System schedules the shared bounded backfill processor only after Badge creation
   commits.

#### C. Update or activate/deactivate Badge

1. Admin updates `name`, `description`, `iconUrl`, `requiredPoints` or `isActive`.
2. System validates uniqueness and threshold.
3. Creating an active Badge, lowering an active threshold or reactivating a Badge triggers
   eligibility backfill.
4. Raising a threshold or deactivating a Badge applies prospectively and never revokes history.

#### D. Backfill eligible Users

1. System selects at most 100 eligible Users in stable User order per batch.
2. For each User missing the Badge, System derives total Points from the ledger.
3. System creates one UserBadge and one `BADGE_UNLOCKED` Notification atomically.
4. Each batch commits separately and produces processed, awarded and remaining-eligible counts.
5. The after-commit processor automatically continues successive batches until remaining
   eligibility reaches zero or one batch fails.
6. Admin can explicitly invoke the same idempotent synchronization command; it returns those batch
   counts and resumes processing after interruption.

### Alternate and exception flows

- Non-Admin access: forbidden without revealing mutation details.
- Blank/duplicate normalized name, non-positive threshold, invalid description or invalid icon URL:
  validation or stable conflict; no Badge mutation/backfill starts.
- Inactive Badge creation: store it but do not award it.
- Backfill batch failure: completed User batches remain valid; failed batch rolls back and may be
  retried idempotently.
- Badge deletion, manual Point edits and manual UserBadge grant/revoke: unsupported in Sprint 7.

### Postconditions

- Badge catalog retains stable identity and audit timestamps.
- Existing UserBadge history is never removed by catalog edits.
- Every newly backfilled UserBadge has one owner Notification.

### Acceptance Criteria

**AC-A03-01 Badge catalog and mutation are Admin-scoped**

```gherkin
Given an authenticated User lacks ADMIN authority
When Badge catalog mutation or backfill is requested
Then access is denied
And no Badge UserBadge or Notification changes
```

**AC-A03-02 Admin catalog is searchable filterable and paginated**

```gherkin
Given active and inactive Badge definitions exist
When Admin searches filters sorts or pages the catalog
Then matching durable Badge definitions and total count are returned
And no placeholder rule from frontend state is fabricated
```

**AC-A03-03 Valid Badge creation stores one definition**

```gherkin
Given Admin supplies a unique normalized name and positive requiredPoints
And optional description and iconUrl satisfy their approved bounds
When Badge creation succeeds
Then one Badge with stable identity and audit timestamps is stored
And its requested active state is preserved
And code nameEn perks and iconType are not persisted Sprint 7 Badge fields
```

**AC-A03-04 Invalid or duplicate Badge definition is rejected**

```gherkin
Given a Badge name is blank or duplicates another name after trim and case normalization
Or requiredPoints is not positive
Or description or iconUrl violates the approved API bounds
When Admin submits the mutation
Then validation or a stable uniqueness conflict is returned
And no Badge or backfill side effect commits
```

**AC-A03-05 Creating an active Badge backfills eligible Users**

```gherkin
Given existing Users have ledger totals at or above a new Badge threshold
When Admin creates that Badge as active and eligibility synchronization runs
Then every eligible User receives the missing UserBadge
And each new UserBadge receives one BADGE_UNLOCKED Notification
And ineligible Users receive neither
```

**AC-A03-06 Creating an inactive Badge does not award it**

```gherkin
Given existing Users already exceed a new Badge threshold
When Admin creates the Badge as inactive
Then the Badge is stored for Admin management
But no UserBadge or BADGE_UNLOCKED Notification is created
```

**AC-A03-07 Lowering an active threshold backfills newly eligible Users**

```gherkin
Given an active Badge threshold is lowered
And some Users become newly eligible under the lower threshold
When eligibility synchronization runs
Then those Users receive the missing UserBadge and Notification once
And Users who already earned it are unchanged
```

**AC-A03-08 Reactivating a Badge backfills current eligibility**

```gherkin
Given a Badge is inactive and some Users meet its threshold without owning it
When Admin reactivates the Badge and synchronization runs
Then currently eligible missing UserBadges and Notifications are created once
And prior earned history is not recreated
```

**AC-A03-09 Raising threshold never revokes earned history**

```gherkin
Given Users earned a Badge under its earlier threshold
When Admin raises requiredPoints
Then existing UserBadge and earnedAt values remain unchanged
And the new threshold applies only to Users who have not earned it
```

**AC-A03-10 Deactivation stops future awards without deleting history**

```gherkin
Given active and earned instances of a Badge exist
When Admin deactivates the Badge
Then future scan evaluation does not award that Badge
And existing UserBadges and unlock Notifications remain visible to their owners
```

**AC-A03-11 Backfill is bounded retry-safe and notification-idempotent**

```gherkin
Given many Users are eligible for a Badge
When synchronization runs in batches of at most 100 Users and one batch fails
Then the failed batch commits no partial UserBadge without Notification
And completed batches remain valid
And the command reports processed awarded and remaining-eligible counts
And an Admin retry creates only missing UserBadge and Notification identities
And a concurrent scan and backfill converge on one UserBadge and one Notification
And a concurrent Badge mutation is ordered by the locked current Badge rule
And eventually all eligible Users are synchronized once
```

**AC-A03-12 Badge management cannot edit Participant ledger or awards manually**

```gherkin
Given Admin manages the Badge catalog
When the Sprint 7 capability is inspected
Then there is no Badge hard-delete flow
And no manual Point grant deduction transfer or reset
And no manual UserBadge grant revoke
And no generic System Settings dependency is introduced
```

## 7. Required Notification transition

Sprint 7 adds exactly one durable Notification type to the completed Sprint 6 inbox:

```text
BADGE_UNLOCKED
```

Every `BADGE_UNLOCKED` Notification:

- belongs to exactly the User owning the new UserBadge;
- references the Badge/UserBadge context approved by the API/schema contract;
- uses a stable UserBadge-derived deduplication key;
- is stored atomically with that UserBadge, whether awarded by scan or backfill;
- contains a server-owned title/message snapshot without a raw QR token;
- participates in the existing owner-only list, unread count, mark-one-read and mark-all-read flows;
- is not revoked when the Badge is later deactivated or its threshold increases;
- does not require email, push, broadcast, preference or composer behavior.

The API/schema contract must extend the existing Notification reference CHECK without weakening the
five Sprint 6 types or their owner/deduplication guarantees.

## 8. API contract conformance checklist

The API contract must map, without weakening, all of these outcomes:

- authentication required, CSRF failure and role/authority mismatch;
- ownership-safe not found for private Participant/Organizer resources;
- malformed/unknown Booth QR token and raw-token secrecy;
- client-only QR token route state and redacted HTTPS request-body transport;
- Event window not open/closed with exact inclusive/exclusive boundaries;
- Assignment not ACTIVE;
- Event/Assignment/EventRegistration relationship inconsistency;
- EventRegistration create/reactivate/reuse result;
- first rewarded visit versus already-visited success;
- concurrent duplicate scan convergence;
- fixed 10-Point snapshot and ledger-derived cumulative total;
- zero, one or multiple newly unlocked Badges;
- `BADGE_UNLOCKED` Notification identity and transaction rollback;
- Participant summary, ledger and Badge progress pagination;
- Organizer Event ownership, summary, Booth grouping and paginated visits;
- Badge normalized-name uniqueness, positive threshold and active state;
- after-commit backfill trigger, maximum 100-User batch, progress counts, Admin resume/retry
  semantics and eventual completion;
- historical earned Badge behavior after deactivation/threshold increase.

The API Contract must not introduce Event QR, Participant-specific QR, Attendance changes, Point
redemption, manual Point/UserBadge editing, generic System Settings or a broad reporting module.

## 9. Acceptance Criteria audit

- `UC-P01` Sprint 7 slice: 3 Acceptance Criteria.
- `UC-P03` Sprint 7 slice: 20 Acceptance Criteria.
- `UC-O07` Sprint 7 slice: 6 Acceptance Criteria.
- `UC-A03`: 12 Acceptance Criteria.

Total: **41 Sprint 7 Acceptance Criteria**.

Approved review gate confirmed on 2026-10-28:

- verify all 41 IDs are unique;
- confirm every alternative/exception flow maps to at least one Acceptance Criterion or shared
  invariant;
- confirm API Contract error outcomes preserve these boundaries;
- confirm V12 schema supports transaction and deduplication requirements;
- confirm three-developer ownership avoids parallel edits to the scan transaction and Badge
  backfill core.
