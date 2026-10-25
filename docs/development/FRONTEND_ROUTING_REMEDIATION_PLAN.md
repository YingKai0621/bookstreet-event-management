# Frontend Routing Remediation Plan

> Status: Implemented — automated verification passed; final manual browser QA remains
> Audit date: 2026-10-24
> Implementation verified: 2026-10-24
> Scope: Public, Participant, Partner, Organizer and Admin frontend navigation
> Backend/API/database impact: None expected

## 1. Purpose

This document is the source of truth for fixing frontend navigation state that is currently kept only
in React component state or written directly to browser history. The remediation must be handled as
one routing architecture initiative instead of isolated fixes on individual screens.

The implementation must guarantee that the URL, rendered screen, selected entity and meaningful
business sub-view agree after:

- direct navigation;
- refresh;
- Back/Forward;
- opening a link in a new tab;
- authentication redirect;
- navigation from sidebars, top bars, notifications and dashboard shortcuts.

## 2. Severity and confirmed root causes

Severity: **High**. Organizer and Admin navigation are affected at shell level. Participant, Partner
and Public areas are partially affected at nested-view level.

Confirmed root causes:

1. Organizer uses one `/portal` route and `ManagementPortal.activeTab` as the main navigation source.
2. Admin uses one `/admin` route and `AdminPortal.activeTab`, persisted in `localStorage`.
3. Organizer and Partner Activity workspaces call `window.history.replaceState` directly instead of
   using React Router navigation.
4. Several meaningful tabs read URL state only once when mounting and do not react to browser
   history changes.
5. Some selected entity IDs and business views exist only in component state.
6. Public Event and Booth detail dialogs do not derive their selected item from the URL.
7. Route recognition is inconsistent: Organizer accepts only the exact `/portal` or `/organizer`
   path, while Admin accepts every path beginning with `/admin` without actually resolving it.

The screenshot case is caused by the Organizer Activity workspace leaving
`activityView=activities&eventId=...` in the URL after `ManagementPortal` switches to another
`activeTab` without changing or cleaning the route.

## 3. Routing policy

### 3.1 URL ownership

- React Router is the only owner of page navigation and browser history.
- Page-level `activeTab` state must be derived from the current route, not maintained independently.
- Do not call `window.history.pushState` or `window.history.replaceState` from feature components.
- Use path parameters for resource identity: `eventId`, `activityId`, `boothId`, `requestId`.
- Use query parameters for list/view state: `view`, `section`, `status`, `search`, `sort`, `page`.

### 3.2 History behavior

- Selecting a different primary screen or meaningful business tab must push a history entry.
- Normalizing an invalid/default URL may use replace navigation.
- Closing a deep-linked detail should return to its parent route without leaving stale parameters.
- Back/Forward must restore the screen, selected entity and meaningful tab from the URL.

### 3.3 What should remain local state

The following transient states should not be route-driven unless a later requirement explicitly says
otherwise:

- unsaved form values;
- confirmation dialogs;
- toast messages;
- temporary loading/submitting flags;
- purely presentational dropdown-open state;
- create/edit modals that are not intended to be shared or restored.

### 3.4 Query validation

- Validate every enum-like query value against an allow-list.
- Validate numeric identifiers before making API requests.
- Invalid values fall back to a documented default and are removed/replaced in the URL.
- Parameters belonging to a previous screen must not leak into another screen.
- Preserve only parameters supported by the destination route.

## 4. Impact audit by user group

### 4.1 Organizer — critical

Primary navigation currently affected:

- Dashboard (`overview`)
- Events (`events`)
- Booth Requests (`booth_requests`)
- Booths (`booths`)
- Venues (`venues`)
- Assets (`assets`)
- Activities (`activities`)
- Participants (`participants`)
- Reports (`reports`)
- Feedback (`feedback`)
- Public Content (`public_content`)
- Notifications (`notifications`)
- Profile (`profile`)

Nested state currently affected:

- selected Event in Event details;
- Event detail sections: Overview, Partner Applications, Booths and Settings;
- selected Event shared by Booth Requests, Booths, Activities, Participants and Reports;
- Activity workspace views: Activities, Proposals, Change Requests and Cancellation Requests;
- Activity workspace filters and pagination where restoration is expected.

Confirmed consequences:

- all primary screens share `/portal`;
- refresh does not reliably restore the current screen;
- Back/Forward does not follow sidebar navigation;
- Activity query parameters remain visible after leaving Activities;
- `/portal/...` and `/organizer/...` nested URLs do not currently enter the Organizer shell because
  the app checks only exact paths;
- event-specific screens cannot be shared reliably.

### 4.2 Admin — critical

Primary navigation currently affected:

- Dashboard
- Booth Catalog
- Venues
- Assets
- User Management
- Roles and Permissions
- Badge Rules
- System Settings
- Audit Logs
- Notifications
- Profile

Confirmed consequences:

- all screens share `/admin`;
- `localStorage.admin_active_tab` can make the same URL render different screens on different
  browsers;
- Back/Forward does not follow sidebar navigation;
- arbitrary `/admin/...` paths enter the Admin shell but do not resolve a corresponding screen;
- links to a specific Admin function cannot be shared.

### 4.3 Partner — partial/high

Primary Partner pages already use React Router and should be preserved:

- `/partner`
- `/partner/events`
- `/partner/events/apply`
- `/partner/booths`
- `/partner/booths/:requestId`
- `/partner/booth-requests`
- `/partner/activities`
- `/partner/activities/:activityId`
- `/partner/reports`
- `/partner/notifications`
- `/partner/profile`

Nested problems:

- Activity workspace uses direct `replaceState` for `activityView`, `eventId` and `search`.
- Activity URL parameters are read as mount-time initial state rather than reactive route state.
- Back/Forward cannot reliably switch Activity workspace views.
- Booth Requests has two meaningful views, Booth Map and My Requests, stored only in `tab` state.
- changing the selected Event does not consistently update the route.
- notification/report/list filters are local-only; these are lower priority unless restoration or
  sharing is required.

### 4.4 Participant — partial/high

Primary Participant pages already use React Router and should be preserved:

- `/participant`
- `/participant/events`
- `/participant/events/:eventId`
- `/participant/activities/detail/:activityId`
- `/participant/activities/qr/:activityId`
- `/participant/rewards`
- `/participant/certificates`
- `/participant/feedback`
- `/participant/profile`

Nested problems:

- `/participant/events` tabs Upcoming, Attended and Cancelled are local state only.
- `/participant/events/:eventId` sections Overview, Activities, Booths, Map and Information are local
  state only.
- Participant global search navigates to `?search=...`, but the current events/activities page does
  not consume that query.
- refresh and Back/Forward reset meaningful tabs.

### 4.5 Public/guest — partial

Current route-backed areas:

- `/di-san`
- `/di-san/:id` (detail is already derived from the path)
- `/gian-hang`
- `/su-kien`

Problems:

- Event detail opens from local modal state and does not resolve `/su-kien/:eventId`.
- Booth detail opens from local modal state and does not resolve `/gian-hang/:boothId`.
- unauthenticated Event registration may redirect through `/su-kien/:eventId`, but returning to that
  path does not reopen the matching Event detail.
- refresh closes locally selected Event/Booth detail.

## 5. Proposed route contract

This contract must be approved before implementation.

### 5.1 Organizer canonical routes

Use `/organizer` as the canonical namespace to match `/participant`, `/partner` and `/admin`.
Retain `/portal` as a backwards-compatible redirect.

