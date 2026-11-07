# Sprint 07 Backend and Frontend Work Assignment

> Status: `APPROVED - ACTIVE 2026-10-28`.
>
> This approved document divides active Sprint 7 among three developers. Implementation branches
> must follow its vertical-slice ownership, merge order and completion gates.

## 1. Purpose and implementation boundary

Sprint 7 delivers the BoothVisit, Point and Badge progression slice without changing the completed
Sprint 6 Activity Attendance flow. Work is divided into vertical feature slices: after a developer
finishes an API boundary, that same developer connects the smallest usable screen, panel or modal
for immediate visual verification. V12 and the shared award boundary still have one exclusive owner.

All implementation must follow these sources of truth in order:

1. `docs/requirements/05_Business_Rules.md`
2. `docs/requirements/06_Use_Case_List.md`
3. `docs/requirements/08_MVP_Scope_v2.md`
4. `docs/sprints/sprint-07.md`
5. `docs/use-cases/sprint-07-use-case-specifications.md`
6. `docs/design/12_Physical_ERD_Report.md`
7. `docs/design/BookStreet_Physical_ERD_v1.drawio`
8. `docs/api/sprint-07-api-contract.md`
9. This work-assignment document

The Sprint 7 API contract is frozen once approved. Any semantic change to a route, DTO, status,
validation boundary, error code, transaction, lock order or V12 constraint requires a documentation
change and Project Owner approval before code changes.

### 1.1 In scope

- V12 BoothVisit, PointTransaction, Badge and UserBadge persistence.
- The smallest compatible `notifications` extension for `BADGE_UNLOCKED`.
- Participant BoothAssignment QR scan with EventRegistration create/reactivate/reuse behavior.
- Atomic first visit, immutable 10-Point transaction and threshold-based Badge awards.
- Duplicate/concurrent scan convergence.
- Participant reward summary, Point history, earned Badges and active Badge progress.
- Organizer Event-owned BoothVisit summary, Booth grouping and paginated records.
- Admin Badge catalog, validation, activation/deactivation and bounded backfill.
- Participant, Partner, Organizer and Admin frontend integration required by the approved contract.
- Automated migration, authorization, idempotency, concurrency and UI verification.
- A focused phone-on-LAN demo flow plus a desktop route-opening fallback for local demonstration.

### 1.2 Explicitly out of scope

- Event entrance ticket/QR or Participant-specific QR.
- Changes to Activity Attendance QR semantics or its Sprint 6 APIs.
- Point spending, transfer, expiry, redemption or manual adjustment.
- Manual Badge grant/revoke or Badge hard delete.
- Public Badge catalog.
- Generic System Settings, Permission or RolePermission features.
- Notification composer, preference, broadcast, email, SMS or push delivery.
- Organizer UC-O08 reporting beyond the approved BoothVisit monitoring slice.
- Rewriting migrations V1 through V11.
- Hardcoded localhost, LAN IP, credentials, Session cookie, CSRF token or QR token in committed
  source/evidence.

## 2. Three-developer ownership summary

### Developer A — foundation, Booth scan and QR experience owner

Developer A is the sole owner of V12, new reward persistence, the Badge award primitive,
`BADGE_UNLOCKED` write semantics and the complete Booth scan slice: Partner QR display, secure
fragment capture, Participant scan page and scan transaction.

Primary Acceptance Criteria:

- `AC-P01-S7-01` through `AC-P01-S7-03`;
- `AC-P03-S7-01` through `AC-P03-S7-16`;
- `AC-P03-S7-20`.

Total primary ownership: **20 criteria**.

### Developer B — Organizer monitoring and Admin Badge slice owner

Developer B owns Organizer BoothVisit monitoring and its Event-scoped UI, plus Admin Badge CRUD,
after-commit synchronization, bounded backfill APIs and their Admin UI. Developer B consumes
Developer A's persistence and award boundary and does not create a second award implementation.

Primary Acceptance Criteria:

- `AC-O07-S7-01` through `AC-O07-S7-06`;
- `AC-A03-01` through `AC-A03-12`.

Total primary ownership: **18 criteria**.

### Developer C — Participant rewards and frontend consistency owner

Developer C owns Participant reward query APIs, Rewards and Badge Notification UI, shared frontend
consistency review and final cross-role end-to-end verification. Developer C does not implement the
Organizer, Admin or Booth-scan UI owned by Developers B and A.

