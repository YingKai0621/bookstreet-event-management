# Sprint 6 PR1 — Participant self-scan attendance frontend

Status: **Implemented locally on 2026-10-26 — awaiting push/PR**

Implementation evidence:

- Secure pre-React token capture, authentication return flow, typed scan API, result UI, legacy QR removal,
  responsive coverage, and focused regression tests are complete.
- `npm run build`: passed.
- `npm run lint`: passed with existing repository warnings and no lint errors.
- Focused Playwright suite: 14/14 passed.
- Full Playwright suite: 125/144 passed. The 19 failures are outside this PR1 feature area (existing Admin
  typography/booth expectations, legacy navigation selectors, modal overflow expectation, Participant profile
  mobile-height expectation, Partner calendar/route expectations, and Organizer location/detail selectors).
  They were recorded but not altered merely to make unrelated tests pass.

## 1. Objective

Complete the Participant-facing part of Sprint 6 Flow B:

- An Organizer displays one shared Activity QR.
- A Participant scans the QR and opens the canonical frontend route
  `/participant/attendance/scan?token=<opaque-token>`.
- The frontend protects the token, preserves the intended route through login, and calls
  `POST /api/v1/participant/attendance-scans` using the authenticated Participant session.
- The page communicates first-time success, an idempotent repeat, and all supported failure states.
- The obsolete reverse flow — a Participant displaying a personal/event QR for staff to scan — is removed.

This PR is a frontend integration PR. The existing Sprint 6 backend API and business rules remain authoritative.

## 2. Verified baseline and current gaps

- The backend endpoint and integration coverage already exist:
  `POST /api/v1/participant/attendance-scans`.
- The API returns the Activity registration, Activity identity/title, Attendance summary, and
  `alreadyRecorded`.
- The current frontend has no adapter or page for this endpoint.
- The current protected Participant routing already carries `pathname + search` to `/login`, but that
  behavior would also carry the raw attendance token in router state unless the token is captured first.
- `ChatWidget` is mounted beside `App` at the application root. Therefore, scrubbing the token inside a
  normal page effect would be too late to meet the contract requirement that third-party content must not
  render while the token is present in the URL.
- The frontend still contains the superseded reverse QR flow in Activity detail, Event detail, My Events,
  My Activities, Participant Dashboard, certificates guidance, and public event copy.
- The generated Event QR in `MyEventsPage` uses an external QR image service and synthetic data. It is not
  backed by the Sprint 6 attendance contract and must not remain as an attendance feature.
- QR features for Partner booth assignments, public Heritage pages, and public Feedback are separate valid
  workflows and are explicitly outside the removal scope.

## 3. Approved implementation decisions

These decisions should be approved with this checklist before code starts.

### 3.1 Token handling

- Capture the `token` synchronously before the React tree and `ChatWidget` are mounted.
- Immediately replace the visible URL/history entry with `/participant/attendance/scan` by using
  `window.history.replaceState`.
- Keep the token only in an in-memory, module-scoped one-time vault. Do not put it in local storage,
  session storage, React Router state, analytics, logs, error messages, or rendered markup.
- Preserve only the scrubbed route through authentication. The existing Participant login return behavior
  then returns the user to `/participant/attendance/scan` without exposing the token.
- Keep the token only until a definitive backend response. Clear it after success or a documented backend
  rejection; retain it only for an explicit retry after a transient network/server failure while the same page
  remains open. Clear it on navigation/unmount. A page reload after scrubbing intentionally requires scanning
  the QR again; this is safer than persisting a bearer-like token in browser storage.
- Add a document-level `no-referrer` policy so the application does not disclose sensitive query data during
  the initial navigation window.

### 3.2 Route and ownership

- Add the canonical route `/participant/attendance/scan` for authenticated Participants.
- The scan page must not decide eligibility from frontend clocks, cached registrations, or Activity state.
  It submits the opaque token once and displays the backend decision.
- A non-authenticated visitor is sent to the existing login page and returned to the scrubbed scan route.
- An account without the `PARTICIPANT` role follows the existing role-aware login destination behavior and
  must not be allowed to call the Participant API.
- The scan route should not be blocked by unrelated Participant dashboard data. Only authentication and the
  minimum shell/profile requirements needed to render the Participant layout may precede it. If the existing
  global profile gate fails, the implementation must provide a clear retry or scan-specific failure state
  instead of a blank page.

### 3.3 Legacy route

- Remove all active navigation to `/participant/activities/qr/:activityId`.
- Keep a temporary route-level redirect for stale bookmarks, leading to the Participant activities/events
  list. Do not render or regenerate a personal QR.
- Remove the obsolete `ActivityQrPage` and its dedicated styles once no imports remain.

## 4. Files to inspect again immediately before implementation

- `docs/api/sprint-06-api-contract.md`
- `docs/development/SPRINT_06_DEVELOPER_B_HANDOFF.md`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/pages/public/LoginPage.tsx`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/services/apiClient.ts`
- `frontend/src/services/apiError.ts`
- `frontend/src/services/participantApi.ts`
- `frontend/src/types/index.ts`
- `frontend/src/pages/participant/ParticipantLayout.tsx`
- `frontend/src/pages/participant/ParticipantPages.css`
- All Participant/public files listed in the legacy-content checklist below
- Existing Playwright authentication and Participant specs

