# Sprint 06 Participant Activity Registration and Attendance

**QR window amendment (2026-10-26):** The Organizer Activity create/update API accepts optional `attendanceEarlyScanMinutes` (integer 0–1440), defaulting to 15 when omitted or null. The Attendance scan and correction window uses the stored value. Changes after the first `VALID` Attendance are rejected. Flyway V11 adds the Activity column. References to an early 15-minute window in default-case examples remain examples of the default.

**Notification inbox amendment (2026-10-27):** The Project Owner approved owner-only bulk
mark-read through `POST /participant/notifications/read-all`. It supplements mark-one-read,
updates only the authenticated Participant's unread rows with one backend timestamp and is
idempotent on retry. It does not add notification composition, broadcast or cross-role inbox scope.

> Status: `COMPLETED` on 2026-10-28. API paths,
> request/response schemas, all 65 Acceptance Criteria and developer ownership are frozen in the
> linked Sprint 6 Use Case Specification, API Contract and Backend Work Assignment.
>
> Audit: cross-checked on 2026-10-19 against the current Business Rules, Use Case List, Logical and
> Physical ERD, Sprint 5 contracts and existing Participant/Organizer frontend. Findings that need
> a source-document or schema amendment are declared in sections 4, 15, 18 and 20 rather than
> silently treated as implemented behavior.

## 1. Purpose

Sprint 6 connects the Activity planning delivered in Sprint 5 to the Participant journey:

1. Participant joins or leaves an Event and views My Events.
2. Participant registers for a capacity-controlled Activity or cancels before it starts.
3. Participant self-scans the shared Activity QR during a valid time window.
4. The backend records one idempotent Attendance or later classifies an unfulfilled registration
   as No-show.
5. Organizer monitors registrations and corrects Attendance only through an audited workflow.
6. Affected Participants receive durable in-app notifications for participation-impacting changes.
7. The system issues an eligible Certificate after Activity completion.
8. An attended Participant rates the completed Activity once, with later edits applied to the same
   rating record.

The Sprint delivers the Activity participation slice of the Participant module. It does not pull
the separate BoothVisit/Points/Badge reward flow into the same migration and transaction boundary.

## 2. Included Use Case slices

| ID | Use Case | Sprint 6 delivery |
|---|---|---|
| UC-G01 | Explore Book Street | Close the missing public Activity list/detail implementation required before registration |
| UC-P01 | Manage Event Participation | Join, leave and list My Events; auto-create EventRegistration when Activity registration requires it; receive the Event-impact notifications defined by this Sprint |
| UC-P02 | Manage Activity Registrations | Register, cancel, re-register and view capacity/status with schedule-overlap warning |
| UC-P03 | Track Participation | Activity-registration, self-scan Attendance, participation-impact notification and Certificate slice only |
| UC-P04 | Rate Activity | Create or update one verified rating after valid Attendance and Activity completion |
| UC-O01 | Manage Events | Apply the Participant external-participation freeze to Event updates and cascade/notify on eligible Event cancellation |
| UC-O06 | Manage Activities | Enforce registration/Attendance guards and Participant cascade/notification on Activity change, cancellation and completion |
| UC-O07 | Monitor Participation | Monitor Event/Activity registrations, No-show and audited Attendance correction |

`UC-P01` and `UC-P03` remain umbrella Use Cases. This Sprint delivers only the slices stated above;
it does not silently claim the general Event-announcement composer, BoothVisit, Points or Badge.

## 3. Scope lock

### 3.1 In scope

- Close the Sprint 5 public Activity discovery contract gap before registration work depends on it.
- Durable EventRegistration and ActivityRegistration persistence.
- My Events and My Activity registrations.
- Direct Join/Leave Event and Activity-registration auto-join.
- Capacity-safe Activity registration under concurrent requests.
- Participant cancellation before Activity start and safe seat release.
- Re-registration of a Participant-cancelled registration when eligibility is revalidated.
- Schedule-overlap warning without blocking registration.
- Shared Activity QR self-scan by the authenticated Participant.
- Idempotent Attendance creation and No-show classification.
- Organizer registration/Attendance monitoring for owned Events.
- Append-only Organizer Attendance correction audit.
- Automatic Certificate record issuance and revocation rules.
- Verified Activity Rating with one current record per Attendance.
- Durable Participant in-app notifications for approved Activity schedule/Location changes,
  Activity/Event cancellation and Certificate issue/revocation, including read/unread behavior.
