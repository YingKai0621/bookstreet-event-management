# Sprint 07 Booth Visit, Points and Badge Progression

> Status: `ACTIVE - APPROVED 2026-10-28`.
>
> This document is the approved product baseline after completed Sprint 6/V11. Sprint 7 was
> activated on 2026-10-28 after approval of its Use Case Specification, API Contract and
> three-developer work assignment. Implementation must follow those frozen artifacts.
>
> Evidence: this proposal follows the current-state audit in
> `docs/development/SPRINT_07_CURRENT_STATE_AUDIT.md`, active Business Rules BR-12, BR-43, BR-44 and
> BR-48 through BR-50, the target Physical ERD and the completed Sprint 6 participation baseline.

## 1. Purpose

Sprint 7 completes the missing reward portion of the Participant hero flow:

```text
ACTIVE BoothAssignment QR
  -> authenticated Participant BoothVisit
  -> one PointTransaction
  -> cumulative total Points
  -> eligible Badge unlock/UserBadge
  -> Participant Rewards history
  -> Organizer event-scoped visit monitoring
  -> Admin Badge catalog management
```

This is one coherent vertical slice. It reuses the EventRegistration and Session identity delivered
before Sprint 7; it does not introduce an Event QR, a Participant QR or an Attendance Operator.

## 2. Included Use Case slices

| ID | Use Case | Sprint 7 delivery direction |
|---|---|---|
| UC-P01 | Manage Event Participation | Auto-create or reactivate EventRegistration when an eligible Participant scans a valid BoothAssignment QR without an active Event registration |
| UC-P03 | Track Participation | Self-scan BoothAssignment QR, retain BoothVisit history, view cumulative Points, PointTransaction history and unlocked Badges |
| UC-O07 | Monitor Participation | View BoothVisit outcomes for Events owned by the Organizer without exposing raw QR tokens or unrelated Participant data |
| UC-A03 | Manage Badges | Create, view, update and activate/deactivate global Badge definitions and total-Points thresholds |

No new Actor or top-level Use Case is proposed. Point calculation and automatic Badge award are
system behavior supporting these existing Use Cases.

## 3. Scope lock

### 3.1 In scope

- Persist the target `booth_visits`, `point_transactions`, `badges` and `user_badges` domain.
- Let an authenticated Participant scan the opaque QR token of an ACTIVE BoothAssignment.
- Resolve Participant identity only from the authenticated Session.
- Validate Event, BoothAssignment, EventRegistration and ownership relationships on the backend.
- Auto-create or reactivate the Participant's EventRegistration when the approved eligibility
  conditions are satisfied.
- Record at most one rewarded BoothVisit for one EventRegistration and BoothAssignment pair.
- Create exactly one positive PointTransaction for a newly rewarded BoothVisit.
- Treat an exact duplicate scan as an idempotent success and never award duplicate points.
- Calculate cumulative Points across Events from the PointTransaction ledger.
- Automatically create missing UserBadge rows for all eligible active Badge thresholds evaluated
  by an approved award trigger.
- Create one durable, owner-visible `BADGE_UNLOCKED` Notification for every newly persisted
  UserBadge, including unlocks produced by Booth scans and approved Badge backfill.
- Provide Participant Rewards data: current total, PointTransaction history, earned Badges and
  progress toward active unearned Badges.
- Provide minimum Organizer-owned Event monitoring for BoothVisit count and visit records.
- Provide Admin Badge catalog management required by UC-A03.
- Replace the current placeholder Participant reward and Admin Badge UI data with real APIs.
- Add a Participant QR landing/scan result flow that clearly distinguishes a Booth visit from
  Activity Attendance.
- Include authorization, ownership, token secrecy, lifecycle, idempotency, concurrency,
  migration and integration coverage for this slice.

### 3.2 Explicitly out of scope

- Redeeming Points, rewards shop, coupons, vouchers, prizes or Point expiry.
- Manual Point grants, deductions, transfers, reversals or an Admin Point editor.
- Awarding Points for Event join, Activity registration or Activity Attendance.
- Staff scanning a Participant-specific QR, check-out, dwell time, GPS or device fingerprinting.
- QR rotation/regeneration, printable Badge certificates or social sharing.
- A generic rule engine or generic System Settings module.
- Permission/RolePermission entities or expansion of the placeholder Admin permissions UI.
- General Feedback, Heritage content and forgot/reset-password recovery.
- Generic cross-role Notification composer, broadcast or broad notification inbox expansion.
  Sprint 7 adds only the narrow Participant `BADGE_UNLOCKED` type defined in section 8.
