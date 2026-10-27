# Sprint 7 Current-State Audit

- Status: `DRAFT - REVIEW REQUIRED`
- Audit date: `2026-10-28`
- Audited baseline: `main` at merge commit `32fd12c`
- Implemented database baseline: immutable Flyway `V1` through `V11`
- Latest completed sprint: Sprint 06 Participant Activity Registration and Attendance
- Active sprint after this audit: **none until the Project Owner approves a Sprint 7 baseline**

## 1. Purpose and guardrails

This document records what the repository actually implements before the team writes the Sprint 7
scope, Use Case Specification, API Contract or three-developer work assignment. It is an inventory,
not an approval to implement every visible screen or every target table in the ERD.

The audit follows the repository source-of-truth order:

1. Business Rules and active MVP Use Case List;
2. completed Sprint 6 baseline and Acceptance Criteria;
3. implemented Flyway schema and backend controllers;
4. frontend routes, services and screens;
5. automated-test and completion evidence.

Rules retained during planning:

- V1-V11 are immutable. Any approved schema change starts at V12.
- Authentication remains Spring Security Session plus Redis and CSRF; JWT is forbidden.
- Placeholder UI does not authorize a backend API, table, status or role.
- Post-MVP Booth change/cancellation, Partner withdrawal after approval and business refund stay
  closed unless the Project Owner explicitly changes the MVP baseline.
- Sprint 6 remains closed; Sprint 7 must not silently rewrite its 65 Acceptance Criteria.

## 2. Audit method and evidence

The audit compared:

- [`AI_CONTEXT.md`](../../AI_CONTEXT.md),
  [`CURRENT_SPRINT.md`](../sprints/CURRENT_SPRINT.md), the completed Sprint 6 baseline and
  [`SPRINT_06_COMPLETION_REPORT.md`](SPRINT_06_COMPLETION_REPORT.md);
- [`05_Business_Rules.md`](../requirements/05_Business_Rules.md),
  [`06_Use_Case_List.md`](../requirements/06_Use_Case_List.md) and the current
  [`12_Physical_ERD_Report.md`](../design/12_Physical_ERD_Report.md);
- all Spring MVC controller mapping annotations under `backend/src/main/java`;
- all API calls declared under `frontend/src/services`, the actual application routes and role
  navigation;
- Flyway migrations, backend test sources, Playwright specifications and CI configuration.

Static inventory at the audited commit:

- 11 immutable Flyway migrations and 25 active database tables;
- 39 backend controller classes with 122 mapped HTTP operations;
- 18 frontend service files;
- 28 Playwright specification files;
- 81 backend test source files.

This planning audit did not rerun the full test suites. The latest verified release evidence is the
Sprint 6 closure run: 566/566 backend tests, 44/44 focused Sprint 6 browser tests, and passing
frontend lint/build. An exploratory all-sprint Playwright run still has legacy Admin/public test
drift and is not a green release signal.

## 3. Implemented and integrated baseline

### 3.1 Authentication and profile

Implemented and wired:

- account registration, login, logout and current-account query;
- email verification confirm/resend;
- Session/Redis, cookie, CORS and CSRF browser contract;
- shared authenticated profile read/update;
- role guards for Participant, Partner, Organizer and Admin.

Not completed as an approved end-to-end flow:

- forgot password and user-owned reset password;
- secure Admin-assisted reset. The current Admin endpoint directly sets the known default
  `BookStreet@123` and returns a dummy reset token. It is implementation debt, not an acceptable
  password-recovery contract for a new sprint.

### 3.2 Event, Partner, Booth and Payment workflow

Implemented and wired:

- Organizer Event draft/list/detail/update/publish/delete/cancel;
- Partner organization and Event application workflow;
- Organizer application review;
- physical Booth catalog and Event Booth configuration;
- Partner Booth request, Organizer selection/rejection and pre-settlement withdrawal;
- VNPay Sandbox checkout, Return/IPN, query/reconciliation and Booth Assignment;
- public Event and Event-scoped Booth discovery.

Known quality gap:

- payment/assignment backend integration is covered, but automated browser-level Playwright
  payment/assignment remains technical debt.

### 3.3 Activity planning and lifecycle

Implemented and wired:

- shared Activity Locations;
- Partner proposal create/edit/resubmit/withdraw;
- Organizer proposal review and atomic Activity creation;
- Organizer Activity create/update/publish/cancel/revisions;
- Partner Activity change/cancellation requests and Organizer review;
- public Activity discovery scoped by Event;
- registration, capacity, Attendance and cancellation guards added in Sprint 6.

### 3.4 Participant participation

