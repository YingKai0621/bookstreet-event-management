# Sprint 10 Closure Report

- Sprint: Sprint 10 Role-Scoped In-App Notifications
- Status: `COMPLETED`
- Completion date: `2026-11-07`
- Documentation baseline: PR #116, merge commit `3a0a76b`
- Implementation: PR #122, #124, #125, #126, #130, #132, #133, #136 and #137
- Verified code: `main` at `b13c11e`
- Schema baseline: immutable Flyway migrations V1 through V17
- Acceptance baseline: 58 Acceptance Criteria after the `BR-110` and `BR-111` amendments

Sprint 10 is complete. The existing `notifications` table is now one durable inbox separated by User and
exact role. Participant behavior stays compatible, Partners receive committed outcomes, Organizers receive
actionable work items, and Admin has a real inbox with no producer. Open Participant, Partner and Organizer
workspaces update without a page reload.

## 1. Delivered scope

- V16 adds `recipient_role`, four domain references and role-aware constraints, and backfills existing rows as
  `PARTICIPANT` without changing their read state.
- V17 adds `ACTIVITY_STARTING_SOON`, `PARTNER_EVENT_PUBLISHED`, `PARTNER_BOOTH_HOLD_EXPIRING` and
  `ORGANIZER_BOOTH_PAYMENT_CONFIRMED`.
- Each role has list, unread count, mark-one and mark-all operations fixed to the authenticated User and role.
- Notifications are written in the owning domain transaction with stable deduplication keys.
- Server jobs send the Booth hold and Activity start reminders.
- Three Server-Sent Events streams send a content-free signal after commit. Clients then reload through the
  normal inbox APIs. Admin opens no stream because it has no producer.
- Each role has a real unread badge, preview and full inbox with loading, empty, filtered-empty, forbidden,
  expired-session and failure states.

## 2. Scope changes during the Sprint

| Date | Change | Reason | Effect |
| --- | --- | --- | --- |
| `2026-11-06` | `BR-110`, V17, four criteria | Manual review found recipients were missing information they needed to act | 52 to 56 criteria |
| `2026-11-06` | `BR-111`, two criteria | Recipients had to reload the page to see a new Notification | 56 to 58 criteria; SSE removed from the `BR-109` exclusions; no migration |

The project owner approved both changes.

## 3. Acceptance Criteria traceability

The closure audit compared each criterion with producer call sites, test names and Notification assertions. It
did not re-derive every clause of every criterion line by line.

### 3.1 Shared foundation `AC-N-S10-01` through `AC-N-S10-13`

- `RoleScopedNotificationIntegrationTests`, `NotificationInboxServiceTests` and `NotificationWriterServiceTests`
  cover role-fixed operations, paging, filters, read semantics, concurrency and reference validation.
- `NotificationTransactionBoundaryIntegrationTests` covers rollback with the owning transition and retry.
- `AuthAuthorizationIntegrationTests` covers disabled and unverified accounts and missing authority.
- `Sprint10SchemaMigrationTests` covers clean migration, V15 upgrade and backfill.
- `NotificationLiveUpdateIntegrationTests` runs a real server with a real login for `AC-N-S10-12`.
- `notification-live-updates-ui.spec.ts` covers `AC-N-S10-13`.

### 3.2 Participant `AC-P-S10-01` through `AC-P-S10-08`

- `ParticipantNotificationIntegrationTests`, `ParticipantNotificationControllerTests` and
  `BadgeUnlockedNotificationIntegrationTests` cover compatibility and ownership.
- `NotificationAmendmentIntegrationTests` covers the Activity reminder.
- `participant-notifications-ui.spec.ts` and `multi-role-notifications-ui.spec.ts` cover UI states, bounded
  refresh, navigation and role isolation.

### 3.3 Partner `AC-E-S10-01` through `AC-E-S10-15`

- `PartnerOutcomeNotificationServiceTests` and `NotificationTransactionBoundaryIntegrationTests` cover
  application review, transition keys and excluded self-actions.
- `OrganizerBoothSelectionIntegrationTests` and `PaymentSprint03IntegrationTests` cover selection, not-selected,
  expiry and Assignment confirmation.
- `OrganizerActivityProposalIntegrationTests`, `OrganizerActivityRequestIntegrationTests` and
  `EventActivityCascadeIntegrationTests` cover Activity outcomes, system closure and duplicate suppression.
- `NotificationAmendmentIntegrationTests` covers Event publication and hold reminders.
- `partner-events-ui.spec.ts` covers the inbox and every Partner navigation target.

### 3.4 Organizer `AC-O-S10-01` through `AC-O-S10-11`

