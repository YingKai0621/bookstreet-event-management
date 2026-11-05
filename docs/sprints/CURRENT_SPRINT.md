# Current Sprint

## Sprint 10 Role-Scoped In-App Notifications

- Status: `ACTIVE - PARTNER/ORGANIZER MERGED; ADMIN/CLOSURE IN PROGRESS`
- Activation date: `2026-11-03`
- Previous completed Sprint: `Sprint 09 Heritage Public Content`
- Approved documentation: PR #116, merge commit `3a0a76b`
- Current implemented schema: immutable Flyway migrations `V1` through `V16`
- Sprint 10 foundation: PR #122, merge commit `280588c`
- Partner inbox and producers: PR #124 (`7a8518a`) and PR #125 (`5fde175`)
- Organizer inbox and producers: PR #126, merge commit `e9a0355`
- Implemented Sprint 10 migration: `V16`, authored exclusively by Developer A (`YingKai0621`)
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

1. Preserve the six existing Participant types and behavior.
2. Deliver approved committed outcomes to the affected Partner representative.
3. Deliver approved actionable work items to the owning Event Organizer.
4. Provide Admin with real role-isolated list/read infrastructure but no type or producer.
5. Keep multi-role accounts isolated by both authenticated User and current workspace role.

## Scope and acceptance baseline

The active implementation is limited to:

- one existing PostgreSQL `notifications` table extended by implemented migration V16
- exact audiences `PARTICIPANT`, `PARTNER`, `ORGANIZER`, and `ADMIN`
- four endpoint families with list, unread count, mark-one, and mark-all operations
- the closed Participant, Partner, and Organizer type/reference/transition matrices
- Admin genuine empty/failure behavior with no producer
- atomic producer writes, stable deduplication and first-read concurrency semantics
- real role-local frontend preview/full inbox, filters, read state and allowlisted navigation
- bounded refresh on workspace entry, inbox/popover open and confirmed read mutation

The approved baseline contains **52 Acceptance Criteria**:

- 11 shared foundation criteria: `AC-N-S10-01` through `AC-N-S10-11`
- 7 Participant criteria: `AC-P-S10-01` through `AC-P-S10-07`
- 13 Partner criteria: `AC-E-S10-01` through `AC-E-S10-13`
- 10 Organizer criteria: `AC-O-S10-01` through `AC-O-S10-10`
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

## Current implementation unit

PR #122 merged the Developer A foundation into `main` at `280588c`. The delivered foundation includes:

- immutable V16 role-scoped Notification migration with clean/V15-upgrade verification
- shared Notification entity, repository, writer, query/read services and DTO mapping
- all 16 role endpoint contracts with exact authority
- atomic mark-one and role-aware mark-all behavior
- Participant backend compatibility and real database-backed Admin operations with no producer
- focused migration, repository, service, controller, security and concurrency tests

PR #124 and PR #125 delivered the Partner inbox and approved Partner producers. PR #126 delivered the
Organizer inbox and approved Organizer producers. The current implementation unit is Developer A's
Admin/shared frontend integration and Sprint closure: genuine Admin empty/failure behavior, cross-role
navigation and browser regression coverage, documentation synchronization, and final audit evidence.

## Non-negotiable implementation rules

- PostgreSQL remains durable truth; Redis remains Session-only.
- Authentication remains Spring Security Session with an HttpOnly cookie. Do not introduce JWT.
- Hibernate remains `ddl-auto: validate`; V1 through V16 are immutable.
- V16 is applied history. Developers B and C must not edit or replace it.
- Clients cannot create Notification rows or supply recipient/audience.
- Every approved producer joins the owning domain transaction; existing email remains after commit.
- No Admin producer, combined inbox, NotificationType table, sender, preference, outbox, SMS, push,
  WebSocket, SSE, polling, mock fallback or localStorage read truth is allowed.
- BR-81 equality is inclusive: Organizer Booth selection is allowed at the exact request deadline and
  rejected only when backend time is later. The canonical predicate and boundary tests must preserve it.
- Do not commit `.env`, credentials, local database URLs, demo-only data or local scripts.

## Explicitly out of scope

- notification deletion, archive, pin, snooze, reply or assignment
- generic broadcast/composer behavior
- email behavior changes, SMS, mobile push or real-time transport
- General Feedback broadcast
- Participant-volume Organizer alerts
- Admin security/account/system alert producers
- lifecycle changes to Event, Booth, Payment, Activity, Feedback, Reward, Heritage, Certificate or Badge

## Activation result

Sprint 10 documentation was reviewed and merged through PR #116. The active Business Rules, Use Case List,
MVP Scope, Sprint pointer and AI context were promoted on `2026-11-03`. Developer A reserved V16 after
confirming updated `main` contained only immutable migrations V1 through V15. PR #122 subsequently
implemented V16 and the shared role-scoped Notification backend foundation and merged it at `280588c` on
`2026-11-04`. Partner PR #124/#125 and Organizer PR #126 are also merged. V1 through V16 are immutable;
Admin/shared integration and final closure verification are the remaining Sprint 10 delivery unit.
