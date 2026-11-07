# Sprint 10 Role-Scoped Notifications Implementation Plan

- Status: `COMPLETED - 2026-11-07`; see `docs/development/SPRINT_10_CLOSURE_REPORT.md`
- Prepared date: `2026-11-02`
- Scope baseline: `docs/sprints/sprint-10.md`
- API contract: `docs/api/sprint-10-api-contract.md`
- Physical ERD overlay: `docs/design/SPRINT_10_ROLE_NOTIFICATIONS_PHYSICAL_ERD_OVERLAY.md`
- Three-developer ownership: `docs/sprints/SPRINT_10_TEAM_ASSIGNMENT.md`
- Schema baseline: immutable Flyway `V1` through `V17`
- Implemented migrations: `V16` and amendment `V17`, authored exclusively by Developer A (`YingKai0621`)
- Foundation delivery: PR #122, merge commit `280588c`, merged `2026-11-04`

## 1. Delivery principles

- Start implementation only from updated `main` after Sprint 10 activation.
- Use one implementation branch or one explicitly coordinated branch per focused PR.
- The Project Owner or assigned migration owner exclusively reserves and authors the next migration.
- Never modify V1 through V16.
- Keep PostgreSQL as durable truth and Redis Session-only.
- Preserve existing Participant response compatibility.
- Add no producer or delivery channel outside the approved baseline.
- Every producer is implemented inside the owning domain transaction and lock order.
- Every PR includes a staged-diff audit and focused tests before commit.
- Shared-file ownership and the PR 2-before-PR 3 Booth/Payment merge order follow the three-developer
  assignment; parallel work must not duplicate producer logic.

## 2. Pre-implementation gates

1. Completed: PR #116 merged the complete Sprint 10 documentation set at `3a0a76b`.
2. Completed by this activation change: Sprint 10 is promoted in `CURRENT_SPRINT.md`, `AI_CONTEXT.md`, and
   the active requirement context.
3. Completed: Developer A updated from `main` and listed immutable migrations V1 through V15.
4. Completed: Developer A reserved `V16`; no competing migration existed at reservation time.
5. Completed before PR 1 code: required sources were reread in `AGENTS.md` order from merged activation
   `main`.
6. Completed before PR 1 code: no competing branch edited V16, Notification core, or shared security.
7. Before PR 2 or PR 3 begins, the teammate taking it claims the corresponding Developer B or C role and
   confirms branch ownership, shared-file boundaries and the documented merge order with the team.
8. Completed: PR #122 merged V16 and the shared role-scoped backend foundation at `280588c`.
9. Current gate: Developer B starts PR 2 from updated `main`; Developer C does not integrate Booth
   re-selection until PR 2 is merged.

## 3. Delivery sequence

### PR 1 — Role-scoped persistence and shared backend foundation — MERGED

Merged through PR #122 at `280588c` on `2026-11-04`.

Owns:

- one reviewed Flyway migration
- role-aware Notification entity, enums, repository, writer, queries, and DTO mapping, including derived
  `contextEventId` without a duplicated Event FK
- shared internal service boundaries without speculative interfaces
- four endpoint families with exact authority
- atomic mark-one correction and role-aware mark-all
- Participant backward compatibility
- migration, repository, service, controller, security, and concurrency tests

Must not add Partner/Organizer producers yet unless required by a tightly coupled test fixture. Admin
endpoints execute real role-scoped queries and return genuine empty data because no Admin type exists;
they must not hard-code empty responses.

Completion gate:

- clean migration and V15 upgrade pass
- Hibernate validation passes
- all 16 route contracts exist
- multi-role isolation and first-read concurrency pass
- existing Participant notification behavior and field meanings remain compatible; the additive
  `contextEventId` field does not change existing values

### PR 2 — Partner producers and real Partner inbox

Owns:

- application review producer
- Booth request outcome producers
- Activity proposal outcome producer
- Activity change/cancellation request outcome producers
- Event/Activity cancellation impact producers and suppression
- Partner notification API adapter, preview, full page, route, unread state, filters, and navigation
- focused domain transaction, rollback, retry, suppression, frontend, and browser tests

Must not change the underlying review, payment, cancellation, or ownership rules.

Completion gate:

- every approved Partner transition has one success, retry, rollback, wrong-recipient, and suppression check
- `/partner/notifications` is reachable and real
- empty-array and no-op methods are removed
- Partner browser scenarios pass

### PR 3 — Organizer producers and real Organizer inbox

Owns:

- new application, Booth request, proposal submission/resubmission, and Activity request producers
- conditional Booth re-selection producer under the existing lock/deadline rules
- Organizer notification API adapter, preview, full page, unread state, filters, and navigation
- replacement of hard-coded counts and fake empty data
- focused owner, exact-role, retry, rollback, deadline, actionability, wording, and browser tests

