# Sprint 09 Heritage Current-State Audit

## Document status

- Status: `REVIEWED - PRODUCT DECISIONS APPROVED`
- Audit date: `2026-11-01`
- Product decision date: `2026-11-01`
- Audited branch baseline: `main` at merge commit `c053a9c`
- Latest completed Sprint: Sprint 08
- Current production database baseline: Flyway `V1` through `V14`
- Approved scope: Heritage supporting public content
- Activation state: historical audit evidence. Sprint activation is recorded in `CURRENT_SPRINT.md`

## 1. Purpose and guardrails

This audit identifies what already exists, what is only a visual placeholder, and what remains undecided
before defining Sprint 09. It is not a Sprint baseline, Use Case Specification, API Contract, Physical ERD
change, migration plan, or implementation approval.

The audit follows the project source-of-truth order:

1. Business Rules
2. Use Case List
3. Approved Sprint scope and Acceptance Criteria
4. Current Physical ERD
5. Approved Sprint API Contract
6. Supporting documents and current UI

Current UI fields and buttons are evidence of presentation work only. They do not create business rules,
database requirements, permissions, or API contracts.

Evidence inspected for this audit:

- `AI_CONTEXT.md` and `docs/sprints/CURRENT_SPRINT.md`
- the Sprint 08 baseline, specifications, API Contract, documentation audit, and closure report
- `docs/requirements/04_Vision_and_Scope.md`
- `docs/requirements/05_Business_Rules.md`
- `docs/requirements/06_Use_Case_List.md`
- `docs/requirements/08_MVP_Scope_v2.md`
- the Logical ERD, current Physical ERD report and drawio source
- production Flyway migrations `V1` through `V14` and the isolated legacy demo migration folder
- backend controller mappings, Spring Security configuration, and backend test inventory
- `App.tsx`, `HeritageExperience`, `HeritageSection`, `publicApi`, and current Heritage types
- `ManagementPortal`, `OrganizerPublicContentView`, `organizerApi`, and current frontend test inventory

## 2. Business baseline

### 2.1 Confirmed scope

The current requirements support a small Heritage content slice:

- `UC-G01 Explore Book Street` includes public Heritage or supporting public content.
- `UC-O09 Manage Public Content` gives Organizer a high-level public-content responsibility.
- The MVP scope states that Heritage is supporting public content, not a separate heritage-management
  workflow.
- `BR-65` limits General Feedback to `BOOK_STREET` and `EVENT`. Heritage is independent public content
  and is not a General Feedback target.

The approved baseline does not define Heritage as an independent domain with collection management,
conservation workflow, ownership records, artifact inventories, or approval committees.

### 2.2 Requirements that are not yet detailed enough to implement

The current Business Rules do not define:

- the exact Heritage publication statuses
- allowed status transitions
- who may create, edit, publish, archive, or delete content
- whether all Organizers share one content queue
- whether Admin has any Heritage management permission
- whether content is bilingual
- whether public identity uses `publicCode`, slug, or another value
- image upload and storage behavior
- whether Heritage has persisted QR records or QR analytics
- whether map coordinates belong to the Heritage record
- hard-delete rules and history retention

These decisions must be approved in the Sprint 09 baseline and specifications before coding.

### 2.3 Source conflict requiring resolution

At the audited `c053a9c` baseline, the Logical ERD said Organizer or Admin may create and publish Heritage
content. The Use Case List and MVP scope assign public-content management to Organizer and do not define an
Admin Heritage Use Case.

Under the project source-of-truth order, the Logical ERD cannot silently add an Admin workflow. The safest
Sprint 09 baseline is Organizer-only management unless the team explicitly updates the higher-priority
requirements.

The Sprint 09 decision locks Organizer-only management, and the current Logical ERD report has been aligned
with that decision.

## 3. Database and backend reality

### 3.1 Production schema

The production Flyway chain currently contains 14 migrations, `V1` through `V14`. It does not contain a
`heritage_contents` table or any Heritage foreign key.

The next production migration number appears to be `V15` at the time of this audit. The owner must check
the latest `main` again immediately before creating a migration because migration numbers are shared.

Legacy demonstration migrations under `db/demo` are archived and are not loaded by the production Flyway
configuration. Their filenames must not be treated as occupied production migration versions.

