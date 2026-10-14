# Booth Frontend Data-Flow Audit

Date: `2026-10-14`

Branch inspected: `fix/event-scoped-booth-workflow`

> The findings below describe the baseline before implementation. See section 7 for the current
> status of the first coding slice.

## 1. Purpose

This document records the current Booth-related frontend data flow before changing behavior or
reorganizing screens. It separates three concepts that must not be merged in the UI:

1. the shared physical Booth catalog;
2. Event-specific Booth configuration, price and derived availability;
3. Partner Booth requests, Holds, Payments and Assignments.

This audit makes no schema decision and does not authorize a Flyway change. The inspected backend
already models the three concepts separately. The immediate defects are primarily frontend state,
mapping and screen-responsibility defects.

## 2. Canonical data ownership

| Data | Canonical source | Scope | Frontend rule |
|---|---|---|---|
| Booth code, name, category, description, capacity, map coordinates and physical active flag | `GET /api/v1/organizer/booths` | Shared physical resource | Never label the physical record as rented or available. Show only physical active/inactive state. |
| Event Booth enablement and rental price | `GET/PUT /api/v1/organizer/events/{eventId}/booth-configs` | One Event | Never reuse the value from another Event. A missing configuration is not an enabled Booth. |
| Public Event Booth availability | `GET /api/v1/events/{eventId}/booths` | One target Event plus overlapping Event-time blockers | Render the backend `availability` value. Do not recreate it from request history in the browser. |
| Organizer Booth requests | `GET /api/v1/organizer/events/{eventId}/booth-requests` | One owned Event | The path `eventId` is mandatory and must match the Event displayed by the screen. |
| Partner Booth requests | `GET /api/v1/partner/booth-requests?eventId={eventId}` | Current Partner and optional Event | The Booth workspace must always supply the selected Event. |
| Payment history | `GET /api/v1/partner/booth-requests/{requestId}/payments` | One owned Booth request | Payment state must not be inferred from Return URL parameters or map state. |
| Assignment detail | `GET /api/v1/partner/booth-requests/{requestId}/assignment` | One owned Booth request | Sufficient for the existing payment-detail page, but not for a Partner-wide `Gian hàng của tôi` list. |

Backend behavior already matches the approved contract for Event Booth discovery:

- an active physical Booth without an `EventBoothConfig` is returned as `enabled=false`,
  `rentalPrice=null`, `availability=UNAVAILABLE`;
- a disabled configuration or inactive physical Booth is `UNAVAILABLE`;
- active Holds and Assignments are calculated against overlapping Event time ranges;
- therefore a Booth assigned in Event A may remain available in a non-overlapping Event B.

The frontend must preserve those meanings instead of replacing them with local defaults.

## 3. Current screen-to-data map

| Screen / responsibility | Current component path | Current API flow | `eventId` source | Status / price source | Audit result |
|---|---|---|---|---|---|
| Organizer physical Booth catalog | `ManagementPortal -> OrganizerBoothManagementView` | `boothApi.listAllPhysicalBooths()` | None, correctly global | `PhysicalBooth.active`; no Event price | Responsibility is mostly correct. Physical map editing still lives in the mixed Sprint 2 workspace and must move here. |
| Organizer Event detail, Booth tab | `ManagementPortal -> EventDetailView` | `organizerApi.getBooths(targetEventId)` -> configured Event Booth rows | `selectedEventId || firstEventId` in the portal | Backend Event configuration and availability mapped into `OrganizerBoothItem` | Correct conceptual destination for Event configuration, but currently read-only and only shows configured rows. Loading is vulnerable to an older request overwriting a newer Event selection. |
| Organizer Booth request workspace | `ManagementPortal -> Sprint2BoothWorkspace` | Physical Booths + Event configurations + Organizer requests | Prop declares `onSelectEventId`, but the component does not consume it. `all` silently becomes the first Event. | Mixes backend values with synthesized frontend defaults | Incorrectly combines physical catalog, editable map, Event configuration/price and request review. Must become request-only after responsibilities move. |
| Partner Event Booth browse and own requests | `App -> Sprint2PartnerBoothsPage` | Public Event Booth list + owned request list filtered by Event | Local `selectedEventId`, but there is no rendered selector. It therefore falls back to the first approved application. | Backend availability and Event price | Backend calls are correctly scoped when `eventId` is known, but the user cannot choose another eligible Event. Old Event data is not cleared before a new load and requests have no stale-response guard. |
| Public Booth list and map | `App -> publicApi.getBooths -> BoothsSection / InteractiveMap` | Public Event Booth list | `publicEventId` derived from the public Event picker | Backend availability and Event price | Already Event-scoped. The effect cleanup prevents a completed request for the old Event from writing after selection changes. Existing E2E covers switching two public Events. |
| Partner payment / Assignment detail | `BoothPaymentPage` and `VnPayReturnPage` | Request detail, payment history/detail and Assignment-by-request | Route `requestId`; Event is obtained through owned request data | Backend Payment and Assignment state | Correct for a single request. It is not a Partner-wide Assignment management surface. |
| Future Partner `Gian hàng của tôi` | Not present | No list endpoint exists | Must support optional Event filter without relying on only currently Published Events | Must come from owned Assignments and Event data | Requires a backend read API and frontend screen. It should not be implemented by loading every request and issuing one Assignment request per row. |

