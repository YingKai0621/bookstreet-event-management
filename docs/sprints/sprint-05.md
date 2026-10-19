# Sprint 05 Activity Planning and Partner Proposal Workflow

> Status: `COMPLETED` on 2026-10-19 through PR `#56` (merge commit `759a25c`). This document is the
> delivered Activity baseline. V1–V8 remain immutable and the implementation introduced the single
> reviewed `V9__create_sprint5_activity_schema.sql` migration.

## 1. Purpose

Sprint 5 delivers the official Activity planning workflow for Book Street Events:

1. Organizer manages shared Activity Locations.
2. An approved Partner proposes an Activity without needing a Booth.
3. Organizer requests changes, rejects or atomically approves the Proposal into an official Draft
   Activity.
4. Organizer may also create Book Street activities directly at shared non-Booth Locations.
5. Organizer publishes and the backend advances Activity lifecycle from authoritative time.
6. Partner requests a controlled change or cancellation instead of editing official data directly.
7. Guest discovers public activities while private review information remains protected.

The Sprint closes Activity planning only. Participant registration, attendance, ratings and
certificates use the schema/contract prepared here but remain a later implementation Sprint.

## 2. Included Use Case slices

| ID | Use Case | Sprint 5 delivery |
|---|---|---|
| UC-E04 | Propose Activity | Submit, edit, resubmit, list, detail and withdraw Partner proposals |
| UC-E05 | Request Activity Change | Submit/list/detail/withdraw a change request for a Partner Activity |
| UC-E06 | Request Activity Cancellation | Submit/list/detail/withdraw a cancellation request with late flag |
| UC-O02 | Manage Locations | Manage shared STAGE/WORKSHOP/AREA Locations and expose eligible Partner choices |
| UC-O05 | Review Activity Proposals | Request changes, approve or reject without silently editing Proposal data |
| UC-O06 | Manage Activities | Create BTC Activity, configure Draft, publish, cancel and review Partner requests |
| UC-G01 | Discover Public Content | Public Activity list/detail with lifecycle-safe visibility |

## 3. Scope lock

### 3.1 In scope

- V9 Activity schema and constraints.
- Durable Activity revision audit for applied content/schedule/Location/config changes.
- Shared Location management for `STAGE`, `WORKSHOP`, `AREA`.
- Read-only eligible Location choices for Partner, including an owned `BOOTH` Assignment.
- ActivityProposal workflow and six-state lifecycle.
- Atomic Proposal approval into one official Activity `DRAFT`.
- Direct Organizer Activity at a shared non-Booth Location.
- Activity configuration, publication, cancellation and timed lifecycle.
- PostgreSQL cross-Event Location/time exclusion constraint.
- Partner ActivityChangeRequest and ActivityCancellationRequest workflows.
- Public Activity discovery/detail.
- Event cancellation/completion cascade for Activity records.
- Post-commit Partner representative email.
- Authorization, validation, concurrency, idempotency, migration and integration tests.

### 3.2 Out of scope

- Participant ActivityRegistration, Attendance scanning, rating and certificate issuance.
- Participant notifications; Sprint 5 sends only affected Partner representative email.
- Paid Activity/tickets, waitlist, seat map, equipment or staff scheduling.
- Organizer commandeering an assigned Booth for a direct BTC Activity.
- Partner direct edit of an official Activity.
- Proposal Draft autosave.
- In-app Notification table/UI and transactional outbox.
- Booth change/cancellation, business refund or whole-Event Partner withdrawal.
- Advanced map editor and Location hard-delete.

## 4. Domain baseline

### 4.1 Location and Booth ownership

Every Activity belongs to exactly one physical Location:

- `BOOTH`
- `STAGE`
- `WORKSHOP`
- `AREA`

Partner does not need a Booth to propose an Activity. Shared Locations are usable subject to active
state, capacity and schedule. A Partner may select `BOOTH` only when an `ACTIVE` BoothAssignment
belongs to that Partner and the same Event. This is rechecked at Proposal submit/resubmit and
approval.

Generic Location management creates only `STAGE`, `WORKSHOP` or `AREA`. Existing Booth management
owns the `BOOTH` subtype. Codes are trimmed, uppercased and unique case-insensitively.