- Participant-facing and Organizer-facing frontend integration for this scope.
- Authorization, ownership, privacy, validation, lifecycle, concurrency and integration tests.

### 3.2 Out of scope

- BoothAssignment QR scan, BoothVisit, PointTransaction, Badge and UserBadge.
- Paid Activity tickets, waitlist, seat selection or ticket transfer.
- Event entrance ticket or Event-level QR.
- Attendance Operator role, staff scanning Participant QR, check-out or attendance duration.
- Face recognition, GPS/geofencing or device fingerprinting for Attendance.
- Legal digital signature, blockchain verification or advanced Certificate designer.
- Advanced participation analytics beyond data needed by the included Organizer screens.
- A generic cross-domain Notification center, Organizer broadcast composer, SMS/push delivery and
  transactional message outbox. Sprint 6 includes only the Activity-participation notification
  slice defined in section 11; verified email remains an optional post-commit delivery channel.
- Booth/Activity rewards and cross-Event loyalty progression.

## 4. Resolved prerequisite debt

Sprint 5 documentation defines public Activity APIs as:

```text
GET /api/v1/activities
GET /api/v1/activities/{activityId}
```

At Sprint activation, the backend had no corresponding public Activity controller while the
frontend called `/api/v1/public/activities`. Sprint 6 resolved that mismatch by implementing the
documented canonical contract and pointing the frontend to the same paths.

The pre-Sprint Participant QR screen modeled the opposite flow: it gave a Participant-specific QR
to present to staff. It was replaced with the approved Activity-owned QR flow displayed at the
venue and scanned by the authenticated Participant.

The pre-Sprint My Events screen generated a synthetic Event QR even though the approved rules define
no Event ticket/QR; that behavior was removed. Participant Notification calls were aligned with the
implemented reviewed contract instead of retaining phantom endpoints.

## 5. Domain baseline

### 5.1 EventRegistration

EventRegistration records that one authenticated User follows/participates in one Event. It does
not reserve an Activity seat and never produces an Event QR.

Statuses:

```text
ACTIVE
LEFT
```

Rules:

- One record per `(userId, eventId)`.
- Direct Join is allowed only for an eligible public Event and within the Event participant
  registration deadline.
- Equality at the deadline is accepted; only `now > deadline` is closed.
- Registering an eligible Activity auto-creates or reactivates EventRegistration if one does not
  exist, but it still respects the Event participant-registration deadline in addition to the
  Activity-specific deadline.
- Leave changes `ACTIVE -> LEFT`; it does not delete history.
- Leave is blocked while the Event has any seat-active ActivityRegistration for that Participant,
  using the definition in section 5.2. A completed historical registration does not block Leave
  forever merely because its stored status remains `ACTIVE` beside a valid Attendance.
- Rejoin reuses the same row and is allowed when the direct Join rule is still satisfied.
- Existing historical Activity registrations, Attendance, ratings and certificates remain linked
  after EventRegistration becomes `LEFT`.

### 5.2 ActivityRegistration

ActivityRegistration is the capacity-controlled reservation for one Activity.

Statuses:

```text
ACTIVE
CANCELLED
NO_SHOW
```

Cancellation sources:

```text
PARTICIPANT
ACTIVITY
EVENT
```

One row is retained per `(eventRegistrationId, activityId)`. The UI derives "Đã tham dự" from a
valid Attendance, rather than duplicating `ATTENDED` as an ActivityRegistration status.

`ACTIVE` is the durable registration status, while **seat-active** is an operational predicate:

```text
registration.status = ACTIVE
AND activity.status IN (PUBLISHED, ONGOING)
```

