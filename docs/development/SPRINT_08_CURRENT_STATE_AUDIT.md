# Sprint 8 General Feedback Current-State Audit

- Status: `REVIEWED - PRODUCT DECISIONS APPROVED`
- Audit date: `2026-10-31`
- Product decision date: `2026-10-31`
- Audited baseline: `main` at merge commit `61d4b45` (PR #99)
- Implemented database baseline: immutable Flyway migrations `V1` through `V13`
- Latest completed sprint: Sprint 07 Booth Visit, Points and Badge Progression
- Proposed candidate slice: `UC-G04` General Feedback submission plus a bounded Organizer handling
  workflow
- Sprint 8 status after this audit: **not activated until the Sprint baseline, schema overlay, Use
  Case Specification and API Contract pass their documentation gates**

> Supersession note dated `2026-11-01`: references below to a future or deferred Heritage Feedback
> target describe the pre-Sprint-9 baseline inspected on `2026-10-31`. The current BR-65 and UC-G04
> permanently limit General Feedback to `BOOK_STREET` and `EVENT`. Heritage content is independent.

## 1. Purpose and guardrails

This document records the repository state relevant to General Feedback before any Sprint 8
baseline, Use Case Specification, API Contract or Flyway migration is approved. It is an audit,
not permission to implement the visible placeholder screens as designed.

The audit follows the project source-of-truth order:

1. Business Rules and the active MVP Use Case List;
2. the completed Sprint 7 baseline and closure evidence;
3. the current Physical ERD plus immutable Flyway migrations;
4. backend controllers, security configuration and shared browser contract;
5. frontend routes, services, screens and automated-test inventory.

Rules retained during planning:

- PostgreSQL remains durable truth; Redis stores Session only; JWT remains forbidden.
- V1 through V13 are immutable. A newly approved schema change must use the next available Flyway
  version and must have one declared owner.
- `GeneralFeedback` and `ActivityRating` are different concepts. Sprint 8 must not change the
  completed Sprint 6 Activity Rating rules.
- Placeholder fields, statuses, routes and screens do not authorize new schema or API behavior.
- Guest submission must not become a reason to disable CSRF globally or trust a caller-selected
  User identity.
- Heritage, broad reporting, cross-role Notifications and generic Admin settings remain separate
  slices unless the Project Owner explicitly expands the Sprint 8 baseline.

Evidence inspected for this audit:

- `AI_CONTEXT.md`, `docs/sprints/CURRENT_SPRINT.md`, the Sprint 7 baseline and closure report;
- `docs/requirements/05_Business_Rules.md`, `06_Use_Case_List.md` and `08_MVP_Scope_v2.md`;
- the Logical ERD, current Physical ERD report/drawio and Flyway V1-V13;
- backend controller mappings, `SecurityConfiguration` and the shared error/CSRF boundaries;
- `FeedbackSection`, `publicApi`, `OrganizerFeedbackView`, `organizerApi`, Organizer routing and
  the current backend/frontend test inventory.

## 2. Approved business baseline

The approved requirements establish only the following General Feedback behavior:

- `UC-G04` allows a Guest to submit General Feedback without logging in.
- At the time of this audit, `BR-65` listed `HERITAGE` as a third future target. That statement was
  superseded on `2026-11-01`. Current BR-65 permits only `BOOK_STREET` or `EVENT`.
- General Feedback must not target a Location, Booth or Activity.
- `submittedByUserId`, guest name and contact email are optional.
- `ActivityRating` remains Attendance-owned, score-based and restricted to eligible Participants;
  it is not a General Feedback subtype.
- The target/reference Physical ERD describes `general_feedbacks` with an optional submitting User,
  XOR target references, optional contact metadata, message, status, submitted time and optional
  resolved time.
- The MVP baseline mentions a basic feedback summary, but no approved Use Case currently defines
  a detailed Organizer processing lifecycle, reply delivery or Admin workflow.

These sources do **not** yet approve exact API routes, request/response DTOs, status values,
transition rules, Organizer ownership behavior, rate limits, duplicate-submit behavior or a reply
delivery channel.

## 3. Implemented persistence and backend state

### 3.1 Database

The active schema through V13 contains no `general_feedbacks` table. V13 adds only Booth image
metadata and does not implement Feedback or Heritage persistence.

At the time of this audit, the Physical ERD drawio contained `general_feedbacks` and
`heritage_contents` as target/reference tables, but neither table existed in the immutable migration
chain. The pre-decision GeneralFeedback shape listed:

- `general_feedback_id`;
- optional `submitted_by_user_id`;
- `target_type` plus optional `event_id` or `heritage_content_id`. The Heritage field and relationship
  have since been removed from the ERD source.
- optional `guest_name`, `contact_email` and `subject`;
- required `message` and `status`;
- `submitted_at` and optional `resolved_at`;
- an XOR target constraint.

The target diagram does not contain the frontend placeholder fields `rating`, `source`,
`targetName`, `boothId`, `internalNote` or `assignee`. It also does not yet define the exact status
enum or its legal transitions.

### 3.2 Backend

There is currently:

- no Feedback feature package, entity, repository, service or controller;
- no public Feedback submit endpoint;
- no Organizer Feedback query or update endpoint;
- no Feedback migration, seed data or backend test coverage;
- no Feedback-specific pagination, validation, ownership or error contract.

The current security allowlist permits public reads for Events and Activities and public Chat
submission, but it does not permit anonymous `POST /api/v1/public/feedbacks`. Because unmatched
requests require authentication, merely adding that controller without updating the reviewed
security contract would still reject Guests.

The shared frontend client already obtains the public CSRF token and includes it on mutation
requests. A future anonymous Feedback command can therefore remain CSRF-protected; no CSRF bypass
is justified by the current frontend.

The codebase has a small Chat-specific in-memory rate limiter, but no approved shared anonymous
write-abuse policy. Reusing, replacing or omitting rate limiting is a Sprint 8 design decision, not
an implementation assumption.

## 4. Current frontend state

### 4.1 Public Landing Page

The Landing Page visibly renders a General Feedback form and a QR that opens the same page at the
`#gop-y` anchor. Submission calls `POST /public/feedbacks`, but no backend route exists, so the
screen currently reaches its error state instead of persisting data.

The visible form is not aligned with the approved baseline:

- it sends `rating`, while the target GeneralFeedback model has no rating field;
- it sends `comments`, while the target model names the durable content `message`;
- its single contact input advertises phone or email but sends the value as `contactEmail`;
- it sends display-only `targetName` and `source` fields;
- it does not send the approved `targetType` or Event reference identity.
- it effectively offers only `BOOK_STREET`, because `getHeritages()` intentionally returns an
  empty list and it offers no Event target;
- the service type still permits `boothId`, which conflicts with `BR-65`.

The QR is only a navigation convenience; it is not a Feedback identity or authorization token.

### 4.2 Organizer UI

An `OrganizerFeedbackView` component exists with search, client-side filters and the placeholder
statuses `new`, `in_progress`, `responded` and `closed`. However:

- the Organizer service returns an empty Feedback array;
- update always rejects as unsupported;
- the supported Organizer route allowlist excludes the Feedback tab;
- the Organizer sidebar does not expose Feedback;
- the component uses unapproved concepts including rating, Booth/Facility targets, internal note,
  assignee and a “reply to reader” promise without an approved delivery channel;
- pagination is local over an in-memory array rather than server-owned durable results.

The component is useful as a visual reference only. It is not an approved API/schema contract.

### 4.3 Automated tests

No current backend or Playwright test covers General Feedback submission or Organizer handling.
Activity Rating tests are unrelated regression coverage and must remain unchanged.

## 5. Source conflicts and documentation drift

The following conflicts must be resolved or explicitly bounded before coding:

1. **Target dependency resolved:** the `2026-11-01` product decision removed `HERITAGE` from
   General Feedback. Heritage persistence no longer creates a Feedback foreign-key dependency.
2. **Submission shape:** the Landing Page is rating-oriented, while the approved target model is a
   message-oriented General Feedback record.
3. **Target shape:** frontend placeholder types allow Booth and Facility targets, which are
   forbidden by `BR-65`.
4. **Handling ownership:** `UC-G04` defines Guest submission, but no approved Use Case or Business
   Rule at audit time said which Organizer may list or update `BOOK_STREET` or `EVENT` feedback.
5. **Processing lifecycle:** the ERD has `status` and `resolved_at`, but the status enum,
   transitions and reopen behavior are not approved. UI values cannot silently become the
   baseline.
6. **Reply semantics:** the UI says a response is sent to the reader, but no email, in-app or public
   response contract exists. An internal handling note must not be presented as delivered mail.
7. **Contact semantics:** the target model contains an email field, while the UI accepts phone or
   email in one value.
8. **Documentation state:** `CURRENT_SPRINT.md` and PR #99 correctly mark Sprint 7 complete and the
   schema is V1-V13, while `AI_CONTEXT.md`, `docs/README.MD` and the Physical ERD header still carry
   older Sprint/schema status. Their assigned owners should update them separately; this audit does
   not silently rewrite shared context-control files.

## 6. Candidate Sprint 8 boundary

The smallest coherent candidate is:

1. Guest submits one validated General Feedback record through the public Landing Page while
   preserving CSRF protection.
2. The backend stores only approved target, contact and message data; an authenticated User, when
   present, is derived from the Security context rather than the request.
3. An authorized management actor lists and views Feedback through server-side pagination and
   approved target/status filters.
4. That actor performs only the approved status transitions and records the minimum approved
   processing metadata.
5. The existing public and Organizer screens are reconciled to the approved contract, with real
   loading, empty, success, validation, forbidden and failure states and no mock fallback.
6. Migration, validation, security, ownership, persistence and focused browser coverage are added
   for the approved slice.

This candidate intentionally excludes:

- Activity Rating changes or aggregate-rating redesign;
- Heritage content CRUD/publication unless explicitly required to unblock the chosen target scope;
- Booth, Location, Facility or Activity feedback targets;
- Feedback summaries and broad Event reports;
- generic Organizer/Admin Notifications or email/SMS/push delivery;
- a public reply thread, help-desk/ticketing system, attachments or moderation workflow;
- Admin Roles/Permissions, System Settings, Audit Logs, Assets or unrelated placeholder tabs;
- CAPTCHA, third-party abuse services or a generic rate-limit framework unless separately approved.

## 7. Risk-ranked findings

### P0 - remaining activation gates after product review

1. Reconcile the approved product decisions in section 8 with a Sprint 8 Physical ERD overlay.
2. Approve the Use Case Specification and exact API routes, DTOs, errors, pagination and throttle
   behavior.
3. Remove the conflicting placeholder fields from the approved frontend target state.
4. Declare one owner for the next migration version after confirming no concurrent branch has
   reserved it.
5. Activate Sprint 8 in `CURRENT_SPRINT.md` only after these documentation gates pass.

### P1 - must be fixed inside the approved slice

1. Replace the visible Landing Page dead call with the reviewed contract.
2. Add server-side validation, pagination, target authorization and stable error codes.
3. Prevent caller-selected User identity and enforce shared Organizer-only Feedback access without
   widening existing Event mutation permissions.
4. Reconcile or remove Booth/Facility targets, rating, ambiguous phone/email input and unsupported
   reply wording.
5. Add migration upgrade tests, backend integration tests and focused public/Organizer browser
   tests.

### P2 - separate debt

1. Update shared context and ERD status headers through their assigned owners.
2. Revisit Heritage persistence in its own approved slice if it is not selected as a dependency.
3. Design basic reporting, broad notifications and production-grade anonymous-abuse protection as
   separate contracts.

## 8. Approved product decisions

The Project Owner approved the following Sprint 8 direction on `2026-10-31`:

1. Sprint 8 implements the `BOOK_STREET` and `EVENT` targets. The later `2026-11-01` product
   decision confirms these are the complete General Feedback target set and Heritage is not deferred.
2. Every verified `ORGANIZER` account belongs to the shared Management Board queue and may view and
   process Feedback across all Events. Event ownership remains unchanged for Event mutation APIs;
   this shared access is specific to Feedback.
3. General Feedback has no satisfaction score. The current star control is removed rather than
   persisted, and completed `ActivityRating` behavior remains unchanged.
4. Guest name and contact email are optional. Sprint 8 does not accept a phone number in the email
   field and does not add a separate phone field.
5. The only statuses are `NEW`, `IN_PROGRESS` and `RESOLVED`. The permitted transitions are
   `NEW -> IN_PROGRESS`, `IN_PROGRESS -> RESOLVED` and reopen `RESOLVED -> IN_PROGRESS`.
6. Opening or viewing a Feedback record never changes status automatically. Every transition is an
   explicit Organizer command using Session identity.
7. Resolving requires an internal processing note and records the acting Organizer and resolution
   time. Reopening clears the active resolution time but does not delete the Feedback or its
   internal note. A separate transition-history table is not part of Sprint 8.
8. General Feedback is a one-way contribution channel. The system acknowledges receipt but does
   not email, notify or expose the processing result to the Guest. UI copy must not promise a reply.
9. A bounded anonymous-submission throttle is in scope. The API Contract must set the exact limit
   and client-key/privacy behavior; Sprint 8 does not add CAPTCHA, a third-party abuse service or
   durable raw-IP storage.
10. Sprint 8 delivers submission plus an operational Organizer queue. Feedback summaries and broad
    reporting remain outside this slice.

These decisions approve product direction only. Exact columns, constraints, routes, DTOs, error
codes, pagination and throttle values still require the Physical ERD overlay and API Contract
before implementation.

## 9. Recommended documentation sequence

After this audit:

1. create `docs/sprints/sprint-08.md` with goal, scope, exclusions and Acceptance Criteria;
2. create `docs/use-cases/sprint-08-use-case-specifications.md` for Guest submission and the
   approved handling actor;
3. create `docs/api/sprint-08-api-contract.md` with exact routes, DTOs, validation, pagination,
   authorization, CSRF and error behavior;
4. add a compact single-developer implementation plan with migration ownership and delivery order;
5. update `docs/sprints/CURRENT_SPRINT.md` only after approval activates Sprint 8;
6. add a closure report only after implementation and focused verification are complete.

The next action is review of `docs/sprints/sprint-08.md`, followed by the Physical ERD overlay, Use
Case Specification and API Contract. No Sprint 8 code or migration should start from this audit
alone.