- Full UC-O08 Event reports. Sprint 7 exposes only the visit data needed by the included UC-O07
  monitoring slice; broader reporting requires a separate approved contract.
- Post-MVP Booth change/cancellation/refund and whole-Event Partner withdrawal.
- Changes to the completed Activity Attendance, Certificate or Rating semantics from Sprint 6.

## 4. Existing prerequisites and invariants

Sprint 7 must reuse, not duplicate, these completed concepts:

- `users` and server-side Session authentication provide the acting Participant identity.
- `events` is the aggregate root for Event-scoped state changes.
- `event_registrations` has one reusable row per User/Event with `ACTIVE` or `LEFT` status.
- `booth_assignments` has one immutable opaque `qr_token` and one lifecycle status:
  `ACTIVE`, `RELEASED`, `CANCELLED` or `ENDED`.
- A BoothAssignment comes from a BoothHold, which reaches its Event through EventBoothConfig.
- Event lifecycle is `DRAFT -> PUBLISHED -> ONGOING -> COMPLETED`; `CANCELLED` is terminal.
- QR scanning must never trust a User ID, Event ID, Booth ID, Assignment ID, Point amount or Badge
  ID supplied by the client.
- Raw QR tokens must not be returned by public catalog APIs or included in application/server logs.

Activity QR and Booth QR have different meanings:

| QR | Result | Registration requirement | Reward result |
|---|---|---|---|
| Activity QR | Attendance for one ActivityRegistration | Existing active ActivityRegistration | No BoothVisit Points |
| BoothAssignment QR | Visit to one assigned Booth in one Event | EventRegistration may be auto-created/reactivated | One rewarded visit at most |

## 5. Domain baseline

### 5.1 BoothVisit

BoothVisit is the durable record that one EventRegistration visited one BoothAssignment.

Required invariants:

- Unique identity is `(eventRegistrationId, boothAssignmentId)`.
- The EventRegistration and BoothAssignment must resolve to the same Event.
- The BoothAssignment must be ACTIVE when the first rewarded visit is accepted.
- A successful first scan stores backend time; client time is not trusted.
- A later Assignment release/cancellation/end or Event completion does not delete visit history.
- There is no second current or historical rewarded row for a duplicate scan.

### 5.2 PointTransaction

PointTransaction is the immutable ledger fact produced by one accepted BoothVisit.

Required invariants:

- One BoothVisit produces at most one PointTransaction.
- The Point amount is positive and server-owned. Sprint 7 awards exactly `10` Points for one first
  valid BoothVisit, read from the backend property `rewards.booth-visit-points=10`.
- A retry cannot update the amount or create a second ledger row.
- The ledger is not edited through a general CRUD endpoint in Sprint 7.
- A User's current total is calculated from `SUM(point_transactions.points)` through owned
  EventRegistrations; `users` does not store a duplicated `total_points` balance.
- Points accumulate across Events and are not reset at Event boundaries.

### 5.3 Badge

Badge is a global Admin-managed reward definition.

Minimum fields:

- stable Badge identity;
- normalized unique name;
- optional description and image/icon URL;
- positive `requiredPoints` threshold;
- active/inactive status;
- creation/update audit timestamps.

The Sprint 7 persisted/API Badge model is limited to `name`, optional `description`,
`requiredPoints`, optional `iconUrl`, `isActive` and audit/identity fields. Placeholder frontend
fields such as `code`, `nameEn`, `perks` and `iconType` are not Sprint 7 persistence requirements
and must be removed or derived locally rather than sent to phantom APIs.

Badge names and thresholds are business data. Sprint 7 must not introduce a generic
`system_settings` table to store them.

### 5.4 UserBadge

UserBadge is the durable fact that one User reached one Badge threshold.

Required invariants:

- Unique identity is `(userId, badgeId)`.
- Award time is backend-owned and retained.
- Award retries do not create duplicates.
- An earned UserBadge is historical evidence and is not silently deleted when its Badge is later
  edited or deactivated.

The approved prospective/backfill behavior of Badge configuration changes is recorded in section
16.

## 6. Booth QR scan policy

### 6.1 QR ownership and scan direction

- One opaque `qrToken` belongs to one BoothAssignment and is generated by the backend when the
  Assignment is created.
- The Partner may display the QR for its assigned Booth through the already authorized Assignment
  view.
