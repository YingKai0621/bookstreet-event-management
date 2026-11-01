# Sprint 08 General Feedback Documentation Audit

> Audit date: `2026-10-31`.
>
> Result: **PASS WITH CORRECTIONS APPLIED — READY FOR PROJECT OWNER REVIEW**.
>
> This result confirms that the candidate Sprint 08 documentation is internally consistent and
> implementable against the inspected repository baseline. It does not activate Sprint 08 and does
> not authorize coding before the approval and activation gates in section 9 are complete.

## 1. Audit scope

The audit covers the complete candidate Sprint 08 documentation set:

1. `docs/development/SPRINT_08_CURRENT_STATE_AUDIT.md`
2. `docs/sprints/sprint-08.md`
3. `docs/design/SPRINT_08_GENERAL_FEEDBACK_PHYSICAL_ERD_OVERLAY.md`
4. `docs/use-cases/sprint-08-use-case-specifications.md`
5. `docs/api/sprint-08-api-contract.md`
6. `docs/sprints/SPRINT_08_IMPLEMENTATION_PLAN.md`

The documents were checked against:

- `AGENTS.md` and its source-of-truth, authentication, database and workflow rules;
- `AI_CONTEXT.md`, while treating its stale Sprint/migration statements as known context-owner
  debt rather than silently rewriting that owned file;
- `docs/sprints/CURRENT_SPRINT.md` and the completed Sprint 7 baseline;
- `docs/requirements/05_Business_Rules.md`, especially BR-65;
- `docs/requirements/06_Use_Case_List.md`, especially UC-G04;
- `docs/requirements/08_MVP_Scope_v2.md`;
- `docs/design/12_Physical_ERD_Report.md`;
- immutable Flyway migrations V1 through V13;
- current backend security, public Event visibility, error response and in-memory limiter patterns;
- current Landing Page and Organizer Feedback adapters/components.

No production code, migration, `.env`, demo data or user-owned `backend/scripts/` content was
changed as part of this audit.

## 2. Executive conclusion

After the corrections recorded in section 3, the documents agree on one bounded vertical slice:

- public one-way General Feedback for `BOOK_STREET` and `EVENT`;
- optional Guest name/email and required message, with no rating or phone;
- exactly `NEW`, `IN_PROGRESS` and `RESOLVED`, with explicit start, resolve and reopen actions;
- one shared Feedback queue for every verified Organizer, without widening Event ownership;
- no Guest reply, status tracking, delete, reporting, Notification or Heritage implementation;
- one new PostgreSQL table and one immutable migration owned by one developer;
- six HTTP operations, 28 Acceptance Criteria and focused verification;
- Redis remains Session-only; the bounded Feedback throttle is process-local volatile state.

There are **no unresolved P0/P1 cross-document contradictions**. Remaining items are explicit
activation or implementation gates, not hidden product decisions.

## 3. Findings and corrections

### AUD-S8-01 — Redis throttle conflicted with the repository rule

- Severity before correction: `P0`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: early drafts placed public Feedback throttle counters in Redis, while `AGENTS.md`
  requires Redis to store temporary server-side Sessions only.
- Correction: the ERD overlay, Use Case Specification, API Contract and Implementation Plan now
  define a bounded process-local limiter with at most 5,000 active client windows. Redis is used
  only by Spring Session.
- Accepted limitation: restart resets the limiter, and multiple backend instances enforce separate
  local limits. Distributed throttling is outside Sprint 08.

### AUD-S8-02 — Source precedence was incomplete or ordered inconsistently

- Severity before correction: `P1`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: the Use Case source list placed the Sprint baseline after supporting design/audit files,
  and the API Contract omitted the Sprint baseline from its precedence statement.
- Correction: both documents now follow the project hierarchy: Business Rules, Use Case List,
  active Sprint scope/specification, Physical ERD plus approved overlay, then API/implementation
  detail.

### AUD-S8-03 — Event eligibility and Event selector discovery were ambiguous

- Severity before correction: `P1`.
- Status: `RESOLVED IN DOCUMENTATION`.
- Finding: submission eligibility correctly included `PUBLISHED`, `ONGOING`, `COMPLETED` and
  `CANCELLED`, but wording could be read as requiring the Landing Page dropdown to enumerate all
  completed/cancelled Events.
- Correction: the Sprint baseline, Use Case Specification, API Contract and Implementation Plan
  now distinguish the two rules:
  - the existing public list supplies discoverable `PUBLISHED`/`ONGOING` choices;
  - a contextually known `COMPLETED`/`CANCELLED` id is allowed only after existing public-detail
    resolution;
  - Sprint 08 adds no duplicate Feedback-target endpoint and does not widen Event discovery.

