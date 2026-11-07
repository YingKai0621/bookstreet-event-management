**SWP391**

**DEMO WORKFLOW & AI CONTEXT**

**Book Street Event Management System**

Báo cáo baseline dành cho teammate, AI assistant và chuẩn bị demo hội đồng

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Mục tiêu tài liệu</strong></p>
<p>Chốt cách hiểu môn SWP391 theo syllabus, chuyển yêu cầu môn học thành các workflow cụ thể của dự án Đường Sách, xác định luồng demo hội đồng quan trọng, exception path, bằng chứng kỹ thuật cần chuẩn bị và một khối context ổn định để AI sử dụng về sau.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Nguồn chính: Detail Syllabus SWP391 — Syllabus ID 14177**

*Baseline nội bộ • dùng để thống nhất team • không thay thế SRS/Use Case Specification chính thức*

# 1. Điều quan trọng nhất từ syllabus SWP391

SWP391 không chỉ chấm một website chạy được. Môn học yêu cầu team đi xuyên suốt SDLC: requirement → design → database → implementation → testing → deployment → reporting, đồng thời phải chứng minh việc sử dụng AI có trách nhiệm trong nhiều giai đoạn.

| **Hạng mục**              | **Điều syllabus nhấn mạnh**                                       | **Ý nghĩa với team**                                                                                 |
|---------------------------|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| **Requirement & Design**  | SRS, user requirements, ERD, architecture, UI workflow.           | Requirement phải nhất quán với code; không được để tài liệu nói một kiểu và implementation một kiểu. |
| **Implementation**        | Web app theo MVC/OOP, workflow development, database integration. | Phải có luồng nghiệp vụ end-to-end, không chỉ CRUD từng màn hình.                                    |
| **Database**              | ERD, relational DB, SQL, PK/FK, constraints, normalized tables.   | Business rule quan trọng phải được thể hiện trong model/constraint/transaction phù hợp.              |
| **Testing**               | Unit/integration/UAT; AI hỗ trợ tạo và refine test cases.         | Main flow và exception flow phải có test evidence.                                                   |
| **Dashboard & Reporting** | Workflow riêng trong syllabus.                                    | Dashboard phải lấy dữ liệu thật từ các transaction đã demo.                                          |
| **AI Usage**              | AI được tích hợp xuyên SDLC; phải minh bạch và validate output.   | Lưu AI logs, nêu AI giúp gì và team đã kiểm chứng ra sao.                                            |

## 1.1 Các mốc/rubric cần nhớ

| **Mốc**                | **Trọng số** | **Điểm cần đạt/chuẩn bị**                                                                                                                                 |
|------------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Milestone 1**        | 15%          | Requirement Analysis & Design: SRS ≥15 trang, ≥12 user stories, ERD ≥8 entities, state diagram, architecture, UI nhất quán, AI logs/weekly reports.       |
| **Milestone 2**        | 20%          | Workflow 0 + Workflow 1 + Workflow 2; Workflow 2 có main flow và ≥2 exception paths; multi-layer/MVC; DB ≥10 tables, PK/FK đầy đủ; commit/debug evidence. |
| **Milestone 3**        | 25%          | Tích hợp đủ data setup + core workflow + dashboard; ≥25 test cases, ≥80% passed; UI/UX hoàn thiện; AI/testing evidence.                                   |
| **Final Presentation** | 40%          | 60 phút/group; Requirement 20%, Design 20%, Implementation 40%, AI Usage & Professionalism 20%.                                                           |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Câu chốt cho team</strong></p>
<p>Đừng phát triển theo danh sách màn hình. Hãy phát triển theo WORKFLOW có dữ liệu đi xuyên qua nhiều actor, nhiều bảng và nhiều layer. Một workflow tốt phải có success path, exception path, trạng thái và bằng chứng kiểm thử.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 2. Mapping syllabus → dự án Đường Sách