## 5. Expected file changes

### New files

- `frontend/src/security/attendanceScanToken.ts`
  - Capture, scrub, read, consume, and clear the opaque token without persistent storage.
  - Expose no method that logs or serializes the token.
- `frontend/src/pages/participant/AttendanceScanPage.tsx`
  - Own the scan state machine and accessible result presentation.
- `frontend/src/pages/participant/AttendanceScanPage.css`
  - Contain only the focused, responsive scan-page styling.
- `frontend/tests/e2e/sprint6-participant-attendance-ui.spec.ts`
  - Cover the complete browser flow with mocked API responses.

### Files expected to be modified

- `frontend/index.html`
  - Add the `no-referrer` policy if it is not already present.
- `frontend/src/main.tsx`
  - Capture and scrub an attendance token before mounting React or `ChatWidget`.
- `frontend/src/App.tsx`
  - Register the canonical route, preserve the scrubbed login return target, and replace the stale QR route.
- `frontend/src/services/participantApi.ts`
  - Add a typed `scanAttendance(token)` adapter.
- `frontend/src/types/index.ts` or a focused new attendance type file
  - Add exact request/response types and remove obsolete Participant QR fields if no valid consumer remains.
- `frontend/src/pages/participant/ParticipantPages.css`
  - Add compact, responsive, accessible scan-result styles and delete dead Activity QR styles.
- `frontend/src/pages/participant/ActivityDetailPage.tsx`
- `frontend/src/pages/participant/EventDetailPage.tsx`
- `frontend/src/pages/participant/MyActivitiesPage.tsx`
- `frontend/src/pages/participant/MyEventsPage.tsx`
- `frontend/src/pages/participant/ParticipantDashboard.tsx`
- `frontend/src/pages/participant/MyCertificatesPage.tsx`
- `frontend/src/pages/public/EventsExperience.tsx`
- `frontend/src/components/landing/EventsSection.tsx`
  - Remove or rewrite only statements and controls that promise a personal attendance QR.

### File expected to be removed

- `frontend/src/pages/participant/ActivityQrPage.tsx`

The final implementation may touch fewer files if a reference is already gone after synchronizing with
`main`. Any additional file must be reported before or in the implementation summary with a reason.

## 6. Implementation checklist

### A. Secure landing bootstrap

- [ ] Detect only the exact canonical path `/participant/attendance/scan`.
- [ ] Read a single `token` query parameter as an opaque string without attempting to parse it as UUID.
- [ ] Capture the token before `createRoot(...).render(...)`.
- [ ] Remove the entire token query from the visible address and current history entry immediately.
- [ ] Ensure `ChatWidget` and any analytics/third-party component mount only after scrubbing.
- [ ] Never print the token through `console`, toast text, DOM, URL, exception text, test report, or telemetry.
- [ ] Define deterministic behavior for a missing token, duplicated token parameter, and direct refresh after
      scrubbing: show a safe “scan the QR again” state and do not call the API.

### B. Authentication handoff

- [ ] Verify an anonymous QR visit redirects to `/login` with only
      `/participant/attendance/scan` as the return target.
- [ ] Verify successful Participant login returns to the scan page and performs one scan request.
- [ ] Verify a different role cannot use the Participant scan endpoint or get trapped in a redirect loop.
- [ ] Prevent double submission under React Strict Mode, rerenders, auth/profile refreshes, and rapid clicks.
- [ ] Do not broaden or weaken the existing role checks.

### C. Typed API integration

- [ ] Model the backend response exactly, including `alreadyRecorded` and nullable Attendance fields.
- [ ] Send only `{ token }` to `POST /participant/attendance-scans` through the existing `apiClient` so Session
      credentials and CSRF behavior remain consistent.
- [ ] Do not add frontend identifiers such as user ID, registration ID, or Activity ID to the request.
- [ ] Do not modify the backend endpoint, database, migration, or API contract in PR1.

### D. Scan page states

- [ ] Initial/submitting state: clear progress text; no second request button while the request is active.
- [ ] First valid scan: show Activity title and an explicit successful attendance message.
- [ ] Idempotent repeat: show that attendance had already been recorded; do not present it as an error.
- [ ] `ATTENDANCE_WINDOW_NOT_OPEN`: explain that check-in has not opened; do not calculate a client-side time.
- [ ] `ATTENDANCE_WINDOW_CLOSED`: explain that check-in has closed.
- [ ] `ATTENDANCE_ACTIVITY_INELIGIBLE`: explain that the Activity is not eligible for check-in.
- [ ] `ATTENDANCE_REGISTRATION_INELIGIBLE`: explain that an active Activity registration is required.
- [ ] `ATTENDANCE_QR_NOT_FOUND`: use the same generic invalid/unavailable message for malformed and unknown
      tokens; do not reveal which case occurred.
- [ ] Network/server failure: show a recoverable error and a controlled retry that reuses only the in-memory
      token while the page remains open.