Primary Acceptance Criteria:

- `AC-P03-S7-17` through `AC-P03-S7-19`;
- Participant reward/Notification frontend evidence and final cross-role end-to-end evidence.

Total primary ownership: **3 numbered criteria plus Participant frontend and integration closure**.

The lower numbered-criterion count is intentional. Developer C owns Participant read/UI delivery,
reviews shared frontend conventions across all slices and coordinates Playwright plus the final
phone demo flow. Developers A and B remain responsible for tests and visual evidence for their own
screens.

The primary counts are unique and total **41 Acceptance Criteria**. Cross-developer verification is
still required where one flow calls another developer's boundary.

## 3. Shared engineering rules

These rules apply to all three developers.

### 3.1 Database and configuration

- Developer A is the only developer allowed to create or edit Sprint 7 migration `V12`.
- V1 through V11 are immutable.
- Developer A owns the server property `rewards.booth-visit-points=10` and its startup validation.
- No User balance column, backfill job table or generic settings table may be added.
- Hibernate remains `ddl-auto: validate`; PostgreSQL is durable truth and Redis stores Session only.
- Store instants in UTC; `Asia/Ho_Chi_Minh` is presentation-only.
- No local demo credential or account seed belongs in V12.

### 3.2 Transaction and concurrency

- Backend `Clock` is authoritative for lifecycle and visit time.
- First scan follows the approved lock order:

```text
Event
  -> BoothAssignment
  -> EventRegistration
  -> BoothVisit
  -> PointTransaction
  -> Badge by ascending badgeId
  -> UserBadge by ascending badgeId
  -> Notification
```

- Badge mutation, scan evaluation and backfill recheck the locked current Badge rule.
- Unique database constraints are the final duplicate guard; service checks alone are insufficient.
- UserBadge and its `BADGE_UNLOCKED` Notification are atomic.
- A backfill transaction handles at most 100 Users and never spans two batches.
- No developer may add an alternative scan, award or Notification insertion path to bypass the
  shared command boundary.

### 3.3 Security and privacy

- Keep the Redis-backed Session and CSRF model; do not introduce JWT.
- Participant identity comes from Session. Commands do not accept caller-selected `userId`.
- Organizer monitoring verifies ownership of the parent Event before querying rows or totals.
- Admin Badge mutation requires ADMIN authority.
- Raw Booth QR token is never returned by new Participant, Organizer or Admin APIs.
- QR token must not enter a backend path/query, analytics, Notification, exception text or log.
- Request-body logging must omit or redact the scan `token` field.
- Missing/foreign private resources use the ownership-safe outcomes in the API contract.

### 3.4 File ownership and conflict prevention

- Every file has one primary owner per PR. Cross-owner edits require a coordination note in the PR
  description before the edit is made.
- Developer A owns all new reward entities and command-side repositories. Developers B and C request
  foundation changes through Developer A instead of patching entity invariants independently.
- Developer A owns backend Notification entity/type/reference/writer changes for
  `BADGE_UNLOCKED`. Developer C owns the corresponding frontend model and inbox presentation.
- Frontend ownership follows the feature slice: A owns Booth scan/Partner QR files, B owns
  Organizer/Admin reward files and C owns Participant reward/Notification files.
- Prefer feature-specific adapters such as `boothVisitApi.ts`, `rewardApi.ts` and
  `badgeAdminApi.ts`; do not make unrelated developers concurrently edit a giant shared adapter.
- `frontend/src/App.tsx` has one owner per PR. Developer A owns the scan-route edit; later route
  changes require an explicit handoff rather than a parallel edit.
- Shared DTOs and enums are defined once. Do not duplicate response shapes in role-specific packages.
- Exceptions use the approved HTTP status, stable code and field-error shape; no SQL or stack trace
  reaches the UI.

## 4. Developer A — V12, shared award core and Booth scan experience

Developer A delivers the foundation before Developer B or C backend feature PRs merge.

### 4.1 Sole V12 ownership

Create exactly one Sprint 7 migration:

```text
backend/src/main/resources/db/migration/V12__create_sprint7_reward_schema.sql
```

It implements:

- `booth_visits` with unique `(event_registration_id, booth_assignment_id)`;
- `point_transactions` with unique `booth_visit_id` and positive Points;
- `badges` with normalized case-insensitive unique name, positive threshold and active state;
- `user_badges` with unique `(user_id, badge_id)`;
- `notifications.badge_id`, `BADGE_UNLOCKED` and the extended exact-reference CHECK;
- every foreign key, delete behavior, timestamp/check constraint and index frozen in section 13 of
  the API contract.

Developer A proves both paths:

- clean database: `V1 -> V12`;
- current baseline: `V11 -> V12`.

### 4.2 Persistence and domain foundation

Developer A owns:

- BoothVisit, PointTransaction, Badge and UserBadge entities;
- command-side repositories and pessimistic-lock queries;
- immutable Point amount and timestamp behavior;
- Badge normalization and entity mutation invariants;
- Notification Badge reference/type/entity/writer extension;
- reward configuration binding and positive-value startup validation;
- schema/persistence tests required before downstream services merge.

New code belongs in one coherent reward feature package. Do not create separate global entity or
repository packages. Existing Event, Booth, Registration and Notification packages are reused where
the relationship already exists.

### 4.3 Shared Badge award boundary

Developer A owns the only command boundary that:

- receives trusted User/current-total context from scan or backfill orchestration;
- locks relevant Badge rows in ascending identity order;
- rechecks active state and threshold;
- inserts only missing UserBadge rows;
- inserts one stable UserBadge-derived `BADGE_UNLOCKED` Notification per new award;
- returns newly awarded Badges in ascending `badgeId`;
- recovers scan/backfill uniqueness races into one achieved result.

The boundary must support both use cases without duplicating logic:

- evaluate all newly eligible active Badges after a first visit;
- evaluate one locked Badge for one backfill candidate User.

Developer B owns batch selection/orchestration, not the insertion primitive.

### 4.4 Participant Booth scan command

Implement:

```text
POST /api/v1/participant/booth-visits/scan
```

Responsibilities:

- bind token as opaque String and redact it from logs;
- resolve Assignment without disclosing malformed/unknown-token context;
- lock and advance Event lifecycle before the exact `[startAt,endAt)` check;
- require current Assignment status ACTIVE;
- create, reactivate or reuse EventRegistration even after the ordinary registration deadline;
- revalidate Event/Assignment/Registration relationships under lock;
- atomically create first BoothVisit, PointTransaction, UserBadges and Notifications;
- return the contract's first-visit or already-visited response;
- reject an expired retry as lifecycle-invalid while retaining prior history.

The implementation must reuse existing Event lifecycle and EventRegistration behavior rather than
creating a second registration state machine.

### 4.5 Booth QR and scan frontend

After the scan API is stable, Developer A connects the complete scan experience in the same feature
slice:

- update all authorized Partner BoothAssignment QR surfaces currently found in
  `PartnerAssignedBoothsPage`, `PartnerBoothDetailPage` and `BoothPaymentPage`;
- encode `<runtime-public-origin>/participant/booth-scan#token=<opaque-token>`, never a raw-token-only
  value or backend URL;
- capture the fragment before the Participant auth guard redirects, then immediately remove it from
  the visible URL and browser history;
- preserve only short-lived, Booth-scan-namespaced client state through login and clear it on logout,
  definitive result or abandoned flow;
- provide a dedicated mobile-first scan page for success, duplicate, invalid, not-open, closed,
  inactive Assignment, forbidden and retryable network outcomes;
- invalidate or signal Participant reward/Notification data after a successful first scan without
  introducing interval polling or unrelated role requests;
- leave the Sprint 6 Activity Attendance QR route unchanged and derive the public origin at runtime.

This flow uses a dedicated route/page rather than a modal because it must survive external QR
navigation, authentication redirect and mobile browser history. Developer A owns the scan-route
change in `App.tsx` and the Booth-scan token helper.

### 4.6 Developer A direct tests

- V12 clean/upgrade migration and Hibernate validation.
- Every V12 unique, FK, CHECK and Notification reference branch.
- Configuration absent, malformed, zero, negative and approved value 10.
- Malformed/unknown QR token indistinguishability and log redaction.
- Before/at/inside/at-end/after Event window boundaries with fixed `Clock`.
- Assignment RELEASED, CANCELLED and ENDED rejection.
- EventRegistration create, LEFT reactivation and ACTIVE reuse.
- Cross-Event relationship inconsistency rollback.
- First scan atomic rollback at Point, Badge and Notification failure boundaries.
- Duplicate and concurrent same-QR scans produce one visit/transaction.
- One scan unlocks zero, one and multiple Badges.
- Scan/backfill same-User/Badge race produces one UserBadge and Notification.
- QR fragment capture, immediate URL cleanup, login resume and cleanup after result.
- All three Partner QR surfaces encode the same runtime frontend route.
- Every documented scan outcome maps to a stable UI state without mock fallback.
- Focused frontend build, lint and component tests for the files owned by Developer A.

