# Current Sprint

## Sprint 09 Heritage Public Content

- Status: `ACTIVE`
- Activation date: `2026-11-01`
- Latest completed Sprint: `Sprint 08 General Feedback Submission and Organizer Handling`
- Approved documentation merge: PR #105, merge commit `7e46809`
- Implemented schema baseline: immutable Flyway migrations `V1` through `V14`
- Expected next Heritage migration: candidate `V15` only if it is still free when reserved
- Sprint baseline: `docs/sprints/sprint-09.md`
- Current-state audit: `docs/development/SPRINT_09_HERITAGE_CURRENT_STATE_AUDIT.md`
- Documentation audit: `docs/development/SPRINT_09_DOCUMENTATION_AUDIT.md`
- Use Case Specifications: `docs/use-cases/sprint-09-use-case-specifications.md`
- API Contract: `docs/api/sprint-09-api-contract.md`
- Physical ERD source: `docs/design/12_Physical_ERD_Report.md` plus
  `docs/design/SPRINT_09_HERITAGE_PHYSICAL_ERD_OVERLAY.md`
- Implementation and ownership plan: `docs/sprints/SPRINT_09_IMPLEMENTATION_PLAN.md`
- Developer handoff: `docs/development/SPRINT_09_HERITAGE_IMPLEMENTATION_HANDOFF.md`
- Latest closure evidence: `docs/development/SPRINT_08_CLOSURE_REPORT.md`

## Sprint goal

Deliver Heritage as one coherent PostgreSQL-backed content-management slice:

1. A Guest can browse a public Heritage list and open public Heritage detail.
2. Public reads expose only published Heritage content and never leak Draft or Archived records.
3. Every verified Organizer manages the same shared Heritage collection.
4. Organizer commands provide create, list, detail, update, publish, archive and republish behavior
   with the approved lifecycle and optimistic concurrency contract.
5. Existing General Feedback, Event ownership, Session, CSRF and completed Sprint behavior remain
   unchanged.

## Scope and acceptance baseline

The active implementation is limited to:

- `UC-G01 Browse Heritage Content`
- `UC-O09 Manage Heritage Content`
- one `heritage_contents` table with the approved 11 columns, nine checks and two indexes
- the exact `DRAFT`, `PUBLISHED` and `ARCHIVED` lifecycle
- one shared Organizer collection without per-Organizer ownership
- real public and Organizer frontend integration
- focused migration, backend, frontend and browser verification

The approved baseline contains **28 Acceptance Criteria**:

- 14 Organizer criteria: `AC-O09-S9-01` through `AC-O09-S9-14`
- 8 public criteria: `AC-G01-S9-01` through `AC-G01-S9-08`
- 3 database criteria: `AC-S9-DB-01` through `AC-S9-DB-03`
- 3 regression criteria: `AC-S9-REG-01` through `AC-S9-REG-03`

The API Contract defines exactly ten operations. These are two public reads and eight Organizer
operations. The implementation must preserve the approved routes, DTOs, errors, authorization,
transactions, lifecycle rules and `expectedUpdatedAt` concurrency contract.

## Ownership

The **Project Owner** exclusively owns the Heritage Flyway migration SQL after updating from
`main`, listing every existing migration and reserving the next free version.

One assigned **Sprint 09 Heritage Owner** owns the application slice and evidence for all 28
Acceptance Criteria, including:

- Heritage entity, repository and persistence integration
- backend public and Organizer APIs
- security, CSRF, lifecycle and concurrency behavior
- public and Organizer Heritage UI integration
- focused backend, frontend and browser tests
- implementation traceability and closure evidence

The Heritage Owner consumes the migration supplied by the Project Owner and does not independently
create or edit a competing migration. Notification work remains separate and must not reserve or
reuse the same Flyway version.

## Mandatory delivery order

1. The Project Owner updates from `main`, confirms the next free Flyway version, reserves it and
   creates the single Heritage migration.
2. `S9-H1 Heritage domain foundation` integrates the supplied migration with the entity,
   repository and focused schema tests.
3. `S9-H2 Heritage backend APIs` implements all approved public and Organizer operations.
4. `S9-H3 Public Heritage frontend` connects the real public list and detail experience.
5. `S9-H4 Organizer Heritage frontend` connects the real management workflow.
6. `S9-H5 Verification and closure` completes focused regression, traceability and closure
   evidence.

## Non-negotiable implementation rules

- PostgreSQL is durable truth. Redis stores server-side Session only.
- Authentication remains Spring Security Session with an HttpOnly cookie. Do not introduce JWT.
- Hibernate remains `ddl-auto: validate`. V1 through V14 are immutable.
- The migration filename is not reserved by this document. The Project Owner must recheck before
  creating it.
- The Heritage schema has exactly the approved columns, constraints and indexes.
- Heritage statuses are exactly `DRAFT`, `PUBLISHED` and `ARCHIVED`.
- Public list and detail expose only `PUBLISHED` records.
- Every verified Organizer manages the same collection. Admin-only access is denied.
- Heritage remains independent from General Feedback and is not a Feedback target.
- Published content is not hard deleted. The approved removal behavior is archive.
- Mutating existing Heritage records uses `expectedUpdatedAt` to detect stale writes.
- Do not commit `.env`, credentials, local IPs, local scripts or demo-only content.

## Explicitly out of scope

- Heritage Feedback, rating, comments or moderation queue
- Heritage ownership per Organizer
- Heritage localization, version history or approval workflow
- media upload, image processing or asset storage changes
- categories, tags, search engine integration or recommendation behavior
- Admin Heritage API or UI
- Notification delivery caused by Heritage changes
- reports, analytics, map integration or unrelated frontend refactors

## Activation result

PR #105 approved and merged the Sprint 9 current-state audit, product baseline, Physical ERD
overlay, 28-AC Use Case Specification, ten-operation API Contract, implementation plan, developer
handoff and documentation audit at merge commit `7e46809`.

Sprint 9 is active from `2026-11-01`. At activation, the repository still contains only immutable
migrations V1 through V14 and no Heritage application implementation. Candidate V15 is an expected
next version, not a reservation. Implementation begins only after the Project Owner completes the
migration reservation gate above.
