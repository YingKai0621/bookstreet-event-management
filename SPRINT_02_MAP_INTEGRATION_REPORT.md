# Sprint 2 Interactive Booth Map Integration Report

Date: 2026-10-08  
Branch: `frontend`  
Implementation state: frontend changes are present and uncommitted. No commit, push, merge, rebase, or reset was performed.

## 1. Summary

The approved illustrated Nguyen Van Binh Book Street map is preserved and now consumes real Sprint 2 Booth contracts.

- Organizer `Gian hàng` now loads paginated physical Booths plus the selected Event's `EventBoothConfig` data, renders real markers, identifies unpositioned Booths, and supports minimal X/Y editing through the existing Booth PATCH endpoint.
- Partner `/partner/booth-requests` now renders Event Booths on the illustrated map. Selecting a marker opens the existing request modal and submits through the existing BoothRequest API.
- Public map now has an explicit Published Event selector and loads read-only Event Booth data from the actual public endpoints.
- Organizer and Partner share one map canvas and one set of Booth-to-marker adapters. The public page retains its approved map layout/zoom implementation and reuses the same EventBooth coordinate adapter.
- A marker is rendered only when both `mapX` and `mapY` are finite values in the inclusive range 0–100. There are no generated, random, index-based, or fallback positions.

## 2. Verified business requirements

- BR-14: the Partner map is available inside the existing approved-application workflow; submission eligibility remains enforced by the existing UI and Backend.
- BR-17: coordinate edits PATCH the existing physical Booth and never create an Event-specific duplicate.
- BR-18: marker submission uses the existing BoothRequest endpoint. A successful request becomes PENDING and the test fixture keeps the Booth AVAILABLE.
- BR-19/BR-70: availability displayed by Partner/Public/Organizer comes from `EventBooth.availability`; the Frontend does not calculate assignment/hold availability.
- BR-20: Organizer selection remains in `Sprint2BoothWorkspace`; the map links to it rather than duplicating selection logic. Existing SELECTED/Hold displays remain intact.
- BR-21: no Frontend quota was introduced.
- BR-22: PENDING withdrawal remains unchanged. Future Booth change/cancellation routes remain present and separate.
- BR-56: category is displayed and can filter Partner Booths, but does not block requests.
- BR-57: displayed price comes from `EventBoothConfig.rentalPrice`, never from the physical Booth.

## 3. Root causes fixed

1. Legacy Organizer `BoothMapView` expected a raw array although `GET /organizer/booths` returns a page. Its fallback `/public/booths` endpoint does not exist, so it commonly ended with zero Booths.
2. The legacy Organizer map also generated index-based marker positions, which were not Backend coordinates.
3. `Sprint2BoothWorkspace` already used real Sprint 2 APIs, but only rendered cards/lists.
4. `BoothSelectionPage` initializes its shared map points from an intentionally empty placeholder service and belongs to future Booth-change workflows.
5. `Sprint2PartnerBoothsPage` loaded real Event Booths but did not pass them into any map renderer.
6. Public `InteractiveMap` loaded `/public/map-hotspots`, while the implemented contract is `GET /events/{eventId}/booths`. Its `booths` prop enriched legacy marker details but could not create markers.
7. Local physical Booth records had null coordinates. Passing FE-BE card/request tests therefore did not prove that any marker could render.

The marker renderer was not wholly absent. It was disconnected from Sprint 2 data, used obsolete endpoints on some screens, and had no renderable data in the local database.

## 4. Data flow after integration

1. Organizer creates/edits a reusable physical Booth in the existing Sprint 2 workspace.
2. Organizer configures that Booth for an Event with `rentalPrice` and `enabled` in the existing workspace.
3. Organizer map combines the physical Booth with the selected Event configuration and Backend-derived availability.
4. Approved Partner selects the Event, loads `/events/{eventId}/booths`, selects a positioned marker, and uses the existing request modal/API.
5. PENDING remains AVAILABLE until the Backend changes authoritative availability.
6. Organizer uses the existing candidate-review actions. Selection creates SELECTED + ACTIVE Hold in the Backend; subsequent Event Booth reads return ON_HOLD.
7. Partner/Public maps display that returned Event-specific state. No Frontend Hold or Assignment state is synthesized.

## 5. Organizer changes