- The displayed QR encodes a frontend application route that keeps the opaque token in a URI
  fragment or equivalent client-only state, not in a backend path/query that default access logs
  record.
- The Participant authenticates before the command is evaluated; after login, the application may
  safely resume the pending client-side scan state.
- The frontend submits the token to the authenticated scan command in the HTTPS request body;
  request-body logging must redact or omit that field.
- The backend resolves Event, Booth, Assignment, Partner and Participant from trusted persistence
  and Session data.

### 6.2 Approved validity window

The Sprint 7 rule is:

```text
assignment.status = ACTIVE
AND event.status = ONGOING
AND event.startAt <= backendNow < event.endAt
```

This is intentionally stricter than accepting every PUBLISHED Event. It prevents a Participant
from earning an on-site Booth visit before the Event opens. Equality at `startAt` is accepted;
`endAt` is exclusive. A lifecycle refresh under the Event lock must occur before validation so a
stale `PUBLISHED` row does not reject a scan after `startAt`, and a stale `ONGOING` row does not
accept one after `endAt`.

Sprint 7 has no early Booth scan window. A future change would require an explicit business rule
rather than a frontend clock workaround.

### 6.3 EventRegistration behavior

For a valid first Booth scan:

- no EventRegistration: create one ACTIVE row;
- EventRegistration LEFT: reactivate the same row;
- EventRegistration ACTIVE: reuse it;
- Event relationship mismatch: reject without mutation.

The Booth scan is an on-site action during an ONGOING Event. Sprint 7 therefore allows its
auto-create/reactivation even when the earlier participant-registration deadline has passed. This
is the approved BR-12 scan auto-registration behavior; direct Join and Activity registration keep
their existing deadline rules.

## 7. Idempotency and concurrency

The scan command is a single atomic transaction. The recommended lock order is:

```text
Event
  -> BoothAssignment
  -> EventRegistration
  -> BoothVisit
  -> PointTransaction
  -> Badge rows by badgeId
  -> UserBadge rows by badgeId
```

Repository queries may traverse BoothHold/EventBoothConfig to resolve the Event, but every
state-changing Event operation still locks the Event root first.

Database uniqueness is the final safety layer:

- UNIQUE `(event_registration_id, booth_assignment_id)` on `booth_visits`;
- UNIQUE `booth_visit_id` on `point_transactions`;
- UNIQUE normalized Badge name;
- UNIQUE `(user_id, badge_id)` on `user_badges`.

An exact duplicate scan returns the already-achieved visit result and current reward summary. It
must not surface as a generic server error. Races that hit a unique constraint must be recovered
into the same idempotent outcome or a stable domain conflict; they must never leak SQL details.

Admin Badge mutation, scan reward evaluation and backfill all lock affected Badge rows by ascending
Badge identity and recheck `isActive`/`requiredPoints` under lock. If Admin mutation commits first,
the new rule controls a later evaluation. If an award commits first, its UserBadge remains earned.
Scan and backfill racing for the same User/Badge converge through the unique UserBadge identity;
only the transaction that creates it creates the matching Notification.

## 8. Reward evaluation

For a newly accepted BoothVisit, the transaction performs:

1. create or reuse the active EventRegistration;
2. create the unique BoothVisit;
3. create its unique positive PointTransaction;
4. calculate the User's new cumulative total;
5. find every active Badge whose threshold is now met;
6. insert only missing UserBadge rows;
7. create one idempotent `BADGE_UNLOCKED` Notification for each newly created UserBadge;
8. return the visit, awarded Points, total Points and newly unlocked Badges.

If any step fails, the whole first-scan transaction rolls back. A BoothVisit without its expected
PointTransaction is not an acceptable committed state.

`BADGE_UNLOCKED` is the only Notification expansion in Sprint 7:

- it is created in the same transaction as its UserBadge so an unlock cannot commit silently;
- its deduplication identity is derived from the stable UserBadge identity, not from message text;
- one UserBadge produces at most one Notification even when a scan or backfill is retried;
- it belongs only to the User who earned the Badge;
- it contains Badge display metadata but never a QR token;
- it is also created when Badge creation, threshold reduction or reactivation backfills an
  already-eligible User;
- the scan response still provides immediate unlock feedback without waiting for inbox refresh.

No Badge broadcast, notification preference, email/push delivery or generic composer is included.

Badge eligibility backfill uses one shared processor:

- creating an active Badge, lowering an active threshold or reactivating a Badge schedules the
  processor only after the Badge mutation commits;
