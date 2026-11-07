**HỆ THỐNG QUẢN LÝ TỔ CHỨC  
SỰ KIỆN ĐƯỜNG SÁCH**

Book Street Event Management System

**VISION & SCOPE**

MVP Baseline v1.3 - 09/10/2026

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Baseline<br />
Tài liệu này chốt hướng sản phẩm và phạm vi MVP: Event, Partner, Booth Request/Selection/Hold/Payment/Assignment, Activity, Participant Registration và các business rules cốt lõi.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 1. Mục đích tài liệu

Tài liệu Vision & Scope xác định vì sao sản phẩm được xây dựng, ai sử dụng, hệ thống giải quyết bài toán nào, phần nào nằm trong MVP và phần nào chủ động loại khỏi MVP. Đây là baseline để team tiếp tục viết Use Case Specification, ERD, SRS và triển khai.

# 2. Bối cảnh sản phẩm

Hệ thống phục vụ một không gian Đường Sách vật lý cố định. Trong cùng không gian này, Ban quản lý có thể tổ chức nhiều Event ở các thời điểm khác nhau. Các Event cùng sử dụng những tài nguyên vật lý chung như Main Stage, Workshop Area, khu vực và Booth; vì vậy hệ thống phải quản lý lịch, xung đột địa điểm và phân bổ Booth một cách tập trung.

- Website công khai cho phép khách xem Event, Activity, Booth, bản đồ và nội dung văn hóa mà không cần đăng nhập.

- Partner/Exhibitor có thể đăng ký tham gia Event, chọn Booth cụ thể trên bản đồ và đề xuất Activity.

- Participant có thể Join Event, đăng ký/hủy Activity, tự quét Activity QR để ghi Attendance, tự quét BoothAssignment QR để ghi BoothVisit, nhận Point/Badge và đánh giá Activity khi có Attendance hợp lệ; Certificate chỉ được cấp sau khi Activity COMPLETED và đủ điều kiện.

- Organizer là tài khoản thuộc Ban quản lý Đường Sách. Event thuộc Đường Sách; Event.organizerUserId xác định Organizer chịu trách nhiệm xử lý và audit, không tạo quyền sở hữu cá nhân.

# 3. Problem Statement 

Việc tổ chức Event tại Đường Sách cần phối hợp nhiều bên: Ban tổ chức, đơn vị tham gia, gian hàng, Activity và người tham dự. Nếu quản lý rời rạc bằng biểu mẫu, bảng tính và trao đổi thủ công, Ban tổ chức dễ gặp vấn đề trùng lịch, khó theo dõi Booth, khó kiểm soát đề xuất Activity, thay đổi/hủy sát giờ và khó tổng hợp dữ liệu tham dự. Đồng thời khách tham quan cần một kênh trực quan để khám phá sự kiện, gian hàng và vị trí trước khi quyết định tham gia.

# 4. Product Vision

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Vision Statement</strong><br />
Xây dựng một nền tảng tập trung cho Đường Sách, giúp Ban tổ chức quản lý Event, Booth, Activity và người tham dự một cách rõ ràng; giúp Partner chủ động đăng ký và phối hợp với Ban tổ chức; đồng thời mang đến cho khách tham quan trải nghiệm khám phá, đăng ký và ghi nhận hành trình tham gia thuận tiện.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 5. Business Objectives

| **ID** | **Business Objective**                                                                                                                                                                                                                                         |
|--------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| BO-01  | Tập trung hóa quản lý Event, lịch, Location, Booth và Activity tại một Đường Sách.                                                                                                                                                                             |
| BO-02  | Cho phép Partner tự phục vụ: đăng ký Event, chọn Booth trên map, gửi Activity Proposal và theo dõi trạng thái.                                                                                                                                                 |
| BO-03  | Giảm thao tác thủ công của Organizer bằng conflict checking, capacity checking, trạng thái và deadline.                                                                                                                                                        |
| BO-04  | Cung cấp public website trực quan để Guest xem Event, Activity, Booth và bản đồ mà không bắt buộc đăng nhập.                                                                                                                                                   |
| BO-05  | Ghi nhận hành trình Participant bằng Activity QR self-scan → Attendance và BoothAssignment QR self-scan → BoothVisit/Point/Badge; ActivityRating yêu cầu Attendance hợp lệ; Certificate còn yêu cầu Activity đã COMPLETED và được cấu hình hỗ trợ Certificate. |
| BO-06  | Xử lý thay đổi/hủy rõ ràng, giữ lịch sử và thông báo đúng đối tượng thay vì xóa dữ liệu.                                                                                                                                                                       |
| BO-07  | Cung cấp báo cáo cơ bản về Partner, Booth occupancy, Activity, registrations, payments và feedback.                                                                                                                                                            |