Seat-active registrations occupy capacity and block Leave Event. A completed Activity no longer
has an operational seat to hold; its historical `ACTIVE` row remains paired with valid Attendance,
or is changed to `NO_SHOW` when Attendance is absent.

When one row has more than one historical fact, UI/API outcome precedence is explicit:

1. Activity/Event cancellation is the primary state; a pre-cancellation valid Attendance is shown
   as secondary history (for example, "Đã hủy · đã ghi nhận tham dự trước khi hủy").
2. Otherwise valid Attendance means Attended.
3. Otherwise `NO_SHOW` means No-show.
4. Otherwise `CANCELLED/PARTICIPANT` means Participant-cancelled.
5. Otherwise the registration is Upcoming/Ongoing according to the Activity lifecycle.

### 5.3 Registration lifecycle

```text
                         Participant cancel
                    ┌────────────────────────> CANCELLED
                    │                              │
create/reactivate ──┴──> ACTIVE                    │ eligible re-register
                         │                         │
                         ├── valid self-scan ──────┼──> valid Attendance
                         │                         │
                         └── Activity completes ───┴──> NO_SHOW (when no valid Attendance)
```

- Registration requires `registrationRequired=true`, Activity `PUBLISHED`, an eligible parent
  Event, backend time not after both the Event participant-registration deadline and the
  Activity-specific `registrationDeadlineAt`, and available capacity. The effective cutoff is the
  earlier of those two deadlines; an Activity deadline never extends the Event-wide cutoff.
- Capacity counts seat-active registrations only. Registration is accepted only for `PUBLISHED`,
  so this is equivalent to counting its `ACTIVE` rows while the Activity can accept a new seat.
- Registration locks the authoritative Activity row before counting capacity and inserting or
  reactivating the Participant record.
- Registration returns a schedule-overlap warning when another active Participant registration
  overlaps; the warning does not block the command.
- There is no waitlist. A full Activity returns conflict and does not create a placeholder row.
- Participant cancellation is accepted only while registration is `ACTIVE`, no valid Attendance
  exists and `now < activity.startAt`.
- `registrationDeadlineAt` prevents acquiring a seat; it does not prevent returning a seat.
- At or after `startAt`, Participant self-cancellation is closed so it cannot be used to avoid
  No-show classification.
- Re-registration is allowed only when the previous cancellation source is `PARTICIPANT`, all
  current eligibility checks pass and capacity remains available.
- Re-registration reuses the unique row and records the latest successful activation time. It
  never creates a second current reservation.
- Cancellation and re-registration commands are idempotent only for an exact retry that requests
  the already-achieved state; incompatible terminal/lifecycle commands return conflict.

## 6. Attendance baseline

### 6.1 QR ownership and scan direction

- One opaque `attendanceQrToken` belongs to the Activity and is created once at first publish when
  registration is required.
- The raw token is visible only to an authorized Organizer for display at the venue.
- Public Activity responses and Participant registration responses never expose the raw token.
- Application/server logs must not record the raw token or a complete token-bearing scan URL.
- The displayed QR encodes an application scan URL containing the opaque token, not a trusted
  Activity ID or Participant identity.
- Participant must be authenticated. The backend resolves User identity from the Session and never
  accepts a User ID supplied by the scan client.
- No Participant-specific Attendance QR is generated.

### 6.2 Valid self-scan window

The implemented Sprint 6 policy is one backend-owned window per Activity:

```text
[activity.startAt - attendanceEarlyScanMinutes minutes, activity.endAt)
```

- Equality at the opening boundary is accepted; the closing boundary is exclusive.
- Before the lower boundary returns `ATTENDANCE_WINDOW_NOT_OPEN`.
- At or after `endAt` returns `ATTENDANCE_WINDOW_CLOSED`.
- The backend clock is authoritative.
- The Activity may still be `PUBLISHED` during the configured early window or `ONGOING` after its
  start. `DRAFT`, `COMPLETED` and `CANCELLED` reject a new self-scan.
- The Event and ActivityRegistration must still be effective and the token must match exactly.