| **Workflow theo syllabus**              | **Áp dụng vào Book Street Event Management System**                                                                                                                                          | **Vai trò khi demo**                                    |
|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------|
| **Workflow 0 — Basic Web Security**     | Register bằng username/full name/password, Login, Logout và Forgot/Reset Password; email tùy chọn cho PARTICIPANT nhưng verified email bắt buộc trước khi cấp PARTNER, ORGANIZER hoặc ADMIN. | Mở đầu ngắn; chứng minh authentication + authorization. |
| **Workflow 1 — Data Initiation / CRUD** | Event setup, Location/Booth master data và Account/Role/Badge administration.                                                                                                                | Tạo dữ liệu nền để core transaction có thể chạy.        |
| **Workflow 2 — Core Transaction**       | Partner tham gia Event → Booth/Activity → Participant Registration → Booth QR Visit + Activity QR Attendance → Reward/Certificate.                                                           | HERO FLOW; phần demo quan trọng nhất.                   |
| **Workflow 3 — Dashboard & Reporting**  | Booth occupancy, Partner/Activity/Registration/Attendance/No-show/Feedback metrics.                                                                                                          | Kết demo; chứng minh dữ liệu end-to-end được tổng hợp.  |

## 2.1 Nguyên tắc ưu tiên phát triển

- Ưu tiên luồng xuyên actor và có transaction thật hơn là làm nhiều trang đẹp nhưng rời rạc.

- Mọi màn hình quan trọng phải nối được với database và business rules tương ứng.

- Các trạng thái như PENDING, APPROVED, EXPIRED, ASSIGNED, CANCELLED phải có chuyển trạng thái rõ ràng.

- Exception path phải code thật, không chỉ ghi trong tài liệu.

- Dashboard phải dùng dữ liệu sinh ra từ workflow; không hard-code KPI để demo.

# 3. Hero Demo Flow — luồng xương sống của hệ thống

Đây là luồng nên được coi là “câu chuyện chính” khi demo hội đồng. Nó cho thấy integration giữa Organizer, Partner, Guest/Participant, Booth, Activity, Booth QR Visit, Activity QR Attendance và Rewards.

| **1. Organizer tạo Event, cấu hình thời gian/deadline/Location/Booth và Publish.** |
|------------------------------------------------------------------------------------|

**↓**

| **2. Partner đăng nhập và Apply to Event.** |
|---------------------------------------------|

**↓**

| **3. Organizer Review Partner Application và Approve.** |
|---------------------------------------------------------|

**↓**

| **4. Partner mở Booth Map, chọn Booth A05 và gửi BoothRequest. Request chưa tạo Hold; Partner khác vẫn có thể request A05.** |
|------------------------------------------------------------------------------------------------------------------------------|

**↓**

| 5\. Organizer chọn một candidate → winner SELECTED + BoothHold và khóa rentalPrice hiện tại; candidate khác vẫn PENDING. FAILED/attempt TIMEOUT được lưu riêng và Partner chỉ retry trước Hold `expiresAt`. SUCCESS khi Event PUBLISHED/ONGOING → winner COMPLETED + BoothAssignment + candidate khác NOT_SELECTED; evidence chưa rõ giữ Hold nhưng chặn retry/reassign. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**↓**

| **6. Partner Submit Activity Proposal PENDING (title, type, exact time, Location, capacity); Proposal chưa giữ slot.** |
|----------------------------------------------------------------------------------------|

**↓**

| **7. Organizer recheck conflict/quota/ownership, atomically Approve thành Activity DRAFT, cấu hình rồi Publish.** |
|------------------------------------------------------------------------------------------------|

**↓**

| **8. Guest nhìn thấy Event/Activity trên public website; khi muốn đăng ký thì Sign In.** |
|------------------------------------------------------------------------------------------|

**↓**

| **9. Participant Register Activity; hệ thống kiểm tra deadline + capacity và tạo ActivityRegistration. Nếu chưa có EventRegistration thì hệ thống auto-create.** |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**↓**

| **10. Participant ghé Booth đang được assign, tự quét QR của BoothAssignment → hệ thống tạo BoothVisit và cộng Point tối đa một lần cho lượt ghé hợp lệ.** |
|------------------------------------------------------------------------------------------------------------------------------------------------------------|

**↓**

