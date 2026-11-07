# Sprint 08 General Feedback Implementation Plan

> Status: `COMPLETED` on `2026-11-01`.
>
> Delivery model: one developer owns the complete backend-to-frontend vertical slice.
>
> Documentation baseline branch: `docs/sprint8-feedback-audit` at initial baseline commit
> `61d4b45`. Implementation must start later from an updated `main`, not from this recorded commit.

## 1. Purpose and implementation boundary

This plan assigns one exclusive implementation owner to the complete Sprint 08 General Feedback
slice. It prevents migration/configuration conflicts while keeping Guest submission and Organizer
handling connected to their smallest usable real UI.

Implementation is governed by these sources in order:

1. `docs/requirements/05_Business_Rules.md`
2. `docs/requirements/06_Use_Case_List.md`
3. `docs/requirements/08_MVP_Scope_v2.md`
4. `docs/sprints/sprint-08.md`
5. `docs/use-cases/sprint-08-use-case-specifications.md`
6. `docs/design/12_Physical_ERD_Report.md` plus the approved Sprint 08 Physical ERD overlay
7. `docs/api/sprint-08-api-contract.md`
8. This implementation plan

The API Contract is frozen after approval. Changes to a route, DTO, status, target, validation
limit, throttle rule, error code, authorization boundary, transaction rule or schema constraint
require documentation review before code changes.

### 1.1 In scope

- One immutable Flyway migration creating `general_feedbacks` and its constraints/indexes.
- General Feedback entity, repositories, service boundaries and exception translation.
- Public `BOOK_STREET`/`EVENT` submission with optional authenticated association.
- CSRF-protected `permitAll` submission and bounded process-local abuse throttle.
- Shared Organizer queue, detail and the three legal transitions.
- Landing Page real form integration with rating/Heritage legacy removal.
- Organizer real queue/detail/action integration with server-side pagination/filtering.
- Focused migration, backend, frontend and browser verification.
- Final Physical ERD/context/closure documentation after implementation evidence exists.

### 1.2 Explicitly out of scope

- Heritage persistence and any `HERITAGE` General Feedback target.
- Location, Booth, Facility or Activity General Feedback targets.
- Changes to Activity Rating.
- Guest reply, Feedback status lookup, email, SMS, push or Notification delivery.
- Feedback hard delete or edit-after-submit.
- A transition-history table.
- Feedback reports, statistics, Admin API/UI or dashboard aggregation.
- CAPTCHA or a third-party abuse platform.
- Rewriting Flyway migrations V1 through V13.
- Committing `.env`, credentials, HMAC secrets, Session/CSRF values, local IPs or demo Feedback.

## 2. Single-owner declaration

### 2.1 Owner

The assigned **Sprint 08 General Feedback Owner** is the only developer permitted to implement or
edit Sprint 08 Feedback persistence, API, security/throttle integration and role-facing UI until
the slice is merged.

The owner holds all 28 criteria:

- `AC-G04-S8-01` through `AC-G04-S8-12`;
- `AC-O-S8-01` through `AC-O-S8-12`;
- `AC-X-S8-01` through `AC-X-S8-04`.

There is no parallel Developer A/B/C split. Reviewers may review and request changes but must not
create a competing migration, entity, throttle or transition implementation.

### 2.2 Exclusive migration ownership declaration

The Sprint 08 General Feedback Owner is the sole owner of the next migration used by this feature.

Expected filename, only if the version is still free after the pre-code audit and `main` refresh:

```text
backend/src/main/resources/db/migration/V14__create_sprint8_general_feedback_schema.sql
```

Rules:

- `V14` is expected, not reserved by this document.
- Immediately before creation, update `main` and list every migration again.
- If another migration has taken `V14`, use the next free version and update Sprint 08 documents
  before implementation proceeds.
- Only the single owner may create/edit the Sprint 08 migration before merge.
- After merge/application, that migration is immutable.
- No schema or demo seed is created manually in pgAdmin.
- No production/demo Feedback row belongs in the migration.
- V1 through V13 remain byte-for-byte unchanged.

