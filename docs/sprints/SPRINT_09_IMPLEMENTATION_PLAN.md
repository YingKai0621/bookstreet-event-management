# Sprint 09 Heritage Implementation and Ownership Plan

> Status: `APPROVED - ACTIVE` from `2026-11-01`.
>
> Delivery model: one Heritage developer owns the application vertical slice and all 28 criteria. The
> Project Owner exclusively owns the Heritage migration SQL file.
>
> Approved documentation merge: `7e46809` through PR #105.
>
> Sprint 09 activation is recorded in `docs/sprints/CURRENT_SPRINT.md`. Implementation starts from updated
> `main` after the migration version is reserved.

## 1. Purpose and implementation boundary

This plan gives one Heritage developer enough implementation order, ownership, verification, and handoff
detail to deliver Sprint 09 without redefining product behavior during coding.

When sources conflict, product behavior is governed by these sources in order:

1. `docs/requirements/05_Business_Rules.md`
2. `docs/requirements/06_Use_Case_List.md`
3. `docs/sprints/sprint-09.md` and its Acceptance Criteria
4. `docs/use-cases/sprint-09-use-case-specifications.md`
5. `docs/design/12_Physical_ERD_Report.md` plus
   `docs/design/SPRINT_09_HERITAGE_PHYSICAL_ERD_OVERLAY.md`
6. `docs/api/sprint-09-api-contract.md`
7. `docs/requirements/08_MVP_Scope_v2.md`, the current-state audit, and other supporting documents
8. This implementation plan for delivery order only

Before coding, the owner also reads `AI_CONTEXT.md`, `docs/sprints/CURRENT_SPRINT.md`, and
`docs/development/BACKEND_AI_CODING_GUIDELINES.md` in the project-required reading sequence. Coding
guidelines govern implementation style but do not override approved product behavior.

The API Contract is frozen only after documentation approval. A change to a route, DTO, field, status,
transition, validation limit, error code, authority rule, concurrency rule, schema constraint, or public
visibility rule requires documentation review before code changes.

### 1.1 In scope

- One immutable Flyway migration creating `heritage_contents` with the approved constraints and indexes.
- One focused backend `heritage` feature package.
- Anonymous published-only Heritage list and direct detail APIs.
- One shared Organizer collection with server-owned search, status, sorting, and pagination.
- Organizer create, content update, publish, archive, republish, and eligible draft delete.
- Exact `expectedUpdatedAt` optimistic concurrency for every shared Organizer mutation.
- Real public Landing Page, `/di-san`, and `/di-san/:publicCode` integration.
- Real `/organizer/public-content` Heritage management integration.
- No Heritage QR or technical-code labels on public screens.
- Bounded local JPG, PNG and WebP upload with preview and abandoned-upload cleanup.
- Focused migration, backend, frontend, browser, security, and regression evidence.
- Closure documentation after implementation evidence exists.

### 1.2 Explicitly out of scope

- Heritage as a General Feedback target.
- Admin Heritage management.
- Per-Organizer ownership, review, approval, or assignment.
- A fourth lifecycle status.
- Bilingual persistence or a localization framework.
- Public Heritage search or category API.
- Map coordinates or marker editing.
- Rich text or executable HTML.
- External storage-provider work or a general asset library.
- QR presentation/persistence, scan analytics, view counters, reports, or dashboards.
- Notifications, comments, likes, subscriptions, scheduled publication, or version history.
- Bulk import, export, or delete.
- Production seed rows.
- Changes to completed Event, Booth, Activity, Payment, Attendance, Certificate, Reward, Rating, or
  Feedback behavior.
- Modification of Flyway V1 through V14.
- Committing `.env`, credentials, local IPs, Session values, CSRF values, or the user's local scripts.

## 2. Ownership and parallel-work coordination

### 2.1 Heritage owner

The assigned **Sprint 09 Heritage Owner** is the only developer permitted to implement or edit the Heritage
entity, repository, API, security integration, public UI, Organizer UI, and Heritage-specific tests until
the slice is merged. The Project Owner separately owns the migration SQL file.

The Heritage Owner owns all 28 criteria:

- `AC-O09-S9-01` through `AC-O09-S9-14`
- `AC-G01-S9-01` through `AC-G01-S9-08`
- `AC-S9-DB-01` through `AC-S9-DB-03`
- `AC-S9-REG-01` through `AC-S9-REG-03`

Reviewers may review and request changes. Only the Project Owner may create or edit the Heritage migration.
No reviewer or feature developer creates a competing entity, controller, route contract, lifecycle, or
frontend model.

### 2.2 Notification developer boundary

Notification is a separate future workstream with its own current-state audit, Sprint scope, Use Case,
API Contract, implementation plan, and Acceptance Criteria.

The Notification developer must not:

- add Notification behavior to Heritage publication or archive commands
- modify Heritage DTOs, statuses, persistence, routes, or tests
- reuse `heritage_contents` as Notification state
- add Heritage-specific delivery, subscription, or recipient logic
- change the Sprint 09 API Contract while implementing Notification

The Heritage developer must not redesign or extend the existing Notification domain as part of Sprint 09.

### 2.3 Exclusive migration ownership and version reservation

At the time this plan was prepared, V1 through V14 exist and `V15` appears free. This document does not
reserve `V15`.

Candidate filename only when the version is still free:

```text
backend/src/main/resources/db/migration/V15__create_sprint9_heritage_content_schema.sql
```

Before creating the migration, the Project Owner must:

1. update local `main`
2. list every migration in `backend/src/main/resources/db/migration`
3. check whether the Notification workstream or another merged branch used the next version
4. reserve the next free version centrally
5. record that version in the migration and implementation PR descriptions

Rules:

- Heritage and Notification never use the same migration number.
- The Project Owner owns the reserved Heritage migration file until merge.
- If another migration merges first, the unmerged owner renumbers before review and updates affected docs.
- No developer edits another feature's migration to avoid a version collision.
- After a migration is merged or applied to a shared environment, it is immutable.
- No schema or shared Sprint data is created manually in pgAdmin.
- No production or demo Heritage row belongs in the schema migration.

### 2.4 Shared-file integration lock

Heritage and Notification may both need a small edit in shared files. These edits are serialized by merge
order rather than developed as competing rewrites.

Likely shared files:

```text
backend/src/main/java/com/swp391/bookstreet/security/config/SecurityConfiguration.java
backend/src/main/java/com/swp391/bookstreet/security/handler/RestAccessDeniedHandler.java
backend/src/main/java/com/swp391/bookstreet/security/handler/RestAuthenticationEntryPoint.java
frontend/src/components/organizer/ManagementPortal.tsx
frontend/src/components/organizer/OrganizerSidebar.tsx
frontend/src/routing/organizerRoutes.ts
frontend/src/types/organizer.ts
```

Coordination rules:

1. Each developer limits the edit to their own route, tab, error mapping, or component branch.
2. The first reviewed workstream merges its focused shared-file edit.
3. The second workstream rebases on updated `main` and reapplies only its own focused change.
4. Neither developer replaces the entire shared file with an older local copy.
5. A conflict resolution is reviewed against both feature contracts before commit.
6. Shared-file tests for both features run after the conflict is resolved.

The current Sprint 09 documentation is ready before Notification documentation. Heritage may receive merge
priority for a shared file, but the project owner makes the final merge-order decision.

### 2.5 Project-control document ownership

`AGENTS.md` and `AI_CONTEXT.md` remain shared project-control files. The feature developer does not edit
them casually.

- `AGENTS.md` changes require team agreement.
- The assigned project/context owner updates `AI_CONTEXT.md`, `CURRENT_SPRINT.md`, and the final applied ERD
  after the implementation evidence and Sprint transition are accepted.
- The Heritage Owner reports stale project-control information instead of silently changing it.

## 3. Branch and pull-request strategy

### 3.1 Documentation gate

Before any Heritage code:

1. complete the Sprint baseline, current-state audit, Physical ERD overlay, Use Case Specifications,
   API Contract, this implementation plan, and
   `docs/development/SPRINT_09_HERITAGE_IMPLEMENTATION_HANDOFF.md`
2. run the requested full cross-document audit
3. resolve every blocking or material inconsistency
4. review and merge the documentation through the normal PR path
5. activate Sprint 09 only after the documentation gate is approved

No migration or application code belongs on the documentation branch.

