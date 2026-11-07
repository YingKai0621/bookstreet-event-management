**MVP SCOPE**

Book Street Event Management System

# 1. MVP Goal

MVP phải đủ để Ban quản lý Đường Sách tổ chức nhiều Event trong cùng một không gian vật lý; Partner đăng ký tham gia Event, chủ động chọn Booth và đề xuất Activity; Guest khám phá nội dung công khai và gửi góp ý chung; Participant Join Event, đăng ký Activity, ghi nhận attendance và nhận rewards khi đủ điều kiện.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Scope lock<br />
Tập trung vào Event - Partner - Booth - Booth Payment - Activity - Participant - Attendance. Feature mới ngoài chuỗi này đưa vào Future Scope.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 2. Actors

| **Actor**           | **MVP responsibility**                                                                                         |
|---------------------|----------------------------------------------------------------------------------------------------------------|
| Guest               | Explore public Book Street information and submit general feedback.                                            |
| Participant         | Event participation, Activity registration, QR self-scan, Attendance, BoothVisit, rewards and Activity rating. |
| Partner / Exhibitor | Event application, Booth request/payment/settlement and Activity proposal.                                     |
| Event Organizer     | Event operations, reviews, participation monitoring, public content and reports.                               |
| System Admin        | Accounts, Role/UserRole, global Badge definitions, Partner organization status, administrative audit log and a read-only system dashboard; no Permission model or generic System Settings module. |

# 3. In Scope

## Public Experience

- Explore Events, Activities, Booths, Booth Map and Heritage content without login.

- Submit General Feedback without login for exactly one target: BOOK_STREET or EVENT. Heritage, Location and Activity are not GeneralFeedback targets.

## Participant Event Participation

- Join/Leave Event with one reusable EventRegistration per User/Event; leaving preserves history

- My Events

- Durable in-app notifications for the Participant-impacting transitions defined in this scope

- Auto-create Event Registration when registering an Activity or scanning a valid BoothAssignment QR without joining first

## Activity Registration

- Register/cancel/re-register Activity within the Event and Activity registration deadlines

- Atomic seat-capacity control, including concurrent registration attempts

- Schedule-overlap warning

- My Activity registrations with Active, Cancelled, Attended and No-show outcomes

- Shared Activity QR self-scan, Attendance history, Certificate and verified Activity Rating

- BoothVisit, Points and Badge progression remain part of the broader Participant MVP, but are
  separate from the Sprint 6 Activity-registration delivery slice

## Partner Participation

- Partner profile

- Apply to Event

- Organizer approval

- Withdraw a Partner application while it is still PENDING

## Booth

- Manage physical Area/Booth resources

- Select a specific Booth on the MVP Booth Map; advanced map editor is not required

- Derived Event/time availability: no config or isEnabled=false → UNAVAILABLE; otherwise Active Assignment → ASSIGNED, Active Hold → ON_HOLD, else AVAILABLE

- Booth Request, Booth Hold, Booth Payment and Booth Assignment are separate records/concepts.

- Competing BoothRequest for the same Booth and overlapping allocation time remain PENDING while the selected candidate pays. SUCCESS creates Assignment and marks other candidates NOT_SELECTED only while Event is PUBLISHED/ONGOING; payment-window expiry marks the winner PAYMENT_EXPIRED and leaves others PENDING unless unresolved evidence must keep the Hold blocking.

- Request and withdraw Booth before settlement. An eligible SELECTED request may release its Hold
  when no Payment `PENDING`/`SUCCESS`, reconciliation-required evidence or Assignment exists.

- EventBoothConfig is an official Logical/Physical entity, unique per Event–Booth, storing rentalPrice/isEnabled. Organizer selection creates a Hold and snapshots rentalPrice as the locked price for every attempt in that payment window; later config changes apply only to new selections

- The same physical Booth may be reused by different Events when their time ranges do not overlap.

- Hold release/reassign rules before settlement

- Booth change/cancellation after Assignment, whole-Event Partner withdrawal after approval and business refunds are Post-MVP.

## Event Lifecycle Hardening

- Draft Event hard delete with Event-scoped configuration cleanup.

- Safe descriptive updates after publication; operational updates only before external participation.

- One-way DRAFT → PUBLISHED → ONGOING → COMPLETED lifecycle.

- Organizer cancellation of a PUBLISHED Event only before any Payment `PENDING`/`SUCCESS`,
  reconciliation-required evidence or Assignment exists.

- Atomic cancellation of open Booth requests and release of eligible Active Holds.

## Activity

- Activity Proposal with exact time/location

- Organizer approval and separate Publish step

- BTC Activity creation

- Conflict/capacity checking, including rejection of capacity below the seat-active registration count

- Change/reschedule/cancel with Participant registration and Notification effects preserved

- Schedule or Location becomes immutable after the first valid Attendance for that Activity