- Replaced the active `booths` tab's legacy view with `Sprint2BoothMapView` while leaving the legacy component file intact.
- Loads every physical-Booth page instead of silently truncating at 100.
- Loads Event configurations for the selected Event and shows category, enabled state, Event price, and runtime availability.
- Uses a status legend and accessible marker labels.
- Lists unpositioned Booths as `Chưa định vị`.
- Provides validated 0–100 X/Y inputs and a live marker preview.
- Saves only the selected existing Booth's coordinates via PATCH and confirms that the returned values render after reload.
- Links to the existing configuration/candidate workspace. It does not duplicate request selection/rejection.
- If there is no Event, valid physical locations use a neutral `PHYSICAL` state rather than inventing Event availability.

## 6. Partner changes

- Added the shared illustrated map to `Sprint2PartnerBoothsPage` without removing its card/list alternative.
- Uses the selected approved `PartnerEventApplication` and existing Event Booth API.
- Category filtering applies consistently to list and markers.
- Marker selection opens the existing details/request modal with Backend availability and Event price.
- Non-AVAILABLE Booths keep the existing concise blocked reason and disabled request action.
- Request history, PENDING withdrawal, SELECTED Hold price/expiry, countdown, and future Booth-management routes remain unchanged.

## 7. Public changes

- Public Event loading now unwraps the actual paginated `GET /events` response rather than calling `/public/events` as if it returned an array.
- Added a small explicit Published Event selector next to the existing map experience. No Event is randomly selected.
- The normal illustration remains visible before Event selection.
- Selecting an Event loads all pages from `GET /events/{eventId}/booths`.
- Public details show only Booth identity/description/category/capacity, Event price, and availability.
- No request, application, Hold detail, review note, or management action is exposed.
- Switching Events clears stale markers. An Event without valid positioned Booths shows an empty explanation.
- Existing public zoom, pan, image, page layout, Heritage, and other public sections are preserved.

## 8. Verified Backend contracts

Verified against controllers, DTOs, services/tests, and the active API contract:

| Purpose | Contract used |
|---|---|
| Published Events | `GET /api/v1/events` → paginated `EventSummaryResponse` |
| Public/Partner Event Booths | `GET /api/v1/events/{eventId}/booths` → paginated `EventBooth` data |
| Physical Booth list | `GET /api/v1/organizer/booths` → paginated `PhysicalBooth` data |
| Update physical coordinates | `PATCH /api/v1/organizer/booths/{boothId}` |
| Event Booth configuration | `GET /api/v1/organizer/events/{eventId}/booth-configs` |
| Price/enabled update | `PUT /api/v1/organizer/events/{eventId}/booth-configs/{boothId}` |
| Partner request submission | `POST /api/v1/events/{eventId}/booth-requests` |
| Partner request history | `GET /api/v1/partner/booth-requests` |
| Organizer candidates/actions | Existing `/organizer/events/{eventId}/booth-requests` query/select/reject endpoints |

Spring Security source permits anonymous GET access to `/api/v1/events` and `/api/v1/events/**`. Anonymous behavior passed the mocked browser contract test. The already-running local Backend returned authentication/authorization failures in live checks, so deployment/runtime parity with the inspected source still needs confirmation.

## 9. Coordinate convention and limitations

Chosen convention for the single approved illustration:

- `mapX`: 0–100 percent, left to right.
- `mapY`: 0–100 percent, top to bottom.
- Origin: top-left of the rendered map image.
- Marker container and image have the same responsive width and aspect ratio; percentage positions therefore remain attached during resize and zoom.
- Marker size is inversely scaled during zoom so it remains usable without changing its anchor.

The Backend can persist optional decimal `mapX`/`mapY`, but its DTO currently does not formally declare the image reference system or enforce the 0–100 range. The Frontend therefore validates edits and safely suppresses invalid/missing coordinates. Existing values outside this convention are not silently reinterpreted.

Audit-time local database snapshot (read-only): 2 physical Booths, 2 enabled EventBoothConfigs, and both physical Booths had `map_x = NULL`, `map_y = NULL`. The same snapshot contained selected requests/active Holds, demonstrating that Booth workflow data can exist while maps remain empty.

## 10. Automated test results