### 3.2 Implementation branch

After the documentation gate is merged:

1. switch to `main`
2. fetch and pull the latest accepted baseline
3. verify the worktree is clean except explicitly preserved local-only files
4. create one branch such as `feat/sprint9-heritage`
5. obtain the reserved migration filename from the Project Owner
6. record the documentation baseline commit and reserved migration in the PR description

Do not carry unrelated local edits into the implementation branch. Do not stage `.env` or the user's
untracked `backend/scripts/` directory.

### 3.3 Sequential implementation units

The Heritage Owner implements these units in order after the Project Owner supplies the reserved migration:

1. **S9-H1 Schema and domain foundation**
2. **S9-H2 Backend public and Organizer APIs**
3. **S9-H3 Public frontend integration**
4. **S9-H4 Organizer frontend integration**
5. **S9-H5 Verification and closure**

One focused PR is preferred when the team wants one complete vertical slice. The units may instead be
reviewable sequential commits or sequential PRs. A later unit cannot redefine an earlier approved schema
or contract.

Before every commit, the owner audits the staged diff for scope, secrets, unrelated files, generated files,
contract drift, and relevant test evidence. A commit is created only after that audit is clean.

## 4. File and package ownership

### 4.1 Backend feature package

New backend code belongs under:

```text
backend/src/main/java/com/swp391/bookstreet/heritage/
```

Use focused subpackages:

```text
heritage/controller
heritage/dto
heritage/entity
heritage/exception
heritage/repository
heritage/service
```

Likely classes include:

```text
PublicHeritageController
OrganizerHeritageController
HeritageContent
HeritageContentStatus
HeritageContentRepository
PublicHeritageService
OrganizerHeritageService
HeritageApiException
HeritageApiExceptionHandler
CreateHeritageRequest
UpdateHeritageRequest
HeritageTransitionRequest
PublicHeritageListItemResponse
PublicHeritageDetailResponse
OrganizerHeritageListItemResponse
OrganizerHeritageDetailResponse
HeritagePageResponse
```

Names may change only when behavior and wire names remain identical to the approved contract. Do not put
Heritage classes in a global entity, controller, repository, or DTO package.

### 4.2 Backend shared files

Expected focused shared edits:

- `security/config/SecurityConfiguration.java` for public and Organizer route rules
- `security/handler/RestAccessDeniedHandler.java` for Heritage CSRF classification
- `security/handler/RestAuthenticationEntryPoint.java` for no-store Organizer authentication errors
- OpenAPI verification when the repository's existing OpenAPI test requires route coverage

Avoid application-property changes unless implementation proves they are required. Heritage introduces no
secret, Redis key, scheduler, queue, or external service configuration. The local Heritage image directory
and 5 MB multipart boundary follow the approved media contract.

### 4.3 Migration and backend tests

The Project Owner controls only:

```text
backend/src/main/resources/db/migration/V{reserved}__create_sprint9_heritage_content_schema.sql
```

The Heritage Owner controls:

```text
backend/src/test/java/com/swp391/bookstreet/heritage/
backend/src/test/java/com/swp391/bookstreet/migration/Sprint09SchemaMigrationTests.java
backend/src/test/java/com/swp391/bookstreet/heritage/Sprint09HibernateValidationTests.java
```

Test names are candidates, not a reason to merge unrelated scenarios into one oversized class.

### 4.4 Frontend Heritage files

Expected Heritage-owned frontend files:

```text
frontend/src/services/publicApi.ts
frontend/src/services/organizerApi.ts
frontend/src/types/heritage.ts
frontend/src/types/index.ts
frontend/src/App.tsx
frontend/src/components/landing/HeritageSection.tsx
frontend/src/components/landing/HeritageSection.css
frontend/src/pages/public/HeritageExperience.tsx
frontend/src/pages/public/HeritageExperience.css
frontend/src/components/organizer/OrganizerPublicContentView.tsx
frontend/src/components/organizer/ManagementPortal.tsx
frontend/src/routing/organizerRoutes.ts
```

A focused Organizer Heritage stylesheet may be added if needed. Do not refactor unrelated Landing Page,
Event, Booth, Activity, Feedback, Participant, Partner, Admin, or Notification UI during this slice.

### 4.5 Frontend tests

