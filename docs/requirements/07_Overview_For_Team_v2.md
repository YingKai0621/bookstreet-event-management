**OVERVIEW FOR TEAM - v2.1**

What every team member must understand — active MVP updated 09/10/2026

# 1. Hệ thống này là gì?

Đây là hệ thống quản lý nhiều Event diễn ra trong một không gian Đường Sách cố định. Hệ thống vừa có public website cho khách khám phá, vừa có luồng nghiệp vụ cho Partner, Organizer và Participant.

# 2. 5 Actor

| **Actor**   | **Nói ngắn gọn**                                                                                                      |
|-------------|-----------------------------------------------------------------------------------------------------------------------|
| Guest       | Xem toàn bộ public information và gửi general feedback.                                                               |
| Participant | Join Event, đăng ký Activity, tự quét Activity/Booth QR, Attendance, BoothVisit và rewards.                           |
| Partner     | Apply Event, request Booth, thanh toán/settlement Booth và đề xuất Activity.                                          |
| Organizer   | Quản lý Event và duyệt/vận hành nghiệp vụ.                                                                            |
| Admin       | Account, Role/UserRole, Badge, tổ chức đối tác, nhật ký quản trị và Dashboard toàn hệ thống; không có Permission model hoặc System Settings module riêng trong MVP. |

# 3. Những khái niệm không được nhầm

| **Khái niệm**                | **Hiểu đúng**                                                                                                                                                                                    |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Event Registration           | Participant đánh dấu sẽ tham gia/quan tâm Event; tạo My Events và nhận thông báo chung.                                                                                                          |
| Activity Registration        | Giữ chỗ cho một Activity cụ thể; có capacity. QR thuộc Activity và Participant tự quét khi đến tham dự.                                                                                          |
| Booth                        | Tài nguyên vật lý dùng chung. EventBoothConfig.isEnabled quyết định Booth có mở trong Event; AVAILABLE/ON_HOLD/ASSIGNED/UNAVAILABLE là runtime state suy ra từ config, Hold, Assignment và time. |
| Activity                     | Chương trình diễn ra tại một Location và một khoảng thời gian.                                                                                                                                   |
| Activity Proposal            | Đề xuất của Partner; chưa phải Activity chính thức cho tới khi Organizer duyệt.                                                                                                                  |
| Location                     | Khái niệm chung: Booth, Main Stage, Workshop Area...                                                                                                                                             |
| Attendance                   | Xác nhận Participant thực sự tham dự Activity; tạo khi Participant có registration hợp lệ và tự quét Activity QR trong time window.                                                              |
| Points / Badge / Certificate | Points/Badge đến từ BoothVisit hợp lệ; Certificate chỉ cấp sau Activity COMPLETED khi có Attendance hợp lệ và Activity hỗ trợ Certificate.                                                       |
| Booth Hold                   | Giữ tạm Booth sau khi Organizer chọn request, trong lúc chờ Payment/settlement; có thể hết hạn.                                                                                                  |
| Booth Assignment             | Booth được cấp cho Partner sau Payment success trong một Event/khoảng thời gian cụ thể.                                                                                                          |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Event Registration vs Activity Registration</strong><br />
Join Event không giữ chỗ Activity và không cấp Event QR. Nếu user đăng ký Activity mà chưa Join Event, hệ thống tự tạo Event Registration. User vẫn được xem Event/Activity/Booth/Map khi chưa login.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 4. Core Flows

- Guest → Explore Book Street / Submit General Feedback → Login khi cần chức năng cá nhân.

- Participant → Join Event → My Events / Event notifications.

- Participant → Register Activity → tự quét Activity QR trong time window → Attendance = ATTENDED; sau khi Activity COMPLETED mới xét Certificate. Khi ghé Booth, Participant tự quét QR của BoothAssignment → BoothVisit → Point → Badge.