The early-window duration is stored in `activities.attendance_early_scan_minutes`, defaults to 15,
accepts 0–1440 and is never decided by the frontend. Organizer changes are rejected after the first
valid Attendance.

### 6.3 Attendance and duplicate scans

Attendance statuses:

```text
VALID
VOIDED
```

- One Attendance row at most per ActivityRegistration.
- A first valid scan creates `VALID` Attendance with `attendedAt` and `createdAt`.
- A repeated scan of an already valid Attendance returns the existing record with
  `alreadyRecorded=true`; it does not create duplicates or return a misleading failure.
- `CANCELLED` or `NO_SHOW` registration cannot self-scan.
- Activity/Event cancellation closes new scans but does not delete a valid historical Attendance.
- Attendance does not represent check-out or participation duration.

### 6.4 No-show processing

When the Activity advances to `COMPLETED`, an idempotent backend process changes every remaining
`ACTIVE` registration without valid Attendance to `NO_SHOW`.

- No-show is never decided by frontend time.
- Existing `CANCELLED` registrations remain Cancelled.
- A valid Attendance remains the authoritative proof of participation.
- Lifecycle retry must not rewrite timestamps or create duplicate downstream records.
- An authorized Organizer correction may later change the effective outcome with a required audit
  reason.

The Activity transition, No-show classification, eligible Certificate metadata and corresponding
in-app notifications form one completion-finalization transaction under the Event/Activity lock.
Request-time guard and scheduler retry the same idempotent command. Optional PDF rendering and
email remain after-commit work and cannot leave completion half-applied.

## 7. Organizer monitoring and correction

Organizer may list registrations and Attendance only for owned Events. Search/filter/pagination
must distinguish Active, Cancelled, Attended and No-show without exposing another Organizer's
Participant data.

Correction is not a direct unchecked update. Sprint 6 introduces an append-only technical audit,
`attendance_adjustments`, containing at minimum:

- ActivityRegistration reference;
- previous and new effective outcome;
- Organizer User reference;
- normalized reason;
- effective attendance time where an Attendance is being added;
- adjustment timestamp.

Rules:

- Reason is required, trimmed/collapsed and 10–500 characters.
- Organizer must own the parent Event.
- `NO_SHOW` cannot be assigned manually or automatically before the Activity reaches `COMPLETED`.
- Correcting an eligible `ACTIVE` or `NO_SHOW` registration to Attended creates or restores
  `VALID` Attendance and changes the registration to `ACTIVE`. The effective `attendedAt` must be
  within `[activity.startAt - attendanceEarlyScanMinutes minutes, activity.endAt)`. The valid Attendance, not the word
  Active, is what the UI presents as attended.
- Voiding an Attendance does not always imply No-show. Before Activity completion, the registration
  returns to `ACTIVE`; after completion, it becomes `NO_SHOW`; after Activity/Event cancellation,
  it remains `CANCELLED` and retains its cancellation source.
- A cancelled Activity never permits creating Attendance for a previously unscanned registration.
  An Organizer may only restore or void an Attendance that already existed before cancellation,
  preserving the historical participation record.
- For manual attendance creation, Organizer supplies the actual/effective `attendedAt`; `createdAt`
  remains the time the correction was processed.
- Exact retry returns the existing effective result and does not append duplicate adjustments.
- Voiding Attendance revokes an issued Certificate and invalidates its Rating in the same domain
  transaction.
- Restoring Attendance after Activity completion triggers idempotent Certificate eligibility
  processing again.
- There is no Attendance Operator role and no hidden staff-only Participant QR workflow.

`attendance_adjustments` is an audit table comparable to ActivityRevision, not a new Actor-facing
Use Case or role.

## 8. Event/Activity change and cancellation impact

### 8.1 Approved Activity schedule/Location change

- Existing Activity registrations remain `ACTIVE`; no reconfirmation state is introduced.
- Each affected Participant receives the durable in-app notification defined in section 11;
  verified email is an optional after-commit delivery attempt. Authoritative changed data appears
  in My Activities.