# 6. Stakeholders và Actors

| **Actor**              | **Hiểu đơn giản**                    | **Trách nhiệm chính**                                                                                                                                                                                  |
|------------------------|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Guest / Public Visitor | Khách chưa đăng nhập                 | Xem nội dung công khai gồm Event, Activity, Booth, Map và Heritage. Có thể gửi General Feedback cho toàn Đường Sách hoặc một Event.                                                                    |
| Participant            | Người dùng đã đăng nhập              | Join/Leave Event, đăng ký/hủy Activity, tự quét Activity/Booth QR, theo dõi Attendance, BoothVisit, rewards và rating.                                                                                 |
| Partner / Exhibitor    | Nhà xuất bản / đơn vị tham gia       | Apply Event, chọn Booth, gửi Booth Request, Activity Proposal và các request thay đổi/hủy.                                                                                                             |
| Event Organizer        | Ban quản lý / Ban tổ chức Đường Sách | Quản lý Event, duyệt request, cấu hình giá Booth, quản lý payment/booth/activity/report.                                                                                                               |
| System Admin           | Quản trị hệ thống                    | Quản lý Account, Role/UserRole, Badge, tổ chức đối tác, nhật ký quản trị và Dashboard toàn hệ thống. Payment Gateway credentials/webhook là backend environment configuration, không phải Admin Use Case; MVP không có module System Settings chung. |

# 7. In Scope - MVP

- Public website: danh sách/chi tiết Event, Activity, Booth, Interactive Map và supporting heritage content.

- Account đăng ký bằng username, full name và password; confirm password không lưu database. Email tùy chọn với PARTICIPANT nhưng phải verified trước khi cấp PARTNER, ORGANIZER hoặc ADMIN. Authorization dùng User/Role/UserRole và không có Permission/RolePermission entity trong MVP.

- Event lifecycle, publish/cancel, configurable registration/proposal/cancellation deadlines.

- Partner Organization profile và Apply to Join Event trước khi Request Booth / Submit Activity Proposal.

- Interactive Booth selection theo Event: Partner chọn Booth cụ thể và gửi BoothRequest mà chưa tạo Hold; nhiều Partner có thể cùng request một Booth. Organizer chọn request rồi hệ thống mới tạo Hold cho bước thanh toán.

- Booth Request, pre-settlement Hold release, manual candidate selection, initial-rental Payment Gateway và Assignment. Booth change/cancellation sau Assignment và refund là Post-MVP.

- Activity Proposal của Partner: exact time + location, review, request change, approve/reject, publish.

- Organizer tạo Activity của BTC trực tiếp.

- Conflict checking theo physical Location + Time, kể cả giữa nhiều Event cùng dùng một địa điểm.

- Participant Event Registration: Join/Leave Event, My Events và Event-level notifications; không giữ chỗ Activity.

- Participant Activity Registration với capacity control, schedule warning và trạng thái đăng ký.

- Booth pricing theo từng cặp Event–Booth qua EventBoothConfig. Organizer selection tạo Hold và khóa giá cho toàn payment window; thanh toán Booth thật qua Payment Gateway và chỉ backend-verified Payment SUCCESS khi Event còn PUBLISHED/ONGOING mới tạo Assignment. Success đến sau COMPLETED/CANCELLED được giữ để đối soát thủ công, không tạo Assignment.

- Activity/Event reschedule/cancellation, notification và lịch sử trạng thái.

- General Feedback chỉ target đúng một trong BOOK_STREET hoặc EVENT. Heritage, Location và Activity không phải GeneralFeedback target. Verified Activity Rating yêu cầu Attendance hợp lệ. Basic analytics và report giữ nguyên phạm vi đã duyệt.

# 8. Out of Scope - MVP

- AI chatbot, AI recommendation và các chức năng AI khác.

- Paid Activity ticket, invoice điện tử chuyên sâu và thanh toán cho Activity.

- Staff scheduling, shift/task assignment và workforce management.

- Waitlist cho Activity đầy chỗ.

- Reward redemption, voucher store và reward marketplace; QR participation, Points, Badge và Certificate cơ bản vẫn thuộc MVP.

- Sponsor management chuyên biệt.

