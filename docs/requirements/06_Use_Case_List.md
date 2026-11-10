**USE CASE LIST - COMPACT v7**

Active MVP baseline updated 03/11/2026 for Sprint 10 role-scoped Notification delivery;
Post-MVP references are listed separately

System Admin amendment active 07/11/2026 for Sprint 11: UC-A04 and UC-A05 are active.

Booth Payment history amendment active 10/11/2026 for Sprint 11: UC-O08 includes the Organizer Payment history
under BR-121. The total stays 28.

# 1. Quy tắc đặt tên Use Case

- Tên bắt đầu bằng động từ: Explore, Manage, Apply, Review, Process, View, Submit.

- Mỗi tên mô tả một goal có ý nghĩa của Actor, không phải từng nút bấm.

- Ưu tiên 2-5 từ; tránh vượt quá 6 từ.

- Không đưa deadline, status, conflict, capacity hay business rule vào tên Use Case.

- Dùng umbrella Use Case để gom các thao tác cùng mục tiêu và giữ diagram gọn.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Điều chỉnh quan trọng<br />
Guest được gom thành một Use Case public chính: Explore Book Street. Participant vẫn có 4 goal lớn; Join/Leave thuộc Manage Event Participation, giữ chỗ thuộc Manage Activity Registrations, còn Attendance, lịch sử tham gia, Certificate và thông báo liên quan thuộc Track Participation. Auto-join EventRegistration, No-show, Certificate processor, Notification delivery và Attendance correction là flow/rule hỗ trợ, không phải top-level Use Case mới.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 2. Use Case List

## Guest / Public Visitor

| **ID** | **Use Case**            | **Description**                                                                                                                                                                    |
|--------|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-G01 | Explore Book Street     | Khám phá danh sách/chi tiết Event, Activity đã public, Booth, Booth Map và Heritage/public content; dữ liệu QR Attendance và participation riêng tư không được public.             |
| UC-G02 | Create Account          | Đăng ký bằng username, full name, password và confirm password; email tùy chọn với Participant. Username duy nhất không phân biệt hoa thường; confirm password không lưu database. |
| UC-G03 | Manage Account Access   | Đăng nhập, đăng xuất, xác minh email và yêu cầu đặt lại mật khẩu; role PARTNER, ORGANIZER và ADMIN yêu cầu verified email.                                                         |
| UC-G04 | Submit General Feedback | Gửi góp ý về đúng một target BOOK_STREET hoặc EVENT. HERITAGE, Location và Activity không phải GeneralFeedback target. Guest không cần đăng nhập.                                  |

## Participant

| **ID** | **Use Case**                  | **Description**                                                                                                                                                |
|--------|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-P01 | Manage Event Participation    | Join/rejoin Event còn hạn, xem My Events và Leave khi không còn ActivityRegistration seat-active; nhận thông báo hệ thống thuộc Event như Event cancellation.                                         |
| UC-P02 | Manage Activity Registrations | Đăng ký, tự hủy hoặc re-register Activity hợp lệ; hệ thống auto-join Event khi cần, kiểm soát deadline/capacity atomically và cảnh báo lịch trùng nhưng không chặn.                                    |
| UC-P03 | Track Participation           | Theo dõi registration/Attendance/No-show/Certificate và thông báo liên quan; Participant đã đăng nhập tự quét QR chung của Activity. BoothVisit, Points và Badge vẫn thuộc umbrella Use Case này nhưng không phải slice Sprint 6. |
| UC-P04 | Rate Activity                 | Tạo hoặc cập nhật một rating cho mỗi Attendance `VALID` sau khi Activity `COMPLETED`; rating bị vô hiệu hóa nếu Attendance bị void.                                                                  |

## Partner / Exhibitor

| **ID** | **Use Case**                  | **Description**                                                                                                                                                                                                                                                                                |
|--------|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-E01 | Apply to Event                | Đăng ký tổ chức tham gia Event.                                                                                                                                                                                                                                                                |
| UC-E02 | Manage Booth Request          | Chọn Booth và gửi request; nhiều candidate có thể cùng nhắm một Booth/time. Theo dõi lifecycle và withdraw PENDING hoặc SELECTED chưa settlement để release Hold an toàn. Booth đã Assigned không được đổi/hủy trong MVP. |
| UC-E03 | Pay & View Booth              | Thanh toán giá đã khóa khi SELECTED + Hold; mỗi FAILED/TIMEOUT attempt được lưu riêng và chỉ retry khi payment window còn mở, không có kết quả chưa chắc chắn. Evidence PENDING/reconciliation tiếp tục giữ Hold nhưng không dừng Event lifecycle. Xem BoothAssignment sau PAYMENT SUCCESS và lịch sử PAYMENT; MVP không cung cấp business-refund workflow. |
| UC-E04 | Manage Activity Proposal      | Submit Proposal PENDING, sửa/resubmit khi được phép, theo dõi hoặc rút; Proposal chưa duyệt không khóa Location.                                                                                                                                                                                |
| UC-E05 | Request Activity Change       | Yêu cầu đổi Activity DRAFT/PUBLISHED của Partner; dữ liệu chính thức chỉ đổi sau Organizer approve.                                                                                                                                                                                            |
| UC-E06 | Request Activity Cancellation | Yêu cầu hủy Activity chính thức; sau cutoff vẫn nhận với late flag và submit chưa tự hủy Activity.                                                                                                                                                                                              |