| Screen | Proposed URL |
|---|---|
| Dashboard | `/organizer` |
| Event list | `/organizer/events` |
| Event detail | `/organizer/events/:eventId` |
| Event detail section | `/organizer/events/:eventId?section=overview` |
| Booth Requests | `/organizer/booth-requests?eventId=:eventId` |
| Booths | `/organizer/booths?eventId=:eventId` |
| Venues | `/organizer/venues` |
| Assets | `/organizer/assets` |
| Activities | `/organizer/activities?eventId=:eventId&view=activities` |
| Activity Proposals | `/organizer/activities?eventId=:eventId&view=proposals` |
| Change Requests | `/organizer/activities?eventId=:eventId&view=changes` |
| Cancellation Requests | `/organizer/activities?eventId=:eventId&view=cancellations` |
| Participants | `/organizer/participants?eventId=:eventId` |
| Reports | `/organizer/reports?eventId=:eventId` |
| Feedback | `/organizer/feedback` |
| Public Content | `/organizer/public-content` |
| Notifications | `/organizer/notifications` |
| Profile | `/organizer/profile` |

Compatibility:

- `/portal` redirects to `/organizer`.
- `/organizer/overview` redirects to `/organizer`.
- old `/portal?activityView=...&eventId=...` links redirect to the corresponding canonical Activity
  URL where values are valid.

### 5.2 Admin routes

| Screen | Proposed URL |
|---|---|
| Dashboard | `/admin` |
| Booth Catalog | `/admin/booths` |
| Venues | `/admin/venues` |
| Assets | `/admin/assets` |
| Users | `/admin/users` |
| Roles and Permissions | `/admin/roles` |
| Badge Rules | `/admin/badges` |
| System Settings | `/admin/settings` |
| Audit Logs | `/admin/audit` |
| Notifications | `/admin/notifications` |
| Profile | `/admin/profile` |

`admin_active_tab` must no longer determine which screen a URL renders. It may be removed. If the
team wants “resume last screen”, store the last URL and use it only when explicitly entering
`/admin`, never when a concrete child URL is supplied.

### 5.3 Partner route additions

| State | Proposed URL |
|---|---|
| Booth Map | `/partner/booth-requests?eventId=:eventId&view=map` |
| My Booth Requests | `/partner/booth-requests?eventId=:eventId&view=requests` |
| Activity workspace | `/partner/activities?eventId=:eventId&view=:view` |
| Activity detail | `/partner/activities/:activityId` |

Use `view`, not `activityView`, as the canonical query name. Support and normalize the old
`activityView` query during migration.

### 5.4 Participant route additions

| State | Proposed URL |
|---|---|
| Upcoming registrations | `/participant/events?status=upcoming` |
| Attended registrations | `/participant/events?status=attended` |
| Cancelled registrations | `/participant/events?status=cancelled` |
| Event Overview | `/participant/events/:eventId?section=overview` |
| Event Activities | `/participant/events/:eventId?section=activities` |
| Event Booths | `/participant/events/:eventId?section=booths` |
| Event Map | `/participant/events/:eventId?section=map` |
| Event Information | `/participant/events/:eventId?section=info` |

The existing `search` query must be consumed or removed from the global-search navigation. The
recommended outcome is to consume it and keep the search state in the URL.

### 5.5 Public route additions

| Screen | Proposed URL |
|---|---|
| Event catalog | `/su-kien` |
| Event detail | `/su-kien/:eventId` |
| Booth catalog | `/gian-hang` |
| Booth detail | `/gian-hang/:boothId?eventId=:eventId` |
| Heritage catalog/detail | Keep existing `/di-san` and `/di-san/:id` |

The public Booth detail keeps `eventId` in the query because the current backend exposes Booths in
Event scope and does not provide a standalone public Booth-by-ID endpoint. The path still owns the
selected Booth identity; the query supplies the API loading context.

## 6. Implementation checklist

### Phase 0 — approval and baseline

- [x] Approve this route contract or record requested changes.
- [x] Confirm `/organizer` as canonical and `/portal` as legacy redirect.
- [x] Confirm `view` and `section` query naming.
- [x] Assign one owner for shared `App.tsx` routing changes.
- [x] Capture the existing E2E baseline before code changes.

### Phase 1 — router foundation

- [x] Change protected-area recognition to support nested Organizer routes.
- [x] Define centralized route constants/helpers rather than scattering string literals.
- [x] Add protected route fallbacks for Organizer, Admin, Partner and Participant.
- [x] Add a consistent invalid-ID and invalid-query normalization strategy.
- [x] Add legacy redirects before removing any old navigation behavior.
- [x] Define when navigation pushes versus replaces browser history.