- Inventory/booking thiết bị.

- Digital signature, blockchain và legal verification.

- Recurring activity/session engine phức tạp; mỗi timeslot được mô hình như một Activity riêng.

- Hệ thống quản lý di sản độc lập; Heritage chỉ là supporting public content.

# 9. High-level Functional Modules

| **Module**                 | **Phạm vi**                                                                                                                                                                                                         |
|----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Public Experience          | Browse và search Event, Activity, Booth, Map và Heritage. Public Feedback chỉ áp dụng cho toàn Đường Sách hoặc một Event.                                                                                            |
| Identity & Access          | Username/password authentication, optional email cho Participant, verified email cho role nâng cao, multi-role và ownership/private data.                                                                           |
| Event Management           | Create, publish, configure deadlines/limits, lifecycle, cancel.                                                                                                                                                     |
| Partner Participation      | Organization profile, apply Event, approval and withdrawal khi application còn PENDING.                                                                                                                             |
| Booth Management           | Map selection, competing requests, EventBoothConfig(rentalPrice/isEnabled), derived availability, selection, Hold, payment/retry, Assignment và pre-settlement release/reassign.                                   |
| Activity Management        | Proposal, approval, publish, conflict/capacity check, change/reschedule/cancel.                                                                                                                                     |
| Participant Registration   | Join/Leave Event; register/cancel Activity; capacity, schedule warning và trạng thái.                                                                                                                               |
| Booth Payment              | Giá khóa tại SELECTED + Hold; nhiều initial PAYMENT attempt riêng trong scheduled payment window; backend-verified SUCCESS chỉ tạo Assignment khi Event PUBLISHED/ONGOING. REFUND workflow là Post-MVP.             |
| Notification & Feedback    | In-app notifications, general feedback and verified Activity rating.                                                                                                                                                |
| Analytics                  | Partner/Booth/Activity/registration/payment/cancellation summaries.                                                                                                                                                 |
| QR Participation & Rewards | Activity QR self-scan → Attendance; BoothAssignment QR self-scan → BoothVisit → Point → Badge; ActivityRating cần Attendance hợp lệ; Certificate cần Activity COMPLETED + Attendance hợp lệ + certificateAvailable. |

# 10. Core Business Flows

| **Luồng**                       | **Tóm tắt**                                                                                                                                                                                                                                              |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Flow 1 - Partner tham gia Event | Partner Profile → Apply to Event → Organizer Review → Approved → được phép Request Booth và Submit Activity Proposal.                                                                                                                                    |
| Flow 2 - Booth                  | Partner chọn Booth → BoothRequest PENDING → Organizer chọn winner → SELECTED + Hold; candidate khác vẫn PENDING → retry trước Hold `expiresAt` → SUCCESS khi Event PUBLISHED/ONGOING tạo Assignment và candidate khác NOT_SELECTED; window expiry chỉ release khi không có evidence chưa rõ. |
| Flow 3 - Activity của Partner   | Submit Proposal (time + location) → system validation/conflict check → Organizer Review → Approve → Publish → Participant nhìn thấy/đăng ký.                                                                                                             |
| Flow 4 - Participant            | Browse public → Login → Join Event hoặc auto-create EventRegistration khi đăng ký Activity/scan Booth QR → Register Activity → self-scan Activity QR → Attendance; self-scan BoothAssignment QR → BoothVisit/Point/Badge.                                |
| Flow 5 - Change/Cancel          | Organizer safely updates/cancels an eligible Event; Partner may release an eligible pre-settlement Hold. Activity change/cancellation remains a separate Activity workflow.                                    |

# 11. Assumptions & Constraints

- MVP quản lý một Đường Sách vật lý cố định với nhiều Event theo thời gian.

- Mọi Organizer hợp lệ thuộc Ban quản lý có thể quản lý Event của Đường Sách; createdBy được lưu để trace nhưng không tạo quyền sở hữu riêng.

- Booth là tài nguyên vật lý dùng chung. EventBoothConfig xác định Booth có được mở và có giá bao nhiêu trong từng Event. isEnabled khác availability runtime; AVAILABLE/ON_HOLD/ASSIGNED/UNAVAILABLE được suy ra từ config, Active Hold/Assignment và allocation time.

- Booth Assignment mặc định có hiệu lực trong toàn bộ Event, không chia thuê theo từng ngày.

- Partner phải được approved tham gia Event trước khi đăng ký Booth hoặc gửi Activity Proposal.