Organizer direct BTC Activities use only shared non-Booth Locations in Sprint 5. They may be
prepared while the owned Event is `DRAFT` or `PUBLISHED`, or while `ONGOING` only when their start
is still in the future. An Activity at a Booth must originate from an approved Proposal of the
Partner that owns the Assignment.

### 4.2 Proposal lifecycle

```text
                         ┌──────────── request changes ────────────┐
                         v                                         │
create/resubmit ──> PENDING ──approve──> APPROVED                  │
                         ├─reject──> REJECTED                       │
                         ├─withdraw─> WITHDRAWN                     │
                         └─Event cancel─> CANCELLED                 │
                  NEED_CHANGES ──resubmit──> PENDING
                         ├─withdraw─> WITHDRAWN
                         └─Event cancel─> CANCELLED
```

- There is no saved Draft Proposal; successful creation immediately becomes `PENDING`.
- Initial submit requires Event `PUBLISHED`, approved Partner application and
  `now <= activityProposalDeadlineAt`.
- Partner may edit `PENDING` only through the same deadline.
- `NEED_CHANGES` may be revised/resubmitted after the general deadline while Event is
  `PUBLISHED`/`ONGOING` and backend time is before proposed start.
- Only `PENDING` is reviewable.
- `APPROVED`, `REJECTED`, `WITHDRAWN`, `CANCELLED` are terminal.
- Scheduler/request-time guard closes `PENDING`/`NEED_CHANGES` as `CANCELLED` when backend time
  reaches proposed start because the Proposal can no longer become a future Activity.
- Request-changes/reject require a normalized review note of 10–1,000 characters.
- Withdraw is idempotent for an already Withdrawn Proposal.

### 4.3 Approval boundary

Organizer may not alter Proposal data inside approve. Approval locks and rechecks all mutable
facts, then one transaction:

1. locks Event;
2. locks the selected Location; if a Booth, rechecks Assignment ownership;
3. locks/rechecks Proposal and Partner application;
4. checks future time, Event bounds, capacity, quota and conflict;
5. inserts exactly one Activity `DRAFT` copied from Proposal;
6. changes Proposal to `APPROVED` and records review metadata.

`activities.source_proposal_id` is unique. A repeated approve returns the already-created Activity
without consuming quota twice or sending duplicate email.

Proposal does not carry Participant registration configuration. Approval therefore creates the
Draft with `registrationRequired=false`, `registrationDeadlineAt=null`,
`isCertificateEnabled=false`, `attendanceQrToken=null` and `imageUrl=null`. Organizer may configure
these Activity-only presentation/registration fields while the Activity remains `DRAFT`; the
approved title/type/time/Location/capacity remain traceable to the Proposal and any Partner-driven
later change uses a Change Request.

### 4.4 Activity lifecycle

```text
DRAFT ──publish──> PUBLISHED ──start reached──> ONGOING ──end reached──> COMPLETED
  └──────────────────── eligible cancellation ────────────────────────> CANCELLED
                         └──── eligible cancellation ──────────────────> CANCELLED
                                             └── cancellation ────────> CANCELLED
```

- `COMPLETED` and `CANCELLED` are terminal.
- `RESCHEDULED` is not a persisted state; a reschedule is an audited Activity update.
- Every applied core/config change stores an immutable revision with actor/source, reason where
  required, old snapshot, new snapshot and timestamp.
- Draft never auto-publishes.
- Publish requires the parent Event to be `PUBLISHED` or `ONGOING` and Activity start to remain in
  the future; Activity under a Draft Event stays private.
- Scheduler and request-time guards use backend `Clock`, are idempotent and may catch an overdue
  `PUBLISHED` Activity directly up to `COMPLETED`.
- Activity exact time must remain inside Event time and start in the future at create/approve.
- Organizer can cancel a non-terminal Activity with a 10–500 character public-safe reason.
- Cancellation stores `cancelledAt`, `cancellationReason` and source:
  `ORGANIZER`, `PARTNER_REQUEST`, `EVENT_CANCELLATION` or `SYSTEM`.

### 4.5 Registration configuration prepared for later Sprint

- `registrationRequired=false` requires `registrationDeadlineAt=null`,
  `isCertificateEnabled=false` and no Attendance QR.
- `registrationRequired=true` requires a non-null registration deadline satisfying
  `now <= registrationDeadlineAt <= startAt` at first publish.