| **11. Tại Activity, Participant đã đăng ký tự quét Activity QR trong time window hợp lệ → Attendance = ATTENDED.** |
|--------------------------------------------------------------------------------------------------------------------|

**↓**

| 12\. Hệ thống kiểm tra total Points để unlock Badge. Attendance hợp lệ là căn cứ cho ActivityRating; Certificate chỉ được cấp sau khi Activity chuyển COMPLETED và certificateAvailable=true. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

**↓**

| **13. Organizer mở Dashboard/Report và thấy BoothVisit, Point/Badge, registrations, Attendance/no-show và các số liệu Event được cập nhật.** |
|----------------------------------------------------------------------------------------------------------------------------------------------|

## 3.1 Vì sao luồng này phù hợp SWP391

| **Khía cạnh**      | **Hero flow chứng minh được**                                                                                                                         |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Requirement**    | Các rule Apply Event, competing Booth Requests, Organizer Selection, Hold, Payment, Activity approval, capacity, attendance và rewards đều chạy thật. |
| **Design**         | Nhiều module và entity phối hợp; dễ map sang ERD, state diagram và MVC layers.                                                                        |
| **Database**       | Có transaction/relationship giữa Event, Partner, Booth, Activity, Registration, Attendance, Reward.                                                   |
| **Implementation** | Có CRUD + approval workflow + validation + QR + state transitions.                                                                                    |
| **Testing**        | Có nhiều success/exception path rõ ràng để viết integration test.                                                                                     |
| **Reporting**      | KPI cuối flow lấy trực tiếp từ transaction vừa tạo.                                                                                                   |

# 4. Exception Paths — bắt buộc chuẩn bị

Milestone 2 yêu cầu core transaction có ít nhất 2 exception paths. Team nên code tối thiểu 3–4 case để vừa đáp ứng rubric vừa có phương án dự phòng khi demo.

| **Ưu tiên** | **Exception**                                    | **Expected behavior**                                                                                                                                                                                                                                                | **Giá trị khi demo**                                        |
|-------------|--------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| **P1**      | Hai Partner chọn cùng Booth A05                  | Attempt FAILED hoặc attempt TIMEOUT được lưu thành record riêng và chỉ retry trước Hold `expiresAt`; attempt TIMEOUT không đồng nghĩa payment window hết hạn. Evidence chưa rõ giữ Hold và chặn candidate khác; terminal evidence cho phép expiry flow kết thúc winner. | Chứng minh mô hình nhiều candidate và Organizer selection.  |
| **P1**      | Payment attempt fail hoặc payment window hết hạn | Attempt FAILED được lưu và chỉ retry khi payment window còn mở. Khi window hết hạn và không có evidence chưa rõ: winner PAYMENT_EXPIRED, release Hold, không tạo Assignment; candidate khác vẫn PENDING.                                                               | Chứng minh state machine, payment exception và consistency. |
| **P1**      | Activity conflict                                | Nếu same physical Location + time overlap với Activity đã lock slot → block/không cho approve.                                                                                                                                                                       | Chứng minh business rule không tầm thường.                  |
| **P2**      | Activity full                                    | Capacity đã đạt giới hạn → registration mới bị từ chối atomically.                                                                                                                                                                                                   | Chứng minh capacity control/concurrency.                    |
| **P2**      | Late cancellation                                | Partner gửi cancellation sau cutoff → LATE_CANCELLATION; Organizer xử lý/confirm, không auto-cancel.                                                                                                                                                                 | Chứng minh deadline + approval + history.                   |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Khuyến nghị demo<br />
Trong thời gian ngắn live-demo: (1) nhiều candidate cùng Booth, khóa giá khi SELECTED + Hold; (2) attempt FAILED/TIMEOUT nhưng retry thành công, hoặc payment-window expiry làm release Hold; (3) Partner chủ động release một SELECTED Hold đủ điều kiện trước settlement; (4) Organizer hủy Event chưa có financial blocker. Activity conflict là exception dự phòng.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 5. QR Participation — flow đã chốt

