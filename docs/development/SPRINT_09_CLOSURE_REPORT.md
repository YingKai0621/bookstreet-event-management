# Sprint 9 Closure Report

- Sprint: Sprint 09 Heritage Public Content
- Status: `COMPLETED`
- Completion date: `2026-11-01`
- Documentation baseline: PR #105, merge commit `7e46809`
- Implementation: PR #107, merge commit `7ed4e0e`
- Schema baseline: immutable Flyway migrations V1 through V15
- Acceptance baseline: 28 Acceptance Criteria and 13 API operations after the Heritage UX amendment

Sprint 9 is complete. Heritage content now uses durable PostgreSQL data through the approved real
APIs. Anonymous visitors can browse published Heritage content and Organizers share one management
collection with the exact Draft, Published and Archived lifecycle. Heritage remains independent
from General Feedback.

## 1. Delivered scope

- V15 creates `heritage_contents` with the approved 11-column shape, lifecycle constraints and
  public and Organizer query indexes.
- The backend exposes the approved content operations plus bounded local Heritage image upload/read/cleanup.
- Anonymous visitors can browse a paged published collection and open stable direct detail URLs without
  technical-code labels or a Heritage QR block.
- Verified Organizers share one server-paged collection with content search, status filtering and
  deterministic ordering.
- Organizer create and update validate normalized content and preserve the stable public identity.
- Publish, archive and republish commands enforce the approved lifecycle. Only an eligible Draft
  that has never been published can be hard-deleted.
- Organizer mutations use `expectedUpdatedAt` optimistic concurrency so stale forms cannot
  overwrite newer durable changes.
- Public and Organizer pages use the real API and represent loading, empty, not-found, forbidden,
  validation, conflict and retryable failure states without mock-success or seed-data fallback.

## 2. Acceptance Criteria traceability

### 2.1 Organizer criteria `AC-O09-S9-01` through `AC-O09-S9-14`

- `Sprint09HeritageIntegrationTests` covers the shared Organizer collection, server-owned query
  behavior, create and update persistence, lifecycle commands, deletion rules, authorization and
  stale-write conflicts.
- `HeritageContentTests` and `HeritageValidationServiceTests` cover entity invariants, normalized
  input, optional fields, public-code stability and duplicate or invalid input rejection.
- `sprint9-organizer-heritage-ui.spec.ts` covers real list and detail behavior, create and edit,
  publish, archive, republish, eligible Draft deletion, inline validation, pagination and stale
  conflict presentation while preserving the user's form.

### 2.2 Public criteria `AC-G01-S9-01` through `AC-G01-S9-08`

- `Sprint09HeritageIntegrationTests` covers published-only list and detail access, canonical public
  code lookup, non-disclosure of private or invalid records and deterministic paging.
- `sprint9-public-heritage-ui.spec.ts` covers the real Landing Page collection, direct detail URLs,
  absence of QR/code labels, optional-field degradation, loading, empty, not-found and failure states.
- The public frontend does not require prior list state and does not display or persist QR image data.

### 2.3 Database criteria `AC-S9-DB-01` through `AC-S9-DB-03`

- `Sprint09SchemaMigrationTests` covers clean V1-to-V15 migration, V14-to-V15 upgrade and database
  constraint rejection for invalid lifecycle data.
- `Sprint09HibernateValidationTests` proves that the JPA model validates against the applied V15
  PostgreSQL schema.
- V15 is applied and immutable. No competing migration or manually created shared schema is used.

### 2.4 Regression criteria `AC-S9-REG-01` through `AC-S9-REG-03`

- PR #107 backend and frontend CI checks completed successfully.
- General Feedback targets remain exactly `BOOK_STREET` and `EVENT`. Heritage is neither a
  Feedback target nor part of the Feedback lifecycle.
- Public and Organizer empty or failure states expose no mock Heritage collection and no
  mock-success behavior.

## 3. Verification evidence

The implementation and closure audit used isolated test data rather than the local demo database.

- focused Sprint 9 backend suite: **19 passed, 0 failed, 0 errors, 0 skipped**
- focused Sprint 9 Playwright suite: **8 passed**
- frontend production build: **passed**
- frontend lint: **0 errors with no new Heritage warnings**
- clean V1-to-V15 migration, V14-to-V15 upgrade and Hibernate validation: **passed**
- PR #107 backend CI: **passed**
- PR #107 frontend checks: **passed**
- PR #107 frontend Playwright workflow: **skipped by the agreed optional-CI policy**

The focused backend suite was rerun with the PostgreSQL test configuration enabled. The earlier
environment-gated run with database tests skipped was not accepted as closure evidence.

## 4. Security and lifecycle boundaries

- Authentication remains Spring Security server-side Session stored in Redis with the existing
  HttpOnly cookie and CSRF protection. No JWT or bearer-token flow was introduced.
- Public endpoints disclose only Published content and only the approved public response fields.
- Effective verified Organizer authority is required for every management operation. Participant,
  Partner, Admin-only and anonymous access cannot mutate Heritage content.
- Optimistic concurrency protects updates and lifecycle transitions from stale overwrites.
- Archiving removes public visibility without changing the stable public code. Republish restores
  the same public identity.
- Published history cannot be hard-deleted.

## 5. Remaining debt and out-of-scope work

- Heritage Feedback, ratings, comments and Guest replies are not part of the approved model.
- Heritage changes do not trigger email, SMS, push or in-app Notification delivery.
- Reports, analytics, map integration, localization and a rich-text editor remain out of scope.
- Organizer Heritage supports bounded local JPG, PNG and WebP upload while PostgreSQL stores only the
  approved image URL. External object storage and a general asset library remain future work.
- Existing unrelated frontend lint warnings and production bundle splitting remain general
  technical debt.
- Any new feature or schema work requires a separately approved Sprint baseline and the next free
  Flyway version must be rechecked before reservation.

## 6. Closure decision

All 28 Acceptance Criteria have automated evidence. V15 is immutable, the focused verification
set is green, the role and lifecycle boundaries remain intact, and the project-control documents
now reflect the merged implementation. Sprint 9 is therefore closed as `COMPLETED` on
`2026-11-01`.