- Schedule-overlap warning is recalculated against the new interval.
- An overlap never auto-cancels a registration because the approved rule warns but does not block.
- Participant may cancel against the new `startAt`.
- Attendance scan uses the new schedule and the existing Activity QR token.
- Schedule or Location change is rejected after the first valid Attendance exists, even when the
  Activity is technically still `PUBLISHED` inside the configured early-scan window. Change approval
  and scan serialize on the same Event/Activity lock, so whichever commits first determines whether
  the scan uses the new schedule or the change is rejected.
- A change moving start earlier must still satisfy Activity registration configuration, including
  `registrationDeadlineAt <= new startAt`.
- A capacity change is rejected when the requested capacity is below the current seat-active count.
  The approval/update command must lock the Activity and count registrations in the same
  transaction so it cannot race with a final-seat registration.

### 8.2 Activity/Event cancellation

The cancellation transaction:

1. changes affected `ACTIVE` Activity registrations to `CANCELLED`;
2. records `cancellationSource=ACTIVITY` or `EVENT` and cancellation time;
3. preserves existing Attendance and downstream history;
4. closes new registration and QR scan attempts;
5. persists one deduplicated in-app notification for each affected Participant in the same domain
   transaction;
6. schedules optional verified-email delivery only after commit.

Participant-cancelled records retain source `PARTICIPANT`. No cancellation path hard-deletes a
registration. Activity cancellation notifies Participants whose ActivityRegistration was affected;
Event cancellation also notifies every User with an `ACTIVE` EventRegistration, including a direct
Event joiner who has no ActivityRegistration.

## 9. Certificate baseline

Certificate statuses:

```text
ISSUED
REVOKED
```

Eligibility requires all of the following:

- Activity is `COMPLETED`;
- Activity has `certificateEnabled=true`;
- Attendance is `VALID`;
- no Certificate already exists for that Attendance.

The system automatically creates the durable Certificate record through an idempotent completion
processor. Unique Attendance and Certificate code constraints are the final duplicate guards.

Certificate record issuance and visual file rendering are separate:

- metadata, recipient-name snapshot, unique verification code, status and `issuedAt` are created
  automatically;
- printable/PDF output may be rendered on first view/download, so Activity completion is not held
  open by bulk file generation;
- a late valid Organizer correction after Activity completion reruns eligibility;
- Attendance changed to `VOIDED` changes Certificate to `REVOKED` with `revokedAt` instead of
  deleting it;
- restoring valid Attendance may reissue the same Certificate identity and code without inserting
  a second row: status returns to `ISSUED`, `revokedAt` is cleared and the original identity,
  verification code and `issuedAt` remain stable.

The completion of an Activity must remain successful even if optional file rendering or email
delivery later fails.

## 10. Activity Rating baseline

ActivityRating statuses:

```text
ACTIVE
INVALIDATED
```

Rating is accepted only when:

- Activity is `COMPLETED`;
- Attendance belongs to the authenticated Participant and is `VALID`;
- score is an integer from 1 to 5.

Comment is optional, trimmed and limited to 1,000 characters. One Attendance has at most one
Rating. A later submission updates that record and `updatedAt` instead of inserting a second row.

Requiring Activity completion prevents a Participant from scanning at arrival and rating a program
that is still running. This is a deliberate refinement of the older broad statement that valid
Attendance "enables" rating.

If Attendance becomes `VOIDED`, the Rating is retained as `INVALIDATED` and excluded from public or
report aggregates. Restoring Attendance may reactivate the same Rating; no historical row is
deleted.

## 11. Participant notification baseline

Sprint 6 implements the narrow in-app notification slice required by Participant participation. It
does not depend on email because Participant email is optional.

Required notification types:

```text
ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED
ACTIVITY_CANCELLED
EVENT_CANCELLED
CERTIFICATE_ISSUED
CERTIFICATE_REVOKED
```

Rules:

- The recipient is the authenticated User behind an affected EventRegistration or
  ActivityRegistration; another User may never list or mark one/all of that User's notifications
  as read.