Có hai QR flow tách biệt. Activity QR thuộc Activity: Participant có ActivityRegistration hợp lệ tự quét trong time window để tạo Attendance = ATTENDED. Booth QR thuộc BoothAssignment đang active: Participant tự quét khi ghé Booth để tạo BoothVisit; QR hết hiệu lực khi Assignment/Event kết thúc.

| **Trường hợp**         | **Người quét**                         | **Luồng**                                                                                                                                            |
|------------------------|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Activity QR**        | Participant                            | Tự scan Activity QR → validate ActivityRegistration + time window → Attendance = ATTENDED.                                                           |
| **BoothAssignment QR** | Participant                            | Tự scan Booth QR → validate active Assignment/Event → BoothVisit → Point tối đa một lần cho lượt ghé hợp lệ.                                         |
| **Sửa Attendance**     | Organizer có quyền correction/override | Chỉ correction/override khi cần; lưu thời điểm, lý do và audit theo phiên Organizer. Không có Attendance Operator hoặc handledByUserId trên request. |

## 5.1 Validation cần chạy khi Participant tự scan

- Activity QR có map đúng Activity không, và Participant có ActivityRegistration active cho Activity đó không?

- Activity QR có nằm trong time window hợp lệ và Activity còn hiệu lực không?

- ActivityRegistration/Activity có bị CANCELLED không?

- Booth QR có map tới BoothAssignment đang ACTIVE trong Event hiện tại không?

- Participant đã có BoothVisit được tính thưởng cho EventRegistration + BoothAssignment này chưa?

- Scan lặp có tạo duplicate Attendance, BoothVisit, Point hoặc Certificate không? Kết quả phải idempotent theo rule.

# 6. Ưu tiên demo: Must-have vs Backup

| **Nhóm**      | **Chức năng**                                                            | **Cách dùng trong demo**                                                               |
|---------------|--------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| **MUST-HAVE** | Authentication + role access                                             | Demo rất ngắn nhưng phải chạy thật.                                                    |
| **MUST-HAVE** | Event publish + Partner application approval                             | Mở đầu cho core workflow.                                                              |
| **MUST-HAVE** | Booth Map + competing Requests + Selection + Hold + Payment + Assignment | Feature trực quan, có business logic và exception mạnh.                                |
| **MUST-HAVE** | Activity Proposal + conflict check + Publish                             | Chứng minh workflow và rule theo Location/Time.                                        |
| **MUST-HAVE** | Activity Registration + Activity QR Attendance                           | Core participant transaction: registration → self-scan Activity QR → Attendance.       |
| **MUST-HAVE** | Booth QR + Points/Badge + Certificate                                    | Booth QR tạo BoothVisit/Point/Badge; Activity Attendance đủ điều kiện tạo Certificate. |
| **MUST-HAVE** | Dashboard/Reporting                                                      | Kết demo bằng dữ liệu thật.                                                            |
| **BACKUP**    | Cancellation/change/reschedule                                           | Chuẩn bị nếu hội đồng hỏi exception/edge case.                                         |
| **BACKUP**    | Feedback / Activity Rating                                               | Có thể show nhanh, không chiếm thời gian hero flow.                                    |
| **BACKUP**    | Heritage/Public Content                                                  | Hỗ trợ trải nghiệm public, không phải core transaction.                                |
| **BACKUP**    | Admin settings                                                           | Chứng minh account, role và Badge administration khi được hỏi.                         |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Scope control</strong></p>
<p>Đừng để Heritage, Feedback, profile/settings hoặc trang phụ chiếm thời gian phát triển trong khi Booth/Activity/Registration/Attendance chưa end-to-end. Theo rubric, integration và workflow hoàn chỉnh quan trọng hơn số lượng màn hình.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 7. Bằng chứng kỹ thuật phải chuẩn bị cùng demo