Must not create Participant-volume or General Feedback broadcast rows.

Completion gate:

- each approved work item reaches only the Event owner
- re-selection alerts reference the released request and exist only when the same canonical selection
  predicate confirms another candidate remains eligible
- shared Feedback behavior is unchanged
- Admin-only account cannot access Organizer inbox
- Organizer browser scenarios pass

### PR 4 — Admin foundation and cross-role frontend refresh

Owns:

- typed Admin list/count/read adapters against the real endpoints
- genuine Admin empty state and explicit error state
- removal of failure-to-empty swallowing and fabricated alert copy
- consistent entry/full-inbox/popover/read refresh across all four role layouts
- no polling, WebSocket, or mock fallback
- focused Admin authorization and cross-role frontend tests

Must not add an Admin type or producer.

Completion gate:

- real API empty is visibly distinct from failure
- Admin exact-role behavior passes
- multi-role navigation never mixes inboxes
- no periodic network polling is introduced

### PR 5 — Verification and closure

Owns:

- cross-role integration and focused Playwright consolidation
- affected domain/security regressions
- OpenAPI reconciliation if the project publishes these routes
- applied Physical ERD report update
- Acceptance Criteria evidence and closure report
- project/context owner handoff for final status updates

No new product behavior belongs in the closure PR.

## 4. Backend design boundaries

### 4.1 Notification module

Refactor Participant-specific names only where required to represent the shared role-scoped model. Avoid a
broad unrelated rename in one commit. The target module remains feature-organized:

```text
notification/
  controller/
  dto/
  entity/
  repository/
  security/
  service/
```

One implementation class is preferred where there is one behavior. Use an interface only for a deliberate
cross-module writer boundary already justified by multiple domain producers.

### 4.2 Domain producer placement

Each owning feature calculates recipient and transition identity from locked durable rows, then invokes the
writer before its transaction commits. Notification code does not call feature controllers and does not
reimplement lifecycle decisions.

Producer order examples:

```text
Event/domain root lock
  -> existing domain validation and transition
  -> durable transition timestamp/status
  -> resolve durable recipient
  -> insert role-scoped Notification
  -> commit
```

Bulk Event cancellation locks and processes affected rows in the existing global order. Notification
insertion remains last within that order.

### 4.3 First-read implementation

Use a repository conditional update under `notificationId + recipientUserId + recipientRole + readAt null`.
Do not use a detached or unlocked read-modify-write. On zero updated rows, reload under the same owner/role:

- present and already read -> idempotent success with original timestamp
- absent -> `NOTIFICATION_NOT_FOUND`

Concurrency tests must use controlled transactions, not only sequential mocks.

## 5. Migration delivery

The migration owner implements only the Sprint 10 overlay:

- `recipient_role` add/backfill/not-null
- four new nullable reference FKs
- role/type/reference constraint replacement
- role-aware unique constraint replacement
- role-aware created/unread/read-time query indexes and new FK indexes

Required migration tests:

- clean V1 through V16
- V15 upgrade with unread Participant row
- V15 upgrade with read Participant row preserving exact `read_at`
- exact role backfill regardless of current advanced User roles
- valid row for each type family
- invalid role, type, reference, and cross-role combinations
- unique identity per User/role/key
- same User/key accepted under two valid different role/type combinations
- FK restrict behavior and index inspection
- Hibernate validation

## 6. Producer verification matrix

Every approved producer needs:

- happy-path committed row
- exact recipient User and role
- exact type and reference
- deterministic deduplication key based on persisted transition identity
- retry creates no duplicate
- domain rollback leaves no Notification
- Notification failure rolls back the owning transition
- no row for an unapproved source state
- no row for self-action or suppression case

Additional cases:

- repeated proposal NEED_CHANGES cycles are distinct transitions
- Event cancellation sends one Partner row per representative/Event
- approved cancellation request suppresses direct Activity-cancelled duplicate
- direct/System Activity cancellation suppresses child request-cancelled rows from the same transition
- Event cancellation suppresses all Partner child-outcome rows from that cascade
- Booth re-selection references the released terminal request and requires a different pending candidate
  that passes the canonical Event, deadline, application, quota, configuration, Location, Hold, and
  Assignment selection predicate
- payment uncertainty blocks release and re-selection notification

## 7. API and security verification

For every role family verify:

- missing Session
- wrong role
- disabled/unverified advanced role where applicable
- multi-role account with correct role
- list default, ascending sort, read true/false, valid type, and combined filters
- invalid declared page, size, sort, and type values
- unread count isolation
- mark-one unread, already read, unknown, other owner, and other role
- mark-all zero, one, and multiple rows
- CSRF failure on both POST operations
- no-store headers on success and error

