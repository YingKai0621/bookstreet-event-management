# Sprint 10 Role-Scoped Notifications Documentation Audit

- Audit date: `2026-11-03`
- Result: `PASS - ACTIVATED FOR FOUNDATION`
- Repository baseline inspected during review: `main` at `0deac77`
- Approved documentation merge: PR #116, merge commit `3a0a76b`
- Activation date: `2026-11-03`
- Applied schema baseline: immutable Flyway `V1` through `V15`
- Production code or migration changed by this documentation audit: no

The original review found the candidate documents mutually consistent. PR #116 then approved and merged
them. The activation update promotes the reviewed scope into the active project context and reserves V16
for Developer A without creating application code or a migration file.

## 1. Reviewed set

1. `docs/development/SPRINT_10_ROLE_NOTIFICATIONS_CURRENT_STATE_AUDIT.md`
2. `docs/sprints/sprint-10.md`
3. `docs/use-cases/sprint-10-use-case-specifications.md`
4. `docs/api/sprint-10-api-contract.md`
5. `docs/design/SPRINT_10_ROLE_NOTIFICATIONS_PHYSICAL_ERD_OVERLAY.md`
6. `docs/sprints/SPRINT_10_IMPLEMENTATION_PLAN.md`
7. `docs/sprints/SPRINT_10_TEAM_ASSIGNMENT.md`
8. current Business Rules, Use Case List, MVP Scope, Physical ERD report, Flyway V1–V15, security,
   Notification/domain code, role frontend routes/adapters, and relevant tests

At review time, `CURRENT_SPRINT.md`, `AI_CONTEXT.md`, and the active Business Rules/Use Case/MVP baseline
remained unchanged. The 2026-11-03 activation update promotes the approved scope into those active files.

## 2. Final scope

The reviewed candidate defines one bounded extension:

- the existing PostgreSQL `notifications` table remains the only durable inbox store
- every row gains an exact persisted audience: `PARTICIPANT`, `PARTNER`, `ORGANIZER`, or `ADMIN`
- Participant keeps its six implemented producers and response meanings
- Partner receives only the seven approved outcome/impact families
- the owning Organizer receives only the six approved work-item families
- Admin receives real role-isolated list/read infrastructure but no type, row, or producer
- General Feedback remains its Sprint 8 shared queue and produces no broadcast Notification
- creation is atomic with the owning domain transition and retry-safe by persisted transition identity
- mark-one and mark-all preserve the first committed `readAt`
- four exact role endpoint families expose 16 operations
- no JWT, email API change, SMS, push, WebSocket, SSE, polling, preferences, composer, sender, type table,
  delivery-attempt table, Redis inbox state, or transactional outbox is introduced

## 3. Corrections confirmed

### 3.1 Role and read-state isolation

User-only ownership was unsafe for multi-role accounts. The reviewed schema, queries, mutations, unique
identity, and endpoint authority all include the exact role audience. Mark-one uses a conditional
owner/role/unread update and reload, eliminating the current read-modify-write race.

### 3.2 Closed producer boundaries

Partner and Organizer types map to exact references and committed transitions. Event/Activity cancellation,
zero-price Booth selection, settlement, and request outcomes have explicit suppression precedence. Admin
has no compatible type/reference branch, so both the writer and database reject Admin rows.

### 3.3 Booth re-selection

The Organizer re-selection row references the released terminal Booth request. It is created only after a
safe `WITHDRAWN` or `PAYMENT_EXPIRED` transition and only when a different pending candidate passes the
same canonical selection eligibility predicate. Payment uncertainty, an expired selection window, pending
withdrawal, or no eligible candidate produces no work item.

### 3.4 Safe navigation and frontend truthfulness

The response adds server-derived `contextEventId` without persisting a duplicate Event FK or returning an
arbitrary URL. Participant, Partner, and Organizer navigation use closed type/reference allowlists. The
Partner redirected inbox and Organizer unsupported notification route are explicit implementation tasks.
Admin must distinguish genuine empty from failure, use paged GET/POST contracts, and remove fabricated
Security/Account/System categories.

### 3.5 Refresh and scope