| **Evidence**               | **Team cần có**                                                                                                               |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| **Architecture**           | Diagram MVC/multi-layer; Controller → Service → Repository → Database; giải thích responsibilities.                           |
| **Database**               | ERD logical/physical; ≥10 tables theo rubric M2; PK/FK/unique/check/index/constraint phù hợp; sample data.                    |
| **State & Business Rules** | Event lifecycle; Booth Request/Selection/Hold/Payment/Assignment; Activity Proposal/Activity; Registration/Attendance states. |
| **Git/Process**            | Commit history theo member, task board, weekly/milestone report, AI debugging logs.                                           |
| **Testing**                | ≥25 test cases ở M3; ≥80% pass; có manual + AI-assisted; tập trung core + exception.                                          |
| **Deployment**             | Staging/deployed URL, seed data, account demo và backup plan nếu internet lỗi.                                                |
| **AI Evidence**            | Prompt/log tiêu biểu cho requirement refinement, ERD validation, code/debugging, test generation; kèm cách team validate.     |

# 8. Kịch bản demo khuyến nghị

## 8.1 Demo core 10–15 phút

| **Phút**  | **Role**            | **Thao tác chính**                                                                        |
|-----------|---------------------|-------------------------------------------------------------------------------------------|
| **0–1**   | Guest               | Show public Event; nói ngắn về problem và system boundary.                                |
| **1–2**   | Organizer           | Show Event đã setup/published; highlight Location/Booth/deadline.                         |
| **2–4**   | Partner             | Apply Event (hoặc dùng application pending sẵn) → Organizer approve.                      |
| **4–6**   | Partner + Organizer | Select Booth A05 → Request (no Hold) → Organizer Selection → Hold → Payment → Assignment. |
| **6–8**   | Partner + Organizer | Submit Activity Proposal → conflict validation → approve + publish.                       |
| **8–10**  | Participant         | Register Activity; hệ thống tạo/kiểm tra EventRegistration và ActivityRegistration.       |
| **10–12** | Participant         | Scan BoothAssignment QR → BoothVisit + Point; scan Activity QR → Attendance = ATTENDED.   |
| **12–13** | Participant         | Show Badge progress/unlock và Certificate của Activity nếu đủ điều kiện.                  |
| **13–15** | Organizer           | Dashboard/report; show 1 exception path hoặc test evidence.                               |

## 8.2 Chuẩn bị dữ liệu để demo không bị chờ

- Tạo trước 1 Event đã PUBLISHED với Location, Booth map và deadline hợp lệ.

- Có ít nhất 2 Partner account và 2 Participant account.

- Có sẵn 1 Partner APPROVED để demo Booth nhanh; giữ 1 Partner PENDING để show approval nếu cần.

- Có 1 Activity slot cố tình conflict để demo exception.

- Có 1 selected BoothRequest với Hold/payment sắp timeout hoặc utility/admin action để simulate timeout an toàn.

- Có 1 Participant gần đạt Badge threshold để scan Booth QR xong thấy Point/Badge ngay.

- Có 1 Certificate-enabled Activity ở trạng thái COMPLETED để chứng minh Attendance hợp lệ mới phát hành Certificate; không cấp ngay khi Activity còn đang diễn ra.

- Chuẩn bị account credentials và browser tabs theo role; tránh logout/login quá nhiều.