- one batch handles at most 100 eligible Users with missing UserBadge rows in stable User order;
- each batch commits independently and produces processed, awarded and remaining-eligible counts;
- the after-commit processor automatically continues successive batches until remaining eligibility
  reaches zero or a batch fails;
- an idempotent Admin synchronization command returns the batch counts and is the explicit
  resume/retry path after interruption;
- the Admin view exposes remaining eligibility and can invoke that command until it reaches zero;
- no `badge_award_jobs` or generic settings table is required for Sprint 7; current progress is
  derived from eligible Users still missing the UserBadge;
- scan/backfill concurrency follows the Badge/UserBadge locking and uniqueness rules above.

## 9. Role-facing target state

### 9.1 Participant

The Participant workspace should provide:

- a Booth QR scan landing/result view;
- clear outcomes for success, duplicate visit, invalid/unknown token, inactive Assignment, Event
  not open, authentication required and relationship inconsistency;
- Rewards summary with cumulative Points;
- Point history showing Booth/Event context, amount and award time;
- earned Badge collection with earned time;
- progress for active unearned Badges without exposing inactive catalog entries.

The existing “Điểm & Đổi thưởng” placeholder may be renamed to “Điểm & Huy hiệu” because redeeming
Points is outside this Sprint.

### 9.2 Organizer

For Events owned by the Organizer, the monitoring workspace should provide:

- total rewarded Booth visits;
- visit count grouped by BoothAssignment/Booth;
- paginated visit records with Participant display identity appropriate for operations;
- Event/Booth filters owned by the selected Event;
- no raw Booth QR token and no data from another Organizer's Event.

This is UC-O07 monitoring, not the complete UC-O08 reporting module.

### 9.3 System Admin

The Admin Badge view should provide:

- paginated/searchable Badge catalog;
- create and update validation;
- activate/deactivate action;
- threshold and active-state visibility;
- stable conflict handling for duplicate normalized names.

It must call real Sprint 7 APIs and must not depend on the placeholder Roles/Permissions or System
Settings screens.

## 10. Authorization and privacy baseline

- Booth scan and Rewards data require an authenticated Participant-capable User.
- A User may read only their own Point ledger and UserBadge history.
- Organizer monitoring requires ORGANIZER role and Event ownership.
- Badge catalog mutation requires ADMIN role.
- Public endpoints may expose active Badge display metadata only if later approved; public access
  is not required for Sprint 7.
- Raw QR tokens are treated as bearer-like secrets: no analytics payload, exception message,
  notification, public response or application log may contain the full token.
- CSRF protection remains required for Session-authenticated state-changing requests.
- Pagination and server-side filters must prevent unbounded Participant or Organizer result sets.

## 11. Database direction

The first Sprint 7 schema migration is proposed as Flyway `V12`; V1 through V11 remain immutable.
V12 should activate the four already-modeled target tables:

```text
booth_visits
point_transactions
badges
user_badges
```

V12 must also make the smallest compatible change to `notifications` required for
`BADGE_UNLOCKED`: add its approved Badge/UserBadge reference, extend the type/reference CHECK and
preserve all Sprint 6 notification rows and constraints. It must not create a second notification
table or relax owner/deduplication guarantees for existing notification types.

The exact columns, foreign-key delete behavior, indexes, checks and seed policy must be frozen in
the Sprint 7 Use Case/API/schema review before migration code is written. The migration must not:

- add `total_points` to `users`;
- introduce Permission/RolePermission or generic SystemSetting tables;
- rewrite a previous Flyway migration;
- seed real credentials or environment-specific demo accounts;
- make destructive assumptions about existing Sprint 1-6 data.

## 12. Required scenario coverage

The Sprint 7 Use Case Specification must turn at least these scenario groups into numbered,
testable Acceptance Criteria:

1. first valid Booth scan during an ONGOING Event;
2. scan auto-creates EventRegistration;
3. scan reactivates a LEFT EventRegistration;
4. exact duplicate scan returns the existing outcome without extra reward;
5. concurrent duplicate scans create one visit, one PointTransaction and no duplicate UserBadge;
6. unknown or malformed QR token;
7. RELEASED, CANCELLED or ENDED Assignment;
8. Event before start, at start, before end, at end, completed or cancelled;
9. Event/Assignment/EventRegistration relationship mismatch;
10. cumulative Points across multiple Events;
11. crossing one or multiple active Badge thresholds in one transaction;
12. Badge name and threshold validation;
13. Badge configuration-change and retry-safe backfill policy from section 16;
14. exactly one owner-only `BADGE_UNLOCKED` Notification per newly created UserBadge from scan or
    backfill;