### Phase 2 — Organizer migration

- [x] Replace `ManagementPortal.activeTab` as the main navigation source.
- [x] Make Organizer Sidebar items route links/navigation targets.
- [x] Route TopBar Notifications and Profile actions.
- [x] Route Dashboard shortcuts.
- [x] Route Event list and Event detail using `eventId`.
- [x] Derive Event detail section from `section`.
- [x] Derive selected Event from URL for Booth Requests, Booths, Activities, Participants and Reports.
- [x] Replace Activity workspace direct history writes with React Router search parameters.
- [x] Remove stale Activity query parameters when navigating away.
- [x] Preserve valid Event selection across related Organizer screens only when explicitly encoded.
- [x] Redirect legacy `/portal` links safely.

### Phase 3 — Admin migration

- [x] Replace `AdminPortal.activeTab` as the main navigation source.
- [x] Stop using `admin_active_tab` as the rendered-screen source.
- [x] Route all Sidebar and TopBar destinations.
- [x] Route Dashboard shortcuts.
- [x] Resolve invalid `/admin/*` paths to a documented safe fallback.

### Phase 4 — Partner corrections

- [x] Replace Activity workspace `window.history.replaceState`.
- [x] React to URL changes after initial mount.
- [x] Make Activity workspace view changes participate in browser history.
- [x] Synchronize selected Event with `eventId`.
- [x] Normalize legacy `activityView` to `view`.
- [x] Route Booth Map and My Requests tabs.
- [x] Preserve direct Activity detail routes.
- [x] Confirm Partner top-bar search remains functional after query normalization.

### Phase 5 — Participant corrections

- [x] Route registration status tabs.
- [x] Route Event detail sections.
- [x] Consume and display the `search` query from Participant global search.
- [x] Preserve Activity detail and QR routes.
- [x] Ensure leaving/rejoining/cancelling does not silently reset the current URL state.

### Phase 6 — Public corrections

- [x] Derive Event detail from `/su-kien/:eventId`.
- [x] Derive Booth detail from `/gian-hang/:boothId`.
- [x] Close details by navigating to the parent catalog route.
- [x] Restore the correct Event after login redirect.
- [x] Handle missing/deleted resource IDs without opening an unrelated item.

### Phase 7 — cleanup

- [x] Remove obsolete page-level `activeTab` state from the active shells.
- [x] Remove direct browser-history calls from affected feature components.
- [x] Retain and normalize required legacy route aliases during the compatibility period.
- [x] Search the source again for page-level navigation stored only in state.
- [x] Document the final route contract in the frontend handoff/readme.

## 7. Required regression tests

### 7.1 Shared navigation contract

- [x] Direct URL opens the expected screen.
- [x] Refresh preserves the expected screen.
- [x] Back restores the previous meaningful screen/view.
- [ ] Forward restores the next meaningful screen/view.
- [ ] Opening a link in a new tab works.
- [x] Sidebar active state matches the URL.
- [ ] TopBar links match the URL.
- [ ] Unknown protected routes do not render a random/default feature silently.
- [ ] Invalid query enums are normalized safely.
- [x] Invalid/deleted public Event and Booth IDs show an appropriate error without opening an unrelated record.
- [ ] Authentication redirects return to the complete path and query.
- [ ] Logging out does not leak the previous protected route state to another role.

### 7.2 Organizer

- [ ] Test all canonical primary routes.
- [ ] Test Event list → detail → Back.
- [x] Test Event detail sections and refresh.
- [ ] Test selected Event on all Event-scoped screens.
- [x] Test all four Activity workspace views.
- [x] Test Activities → Booth Requests removes Activity-only query parameters.
- [ ] Test polling/focus refresh does not change route state.
- [x] Test legacy `/portal` redirect behavior.

### 7.3 Admin