- `isCertificateEnabled=true` requires registration.
- Publish creates the Attendance QR exactly once when registration is required.
- Repeated publish never rotates the token.
- Sprint 5 does not expose Participant registration/scan commands.

## 5. Validation baseline

### 5.1 Text and URL

- `title`: trim/collapse whitespace, 1–200 characters.
- `activityType`: trim/collapse whitespace, 1–50 characters; normalized free text in Sprint 5,
  without a database enum/allowlist.
- `description`: optional, trim, maximum 5,000 characters.
- `imageUrl`: optional valid absolute HTTP(S) URL, maximum 2,048 characters.
- Proposal/request `reviewNote`: 10–1,000 characters where required.
- Change/cancellation `reason`: 10–500 characters.

### 5.2 Time

- API receives ISO-8601 UTC instants; UI displays `Asia/Ho_Chi_Minh`.
- `startAt < endAt`.
- Exact Activity interval lies within Event interval, including equal outer boundaries.
- Initial Proposal submit and Organizer direct create/Proposal approve require start in the future.
- General deadline equality is accepted: `now <= deadline`; after equality it is closed.
- Cancellation cutoff equality is not late; only `now > cutoff` sets `isLate=true`.
- Conflict interval is half-open `[startAt, endAt)`; adjacency is valid.

### 5.3 Capacity, quota and Location

- Capacity is an integer greater than zero and no greater than `Location.maxCapacity`.
- `maxActivitiesPerPartner=0` means no Partner Activity is allowed.
- Quota counts official Partner Activities in every status except `CANCELLED`.
- Pending/NeedChanges Proposals and direct BTC Activities do not consume Partner quota.
- Cancellation returns quota.
- Location must be active at submit/approve/create/change/publish.
- Location deactivation is blocked by current/future non-cancelled Activity.
- Lowering max capacity below any applicable non-cancelled Activity capacity is blocked.

## 6. Conflict and concurrency

All non-cancelled official Activities, including Draft, participate in the same physical schedule,
even across Events. Proposal never reserves a slot.

V9 enables `btree_gist` and adds an exclusion constraint equivalent to:

```sql
EXCLUDE USING gist (
  location_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (status <> 'CANCELLED')
```

The service performs a readable precheck, but the database constraint is authoritative. A database
race violation maps to `409 ACTIVITY_LOCATION_TIME_CONFLICT`, never a generic 500.

Global order for Activity mutations:

```text
Event
  → Location (old/new IDs ascending when both are involved)
  → Proposal or Activity
  → Change/Cancellation Request
```

When Booth ownership must be read, the existing Event-rooted Booth lock policy is preserved; no
Activity flow may acquire an Event after a Location or Activity row.

Bulk Event cancellation/completion collects affected Location IDs and locks them in ascending
order before Activity/request rows. Scheduler processing of one Activity follows the same
Event → current Location → Activity → request order.

## 7. Partner change and cancellation requests

### 7.1 Shared request policy

Both request types use `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`.

- Only Partner Activities inferred through `sourceProposal` are eligible.
- Partner Activity must be `DRAFT` or `PUBLISHED` to request a change.
- One Pending request total is allowed across both request tables for one Activity.
- Only Pending is reviewable/withdrawable.
- Event/Activity terminal transition closes a Pending request as `CANCELLED`.
- Activity transition to `ONGOING` closes a Pending Change Request as `CANCELLED`; a Pending
  Cancellation Request remains reviewable while Ongoing.
- Approval/rejection/withdrawal/cancellation is terminal.

### 7.2 Change Request

Optional requested fields are title, description, activityType, Location, start, end, capacity and
image URL. At least one field must cause an actual normalized value change. Start and end appear as
a pair. Explicit null may clear description/image and is distinct from an omitted field. The merged
candidate is fully validated at submit and again under locks at approve.
Approval atomically applies the candidate. A Published Activity stays Published.
While the request is Pending, the current Activity continues to reserve its current slot and the
requested new slot is not reserved; approval locks old/new Locations by ascending ID and rechecks.

### 7.3 Cancellation Request

The request records the immutable late flag from submission time. Submit does not alter Activity.
The current Activity therefore continues reserving its slot while cancellation is Pending.
Approval atomically sets request `APPROVED` and Activity `CANCELLED` with source
`PARTNER_REQUEST`. Rejection leaves the Activity unchanged.

