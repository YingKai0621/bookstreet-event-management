# Current Sprint

## Sprint 07 Booth Visit, Points and Badge Progression

- Status: `ACTIVE`
- Activation date: `2026-10-28`
- Previous completed Sprint: `Sprint 06 Participant Activity Registration and Attendance`
- Implemented schema baseline: immutable Flyway migrations `V1` through `V11`
- Planned Sprint 7 migration: `V12__create_sprint7_reward_schema.sql`, owned only by Developer A
- Sprint baseline: `docs/sprints/sprint-07.md`
- Current-state audit: `docs/development/SPRINT_07_CURRENT_STATE_AUDIT.md`
- Use Case Specifications: `docs/use-cases/sprint-07-use-case-specifications.md`
- API Contract: `docs/api/sprint-07-api-contract.md`
- Physical ERD: `docs/design/12_Physical_ERD_Report.md`
- Backend and Frontend Work Assignment: `docs/sprints/SPRINT_07_BACKEND_WORK_ASSIGNMENT.md`
- Sprint 6 regression reference: `docs/development/SPRINT_06_COMPLETION_REPORT.md`

## Sprint goal

Deliver the Booth visit reward journey as one coherent vertical slice:

1. Partner displays the existing authorized BoothAssignment QR through a secure frontend route.
2. An authenticated Participant scans during the exact ongoing Event window.
3. The first valid visit atomically creates one BoothVisit and one immutable 10-Point transaction.
4. Cumulative Points unlock eligible Badges and one durable Notification per new UserBadge.
5. Participant views real reward totals, Point history, Badge progress and unlock notifications.
6. Organizer monitors Event-owned Booth visits by summary, Booth group and paginated records.
7. Admin manages Badge definitions and bounded, retry-safe award synchronization.

## Scope and acceptance baseline

Implementation is limited to these approved slices:

- `UC-P01` Booth-scan EventRegistration create/reactivate/reuse extension
- `UC-P03` BoothVisit, PointTransaction, Badge/UserBadge and reward Notification progression
- `UC-O07` Event-owned BoothVisit monitoring
- `UC-A03` Badge catalog and bounded synchronization

The active baseline contains **41 Acceptance Criteria**, **12 new endpoint headings** and extensions
to **4 existing Participant Notification operations**. Every implementation PR must identify its
owned AC IDs and follow the exact route, DTO, error-code, transaction, locking, privacy and
idempotency behavior in the approved API Contract.

## Ownership

- **Developer A:** sole V12/reward-write owner; shared Badge award boundary; Booth scan command;
  Partner QR surfaces and Participant scan route/page. Primary owner of 20 AC.
- **Developer B:** Organizer BoothVisit APIs and Event-scoped UI; Admin Badge CRUD, bounded
  synchronization APIs and UI. Primary owner of 18 AC.
- **Developer C:** Participant reward read APIs and Rewards/Badge Notification UI; frontend
  consistency review and cross-role end-to-end closure. Primary owner of 3 AC.

Frontend ownership follows the vertical feature slice. Only one declared owner may edit a shared
frontend file in one PR. Only Developer A may create or edit Sprint 7 migration V12, reward command
entities or the backend `BADGE_UNLOCKED` writer.

## Mandatory delivery order

1. `S7-1` — Developer A: V12, reward entities/repositories, configuration, Notification extension
   and shared Badge award boundary.
2. `S7-2A` — Developer A: Participant Booth scan write flow and concurrency tests.
3. `S7-2B` — Developer A: Partner QR integration and mobile-first Participant scan UI.
4. `S7-3A` — Developer B: Organizer BoothVisit API and Event-scoped monitoring UI.
5. `S7-3B` — Developer B: Admin Badge/backfill API and management UI.
6. `S7-3C` — Developer C: Participant reward read API, Rewards UI and Badge Notification support.
7. `S7-4` — Developer C coordinates cross-role verification, phone-on-LAN smoke, Playwright and
   documentation closure.

S7-3A, S7-3B and S7-3C may proceed in parallel only after S7-1 is merged. Do not merge around an
unmet earlier dependency. Detailed file ownership and gates are in the approved work assignment.

## Non-negotiable implementation rules

- PostgreSQL is durable truth; Redis stores Session only; do not introduce JWT.
- Hibernate remains `ddl-auto: validate`; V1 through V11 are immutable.
- Backend `Clock` decides Event lifecycle and the exact `[startAt, endAt)` scan window.
- Participant identity comes from Session; no command accepts caller-selected User or reward data.
- One first visit awards exactly `10` Points from `rewards.booth-visit-points=10`.
- Point total is ledger-derived; do not add a duplicated User balance.
- UserBadge and its `BADGE_UNLOCKED` Notification commit atomically and remain historical.
- Badge backfill processes at most 100 Users per transaction and uses the shared award boundary.
- Raw Booth QR token stays in client-only fragment state and the HTTPS request body; it must not
  appear in backend paths, queries, responses, logs, notifications or committed evidence.
- Keep Activity Attendance QR and every completed Sprint 1-6 behavior backward compatible.
- Each backend feature connects its smallest usable UI before the vertical slice closes, except the
  documented shared foundation and scan-API dependency PRs.

## Explicitly out of scope

- Event entrance QR, Participant-specific QR or changes to Activity Attendance QR
- Point spending, transfer, expiry, redemption or manual adjustment
- manual Badge award/revoke, Badge hard delete or removal of earned history
- generic settings, roles/permissions, notification composer or preference system
- email, SMS or push delivery for Badge unlocks
- unbounded reporting beyond the approved Organizer BoothVisit monitoring slice
- rewriting V1 through V11 or introducing a persistent backfill-job table

## Activation result

The Project Owner approved and merged the Sprint 7 audit, baseline, 41-AC Use Case Specification,
API Contract and three-developer vertical-slice work assignment through PR #86. Sprint 7 is active
from 2026-10-28. The next implementation task is `S7-1` on a new branch from updated `main`.