### 2.3 Exclusive configuration ownership

The same owner exclusively coordinates Sprint 08 edits to:

- Spring Security route/method authorization;
- CSRF error mapping for Sprint 08 routes;
- bounded in-memory throttle configuration and key generation;
- application configuration templates/test overrides;
- OpenAPI/controller documentation affected by the six routes.

The throttle HMAC secret is runtime configuration. It must never receive a committed real/default
secret. Local `.env` changes remain untracked and are not part of a PR.

## 3. Branch and pull-request strategy

### 3.1 Documentation gate branch

The current documentation branch contains only Sprint 08 planning artifacts. Before any code:

1. complete this plan;
2. run the requested cross-document audit;
3. resolve every blocking inconsistency;
4. obtain review/approval of the complete documentation set;
5. merge the documentation through the normal review path;
6. update `CURRENT_SPRINT.md` only when the audit is clean and Sprint 08 is approved for activation.

No migration or application code belongs on the documentation branch.

### 3.2 Implementation branch

After the documentation gate is merged:

1. switch to `main`;
2. fetch/pull the latest accepted baseline;
3. verify a clean worktree except explicitly preserved local-only files;
4. create one task branch such as `feat/sprint8-general-feedback`;
5. recheck Flyway versions and record the selected migration version in the first implementation
   PR description.

Do not carry an unmerged documentation index or unrelated local change into the implementation
branch. Do not stage `.env` or the user's untracked `backend/scripts/` directory.

### 3.3 Sequential review units

One owner may deliver the implementation as these sequential focused PRs, or as equivalent
reviewable commits in one PR when repository workflow requires it:

1. **S8-1 Public vertical slice and foundation** — migration, persistence, throttle/security,
   public create API, Landing Page form and focused public tests.
2. **S8-2 Organizer vertical slice** — shared queue/detail/transitions, Organizer UI and focused
   Organizer tests.
3. **S8-3 Verification and closure** — focused cross-slice browser evidence, affected regression
   checks, Physical ERD/context update and Sprint closure report.

These units are sequential. S8-2 consumes the merged/frozen S8-1 persistence identity and must not
replace its entity constraints or throttle boundary. S8-3 does not add product scope.

## 4. File and package ownership

### 4.1 Backend feature package

New backend code belongs under a focused `feedback` feature package, using subpackages such as:

```text
feedback/controller
feedback/dto
feedback/entity
feedback/exception
feedback/repository
feedback/service
feedback/config
```

Do not add General Feedback classes to a global entity/controller/repository package.

The single owner controls:

- GeneralFeedback entity and closed enums;
- public and Organizer DTOs;
- query and row-lock repositories;
- normalization, public submission, throttle and transition services;
- controller/exception behavior for the six routes;
- schema and feature tests.

### 4.2 Shared backend files

Likely shared edits include:

- `security/config/SecurityConfiguration.java`;
- `security/handler/RestAccessDeniedHandler.java` or the approved common CSRF mapping;
- application configuration/test property files;
- OpenAPI integration expectations.

The owner must keep these edits minimal and route-specific. Sprint 08 must not weaken existing
Participant, Partner, Organizer or Admin authorization.

### 4.3 Frontend ownership

The same owner controls the affected Feedback surfaces and adapters:

- `frontend/src/services/publicApi.ts`;
- `frontend/src/components/landing/FeedbackSection.tsx` and its focused styling;
- `frontend/src/services/organizerApi.ts`;
- `frontend/src/components/organizer/OrganizerFeedbackView.tsx` and its focused styling;
- Feedback-specific types and focused Playwright scenarios.

Shared navigation/layout files are edited only when necessary to expose the already-approved real
Organizer Feedback view. Do not refactor unrelated portal or Landing Page components during this
slice.

## 5. S8-1 — Public vertical slice and foundation

### 5.1 Migration and schema

Create exactly the approved table shape:

- identity primary key;
- optional Session submitter FK;
- `BOOK_STREET`/`EVENT` target XOR and Event FK;
- optional Guest name/contact email and required message;
- exact three-state status constraint;
- internal note, latest handler and workflow timestamps;
- workflow/timestamp consistency checks;
- three approved queue indexes;
- `ON DELETE RESTRICT` foreign keys.

Required migration proofs:

- clean install from V1 through the selected Sprint 08 migration;
- supported upgrade from V13;
- Hibernate `ddl-auto: validate`;
- direct constraint rejection for invalid targets, states, actors and timestamps;
- no mutation of old migrations.

### 5.2 Persistence and domain foundation

Implement:

- GeneralFeedback entity matching the physical schema exactly;
- closed target/status enums;
- create factory/invariants for initial `NEW` state;
- transition methods that cannot create unsupported states;
- repository methods for public create, shared queries and `SELECT FOR UPDATE` transition lookup;
- deterministic pagination and current Event/User joins without N+1 query behavior;
- safe constraint/exception translation with no SQL leakage.

Do not add a subject, rating, phone, response, history, soft-delete or duplicated target-name field.

### 5.3 Public security and throttle

Implement the API Contract exactly:

- `POST /api/v1/public/feedbacks` is `permitAll`;
- CSRF remains enabled and returns `CSRF_INVALID` on Sprint 08 mutation failure;
- optional valid Session association comes from Security context only;
- one backend process permits attempts 1–10 in a 600-second window and blocks attempt 11;
- the limiter stores at most 5,000 active HMAC/principal keys in volatile memory;
- authenticated key uses User identity; anonymous key uses HMAC of the canonical address;
- raw IP and HMAC secret never enter limiter keys, logs or PostgreSQL;
- untrusted forwarded headers are ignored;
- capacity exhaustion or unsafe limiter evaluation returns 503 and writes no Feedback;
- Redis remains dedicated to Session storage; backend restart resets counters and multi-instance
  distributed enforcement remains outside Sprint 08.

### 5.4 Public API

Implement only:

```text
POST /api/v1/public/feedbacks
```

The command must:

- reject unknown/legacy fields;
- normalize exact optional/name/email/message limits;
- validate exact target shape;
- apply the existing public-detail Event eligibility rule;
- safely hide Draft/missing Event distinction;
- commit one `NEW` row before returning `201` receipt;
- return no public Location/detail link;
- publish no email/Notification/reply event.

### 5.5 Landing Page integration

Replace the current fake contract rather than adapting it loosely:

- remove rating/star controls and result text;
- remove Heritage target loading/options;
- use `BOOK_STREET` and the existing public Event list for discoverable `PUBLISHED`/`ONGOING`
  choices;
- accept a contextually known `COMPLETED`/`CANCELLED` Event only after the existing public Event
  detail API resolves it; do not widen Event discovery or add a Feedback-target endpoint;
- add optional Guest name/email and required message;
- preserve shared API-client credentials/CSRF retry;
- render real success, validation, Event-not-found, throttle and failure states;
- keep the QR as navigation to `/#gop-y` only;
- prevent duplicate click while pending;
- do not keep a mock or local-success fallback.

### 5.6 S8-1 focused tests

- Migration clean/upgrade/Hibernate validation.
- Every target/status/workflow/timestamp CHECK and FK branch.
- Anonymous `BOOK_STREET` and valid-Session submitter association.
- `EVENT` under PUBLISHED, ONGOING, COMPLETED and CANCELLED.
- Draft/missing Event indistinguishability.
- Name/email/message normalization boundaries.
- Unknown legacy field rejection.
- CSRF missing/invalid and frontend one-retry behavior.
- Throttle attempt 10/11, expiry, separate keys, 5,000-key capacity, `Retry-After` and fail-closed
  behavior.
- Transaction rollback/no false receipt.
- Receipt and log privacy.
- Landing Page desktop/mobile real API states without star/Heritage fallback.

### 5.7 S8-1 completion gate