Approved refresh boundaries are workspace entry, popover/full-inbox open, and confirmed read mutation.
Browser-focus refresh is not required; continuous polling and fake real-time behavior are forbidden.

## 4. Acceptance Criteria and API consistency

The Sprint baseline and Use Case Specifications contain the same **52 unique criteria**:

- 11 shared foundation
- 7 Participant
- 13 Partner
- 10 Organizer
- 5 Admin
- 6 regression

The API traceability section maps every group to reviewed contract and verification sections. The
implementation plan assigns delivery/evidence across five PRs, and the three-developer assignment gives
exclusive ownership for migration/shared core, Partner, and Organizer work while coordinating shared
Booth/Payment and frontend files.

The contract defines exactly 16 operations: paged list, unread count, mark-one, and mark-all for each of
the four roles. It fixes User and audience from the Session/endpoint, uses POST plus CSRF for mutations,
returns ownership-safe not-found, and accepts no recipient, role, reference, URL, or creation command.

## 5. Schema consistency

The target table has 17 columns: the existing 12, `recipient_role`, and four explicit domain FKs. The
overlay preserves all Participant rows by backfilling `PARTICIPANT`, keeps V1–V15 immutable, and defines:

- exact role/type/reference compatibility with exactly one physical reference
- unique `(recipient_user_id, recipient_role, deduplication_key)`
- four new `ON DELETE RESTRICT` FKs
- created, unread, read-time, and new-reference indexes aligned with the API ordering contract
- no seed Notification and no Admin-compatible row

`contextEventId` is derived through these validated relationships and is not another physical column.

## 6. Evidence run during staged review

- 52/52 literal Acceptance Criteria match between Sprint and Use Case Specifications
- all six Organizer types fit the existing `VARCHAR(60)` type limit
- focused Participant Notification/domain unit tests passed during Participant review
- focused Partner message/final-state unit tests passed during Partner review
- 23/23 Security and Notification unit tests passed during Admin review
- `git diff --check` passed; only line-ending conversion warnings were emitted
- no conflict markers and no changed file outside `docs/`
- at review time, active Business Rules, Use Case List, and MVP Scope were byte-equivalent to their
  pre-candidate baseline; the activation update intentionally promotes the approved decisions

Database integration suites were not run because `EVENT_TEST_DATABASE_URL` is not configured. The demo
database in `.env` was intentionally not used as automated-test storage. Migration, Hibernate, integration,
frontend build, and Playwright evidence remain implementation gates rather than documentation claims.

## 7. Activation outcome and remaining delivery gates

1. Completed: PR #116 approved and merged the candidate documentation at `3a0a76b`.
2. Completed by the activation update: Business Rules, Use Case List, MVP Scope, `CURRENT_SPRINT.md`,
   `AI_CONTEXT.md`, and `docs/README.MD` promote Sprint 10 as active.
3. Completed: Developer A (`YingKai0621`) updated from merged `main`, confirmed V1 through V15, found no
   competing production migration and reserved V16 exclusively. No V16 file exists under the configured
   Flyway location `db/migration`; the pre-existing `db/demo/V16__seed_event_deadline_and_registration_scenarios.sql`
   is a manually run demo seed outside Flyway's configured location.
4. Remaining before PR 1 code: merge this activation update, refresh from `main`, and reconfirm no branch
   has claimed V16 or shared Notification/security files.
5. Before PR 2/PR 3: teammates agree who takes the documented Developer B and C work packages and
   coordinate branch ownership. Personal names do not need to be persisted in project documentation.
6. Remaining before `AC-O-S10-06`: resolve the BR-81 exact-deadline equality discrepancy separately.
   Sprint 10 must reuse the canonical selection predicate and must not silently widen it. This does not
   block PR 1 foundation.

## 8. Verdict

`PASS - ACTIVATED FOR FOUNDATION`.

The active documentation is bounded, role-safe and traceable across all 52 criteria. Developer A may begin
the reviewed foundation only after this activation update merges and the pre-code ownership check passes.
Partner/Organizer delivery remains subject to the role, branch and merge-order coordination above. No
further document-by-document product audit is needed unless scope changes.