Add one focused real-API scenario such as:

```text
frontend/tests/e2e/sprint9-heritage-ui.spec.ts
```

Extend an existing shared route or pagination test only when the scenario genuinely belongs there. Do not
copy the full historical browser suite into a Sprint 09 file.

## 5. S9-H1 Schema and domain foundation

### 5.1 Migration reservation

- The Project Owner refreshes `main` and reserves the next free migration.
- Confirm V1 through V14 remain byte-for-byte unchanged.
- Confirm no Notification or other branch reserved the same number.
- The Project Owner creates exactly one Heritage migration.
- The Heritage Owner reviews the supplied schema against the overlay and adds integration evidence without
  editing the migration SQL.

### 5.2 Physical schema

Create `heritage_contents` with exactly 11 columns:

```text
heritage_content_id
public_code
title
summary
content
image_url
location_text
status
published_at
created_at
updated_at
```

Implement exactly the approved:

- identity primary key
- canonical unique `public_code`
- nine named CHECK constraints
- public partial ordering index
- Organizer status and ordering index
- three status values
- publication-state invariant
- timestamp ordering invariant
- no foreign keys
- no Feedback relationship
- no seed data

Do not add audit actors, owner, translation, map, QR, analytics, upload, or soft-delete columns.

### 5.3 Entity and domain model

Implement:

- `HeritageContent` matching all 11 physical columns
- `HeritageContentStatus` with exactly `DRAFT`, `PUBLISHED`, and `ARCHIVED`
- canonical create factory for `DRAFT`
- immutable `publicCode` mapping
- controlled content update without a public status setter
- controlled publish, archive, and republish behavior
- timezone-aware timestamps using `Instant`
- no Hibernate schema creation

The entity or service boundary must make illegal transitions difficult to express. Database constraints
remain the final persisted-state guard.

### 5.4 Repository foundation

Implement repository operations for:

- published public page with fixed ordering
- published public detail by canonical `publicCode`
- shared Organizer page and total count with identical predicates
- Organizer detail by internal identity
- canonical public-code existence and duplicate handling
- guarded content update
- guarded publish, archive, and republish
- guarded eligible draft delete

Contains search may scan the bounded filtered result set. Do not add `pg_trgm`, full-text extensions, or a
new migration for speculative optimization.

### 5.5 S9-H1 focused verification

- Clean migration from V1 through the selected Heritage migration.
- Upgrade from V14.
- Hibernate `ddl-auto: validate`.
- All named constraint and index inspection.
- Direct rejection for invalid canonical codes, lengths, image prefixes, statuses, publication states, and
  timestamp ordering.
- Valid DRAFT, PUBLISHED, and ARCHIVED persistence.
- No applied migration changes.
- No General Feedback schema change.

### 5.6 S9-H1 completion gate

S9-H1 is complete only when `AC-S9-DB-01`, `AC-S9-DB-02`, and `AC-S9-DB-03` have test evidence and the
entity validates against both clean and upgraded PostgreSQL schemas.

## 6. S9-H2 Backend public and Organizer APIs

### 6.1 Normalization and DTO boundary

Implement one reusable Heritage normalization and validation boundary that matches the API Contract:

- backend-generated canonical uppercase `publicCode` derived from title with unique numeric suffixes
- exact title, summary, content, image URL, and location limits
- optional blank-to-null behavior
- content line-ending normalization
- full URI and local-asset path validation
- unknown JSON property rejection
- plain-text persistence
- exact public and Organizer DTO separation

Public DTOs cannot expose internal identity, status, created time, updated time, or concurrency token.

### 6.2 Public APIs

Implement exactly:

```text
GET /api/v1/heritages
GET /api/v1/heritages/{publicCode}
```

Requirements:

- anonymous `permitAll`
- no CSRF requirement for GET
- only `PUBLISHED` rows in database predicates
- fixed public ordering and page bounds
- unsupported query parameter rejection
- direct detail by canonical code
- identical public-safe not-found behavior for draft, archived, unknown, and noncanonical decoded code
- no mock, local array, analytics, or write side effect
- `Cache-Control: no-store` on success and failure

### 6.3 Organizer query and create APIs

Implement exactly:

