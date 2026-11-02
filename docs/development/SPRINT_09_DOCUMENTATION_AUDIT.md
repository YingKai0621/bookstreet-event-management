# Sprint 09 Heritage Documentation Audit

> Audit date: `2026-11-01`.
>
> Result: **PASS WITH CORRECTIONS APPLIED - READY FOR PROJECT OWNER REVIEW**.
>
> This result confirms that the candidate Sprint 09 Heritage documents are internally consistent and
> implementable against the inspected repository baseline. It does not activate Sprint 09 and does not
> authorize coding before the approval and activation gates in section 10 are complete.
>
> Approval state: the Project Owner approved and merged the documentation through PR #105 at `7e46809`.
> The later Sprint activation is recorded in `docs/sprints/CURRENT_SPRINT.md`.

## 1. Audit scope

The audit covers the complete candidate Sprint 09 Heritage documentation set:

1. `docs/development/SPRINT_09_HERITAGE_CURRENT_STATE_AUDIT.md`
2. `docs/sprints/sprint-09.md`
3. `docs/design/SPRINT_09_HERITAGE_PHYSICAL_ERD_OVERLAY.md`
4. `docs/use-cases/sprint-09-use-case-specifications.md`
5. `docs/api/sprint-09-api-contract.md`
6. `docs/sprints/SPRINT_09_IMPLEMENTATION_PLAN.md`
7. `docs/development/SPRINT_09_HERITAGE_IMPLEMENTATION_HANDOFF.md`

The documents were checked against:

- `AGENTS.md` and its source-of-truth, Session, database, migration, and team-workflow rules
- `AI_CONTEXT.md`
- `docs/sprints/CURRENT_SPRINT.md`
- `docs/requirements/05_Business_Rules.md`
- `docs/requirements/06_Use_Case_List.md`
- `docs/requirements/08_MVP_Scope_v2.md`
- the current Logical and Physical ERD reports and drawio sources
- immutable production Flyway migrations V1 through V14
- current backend security and test structure
- current public and Organizer Heritage frontend files
- the completed Sprint 8 Feedback boundary

No production code, migration, `.env`, demo data, or user-owned `backend/scripts/` content was changed as
part of this audit.

## 2. Executive conclusion

After the corrections in section 3, all candidate documents agree on one bounded Heritage vertical slice:

- one shared collection managed only by effective verified Organizers
- no Admin Heritage API or UI
- anonymous list and direct detail for published content only
- exactly `DRAFT`, `PUBLISHED`, and `ARCHIVED`
- one immutable canonical `publicCode` for public identity
- internal numeric identity for Organizer operations
- first publication time preserved through archive and republish
- hard delete only for a never-published draft
- exact optimistic concurrency on every Organizer mutation
- one independent 11-column PostgreSQL table
- no Heritage relationship with General Feedback
- ten HTTP operations and 28 Acceptance Criteria
- real public and Organizer frontend integration with no local fallback
- one Heritage implementation owner with explicit Notification coordination

There are no unresolved P0 or P1 cross-document contradictions. Remaining items are explicit approval,
activation, migration-reservation, and implementation gates rather than hidden product decisions.

## 3. Findings and corrections

### AUD-S9-01 - Logical ERD still granted Admin Heritage management

- Severity before correction: `P1`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: the audited Logical ERD wording said Organizer or Admin could create and publish Heritage
  content, while the Use Case List and MVP baseline define public-content management for Organizer and no
  Admin Heritage Use Case.
- Correction: the Logical ERD report now names Organizer only. The current-state audit records the old
  baseline wording as historical evidence and records the approved Organizer-only decision.
- Result: Sprint baseline, Use Case Specifications, API Contract, ERD text, implementation plan, and
  handoff now agree that an Admin-only account is denied.

### AUD-S9-02 - Source precedence and required reading needed separation

- Severity before correction: `P1`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: an early implementation-plan draft placed supporting MVP material ahead of active Sprint
  specifications in its conflict order. The handoff also did not list the MVP scope explicitly.
- Correction: the implementation plan now uses Business Rules, Use Case List, Sprint scope and Acceptance
  Criteria, Use Case Specifications, Physical ERD, and API Contract in project precedence order. Supporting
  documents follow those sources. The handoff separately preserves the project-required reading sequence.

### AUD-S9-03 - Implementation-plan traceability used ranges instead of all literal AC identifiers

- Severity before correction: `P2`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: the plan semantically covered all criteria through ranges, but an automated unique-identifier
  audit found only 13 literal AC identifiers.