## Event Organizer

| **ID** | **Use Case**                | **Description**                                                                                                                                                                                                                                         |
|--------|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-O01 | Manage Events               | Tạo, cập nhật, publish, xóa Draft, cancel Event chưa settlement và quản lý lifecycle/deadline; external participation khóa operational update, Event cancellation cascade registration/Notification nhưng không xóa lịch sử.                            |
| UC-O02 | Manage Locations            | Quản lý shared Area/Stage/Workshop và Booth subtype, capacity/active state; bảo vệ Location đang có Activity.                                                                                                                                            |
| UC-O03 | Review Partner Applications | Duyệt Partner tham gia Event.                                                                                                                                                                                                                           |
| UC-O04 | Review Booth Requests       | Review candidate cạnh tranh cùng Booth/time; chọn winner để tạo Hold và khóa giá. Candidate khác giữ PENDING; payment-window expiry chuyển winner thành PAYMENT_EXPIRED. Organizer chọn candidate tiếp theo sau khi Hold hết hạn hoặc được Partner release an toàn. |
| UC-O05 | Review Activity Proposals   | Request changes, reject hoặc atomically approve Proposal thành một Activity DRAFT sau khi revalidate.                                                                                                                                                   |
| UC-O06 | Manage Activities           | Tạo Activity BTC tại shared non-Booth Location; cấu hình Draft, publish, audited reschedule/move, cancel, lifecycle và review Partner requests; không đổi lịch/Location sau Attendance đầu tiên hoặc giảm capacity dưới seat-active count.               |
| UC-O07 | Monitor Participation       | Theo dõi Event/Activity registrations, Attendance, No-show và BoothVisit trong Event mình quản lý; correction Attendance phải có lý do, xác nhận rõ và append-only audit, không dùng Attendance Operator.                                               |
| UC-O08 | View Event Reports          | Xem thống kê Event cơ bản và lịch sử thanh toán gian hàng của Event mình sở hữu, gồm số tiền đã thu, theo BR-121; chỉ đọc. |
| UC-O09 | Manage Public Content       | Quản lý nội dung public/supporting content.                                                                                                                                                                                                             |

## System Admin

| **ID** | **Use Case**    | **Description**                                                                                                                                                         |
|--------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-A01 | Manage Accounts | Tạo, xem, sửa thông tin và khóa/mở tài khoản theo BR-112 đến BR-114; Admin không xem hoặc đặt lại mật khẩu. |
| UC-A02 | Manage Roles | Gán/gỡ PARTNER, ORGANIZER hoặc ADMIN qua UserRole theo BR-115; role nâng cao yêu cầu verified email. Tài khoản mới mặc định PARTICIPANT; không có Permission/RolePermission entity. |
| UC-A03 | Manage Badges | Quản lý Badge và ngưỡng total Points dùng để unlock Badge. |
| UC-A04 | Review Audit Logs | Xem, tìm và lọc nhật ký thao tác quản trị theo BR-118; nhật ký chỉ đọc. |
| UC-A05 | Manage Partner Organizations | Xem tổ chức đối tác và khóa/mở tổ chức kèm lý do theo BR-116 và BR-117; không sửa hồ sơ hay xóa tổ chức. |

## Post-MVP reference

Các Use Case dưới đây giữ ID để tham chiếu thiết kế tương lai nhưng không thuộc MVP hiện tại và
không được đưa vào Sprint/API/migration nếu chưa có quyết định scope mới:

- `UC-E07 Withdraw from Event` sau khi application đã APPROVED.
- Booth change sau Assignment.
- Booth cancellation sau Assignment.
- Business refund cho Booth/Event cancellation hoặc đổi Booth.
- Admin emergency cancellation của Event đang ONGOING.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>Tổng số Use Case<br />
28 active MVP Use Case, gồm UC-A04 và UC-A05 do Sprint 11 thêm. Các Post-MVP reference không tính vào tổng này. Participant vẫn có 4 Use Case lớn; Sprint 6 mở rộng flow/Acceptance Criteria bên trong các Use Case đã có, không tăng tổng số. Chi tiết status, deadline, capacity, QR window, No-show, correction audit, Notification, Certificate và Rating đi vào Use Case Specification/Business Rules thay vì tách thêm oval.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 3. Gợi ý vẽ Diagram