- `OrganizerWorkItemNotificationServiceTests` covers recipient, reference, resubmission keys and suppression.
- `NotificationTransactionBoundaryIntegrationTests` covers `AC-O-S10-01` through the real submission flow.
- `OrganizerBoothSelectionIntegrationTests` covers `AC-O-S10-06`: an eligible candidate, and no alert with no
  candidate, a passed deadline, an inactive organization or a pending payment.
- `PaymentSprint03IntegrationTests` and `NotificationAmendmentIntegrationTests` cover `AC-O-S10-11`.
- `organizer-notifications-ui.spec.ts` covers the inbox and every Organizer navigation target.
- `PartnerActivityProposalIntegrationTests` covers `AC-O-S10-03` through the real submit, review, edit and
  resubmit flow.
- `AC-O-S10-02`, `AC-O-S10-04` and `AC-O-S10-05` combine producer unit tests with manual verification in section
  5, by decision of the project owner. They have no automated test through the real submission flow.

### 3.5 Admin `AC-A-S10-01` through `AC-A-S10-05`

- `RoleScopedNotificationIntegrationTests`, `NotificationWriterServiceTests` and
  `AuthAuthorizationIntegrationTests` cover real empty operations, the rejected type and role isolation.
- `admin-notifications-ui.spec.ts` covers genuine empty, forbidden, expired-session and failure states.

### 3.6 Regression `AC-S10-REG-01` through `AC-S10-REG-06`

- The full backend suite on `main` covers domain transitions, migrations and security.
- `NotificationTransactionBoundaryIntegrationTests` shows General Feedback creates no Notification.
- Repository search found no WebSocket handler, Notification `localStorage`, or background Notification polling.
  The `setInterval` in `ParticipantLayout` only updates a displayed relative time.

## 4. Verification evidence

The evidence used isolated test data rather than the local demo database.

- CI backend tests on `b13c11e`: **750 run, 0 failures, 0 errors, 1 skipped**
- CI frontend checks on `b13c11e`: **passed**
- CI Playwright workflow: **skipped by the agreed optional-CI policy**
- Notification-focused Playwright run on the merged code: **56 passed**
- Frontend lint: **0 errors, with one existing warning in `ManagementPortal.tsx`**

Browser tests use mocked APIs. Backend integration tests and the manual checks in section 5 provide evidence
against real services.

## 5. Manual verification

The project owner confirmed on a running system:

- a Partner Booth request, Activity proposal, change request and cancellation request each gave the Organizer a
  Notification
- withdrawing a Booth request created no additional Notification
- editing a proposal without resubmitting it created no additional Notification
- with two browsers open, new Notifications appeared without a page reload

The 11-step checklist in the implementation plan was not run in full. Time-based reminders were verified only
by automated tests.

## 6. Security and transaction boundaries

- Authentication remains a Spring Security server-side Session in Redis. No JWT or bearer token was introduced.
- Recipient and role come from durable domain ownership; clients cannot create rows or select an audience.
- Unknown, other-owner and other-role identities return the same not-found response.
- The live signal is sent only after commit, contains no Notification data, and cannot affect the transition.
- `SecurityConfiguration` permits `ASYNC` dispatch so a finished stream is not re-authorized. Authority is still
  checked when the stream opens.
- A disabled account cannot open a stream. A stream already open may still receive empty signals for up to one
  hour, but the inbox APIs reject the following read.

## 7. Remaining debt

Recommended for Sprint 11:

- The backend has no `/admin/settings` or `/admin/profile`.
- Disabled-account sessions are blocked on Notification APIs only, not across the whole system.
- `partner-assigned-booths-ui.spec.ts:188` and `:246` fail with or without Sprint 10 changes. They look for a
  `combobox` filter and appear stale.
- `notificationPreferences` remains unused in `ManagementPortal.tsx` and `types/organizer.ts`.

Known limits to keep in mind:

- Live connections are per application instance. Running several backends would need shared delivery.
- After a backend restart, a tab may not reconnect until it is hidden and shown again, or reloaded.
- `AC-O-S10-02`, `AC-O-S10-04` and `AC-O-S10-05` have no automated test through the real submission flow.
- Mobile layout for Partner, Organizer and Admin was deferred by the project owner.
- Existing frontend lint warnings and production bundle splitting remain general technical debt.

Any new feature or schema work requires a separately approved Sprint baseline. The next free Flyway version must
be rechecked before reservation.

## 8. Closure decision

All 58 Acceptance Criteria have automated or manually confirmed evidence, as mapped in section 3. V17 is
immutable, CI is green on the merged code, and the project-control documents reflect the implementation. Sprint
10 is therefore closed as `COMPLETED` on `2026-11-07`.