### AUD-S8-04 — Existing security behavior requires route-specific implementation

- Severity: `P1 implementation dependency`.
- Status: `COVERED BY CONTRACT AND PLAN`.
- Evidence: current generic `/api/v1/organizer/**` route authorization permits Organizer or Admin,
  while the approved Feedback contract requires effective `ROLE_ORGANIZER` and denies an
  Admin-only Session. Current CSRF error mapping also does not yet guarantee `CSRF_INVALID` for
  Feedback routes.
- Required implementation: keep the route configuration compatible and add method-level Organizer
  enforcement plus Sprint 08/common CSRF error mapping. Do not weaken any existing role boundary.

### AUD-S8-05 — Current frontend uses a legacy fake Feedback contract

- Severity: `P1 implementation dependency`.
- Status: `COVERED BY CONTRACT AND PLAN`.
- Evidence: the current public adapter/UI still contains rating, arbitrary target/source and
  Heritage-shaped fields; the Organizer surface contains legacy lowercase statuses, local/mock
  behavior and reply-oriented wording.
- Required implementation: replace the legacy contract rather than preserve a compatibility
  fallback. The plan names the affected files and requires real loading, empty, error and conflict
  states.

### AUD-S8-06 — Shared project context and main Physical ERD are stale for the candidate slice

- Severity: `P1 activation/closure debt`.
- Status: `OPEN — OWNED OUTSIDE THIS DOCUMENTATION TASK`.
- Evidence:
  - `AI_CONTEXT.md` does not yet reflect the current V1–V13/Sprint 7 completed baseline;
  - the main Physical ERD contains a broader/future General Feedback shape and is not an applied
    Sprint 08 schema.
- Boundary: the dedicated current-state audit and Physical ERD overlay make the candidate contract
  reviewable without silently changing owned control files.
- Required action: the assigned context owner updates `AI_CONTEXT.md` at activation; the main
  Physical ERD is updated after the actual migration is accepted, using the applied shape/version.

### AUD-S8-07 — V14 is available now but cannot be reserved by documentation

- Severity: `P0 pre-code gate`.
- Status: `OPEN GATE — EXPECTED AND DOCUMENTED`.
- Evidence: the inspected repository currently contains V1 through
  `V13__add_booth_image_url.sql` and no V14.
- Required action: update from `main` and list migrations immediately before creating the Sprint 08
  migration. If V14 has been taken, select the next free version and update the approved documents
  before code proceeds. V1–V13 remain immutable.

### AUD-S8-08 — Minimal index plan intentionally excludes free-text/target-type indexes

- Severity: `P2 performance watch item`.
- Status: `ACCEPTED FOR INITIAL VOLUME`.
- Decision: the three proposed indexes cover default queue order, status and Event filtering. The
  initial slice does not add PostgreSQL extensions or a free-text index. Query plans must be
  reviewed with realistic data before adding another migration/index.

## 4. Scope and business-rule consistency

Audit result: `PASS`.

- The product decision dated `2026-11-01` supersedes the earlier deferred Heritage assumption.
- BR-65 now permanently limits General Feedback to `BOOK_STREET` and `EVENT`. Heritage content is
  independent and does not require a Feedback foreign key.
- General Feedback remains separate from Activity Rating and stores no score.
- Optional name and email are contact context only; no phone is accepted and no result is sent.
- Every verified Organizer uses the same Management Board queue.
- Shared Feedback access is explicitly isolated from Event create/update/publish/cancel ownership.
- No document introduces Admin management, reports, hard delete, Guest tracking or outbound reply.

## 5. Acceptance Criteria and API traceability

Audit result: `PASS`.

Unique Acceptance Criteria were compared across the Sprint baseline, Use Case Specification and
API Contract:

- `AC-G04-S8-01` through `AC-G04-S8-12`: 12/12 present in all three documents;
- `AC-O-S8-01` through `AC-O-S8-12`: 12/12 present in all three documents;
- `AC-X-S8-01` through `AC-X-S8-04`: 4/4 present in all three documents;
- total: 28 unique identifiers in each document, with no missing or extra identifier.

The API Contract contains exactly the six approved operations:

```text
POST /api/v1/public/feedbacks
GET  /api/v1/organizer/feedbacks
GET  /api/v1/organizer/feedbacks/{feedbackId}
POST /api/v1/organizer/feedbacks/{feedbackId}/start-handling
POST /api/v1/organizer/feedbacks/{feedbackId}/resolve
POST /api/v1/organizer/feedbacks/{feedbackId}/reopen
```

No public list/detail, Guest status lookup, generic update, reply or delete route is defined.

## 6. Schema, workflow and concurrency consistency

Audit result: `PASS`.

The API-to-physical mapping covers all 14 proposed columns:

```text
general_feedback_id          submitted_by_user_id
target_type                  event_id
guest_name                   contact_email
message                      status
internal_note                last_handled_by_user_id
handling_started_at          submitted_at
updated_at                   resolved_at
```

Nullability and state rules agree across the overlay, Use Case and API:

- `BOOK_STREET` requires null `event_id`; `EVENT` requires one Event id;
- a new record has `NEW`, no handler, no handling/resolution time and no internal note;
- start handling records the current Organizer and current-cycle start time;
- resolve requires/replaces the normalized internal note and records resolution time;
- reopen retains the note, clears resolution time and begins a new handling cycle;
- reads never transition state;
- the latest actor/current-cycle fields are stored, not a fabricated transition history;
- row-level serialization plus current-state recheck yields one winner for stale concurrent
  transitions and a stable `409` for the loser.

The schema plan uses PostgreSQL as durable truth, `ON DELETE RESTRICT`, database checks as the final
invariant guard and Hibernate `ddl-auto: validate`.

## 7. Validation, errors, privacy and throttle consistency

Audit result: `PASS`.

Frozen normalized bounds are consistent:

- Guest name: optional, `1..100` after normalization;
- contact email: optional, valid syntax, lowercase, `3..255`;
- message: required, `10..2000`;
- resolve internal note: required, `1..1000`;
- Organizer message, sender/email and Event-name searches: independently optional, each `1..100`
  when present.

The API uses the current `ApiErrorResponse` body shape and keeps HTTP status outside the body.
Unknown/legacy fields are rejected instead of silently accepted. Public responses omit contact,
workflow and identity data; Organizer list omits direct contact/internal fields; authorized detail
may expose them.

The frozen throttle is consistent across the Use Case, API and plan:

- 10 counted attempts per client key in a fixed 600-second window;
- attempt 11 returns `429` with `Retry-After`;
- CSRF/malformed requests rejected before service invocation do not count;
- domain validation and Event-not-found probes that reach the service do count;
- authenticated key uses User id; anonymous key uses HMAC-SHA256 of the canonical remote address;
- untrusted forwarded headers are ignored;
- at most 5,000 unexpired local windows; unsafe evaluation/capacity exhaustion fails closed with
  `503` and creates no Feedback;
- no raw IP, Session id, HMAC secret or contact/internal value is persisted or logged.

## 8. Delivery and verification feasibility

Audit result: `PASS`.

- One developer owns the migration, backend feature, shared security/throttle edits and both small
  role-facing integrations, preventing competing schema/config implementations.
- Delivery is split sequentially into public foundation, Organizer handling, then verification and
  closure; no parallel migration owner is implied.
- The plan names focused migration, backend, concurrency, throttle, frontend and Playwright
  evidence.
- Backend/frontend CI remain required. The full historical Playwright suite is not required; only
  focused Sprint 08 browser scenarios and affected shared smoke checks are required.
- Activity Rating, Event ownership, Session/CSRF and Sprint 7 reward behavior have explicit
  regression coverage.
- `.env`, credentials, local IPs, contact data and demo Feedback remain outside commits.

## 9. Mandatory gates before implementation

Coding may begin only after all of these are complete:

1. Project Owner reviews and approves the six source documents plus this audit.
2. The documentation branch is merged through the normal review path.
3. The assigned context owner updates `AI_CONTEXT.md` to the accepted Sprint/migration baseline.
4. `docs/sprints/CURRENT_SPRINT.md` activates Sprint 08; until then Sprint 7 remains the latest
   completed Sprint.
5. One Sprint 08 General Feedback owner is explicitly assigned.
6. That owner starts a new implementation branch from updated `main`, verifies a clean worktree and
   rechecks every Flyway filename.
7. The runtime HMAC secret/configuration and safe test override are available without committing a
   real/default secret.
8. If the migration number or any route/DTO/status/constraint changes, the affected documents are
   updated and re-reviewed before coding continues.

## 10. Audit evidence and final verdict

This documentation-only audit used repository inspection and deterministic text checks:

- current branch/status and staged/unstaged diff inspection;
- `git diff --check`;
- Flyway filename enumeration;
- 28-ID set comparison across Sprint, Use Case and API documents;
- scans for Redis/throttle conflicts and legacy target/status language;
- route, DTO, schema-field, transition, limit and error-code comparison;
- inspection of current Event visibility, security/CSRF, error response, frontend mock and limiter
  implementation patterns.

No application test suite was run because no application code was changed.

Final verdict: **the candidate Sprint 08 documentation is coherent after the recorded corrections
and is ready for Project Owner review. Implementation remains blocked by the explicit activation
gates above, not by an unresolved documentation contradiction.**