- Participant được hiểu là authenticated User có toàn bộ khả năng public của Guest. General Feedback thuộc public flow; Participant có thêm Activity Rating khi đủ điều kiện. Manage Event Participation quản lý Join/Leave; Manage Activity Registrations quản lý seat; Track Participation trình bày Attendance, No-show, Certificate, BoothVisit, Points, Badge và Notification liên quan mà không tạo Event-level QR.

- Nếu một diagram vẫn đông, chia thành 2 diagram: Public & Participant; Partner & Management.

- Event Registration và Activity Registration phải là hai khái niệm riêng, nhưng không cần tách các bước auto-create Event Registration thành một Use Case riêng.

- Conflict checking, capacity, deadline, QR validation, No-show scheduler, Attendance correction audit, Certificate/Notification processor, points threshold và payment verification là business rules/include logic, không phải top-level Use Case. Payment Gateway là external integration của UC-E03, không phải business actor cốt lõi.

# 4. Sprint 6 traceability note

- Sprint 6 dùng các slice `UC-G01`, `UC-P01`–`UC-P04`, `UC-O01`, `UC-O06` và `UC-O07`; không tạo Actor hoặc Use Case mới.
- `UC-P03` chỉ giao Activity registration status, self-scan Attendance, No-show, Certificate và participation Notification trong Sprint 6. BoothVisit, Points và Badge vẫn là active MVP scope nhưng được triển khai ở slice khác.
- Organizer correction là alternative/authorized flow của `UC-O07`; `attendance_adjustments` là technical audit, không phải Actor-facing entity/Use Case.
- Automatic lifecycle, No-show, Certificate metadata và Notification persistence là System behavior kích hoạt từ các Use Case trên, không phải cron/scheduler Actor trên diagram.

# 5. Sprint 10 traceability note

- Sprint 10 không thêm Actor hoặc top-level Use Case; tổng số active MVP Use Case vẫn là 26.
- Participant Notification tiếp tục refine `UC-P01` và `UC-P03` với sáu producer hiện hành.
- Partner outcome Notification hỗ trợ `UC-E01`–`UC-E06` theo workflow bị tác động; self-action thông thường
  không tạo inbox echo.
- Organizer work-item Notification hỗ trợ `UC-O03`–`UC-O06`; Event cancellation vẫn thuộc `UC-O01`.
- Admin inbox là hạ tầng role-isolated cho workspace hiện có, không thêm Admin goal, type hoặc producer.
- Notification creation là System behavior trong transaction nghiệp vụ, không phải một Use Case tạo thông
  báo độc lập và không cho client chọn recipient hoặc audience.
- Exact role isolation, transition matrix, suppression và read semantics tuân theo `BR-102`–`BR-109` và
  Sprint 10 Use Case Specifications.

# 6. Sprint 11 traceability note

- Sprint 11 thêm hai top-level Use Case của System Admin: `UC-A04 Review Audit Logs` và
  `UC-A05 Manage Partner Organizations`. Tổng số active MVP Use Case là 28.
- Không thêm Actor mới. Admin vẫn quản trị hệ thống và không thay Organizer điều hành Event.
- `UC-A01` và `UC-A02` được làm rõ theo BR-112 đến BR-115. Chặn tài khoản bị khóa trên toàn hệ thống là System
  behavior hỗ trợ `UC-A01`, không phải Use Case riêng.
- Dashboard Admin theo BR-119 là một phần của Admin workspace, không phải Use Case riêng.
- Lịch sử thanh toán gian hàng theo BR-121 (bổ sung 10/11/2026): phần của Admin là giám sát chỉ đọc trong Admin
  workspace như dashboard, không phải Use Case riêng; phần của Organizer thuộc `UC-O08 View Event Reports`.
  Tổng số active MVP Use Case vẫn là 28.
- Ghi nhật ký là System behavior trong transaction của thao tác quản trị; chỉ việc đọc nhật ký thuộc `UC-A04`.
- Tác động của tổ chức bị khóa theo BR-117 refine các Use Case Partner và Organizer đang có, không tạo Use Case
  mới.
- Đặt lại mật khẩu theo BR-120 hoàn thiện phần còn thiếu của `UC-G03`, không tạo Use Case mới.
- Use Case Diagram V2 chưa thể hiện `UC-A04` và `UC-A05`; cần vẽ lại trước khi dùng cho báo cáo Sprint 11.