## 8. Event integration

- ActivityProposal/Activity/request is external participation for Event operational-field freeze.
- A direct Activity may be prepared under a Draft Event, but then that Event has a historical
  dependency and cannot be hard-deleted. Draft Event time updates must keep every non-cancelled
  Activity inside the merged Event interval or fail atomically.
- New initial Proposal is accepted only on a `PUBLISHED` Event.
- Review and NeedChanges resubmission may operate in `PUBLISHED`/`ONGOING` if Activity has not
  started and remains inside Event bounds.
- Existing Sprint 4 financial/Assignment blockers still decide whether Event cancellation is
  allowed; Activity records do not bypass those blockers.
- Once eligible Event cancellation begins, one transaction closes open Proposal/request records
  and cancels Draft/Published/Ongoing Activities with source `EVENT_CANCELLATION`.
- Event completion closes stale open Proposal/request records and unpublishable Draft Activities
  with source `SYSTEM` and stable reason `Sự kiện đã kết thúc trước khi hoạt động được công bố.`;
  public Activity lifecycle is advanced first from backend time.
- Proposal cleanup also closes open Proposal at its own proposed start, without waiting for Event
  completion.

## 9. Public visibility and privacy

- Public list defaults to `PUBLISHED` and `ONGOING`; optional filter may include `COMPLETED`.
- Public list never returns `DRAFT` or `CANCELLED`.
- Public detail returns an Activity only when `publishedAt` is non-null; this preserves a cancelled
  historical URL with cancellation explanation.
- Public responses never expose Proposal, reviewNote, private reason, Partner application or
  request records.
- Private Partner records use ownership-safe `404`; Organizer Event ownership is enforced.

## 10. Notifications and idempotency

- Domain transaction commits before email is sent.
- Email failure is logged and does not roll back state.
- Sprint 5 emails verified representative Users of the affected Partner organization after
  Proposal `NEED_CHANGES`/`APPROVED`/`REJECTED`, Activity request `APPROVED`/`REJECTED`, direct
  Organizer cancellation of a Partner Activity, system closure of an open Proposal/request and
  Event cascade.
- Recipient addresses are normalized/deduplicated; missing or unverified email is skipped and one
  recipient failure does not prevent the rest.
- Participant notification waits for the Participant module.
- Repeated approve returns the existing Activity.
- Repeated publish, withdraw and cancel return current state without changing first timestamps,
  QR, cancellation metadata or sending duplicate email.
- A different command against a terminal record returns conflict.

## 11. Error contract summary

- `400`: malformed JSON, unknown field, invalid enum/filter/pagination/sort.
- `401`: no valid Session.
- `403`: authenticated actor lacks role; Organizer lacks Event authority where resource privacy
  does not require concealment.
- `404`: absent or private resource not owned by current Partner.
- `409`: lifecycle, deadline, quota, active-request, Booth ownership or schedule conflict.
- `422`: field validation or invalid merged candidate.

Canonical codes are defined in the Sprint 5 API Contract and must not be replaced by ad-hoc text.

## 12. Schema baseline

- V1–V8 are immutable.
- V9 creates/extends Activity tables, including technical `activity_revisions`, and
  Activity-related Location constraints.
- V9 owns `btree_gist` and the official Activity exclusion constraint.
- `hibernate.ddl-auto=validate` remains enabled.
- The old 33-table Draw.io image remains a target/reference view, not a migration source. The
  immutable V9 Flyway migration, this Sprint baseline and the API contract are authoritative for
  the delivered Activity schema.

## 13. Definition of done

Sprint 5 is complete only when:

- all acceptance criteria in `sprint-05-use-case-specifications.md` are implemented and automated;
- clean V1→V9 and existing V8→V9 migration tests pass;
- Hibernate schema validation passes;
- conflict and one-Pending-request races have database-backed tests;
- Event cancellation/completion cascade is atomic and tested;
- authorization and ownership-safe lookup are tested;
- post-commit email failure cannot undo domain changes;
- full backend regression, frontend lint/build and documented Swagger smoke flows pass;
- a Sprint 5 completion report records exact test counts and remaining technical debt.

All completion conditions were accepted on 2026-10-19. Verification evidence, merge references,
test counts and non-blocking technical debt are recorded in
`docs/development/SPRINT_05_COMPLETION_REPORT.md`.

