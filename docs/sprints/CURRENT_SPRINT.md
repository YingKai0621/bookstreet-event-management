# Current Sprint

There is no active Sprint. Sprint 10 is the latest completed Sprint, and Sprint 11 has no approved baseline
yet. New feature or schema work requires an approved Sprint baseline first. Recommended Sprint 11 debt is
listed in `docs/development/SPRINT_10_CLOSURE_REPORT.md` section 7.

## Sprint 10 Role-Scoped In-App Notifications

- Status: `COMPLETED - 2026-11-07`
- Closure report: `docs/development/SPRINT_10_CLOSURE_REPORT.md`
- Activation date: `2026-11-03`
- Previous completed Sprint: `Sprint 09 Heritage Public Content`
- Approved documentation: PR #116, merge commit `3a0a76b`
- Current implemented schema: Flyway migrations `V1` through `V17`
- Sprint 10 foundation: PR #122, merge commit `280588c`
- Partner inbox and producers: PR #124 (`7a8518a`) and PR #125 (`5fde175`)
- Organizer inbox and producers: PR #126, merge commit `e9a0355`
- Implemented Sprint 10 migrations: `V16` and amendment `V17`, authored by Developer A (`YingKai0621`)
- Sprint baseline: `docs/sprints/sprint-10.md`
- Current-state audit: `docs/development/SPRINT_10_ROLE_NOTIFICATIONS_CURRENT_STATE_AUDIT.md`
- Documentation audit: `docs/development/SPRINT_10_DOCUMENTATION_AUDIT.md`
- Use Case Specifications: `docs/use-cases/sprint-10-use-case-specifications.md`
- API Contract: `docs/api/sprint-10-api-contract.md`
- Physical ERD source: `docs/design/12_Physical_ERD_Report.md` plus
  `docs/design/SPRINT_10_ROLE_NOTIFICATIONS_PHYSICAL_ERD_OVERLAY.md`
- Implementation plan: `docs/sprints/SPRINT_10_IMPLEMENTATION_PLAN.md`
- Three-developer assignment: `docs/sprints/SPRINT_10_TEAM_ASSIGNMENT.md`

## Sprint goal

Extend the implemented Participant Notification foundation into one durable role-scoped inbox:

1. Preserve the six existing Participant types and behavior, plus the `ACTIVITY_STARTING_SOON` reminder.
2. Deliver approved committed outcomes to the affected Partner representative.
3. Deliver approved actionable work items to the owning Event Organizer.
4. Provide Admin with real role-isolated list/read infrastructure but no type or producer.
5. Keep multi-role accounts isolated by both authenticated User and current workspace role.

## Scope and acceptance baseline

The completed implementation was limited to:

- one existing PostgreSQL `notifications` table extended by implemented migrations V16 and V17
- exact audiences `PARTICIPANT`, `PARTNER`, `ORGANIZER`, and `ADMIN`
- four endpoint families with list, unread count, mark-one, and mark-all operations
- the closed Participant, Partner, and Organizer type/reference/transition matrices
- Admin genuine empty/failure behavior with no producer
- atomic producer writes, stable deduplication and first-read concurrency semantics
- real role-local frontend preview/full inbox, filters, read state and allowlisted navigation
- refresh on workspace entry, inbox/popover open, confirmed read mutation and the `BR-111` signal

The approved baseline contains **58 Acceptance Criteria**, including the 2026-11-06 amendments defined by
`BR-110` and `BR-111` in `docs/sprints/sprint-10.md` sections 12 and 13:

- 13 shared foundation criteria: `AC-N-S10-01` through `AC-N-S10-13`
- 8 Participant criteria: `AC-P-S10-01` through `AC-P-S10-08`
- 15 Partner criteria: `AC-E-S10-01` through `AC-E-S10-15`
- 11 Organizer criteria: `AC-O-S10-01` through `AC-O-S10-11`
- 5 Admin criteria: `AC-A-S10-01` through `AC-A-S10-05`
- 6 regression criteria: `AC-S10-REG-01` through `AC-S10-REG-06`

## Ownership

- Developer A is `YingKai0621`, authored V16 and owns the shared Notification foundation,
  Participant compatibility, Admin foundation, shared frontend wiring and final integration evidence.
- Developer B is the Partner work-package label and owns Partner producers and Partner frontend. The
  teammate taking this package coordinates its branch before PR 2 begins; no personal name is required.
- Developer C is the Organizer work-package label and owns Organizer producers and Organizer frontend.
  The teammate taking this package coordinates its branch before PR 3 begins; no personal name is required.
- Developer B's payment/settlement work merges before Developer C adds Booth re-selection integration.

## Delivery history

PR #122 merged the Developer A foundation into `main` at `280588c`. The delivered foundation includes:

- immutable V16 role-scoped Notification migration with clean/V15-upgrade verification
- shared Notification entity, repository, writer, query/read services and DTO mapping
- all 16 role endpoint contracts with exact authority
- atomic mark-one and role-aware mark-all behavior
- Participant backend compatibility and real database-backed Admin operations with no producer
- focused migration, repository, service, controller, security and concurrency tests

PR #124 and PR #125 delivered the Partner inbox and approved Partner producers. PR #126 delivered the
Organizer inbox and approved Organizer producers. Developer A then delivered Admin/shared frontend
integration, the `BR-110` amendment in PR #133, acceptance evidence in PR #136, the `BR-111` live signal in
PR #137, and Sprint closure.

## Non-negotiable implementation rules

- PostgreSQL remains durable truth; Redis remains Session-only.
- Authentication remains Spring Security Session with an HttpOnly cookie. Do not introduce JWT.
- Hibernate remains `ddl-auto: validate`; V1 through V17 are immutable.
- V16 is applied history. Developers B and C must not edit or replace it.
- Clients cannot create Notification rows or supply recipient/audience.
- Every approved producer joins the owning domain transaction; existing email remains after commit.
- No Admin producer, combined inbox, NotificationType table, sender, preference, outbox, SMS, push,
  WebSocket, polling, mock fallback or localStorage read truth is allowed. The only SSE is the content-free
  `BR-111` signal.
- BR-81 equality is inclusive: Organizer Booth selection is allowed at the exact request deadline and
  rejected only when backend time is later. The canonical predicate and boundary tests must preserve it.
- Do not commit `.env`, credentials, local database URLs, demo-only data or local scripts.

## Explicitly out of scope

- notification deletion, archive, pin, snooze, reply or assignment
- generic broadcast/composer behavior
- email behavior changes, SMS, mobile push or real-time transport other than the `BR-111` signal
- General Feedback broadcast
- Participant-volume Organizer alerts
- Admin security/account/system alert producers
- lifecycle changes to Event, Booth, Payment, Activity, Feedback, Reward, Heritage, Certificate or Badge

## Activation result

Sprint 10 documentation was reviewed and merged through PR #116. The active Business Rules, Use Case List,
MVP Scope, Sprint pointer and AI context were promoted on `2026-11-03`. Developer A reserved V16 after
confirming updated `main` contained only immutable migrations V1 through V15. PR #122 subsequently
implemented V16 and the shared role-scoped Notification backend foundation and merged it at `280588c` on
`2026-11-04`. Partner PR #124/#125 and Organizer PR #126 followed. V1 through V17 are immutable, and Sprint 10
closed on `2026-11-07`.
