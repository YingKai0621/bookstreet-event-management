**USE CASE LIST - COMPACT v4**

Active MVP baseline updated 09/10/2026; Post-MVP references are listed separately

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
Guest được gom thành một Use Case public chính: Explore Book Street. Participant cũng được gom theo mục tiêu lớn; các phần My Events, Activity registrations, Attendance, BoothVisit, Points, Badge và Certificate được gom vào Track Participation thay vì tách thành nhiều Use Case View.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 2. Use Case List

## Guest / Public Visitor

| **ID** | **Use Case**            | **Description**                                                                                                                                                                    |
|--------|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-G01 | Explore Book Street     | Khám phá Event, Activity, Booth, Booth Map và Heritage/public content.                                                                                                             |
| UC-G02 | Create Account          | Đăng ký bằng username, full name, password và confirm password; email tùy chọn với Participant. Username duy nhất không phân biệt hoa thường; confirm password không lưu database. |
| UC-G03 | Manage Account Access   | Đăng nhập, đăng xuất, xác minh email và yêu cầu đặt lại mật khẩu; role PARTNER, ORGANIZER và ADMIN yêu cầu verified email.                                                         |
| UC-G04 | Submit General Feedback | Gửi góp ý về đúng một target BOOK_STREET, EVENT hoặc HERITAGE; không target Location hoặc Activity và không cần đăng nhập.                                                         |

## Participant

| **ID** | **Use Case**                  | **Description**                                                                                                                                                |
|--------|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-P01 | Manage Event Participation    | Join/Leave Event; hệ thống lưu My Events và gửi thông báo chung của Event.                                                                                     |
| UC-P02 | Manage Activity Registrations | Đăng ký/hủy Activity; hệ thống xử lý capacity và cảnh báo khi lịch bị trùng.                                                                                   |
| UC-P03 | Track Participation           | Theo dõi My Events, Activity registrations, Attendance, BoothVisit, Points, Badge và Certificate; tự quét Activity QR/BoothAssignment QR khi tham gia thực tế. |
| UC-P04 | Rate Activity                 | Đánh giá Activity khi Participant có Attendance hợp lệ; mỗi Attendance tối đa một rating.                                                                      |

## Partner / Exhibitor

| **ID** | **Use Case**                  | **Description**                                                                                                                                                                                                                                                                                |
|--------|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-E01 | Apply to Event                | Đăng ký tổ chức tham gia Event.                                                                                                                                                                                                                                                                |
| UC-E02 | Manage Booth Request          | Chọn Booth và gửi request; nhiều candidate có thể cùng nhắm một Booth/time. Theo dõi lifecycle và withdraw PENDING hoặc SELECTED chưa settlement để release Hold an toàn. Booth đã Assigned không được đổi/hủy trong MVP. |
| UC-E03 | Pay & View Booth              | Thanh toán giá đã khóa khi SELECTED + Hold; mỗi FAILED/TIMEOUT attempt được lưu riêng và chỉ retry khi payment window còn mở, không có kết quả chưa chắc chắn. Evidence PENDING/reconciliation tiếp tục giữ Hold nhưng không dừng Event lifecycle. Xem BoothAssignment sau PAYMENT SUCCESS và lịch sử PAYMENT; MVP không cung cấp business-refund workflow. |
| UC-E04 | Manage Activity Proposal      | Tạo, sửa, gửi lại hoặc rút Activity Proposal trước khi duyệt.                                                                                                                                                                                                                                  |
| UC-E05 | Request Activity Change       | Yêu cầu đổi Activity đã được duyệt/published.                                                                                                                                                                                                                                                  |
| UC-E06 | Request Activity Cancellation | Yêu cầu hủy Activity đã được duyệt/published.                                                                                                                                                                                                                                                  |

## Event Organizer

| **ID** | **Use Case**                | **Description**                                                                                                                                                                                                                                         |
|--------|-----------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-O01 | Manage Events               | Tạo, cập nhật, publish, xóa Draft, cancel Event chưa settlement và quản lý lifecycle/deadline; Event.organizerUserId xác định Organizer chịu trách nhiệm.                                                                                               |
| UC-O02 | Manage Locations            | Quản lý Area, Stage, Booth, capacity và availability.                                                                                                                                                                                                   |
| UC-O03 | Review Partner Applications | Duyệt Partner tham gia Event.                                                                                                                                                                                                                           |
| UC-O04 | Review Booth Requests       | Review candidate cạnh tranh cùng Booth/time; chọn winner để tạo Hold và khóa giá. Candidate khác giữ PENDING; payment-window expiry chuyển winner thành PAYMENT_EXPIRED. Organizer chọn candidate tiếp theo sau khi Hold hết hạn hoặc được Partner release an toàn. |
| UC-O05 | Review Activity Proposals   | Approve, request change hoặc reject proposal.                                                                                                                                                                                                           |
| UC-O06 | Manage Activities           | Tạo Activity của BTC; publish, reschedule, move hoặc cancel.                                                                                                                                                                                            |
| UC-O07 | Monitor Participation       | Theo dõi Event/Activity registrations, Attendance, no-show và BoothVisit; correction/override Attendance khi cần phải lưu lý do.                                                                                                                        |
| UC-O08 | View Event Reports          | Xem thống kê Event cơ bản.                                                                                                                                                                                                                              |
| UC-O09 | Manage Public Content       | Quản lý nội dung public/supporting content.                                                                                                                                                                                                             |

## System Admin

| **ID** | **Use Case**    | **Description**                                                                                                                                                         |
|--------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UC-A01 | Manage Accounts | Quản lý tài khoản và trạng thái account.                                                                                                                                |
| UC-A02 | Manage Roles    | Gán/gỡ PARTNER, ORGANIZER hoặc ADMIN qua UserRole; role nâng cao yêu cầu verified email. Tài khoản mới mặc định PARTICIPANT; không có Permission/RolePermission entity. |
| UC-A03 | Manage Badges   | Quản lý Badge và ngưỡng total Points dùng để unlock Badge.                                                                                                              |

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
26 active MVP Use Case. Các Post-MVP reference không tính vào tổng này. Bản active đủ gọn để vẽ diagram; Participant chỉ còn 4 Use Case lớn. Các thao tác xem chi tiết, status, deadline, conflict, QR validation, Points/Certificate rules sẽ đi vào Use Case Specification và Business Rules, không tách thêm oval.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 3. Gợi ý vẽ Diagram

- Participant được hiểu là authenticated user có toàn bộ khả năng public của Guest. General Feedback thuộc public flow; Participant có thêm Activity Rating khi đủ điều kiện. Các dữ liệu cá nhân như My Events, Activity registrations, Attendance, BoothVisit, Points, Badge và Certificate được gom trong Track Participation.

- Nếu một diagram vẫn đông, chia thành 2 diagram: Public & Participant; Partner & Management.

- Event Registration và Activity Registration phải là hai khái niệm riêng, nhưng không cần tách các bước auto-create Event Registration thành một Use Case riêng.

- Conflict checking, capacity, deadline, QR validation, points threshold và payment verification là business rules/include logic, không phải top-level Use Case. Payment Gateway là external integration của UC-E03, không phải business actor cốt lõi.