## 4. Confirmed defects and risks

### P0 — Incorrect unconfigured availability in the Organizer workspace

`Sprint2BoothWorkspace` merges the configured rows with the physical catalog. When a physical Booth
has no configuration for the selected Event, it creates a local row with:

```text
enabled=false
availability=AVAILABLE
```

This contradicts both the API contract and the backend response model. The local value must be
`UNAVAILABLE`. Counts, marker colors and configuration labels derived from this row are currently
untrustworthy.

### P0 — Event state can mutate the global physical Booth state

The editable map popover currently maps `data.status === UNAVAILABLE` to
`PhysicalBooth.active=false`, then optionally updates the Event configuration. This couples two
different responsibilities:

- physical inactive means the Booth is unavailable globally;
- Event `UNAVAILABLE` means the Booth is missing/disabled only for one Event.

Using the Event control can therefore affect other Events. Event enablement must never be translated
into a physical active/inactive update.

### P0 — Silent Event price invention

The same map popover creates/updates an Event configuration with a fallback rental price of
`2,000,000` when no configuration exists. The UI must require an explicit Event price instead of
inventing a business value.

### P0 — Partner Event picker is state-only and not usable

`Sprint2PartnerBoothsPage` owns `selectedEventId`, but does not render a selector or another action
that calls `setSelectedEventId`. The effective Event is always the first approved application. This
prevents correct multi-Event operation even though both underlying APIs already accept an Event
filter.

### P1 — Organizer Event picker contract is incomplete

`Sprint2BoothWorkspace` declares `onSelectEventId` but does not destructure or render it. Its `all`
fallback silently selects `events[0]`. The screen also does not visibly show the active Event name
and dates, making it difficult to verify which Event a price or review action affects.

### P1 — Event-scoped loads lack stale-response protection

The Partner workspace and Organizer workspace update React state after asynchronous loads without
an `AbortController`, request generation key or active-effect guard. A slower response for Event A
can finish after Event B was selected and overwrite Event B data. Clearing rows only in an error
handler is insufficient.

Required behavior when the Event changes:

1. close Event-specific modals/popovers;
2. clear the previous Event's Booth/configuration/request rows immediately;
3. start requests for the new Event;
4. accept results only if they still belong to the current Event/request generation.

### P1 — One component owns four incompatible responsibilities

`Sprint2BoothWorkspace` currently owns:

- physical Booth creation/deactivation;
- physical map-coordinate editing;
- Event Booth enablement and rental price;
- Organizer request approval/rejection.

This is the direct cause of global and Event-specific state being written together. The component
must be decomposed by responsibility, not merely restyled.

### P1 — No Partner Assignment list contract

The backend supports Assignment detail only by Booth request. A `Gian hàng của tôi` screen needs an
owned, paginated Assignment list, preferably filterable by `eventId` and status. Its list response
should contain enough presentation data to avoid an N+1 client workflow, including at least:

- Assignment identity and status;
- Event ID, name, start and end time;
- Booth ID, code, name and map coordinates;
- locked rental price, assignment time and QR token;
- cover image when present.

This is a read-model/API addition. The existing schema already contains the underlying relations,
so no Flyway change is expected.

### P1 — Frontend lifecycle types lag behind the backend

The frontend `BoothRequestStatus` omits `CANCELLED`, while the backend enum includes it. The frontend
`BoothAssignmentStatus` includes only `ACTIVE` and `RELEASED`, while the backend also contains
`CANCELLED` and `ENDED`. These unions must be aligned before building historical Assignment views.

### P2 — Labels imply unsupported business behavior

The Partner page currently says `đăng ký / đổi gian hàng` and uses a submit label containing
`thuê / đổi gian`. Post-Assignment Booth change is outside the active MVP. Copy should describe
submitting a Booth request and must not promise a change/refund flow.

The Organizer configuration tab also labels `ON_HOLD` as `Chờ duyệt`; the agreed label is
`Đang giữ chỗ`. Status labels should be centralized so every screen uses the same vocabulary.

### P2 — Existing E2E does not cover multi-Event Organizer/Partner behavior