- Configurable per-Event activity limit

## QR Participation & Rewards

- Activity QR belongs to Activity; an authenticated registered Participant self-scans the shared QR
  in `[startAt - 15 minutes, endAt)` to create one idempotent valid Attendance

- Activity completion classifies each remaining active registration without valid Attendance as
  No-show; Organizer correction requires an append-only reasoned audit trail

- BoothAssignment QR is active only while Assignment/Event is active; Participant self-scans to create BoothVisit

- Duplicate Activity/Booth QR scans do not create duplicate Attendance/BoothVisit rewards

- Points from valid BoothVisit

- Badge from cumulative total Points

- Certificate metadata is issued idempotently only after Activity `COMPLETED`, with valid Attendance
  and certificate enabled; voiding/restoring Attendance revokes/reissues the same Certificate identity

## Communication & Feedback

- One durable PostgreSQL in-app inbox is role-scoped for Participant, Partner, Organizer and Admin.
  Every list/read operation isolates both the authenticated User and exact workspace role.

- Participant keeps the six implemented Activity/Event/Certificate/Badge notification types. Partner
  receives only approved committed workflow outcomes; the owning Organizer receives only approved review
  work items. Admin receives a real inbox foundation with no type or producer in Sprint 10.

- Notification and its approved domain transition commit atomically with stable deduplication. Parent
  cancellation and terminal-outcome suppression prevents redundant child/intermediate rows.

- Optional verified-email delivery runs after commit and cannot roll back domain state; no
  NotificationType entity or senderUserId

- General Feedback without login

- Verified Activity Rating is available only after Activity `COMPLETED` to the owner of valid
  Attendance; one Attendance has at most one current Rating

## Reporting

- Partner/Booth/Activity counts

- Event and Activity registrations

- Attendance/no-shows/BoothVisit

- Participation rate

- Basic feedback summary

## Administration

- Accounts: username, full name and password registration; confirm password is not persisted; email is optional for Participant

- Roles via UserRole/Role; PARTNER, ORGANIZER and ADMIN require verified email; no separate Permission model in MVP

- Badge definitions and total-Points thresholds

- Partner organization status and an append-only administrative audit log

- Payment Gateway credentials and webhook endpoints are backend environment configuration, not an Admin UI or Use Case in MVP.

- Admin Notification APIs/UI expose genuine empty and failure states. Sprint 10 does not fabricate
  Security, Account, login, role-change, Badge or system-health alerts.

# 4. Important MVP Boundaries

- Event Registration is not an entrance ticket and has no Event QR.

- Activity Registration is the seat/capacity-controlled registration. Activity QR belongs to the Activity; a registered Participant self-scans it to create Attendance.

- There is no Participant-specific Attendance QR and no staff/Attendance Operator scanning flow.
  The authenticated session identifies the scanning Participant; clients do not submit a userId.

- Attended is derived from valid Attendance rather than stored as a fourth ActivityRegistration
  status. ActivityRegistration uses Active, Cancelled and No-show while cancellation source records
  whether Participant, Activity or Event caused the cancellation.

- Activity/Event cancellation preserves historical Attendance, Certificate, Rating and correction
  audit. Cancellation is the primary current outcome even when a valid Attendance existed earlier.

- A valid Activity schedule/Location change before Attendance keeps existing registrations and
  recomputes overlap warnings; it does not require Participant reconfirmation.

- Partner must be APPROVED in an Event before requesting a Booth or submitting an Activity Proposal.

- A physical Booth is not globally ASSIGNED. EventBoothConfig.isEnabled controls whether it is offered in an Event; runtime availability is derived separately from config, Hold, Assignment and allocation time. A config with overlapping Active Hold/Assignment cannot be disabled.

- Activity participation remains free. Booth rental uses real Payment Gateway payment. The Event–Booth price is locked at SELECTED + Hold; each FAILED/attempt TIMEOUT is stored separately and may retry only while the payment window is open. Unresolved evidence can preserve an Active Hold past scheduled expiry and blocks retry/reassignment. Assignment requires backend-verified SUCCESS while Event is PUBLISHED/ONGOING.

- Heritage is supporting public content, not a separate heritage-management workflow.

- Each Event stores organizerUserId for the responsible Organizer; this is operational responsibility/audit, while the Event remains within Book Street management.

# 5. Out of Scope

- AI chatbot/recommendation

- Paid Activity tickets

- Billing/invoice and all business-refund execution

- Booth change or cancellation after Assignment

- Partner withdrawal from the whole Event after approval

- Event cancellation after any Payment `PENDING`/`SUCCESS`, reconciliation-required evidence or
  any Assignment

- Admin emergency cancellation of an ONGOING Event

- Staff shift management

- Waitlist

- Event-level entrance QR, Participant-specific Attendance QR, staff scanner and Attendance Operator role