- Correction: the phase delivery map now names every one of the 28 criteria. Sprint baseline, Use Case
  Specifications, API Contract, and implementation plan each contain the same 28 unique identifiers with
  no missing or extra identifier.

### AUD-S9-04 - Activation deliverables did not name the handoff and audit file consistently

- Severity before correction: `P2`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: the Sprint activation paragraph and deliverable list did not both name the newly required short
  implementation handoff and the exact documentation-audit path.
- Correction: the Sprint baseline now lists the current-state audit, baseline, overlay, specifications,
  contract, plan, handoff, and this audit as one review set.

### AUD-S9-05 - V15 appears free but is not reserved

- Severity: `P0 pre-code gate`.
- Status: `OPEN GATE - EXPECTED AND DOCUMENTED`.
- Evidence: the inspected production migration directory contains V1 through V14 and no V15 file.
- Required action: after the documentation is approved and Sprint 9 is active, the Project Owner updates
  from `main`, lists all migrations, coordinates with the Notification developer, and reserves the next free
  version.
- Constraint: V1 through V14 remain immutable. The documentation does not reserve V15.

### AUD-S9-06 - Current broad Organizer security matcher can admit an Admin-only account

- Severity: `P1 implementation dependency`.
- Status: `COVERED BY CONTRACT AND PLAN`.
- Evidence: the current broad Organizer route configuration supports existing Organizer or Admin behavior,
  while Heritage requires effective verified Organizer authority and denies an Admin-only Session.
- Required implementation: place a specific Heritage route rule before the broader matcher and enforce the
  same authority at method level. Preserve existing security outside the Heritage route families.
- Required verification: anonymous, Participant-only, Partner-only, Admin-only, disabled, and unverified
  accounts are denied while a valid multi-role account with effective Organizer authority is accepted.

### AUD-S9-07 - Current frontend is a polished placeholder with an incompatible model

- Severity: `P1 implementation dependency`.
- Status: `COVERED BY CONTRACT AND PLAN`.
- Evidence: the public adapter returns an empty Heritage collection, the detail stub uses a legacy route,
  the Organizer adapter returns empty or unsupported operations, and current types contain translation,
  category, map, analytics, QR-state, and lower-case lifecycle assumptions.
- Required implementation: replace the legacy contract with the approved typed API model. Remove unsupported
  public search and category controls, support direct detail loading, activate the Organizer route, and
  never fall back to local records.

### AUD-S9-08 - Strict timestamp concurrency requires deliberate database precision handling

- Severity: `P1 implementation dependency`.
- Status: `COVERED BY SCHEMA, CONTRACT, PLAN, AND HANDOFF`.
- Risk: two accepted writes can observe the same system-clock value, and browser timestamp parsing can lose
  the raw PostgreSQL microsecond token.
- Required implementation: normalize operation time to PostgreSQL microsecond precision and choose a value
  strictly later than the previous persisted `updatedAt`. Preserve the raw response string in the frontend.
- Required verification: fixed or repeating Clock tests prove strict advancement and stale commands never
  overwrite accepted state.

### AUD-S9-09 - Initial search index is intentionally minimal

- Severity: `P2 performance watch item`.
- Status: `ACCEPTED FOR INITIAL VOLUME`.
- Decision: the unique public-code constraint and two ordering indexes cover exact public lookup, public
  published ordering, and Organizer status ordering. Initial case-insensitive contains search may scan the
  bounded filtered result set.
- Boundary: Sprint 9 does not add `pg_trgm`, full-text extensions, or a speculative extra migration. Query
  plans and realistic volume must justify any later index.

### AUD-S9-10 - Heritage and Notification may collide in shared files or migration numbering

- Severity: `P1 coordination dependency`.
- Status: `COVERED BY PLAN AND HANDOFF`.
- Required coordination: the Project Owner exclusively owns the Heritage migration, and the Notification
  workstream must not use the same reserved number. Shared security, route, sidebar, portal, and type edits
  are serialized by merge order. The later branch rebases and reapplies only its focused change.
- Boundary: Heritage publication and archive create no Notification side effect in Sprint 9.

## 4. Scope and business consistency

Audit result: `PASS`.

- Sprint 9 refines only the Heritage parts of `UC-G01` and `UC-O09`.
- It does not create a new top-level Heritage Use Case.
- Heritage remains supporting public content rather than a conservation or artifact-management domain.
- Every verified Organizer sees the same collection without an owner or Event filter.
- Admin management, approval workflow, ownership assignment, reporting, analytics, bulk operations,
  scheduling, external asset libraries, map editing, and version history remain out of scope.