S8-1 is complete only when all 12 `AC-G04-S8` criteria and the applicable schema criteria have
traceable evidence, and the Guest can submit through the real Landing Page without login.

## 6. S8-2 — Organizer vertical slice

### 6.1 Shared queue and detail API

Implement:

```text
GET /api/v1/organizer/feedbacks
GET /api/v1/organizer/feedbacks/{feedbackId}
```

Requirements:

- effective `ROLE_ORGANIZER` only;
- no Event-owner predicate;
- page/count use one search/filter predicate;
- exact search/target/Event/status/sort contract;
- stable `submittedAt` plus identity ordering;
- successful empty pages;
- list omits direct contact/internal fields;
- detail returns authorized private context;
- reads do not mutate state.

### 6.2 Transition API

Implement exactly:

```text
POST /api/v1/organizer/feedbacks/{feedbackId}/start-handling
POST /api/v1/organizer/feedbacks/{feedbackId}/resolve
POST /api/v1/organizer/feedbacks/{feedbackId}/reopen
```

Each command:

- derives the Organizer from Session;
- locks the Feedback row;
- rechecks exact source state;
- applies one server timestamp atomically;
- returns committed detail;
- converts stale/repeated/direct transitions to the generic conflict;
- creates no Guest delivery or delete side effect.

### 6.3 Organizer UI integration

Replace the current empty/unsupported mock behavior:

- use server-side page/search/filter/sort;
- replace legacy lowercase/`responded`/`closed` statuses;
- remove rating stars and Heritage/Booth target assumptions;
- fetch detail for contact/internal data;
- expose one legal action for current status;
- require internal note on resolve;
- label the note as internal, not sent to the Guest;
- reload durable state after 409 or uncertain result;
- render genuine loading, empty, unauthorized/forbidden, conflict and retryable failures.

### 6.4 S8-2 focused tests

- Two different Event owners receive the same shared queue.
- Participant, Partner, Admin-without-Organizer and anonymous denial.
- Content/count predicate consistency for every filter combination.
- Search scope, stable ordering, invalid filter and empty page.
- Detail privacy and read-without-mutation.
- All three legal transitions.
- Blank/oversized resolve note rejection.
- Every direct, repeated and stale transition conflict.
- Two-Organizer concurrency race produces one winner.
- Reopen clears resolution time, starts a new handling cycle and retains note/content.
- No delete or delivery side effect.
- Organizer desktop/mobile real API states without mock rows.
- Event mutation remains owner-scoped despite shared Feedback visibility.

### 6.5 S8-2 completion gate

S8-2 is complete only when all 12 `AC-O-S8` criteria and remaining schema/concurrency criteria have
traceable evidence against the real API and UI.

## 7. S8-3 — Verification and closure

### 7.1 Focused automated verification

Expected focused backend test classes may be named:

```text
Sprint08SchemaMigrationTests
GeneralFeedbackSubmissionIntegrationTests
OrganizerFeedbackIntegrationTests
GeneralFeedbackThrottleTests
GeneralFeedbackConcurrencyTests
```

Run the smallest relevant backend set during development. Before merge, backend CI remains
required; do not disable or weaken it.

Frontend commands:

```powershell
npm run lint
npm run build
npx playwright test tests/e2e/sprint8-general-feedback-ui.spec.ts
```

Run these from `frontend`. The focused Sprint 08 Playwright file must cover Guest desktop/mobile
submission and Organizer queue/detail/transitions. The complete historical Playwright suite is not
required locally or in ordinary CI for Sprint 08.

### 7.2 Affected regression checks

Run focused existing tests for:

- Activity Rating eligibility/update/invalidation;
- Event public visibility and owner-scoped mutation;
- Session authentication/role authority and browser CSRF behavior;
- Sprint 7 reward schema/Hibernate validation;
- route-scoped frontend loading so Organizer Feedback does not request data from unrelated roles.

Do not run unrelated long browser suites merely for ceremony. Expand only when a shared change or
failure provides evidence that wider regression coverage is necessary.