- Partner → Apply Event → Approved → BoothRequest PENDING → Organizer Selection → SELECTED + BoothHold + khóa rentalPrice → payment/retry theo giá đã khóa → SUCCESS khi Event PUBLISHED/ONGOING tạo BoothAssignment; candidate khác NOT_SELECTED. FAILED/attempt TIMEOUT chỉ retry khi payment window còn mở. Evidence chưa rõ có thể giữ Hold sang ONGOING mà không dừng Event; success sau COMPLETED/CANCELLED chỉ được giữ để đối soát và không tạo Assignment.

- Partner approved → Activity Proposal PENDING (không giữ slot) → Organizer recheck và approve
  atomically → Activity DRAFT (giữ slot) → Publish.

- Change/Cancel → impact check → update status → notify affected users.

# 5. Rules bắt buộc phải nhớ

- Public information không yêu cầu account hoặc Event Registration.

- Partner phải được duyệt vào Event trước khi request Booth/propose Activity.

- Partner chọn Booth cụ thể; nhiều BoothRequest có thể cạnh tranh nếu cùng Booth và thời gian allocation overlap. Booth.categoryCode chỉ recommend/filter/priority/warn. Organizer chọn winner; candidate khác giữ PENDING cho đến khi Assignment được tạo rồi mới NOT_SELECTED.

- EventBoothConfig lưu rentalPrice và isEnabled cho từng Event–Booth. isEnabled chỉ cho biết Booth có được mở trong Event; không được disable khi có Active Hold/Assignment overlap. Organizer selection snapshot rentalPrice vào Hold. FAILED/attempt TIMEOUT chỉ retry trước Hold `expiresAt`; evidence chưa rõ giữ Hold nhưng chặn retry. SUCCESS chỉ tạo Assignment khi Event PUBLISHED/ONGOING.

- Activity có exact time + Location; same physical Location + overlapping time bị system block.

- Participant được đăng ký Activity trùng giờ; mỗi ActivityRegistration chỉ có tối đa một Attendance và scan QR lặp không tạo Attendance trùng.

- Booth release không đồng nghĩa xóa Booth. MVP cho Partner withdraw SELECTED request và release Hold khi chưa có Payment/Assignment blocker. Sau Assignment không đổi/hủy Booth và không business refund.

- Activity đã publish đổi time/location phải notify Participant và cho phép họ cancel. BoothCancellationRequest, PartnerWithdrawalRequest sau approval và refund theo cutoff là Post-MVP reference.

- Points đến từ BoothVisit hợp lệ; Badge dựa trên total Points. Certificate chỉ cấp sau Activity COMPLETED nếu Attendance hợp lệ và Activity hỗ trợ Certificate; Booth QR và Activity QR là hai flow khác nhau.

- General Feedback không yêu cầu đăng nhập; Activity Rating chỉ dành cho Participant đủ điều kiện.

- Dữ liệu nghiệp vụ đã phát sinh không hard-delete; giữ status/history.

- Mỗi Event có organizerUserId xác định Organizer chịu trách nhiệm; request hủy/rút lưu handledAt, kết quả/review note nhưng không lưu handledByUserId.

- GeneralFeedback chỉ target đúng một trong BOOK_STREET hoặc EVENT. Heritage, Location và Activity không phải GeneralFeedback target. Notification là in-app gửi tới User, không có NotificationType entity hoặc senderUserId.

- Đăng ký dùng username, full name và password; confirm password không lưu database. Email tùy chọn với PARTICIPANT nhưng phải verified trước khi cấp PARTNER, ORGANIZER hoặc ADMIN. Authorization dùng User/Role/UserRole và chỉ có 5 actor: Guest, Participant, Partner, Organizer, Admin.

# 6. MVP không làm

- Booth change hoặc cancellation sau Assignment

- Partner withdrawal sau khi application đã APPROVED

- Business refund và Event cancellation sau settlement

- AI

- Paid Activity tickets (Booth Payment Gateway nằm trong MVP)

- Staff scheduling

- Waitlist

- Sponsor module

- Asset inventory

- Voucher store

- Advanced analytics

- Advanced Map Editor (multi-map, click-to-create, drag/drop) — Future/Stretch Scope.