### 4.7 Developer A completion gate

Developer A is complete only when:

- V12 passes both migration paths and schema validation;
- no prior migration is modified;
- first visit commits one complete reward outcome;
- exact duplicate inside the valid window returns achieved identities;
- concurrency tests prove no duplicate Point, UserBadge or Notification;
- raw token does not appear in responses or captured application logs;
- all three Partner QR surfaces and the mobile scan route use the approved fragment lifecycle;
- a visual smoke test proves first and duplicate scan states against the real API;
- all 20 primary criteria and Developer A frontend obligations have traceable evidence.

## 5. Developer B — Organizer monitoring and Admin Badge vertical slices

Developer B starts from Developer A's merged foundation and shared award boundary. Developer B must
not edit V12 or replace reward/Notification insertion semantics.

### 5.1 Organizer BoothVisit monitoring

Implement:

```text
GET /api/v1/organizer/events/{eventId}/booth-visits/summary
GET /api/v1/organizer/events/{eventId}/booth-visit-groups
GET /api/v1/organizer/events/{eventId}/booth-visits
```

Responsibilities:

- conceal absent and foreign Events behind the same `EVENT_NOT_FOUND` outcome;
- calculate totals from durable unique BoothVisit rows;
- group by historical BoothAssignment/Booth context while returning current Assignment status;
- return stable paginated visit records and approved search/filter/sort behavior;
- return successful zero/empty results for an owned Event without visits;
- expose only operational Participant display identity;
- never return QR token, Point ledger, UserBadge or Notification body.

Query-side repositories/projections for Organizer monitoring are owned by Developer B. They must
not weaken Developer A's command-side locks or entity invariants.

### 5.2 Admin Badge catalog

Implement:

```text
GET  /api/v1/admin/badges
GET  /api/v1/admin/badges/{badgeId}
POST /api/v1/admin/badges
PUT  /api/v1/admin/badges/{badgeId}
```

Responsibilities:

- ADMIN/CSRF enforcement;
- normalized name, description, icon URL, threshold and active-state validation;
- case-insensitive normalized-name conflict handling;
- deterministic list/filter/search/sort behavior;
- aggregate awarded and remaining-eligible counts;
- correct synchronization trigger decision from locked before/after Badge state;
- no hard delete, manual Point edit or manual UserBadge grant/revoke.

Developer B mutates Badge only through the entity methods and lock repository provided by Developer
A. Required entity-invariant changes are coordinated into Developer A's foundation before merge.

### 5.3 Bounded Badge synchronization

Implement:

```text
POST /api/v1/admin/badges/{badgeId}/synchronize-awards
```

Developer B owns:

- after-commit scheduling from active create, active threshold reduction and reactivation;
- stable ascending User candidate selection;
- batches of at most 100 Users, one transaction per batch;
- processed, awarded, remaining-eligible and completed response counts;
- automatic continuation until zero remaining or one batch failure;
- explicit idempotent resume/retry through the Admin command;
- failure logging without secret or personal payload leakage.

Each candidate award calls Developer A's shared award boundary. There is no direct UserBadge or
Notification insert in the batch orchestrator and no persistent backfill-job table.

### 5.4 Organizer and Admin frontend

Developer B connects each backend boundary before closing its feature PR:

- add BoothVisit summary, Booth grouping and paginated visits to the selected Event's existing
  Participant-management context;
- preserve the existing Activity registration and Attendance monitoring on that screen;
- use an Event-scoped tab/panel rather than a global page or unrelated Event dropdown;
- replace phantom `/admin/badge-rules` and `/admin/settings` calls with the approved
  `/api/v1/admin/badges` operations;
- use a modal for Admin Badge create/edit because it is a focused catalog mutation;
- expose activation/deactivation, remaining-eligible count and explicit synchronization status/action
  on the Badge row or detail context;
- refresh only affected queries after mutation and show loading, empty, validation, conflict,
  forbidden and retry states without periodic request storms or mock fallback.