```text
GET  /api/v1/organizer/heritages
GET  /api/v1/organizer/heritages/{heritageContentId}
POST /api/v1/organizer/heritages
```

Requirements:

- effective verified Organizer only
- Admin-only denied by a specific route matcher and method-level authorization
- one shared collection with no owner or Event predicate
- exact page, size, search, status, and sort contract
- content and total count use the same predicate
- list omits full content and returns exact `updatedAt`
- detail returns the canonical Organizer representation
- create always produces one valid `DRAFT`
- title-derived code allocation is serialized and resolves collisions with numeric suffixes

### 6.4 Organizer update API

Implement exactly:

```text
PATCH /api/v1/organizer/heritages/{heritageContentId}
```

Requirements:

- at least one approved mutable content field
- omitted optional field remains unchanged
- supplied null or blank optional field clears to null
- no `publicCode`, status, publication time, creation time, or update-time assignment
- exact raw `expectedUpdatedAt`
- one guarded update predicate
- strictly later persisted `updatedAt`
- stale write maps to `HERITAGE_STALE_WRITE`

### 6.5 Organizer lifecycle and delete APIs

Implement exactly:

```text
POST   /api/v1/organizer/heritages/{heritageContentId}/publish
POST   /api/v1/organizer/heritages/{heritageContentId}/archive
POST   /api/v1/organizer/heritages/{heritageContentId}/republish
DELETE /api/v1/organizer/heritages/{heritageContentId}?expectedUpdatedAt={encodedInstant}
```

Each command:

- requires Organizer authority and CSRF
- carries the exact last observed concurrency token
- uses one guarded mutation
- classifies unknown identity, stale token, and illegal state in contract order
- commits before returning success
- returns the canonical committed detail except successful delete
- creates no Notification, Feedback, QR, analytics, or ownership side effect

First publish sets `publishedAt` and `updatedAt` to one operation time. Archive and republish preserve the
original `publishedAt`. Delete returns `204` only for a never-published draft.

### 6.6 Strict concurrency time

For every accepted mutation:

- normalize backend time to PostgreSQL microsecond precision
- choose a value strictly later than previous `updatedAt`
- persist before returning it
- serialize the persisted value without precision loss
- accept the raw value back as `expectedUpdatedAt`

Do not rely on two calls to the system clock being different. Tests must use a fixed or repeating Clock and
still prove strictly advancing versions.

### 6.7 Exception and security integration

- Use the canonical `ApiErrorResponse` shape.
- Add Heritage binding, validation, conflict, persistence, authentication, and access-denied handling.
- Return `CSRF_INVALID` for Heritage CSRF failure.
- Return no-store on all Heritage successes and errors.
- Never expose SQL, constraint names, content bodies, Sessions, CSRF values, or stack traces.
- Keep existing security behavior outside the two Heritage route families unchanged.

### 6.8 S9-H2 focused tests

Candidate focused test classes:

```text
HeritageContentTests
HeritageRepositoryIntegrationTests
PublicHeritageServiceTests
OrganizerHeritageServiceTests
PublicHeritageControllerTests
OrganizerHeritageControllerTests
HeritageSecurityIntegrationTests
HeritageCsrfHandlerTests
```

Required scenarios:

- anonymous published list and detail
- draft, archived, unknown, lowercase, and malformed-code non-disclosure
- equal publication-time deterministic ordering
- query validation and successful empty pages
- shared Organizer visibility and Admin-only denial
- multi-role Organizer acceptance
- all create and normalization boundaries
- duplicate-code race
- partial update and optional-field clearing
- empty update rejection
- immutable and unknown field rejection
- each legal lifecycle transition
- each illegal, repeated, and stale transition
- first publication time and republish preservation
- fixed-Clock strictly increasing update versions
- eligible guarded delete and published-history delete rejection
- transaction rollback and no false success
- exact DTO privacy and no-store headers

### 6.9 S9-H2 completion gate

S9-H2 is complete only when all ten backend operations match the API Contract, all Organizer backend criteria
except UI-only behavior have evidence, and all public backend criteria except UI-only behavior have evidence.

## 7. S9-H3 Public frontend integration

### 7.1 Canonical frontend model

Replace the legacy broad Heritage model with typed API models for:

- public list item
- public detail
- page response