### 7.3 Manual real-API smoke

Verify at minimum:

1. anonymous Book Street submission on desktop;
2. Event submission from a phone-sized viewport;
3. Organizer A sees and starts the item;
4. Organizer B sees the same item, resolves it and can reopen it;
5. public UI receives no processing result/reply;
6. Activity Rating and Event owner mutation still behave as before.

Do not record real contact email, Session, CSRF, IP or secret values in committed screenshots/logs.

### 7.4 Closure documentation

After code/evidence is accepted:

- update the main Physical ERD/report to the applied schema/version;
- update `AI_CONTEXT.md` only through its assigned context owner;
- record the actual migration filename and merge commit;
- create the Sprint 08 closure report with evidence per AC;
- update `CURRENT_SPRINT.md` to completed only after all 28 criteria pass;
- preserve the audit trail and record that the later `2026-11-01` product decision permanently
  removed Heritage from General Feedback scope.

## 8. Security and privacy implementation checklist

- [x] Redis-backed Session remains the only authentication model, with no JWT and no Redis throttle data.
- [x] Public POST is permit-all but CSRF-protected.
- [x] Optional submitter identity comes only from Security context.
- [x] Organizer operations require effective Organizer authority.
- [x] Shared Feedback access does not modify Event ownership rules.
- [x] Contact email and internal note are absent from public/list DTOs and logs.
- [x] Raw client IP is not persisted or logged, and the anonymous in-memory key uses an HMAC digest.
- [x] HMAC secret is external configuration and not committed.
- [x] Unknown fields reject caller-selected identity/status/actor/timestamps.
- [x] No public Feedback list/detail, delete or delivery endpoint exists.

## 9. Pull-request checklist

Every implementation PR/commit must state:

- delivery unit (`S8-1`, `S8-2` or `S8-3`);
- owned AC IDs;
- migration version when applicable;
- routes/DTOs changed;
- shared security/config/frontend files changed;
- focused tests run and their results;
- remaining known gaps;
- confirmation that `.env`, credentials, IPs and demo Feedback are absent.

Before merge:

- [x] Branch started from updated `main`.
- [x] No V1–V13 edit.
- [x] Contract routes, DTOs and errors remain aligned with the approved documents.
- [x] `git diff --check` is clean.
- [x] Relevant backend tests pass.
- [x] Frontend lint/build pass for UI changes.
- [x] Focused Sprint 08 Playwright passes for completed UI paths.
- [x] No mock fallback remains in the completed slice.
- [x] No unrelated formatting/refactor is included.

## 10. Sprint completion gate

Sprint 08 is complete only when:

- all 28 Acceptance Criteria have automated or explicit manual evidence;
- the applied migration passes clean install, V13 upgrade and Hibernate validation;
- Guest submission works without login through the real CSRF/throttle boundary;
- every Organizer shares the same durable queue;
- transitions remain legal and atomic under concurrency;
- public/list privacy boundaries hold;
- Landing Page and Organizer UI contain no General Feedback mock fallback;
- focused browser scenarios and affected regressions pass;
- Physical ERD, project context and closure documents reflect actual implementation;
- no secret, personal contact data, local address or demo-only record is committed.

## 11. Pre-implementation audit gate

After this plan is complete, create:

```text
docs/development/SPRINT_08_DOCUMENTATION_AUDIT.md
```

The audit must compare all Sprint 08 documents against Business Rules, Use Case List, current
schema/code behavior and each other. It must verify:

- scope/target decisions;
- all 28 AC IDs and semantics;
- schema/API field and nullability mapping;
- state transitions and timestamps;
- route/DTO/error/security consistency;
- throttle values and deployment assumptions;
- Organizer shared access versus Event ownership;
- test/PR/ownership feasibility;
- migration availability and immutable-history rules;
- explicit deferred/out-of-scope behavior.

Any blocking discrepancy must be corrected in the source documents and re-audited. Only a clean
audit plus Project Owner approval authorizes activation and implementation.