Implemented and wired:

- Event join/leave/My Events;
- Activity register/cancel/re-register/My Activities;
- Activity-owned shared QR and Participant self-scan Attendance;
- No-show finalization and Organizer monitoring/correction audit;
- Certificate list/detail/download and issue/revoke state;
- Activity Rating create/update and invalidation;
- Participant Notification list, unread count, mark-one-read and mark-all-read.

The Participant Notification UI is real and connected. An empty inbox is valid when no approved
domain transition has created a Notification row.

### 3.5 Dashboards

- Organizer dashboard has a real backend endpoint and real frontend integration.
- Admin dashboard and Admin user listing/mutation endpoints exist.
- Some Admin dashboard values are still placeholders at service level: Booth, Activity, today's
  Activity and seven-day audit counts are returned as zero instead of being aggregated from their
  repositories.

## 4. Active MVP slices not yet implemented

These are approved MVP concepts, but they are not present in the active V1-V11 schema and do not
have complete backend/frontend workflows.

| Slice | Use Case connection | Current state |
|---|---|---|
| Booth Visit QR | UC-P03, UC-O07 | No `booth_visits` table, entity, controller or Participant scan flow |
| Point ledger | UC-P03 | No `point_transactions` table or owner query API |
| Badge catalog/unlock | UC-P03, UC-A03 | No `badges`/`user_badges` tables or backend APIs |
| General Feedback | UC-G04 | Public form exists, but `/public/feedbacks` has no backend endpoint or persistence |
| Heritage content | UC-G01, UC-O09 | Public list intentionally returns empty; no `heritage_contents` table or backend API |
| Event reporting | UC-O08 | Organizer report service rejects as unsupported; no approved report contract |
| Forgot/reset password | UC-G03 | No user-owned recovery API or UI flow |

The current Physical ERD target/reference contains six future active-MVP tables not yet migrated:
`booth_visits`, `point_transactions`, `badges`, `user_badges`, `general_feedbacks` and
`heritage_contents`. The remaining three target-only tables are explicitly Post-MVP Booth/Partner
request references and must not be pulled into Sprint 7 by accident.

## 5. Frontend/API reconciliation findings

### 5.1 Participant

Real and connected Participant calls match the Sprint 6 contract for profile, Event/Activity
registrations, Attendance, Certificate, Rating and Notification.

Unimplemented service declarations remain for:

- `GET /participant/badges`;
- `GET /participant/points`;
- `GET /participant/registrations` (obsolete generic route; canonical Event and Activity lists are
  separate).

The Participant sidebar still exposes `/participant/rewards`, but App state never loads Badges or
Points from the backend. The screen therefore represents a planned MVP slice, not a completed
integration. The obsolete generic registration call should be removed rather than implemented.

### 5.2 Public website

Real calls:

- public Events;
- public Activities;
- Event-scoped public Booths;
- public chat endpoint.

Missing or intentionally inactive calls:

- the visible feedback form calls `POST /public/feedbacks`, which does not exist;
- Heritage list is intentionally forced to `[]`, but Heritage detail still declares
  `GET /public/heritages/{slug}`;
- map service declares `GET /public/map-hotspots`, but the current map experience is not backed by
  an approved persisted hotspot API.

### 5.3 Organizer

The supported Organizer navigation is deliberately limited to dashboard, Events, Booth requests,
Booths, Locations, Activities, participation and profile. These core tabs use real APIs.

The codebase still contains screens/types for reports, feedback, public content and Organizer
notifications. Routing currently excludes those tabs or the service explicitly reports them as
unsupported. In particular:

- Event report returns a rejected unsupported-feature promise;
- feedback listing returns an empty array and update rejects;
- Heritage create/update/delete reject as unsupported;
- Organizer notification state is empty and has no approved cross-role inbox contract.

These hidden/disabled concepts must be scoped explicitly before they become visible navigation.

### 5.4 Admin

Backend support currently covers only:

- dashboard summary;
- Admin user list/create/update/status/reset-password.

The Admin sidebar exposes additional tabs whose services call missing contracts:

- Roles/Permissions;
- Badge Rules;
- System Settings;
- Audit Logs;
- Admin Notifications;
- Admin Profile/password;
- Venues and Assets.

Important baseline conflicts:

- the project explicitly forbids `Permission`, `RolePermission` and generic `SystemSetting`
  entities, so the current Roles/Permissions and System Settings UI cannot define Sprint 7 schema;
- Assets/inventory are outside the approved MVP baseline;
- Badge management is an active MVP Use Case and is a legitimate candidate, but it requires an
  approved Badge/Point contract and schema first;