- [ ] Missing/consumed token: ask the user to scan the Organizer QR again.
- [ ] All states have an obvious safe route back to “Hoạt động của tôi”.
- [ ] Use semantic status/alert markup, visible keyboard focus, and mobile-safe spacing.

### E. Remove the reverse QR flow

- [ ] Remove “Xem QR”, “Mã QR Check-in”, QR download, personal code display, and synthetic Event QR modal from
      Participant screens.
- [ ] Remove Participant registration success content that renders `qrCodeValue` or `registrationCode` as a QR.
- [ ] Rewrite guidance to say the Participant scans the Activity QR displayed by the Organizer at the venue.
- [ ] Remove the external `api.qrserver.com` request from `MyEventsPage`.
- [ ] Remove obsolete type fields after verifying no supported API or screen uses them.
- [ ] Preserve Activity registration/cancellation, Event joining/leaving, certificates, rewards, and feedback.
- [ ] Do not remove Partner booth QR, Heritage QR, or Feedback QR features.
- [ ] Do not implement the Organizer shared-QR display in this PR; that belongs to the Organizer Sprint 6 PR.

### F. Styling and responsive behavior

- [ ] Reuse the Participant visual system and Be Vietnam Pro typography.
- [ ] Keep the result card compact; no large empty container, gradient, ornamental animation, or fake data.
- [ ] Verify readable layouts at 1600×900, 1366×768, and a representative mobile viewport.
- [ ] Do not hide errors/actions with `overflow: hidden`.

## 7. Automated test checklist

Create a dedicated Playwright spec that mocks only documented APIs and verifies observable behavior.

- [ ] Anonymous direct scan: raw token disappears from the address before login renders.
- [ ] The login return target contains no token.
- [ ] Participant login returns to the canonical scan page.
- [ ] Exactly one POST is made with `{ token }`; the request contains no user/registration identifier.
- [ ] The token is absent from rendered text and from all non-scan request URLs.
- [ ] First scan success renders the Activity title and success state.
- [ ] Repeat success with `alreadyRecorded=true` renders the already-recorded state.
- [ ] Missing token makes no scan request.
- [ ] Each documented 404/409 code maps to the intended Vietnamese user message.
- [ ] Network/5xx failure supports a single controlled retry without duplicate in-flight requests.
- [ ] Wrong-role authentication cannot reach the scan action.
- [ ] Legacy personal QR route no longer renders a QR.
- [ ] Participant Activity/Event screens no longer expose personal/event check-in QR controls.
- [ ] A focused regression confirms joining events, registering Activities, and cancelling registration remain
      available.

Verification commands after implementation:

```text
cd frontend
npm run lint
npm run build
npx playwright test tests/e2e/sprint6-participant-attendance-ui.spec.ts
npm run test:e2e
```

The full frontend suite should be reported from an actual run. If the environment blocks a command, report
the exact limitation and the focused evidence that was still obtained.

## 8. Manual acceptance checklist

- [ ] Scan while logged out, log in as Participant, and reach a final result without rescanning.
- [ ] Confirm the raw token is not visible in the address bar or browser history after landing.
- [ ] Confirm success and repeat-scan wording with real backend responses.
- [ ] Confirm early, late, invalid, ineligible Activity, and ineligible registration responses.
- [ ] Confirm refresh/back behavior never restores a token-bearing URL.
- [ ] Confirm no Participant page asks the user to present a personal QR to staff.
- [ ] Confirm legitimate non-attendance QR functions still work.
- [ ] Confirm desktop and mobile layouts, keyboard navigation, focus indicators, and screen-reader status output.

## 9. Business rules and existing behavior that must remain unchanged

- Backend time and lifecycle state determine scan eligibility.
- The valid window remains `[startAt - attendanceEarlyScanMinutes, endAt)`.
- A valid first scan records one `VALID/SELF_SCAN` Attendance.
- Repeated/concurrent valid scans remain idempotent and return the same Attendance identity.
- Scanning does not itself issue a Certificate or create a Rating.
- Session identifies the Participant; the QR token identifies the Activity.
- Existing authentication, email verification, registration, cancellation, certificate, reward, and feedback
  rules remain intact.
- No changes to Header, Sidebar, Organizer workflows, Backend, database, or API contract.

## 10. PR boundary and completion report

PR1 should contain only:

- Secure Participant attendance landing and scan UI.
- Typed frontend API integration.
- Removal of the obsolete Participant-owned attendance QR flow.
- Focused tests and the minimum regression updates caused by those UI changes.

Do not include Organizer QR generation/display, Organizer participation management, attendance correction,
unrelated redesigns, dependency upgrades, or backend refactors.

The implementation report must state:

1. Files added, changed, and removed.
2. How token capture/scrubbing works and why it cannot reach `ChatWidget` or login router state.
3. How each backend result/error code is presented.
4. Which reverse-QR remnants were removed and which legitimate QR features were preserved.
5. Exact lint, build, focused E2E, and full E2E results.
6. Any remaining limitation or follow-up assigned to the later Organizer PR.