Current Sprint 2 UI E2E covers one Organizer Event and one approved Partner Event. Only the public
visitor test switches between two Events. Missing coverage includes:

- Organizer switching two Events with different prices and configurations;
- Partner switching two approved Events;
- delayed Event A response arriving after Event B;
- an unconfigured Booth remaining `UNAVAILABLE`;
- the same physical Booth being assigned in Event A and available in non-overlapping Event B;
- two Partners seeing the same shared availability while only the owner sees `Gian hàng của bạn`.

## 5. Target screen responsibilities

### 5.1 Organizer — `Gian hàng`

Owns only shared physical data:

- code, name, category, capacity, description and technical note;
- physical active/inactive state;
- physical map coordinates and map preview/editor.

It must not show Event rental price or `AVAILABLE/ON_HOLD/ASSIGNED`.

### 5.2 Organizer — Event detail / `Cấu hình gian hàng & giá`

Owns only the selected Event's configuration:

- Event identity and date range displayed prominently;
- every active physical Booth shown as configured or unconfigured;
- explicit rental price and enabled flag;
- backend-derived Event availability;
- Event-specific counts derived from the loaded Event rows.

An unconfigured Booth is `Không mở bán`, not `Còn trống`.

### 5.3 Organizer — `Yêu cầu gian hàng`

Owns only submitted Partner requests for one visible Event:

- explicit Event selector with name and date range;
- request list/detail and read-only Booth position;
- select/reject actions allowed by backend state;
- no physical Booth CRUD, coordinate editing or Event price editing.

### 5.4 Partner — `Yêu cầu gian hàng`

Owns pre-Assignment browsing and request history:

- explicit approved-Event selector with name and date range;
- Event-scoped Booth list/map and Event-scoped own requests;
- availability labels sourced from the backend;
- payment/detail link for a selected/completed request;
- link to Assignment detail after completion.

### 5.5 Partner — `Gian hàng của tôi`

Owns Assignments already granted to the current Partner:

- upcoming, ongoing and ended grouping from backend Event time/status;
- Event, Booth, map location, locked price, Assignment status and QR;
- operational links only;
- no Booth change, price edit, physical position edit or refund action.

For a Partner map, `Gian hàng của bạn` should be a client overlay created by matching owned
Assignments on `eventId + boothId`. The public Event Booth response must not expose another
Partner's identity.

## 6. Agreed implementation sequence after this audit

1. Introduce a clear Event-selection/data-loading boundary for Organizer and Partner Booth
   workspaces, including stale-response protection and immediate state reset.
2. Remove synthesized `AVAILABLE` and silent price defaults; preserve backend availability.
3. Separate physical Booth catalog/map from the Organizer request workspace.
4. Move Event Booth configuration and price controls into Event detail.
5. Reduce Organizer `Yêu cầu gian hàng` to request review only.
6. Add the owned Assignment list API with tests; no migration unless implementation inspection
   proves a missing persisted field.
7. Build `Gian hàng của tôi` and then add the owner-aware Partner map overlay.
8. Add multi-Event, stale-response, ownership and regression E2E coverage; run frontend lint/build,
   backend tests and Playwright.

The next coding slice is steps 1 and 2 only. It should establish correct Event context and data
semantics before any large visual component move.

## 7. First coding slice status

Implemented on `2026-10-14`:

- Organizer and Partner Booth workspaces now expose the active Event selector and date range;
- Event changes clear Event-specific state and ignore responses from older request generations;
- unconfigured physical Booths are represented as `UNAVAILABLE` / `Không mở bán`;
- the physical-map popover no longer changes Event availability, physical active state, Partner
  ownership or creates an Event configuration with a fabricated price;
- terminology now distinguishes `Đang giữ chỗ`, `Đã thuê` and `Không mở bán`;
- Partner copy no longer promises an unsupported post-Assignment Booth-change flow;
- Sprint 2 UI E2E now covers the selector, an unconfigured Booth and a delayed old-Event response.

The Partner Assignment-list work in steps 6–7 remains intentionally out of scope for this slice.

## 8. Organizer responsibility split status

Implemented after the first coding slice:

- `Gian hàng` now owns the shared physical catalog, physical active state and editable physical map;
- the physical map uses only physical statuses and never exposes Event price, Hold or Assignment
  controls;
- Event detail now owns an explicit `Cấu hình gian hàng & giá sự kiện` panel containing all active
  physical Booths, including unconfigured Booths as `Không mở bán`;
- `Yêu cầu gian hàng` now loads only Event-scoped requests and exposes only select/reject review
  actions;
- the former mixed workspace no longer loads physical Booths or Event price configuration.

This completes sequence steps 3–5. The next product slice is the owned Assignment list contract and
the Partner `Gian hàng của tôi` experience.