# 9. AI Context Baseline — copy cho AI khi làm task mới

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Mục đích</strong></p>
<p>Phần này là context cô đọng. Khi dùng ChatGPT/Codex/AI khác cho requirement, ERD, code, test hoặc UI, hãy đưa phần này trước để AI không tự mở rộng scope hoặc hiểu sai domain.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Key**                  | **Baseline context**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **System**               | Book Street Event Management System for ONE fixed physical Book Street. Multiple Events happen over time and share physical Locations/Booths.                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Core actors**          | Guest, Participant, Partner/Exhibitor, Event Organizer, System Admin. Do not add Staff as a core actor in MVP.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Event ownership**      | Event remains within Book Street management; Event.organizerUserId identifies the responsible Organizer for processing and audit.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Partner gate**         | Partner must be approved to join an Event before Request Booth or Submit Activity Proposal.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Booth model**          | Physical Booth is shared. EventBoothConfig.isEnabled controls whether the Booth is offered in an Event; AVAILABLE/ON_HOLD/ASSIGNED/UNAVAILABLE is derived from config, active Hold/Assignment and allocation time.                                                                                                                                                                                                                                                                                                                                   |
| **Booth flow**           | Request without Hold/price lock → Organizer selects → winner SELECTED + Hold + lockedRentalPrice, others PENDING → separate FAILED/TIMEOUT attempts may retry while payment window is open → verified SUCCESS creates Assignment and marks competing candidates NOT_SELECTED only while Event is PUBLISHED/ONGOING.                                                                                                                                                                                                                              |
| **Booth expiration**     | A FAILED or attempt TIMEOUT does not end the request while payment window is open. Unresolved evidence may keep Hold ACTIVE into ONGOING without pausing Event lifecycle. Trusted terminal failure/timeout lets expiry close the request; success after COMPLETED/CANCELLED is retained for reconciliation and creates no Assignment.                                                                                                                                                                                                          |
| **Booth concurrency**    | Create Hold only after Organizer selection; confirm Assignment only after successful payment. No two valid holds/assignments may conflict on same Booth for overlapping time.                                                                                                                                                                                                                                                                                                                                                                        |
| **Activity model**       | Activity is a program; Location is where it happens. Activity may be at a Partner Booth, Main Stage, Workshop Area, etc. Partner does not need a Booth to propose an Activity.                                                                                                                                                                                                                                                                                                                                                                       |
| **Activity proposal**    | Create submits immediately as PENDING with no slot lock. Organizer may request changes/reject or atomically approve into exactly one DRAFT Activity; approval and publication are separate. Direct BTC Activity uses shared non-Booth Location in Sprint 5.                                                                                                                                                                                                                                                                                           |
| **Activity conflict**    | Hard block every non-cancelled official Activity, including DRAFT, at the same physical Location with half-open overlapping time across Events. PostgreSQL exclusion constraint is the final race guard; adjacent intervals are valid.                                                                                                                                                                                                                                                                                                                |
| **Participant**          | Participant can Join Event for My Events/notifications and separately Register Activity for a capacity-controlled slot. If needed, EventRegistration may auto-create when registering an Activity or scanning a valid BoothAssignment QR.                                                                                                                                                                                                                                                                                                            |
| **QR attendance**        | Two QR flows: Activity QR belongs to Activity; a registered Participant self-scans in the valid time window to create Attendance = ATTENDED. Booth QR belongs to an active BoothAssignment; Participant self-scans when visiting to create BoothVisit. No Attendance Operator scanning in MVP.                                                                                                                                                                                                                                                       |
| **Attendance**           | Each ActivityRegistration has at most one Attendance. MVP does not require check-in + check-out or attendance duration. Duplicate Activity QR scans must not create duplicate Attendance, Certificate or ActivityRating.                                                                                                                                                                                                                                                                                                                             |
| **Rewards**              | Points come from valid BoothVisit and accumulate across Events. Badge is unlocked by total Points threshold. Certificate requires Activity COMPLETED + valid Attendance + certificateAvailable; ActivityRating requires valid Attendance.                                                                                                                                                                                                                                                                                                            |
| **Cancellation**         | Partner may release an eligible PENDING/SELECTED BoothRequest before settlement. Organizer may cancel only a PUBLISHED Event with no Payment PENDING/SUCCESS, reconciliation-required evidence or Assignment; open Booth requests are cancelled and Active Holds released atomically. Post-assignment cancellation/refund is Post-MVP. |
| **MVP scope lock**       | Initial Booth Payment Gateway is in MVP. Cutoff-based refund, Booth change/cancellation after Assignment, whole-Event Partner withdrawal after approval, paid Activity tickets, waitlist, staff scheduling, asset inventory, sponsor module, reward store, AI recommendation/chatbot, advanced BI, legal digital-signature certificate and advanced Map Editor remain out of scope. |
| **Demo priority**        | Build end-to-end workflow first: Event → Partner → Booth/Activity → Participant Registration → Booth QR Visit + Activity QR Attendance → Points/Badge/Certificate → Dashboard. Public/Heritage/Feedback/Admin extras are secondary.                                                                                                                                                                                                                                                                                                                  |
| **SWP391 expectation**   | Workflow 0 security, Workflow 1 CRUD/data setup, Workflow 2 core success + ≥2 exceptions, Workflow 3 dashboard/reporting; MVC/multi-layer, relational DB, testing and AI evidence.                                                                                                                                                                                                                                                                                                                                                                   |
| Authorization            | Use User/Role/UserRole only. Registration uses case-insensitive unique username, full name and password; confirm password is never persisted. Email is optional for PARTICIPANT, while PARTNER, ORGANIZER and ADMIN require verified email. Do not add Permission/RolePermission or generic SystemSetting entities.                                                                                                                                                                                                                                  |
| Feedback & notification  | GeneralFeedback targets exactly one of BOOK_STREET or EVENT. It does not target Heritage, Location or Activity. Notification is sent to User. There is no NotificationType entity or senderUserId.                                                                                                                                                                                                                                                                                                                                                       |
| Request handlers         | Active Booth flow uses BoothRequest only; PartnerWithdrawalRequest and BoothCancellationRequest are Post-MVP. Sprint 5 implements Activity Change/Cancellation requests with one PENDING request total per Activity; submit cancellation does not cancel until Organizer approve. |
| Booth pricing            | EventBoothConfig is official Logical/Physical, unique per Event–Booth. Selection snapshots rentalPrice into BoothHold.lockedRentalPrice; config changes affect only new selections. Active MVP uses initial PAYMENT only. |
| Gateway configuration    | Credentials, merchant secret and webhook endpoints are backend environment configuration, not an Admin Use Case/UI.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Payment demo / production | The primary MVP demo uses a real Payment Gateway sandbox API and shows PENDING → SUCCESS/FAILED/TIMEOUT with a provider reference. A callback simulator is allowed only for automated/integration testing or as a clearly labelled offline backup when the sandbox is unavailable; it does not replace the MVP gateway integration and must never be used in production. Business-refund API calls are Post-MVP. |