- General Feedback stays limited to `BOOK_STREET` and `EVENT` under BR-65.
- No Sprint 9 document introduces a Feedback foreign key, target, selector, filter, or detail branch for
  Heritage.
- Existing Event, Booth, Activity, Payment, Attendance, Reward, Rating, Feedback, and Notification behavior
  remains outside the mutation scope.

## 5. Acceptance Criteria and API traceability

Audit result: `PASS`.

Unique Acceptance Criteria were compared across the Sprint baseline, Use Case Specifications, API Contract,
and implementation plan:

- `AC-O09-S9-01` through `AC-O09-S9-14` are present in all four documents
- `AC-G01-S9-01` through `AC-G01-S9-08` are present in all four documents
- `AC-S9-DB-01` through `AC-S9-DB-03` are present in all four documents
- `AC-S9-REG-01` through `AC-S9-REG-03` are present in all four documents
- total is 28 unique identifiers in each document
- the Use Case Specifications contain 28 matching Given and 28 matching Then acceptance scenarios

The Physical ERD overlay intentionally traces only criteria with persistence consequences. The short
handoff references the complete 28-criterion obligation without duplicating all acceptance text.

The amended API Contract, implementation plan, and handoff agree on thirteen operations:

```text
GET    /api/v1/heritages
GET    /api/v1/heritages/{publicCode}
GET    /api/v1/organizer/heritages
GET    /api/v1/organizer/heritages/{heritageContentId}
POST   /api/v1/organizer/heritages
PATCH  /api/v1/organizer/heritages/{heritageContentId}
POST   /api/v1/organizer/heritages/{heritageContentId}/publish
POST   /api/v1/organizer/heritages/{heritageContentId}/archive
POST   /api/v1/organizer/heritages/{heritageContentId}/republish
DELETE /api/v1/organizer/heritages/{heritageContentId}?expectedUpdatedAt={encodedInstant}
POST   /api/v1/organizer/heritage-images
DELETE /api/v1/organizer/heritage-images/{fileName}
GET    /assets/heritage/uploads/{fileName}
```

The Use Case Specifications correctly freeze behavior without prematurely redefining transport details.

## 6. Schema, lifecycle, and validation consistency

Audit result: `PASS`.

The overlay, API Contract, plan, and handoff agree on one table named `heritage_contents` with exactly 11
columns:

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

The physical design contains:

- one identity primary key
- one canonical public-code unique constraint
- nine named CHECK constraints
- one partial public ordering index
- one Organizer status and ordering index
- no foreign key
- no owner, Event, Feedback, translation, map, QR, analytics, upload, or soft-delete column

Validation and normalization agree across specification, overlay, and API Contract:

- canonical `publicCode` length from 3 through 100 with the approved uppercase hyphenated pattern
- title length from 2 through 200
- optional summary length from 1 through 1000
- content length from 20 through 20000
- optional image URL length from 1 through 2048
- optional location text length from 1 through 255
- Organizer search length from 1 through 100 when present
- page is zero-based and size is from 1 through 100 with defaults 0 and 20
- blank optional fields normalize to null
- title collapses repeated horizontal whitespace
- content normalizes line endings to LF and preserves intentional internal line breaks
- image references allow only valid HTTP, HTTPS, or nonempty `/assets/heritage/` paths

Lifecycle agreement is exact:

- create always produces `DRAFT` with null `publishedAt`
- first publish changes `DRAFT` to `PUBLISHED` and sets `publishedAt`
- archive changes `PUBLISHED` to `ARCHIVED` and preserves `publishedAt`
- republish changes `ARCHIVED` to `PUBLISHED` and preserves `publishedAt`
- content update changes no status or publication time
- hard delete requires `DRAFT`, null `publishedAt`, and a matching concurrency token
- published and archived records remain durable

## 7. Public visibility, security, privacy, and concurrency

Audit result: `PASS`.

- Public list and detail include `status = PUBLISHED` in PostgreSQL predicates.
- Draft, archived, unknown, lowercase, malformed, and noncanonical decoded codes share public-safe not-found
  behavior.
- Public responses contain no internal numeric identity, status, creation time, update time, owner, or
  concurrency token.