- Activity schedule/Location changes notify Participants with a seat-active registration for the
  Activity. Activity cancellation notifies Activity registrations affected by that transition;
  Event cancellation notifies every `ACTIVE` EventRegistration. Notification processing does not
  change a prior Participant-cancelled source.
- Certificate issue/revocation notification is created only when the Certificate actually changes
  state.
- The domain state change and in-app Notification are persisted atomically. Optional email is sent
  after commit and its failure does not roll back the domain transaction.
- An idempotent command or scheduler retry must not create a duplicate notification for the same
  business transition. The approved ERD/API contract defines a stable reference/deduplication key;
  identity is never inferred from mutable message text.
- Title/message are server-owned snapshots. A safe entity reference/link may be stored for
  navigation, but no raw QR token or private data is embedded in the message.
- Read/unread is Participant-owned presentation state and does not alter the underlying Activity,
  registration, Attendance or Certificate state. Bulk mark-read changes only the authenticated
  Participant's unread rows, preserves existing `readAt` values and converges to zero updates on
  retry.

General Organizer announcements, notification preferences, SMS/push and cross-domain inbox work
remain outside this Sprint.

## 12. Validation and authorization baseline

- All state-changing Participant APIs require a valid Session and Participant capability.
- A User may read and mutate only their own Event/Activity registrations, Attendance, Certificate,
  Rating and Notification read state.
- Organizer may monitor/correct only Events identified by `event.organizerUserId`.
- Ownership-safe lookup must not reveal another User's private record.
- Public Activity discovery never exposes Attendance QR token, registration identity, email,
  Certificate or Rating ownership.
- Backend uses `Instant`/authoritative `Clock`; UI displays `Asia/Ho_Chi_Minh`.
- Unknown JSON fields, malformed token/input, invalid status/filter/sort and field validation use
  the shared error-envelope policy.
- Registration and Attendance commands re-read lifecycle/deadline under lock; frontend state is
  never authoritative.
- CSRF protection applies to Session-authenticated mutation requests.

## 13. Concurrency and idempotency

### 13.1 Registration

Registration follows the existing Event-rooted lock policy and locks the Activity before capacity
is counted. Two requests competing for the final seat cannot both succeed.

The database must provide:

- unique `(user_id, event_id)` EventRegistration;
- unique `(event_registration_id, activity_id)` ActivityRegistration;
- indexes supporting active capacity count and My Activities queries.

A unique-race caused by direct Join and Activity auto-join resolves to the same EventRegistration,
not a generic 500.

Register, cancel, re-register and Leave commands use the same Event-to-Activity lock order. This
prevents a cancellation/registration race from releasing or consuming the final seat incorrectly,
and prevents Leave from racing past a newly active ActivityRegistration.

### 13.2 Attendance, Certificate and Rating

The database must provide:

- unique Attendance per ActivityRegistration;
- unique Certificate per Attendance and unique certificate code;
- unique ActivityRating per Attendance.

Duplicate scan, completion retry, correction retry, Certificate eligibility retry and Rating
update must converge on one durable record for each domain identity.

Activity completion and a final self-scan serialize on the same Event/Activity lock order. Because
the scan window ends at `endAt` exclusively, a request evaluated at or after that instant cannot
win by relying on stale frontend state.

Recommended mutation order:

```text
Event
  -> Location (only when the existing Activity flow requires it)
  -> Activity
  -> EventRegistration
  -> ActivityRegistration
  -> Attendance
  -> AttendanceAdjustment
  -> Certificate / ActivityRating
  -> Notification
```

The approved Physical ERD and API Contract reconcile this order with the existing Activity
lifecycle locks. Implementation must preserve that order.

## 14. Frontend target state

### 14.1 Public and Participant

- Public Event/Activity detail uses the canonical public Activity API.
- Registration CTA reflects login, Activity lifecycle, deadline, capacity and current Participant
  state without pretending frontend validation is authoritative.
- My Events and My Activities are separate concepts; one screen/title must not ambiguously present
  Activity cards as Event records.