Developer B owns the Organizer/Admin reward adapters and views. New feature-specific modules are
preferred over broad changes to `organizerApi.ts` or `adminApi.ts`; if an existing shared module must
change, Developer B is its sole owner for that PR and records the handoff.

### 5.5 Developer B direct tests

- Organizer owned, foreign and missing Event isolation.
- Summary, unique Participant count and Assignment grouping accuracy.
- Empty monitoring and multi-page stable ordering.
- Search/filter/sort allowlists and invalid query handling.
- Badge create/update validation and normalized-name races.
- Active/inactive creation trigger differences.
- Threshold lower/raise and deactivate/reactivate behavior.
- Existing earned history after threshold raise/deactivation.
- Batch size never exceeds 100 and each batch commits independently.
- Mid-run failure, explicit resume and converged retry.
- Concurrent Admin mutation versus backfill uses locked current rule.
- Concurrent scan/backfill converges through Developer A's award boundary.
- Non-Admin and CSRF rejection for every mutation.
- Organizer monitoring tab binds to the selected Event and preserves Activity views.
- Admin Badge modal/status/actions call only approved endpoints and invalidate affected queries.
- Focused frontend build, lint and component tests for Developer B screens.
- Visual smoke evidence covers owned/empty Organizer monitoring and Admin sync progress.

### 5.6 Developer B completion gate

Developer B is complete only when:

- all Organizer endpoints are ownership-safe and pagination totals match their query scope;
- Admin screens can derive progress without a job/settings table;
- every documented trigger and non-trigger transition is tested;
- failed batch rollback and successful prior batches are proven;
- no code inserts UserBadge/Notification outside Developer A's boundary;
- Organizer and Admin screens use only approved real endpoints without request loops;
- each backend slice has a working visual state before its feature PR closes;
- all 18 primary criteria and Developer B frontend obligations have traceable evidence.

## 6. Developer C — Participant rewards and integration closure

Developer C may implement query DTOs against the approved contract while Developer A builds the
foundation, but backend query PRs merge only after V12/entities are available.

### 6.1 Participant reward query APIs

Implement:

```text
GET /api/v1/participant/rewards/summary
GET /api/v1/participant/rewards/point-transactions
GET /api/v1/participant/rewards/badges
```

Responsibilities:

- derive User identity from Session;
- calculate total Points from immutable PointTransactions across all Events;
- return stable Point history with Event/Booth context;
- return earned Badges including inactive definitions;
- omit inactive unearned Badges;
- calculate remaining Points/progress safely and select deterministic `nextBadge`;
- return successful zero/empty states without placeholders;
- enforce filter/sort/page allowlists and owner-only queries.

Participant query-side projections/repositories are owned by Developer C. They do not mutate reward
entities.

### 6.2 Participant Notification read compatibility

Developer A adds backend `BADGE_UNLOCKED` persistence/type/reference behavior. Developer C verifies
that the existing Notification list, unread count, mark-one-read and mark-all-read endpoints accept
and return the new type without creating a second inbox implementation.

The existing endpoints are:

```text
GET  /api/v1/participant/notifications
GET  /api/v1/participant/notifications/unread-count
POST /api/v1/participant/notifications/{notificationId}/read
POST /api/v1/participant/notifications/read-all
```

Developer C owns frontend additions for:

- `BADGE_UNLOCKED` type;
- `BADGE` reference navigation;
- unread/read state refresh;
- safe Badge display context without QR material.

### 6.3 Participant rewards and Notification frontend

Developer C owns:

- real reward summary, Point history and Badge progress in `RewardsPage`;
- renaming “Điểm & Đổi thưởng” to “Điểm & Huy hiệu” where approved;
- Participant Notification Badge rendering/navigation;
- loading, empty, pagination, filter and stable error states;
- a feature-specific `rewardApi.ts` or equivalently isolated adapter for the three read APIs;
- refresh/invalidation hooks consumed after Developer A's successful first-scan signal so rewards and
  inbox converge without coupling the scan page to Participant view internals.

No production UI falls back to mock Badge, Point or Notification rows after an API error.

### 6.4 Frontend consistency and integration closure

Developer C coordinates, but does not take over, cross-slice frontend verification:

- review adapters for common error envelopes, Session/CSRF behavior and stable Vietnamese copy;
- verify Developers A and B use the approved routes and do not branch on localized backend messages;
- verify no slice introduces interval polling, repeated unrelated role requests or production mock
  fallback;
