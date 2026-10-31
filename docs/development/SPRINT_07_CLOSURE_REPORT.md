# Sprint 7 Closure Report

- Sprint: Sprint 07 Booth Visit, Points and Badge Progression
- Status: `COMPLETED`
- Verification date: `2026-10-29`
- Physical-device verification date: `2026-10-30`
- Implemented Sprint 7 baseline: `main` through PR `#95` (`573f15a`)
- Current verified main baseline: PR `#98` (`7ab8931`)
- Schema baseline: immutable Flyway migrations V1 through V13
- Acceptance baseline: 41 Acceptance Criteria, 12 new endpoint headings and 4 Notification
  extensions

Sprint 7 is `COMPLETED`. Automated verification was supplemented by a successful physical
phone-on-LAN run during the `2026-10-30` classroom demo. The result below records the observable
flow without committing credentials, QR tokens or local network addresses.

## 1. Delivered scope

The implemented vertical slice now covers:

- Participant Booth scan with safe fragment handling, Session identity, exact Event window checks,
  EventRegistration create/reactivate/reuse and idempotent reward creation;
- one immutable PointTransaction per first BoothVisit, cumulative cross-Event totals, Badge awards
  and atomic `BADGE_UNLOCKED` Notifications;
- Participant reward summary, paged Point history, earned/progress Badge states and responsive UI;
- Partner display of the authorized Assignment QR without exposing it through list APIs;
- Event-owner-scoped Organizer BoothVisit summary, grouped and paged history;
- Admin Badge catalog/mutation and bounded, retry-safe, notification-idempotent synchronization.

No Sprint 7 migration was changed during closure. The Sprint 7 reward migration V12 remains
immutable. PR #98 later added V13 for booth-image metadata without changing the Sprint 7 reward
contract; V1 through V13 are now immutable.

## 2. Acceptance Criteria traceability

- `AC-P01-S7-01..03` and `AC-P03-S7-01..16`, `20`: `ParticipantBoothVisitServiceTests`,
  `Sprint07HibernateValidationTests`, `Sprint07SchemaMigrationTests`,
  `BadgeAwardServiceImplTests`, `RewardManagementIntegrationTests` and the Sprint 7 Booth-scan
  Playwright scenarios cover registration, privacy, exact windows, atomicity, duplicate/concurrent
  convergence, stable Points and Badge/Notification rollback boundaries.
- `AC-P03-S7-17..19`: `ParticipantRewardIntegrationTests`,
  `BadgeUnlockedNotificationIntegrationTests`, reward controller/DTO tests and Participant reward,
  scan and Notification Playwright scenarios cover durable owner-only reads, pagination, active
  progress, earned history and empty/error/mobile states.
- `AC-O07-S7-01..06`: `RewardManagementIntegrationTests` and Organizer reward-management
  Playwright scenarios cover Event ownership, counts, historical grouping, real pagination, empty
  results and secret-free output.
- `AC-A03-01..12`: `RewardManagementIntegrationTests`, migration constraints and Admin
  reward-management Playwright scenarios cover role/CSRF enforcement, normalization, validation,
  every backfill trigger/non-trigger, bounded resume, concurrent convergence and immutable earned
  history.

The real-session smoke additionally traverses Participant first/duplicate scan, Organizer
owned/empty/foreign monitoring, Admin create/synchronize/retry and Participant Badge plus exactly
one unlock Notification through the actual Session/CSRF boundary.

## 3. Automated verification evidence

Verification was executed against PostgreSQL database `bookstreet_event_test` and local Redis;
the demo database was not used as the test target.

- full backend verification: **652 tests, 0 failures, 0 errors, 1 opt-in smoke skipped**;
- the skipped real-session browser smoke was then enabled explicitly and **passed**;
- focused OpenAPI verification passed after adding an assertion for all **12 Sprint 7 route/method
  pairs**; Swagger UI availability and CSRF documentation remain covered;
- full Playwright run reached **227 passed, 3 intentionally skipped live-data tests and 2
  sub-pixel timing failures** in a shared heading assertion;
- the heading assertion was stabilized by polling until its existing one-pixel layout tolerance is
  reached; the affected spec plus all Sprint 7 browser scenarios were then rerun as a focused
  verification with **36/36 passed**;
- frontend lint passed with existing warning-only debt;
- frontend production build passed with the existing large-chunk warning;
- seven current real-session screenshots under `assets/sprint7-developer-b/` were regenerated and
  visually checked at desktop and phone widths.

GitHub Actions keeps backend tests and frontend lint/build automatic. The Playwright job is now
opt-in through the `run-e2e` Pull Request label or manual `workflow_dispatch`. The three tests that
create durable data against a live backend still require explicit `E2E_LIVE=true`; credentials in a
developer `.env` alone do not start them accidentally.

## 4. Physical phone-on-LAN closure result

- Result: **PASS**
- Date: `2026-10-30`
- Environment: a physical phone connected to a laptop-hosted Mobile Hotspot; the frontend was
  opened through its LAN-reachable origin and used the approved frontend proxy/backend setup
- Device/browser detail: a physical mobile device and mobile browser were used during the classroom
  demo; the exact model and browser version were not retained
- Security evidence: no credential, raw Booth QR token or local network address is recorded here

The demonstrated flow confirmed:

1. the Partner Assignment QR opened from the LAN frontend origin;
2. Participant authentication and the Session/CSRF-protected first scan succeeded;
3. the first valid Booth visit awarded the configured 10 Points;
4. scanning the same QR again was idempotent and did not award additional Points;
5. Participant reward totals and the Badge unlock Notification refreshed from durable data; and
6. Organizer BoothVisit monitoring reflected the visit.

The physical result was confirmed by the demo operator on `2026-10-31`, closing the final manual
gate that remained after automated verification.

## 5. Remaining debt and out-of-scope work

- Live Event/Partner application and legacy Sprint 2 Booth integration tests remain explicit local
  opt-in checks because they create durable data; Playwright runs only when requested by label or
  manual workflow dispatch.
- Existing frontend lint warnings and production bundle splitting remain general technical debt.
- General feedback/reporting, persisted Heritage/map data and broad Organizer/Partner/Admin
  notifications remain outside Sprint 7.