- Check-out, attendance duration, face recognition, GPS/geofencing and device fingerprinting

- Generic Organizer notification composer, SMS/push delivery and transactional message outbox

- Combined cross-role inbox, client-created Notification, polling, WebSocket delivery, SSE beyond the BR-111 signal, notification
  preferences, delete/archive/pin/snooze and Admin alert producers

- Sponsor management

- Equipment inventory

- Reward redemption/vouchers

- Advanced BI/predictive analytics

- Recurring activity engine

- Legal/digital-signature certificates

- Advanced Map Editor: multiple map versions, upload/delete map, click-to-create Location/Booth, drag/drop positioning.

# 6. MVP Completion Criteria

- Guest browses public information and submits General Feedback without login.

- Participant can Join/Leave Event, see My Events, register/cancel/re-register Activity and see an
  ownership-safe registration outcome without duplicate seats.

- A registered Participant can self-scan the shared Activity QR only in the valid server-time window;
  duplicate/concurrent scans return one Attendance and completion classifies eligible No-shows.

- Partner can apply to an Event, be approved, select/request a specific Booth, release an eligible pre-payment Hold, pay after Organizer selection, receive Assignment after success and submit an Activity Proposal.

- Organizer can manage Event/Location/Booth/Activity, safely update/cancel an eligible Event, monitor
  participation and correct Attendance only through a reasoned append-only audit workflow.

- System enforces registration deadlines, atomic capacity, schedule conflict warnings, Activity
  schedule/Location freeze after Attendance, Event/time Booth availability and access rules while
  maintaining history.

- BoothVisit produces Point/Badge progression correctly. Valid Activity Attendance enables Rating
  only after Activity completion; Certificate additionally requires the completed Activity to have
  certificates enabled.

- Activity/Event cancellation and Attendance correction preserve history and cascade registration,
  Certificate, Rating and in-app Notification state consistently and idempotently.

- Public and Participant Activity responses never expose the raw shared Attendance QR token;
  Organizer receives it only for an owned Event through protected access.

- Organizer can see basic participation/occupancy reports.

# 7. Sprint 6 Delivery Boundary

- Sprint 6 delivers the Participant Activity slice of `UC-G01`, `UC-P01`–`UC-P04`, `UC-O01`,
  `UC-O06` and `UC-O07`; it does not introduce a new Actor or top-level Use Case.

- The Sprint 6 slice includes canonical public Activity discovery, Event participation,
  Activity registration, shared-QR Attendance, No-show, Organizer correction audit, Certificate,
  Activity Rating and the narrow durable in-app Notification set above.

- BoothVisit, Points and Badge remain active MVP scope and keep their existing traceability, but are
  not implementation or completion gates for Sprint 6.

- Sprint 6 does not reopen the Event operational-update policy: after external participation exists,
  prohibited Event operational fields remain frozen rather than being changed with a notification.

- Exact statuses, timing boundaries, cancellation precedence, correction cascades, idempotency and
  lock ordering are governed by `05_Business_Rules.md`; this scope document does not redefine them.

# 8. Sprint 10 Delivery Boundary

- Sprint 10 extends the existing `notifications` table rather than creating a generic messaging system.
- The active slice refines `UC-P01`, `UC-P03`, `UC-E01`–`UC-E06` and `UC-O03`–`UC-O06`; Admin receives
  infrastructure only and no new top-level Use Case.
- Exactly four role endpoint families provide list, unread count, mark-one and mark-all operations.
- Partner and Organizer producers are limited to the approved transition matrices and suppression rules;
  Participant meaning remains backward compatible and Admin has no producer.
- Refresh occurs on workspace entry, inbox/popover open, confirmed read mutation and the BR-111 signal. Background polling,
  fake real-time delivery and local-only read truth are outside the active slice.
- Exact type/reference pairs, API DTOs, migration constraints and 52 Acceptance Criteria are governed by
  the active Sprint 10 baseline, Use Case Specifications, API Contract and Physical ERD overlay.

# 9. Sprint 11 Delivery Boundary

- Sprint 11 completes the existing Admin Use Cases and adds `UC-A04` and `UC-A05`, giving 28 active MVP Use
  Cases.
- `BR-112` through `BR-120` govern accounts, roles, Partner organization status, the audit log, the dashboard and
  password reset.
- Locking a Partner organization blocks new work only. It creates no automatic cancellation or refund.
- Admin screens and APIs outside this scope are removed: facilities, assets and booth catalog on Admin, generic
  System Settings, Permission management and Admin password reset.
- Read-only system-wide Payment and Event views are optional and enter only if the Sprint 11 baseline schedules
  them. They add no Use Case and cannot change data.
- Admin alert producers, Admin emergency cancellation, refunds and manual Payment changes remain out of scope.
- Exact criteria, API DTOs and migration constraints are governed by the Sprint 11 baseline, API Contract and
  Physical ERD overlay.