- My Events does not render a synthetic Event ticket or Event QR.
- My Activities derives Upcoming/Ongoing, Attended, Cancelled and No-show from the backend outcome
  precedence in section 5.2; it does not flatten "cancelled after a valid Attendance" into two
  contradictory cards.
- Participant no longer receives or downloads a personal Attendance QR.
- Scan route accepts the shared Activity token, asks for login when required, submits once and
  presents a stable success/already-recorded/error result.
- Certificate view clearly distinguishes Issued and Revoked.
- Rating control appears only for an eligible completed Activity.
- The Participant notification popover uses real list/unread/mark-one/mark-all-read APIs and links
  back to the affected Activity/Event without exposing raw Attendance tokens.

### 14.2 Organizer

- Organizer Activity detail may display/download the shared Activity Attendance QR without leaking
  it through public APIs.
- Participation view lists real Event/Activity registration and Attendance data, not placeholder
  rows or phantom endpoints.
- Correction UI requires reason and explicit confirmation and shows the resulting audit history.
- Organizer UI does not scan a Participant ticket as the normal Attendance path.

Frontend refresh after one successful mutation must not depend on unrelated future APIs. For
example, Activity registration must not appear to fail because Badge or Certificate endpoints are
unavailable.

## 15. Schema direction

V1–V9 remain immutable. The implemented Sprint 6 `V10` migration adds or activates:

- `event_registrations`;
- `activity_registrations`, including cancellation source and timestamps;
- `attendances`, including effective validity status;
- `attendance_adjustments` as append-only correction audit;
- `certificates`;
- `activity_ratings`, including aggregate-validity status;
- `notifications`, activating the existing Physical ERD concept with a stable entity reference and
  deduplication identity for the Sprint 6 notification types.

The implemented V11 migration adds `activities.attendance_early_scan_minutes` with default 15 and
the approved 0–1440 database constraint.

The Physical ERD report and source diagram were approved on 19/10/2026. The source diagram has
the complete 34-table target, the `attendance_adjustments` audit table, the approved status/source
fields and a dedicated `04 - Participant & Attendance` detail page. The overview and Participant /
Attendance PNG assets were regenerated from that source in the same review step. V10 and V11 now
form the immutable implemented Sprint 6 schema baseline.

## 16. Required alternative and exception paths

The approved Use Case Specification and implementation tests cover at least:

- direct Join racing with Activity registration auto-join;
- Leave blocked by an active Activity registration;
- capacity final-seat race;
- exact deadline equality and just-after-deadline rejection;
- cancel just before start versus at start;
- re-register after Participant cancellation, full capacity and cancellation by Activity/Event;
- overlapping registration warning without rejection;
- QR before open, at open, during Activity, at end and after close;
- wrong/malformed token, unauthenticated scan and scan by unregistered Participant;
- duplicate/concurrent QR scans;
- Activity reschedule after registrations exist;
- first Attendance racing with a schedule/Location change during the early-scan window;
- capacity reduction below active registrations and capacity update racing with final-seat
  registration;
- Activity/Event cancellation racing with register/scan;
- Activity completion racing with final scan and No-show processing;
- exact retry and conflicting Organizer correction;
- correction before completion, after completion and after Activity/Event cancellation;
- certificate completion retry and late corrected Attendance;
- Attendance void cascading to Certificate and Rating state;
- Rating by non-attendee, before completion, invalid score and concurrent first submit;
- cross-Participant and cross-Organizer access attempts;
- notification deduplication, ownership, mark-read and optional email failure;
- optional email/rendering failure after the domain transaction commits.

## 17. Delivery order

Implementation is intentionally sequential:

1. **Foundation gate:** public Activity contract debt, reviewed ERD/statuses/notification overlay
   and one Sprint 6 migration owner.
2. **Flow A:** EventRegistration, ActivityRegistration and Participant notification foundation,
   then Participant Event/Activity screens.
3. **Flow B prerequisite:** merge only the internal Certificate/Rating/Notification cascade
   commands that Flow B needs for atomic completion and correction; Flow C actor APIs remain closed.
