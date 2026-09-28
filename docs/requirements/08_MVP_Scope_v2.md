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
| System Admin        | Accounts, Role/UserRole and global Badge definitions; no Permission model or generic System Settings module.   |

# 3. In Scope

## Public Experience

- Explore Events, Activities, Booths, Booth Map and Heritage content without login.

- Submit General Feedback without login for exactly one target: BOOK_STREET, EVENT or HERITAGE. Location and Activity are not GeneralFeedback targets.

## Participant Event Participation

- Join/Leave Event

- My Events

- Event-level in-app notifications

- Auto-create Event Registration when registering an Activity or scanning a valid BoothAssignment QR without joining first

## Activity Registration

- Register/cancel Activity

- Capacity control

- Schedule-overlap warning

- My Activity registrations, Attendance, BoothVisit, Points, Badge and Certificate

## Partner Participation

- Partner profile

- Apply to Event

- Organizer approval

- Withdraw from Event

## Booth

- Manage physical Area/Booth resources

- Select a specific Booth on the MVP Booth Map; advanced map editor is not required

- Derived Event/time availability: no config or isEnabled=false → UNAVAILABLE; otherwise Active Assignment → ASSIGNED, Active Hold → ON_HOLD, else AVAILABLE

- Booth Request, Booth Hold, Booth Payment and Booth Assignment are separate records/concepts.

- Competing BoothRequest/BoothChangeRequest for the same Booth and overlapping allocation time remain PENDING while the selected candidate pays. SUCCESS creates Assignment and marks other candidates NOT_SELECTED; payment-window expiry marks the winner PAYMENT_EXPIRED and leaves others PENDING.

- Request/change/cancel Booth

- EventBoothConfig is an official Logical/Physical entity, unique per Event–Booth, storing rentalPrice/isEnabled. Organizer selection creates a Hold and snapshots rentalPrice as the locked price for every attempt in that payment window; later config changes apply only to new selections

- The same physical Booth may be reused by different Events when their time ranges do not overlap.

- Release/reassign rules

- Booth cancellation and Partner withdrawal refunds compare request.submittedAt with Event.boothCancellationCutoffAt: on/before cutoff 100%, after cutoff 0%; Event cancellation 100%. Confirmed operations release internal Booth state immediately, create REFUND PENDING from the original SUCCESS payment and let the gateway process it asynchronously.

## Activity

- Activity Proposal with exact time/location

- Organizer approval and separate Publish step

- BTC Activity creation

- Conflict/capacity checking

- Change/reschedule/cancel

- Configurable per-Event activity limit

## QR Participation & Rewards

- Activity QR belongs to Activity; registered Participant self-scans in valid time window to create Attendance = ATTENDED

- BoothAssignment QR is active only while Assignment/Event is active; Participant self-scans to create BoothVisit

- Duplicate Activity/Booth QR scans do not create duplicate Attendance/BoothVisit rewards

- Points from valid BoothVisit

- Badge from cumulative total Points

- Certificate only after Activity COMPLETED, with valid Attendance and certificateAvailable=true

## Communication & Feedback

- In-app notifications sent to User; no NotificationType entity or senderUserId

- General Feedback without login

- Verified Activity Rating for eligible Participants

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

- Payment Gateway credentials and webhook endpoints are backend environment configuration, not an Admin UI or Use Case in MVP.

# 4. Important MVP Boundaries

- Event Registration is not an entrance ticket and has no Event QR.

- Activity Registration is the seat/capacity-controlled registration. Activity QR belongs to the Activity; a registered Participant self-scans it to create Attendance.

- Partner must be APPROVED in an Event before requesting a Booth or submitting an Activity Proposal.

- A physical Booth is not globally ASSIGNED. EventBoothConfig.isEnabled controls whether it is offered in an Event; runtime availability is derived separately from config, Hold, Assignment and allocation time. A config with overlapping Active Hold/Assignment cannot be disabled.

- Activity participation remains free. Booth rental uses real Payment Gateway payment. The Event–Booth price is locked at SELECTED + Hold; each FAILED/attempt TIMEOUT is stored separately and may retry while Hold remains active. Only payment-window/Hold expiry releases the Hold, and Assignment requires backend-verified SUCCESS.

- Heritage is supporting public content, not a separate heritage-management workflow.

- Each Event stores organizerUserId for the responsible Organizer; this is operational responsibility/audit, while the Event remains within Book Street management.

# 5. Out of Scope

- AI chatbot/recommendation

- Paid Activity tickets

- Advanced billing/invoice and advanced partial-refund scenarios; basic Booth Payment + cutoff-based refund are in MVP

- Staff shift management

- Waitlist

- Sponsor management

- Equipment inventory

- Reward redemption/vouchers

- Advanced BI/predictive analytics

- Recurring activity engine

- Legal/digital-signature certificates

- Advanced Map Editor: multiple map versions, upload/delete map, click-to-create Location/Booth, drag/drop positioning.

# 6. MVP Completion Criteria

- Guest browses public information and submits General Feedback without login.

- Participant can Join Event, see My Events, register Activity, self-scan Activity QR for Attendance and BoothAssignment QR for BoothVisit.

- Partner can apply to an Event, be approved, select/request a specific Booth, pay after Organizer selection, receive Assignment after success and submit an Activity Proposal.

- Organizer can manage Event/Location/Booth/Activity and handle change/cancel workflows.

- System enforces capacity, conflict, Event/time Booth availability and access rules while maintaining history.

- BoothVisit produces Point/Badge progression correctly; valid Activity Attendance enables rating, while Certificate additionally requires Activity COMPLETED and certificateAvailable=true.

- Organizer can see basic participation/occupancy reports.