- maintain the final cross-role Playwright scenario and phone-on-LAN checklist using the screens
  delivered by all three developers;
- report defects to the owning slice; cross-owner edits still require an explicit handoff.

### 6.5 Developer C direct tests

- owner-only reward summary/history/Badge query integration.
- Point/Badge pagination and deterministic default/explicit sorting.
- earned inactive versus unearned inactive Badge visibility.
- large-value progress calculation without overflow.
- Notification Badge type/reference/read behavior.
- Participant reward and Notification component/page tests.
- Participant adapters call only approved paths and never branch on localized backend messages.
- Playwright first-scan, duplicate-scan, reward refresh and backfill-visible flows.
- final frontend build/lint and request-storm regression check across all touched slices.

### 6.6 Developer C completion gate

Developer C is complete only when:

- all three Participant query APIs use durable owned data;
- Participant reward and Notification screens converge after scan;
- earned/inactive Badge and empty reward states match the approved contract;
- no interval/request loop causes repeated unrelated role API calls;
- Developers A and B provide their own frontend evidence and pass the shared consistency review;
- all 3 primary criteria and Participant/integration-closure obligations have traceable evidence.

## 7. Cross-developer integration contracts

### 7.1 Badge award responsibility split

- Developer A owns Badge/UserBadge persistence, lock order, award primitive and Notification insert.
- Developer A calls the primitive from first-scan orchestration.
- Developer B calls the same primitive from bounded backfill orchestration.
- Developer C reads the resulting durable state and never creates awards on page load.

Only the transaction that inserts UserBadge inserts its Notification.

### 7.2 Registration and lifecycle boundary

- Developer A reuses the existing Event lifecycle and EventRegistration model.
- No Sprint 7 developer changes direct Join or Activity registration deadline rules.
- Booth scan auto-create/reactivation is available only inside the approved ongoing Event window.
- Developer B/C queries never repair lifecycle or registration state as a read side effect.

### 7.3 Notification responsibility split

- Developer A: V12 column/check, backend enum/reference/entity, deduplicating writer and Badge unlock
  producer.
- Developer B: no direct Notification writes; backfill calls Developer A's award boundary.
- Developer C: existing query/read compatibility plus frontend Badge Notification behavior.

### 7.4 Backend-to-frontend handoff

Before any developer connects the UI for an endpoint, the backend portion of that slice supplies:

- final OpenAPI operation and DTO schema;
- success and empty examples;
- validation, lifecycle/conflict and authorization examples;
- cache/list/detail invalidation relationships;
- confirmation that raw QR token is absent from captured response/log evidence.

The same developer then connects the smallest usable page, panel or modal and records a real-API
visual smoke result before closing the slice. A backend-only PR is permitted only for the shared S7-1
foundation or when the UI dependency is explicitly documented in the mandatory merge order.

### 7.5 Shared-file coordination

These files/areas require explicit coordination and one PR owner at a time:

- `application*.yml` reward property — Developer A;
- existing EventRegistration/BoothAssignment repository lock additions — Developer A;
- backend Notification entity/type/writer — Developer A;
- scan route in `frontend/src/App.tsx`, Booth-scan helper/page and the three Partner QR pages —
  Developer A for the scan UI PR;
- Organizer BoothVisit adapter and `ParticipantManagementView` reward tab/panel — Developer B;
- Admin Badge adapter and `AdminBadgeRulesView` — Developer B;
- Participant reward adapter, `RewardsPage` and Participant Notification Badge presentation —
  Developer C;
- any existing shared adapter (`participantApi.ts`, `organizerApi.ts`, `adminApi.ts`) — one declared
  owner per PR; prefer the feature-specific adapters above;
- Sprint status/context files — assigned project/context owner only after approval.

## 8. Mandatory delivery and merge order

Do not merge around an unmet earlier gate.

1. **S7-0 — Documentation baseline**
   - Audit, Sprint baseline, Use Case Specification, API Contract and this assignment approved.
   - Context owner activates Sprint 7 only after approval.
2. **S7-1 — V12 and shared reward foundation (Developer A)**
   - Migration, entities, repositories, configuration, Notification extension and award boundary.
   - Migration/schema tests must pass before downstream feature merges.