- [ ] Test all eleven Admin routes.
- [x] Test that localStorage cannot override a concrete route.
- [ ] Test Dashboard shortcuts and notification/profile navigation.

### 7.4 Partner

- [ ] Test Activity views with direct URL, refresh and Back/Forward.
- [ ] Test Event selection and search query.
- [ ] Test Booth Map/My Requests views.
- [ ] Test Booth and Activity detail deep links.
- [ ] Test old `activityView` links normalize correctly.

### 7.5 Participant

- [ ] Test registration status tabs with refresh and Back/Forward. (Direct URL and refresh are covered;
  Back/Forward remains for manual QA.)
- [ ] Test all Event detail sections.
- [ ] Test global search query is actually applied. (Query preservation is covered.)
- [ ] Test Activity detail and QR deep links.

### 7.6 Public

- [x] Test Event catalog/detail direct links.
- [x] Test Booth catalog/detail direct links.
- [ ] Test Heritage routes remain unchanged.
- [ ] Test unauthenticated registration login round-trip.

## 8. Acceptance criteria

The remediation is complete only when all of the following are true:

1. Every primary Sidebar destination has one deterministic canonical URL.
2. A canonical URL always renders the same screen for an authorized user.
3. Refresh preserves the meaningful current screen, selected resource and business sub-view.
4. Back/Forward follows meaningful navigation transitions.
5. No feature component directly modifies browser history.
6. No stale query parameters remain after switching to an unrelated screen.
7. Legacy links covered by this plan redirect without losing valid context.
8. Role guards work for direct nested routes.
9. Existing business actions and API calls remain unchanged.
10. Build, lint and the complete affected E2E suite pass.

## 9. Non-goals

- No backend endpoint changes.
- No database or Flyway changes.
- No business-rule changes.
- No visual redesign of the affected pages.
- No attempt to put every temporary modal or unsaved form field into the URL.
- No removal of legacy links until redirect compatibility is verified.

## 10. Source evidence reviewed

- `frontend/src/App.tsx`
- `frontend/src/components/organizer/ManagementPortal.tsx`
- `frontend/src/components/organizer/OrganizerSidebar.tsx`
- `frontend/src/components/organizer/OrganizerActivityWorkspace.tsx`
- `frontend/src/components/organizer/EventDetailView.tsx`
- `frontend/src/components/admin/AdminPortal.tsx`
- `frontend/src/components/admin/AdminSidebar.tsx`
- `frontend/src/pages/partner/PartnerLayout.tsx`
- `frontend/src/pages/partner/PartnerActivityWorkspacePage.tsx`
- `frontend/src/pages/partner/Sprint2PartnerBoothsPage.tsx`
- `frontend/src/pages/participant/ParticipantLayout.tsx`
- `frontend/src/pages/participant/MyActivitiesPage.tsx`
- `frontend/src/pages/participant/EventDetailPage.tsx`
- `frontend/src/pages/public/EventsExperience.tsx`
- `frontend/src/pages/public/BoothsExperience.tsx`
- `frontend/src/pages/public/HeritageExperience.tsx`

## 11. Verification record

Implementation decisions approved and applied:

1. `/organizer` is canonical; `/portal` remains a compatibility redirect for Sprint 6.
2. `view`, `section`, `status`, `search`, `sort` and `page` are normalized per route ownership.
3. List state is URL-backed where it materially affects restoration and navigation.
4. No backend endpoint, database schema or API contract was changed.

Automated verification on 2026-10-24:

- `npm run build`: passed.
- `npm run lint`: passed with existing warnings only; no lint errors.
- Affected Playwright regression set: 35 passed using one Chromium worker.
- Post-fix targeted rerun: public deep-link/not-found scenario passed; Organizer create/publish/cancel
  scenario passed.
- `git diff --check`: passed; Git reports only line-ending conversion notices for two existing
  Organizer files.

Still intentionally left for final human QA:

- opening representative canonical links in a real new browser tab;
- role-switch/logout isolation across real authenticated accounts;
- the complete unauthenticated Event registration login round-trip against the running backend.