- Every Organizer mutation requires the exact raw `expectedUpdatedAt` token.
- Guarded update, publish, archive, republish, and delete commands cannot overwrite a newer row.
- Every accepted mutation returns committed state with a strictly later persisted `updatedAt`.
- Session and HttpOnly cookie remain the authentication model.
- Redis remains Session storage only.
- No JWT, bearer token, refresh token, or `/auth/refresh` route is introduced.
- Organizer mutations retain CSRF protection.
- All Heritage successes and errors require `Cache-Control: no-store`.
- Unknown JSON fields are rejected.
- Plain text is rendered without executing stored markup.
- Logs and errors do not expose SQL, constraint names, stack traces, credentials, Session values, CSRF
  values, or private content bodies.

## 8. Frontend and delivery feasibility

Audit result: `PASS WITH IMPLEMENTATION DEPENDENCIES IDENTIFIED`.

The inspected frontend already contains the visual Landing Page, `/di-san` experience, direct route shape,
and Organizer public-content screen. The implementation does not require a broad visual rewrite, but it must
replace the placeholder data contract.

The delivery plan correctly requires:

- a canonical typed Heritage model
- real public paging and direct detail requests
- direct refresh without preloaded list state
- removal of unsupported public search and category behavior
- safe optional image, summary, and location rendering
- direct canonical public routes without QR or technical-code labels
- bounded local image upload with generated filenames and URL-only persistence
- real Organizer list, detail, create, update, lifecycle, and eligible delete operations
- loading, initial empty, filtered empty, not-found, forbidden, validation, conflict, failure, and success
  states where applicable
- focused browser coverage instead of running the full historical Playwright suite by default
- normal backend and frontend CI before merge

The plan identifies current shared files and candidate feature files without authorizing unrelated refactors.

## 9. Ownership and handoff consistency

Audit result: `PASS`.

- One Heritage Owner owns the application backend-to-frontend slice and evidence for all 28 criteria.
- The Project Owner exclusively owns the Heritage migration SQL after latest-main verification and explicit
  reservation.
- Notification is a separate future workstream with its own audit, scope, contract, plan, and criteria.
- The Notification developer cannot modify Heritage lifecycle, DTOs, persistence, routes, or tests.
- The Heritage developer cannot redesign Notification or add outbound side effects.
- Shared-file edits are serialized and retested after rebase or conflict resolution.
- `AGENTS.md` and `AI_CONTEXT.md` ownership remains protected.
- The handoff states when the implementer may start, what they own, what they must not change, what to test,
  and when to stop and request clarification.
- Every commit requires a staged-diff audit and focused evidence before creation.

## 10. Mandatory gates before implementation

The documentation audit is clean, but coding remains blocked until all gates below are complete:

1. Project Owner reviews and approves the entire Sprint 9 document set.
2. Documentation changes are committed, reviewed, and merged through the normal PR path.
3. `docs/sprints/CURRENT_SPRINT.md` explicitly activates Sprint 9.
4. The implementation owner starts from updated `main` on a dedicated branch.
5. The Project Owner rechecks and reserves the next free migration version centrally.
6. Heritage and Notification owners confirm migration and shared-file boundaries.
7. The implementation PR records the documentation baseline commit and reserved migration.

The candidate V15 filename in design documents is not a reservation.

## 11. Audit evidence

Read-only and document checks confirmed:

- 28 unique AC identifiers in the Sprint baseline
- 28 unique AC identifiers in the Use Case Specifications
- 28 unique AC identifiers in the API Contract
- 28 unique AC identifiers in the implementation plan
- no AC difference among those four sets
- 28 Given and 28 Then acceptance scenarios
- ten unique full API operations in the contract, plan, and handoff
- 11 physical columns
- nine named CHECK constraints
- two declared indexes
- balanced Markdown code fences
- no unresolved task marker, trailing whitespace, or semicolon in the Sprint 9 document set
- clean `git diff --check`
- no production Heritage migration or backend feature package currently exists
- the current migration chain ends at immutable V14

No application build or test suite was run because this phase changes documentation only. The plan freezes
the focused backend, frontend, browser, security, migration, and regression evidence required during
implementation.

## 12. Final verdict

**PASS WITH CORRECTIONS APPLIED - READY FOR PROJECT OWNER REVIEW**.

The candidate Sprint 9 Heritage documentation is coherent, bounded, testable, and sufficiently detailed for
one assigned developer to implement without inventing product behavior. No unresolved high or medium
documentation defect remains.

This verdict does not activate Sprint 9. Implementation begins only after the approval, merge, activation,
migration reservation, and workstream-coordination gates in section 10 are complete.