3. **S7-2A — Participant scan write flow (Developer A)**
   - QR resolution, lifecycle/registration orchestration, first/duplicate outcomes and concurrency
     tests.
4. **S7-2B — Partner QR and Participant scan UI (Developer A)**
   - Runtime fragment QR, pre-auth capture, mobile scan page and real-API visual smoke.
5. **S7-3A — Organizer BoothVisit vertical slice (Developer B)**
   - Summary/group/page APIs, owner isolation, Event-scoped UI and focused tests.
6. **S7-3B — Admin Badge/backfill vertical slice (Developer B)**
   - Catalog/backfill APIs, Badge modal/status UI, concurrency tests and visual smoke.
7. **S7-3C — Participant reward vertical slice (Developer C)**
   - Summary/history/Badge APIs, Rewards UI, Badge Notification integration and focused tests.
8. **S7-4 — Cross-role verification and closure (Developer C coordinates)**
   - Migration, full backend/frontend tests, Swagger evidence, phone-on-LAN smoke, Playwright and
     documentation closeout.

S7-3A, S7-3B and S7-3C may be developed in parallel after S7-1, but each keeps separate files and
must rebase on the merged foundation. S7-2A may proceed in parallel with query work only after the
award boundary is frozen; S7-2B follows its merged scan API. Each S7-3 vertical slice connects its
own UI before it is considered complete.

Recommended task branches and focused PR boundaries:

```text
feat/s7-reward-foundation
feat/s7-booth-scan-api
feat/s7-booth-scan-ui
feat/s7-organizer-booth-visits
feat/s7-admin-badge-backfill
feat/s7-participant-rewards
test/s7-reward-e2e-closure
```

Each branch starts from the merged dependency immediately before it. Each PR remains focused and
names its owner, delivery step and AC IDs; do not accumulate all of one developer's Sprint work in
one final commit.

## 9. Required automated verification

### 9.1 Migration and persistence

- clean `V1 -> V12` and upgrade `V11 -> V12`;
- Hibernate schema validation;
- every FK, unique, CHECK and Notification reference branch;
- no modification checksum drift for V1 through V11;
- normalized Badge name uniqueness under concurrency.

### 9.2 Participant scan and rewards

- exact Event time boundaries with injected `Clock`;
- Assignment status and cross-Event relationship failures;
- EventRegistration create/reactivate/reuse;
- first, duplicate, expired-retry and concurrent scans;
- server-owned 10 Points and historical amount stability;
- zero/one/multiple Badge unlocks;
- Point total across multiple Events;
- UserBadge/Notification atomic rollback and deduplication;
- owner-only reward reads and empty results.

### 9.3 Organizer and Admin

- Event ownership concealment;
- accurate summary/group/list pagination;
- historical inactive Assignment grouping;
- Badge validation and normalized-name conflict;
- every backfill trigger/non-trigger transition;
- 100-User maximum batch and per-batch rollback;
- retry/resume/eventual completion;
- Admin mutation versus scan/backfill races;
- non-Admin and CSRF rejection.

### 9.4 Controller/security contract

- anonymous, wrong-role and ownership-safe failures;
- malformed JSON, unknown fields, invalid enums/filters/sorts/pages;
- malformed and unknown QR token use the same safe response;
- scan token redaction in captured request/error logs;
- documented HTTP/error-code pairs only;
- OpenAPI contains no raw QR field in new Participant/Organizer/Admin responses.

### 9.5 Frontend

- TypeScript build and lint;
- service adapter and token-helper tests;
- role-based component/page tests;
- loading, empty, validation, lifecycle, conflict, forbidden and network states;
- no demo/mock production fallback;
- no repeated-request loop when the browser tab remains open;
- each vertical feature PR includes a visual smoke result against its real backend API;
- Playwright first scan, duplicate scan, reward update and Badge backfill visibility.

## 10. Manual Swagger, browser and phone verification

The closure evidence follows this order:

1. Admin creates one inactive Badge and one active Badge; only the active Badge schedules sync.
2. Partner opens an authorized assigned Booth and displays its QR.
3. Verify the QR carries the frontend Booth-scan fragment route, not a raw-token-only value or
   backend URL/query.
4. Anonymous browser opens the route; no participation/reward row exists before login.
5. Participant logs in and the pending scan resumes.
6. Before Event start, scan receives the documented not-open outcome.
7. During the ongoing Event, first scan creates/reactivates registration, visit, 10 Points and any
   eligible Badge/Notification atomically.