- Activity có thể diễn ra ở Booth hoặc Location khác (Main Stage, Workshop Area...).

- Activity miễn phí trong MVP. Mỗi Booth có giá cấu hình riêng trong từng Event qua EventBoothConfig và được thanh toán thật qua Payment Gateway.

- Booth category chỉ dùng để gợi ý hoặc ưu tiên phù hợp, không phải điều kiện cứng để chặn request.

- Business refund, Booth change/cancellation sau Assignment và Partner withdrawal sau approval là Post-MVP. Event có Payment SUCCESS/PENDING, reconciliation conflict hoặc Assignment không được Organizer hủy trong MVP.

- Notification bắt buộc trong MVP là in-app và gửi tới User; không có NotificationType entity hoặc senderUserId. Email là optional.

# 12. Success Criteria

- Organizer tạo/publish một Event và cấu hình deadline, Location, Booth và giới hạn cần thiết.

- Partner apply Event, được duyệt, chọn Booth cụ thể trên Map, gửi request và theo dõi kết quả.

- Partner gửi Activity Proposal với exact time/location; hệ thống phát hiện hard conflict và Organizer review được.

- Guest xem được Event/Activity/Booth/Map và gửi general feedback mà không cần đăng nhập.

- Participant có thể Join Event, đăng ký hoặc hủy Activity trong giới hạn capacity và theo dõi trạng thái.

- Organizer chọn một candidate hợp lệ; candidate đó chuyển SELECTED, được tạo Hold và khóa rentalPrice hiện tại, các candidate khác vẫn PENDING. Mỗi attempt FAILED/TIMEOUT được lưu riêng và chỉ retry trước Hold `expiresAt`; evidence chưa rõ tiếp tục giữ Hold nhưng chặn retry. Payment SUCCESS khi Event PUBLISHED/ONGOING tạo BoothAssignment, hoàn tất winner và chuyển candidate cạnh tranh sang NOT_SELECTED; sau COMPLETED/CANCELLED chỉ giữ evidence để đối soát, không tạo Assignment.

- Change/cancellation không làm mất lịch sử và notification đến đúng đối tượng.

- Dashboard cung cấp số liệu cơ bản về Booth occupancy, Activity, registrations và Booth payments.

# 13. Scope Control & Future Scope

Sau khi baseline này được team/thầy chấp thuận, mọi feature mới phải được đánh giá là thay đổi scope. Waitlist, Staff Scheduling, Reward Store, Sponsor Module và AI vẫn thuộc Future Scope; Booth Payment là một phần của MVP.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Scope Lock</strong><br />
Từ baseline này, team nên ưu tiên hoàn thiện Use Case Specification, ERD, UI/UX và implementation thay vì tiếp tục mở rộng feature.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 14. Glossary ngắn

| **Thuật ngữ**      | **Định nghĩa**                                                                                                                               |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Event              | Một đợt/chương trình sự kiện do Đường Sách tổ chức.                                                                                          |
| Activity           | Một hoạt động cụ thể có thời gian và Location, ví dụ workshop/talkshow/ký tặng.                                                              |
| Booth              | Gian hàng vật lý dùng chung của Đường Sách; không mang trạng thái ASSIGNED toàn cục.                                                         |
| Location           | Địa điểm vật lý chung: Booth, Main Stage, Workshop Area, Reading Area...                                                                     |
| Booth Request      | Yêu cầu Partner gửi để xin một Booth cụ thể.                                                                                                 |
| Activity Proposal  | Đề xuất của Partner; chưa phải Official Activity cho đến khi được Organizer duyệt.                                                           |
| Registration       | Bản ghi Participant đăng ký một Activity; dùng để quản lý capacity và trạng thái.                                                            |
| Booth Payment      | Initial PAYMENT transaction theo giá Event–Booth đã khóa; backend-verified SUCCESS chỉ tạo BoothAssignment khi Event PUBLISHED/ONGOING. REFUND là Post-MVP. |
| Booth Hold         | Giữ tạm Booth sau khi Organizer chọn request; có thời hạn trong bước thanh toán.                                                             |
| Booth Assignment   | Quan hệ xác nhận một Booth được cấp cho một Partner trong một Event/khoảng thời gian cụ thể.                                                 |
| Booth Availability | Runtime state theo Event/time, suy ra từ EventBoothConfig.isEnabled + Active Hold/Assignment: AVAILABLE, ON_HOLD, ASSIGNED hoặc UNAVAILABLE. |