Remove persistence assumptions for translation, province, category, period, highlights, source, license,
map coordinates, QR status, view count, and scan count.

Display-only adapters may preserve the existing visual direction. They cannot invent persisted business data.

### 7.2 Public API adapter

- Replace empty `getHeritages()` with real paged `GET /heritages` calls.
- Replace `/public/heritages/{slug}` with `GET /heritages/{publicCode}`.
- Use the shared API client and typed responses.
- Preserve no-store behavior already used for GET requests.
- Never fall back to local or mock Heritage records.

### 7.3 Landing Page and collection

- Landing Page distinguishes loading, empty, failure, and populated states.
- Empty data must not display an endless skeleton.
- `/di-san` renders server pages using fixed public ordering.
- Remove unsupported public category and search controls.
- Cards use `publicCode` for detail links.
- Optional image, summary, and location render safely.
- Existing labels may remain bilingual, but content does not pretend to have a stored English translation.

### 7.4 Direct detail and public presentation

- `/di-san/:publicCode` fetches detail directly from the route parameter.
- A fresh browser load does not depend on Landing Page state.
- Detail distinguishes loading, not-found, failure, and populated states.
- Stored content renders as text.
- Public screens do not render a QR block or technical `publicCode` label.
- Organizer screens upload validated local images and persist only the returned approved URL.

### 7.5 S9-H3 focused tests

- Landing loading, populated, empty, and failure states.
- Public collection paging and empty state.
- Direct detail in a fresh browser context.
- Draft, archived, and unknown detail not-found behavior.
- Optional field rendering and image fallback.
- Canonical links and absence of QR/code labels.
- No unsupported search/category or legacy mock fallback.
- Desktop and mobile layout smoke for affected screens.

### 7.6 S9-H3 completion gate

S9-H3 is complete only when all eight `AC-G01-S9` criteria have real backend and frontend evidence.

## 8. S9-H4 Organizer frontend integration

### 8.1 Route activation

- Add `public_content` to the supported Organizer route set.
- Preserve `/organizer/public-content` as the Heritage entry point.
- Do not create an Admin route.
- Keep unrelated route normalization unchanged.

### 8.2 Organizer API adapter

Replace empty and unsupported Heritage methods with typed operations for:

- list
- detail
- create
- partial update
- publish
- archive
- republish
- eligible draft delete

The delete adapter URL-encodes the raw `expectedUpdatedAt` query value. No mutation parses the token through
the browser `Date` type before returning it.

### 8.3 Management list and detail

- Use server-owned page, search, status, and sort.
- Keep query state in the URL when practical.
- Distinguish loading, initial empty, filtered empty, forbidden, failure, and populated states.
- Fetch detail before edit because the list omits full content.
- Use canonical uppercase status values.
- Remove legacy fields and the `hidden` status.

### 8.4 Mutation experience

- Create only a draft.
- Update only approved content fields.
- Show publish only for `DRAFT`.
- Show archive only for `PUBLISHED` and require confirmation.
- Show republish only for `ARCHIVED`.
- Show permanent delete only for never-published `DRAFT` and require confirmation.
- Disable duplicate submission while pending.
- Preserve safe form input on validation or retryable failure.
- Reconcile success from the returned committed detail.
- On `HERITAGE_STALE_WRITE`, explain the conflict and offer reload without replaying the mutation.
- Never show success after rejected or uncertain requests.

### 8.5 S9-H4 focused tests

- Organizer route resolution and direct refresh.
- Shared list query controls and URL state.
- Loading, initial empty, filtered empty, forbidden, server failure, and retry states.
- Create validation and duplicate code conflict.
- Edit with optional-field clearing.
- Status-specific legal actions.
- Archive and delete confirmations.
- Stale write reload behavior.
- No Admin-only access or legacy mock behavior.
- Desktop and mobile affected-view smoke.

### 8.6 S9-H4 completion gate

S9-H4 is complete only when all 14 `AC-O09-S9` criteria have real backend and Organizer UI evidence.

## 9. S9-H5 Verification and closure

### 9.1 Local focused backend verification

Run the smallest relevant test set while implementing. A final focused command may include the completed
Sprint 09 classes, for example:

```powershell
cd backend
.\mvnw.cmd -Dtest=Sprint09SchemaMigrationTests,Sprint09HibernateValidationTests,HeritageContentTests,HeritageRepositoryIntegrationTests,PublicHeritageServiceTests,OrganizerHeritageServiceTests,PublicHeritageControllerTests,OrganizerHeritageControllerTests,HeritageSecurityIntegrationTests test
```

The exact class list follows the implemented test names. Do not claim success for a test class that does not
exist or did not run.

### 9.2 Frontend verification

Required before PR review:

```powershell
cd frontend
npm run lint
npm run build
npx playwright test tests/e2e/sprint9-heritage-ui.spec.ts
```

Run only focused affected Playwright scenarios locally unless a failure or shared change justifies broader
coverage. Do not run the full historical Playwright suite merely as a Sprint 09 default.

### 9.3 Affected backend regressions

Run focused tests covering shared boundaries changed by Heritage:

- Session authentication and authorization
- Browser CSRF behavior
- General Feedback target rejection and controller behavior
- public Event and Activity access when security matchers change
- OpenAPI route documentation when applicable
- application context and Hibernate validation

The implementation PR still requires normal backend and frontend CI. CI may execute broader backend tests.
The Playwright CI job remains label or manual-dispatch controlled under the existing workflow.

### 9.4 Manual real-API smoke

Use PostgreSQL and Redis with the real backend and frontend:

1. Confirm an anonymous empty public list renders a genuine empty state.
2. Log in as a verified Organizer.
3. Create one valid draft.
4. Confirm the draft is absent from public list and detail.
5. Edit the draft and confirm `updatedAt` advances.
6. Publish and confirm the same public code appears in list and direct detail.
7. Open the detail in a fresh browser context.
8. Confirm direct canonical URLs work and no Heritage QR/code label is rendered.
9. Edit published content and confirm public detail updates.
10. Archive and confirm public list and detail remove the item.
11. Republish and confirm the same code and original `publishedAt` return.
12. Create a second draft and permanently delete it after confirmation.
13. Use two Organizer sessions to produce one stale-write conflict and reload the winner.
14. Confirm an Admin-only account cannot enter Organizer Heritage APIs.
15. Confirm Feedback screens contain no Heritage target.

Do not use production data or commit local smoke credentials.

### 9.5 CI and review evidence

The PR description records:

- documentation baseline commit
- reserved migration number
- exact focused backend command and result
- frontend lint and build result
- focused Playwright command and result
- relevant manual smoke evidence
- CI links for backend and frontend jobs
- any intentionally deferred non-Sprint behavior

### 9.6 Closure documentation

After implementation and verification are accepted:

- replace the target Physical ERD with the applied Heritage table shape
- update the relevant ERD reports
- record the actual migration version
- update Sprint 09 status and closure evidence
- ask the project/context owner to update `AI_CONTEXT.md` and `CURRENT_SPRINT.md`
- preserve the permanent rule that Heritage is not a General Feedback target

Closure documentation reports evidence. It does not hide failed or skipped checks.

## 10. Acceptance Criteria delivery map

### 10.1 S9-H1

- `AC-S9-DB-01`
- `AC-S9-DB-02`
- `AC-S9-DB-03`

### 10.2 S9-H2

- backend portions of `AC-O09-S9-01`, `AC-O09-S9-02`, `AC-O09-S9-03`, `AC-O09-S9-04`,
  `AC-O09-S9-05`, `AC-O09-S9-06`, `AC-O09-S9-07`, `AC-O09-S9-08`, `AC-O09-S9-09`,
  `AC-O09-S9-10`, `AC-O09-S9-11`, `AC-O09-S9-12`, and `AC-O09-S9-13`
- backend portions of `AC-G01-S9-01`, `AC-G01-S9-02`, `AC-G01-S9-03`, `AC-G01-S9-04`,
  `AC-G01-S9-06`, `AC-G01-S9-07`, and `AC-G01-S9-08`
- persistence portions of `AC-S9-REG-02` and `AC-S9-REG-03`

### 10.3 S9-H3

- frontend completion of `AC-G01-S9-01`, `AC-G01-S9-02`, `AC-G01-S9-03`, `AC-G01-S9-04`,
  `AC-G01-S9-05`, `AC-G01-S9-06`, `AC-G01-S9-07`, and `AC-G01-S9-08`