| Check | Result | Notes |
|---|---|---|
| TypeScript + production build | PASS | `npm.cmd run build`; 2,403 modules transformed. Existing bundle-size warning only. |
| Frontend lint | PASS WITH WARNINGS | `npm.cmd run lint`; exit 0. Repository-wide pre-existing warnings remain. |
| Sprint 2 Organizer/Partner/Public map UI | PASS | 3/3 Chromium tests on isolated Vite port 5174. |
| Valid marker coordinates | PASS | Organizer, Partner, and Public fixtures render expected Booths. |
| Null/invalid coordinates | PASS | Public test suppresses null C03 and out-of-range D04; Organizer list retains unpositioned B01. |
| Zoom alignment | PASS | Partner marker retains exact percentage `left/top` after zoom. |
| Responsive alignment | PASS | Same marker anchor retained after mobile-to-desktop viewport resize. |
| Coordinate save/reload | PASS | Organizer PATCH fixture persists 62.5/48 and marker remains after page reload. |
| Marker selection/details | PASS | Partner opens existing request modal; Public opens read-only details. |
| Event switching/stale markers | PASS | Public switches to an Event with only invalid coordinates, clears markers, then reloads Event 101. |
| Existing Sprint 2 UI CRUD/request flow | PASS | Physical create, Event price update, candidate selection/Hold display, Partner PENDING submission/history. |
| Sprint 1 Organizer E2E | BLOCKED | Existing live-Backend test stopped at login because the local Backend returned HTTP 403. No Event was created. |
| Sprint 1 Partner Application E2E | BLOCKED | Same Organizer login HTTP 403 before test mutations. |
| Existing live Sprint 2 FE-BE suite | NOT RUN | It creates permanent Booth/request data. It was intentionally not rerun against the shared development database. The task context states it passed before this integration. |

Playwright is configured with screenshot/video/trace retention on failure. The isolated successful map run produced the HTML report at `frontend/playwright-report/index.html`; passing tests do not retain trace files under the current configuration. The failed Sprint 1 login runs visibly showed the 403 alert and produced failure artifacts during diagnosis, but Playwright cleans `test-results` at the start of the subsequent successful run.

## 11. Files created/modified

Created:

- `frontend/src/components/booth-map/BoothMapCanvas.tsx`
- `frontend/src/components/booth-map/BoothMapCanvas.css`
- `frontend/src/components/booth-map/boothMapModel.ts`
- `frontend/src/components/portal/Sprint2BoothMapView.tsx`
- `SPRINT_02_MAP_INTEGRATION_REPORT.md`

Modified:

- `frontend/src/App.tsx`
- `frontend/src/components/InteractiveMap.tsx`
- `frontend/src/components/InteractiveMap.css`
- `frontend/src/components/ManagementPortal.tsx`
- `frontend/src/components/portal/Sprint2Booth.css`
- `frontend/src/pages/partner/Sprint2PartnerBoothsPage.tsx`
- `frontend/src/services/boothApi.ts`
- `frontend/src/services/publicApi.ts`
- `frontend/tests/e2e/sprint2-booths-ui.spec.ts`

No Backend Java, Flyway migration, schema, seed, environment, or illustrated-map asset was modified.

## 12. Effects on future Sprints

- `BoothMapView`, `BoothSelectionPage`, and `BoothManagementPage` remain in the repository.
- `/partner/booths` and `/partner/booths/select` routes remain unchanged for future Assignment/change/cancellation work.
- No Payment, Assignment creation, cancellation, refund, or advanced editor behavior was added.
- Shared adapters can be reused later, but future workflows must continue to use Backend-authoritative states.

## 13. Missing Backend/environment dependencies

1. The coordinate reference system and 0–100 range should eventually be documented and validated in the Backend/API contract. No Backend change was made in this task.
2. Existing physical Booths require Organizer-entered coordinates before any real local markers can appear; the task deliberately did not invent them.
3. The local running Backend must be brought into parity with the inspected source/security configuration so anonymous Event Booth reads and configured E2E accounts work without 401/403.
4. A dedicated disposable E2E database/fixture cleanup is needed before safely rerunning all mutating FE-BE suites.

## 14. Git and database safety

- Branch: `frontend`.
- Changes: uncommitted.
- Pre-existing untracked root `package-lock.json` was preserved and not edited by this task.
- No database record was inserted, updated, or deleted by this task's executed tests. All passing map tests used browser route fixtures. The live regression tests failed before mutation.
- No Backend, migration, Docker volume, or database command changed state.

## 15. Remaining manual verification

- Restart/deploy the current Backend build, verify anonymous `GET /events` and `GET /events/{id}/booths`, and resolve the local login 403.
- In a dedicated test database, assign coordinates to test Booths through the Organizer UI and rerun the existing live Sprint 1/Sprint 2 suites.
- Confirm the chosen percentage positions visually with the product owner against the approved illustration; the system cannot infer physical positions from Booth codes.

## 16. Final diff summary

The change is isolated to Frontend source, one Frontend E2E spec, and this report. It adds a shared map canvas/model, a Sprint 2 Organizer map view, real Partner/Public marker data flow, public Event pagination, and all-page Booth loaders. Legacy future-Sprint screens and routes remain intact. There are no Backend or database diffs.