Concurrency verification includes:

- two mark-one commands
- mark-one racing mark-all
- two mark-all commands
- producer retry and concurrent duplicate insert

## 8. Frontend delivery

### 8.1 Shared behavior

- keep typed role-specific service adapters over the common response shape
- do not place business truth in localStorage
- do not transform network error into empty success
- show relative time as presentation only; server timestamps remain authoritative
- refresh on role entry, full-inbox or popover open, and confirmed read mutation
- avoid background intervals that call the inbox API
- keep route allowlists role-specific

### 8.2 Partner

- activate `/partner/notifications`
- replace the redirect and no-op methods
- show actionable outcome wording and owned target routes
- distinguish initial empty from filtered empty

### 8.3 Organizer

- fetch real data on layout/view entry
- remove hard-coded count and placeholder content
- link to owner-scoped review routes
- add `notifications` to the Organizer supported-route set
- phrase late cancellation requests for Organizer users, not developers

### 8.4 Admin

- call real APIs
- normal empty state explains there are no notifications
- failure offers retry and does not claim there are none
- remove unsupported settings/alert promises from the notification view

## 9. Focused test commands

Exact class and file names follow implementation and must not be claimed before they exist. Expected command
shape:

```powershell
cd backend
.\mvnw.cmd -Dtest=*Notification*,*RelevantDomainProducer* test

cd frontend
npm run lint
npm run build
npx playwright test tests/e2e/sprint10-role-notifications-ui.spec.ts
```

Run focused affected domain tests for application review, Booth selection/expiry/withdrawal, proposal review,
Activity request review, Event/Activity cancellation, Participant Certificate/Badge, security, and CSRF.
Normal backend and frontend CI remain mandatory.

## 10. Manual real-UI smoke

Use isolated local test data, not `.env` demo data as automated-test storage:

1. Sign in with one multi-role account and confirm role inbox separation.
2. Trigger one Partner application outcome and verify Partner badge, preview, full inbox, and target.
3. Trigger one Booth selected outcome and verify payment-oriented wording.
4. Trigger proposal NEED_CHANGES twice through two real cycles and verify two rows, not retry duplicates.
5. Submit a new Partner work item and verify only the Event owner Organizer receives it.
6. Test legal and ineligible Booth re-selection cases.
7. Cancel an Event with multiple Partner child records and verify one Partner Event row.
8. Race mark-one and mark-all and confirm the first stored time remains stable after reload.
9. Confirm Participant six-type behavior still works.
10. Confirm Admin real empty and simulated API failure render differently.
11. Confirm no repeated network polling while a tab remains open.

## 11. Acceptance Criteria delivery map

### PR 1

- `AC-N-S10-01` through `AC-N-S10-06`
- `AC-N-S10-09` through `AC-N-S10-11`
- `AC-P-S10-01` through `AC-P-S10-03`

### PR 2

- `AC-E-S10-01` through `AC-E-S10-13`
- Partner producer evidence contributing to `AC-N-S10-07` and `AC-N-S10-08`

### PR 3

- `AC-O-S10-01` through `AC-O-S10-10`
- Organizer producer evidence contributing to `AC-N-S10-07` and `AC-N-S10-08`

### PR 4

- `AC-A-S10-01` through `AC-A-S10-05`
- `AC-P-S10-04` through `AC-P-S10-07`

### PR 5

- final cross-role evidence for `AC-N-S10-07` and `AC-N-S10-08`
- `AC-S10-REG-01` through `AC-S10-REG-06`
- final cross-layer evidence for all 52 criteria

## 12. Commit and PR audit checklist

Before every commit:

- inspect `git status` and staged diff
- stage no `.env`, credential, local database URL, local script, or unrelated file
- verify no applied migration changed
- verify migration version uniqueness for any future approved migration; Sprint 10 V16 is immutable
- run relevant focused tests
- confirm no placeholder/fallback survives in the changed path
- map behavior to literal Acceptance Criteria ids

Before merge:

- update from accepted `main` and resolve shared-file conflicts deliberately
- rerun tests affected by conflict resolution
- require backend and frontend CI green
- record skipped tests honestly
- audit producer suppression and multi-role isolation again

## 13. Completion gate

Sprint 10 is complete only when all 52 criteria have evidence, all four roles use real role-isolated inbox
operations, approved Partner/Organizer producers are atomic and deduplicated, Participant behavior remains
compatible, Admin remains producer-free, focused browser tests and CI are green, and the applied ERD and
closure documentation are updated.