- public frontend portion of `AC-S9-REG-03`

### 10.4 S9-H4

- frontend completion of `AC-O09-S9-01`, `AC-O09-S9-02`, `AC-O09-S9-03`, `AC-O09-S9-04`,
  `AC-O09-S9-05`, `AC-O09-S9-06`, `AC-O09-S9-07`, `AC-O09-S9-08`, `AC-O09-S9-09`,
  `AC-O09-S9-10`, `AC-O09-S9-11`, `AC-O09-S9-12`, `AC-O09-S9-13`, and `AC-O09-S9-14`
- Organizer frontend portion of `AC-S9-REG-03`

### 10.5 S9-H5

- full evidence for all 28 criteria
- `AC-S9-REG-01`
- complete cross-layer evidence for `AC-S9-REG-02`
- complete no-fallback evidence for `AC-S9-REG-03`

No Acceptance Criterion is owned by the Notification developer.

## 11. Security and data checklist

- Session and HttpOnly cookie remain the only authentication model.
- No JWT, bearer token, refresh token, or `/auth/refresh` route is added.
- Public Heritage GET is anonymous and read-only.
- Organizer routes require effective verified Organizer authority.
- Admin-only access is denied.
- Mutation CSRF remains enabled.
- Public response contains no internal id or concurrency token.
- Public-safe not-found hides private row existence.
- Stored content renders as plain text.
- Unknown fields are rejected.
- `publicCode` is immutable.
- Every shared mutation carries and guards `expectedUpdatedAt`.
- Published and archived records cannot be hard-deleted.
- No request or log exposes credentials, Session, CSRF, SQL, or private content bodies.
- No Heritage data is stored in Redis.
- No `.env`, local IP, or real credential enters the PR.

## 12. Commit and pull-request checklist

Before every commit:

- inspect `git status` and the staged diff
- confirm no unrelated file is staged
- confirm `.env` and `backend/scripts/` are not staged
- confirm no applied migration changed
- confirm the reserved migration is unique
- confirm no secret or local address appears
- confirm implementation still matches the API Contract
- run the smallest relevant tests for the staged unit
- fix warnings or document a justified existing warning

Before opening or updating the implementation PR:

- rebase or merge the latest accepted `main` according to team workflow
- resolve shared-file conflicts against both Heritage and Notification contracts
- rerun focused tests affected by the resolution
- run frontend lint and build
- run the focused Sprint 09 Playwright file
- verify backend and frontend CI expectations
- map every changed behavior to an Acceptance Criterion
- record skipped checks honestly

No commit is considered ready only because compilation succeeds.

## 13. Sprint completion gate

Sprint 09 Heritage is complete only when:

- the selected migration succeeds from clean install and V14 upgrade
- Hibernate validation passes
- all ten API operations match the frozen contract
- only published content is public
- shared Organizer authority and stale-write protection are proven
- all three lifecycle transitions and eligible delete are proven
- public and Organizer UIs use real APIs with no fallback data
- direct detail works without Heritage QR presentation
- all 28 Acceptance Criteria have evidence
- affected regressions remain green
- backend and frontend CI are green
- focused Sprint 09 Playwright scenarios are green
- applied ERD and closure documentation are updated
- no unresolved high or medium audit finding remains

## 14. Pre-implementation audit gate

Before code begins, audit the complete Sprint 09 documentation set together:

1. current-state audit
2. Sprint baseline
3. Physical ERD overlay
4. Use Case Specifications
5. API Contract
6. this implementation and ownership plan
7. `docs/development/SPRINT_09_HERITAGE_IMPLEMENTATION_HANDOFF.md`

The audit must confirm:

- 28 unique Acceptance Criteria match across all documents
- 10 routes and all DTO fields are consistent
- 11 physical columns and all constraints support the contract
- all validation limits and normalization rules agree
- every Organizer mutation uses the same concurrency contract
- public visibility and not-found behavior agree
- Heritage remains completely separate from Feedback
- Heritage and Notification ownership cannot collide
- migration and shared-file coordination are explicit
- no unresolved decision is left for the implementer to invent

Implementation starts only after this gate is clean and the Sprint is explicitly activated.