8. Repeat inside the valid window and verify `alreadyVisited=true` with zero newly awarded Points.
9. Rewards summary/history/Badge progress and Notification inbox refresh to the same state.
10. Organizer sees the visit in owned Event summary, group and page.
11. Foreign Organizer cannot read that Event's monitoring.
12. Admin lowers/reactivates a Badge and observes bounded synchronization plus remaining count.
13. Participant later sees the backfilled Badge and exactly one unread Notification.
14. At/after Event end, old QR rejects a new request while prior history remains visible.
15. Cross-Participant reward and Notification access is rejected.

### 10.1 Phone-on-LAN smoke

- Laptop and phone use the same trusted Wi-Fi/hotspot.
- Frontend binds to a LAN-reachable host; backend remains reachable through the approved frontend
  proxy or LAN API configuration.
- The Partner page on the laptop is opened with the LAN/public frontend origin, not `localhost`, so
  its runtime-generated QR is reachable by the phone.
- Phone scans, logs in and receives the same Session/CSRF-backed flow as desktop.
- Windows firewall/network permission is configured locally and not encoded in source.
- Screen mirroring may be used for presentation, but it is not application behavior.
- Evidence redacts LAN IP where desired and never records credentials, cookies, CSRF or raw token.

Desktop fallback may open the same authorized fragment route in a separate Participant browser
profile. It must still call the real scan API; no demo-only Point or Badge endpoint is allowed.

## 11. Pull-request checklist

Every Sprint 7 implementation PR confirms:

- [ ] PR identifies Developer A/B/C, delivery step and owned AC IDs.
- [ ] No route, DTO, error code, lock order or schema rule diverges from approved documents.
- [ ] V1 through V11 are unchanged.
- [ ] Only Developer A edits V12, reward command entities and backend Notification writer.
- [ ] Frontend edits stay within the declared A/B/C feature ownership and one owner edits each shared
      file per PR.
- [ ] A backend feature PR includes its corresponding usable UI, except the documented S7-1
      foundation and S7-2A dependency PRs.
- [ ] Session identity, role, ownership and CSRF checks are covered.
- [ ] Backend time comes from injectable `Clock`.
- [ ] Retry/concurrency behavior is tested where applicable.
- [ ] No raw QR token appears in new responses, logs, Notification or committed evidence.
- [ ] No earned history is deleted or revoked.
- [ ] Backend tests pass for touched backend code.
- [ ] Frontend build/lint/tests pass for touched frontend code.
- [ ] Real-API visual smoke evidence exists for the completed vertical slice.
- [ ] OpenAPI/Swagger examples match the frozen contract.
- [ ] No mock/fallback row masks an API failure.
- [ ] Required coordination is recorded for any cross-owner file.

## 12. Sprint completion gate

Sprint 7 is complete only when:

- all 41 Acceptance Criteria have unique primary ownership and traceable evidence;
- all 12 new endpoint headings and four Notification extensions match the approved contract;
- V12 passes clean and upgrade migration verification;
- first and concurrent duplicate scans satisfy atomic/idempotent invariants;
- Badge backfill is bounded, retry-safe and Notification-idempotent;
- Participant, Partner, Organizer and Admin screens use real APIs without request storms;
- phone-on-LAN and desktop-fallback demo flows both exercise the real Session/CSRF scan command;
- Sprint 1-6 critical regression flows remain green, including Activity Attendance;
- no token, credential, local network value or local demo data is committed;
- completion evidence and remaining debt are documented;
- context/status files are updated only after review of that evidence.

Until this gate passes, Sprint 7 must not be marked complete merely because the first-scan happy
path works.

## 13. Review gate before activation

The Project Owner must confirm:

- the three generic owners are mapped to the actual three team members;
- Developer A accepts sole V12/write-boundary ownership plus Partner QR/Booth-scan UI;
- Developer B accepts Organizer monitoring and Admin Badge/backfill backend plus their UI;
- Developer C accepts Participant reward backend/UI plus frontend consistency and integration closure;
- the merge order and shared-file restrictions are workable with the team's branch schedule;
- phone-on-LAN verification is closure evidence, not a requirement to deploy a public environment.

Sprint 7 was activated on 2026-10-28 after this review gate was approved. Implementation branches
may begin in the mandatory delivery order above.
