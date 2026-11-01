# Sprint 08 General Feedback Submission and Organizer Handling

- Status: `COMPLETED`
- Prepared date: `2026-10-31`
- Activation date: `2026-10-31`
- Completion date: `2026-11-01`
- Approved documentation merge: `a6f070c` (PR #100)
- Activation merge: `b6c8297` (PR #101)
- Public/schema implementation merge: `8384fe9` (PR #102)
- Organizer/closure implementation merge: `071b97a` (PR #103)
- Latest completed sprint: Sprint 08 General Feedback Submission and Organizer Handling
- Implemented schema baseline: immutable Flyway migrations `V1` through `V14`
- Current-state audit: `docs/development/SPRINT_08_CURRENT_STATE_AUDIT.md`
- Delivery owner: one developer completed the full vertical slice
- Migration owner: the same developer delivered immutable V14

This is the completed Sprint baseline. PR #100 approved the Physical ERD overlay, Use Case
Specification, API Contract, Implementation Plan and documentation audit together. PR #101
authorized implementation. PR #102 delivered the public/schema slice and PR #103 delivered the
Organizer slice. The accepted migration is V14 and is now immutable.

## 1. Purpose

Sprint 8 closes the visible General Feedback gap as one small end-to-end flow:

1. a Guest submits a message about the whole Book Street or one public Event;
2. the backend validates and durably stores the Feedback without requiring login;
3. every verified Organizer sees the same operational queue;
4. an Organizer explicitly moves the record through a bounded handling lifecycle; and
5. the system records internal handling metadata without promising or sending a reply to the Guest.

The Sprint replaces the current dead public call and hidden placeholder Organizer screen with real
PostgreSQL-backed behavior. It does not turn Feedback into Activity Rating, reporting, a help desk
or a cross-role messaging system.

## 2. Included Use Case slices

Sprint 8 includes:

- `UC-G04 Submit General Feedback` — partial active-MVP slice for `BOOK_STREET` and `EVENT`;
- a bounded Organizer handling path inside the same General Feedback workflow so submitted records
  have an operational destination.

The Organizer path does not create a new top-level Use Case count. It is the authorized management
side of `UC-G04`. `UC-O08` Event Reports and broad `UC-O09` Public Content management remain outside
this Sprint.

## 3. Scope lock

### 3.1 In scope

- public Feedback submission without authentication;
- `BOOK_STREET` and `EVENT` target types only;
- optional Guest name and optional contact email;
- optional authenticated submitter association derived from Session when a User is logged in;
- required normalized message content;
- `NEW`, `IN_PROGRESS` and `RESOLVED` lifecycle;
- a shared queue visible to every verified Organizer, without Event-owner filtering;
- server-side list pagination, search and approved filters;
- Organizer detail and explicit transition commands;
- internal processing note, last handling Organizer and handling timestamps;
- reopen from `RESOLVED` to `IN_PROGRESS`;
- public CSRF protection and a bounded anonymous-submission throttle;
- real Landing Page and Organizer UI integration;
- schema, migration, authorization, validation, concurrency and focused browser coverage.

### 3.2 Explicitly out of scope

- Heritage as a General Feedback target.
- Location, Booth, Facility or Activity as General Feedback targets;
- satisfaction stars, General Feedback score or changes to `ActivityRating`;
- phone contact, attachments or arbitrary custom fields;
- email, SMS, push, in-app Notification or public-page delivery of an Organizer result;
- a Guest tracking link, secret lookup code, reply thread or ticket portal;
- Admin Feedback UI, assignment queues or role/permission expansion;
- Feedback hard delete, bulk delete or anonymization workflow;
- reporting dashboards, score aggregates or Feedback analytics;
- CAPTCHA, third-party moderation or a generic abuse-prevention platform;
- Heritage/public-content CRUD, broad Organizer Notifications or unrelated placeholder screens;
- rewriting V1 through V14.

## 4. Existing prerequisites and invariants

Sprint 8 must preserve these completed behaviors:

- Spring Security server-side Session stored in Redis; no JWT or bearer-token alternative;
- the public CSRF endpoint and mutation retry behavior used by the shared frontend API client;
- Event visibility and lifecycle behavior delivered through Sprint 1-6;
- Organizer authorities require verified email;
- every existing Event retains its responsible `organizerUserId` for Event operations and audit;
- shared Organizer access in this Sprint applies only to Feedback and does not widen Event mutation
  permissions;
- Activity Rating remains owned by one eligible Attendance with score `1..5` and its completed
  Sprint 6 invalidation behavior;
- PostgreSQL is durable truth and Hibernate remains `ddl-auto: validate`;
- unknown or unsupported request fields do not silently create new product behavior.

## 5. General Feedback domain baseline

### 5.1 Identity and submitter

Each accepted submission creates one durable GeneralFeedback identity. A Guest does not need an
account. If a valid authenticated Session is present, the backend may associate that current User;
the request never accepts a caller-selected User id.

Guest name and contact email are independent optional values. An email, when supplied, is
normalized and validated. Sprint 8 does not accept a phone number and does not use the email to
send processing results.

### 5.2 Target rules

Exactly one target applies:

- `BOOK_STREET`: no Event reference is stored;
- `EVENT`: exactly one existing public-visible Event reference is stored.

Draft or unknown Events are not valid public targets. The Use Case Specification and API Contract
must align Event eligibility with the existing public Event visibility rules, including the
already-approved handling of Completed or Cancelled public detail links.

Heritage is not a `UC-G04` target in the current business baseline. The schema and API reject
`HERITAGE` together with caller-supplied Booth, Location, Facility or Activity references.

### 5.3 Content and privacy

The durable business content is a normalized nonblank message. No satisfaction score is stored.
Request and response limits, normalization and stable validation errors belong to the API
Contract.

Public acknowledgement must not echo contact email, internal status metadata or Organizer data.
Only authorized Organizers may read the submitter/contact fields. General Feedback is never exposed
through a public list or detail endpoint.

### 5.4 Handling lifecycle

The only statuses are:

```text
NEW -> IN_PROGRESS -> RESOLVED
          ^              |
          +--------------+
               reopen
```

Rules:

- submission always creates `NEW`;
- viewing a record never changes its status;
- `NEW -> IN_PROGRESS` is an explicit “start handling” action;
- `IN_PROGRESS -> RESOLVED` requires a nonblank internal processing note;
- `RESOLVED -> IN_PROGRESS` reopens the record and clears the active resolution timestamp;
- unsupported, stale or repeated transitions return a contract-defined conflict and do not
  silently rewrite timestamps;
- no endpoint hard-deletes a record;
- no transition sends a message to the Guest.

The backend derives the acting Organizer from Session and records the latest handling actor and
time. Reopening does not delete the submitted message or internal note. Sprint 8 does not introduce
a separate transition-history table.

### 5.5 Shared Organizer queue

Every verified Organizer is part of one Management Board queue and may list, view and transition
Feedback for the whole Book Street and every Event. The service must not filter Event Feedback by
`events.organizer_user_id`.

This is a Feedback-specific decision. Event create/update/publish/cancel, Partner review,
participation monitoring and every previously owner-scoped operation keep their existing
authorization rules.

The queue uses server-side pagination and contract-approved sorting. Search/filter must use the
same authorization predicate as count and content queries and must return a genuine empty result,
not placeholder rows.

## 6. Public security and abuse boundary

- Guest submission is `permitAll` at the reviewed route but remains CSRF-protected.
- The existing public CSRF cookie/header flow is reused; Sprint 8 does not add a CSRF exemption.
- An authenticated Session, when present, is read server-side and never required for submission.
- The endpoint has a bounded throttle with a stable `429` error contract.
- The exact threshold, window, client key and trusted-proxy behavior must be fixed in the API
  Contract before coding.
- The approved solution must not persist a raw client IP merely to implement the throttle.
- Contact email, internal note and Organizer identity must not appear in logs or public errors.

The Sprint does not promise production-grade bot prevention. CAPTCHA and distributed abuse
infrastructure are separate work.

## 7. Role-facing target state

### 7.1 Guest/Public

The Landing Page:

- offers “Toàn Đường Sách” and the `PUBLISHED`/`ONGOING` Events already returned by public
  discovery; an existing public context may preselect a public-detail-eligible
  `COMPLETED`/`CANCELLED` Event without widening discovery;
- removes Heritage choices because Heritage is not a General Feedback target.
- removes the star/rating control;
- provides separate optional name and email inputs;
- labels message as required and explains that Feedback is a one-way contribution;
- disables repeat submit while the request is in flight;
- renders real success, validation, throttled and server/network failure states;
- never shows a false success after an API failure.

The existing Feedback QR may continue to open the Landing Page anchor. It remains navigation only
and carries no identity, authorization or secret token.

### 7.2 Organizer

The Organizer portal exposes one Feedback navigation item only after the real API is wired. The
screen provides:

- a paged queue with target, status, submitted time and privacy-safe summary;
- separate server-backed content, sender/email and Event-name searches plus target/status filters;
- detail view for message and optional contact information;
- explicit start, resolve and reopen actions;
- an internal note field clearly labelled as not sent to the Guest;
- loading, empty, forbidden, conflict and retryable failure states;
- no local mock array, unsupported promise or client-only fabricated pagination.

UI wording uses “Xử lý góp ý” and “Đánh dấu đã giải quyết”. It must not say that a response was sent
to the reader.

## 8. Schema direction

The target/reference Physical ERD already contains `general_feedbacks`, but its header is stale and
its Feedback shape does not yet cover all approved Sprint 8 processing metadata. Before migration
work starts, the Physical ERD overlay must reconcile:

- GeneralFeedback identity and optional current User;
- `BOOK_STREET`/`EVENT` target XOR and Event foreign key;
- optional Guest name/contact email and required message;
- exact status constraint;
- internal processing note and latest handling Organizer;
- submitted, updated, handled and resolved timestamps as approved by the final contract;
- indexes needed for the shared Organizer queue;
- foreign-key delete behavior and no-hard-delete history policy.

V14 was confirmed available and applied as
`V14__create_sprint8_general_feedback_schema.sql`. V1-V14 are now immutable. Heritage target support
is not planned and must not be introduced by a later migration.

## 9. Acceptance Criteria baseline

### 9.1 Guest submission — `AC-G04-S8`

1. `AC-G04-S8-01`: an unauthenticated Guest can submit valid `BOOK_STREET` Feedback through the
   public CSRF-protected flow and receives a durable acknowledgement.
2. `AC-G04-S8-02`: a Guest can submit valid `EVENT` Feedback only for an Event eligible under the
   approved public visibility rule.
3. `AC-G04-S8-03`: exactly one target is accepted; unknown targets and Event references on
   `BOOK_STREET` fail with stable validation errors and create no row.
4. `AC-G04-S8-04`: Draft, missing or otherwise non-public Event targets fail without leaking
   private Event data.
5. `AC-G04-S8-05`: message, optional Guest name and optional email are normalized and bounded by
   the API Contract; invalid email or blank/oversized content creates no row.
6. `AC-G04-S8-06`: rating, phone, Booth, Location, Facility, Activity, Heritage and caller-selected
   User fields are rejected rather than ignored or persisted.
7. `AC-G04-S8-07`: when a valid Session exists, submitter identity comes only from the Security
   context; anonymous submission remains valid without a Session.
8. `AC-G04-S8-08`: every successful submission starts as `NEW` with server-owned timestamps and no
   resolved or handling actor state.
9. `AC-G04-S8-09`: the public response and logs expose no contact email, internal note, Session id
   or management identity.
10. `AC-G04-S8-10`: a missing/invalid CSRF token is rejected; the approved anonymous throttle
    returns stable `429` behavior without persisting raw client IP.
11. `AC-G04-S8-11`: a persistence failure never produces a success UI or partial durable record.
12. `AC-G04-S8-12`: the Landing Page uses the real API with deliberate loading, success,
    validation, throttle and failure states and no production mock fallback.

### 9.2 Organizer handling — `AC-O-S8`

1. `AC-O-S8-01`: every verified Organizer can list Feedback across the whole Book Street and all
   Events; Event ownership does not filter this queue.
2. `AC-O-S8-02`: an unauthenticated User or a User without the approved Organizer authority cannot
   list, view or transition Feedback.
3. `AC-O-S8-03`: list content and total counts use identical authorization, search, target, Event
   and status filters with real server-side pagination and stable sorting.
4. `AC-O-S8-04`: an authorized Organizer can view one Feedback detail including optional contact
   data, while public endpoints cannot retrieve it.
5. `AC-O-S8-05`: viewing detail does not change status, actor or timestamps.
6. `AC-O-S8-06`: `NEW -> IN_PROGRESS` records the Session Organizer and handling time atomically.
7. `AC-O-S8-07`: `IN_PROGRESS -> RESOLVED` requires a normalized internal note and atomically
   records the Session Organizer plus resolution time.
8. `AC-O-S8-08`: `RESOLVED -> IN_PROGRESS` reopens atomically, clears active resolution time and
   preserves the submitted Feedback and internal note.
9. `AC-O-S8-09`: unsupported or concurrent stale transitions converge to one legal durable state;
   a rejected transition does not overwrite another Organizer's committed result.
10. `AC-O-S8-10`: no Organizer endpoint hard-deletes Feedback or sends email, Notification, SMS,
    push or a public reply.
11. `AC-O-S8-11`: the Organizer UI is routed and visible only with real APIs and renders genuine
    loading, empty, forbidden, conflict and failure states without placeholder rows.
12. `AC-O-S8-12`: shared Feedback access does not widen authorization for any existing Event or
    Organizer operation outside the Feedback feature.

### 9.3 Schema and regression — `AC-X-S8`

1. `AC-X-S8-01`: a clean database and the supported V13 upgrade path apply the new immutable
   migration and pass Hibernate `ddl-auto: validate`.
2. `AC-X-S8-02`: database constraints enforce target/status/timestamp consistency and required
   foreign keys even when service validation is bypassed.
3. `AC-X-S8-03`: completed Activity Rating behavior, Event ownership, browser Session/CSRF and
   Sprint 7 reward behavior remain unchanged.
4. `AC-X-S8-04`: focused backend integration and browser scenarios cover public success/errors,
   Organizer shared access, filters, transitions, conflict and mobile form behavior.

The approved baseline therefore contains **28 Acceptance Criteria**: 12 Guest/Public, 12 Organizer
and 4 schema/regression criteria.

## 10. Required scenario coverage

At minimum, implementation evidence must include:

- Guest `BOOK_STREET` success without login;
- Guest `EVENT` success and invalid/private Event rejection;
- optional authenticated submitter association without request-selected identity;
- exact target, unknown-field, message, name and email validation;
- CSRF rejection/retry and throttle response;
- database constraint and migration-upgrade coverage;
- all Organizers seeing the same queue regardless of Event creator;
- list pagination/filter/count consistency and empty results;
- detail privacy and non-Organizer denial;
- each legal transition plus direct/invalid/stale/concurrent transition rejection;
- resolve note requirement and reopen timestamp behavior;
- no outbound Guest delivery and no hard delete;
- Landing Page and Organizer desktop/mobile focused browser flows;
- regressions for Activity Rating and Event owner-scoped mutation authorization.

No full historical Playwright run is required to close this one-person slice. Only focused Sprint 8
browser scenarios plus affected shared smoke tests are mandatory; backend/frontend CI remains
unchanged.

## 11. Delivery order

One developer owns the complete slice in this order:

1. approve this Sprint baseline and the Sprint 8 Physical ERD overlay;
2. approve the Use Case Specification and API Contract, including throttle values;
3. reserve and implement the next migration plus migration/Hibernate tests;
4. implement Feedback entity/repository/service/security/controller and backend integration tests;
5. reconcile the public Landing Page form with the approved command;
6. wire the Organizer route, shared queue, detail and transition UI;
7. add focused browser coverage and run related backend/frontend checks;
8. record closure evidence and only then mark Sprint 8 complete.

The developer must not start from a stale branch, edit an already applied migration or split schema
ownership across concurrent branches.

## 12. Definition of Done

Sprint 8 is complete only when:

- all 28 Acceptance Criteria have traceable automated or explicitly manual evidence;
- the approved migration is immutable and both clean-install and V13 upgrade paths pass;
- Guest submission works without login through the real CSRF-protected API;
- every verified Organizer sees and handles the same durable queue;
- legal transitions, internal note, actor and timestamps are consistent under retries/concurrency;
- no public response leaks contact or management-only data;
- no UI falls back to fake Feedback rows or claims a reply was delivered;
- focused backend tests, frontend lint/build and Sprint 8 browser scenarios pass;
- `CURRENT_SPRINT.md`, Physical ERD status and closure report reflect the delivered baseline;
- no credentials, Session values, contact data, local IPs or demo-only Feedback records are
  committed.

## 13. Documentation gates before code

The following must be reviewed together before implementation begins:

1. this Sprint baseline;
2. Sprint 8 Physical ERD overlay for GeneralFeedback;
3. `docs/use-cases/sprint-08-use-case-specifications.md`;
4. `docs/api/sprint-08-api-contract.md`;
5. the compact one-developer delivery plan and migration ownership declaration.

These documents were approved through PR #100 and `docs/sprints/CURRENT_SPRINT.md` activated Sprint
8 through PR #101. Implementation was merged through PR #102 and PR #103. Closure evidence is in
`docs/development/SPRINT_08_CLOSURE_REPORT.md`, and Sprint 8 is now the latest completed Sprint.

## 14. Approved product decisions

- Feedback is a one-way contribution channel; no result is sent back to the Guest.
- Sprint 8 supports only `BOOK_STREET` and `EVENT`. Heritage is permanently excluded from
  General Feedback by the current business baseline.
- every verified Organizer shares one Feedback queue across all Events;
- shared Feedback access does not grant shared Event mutation rights;
- General Feedback has no star score and does not reuse `ActivityRating`;
- name and email are optional; phone contact is not accepted;
- statuses are exactly `NEW`, `IN_PROGRESS` and `RESOLVED` with one reopen path;
- resolve requires an internal note; viewing never changes status;
- no Feedback delete, Guest reply, report, broad Notification or Admin UI is included;
- implementation remains one vertical slice owned by one developer.