- Admin may call Organizer APIs under current security rules, so reusing the Organizer Booth
  catalog is authorized, but it should be documented as shared management behavior rather than a
  new `/admin/booths` contract.

### 5.5 Client error behavior

Core Sprint 5/6 flows expose real loading/error states and do not replace API failures with demo
records. Some Admin chrome calls intentionally catch errors and display an empty profile or empty
notifications, which can make a missing Admin API look like valid empty data. Sprint 7 planning
must either implement an approved endpoint or hide the unsupported tab; it must not preserve
silent false-success behavior.

## 6. Documentation and test drift

### 6.1 Documentation drift

`docs/README.MD` is stale. It still states that Sprint 5/V9 is the latest baseline and that Sprint
6 is not active, while `AI_CONTEXT.md`, `CURRENT_SPRINT.md`, Flyway and the Sprint 6 completion
report correctly record completed Sprint 6/V11. This should be corrected in a focused documentation
change after this audit is accepted.

The demo-workflow document describes the full hero chain through BoothVisit, Points, Badge and
Dashboard. That is a target MVP story, not evidence that those post-V11 slices are implemented.

### 6.2 Automated-test boundary

- CI runs the complete Maven verification plus frontend lint/build.
- CI does not currently run Playwright.
- Focused Sprint 5/6 browser suites are the trustworthy role-flow evidence.
- The all-sprint Playwright suite contains stale Admin/public assumptions and must be reconciled
  before it can become a CI gate.
- Admin backend behavior has no dedicated backend test package at the audited commit.

## 7. Risk-ranked backlog discovered by the audit

### P0 - must resolve before approving Sprint 7

1. Select one coherent Sprint 7 business goal; do not combine every placeholder screen.
2. Approve the schema/API owner for any V12 migration.
3. Remove or explicitly exclude contracts that conflict with the no-Permission/no-SystemSetting
   baseline.
4. Decide whether the insecure Admin reset behavior is fixed in Sprint 7 or disabled until a
   proper recovery flow is approved.

### P1 - strongest next-sprint candidate

Complete the missing hero-flow reward slice:

```text
active Booth Assignment QR
  -> Participant Booth Visit
  -> one idempotent PointTransaction
  -> total-points calculation
  -> Badge unlock/UserBadge
  -> Participant Rewards
  -> Organizer monitoring/report contribution
  -> Admin Badge catalog
```

This candidate closes UC-P03, the BoothVisit part of UC-O07 and UC-A03, matches the target ERD,
extends the demonstrated cross-role workflow and can be split safely among three developers after
the API/transaction boundaries are approved.

### P2 - separate candidate slices

- General Feedback and Organizer handling;
- Heritage/public content persistence;
- forgot/reset password and Admin account hardening;
- report/dashboard expansion;
- legacy Playwright reconciliation and CI E2E gate;
- frontend lint-warning cleanup and bundle splitting.

These should not be silently bundled into the reward slice. Each has a different schema,
authorization and test boundary.

## 8. Decisions required before the next document

The Project Owner/team should confirm:

1. Is Sprint 7 primarily the BoothVisit -> Points -> Badge hero-flow slice?
2. Does Sprint 7 also include the minimum Organizer monitoring and Admin Badge management needed
   to complete that slice?
3. Are General Feedback, Heritage, forgot/reset password and broad Admin placeholders explicitly
   excluded from Sprint 7?
4. Will Playwright reconciliation be a delivery task or only a closure gate for the approved
   Sprint 7 routes?
5. Which one developer exclusively owns V12 and shared persistence/configuration files?

## 9. Recommended documentation sequence

After this audit is reviewed, create and approve documents one at a time:

1. `docs/sprints/sprint-07.md` - goal, scope lock, flows, exclusions and Definition of Done;
2. `docs/use-cases/sprint-07-use-case-specifications.md` - numbered main/alternative flows and AC;
3. `docs/design/12_Physical_ERD_Report.md` update only if the approved scope activates target
   tables, plus one migration owner;
4. `docs/api/sprint-07-api-contract.md` - canonical endpoint/DTO/error/idempotency contract;
5. `docs/sprints/SPRINT_07_WORK_ASSIGNMENT.md` - three-developer ownership and merge gates;
6. `docs/development/SPRINT_07_TEST_PLAN.md` - automated/manual evidence and demo dataset;
7. update `CURRENT_SPRINT.md`, `AI_CONTEXT.md` and `docs/README.MD` only after the baseline review.

No Sprint 7 implementation branch should start before items 1-5 agree on the same business and
API boundaries.
