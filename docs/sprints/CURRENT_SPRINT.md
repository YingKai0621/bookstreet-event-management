# Current Sprint

## Sprint 07 Booth Visit, Points and Badge Progression

- Status: `COMPLETED`
- Activation date: `2026-10-28`
- Completion date: `2026-10-30`
- Previous completed Sprint: `Sprint 06 Participant Activity Registration and Attendance`
- Implemented schema baseline: immutable Flyway migrations `V1` through `V13`
- Sprint 7 migration: `V12__create_sprint7_reward_schema.sql`, implemented by Developer A and
  merged through PR #92 (merge commit `2178ba6`)
- Post-baseline booth-image migration: `V13__add_booth_image_url.sql`, merged through PR #98;
  it does not change the Sprint 7 reward contract or its V12 migration
- Sprint baseline: `docs/sprints/sprint-07.md`
- Current-state audit: `docs/development/SPRINT_07_CURRENT_STATE_AUDIT.md`
- Use Case Specifications: `docs/use-cases/sprint-07-use-case-specifications.md`
- API Contract: `docs/api/sprint-07-api-contract.md`
- Physical ERD: `docs/design/12_Physical_ERD_Report.md`
- Backend and Frontend Work Assignment: `docs/sprints/SPRINT_07_BACKEND_WORK_ASSIGNMENT.md`
- Sprint 6 regression reference: `docs/development/SPRINT_06_COMPLETION_REPORT.md`
- Sprint 7 closure evidence: `docs/development/SPRINT_07_CLOSURE_REPORT.md`

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

The completed baseline contains **41 Acceptance Criteria**, **12 new endpoint headings** and extensions
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

1. `S7-1` — complete in PR #92: V12, reward entities/repositories, configuration, Notification
   extension and shared Badge award boundary.
2. `S7-2A` — complete in PR #92: Participant Booth scan write flow and concurrency tests.
3. `S7-2B` — complete in PR #92: Partner QR integration and mobile-first Participant scan UI.
4. `S7-3A` — complete in PR #93 (merge commit `1b95584`): Organizer BoothVisit API and
   Event-scoped monitoring UI.
5. `S7-3B` — complete in PR #93: Admin Badge/backfill API and management UI.
6. `S7-3C` — complete through PR #95 (merge commit `573f15a`): Participant reward read integration
   coverage, Badge Notification integration and frontend consistency gaps are closed.
7. `S7-4` — complete: automated backend, OpenAPI, real-session and Playwright verification is
   recorded in the closure report, and the physical phone-on-LAN flow passed during the
   `2026-10-30` classroom demo.

Detailed historical ownership and merge gates remain in the approved work assignment. New work
must preserve the V12/PR #95 reward baseline and must not duplicate the shared award or Participant
reward implementations.

## Non-negotiable implementation rules

- PostgreSQL is durable truth; Redis stores Session only; do not introduce JWT.
- Hibernate remains `ddl-auto: validate`; V1 through V13 are immutable.
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
- rewriting V1 through V13 or introducing a persistent backfill-job table

## Completion result

The Project Owner approved and merged the Sprint 7 audit, baseline, 41-AC Use Case Specification,
API Contract and three-developer vertical-slice work assignment through PR #86. PR #92 delivered
V12, the reward write/scan foundation and Participant reward experience. PR #93 delivered
Organizer BoothVisit monitoring and Admin Badge synchronization. PR #95 completed Developer C's
Participant integration coverage and frontend consistency pass. The physical phone-on-LAN flow
passed during the `2026-10-30` classroom demo, covering first scan, duplicate-scan idempotency,
Participant reward and Notification refresh, and Organizer BoothVisit monitoring. Sprint 7 is
therefore completed; PR #98 subsequently added demo/public-experience improvements without changing
the approved Sprint 7 reward behavior.