## 9.1 Instruction cho AI

- Use this document as the current team baseline. Do not invent features, actors, states or payment/legal flows outside it.

- When a request conflicts with the baseline, flag the conflict before changing requirements.

- Keep terminology consistent: Event, Activity, Location, Booth, Booth Request, Booth Hold, Booth Payment, Booth Assignment, Activity Proposal, Activity Registration, Attendance.

- For implementation advice, always connect UI → Controller → Service/business rule → Repository/DB → state update → notification/report impact where relevant.

- For test design, include both success path and exception/concurrency/deadline cases.

- Prefer simple MVP-safe implementation over adding a new module unless the requirement explicitly needs it.

# 10. Team Action Checklist

| **Trước khi code sâu**                                                            | **Trước Milestone 2**                                                                                     | **Trước Milestone 3 / Final**                                                                          |
|-----------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Chốt Use Case + Business Rules + ERD; xác định state transitions; seed data plan. | Hoàn thành Workflow 0/1/2; ≥2 exception path; MVC/multi-layer; DB ≥10 tables; integration test core flow. | Tích hợp Workflow 3; ≥25 tests, ≥80% pass; UAT; deployment; AI logs; demo script; backup data/account. |
| Trace mỗi UC chính sang entity/table/service/controller.                          | Test Booth concurrency, Hold expiry, Activity conflict/capacity.                                          | Rehearse end-to-end story; mỗi member hiểu phần mình và hiểu system boundary.                          |
| Không mở scope mới nếu chưa ổn core flow.                                         | Commit đều theo member và lưu debugging evidence.                                                         | Chuẩn bị Q&A: vì sao chọn model Booth/Activity/QR, cách chống conflict, cách dùng AI có trách nhiệm.   |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Final takeaway</strong></p>
<p>Team nên dùng một câu chuyện end-to-end làm trục phát triển và demo: Organizer tạo Event → Partner được duyệt → chọn Booth → đề xuất Activity → Participant đăng ký → Booth QR Visit + Activity QR Attendance → Points/Badge/Certificate → Report. Mọi feature khác phải hỗ trợ hoặc bảo vệ chuỗi này, không làm loãng nó.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

*Internal team baseline • Prepared from SWP391 Detail Syllabus (ID 14177) and current project requirements*