4. **Flow B:** self-scan Attendance, No-show, Organizer monitoring, audited correction and
   Activity/Event-impact notifications.
5. **Flow C:** Certificate, Certificate state notifications, Activity Rating and end-to-end
   frontend refinement.
6. **Closure:** concurrency/integration tests, Swagger/manual role flow, full regression and Sprint
   completion documentation.

Flow B must not invent Participant QR behavior. Only Flow C's internal downstream command boundary
may precede Flow B; Flow C actor/query APIs and screens wait until Attendance identity and correction
cascade are stable.

## 18. Documentation gate before code

The documentation gate was completed and approved in this order:

1. [x] Updates to source Business Rules, Use Case List and MVP scope for the approved
   scan window, completion-gated Rating, correction cascade, notification slice and lifecycle
   refinements introduced here.
2. [x] `sprint-06-use-case-specifications.md` with 65 traceable Acceptance Criteria.
3. [x] Updated Physical ERD report/diagram for the approved Sprint 6 overlay.
4. [x] `sprint-06-api-contract.md` with canonical endpoints, DTOs and error codes derived from the
   approved requirements, Use Cases and ERD.
5. [x] `SPRINT_06_BACKEND_WORK_ASSIGNMENT.md` with file ownership and dependency-safe merge order.
6. [x] Updated `CURRENT_SPRINT.md` after the full Sprint 6 documentation baseline review.

## 19. Definition of done baseline

Sprint 6 is complete because:

- canonical public Activity list/detail is implemented and frontend/backend paths agree;
- Participant can Join/Leave Event and register/cancel/re-register Activity through real APIs;
- concurrent registration cannot exceed capacity;
- Participant self-scan uses the shared Activity QR and duplicate scans are idempotent;
- No-show and Organizer correction are authoritative, audited and tested;
- Activity change/cancellation correctly affects existing registrations without deleting history;
- eligible Certificate issuance/revocation and Rating validity are implemented;
- required Participant in-app notifications are durable, deduplicated, ownership-safe and use real
  frontend/backend contracts;
- Participant and Organizer screens contain no placeholder participation data or reversed QR flow;
- ownership, privacy, validation, lifecycle races and alternative paths have automated coverage;
- clean migration, Hibernate validation, backend regression and frontend lint/build pass;
- Swagger/manual end-to-end evidence covers Participant and Organizer roles;
- a Sprint 6 completion report records exact delivered scope, test counts and remaining debt.

The completion evidence and AC-to-test traceability are recorded in
`docs/development/SPRINT_06_COMPLETION_REPORT.md`. The Use Case Specification and API Contract remain
the canonical behavior baseline.

## 20. Audit result and review gates

The review found no reason to discard the proposed Sprint 6 direction, but it found four material
gaps that are now explicit in this document:

1. Existing frontend QR behavior is reversed for Attendance and invents an Event QR forbidden by
   the approved baseline.
2. The pre-Sprint frontend called Participant Notification APIs that did not exist, while excluding
   durable Notification would have conflicted with the Participant module and optional-email model.
3. Attendance correction needs lifecycle-sensitive outcomes; voiding Attendance must not turn a
   cancellation into No-show or erase its source.
4. `ACTIVE` registration history must be distinguished from a seat-active reservation so completed
   attendance does not block Leave Event forever; capacity reduction also needs an atomic guard.

The following intentional refinements were approved in the source-of-truth documents before code:

- the exact Attendance window `[startAt - attendanceEarlyScanMinutes minutes, endAt)`;
- Activity Rating only after `COMPLETED`, not immediately after an early Attendance scan;
- durable in-app notification types and deduplication identity;
- ActivityRegistration cancellation sources/effective-outcome precedence;
- schedule/Location change freeze after the first valid Attendance;
- append-only `attendance_adjustments` and Certificate/Rating cascade semantics.

Section 18 is complete, no unresolved conflict with a higher-priority requirement remains, and
`CURRENT_SPRINT.md` activates this file as the implementation baseline. Any later semantic change
must update and re-review the affected source-of-truth documents before code changes.