15. Participant owner-only reward and notification queries;
16. Organizer ownership isolation and pagination;
17. Admin-only Badge mutation;
18. rollback when ledger, Badge award or unlock Notification persistence fails;
19. no raw QR token in public/Participant response, Notification or logs.

## 13. Delivery order

Implementation starts only after the planning artifacts are approved in this order:

1. current-state audit — approved evidence;
2. this Sprint 7 scope baseline — approved;
3. Sprint 7 Use Case Specification and numbered Acceptance Criteria — approved;
4. Sprint 7 API Contract, error catalog and transaction semantics — approved;
5. Sprint 7 three-developer work assignment and file/ownership boundaries — approved;
6. activate `CURRENT_SPRINT.md` and update `AI_CONTEXT.md` — completed 2026-10-28;
7. create the implementation branch(es), V12 and code — next;
8. backend integration/concurrency tests, frontend integration and focused Playwright demo flow;
9. completion report and baseline closeout.

The work assignment should keep migration/entity ownership with one developer and avoid parallel
edits to the same controller/service/UI files.

## 14. Definition of Done

Sprint 7 is complete only when:

- approved Use Case, API and ownership documents match the implementation;
- V12 applies cleanly from a fresh database and on the current V11 baseline;
- a valid first scan atomically produces one BoothVisit and one PointTransaction;
- duplicate and concurrent scans cannot award duplicate visits, Points or Badges;
- total Points are ledger-derived and accumulate across Events;
- Badge creation/update/activation behavior follows the approved section 16 decisions;
- every newly earned UserBadge has one durable, idempotent `BADGE_UNLOCKED` Notification;
- Participant, Organizer and Admin screens use real APIs with loading, empty and error states;
- authorization and Organizer ownership isolation are covered by backend tests;
- the focused Participant scan-to-reward demo path passes;
- Sprint 1-6 critical flows remain green;
- no placeholder API is invented to satisfy unrelated Admin/Public UI;
- completion evidence and remaining debt are documented.

## 15. Non-goals for the following documents

The Sprint baseline defines behavior and boundaries but intentionally does not freeze:

- URL paths, HTTP methods, DTO field names or error codes — API Contract responsibility;
- every Given/When/Then variation — Use Case Specification responsibility;
- developer names, PR sequence or exact file ownership — Work Assignment responsibility;
- implementation class/package names — development responsibility after approval.

This separation prevents the API or code layout from silently becoming the business requirement.

## 16. Approved product decisions

The Project Owner approved the following decisions on 2026-10-28:

| # | Decision | Approved Sprint 7 baseline | Reason |
|---|---|---|---|
| D1 | Point amount for one first valid BoothVisit | Exactly 10 Points from server property `rewards.booth-visit-points=10`; no generic settings UI | BR-48 requires configured behavior, while MVP explicitly excludes generic System Settings; PointTransaction snapshots the awarded amount so later property changes do not rewrite history |
| D2 | Booth QR time window | Event `ONGOING` and `[startAt, endAt)` only | Prevents remote/pre-event reward farming and gives an unambiguous backend clock rule |
| D3 | Registration deadline during on-site Booth scan | Allow auto-create/reactivation during the valid on-site scan window | BR-12 expects auto-registration from a valid scan; the visit itself proves on-site participation |
| D4 | New Badge or lowered/reactivated threshold | After the Badge mutation commits, run the shared backfill processor in batches of at most 100 Users; expose an idempotent Admin resume command with processed/awarded/remaining counts; derive remaining work instead of adding a job table | Keeps BR-50 true for existing totals, survives interruption through explicit retry and avoids one unbounded transaction |
| D5 | Badge deactivation or raised threshold | Never revoke an already earned UserBadge; apply the new rule prospectively | Preserves historical achievement and avoids destructive reward history |
| D6 | Organizer monitoring depth | Event summary, Booth grouping and paginated visit rows only | Completes the UC-O07 slice without pulling the broad UC-O08 report module into Sprint 7 |
| D7 | Badge unlock notification | Create one durable `BADGE_UNLOCKED` Notification for every newly persisted UserBadge, including scan and backfill awards | Provides an auditable Participant-facing unlock event while keeping notification scope narrow and idempotent |

D1 through D7 are product-approved and form part of the active Sprint 7 baseline. Semantic changes
require the corresponding baseline documents and `CURRENT_SPRINT.md` to be reviewed together.