### 3.2 Physical ERD reference

The Physical ERD report describes `heritage_contents` as target or reference design, not as an active table.
Its proposed fields are:

- numeric identity primary key
- unique `public_code`
- `title`
- optional `summary`
- `content`
- optional `image_url`
- optional `location_text`
- `status`
- optional `published_at`
- `created_at` and `updated_at`

Only published content is intended to be publicly visible. Exact constraints, allowed status values,
indexes, audit ownership, deletion behavior, and public-code format are not yet approved.

### 3.3 Backend implementation

There is currently no dedicated Heritage backend package, entity, repository, service, controller, route,
or backend test suite. No Spring Security rule currently defines public Heritage reads or Organizer Heritage
management.

The repository currently has 47 controllers and 107 backend test classes overall, but none implements the
Heritage feature. These counts are context only and do not represent Heritage coverage.

## 4. Frontend reality

### 4.1 Public experience

The frontend already contains substantial Heritage presentation work:

- public list and detail routes
- `HeritageExperience` and supporting components
- local Heritage images
- landing-page integration points
- a visual content model with bilingual and display-oriented fields

This presentation is not backed by production data:

- `publicApi.getHeritages()` intentionally returns an empty array
- `getHeritageBySlug()` declares a route that has no backend implementation and is not the active detail
  loading path
- the detail page searches the list already held in frontend state instead of fetching canonical detail
  data
- an empty list can be displayed as a perpetual loading state instead of a real empty or failure state

The public frontend therefore demonstrates the intended visual direction, not a completed Heritage feature.

### 4.2 Organizer experience

The Organizer navigation and `/organizer/public-content` screen already expose a Heritage management UI.
The screen includes list, search, create, edit, status, and delete controls.

Its data and mutations are placeholders:

- `organizerApi.getHeritages()` always returns an empty array
- create, update, and delete call `unsupportedOrganizerFeature`
- the management container does not perform an initial Heritage refresh
- there is no backend endpoint or persistence behind the controls
- loading, empty, and failure behavior is not complete

The screen must not be treated as implemented merely because the controls are visible.

### 4.3 Frontend model drift

Current frontend types and forms include fields that are not approved by the target Physical ERD:

- bilingual names and descriptions
- province, category, and historical period
- highlights and reference source
- image alt text, source, and license metadata
- map coordinates
- QR status
- view count and QR scan count
- lower-case statuses such as `published`, `draft`, and `hidden`

The frontend also has multiple overlapping Heritage types. Sprint 09 should define one canonical API model
and map it into display models only when presentation-specific fields are genuinely needed.

### 4.4 Delete behavior conflict

The Organizer UI currently presents a hard-delete confirmation. That is risky for published public content
and inconsistent with the project's preference for history-preserving lifecycle changes.

Sprint 09 should prefer archive or unpublish behavior. Whether an unpublished draft may be permanently
deleted must be an explicit rule, not an assumption taken from the current button label.

## 5. General Feedback separation

The approved product decision permanently separates Heritage content from General Feedback.
`general_feedbacks` remains limited to `BOOK_STREET` and `EVENT`, exactly as implemented by Sprint 08
and Flyway V14.

Sprint 09 must not add `heritage_content_id`, a `HERITAGE` target enum, Heritage selectors in the Feedback
form, or Heritage filters in the Organizer Feedback queue. Heritage CRUD and publication remain independent
from the completed Feedback workflow.

## 6. Candidate Sprint 09 boundary

### 6.1 Recommended required slice: Heritage foundation and public content

The smallest coherent required slice is:

1. Add the approved `heritage_contents` persistence model through a new Flyway migration.
2. Allow verified Organizers to list, view, create, update, publish, and archive shared Heritage content.
3. Allow Guests and Participants to list and view published Heritage content only.
4. Connect the existing public list and detail screens to real APIs.
5. Connect the existing Organizer screen to real APIs and replace unsupported controls.
6. Add explicit loading, empty, not-found, validation, authorization, conflict, and server-error states.
7. Use a stable public identifier for public URLs.
8. Add focused backend, frontend, and route-level tests for the approved Acceptance Criteria.

### 6.2 Recommended exclusions

The following work should remain outside the initial Sprint 09 boundary unless separately approved:

- Admin Heritage management
- Heritage as a General Feedback target
- a complex heritage-management workflow
- view-count and QR-scan analytics
- persisted QR lifecycle or QR status
- map-coordinate editing and map integration
- a general digital asset manager
- comments, likes, notifications, or public moderation
- reports and dashboards
- a broad application-wide localization framework
- arbitrary rich-text or executable HTML content
- unrelated frontend redesign

## 7. Decisions required before the Sprint baseline

### Decision 1: Management actor

Approved product decision: verified Organizers manage one shared Heritage content collection. Admin
management remains out of scope. An Admin-only account has no Heritage management API or UI.

### Decision 2: Durable content fields

Sprint 09 draft baseline choice: use the minimal Physical ERD field set. Do not persist the current
frontend's bilingual, analytics, QR-status, or map-coordinate fields.

### Decision 3: Publication statuses and transitions

Sprint 09 draft baseline choice: use only `DRAFT`, `PUBLISHED`, and `ARCHIVED`. Status changes use explicit
lifecycle commands described by the Sprint baseline and later API Contract.

### Decision 4: Public identity

Amended baseline choice: the backend generates one case-insensitively unique and immutable `publicCode`
from title for public URLs. Organizer input never contains this technical identity. Internal numeric IDs
remain private persistence and Organizer-operation identities.

### Decision 5: Delete policy

Sprint 09 draft baseline choice: published and archived content cannot be hard-deleted. Only a `DRAFT`
record that has never been published may be deleted permanently.

### Decision 6: Image handling

Amended baseline choice: accept bounded local JPG, PNG and WebP upload, persist only the approved generated
URL, and keep base64, external storage providers, and a general asset library out of scope.

### Decision 7: QR behavior

Amended baseline choice: display no Heritage QR or technical code labels. Do not persist QR status, tokens,
images, or scan counters.

## 8. Main implementation risks

1. Treating the existing polished UI as a completed feature could hide the missing database and backend.
2. Copying all frontend placeholder fields into the database would expand scope without business approval.
3. Copying the target Physical ERD blindly would leave status, ownership, deletion, and public-code behavior
   undefined.
4. Adding Admin access from the Logical ERD would conflict with the current Use Case baseline.
5. Reusing the current hard-delete button could remove published content and break public links or audit
   history.
6. Reintroducing Heritage as a Feedback target would violate the approved baseline and duplicate scope
   already removed from Sprint 09.
7. Adding QR analytics, map coordinates, or bilingual persistence during the foundation slice would create
   unrelated schema and API work.
8. Creating a migration without rechecking `main` could duplicate another developer's Flyway version.
9. Leaving the public empty-list state unchanged could make valid empty data look like an endless load.
10. Keeping parallel frontend types could cause request and response drift after the real API is introduced.
11. Allowing multiple Organizers to update shared content without a concurrency token could silently lose
    another Organizer's accepted change. The Sprint 09 draft uses `updatedAt` as `expectedUpdatedAt`.

## 9. Recommended documentation sequence

No feature implementation should begin directly from this audit. The recommended sequence is:

1. Review and approve the decisions in this audit.
2. Write the Sprint 09 baseline with exact scope, exclusions, ownership, and Acceptance Criteria.
3. Write a Heritage Physical ERD overlay with constraints, indexes, lifecycle, and migration sequencing.
4. Write the Sprint 09 Use Case Specifications.
5. Write the Sprint 09 API Contract.
6. Write the implementation and file-ownership plan.
7. Audit all Sprint 09 documents against the source-of-truth order.
8. Activate Sprint 09 in `CURRENT_SPRINT.md` and update `AI_CONTEXT.md` only after approval.
9. Implement on focused branches with relevant tests and a pre-commit audit for every commit.

## 10. Audit conclusion

Sprint 09 Heritage is a reasonable next Sprint, but it is not ready for feature coding yet. The repository
has a strong visual starting point and a target ERD sketch, while durable persistence, backend APIs,
permissions, lifecycle rules, canonical types, real data loading, and dedicated tests are still absent.

The recommended approach is a small Organizer-managed supporting-content feature with public published
reads. Heritage remains permanently separate from General Feedback. This preserves the current MVP
definition and avoids turning placeholder UI fields into an accidental large domain.
