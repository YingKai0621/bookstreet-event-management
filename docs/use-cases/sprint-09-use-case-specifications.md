# Sprint 09 Heritage Use Case Specifications

- Status: `APPROVED - ACTIVE`
- Prepared date: `2026-11-01`
- Scope: Heritage public discovery and shared Organizer management
- Activation date: `2026-11-01`
- Approved documentation merge: `7e46809` (PR #105)

This document refines the Heritage portions of `UC-G01 Explore Book Street` and
`UC-O09 Manage Public Content`. It does not create a new top-level Use Case.

## 1. Source and traceability

This specification must be read with:

- `docs/requirements/05_Business_Rules.md`
- `docs/requirements/06_Use_Case_List.md`
- `docs/requirements/08_MVP_Scope_v2.md`
- `docs/sprints/sprint-09.md`
- `docs/design/SPRINT_09_HERITAGE_PHYSICAL_ERD_OVERLAY.md`
- `docs/development/SPRINT_09_HERITAGE_CURRENT_STATE_AUDIT.md`
- the current Logical and Physical ERD under `docs/`

If these sources conflict, the source-of-truth order in `AGENTS.md` applies. The Sprint baseline
limits what is delivered now. It does not silently change the business baseline.

Sprint 09 contains exactly:

- the Heritage list and detail slice of `UC-G01`
- the Heritage management slice of `UC-O09`
- persistence and regression criteria required to support those slices

General Feedback is not part of this specification. Heritage is permanently outside the supported
General Feedback targets.

The API Contract written after this document must freeze exact routes, request and response shapes,
pagination values, error codes, and field error representation. This document freezes behavior and
acceptance outcomes without inventing those transport details early.

## 2. Shared domain and security rules

### 2.1 Actors and authority

Public Heritage list and detail operations are anonymous read-only operations. Guests and authenticated
users receive the same published content under the same visibility rules.

Organizer Heritage operations require an authenticated, active account with effective verified
`ORGANIZER` authority. The existing server-side Session stored in Redis remains the source of identity.
The browser continues to use the HttpOnly Session cookie and the shared CSRF contract.

The Heritage collection is shared by the Management Board:

- every verified Organizer can list and inspect all Heritage records
- every verified Organizer can perform an otherwise legal mutation
- there is no per-Organizer ownership predicate
- there is no Event ownership predicate
- the caller cannot submit a User id or role to widen authority

Anonymous, Participant-only, Partner-only, Admin-only, disabled, and unverified accounts cannot access
Organizer Heritage operations. A multi-role account that has effective verified `ORGANIZER` authority is
accepted even when it also has another role.

Public responses must not expose the internal numeric identity, concurrency token, or management-only
metadata. The API Contract cannot widen this public response boundary.

### 2.2 Record identity and public code

Each Heritage record has two identities:

- `heritageContentId`, an internal numeric identity for persistence and Organizer operations
- `publicCode`, a backend-generated stable identity used by public detail links

On create, the application derives the public code from the normalized title. Organizer input never
contains this technical value. The generator removes Vietnamese diacritics, converts non-alphanumeric
runs to single hyphens, uppercases the result and adds a numeric suffix when required for uniqueness. The
canonical value must:

- contain 3 to 100 characters
- begin with an uppercase ASCII letter
- contain only uppercase ASCII letters, digits, and single hyphens between nonempty segments
- match `^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$`

Uniqueness is case-insensitive in business meaning and canonical at persistence. A duplicate normalized
code returns a conflict and creates no row.

`publicCode` is immutable after creation. Content updates and lifecycle commands cannot replace it. Public
links always use the canonical uppercase code, while public screens do not display it as a label.

### 2.3 Content fields and normalization

The only mutable Heritage content fields in Sprint 09 are:

- `title`, required, normalized plain text from 2 to 200 characters
- `summary`, optional, normalized plain text from 1 to 1000 characters when present
- `content`, required, normalized plain text from 20 to 20000 characters
- `imageUrl`, optional, from 1 to 2048 characters when present
- `locationText`, optional, normalized plain text from 1 to 255 characters when present

Normalization applies before validation:

- surrounding whitespace is removed
- repeated horizontal whitespace in the title is collapsed
- intentional internal line breaks in content are preserved
- whitespace-only optional values become null
- content consisting only of whitespace remains invalid

`imageUrl` accepts only:

- an absolute `http` URL
- an absolute `https` URL
- an approved local path beginning with `/assets/heritage/`

Data URLs, blob URLs, raw bytes, base64 values, operating-system paths, traversal paths, scripts, and
unsupported schemes are rejected. The Organizer may upload a validated JPG, PNG, or WebP file up to 5 MB;
the backend generates its filename, stores it in local Heritage media storage and returns an approved
`/assets/heritage/uploads/` URL. This is not a general asset manager.

Unknown create or update fields are rejected. The API must not silently accept or discard bilingual
content, analytics, coordinates, category, period, source, license, QR status, ownership, lifecycle status,
or server-owned timestamps.

A content update must contain at least one approved mutable content field. An empty update is rejected and
must not advance `updatedAt`.

Stored content is plain text. Every frontend view renders it as text and must not execute stored markup or
scripts.

### 2.4 Lifecycle and publication time

The only Heritage statuses are:

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Every new record starts as `DRAFT`. Create and ordinary content update commands cannot select status.

The only legal lifecycle transitions are:

- `DRAFT` to `PUBLISHED`
- `PUBLISHED` to `ARCHIVED`
- `ARCHIVED` to `PUBLISHED`

There is no transition from `PUBLISHED` or `ARCHIVED` back to `DRAFT`. Repeating the current state or
skipping a legal source state is a conflict and changes nothing.

The first successful publish sets `publishedAt` using server time. Archive and republish preserve the
original `publishedAt`. `DRAFT` requires a null `publishedAt`. `PUBLISHED` and `ARCHIVED` require a non-null
`publishedAt`.

Content may be edited in any status. A successful content edit updates `updatedAt` but does not change
status or `publishedAt`.

### 2.5 Public visibility and non-disclosure

Only `PUBLISHED` records are publicly visible.

- the public list excludes `DRAFT` and `ARCHIVED`
- public detail resolves only a `PUBLISHED` record by canonical `publicCode`
- archive removes the record from public list and detail after the mutation commits
- republish restores the same public URL

A draft code, archived code, unknown code, or malformed code receives the same public-safe not-found
behavior. The response must not reveal whether a private row exists.

Public detail must work when opened directly. It cannot depend on a previously loaded list, Landing Page
state, mock collection, or client cache.

### 2.6 Deletion

Hard delete is allowed only for a `DRAFT` record whose `publishedAt` is null. The Organizer UI requires an
explicit confirmation before sending the delete command.

`PUBLISHED` and `ARCHIVED` records remain durable and reject hard delete. The Organizer UI does not present
hard delete as an available action for those statuses.

### 2.7 Shared-write concurrency

Organizer detail and list responses provide `updatedAt` as the optimistic concurrency token. Every content
update, publish, archive, republish, and draft delete command sends the last observed value unchanged as
`expectedUpdatedAt`.

The service performs one guarded mutation whose predicate contains both the record identity and matching
timestamp. Missing or malformed concurrency input fails validation. A stale token returns conflict and
does not overwrite the newer row.

After an accepted mutation, the returned `updatedAt` must be strictly later than the previous value at the
precision PostgreSQL persists. Clients treat the returned raw timestamp as an opaque token and do not
truncate, reformat, or calculate a replacement.

After a conflict, the UI explains that another Organizer changed the record and offers a safe reload. It
must not automatically retry the stale mutation.

### 2.8 Search, filtering, ordering, and paging

Organizer list behavior is server-owned:

- free-text search is normalized, case-insensitive contains matching across `publicCode`, `title`, and
  `locationText`
- status filtering accepts only the three canonical statuses
- supported sort choices are allowlisted by the API Contract
- default ordering is `updatedAt` descending, then internal id descending
- every explicit sort adds the internal id as a deterministic tie-breaker
- pagination bounds and defaults are frozen by the API Contract
- content and total count use the same authorization and filter predicate
- no match returns a successful empty page

Public list behavior is server-owned:

- only `PUBLISHED` rows enter the query
- default ordering is `publishedAt` descending, then internal id descending
- pagination is deterministic under equal timestamps
- an empty collection is a successful result rather than endless loading or mock fallback

### 2.9 Transaction boundaries

Each create, update, lifecycle transition, and delete executes in one database transaction. Validation,
state checking, concurrency checking, and persistence produce one committed result or no mutation.

The client shows success only after the durable response succeeds. Network or server failure cannot produce
a fabricated success state.

### 2.10 Public presentation boundary

The stable generated `publicCode` remains part of the route contract, but Heritage screens display no QR
block and no technical-code label. No QR token, image, status, scan counter, or analytics record exists.

## 3. UC-O09 Heritage management extension

### Goal

Let the Management Board maintain one shared Heritage collection and explicitly control which records are
public without allowing stale Organizer writes to overwrite newer work.

### Primary actor

Authenticated User with effective verified `ORGANIZER` authority.

### Preconditions

- The actor has a valid server-side Session.
- The account is active and satisfies the existing verified Organizer requirement.
- Detail and mutation operations reference an existing internal Heritage identity.
- Mutations other than create carry the last observed `updatedAt` token.

### Main flow A — Browse and inspect the shared collection

1. Organizer opens the Heritage management area.
2. Client requests the first server-side page.
3. System verifies effective Organizer authority.
4. System returns the shared Heritage page using deterministic default ordering.
5. Organizer may search by public code, title, or location and may filter by status.
6. Organizer may select an allowlisted sort and another valid page.
7. Organizer opens one record and receives its full approved management representation.
8. Reading the list or detail changes no data.

### Main flow B — Create a draft

1. Organizer chooses to create Heritage content.
2. Organizer provides a title, required content, an optional uploaded image, and other approved optional fields.
3. Client sends only approved create fields.
4. System normalizes and validates the command.
5. System derives and reserves a unique canonical public code from the title.
6. System creates exactly one `DRAFT` row with null `publishedAt` and one server operation time shared by
   `createdAt` and `updatedAt`.
7. System returns the committed Organizer representation.

### Main flow C — Edit content

1. Organizer opens one current record.
2. Organizer edits approved content fields.
3. Client sends the changed fields and unchanged raw `expectedUpdatedAt`.
4. System validates content and checks the concurrency token.
5. System updates only approved mutable content fields.
6. System preserves `publicCode`, status, and `publishedAt`.
7. System returns the committed row with a strictly later `updatedAt`.

### Main flow D — Publish a draft

1. Organizer opens one `DRAFT` record.
2. Organizer explicitly chooses publish.
3. Client sends the record identity and unchanged raw `expectedUpdatedAt`.
4. System revalidates required persisted content and the legal source state.
5. System changes the record to `PUBLISHED` in one guarded transaction.
6. System sets the first `publishedAt` and advances `updatedAt` using the same server operation time.
7. The record becomes accessible through public list and detail after commit.

### Main flow E — Archive published content

1. Organizer opens one `PUBLISHED` record.
2. Organizer explicitly confirms archive.
3. Client sends the record identity and unchanged raw `expectedUpdatedAt`.
4. System validates the legal source state and concurrency token.
5. System changes the record to `ARCHIVED` while preserving `publishedAt`.
6. The record disappears from public list and detail after commit.

### Main flow F — Republish archived content

1. Organizer opens one `ARCHIVED` record.
2. Organizer explicitly chooses republish.
3. Client sends the record identity and unchanged raw `expectedUpdatedAt`.
4. System revalidates required content, source state, and concurrency token.
5. System changes the record to `PUBLISHED` while preserving its code and original `publishedAt`.
6. The existing public URL becomes accessible again after commit.

### Main flow G — Delete an unpublished draft

1. Organizer opens one `DRAFT` record that has never been published.
2. Organizer explicitly confirms permanent deletion.
3. Client sends the internal identity and unchanged raw `expectedUpdatedAt`.
4. System verifies status, null `publishedAt`, and matching concurrency token.
5. System hard-deletes exactly that row.
6. System returns the contract-defined successful delete outcome.

### Alternate and exception flows

- No authenticated Session returns the existing authentication outcome.
- Session without effective verified Organizer authority returns forbidden without Heritage data.
- Unknown internal identity returns the Organizer not-found outcome.
- Invalid search, status, sort, or page input returns validation and does not substitute another query.
- Empty list result returns a successful empty page.
- Invalid or unknown create fields return validation and create no row.
- A title-derived code collision receives the next unique numeric suffix without asking the Organizer.
- Attempt to update `publicCode`, status, or server timestamps through content update is rejected.
- A content update containing no approved mutable field is rejected without advancing `updatedAt`.
- Missing, malformed, or stale `expectedUpdatedAt` changes nothing.
- Illegal or repeated lifecycle transition returns conflict and changes nothing.
- Publish with invalid persisted required content changes nothing.
- Hard delete of published or archived content is rejected.
- A concurrent winning mutation commits once. Every stale loser reloads instead of overwriting it.
- Network uncertainty causes the client to reload durable state rather than manufacture success.

### Postconditions

On successful create:

- exactly one valid `DRAFT` row exists
- its normalized public code is unique and immutable
- `publishedAt` is null
- `createdAt` and `updatedAt` use the same server operation time

On successful update or transition:

- exactly one existing row reflects the committed change
- all lifecycle and publication timestamp invariants hold
- `updatedAt` is a new concurrency token
- every other Organizer can observe the committed shared state

On successful delete, only an eligible never-published draft is removed.

On failure, no partial content, lifecycle, timestamp, or delete change is committed.

### Acceptance Criteria

**AC-O09-S9-01 Shared Organizer collection uses the real authenticated API**

```gherkin
Given two active verified Organizers have valid Sessions
And Heritage records exist in the shared collection
When either Organizer opens the management list
Then the backend authorizes the request using effective ORGANIZER authority
And both Organizers can receive the same shared records under the same query
And no owner or Event predicate is applied
```

**AC-O09-S9-02 Organizer query behavior is server-owned and deterministic**

```gherkin
Given an authorized Organizer supplies valid search status sort and page values
When the Heritage collection is queried
Then search checks publicCode title and locationText case-insensitively
And status uses one exact canonical value when supplied
And content and total count use the same predicate
And ordering includes the internal identity as a tie-breaker
And no match returns a successful empty page
```

**AC-O09-S9-03 Valid create produces exactly one draft**

```gherkin
Given an authorized Organizer supplies valid approved Heritage fields
When create commits
Then exactly one Heritage row is created
And publicCode is generated from the title in canonical uppercase form
And an existing title-derived code receives a unique numeric suffix
And status is DRAFT
And publishedAt is null
And createdAt and updatedAt contain the same server operation time
```

**AC-O09-S9-04 Invalid create or image upload produces no row**

```gherkin
Given a create command or image upload contains blank oversized malformed or unsupported data
When the command is validated or persisted
Then the stable validation or conflict outcome is returned
And no Heritage row is created
And no existing row is modified
```

**AC-O09-S9-05 Content update preserves identity and lifecycle**

```gherkin
Given an authorized Organizer loaded one Heritage record
When approved content fields are updated with its matching raw expectedUpdatedAt
Then publicCode status and publishedAt remain unchanged
And approved content fields are committed
And the returned updatedAt is strictly later
But an update with no approved mutable field is rejected without advancing updatedAt
But a stale expectedUpdatedAt returns conflict
And the newer durable row is preserved
```

**AC-O09-S9-06 Publishing a valid draft makes it public**

```gherkin
Given one structurally valid Heritage record is DRAFT
When an authorized Organizer publishes it with matching expectedUpdatedAt
Then status becomes PUBLISHED
And publishedAt and updatedAt use the same server operation time
And the record becomes available to public list and detail queries
```

**AC-O09-S9-07 Invalid publish and illegal transitions change nothing**

```gherkin
Given one Heritage lifecycle command has invalid persisted content
Or its source status does not allow the requested transition
Or expectedUpdatedAt is stale
When the command is processed
Then validation or conflict is returned as defined by contract
And status publishedAt updatedAt and content remain unchanged
```

**AC-O09-S9-08 Archive removes public visibility**

```gherkin
Given one Heritage record is PUBLISHED and publicly visible
When an authorized Organizer archives it with matching expectedUpdatedAt
Then status becomes ARCHIVED
And original publishedAt is preserved
And updatedAt advances
And public list and detail no longer expose the record
```

**AC-O09-S9-09 Republish preserves the stable public identity**

```gherkin
Given one Heritage record is ARCHIVED
And its required content remains valid
When an authorized Organizer republishes it with matching expectedUpdatedAt
Then status becomes PUBLISHED
And publicCode remains unchanged
And original publishedAt remains unchanged
And the same canonical public URL becomes accessible again
```

**AC-O09-S9-10 An eligible unpublished draft can be hard-deleted**

```gherkin
Given one Heritage record is DRAFT with null publishedAt
And the Organizer explicitly confirmed permanent deletion
When delete is sent with matching expectedUpdatedAt
Then exactly that Heritage row is removed
And no public or Feedback record is changed
```

**AC-O09-S9-11 Published history cannot be hard-deleted**

```gherkin
Given one Heritage record is PUBLISHED or ARCHIVED
When an Organizer attempts hard delete
Then the request is rejected
And the Heritage row remains durable
And the UI offers the legal lifecycle action instead of delete
```

**AC-O09-S9-12 Accepted changes are visible to every Organizer**

```gherkin
Given Organizer A commits a legal Heritage create update transition or delete
When Organizer B reloads the same shared collection
Then Organizer B observes the committed state
And no Organizer ownership filter hides the change
```

**AC-O09-S9-13 Only effective verified Organizer authority can mutate Heritage**

```gherkin
Given requests from anonymous Participant-only Partner-only Admin-only disabled and unverified accounts
When they call Organizer Heritage operations
Then authentication or forbidden is returned under the existing security contract
And no private Heritage data or mutation is allowed
But a valid multi-role account with effective verified ORGANIZER authority is accepted
```

**AC-O09-S9-14 Organizer UI reflects durable backend outcomes**

```gherkin
Given the Organizer Heritage route is opened
When list detail create update lifecycle or delete requests load succeed fail conflict or return empty data
Then the UI renders the corresponding real API state
And actions match the current canonical status
And recoverable input is preserved where safe
And stale state offers reload rather than automatic overwrite
And no mock fallback or fabricated success is shown
```

## 4. UC-G01 Heritage public discovery extension

### Goal

Let any visitor browse published Book Street Heritage content and open a stable public detail link without
exposing draft or archived management data.

### Primary actor

Guest. The same behavior also applies to authenticated users using public routes.

### Preconditions

- No authenticated Session is required.
- Public detail input uses a canonical public code.
- Only committed `PUBLISHED` content is eligible.

### Main flow A — Browse published Heritage content

1. Visitor opens the public Heritage list or a Landing Page section that presents Heritage content.
2. Client requests a public page from the real backend API.
3. System queries only `PUBLISHED` rows.
4. System applies deterministic published ordering and pagination.
5. Client renders the approved public fields.
6. Visitor may select one item to open its canonical detail URL.

### Main flow B — Open public detail directly

1. Visitor opens a canonical Heritage detail URL containing `publicCode`.
2. Client requests that public code directly without depending on list state.
3. System resolves only a matching `PUBLISHED` row.
4. Client renders the approved public detail fields and safely handles absent optional values.

### Alternate and exception flows

- No published rows returns a successful empty collection.
- Unknown, malformed, draft, or archived code returns the same public-safe not-found outcome.
- Missing image renders the approved fallback without a broken-image loop.
- Missing summary or location omits that optional presentation cleanly.
- Network or server failure renders a retryable error and no local mock collection.
- Direct detail reload requests the backend instead of waiting for prior navigation state.
- Archive occurring before a detail query completes results in not-found rather than stale private content.

### Postconditions

- Public reads do not mutate Heritage data or analytics.
- Only published content is returned.
- Public responses reveal no internal id or management-only concurrency metadata.
- No QR data is persisted or displayed.

### Acceptance Criteria

**AC-G01-S9-01 Anonymous users can list only published Heritage content**

```gherkin
Given DRAFT PUBLISHED and ARCHIVED Heritage rows exist
When an anonymous visitor loads the public Heritage list
Then only PUBLISHED rows are returned
And the response comes from the real backend API
And no authentication is required
```

**AC-G01-S9-02 Published detail resolves by canonical public code**

```gherkin
Given one Heritage record is PUBLISHED with a canonical publicCode
When an anonymous visitor requests that publicCode
Then the approved public detail is returned
And the route does not require the internal numeric identity
```

**AC-G01-S9-03 Private and invalid identifiers do not disclose records**

```gherkin
Given one code belongs to DRAFT content
And one code belongs to ARCHIVED content
And one code is unknown
And one code is malformed
When each code is requested through public detail
Then every request receives the same public-safe not-found behavior
And no private record fact or management field is exposed
```

**AC-G01-S9-04 Public ordering and paging are deterministic**

```gherkin
Given multiple PUBLISHED rows include equal publishedAt values
When a visitor requests consecutive valid public pages
Then rows are ordered by publishedAt descending
And internal identity supplies the deterministic descending tie-breaker
And a row is not duplicated or omitted because timestamps tie
```

**AC-G01-S9-05 Public UI renders real loading empty not-found and failure states**

```gherkin
Given the Landing Page or public Heritage route is opened
When the real API is loading empty unavailable or returns not-found for detail
Then the UI renders the matching state
And empty data does not remain in endless loading
And unavailable data does not fall back to a mock collection
```

**AC-G01-S9-06 Direct detail works without prior list state**

```gherkin
Given one published canonical detail URL is opened in a new browser context
When the page initializes without a preloaded Heritage collection
Then it requests detail directly by publicCode
And the valid published content renders successfully
```

**AC-G01-S9-07 Optional public fields degrade safely**

```gherkin
Given one PUBLISHED record has null imageUrl summary and locationText
When its list card and detail are rendered
Then required title and content remain usable
And optional sections are omitted or use the approved image fallback
And no broken markup unsafe HTML or client exception appears
```

**AC-G01-S9-08 Public Heritage omits QR and technical-code labels**

```gherkin
Given one published Heritage list or detail is displayed
When its public presentation is inspected
Then no QR block or technical publicCode label is rendered
And direct canonical links continue to work
And no QR token image status counter or scan record is stored
```

## 5. Persistence and regression acceptance

The following criteria support the two actor-facing paths and do not create separate top-level Use Cases.

**AC-S9-DB-01 Clean migration and Hibernate validation succeed**

```gherkin
Given an empty PostgreSQL database
When immutable migrations V1 through V14 and the reviewed Heritage migration are applied in order
Then the final schema contains the approved heritage_contents shape
And Hibernate ddl-auto validate succeeds
And no existing migration is modified
```

**AC-S9-DB-02 Upgrade from V14 preserves the installed system**

```gherkin
Given a database already at immutable V14 with valid existing data
When the reviewed Heritage migration is applied
Then the upgrade succeeds without rewriting existing tables or records
And the resulting Heritage schema matches the clean-install schema
And existing application startup validation succeeds
```

**AC-S9-DB-03 Database constraints preserve core Heritage invariants**

```gherkin
Given service validation is bypassed in a persistence test
When duplicate canonical public codes unsupported statuses invalid text lengths unsupported image prefixes
Or invalid image lengths inconsistent publication states or invalid timestamp ordering are written
Then PostgreSQL rejects the invalid row
And valid DRAFT PUBLISHED and ARCHIVED rows remain persistable
```

**AC-S9-REG-01 Completed feature regressions remain green**

```gherkin
Given the Sprint 09 Heritage slice is installed
When focused Event Booth Activity Payment Attendance Reward Rating and Feedback regression checks run
Then their approved behavior remains unchanged
And existing Session CSRF and authority rules remain intact
```

**AC-S9-REG-02 General Feedback remains separate from Heritage**

```gherkin
Given the completed General Feedback workflow supports BOOK_STREET and EVENT only
When Sprint 09 schema backend and frontend behavior are inspected
Then HERITAGE remains an unsupported Feedback target
And general_feedbacks has no Heritage foreign key
And Feedback forms filters lists and details contain no Heritage branch
```

**AC-S9-REG-03 Real API empty and failure states expose no fallback seed data**

```gherkin
Given the durable Heritage table is empty or the real API is unavailable
When public and Organizer Heritage screens load
Then they show the genuine empty or failure state
And no production or test mock collection is substituted
And no local presentation array becomes business truth
```

## 6. API Contract conformance checklist

The Sprint 09 API Contract must map every behavior above without weakening it. It must freeze:

- anonymous public list and direct detail routes
- Organizer list, detail, create, update, publish, archive, republish, and eligible draft delete routes
- effective verified Organizer authority and existing Session plus CSRF behavior
- exact create and update field allowlists
- the immutable canonical `publicCode` representation
- management and public response field separation
- exact normalization, limits, image URL rules, and unknown-field rejection
- status transition commands rather than a generic status setter
- raw `expectedUpdatedAt` request representation and stale conflict behavior
- strictly advancing returned `updatedAt` behavior
- search scope, status filter, sort allowlist, page bounds, defaults, and response metadata
- public published ordering and deterministic tie-breaker
- stable authentication, forbidden, validation, not-found, duplicate, stale, transition, and server outcomes
- one consistent error envelope and field-error representation
- public-safe non-disclosure for private, unknown, and malformed public codes
- successful delete response behavior
- bounded local image upload and the absence of Feedback, Admin management, QR presentation/persistence,
  analytics, and mock endpoints

The API Contract must not introduce a caller-selected owner, role, status on create, arbitrary lifecycle
update, internal timestamp, Heritage Feedback target, or new authentication mechanism.

## 7. Required UI behavior

### 7.1 Organizer

- Load the shared Heritage collection from the real API on route entry.
- Distinguish initial loading, empty collection, filtered empty, forbidden, failure, and populated states.
- Keep search, status, sorting, and pagination server-owned.
- Show only fields approved by the Sprint 09 model.
- Use canonical status labels for `DRAFT`, `PUBLISHED`, and `ARCHIVED`.
- Do not use `hidden` as a fourth status.
- Present publish only for drafts, archive only for published records, and republish only for archived records.
- Present permanent delete only for never-published drafts and require confirmation.
- Require archive confirmation because it removes immediate public visibility.
- Preserve safe user input after validation and recoverable request failure.
- On conflict, explain the stale edit and offer reload without automatically resubmitting it.
- Reconcile the displayed row from the durable response after every successful mutation.
- Never show success when the API rejected or did not confirm a mutation.

### 7.2 Guest and public routes

- Load only real published content from the backend.
- Preserve the existing direct `/di-san/:publicCode` frontend route.
- Use `publicCode` consistently for links without displaying it as a label.
- Distinguish loading, empty list, not-found detail, and retryable failure.
- Do not expose draft or archived records from stale client data.
- Safely omit optional summary and location.
- Render an approved fallback or omit the image when `imageUrl` is absent or fails to load.
- Render stored content as text rather than executable markup.
- Do not substitute mock data when the API is empty or unavailable.

## 8. Acceptance Criteria audit

- `UC-O09` Organizer Heritage management extension has 14 Acceptance Criteria.
- `UC-G01` Heritage public discovery extension has 8 Acceptance Criteria.
- Persistence and regression support has 6 Acceptance Criteria.

Total: **28 Sprint 09 Acceptance Criteria**.

Review gate before writing the API Contract:

- verify all 28 IDs are unique and match `docs/sprints/sprint-09.md`
- confirm every alternate flow maps to an Acceptance Criterion or a shared invariant
- confirm the Physical ERD overlay can represent every lifecycle and timestamp state
- confirm optimistic concurrency applies to every shared Organizer mutation
- confirm public detail is independent of prior list state
- confirm public responses expose only published content
- confirm Heritage has no Feedback relationship or target
- confirm no new durable field is inferred from current frontend placeholders
- confirm exact transport details remain deferred to the API Contract

## 9. Explicit exclusions

This specification does not authorize:

- Heritage Feedback
- Admin Heritage management
- per-Organizer ownership
- review or approval queues
- a new role or status
- bilingual persistence
- map coordinates or marker editing
- rich text or executable HTML
- external image storage-provider integration or a general asset library
- QR presentation, persisted QR data or scan analytics
- view counters or reporting
- notifications, subscriptions, comments, or likes
- scheduled publication, version history, rollback, or expiration
- bulk import, export, or deletion
- production seed rows
- modification of Flyway V1 through V14
- implementation before the complete Sprint 09 document set is reviewed
