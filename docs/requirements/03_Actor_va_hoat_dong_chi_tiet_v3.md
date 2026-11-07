**ACTORS & MAIN ACTIVITIES**

*Updated active MVP baseline for Event lifecycle, Booth selection and feedback — 09/10/2026*

# 1. Tổng quan

Hệ thống có 5 Actor chính. Guest và Participant có thể là cùng một người ở hai trạng thái: chưa đăng nhập là Guest; sau khi đăng nhập và dùng chức năng cá nhân thì là Participant.

| **Actor**              | **Hiểu đơn giản**              | **Trọng tâm**                                                                             |
|------------------------|--------------------------------|-------------------------------------------------------------------------------------------|
| Guest / Public Visitor | Khách chưa đăng nhập           | Khám phá public information và gửi general feedback.                                      |
| Participant            | Người dùng đã đăng nhập        | Join Event, Activity registration, tự quét QR, Attendance, BoothVisit, rewards và rating. |
| Partner / Exhibitor    | Nhà xuất bản / đơn vị tham gia | Apply Event, chọn Booth, đề xuất Activity.                                                |
| Event Organizer        | Ban quản lý / Ban tổ chức      | Quản lý nhiều Event, duyệt và vận hành nghiệp vụ.                                         |
| System Admin           | Quản trị hệ thống              | Account, Role/UserRole, Badge, tổ chức đối tác, nhật ký quản trị và Dashboard toàn hệ thống. |

# 2. Guest / Public Visitor

Guest không cần tài khoản để xem nội dung public.

- Explore Book Street: xem/tìm Event, Activity, Booth, Booth Map và Heritage content.

- Submit General Feedback: gửi góp ý về đúng một target BOOK_STREET hoặc EVENT mà không cần đăng nhập. Heritage không nhận GeneralFeedback.

- Create Account: đăng ký bằng username, full name, password và confirm password. Username là duy nhất không phân biệt hoa thường; email là tùy chọn đối với Participant. Confirm password chỉ dùng để kiểm tra và không lưu database.

- Manage Account Access: đăng nhập, đăng xuất và yêu cầu đặt lại mật khẩu. Tài khoản mới mặc định có role PARTICIPANT; PARTNER, ORGANIZER và ADMIN chỉ được cấp khi email đã xác minh.

# 3. Participant

Participant có toàn bộ khả năng public của Guest, cộng thêm các chức năng cá nhân.

- Manage Event Participation: Join/Leave Event, My Events và nhận Event-level notification.

- Manage Activity Registrations: đăng ký/hủy Activity cần giữ chỗ và theo dõi trạng thái đăng ký.

- Track Participation: tự quét Activity QR để ghi Attendance; tự quét QR của BoothAssignment ACTIVE để ghi BoothVisit; theo dõi My Events, registrations, Attendance, BoothVisit, Points, Badge, Certificate và thông báo liên quan. Không có Attendance Operator, check-in/check-out hoặc attendance duration.

- Rate Activity: đánh giá Activity khi có Attendance hợp lệ.

# 4. Partner / Exhibitor

Partner là tổ chức tham gia Event; tài khoản đại diện thao tác cho tổ chức.

- Apply to Event: xin tham gia Event và chờ Organizer duyệt.

- Manage Booth Request: sau khi được duyệt vào Event, chọn Booth cụ thể trên map rồi gửi request; PENDING chưa tạo Hold. PENDING hoặc SELECTED chưa settlement có thể withdraw theo điều kiện an toàn.

- Pay Booth Fee & View Assignment: sau khi request được SELECTED, thanh toán/retry theo giá đã khóa trước Hold `expiresAt`; xem từng payment attempt và Assignment sau PAYMENT SUCCESS hợp lệ khi Event PUBLISHED/ONGOING. Evidence chưa rõ có thể giữ Hold sang ONGOING; success sau COMPLETED/CANCELLED chỉ đối soát và không tạo Assignment. MVP không có business-refund hoặc đổi/hủy Booth sau Assignment.

- Manage Activity Proposal: submit ngay PENDING, sửa/resubmit khi được phép, theo dõi hoặc rút đề
  xuất; không cần sở hữu Booth nếu dùng shared Location.

- Request Activity Change / Cancellation: yêu cầu thay đổi hoặc hủy Activity đã được duyệt.

- Post-MVP reference: whole-Event withdrawal sau approval, Booth change/cancellation sau Assignment và business refund không phải active MVP activity.

Lưu ý: Booth availability được tính theo Event/thời gian. Cùng một Booth vật lý có thể dùng cho Event khác nếu lịch không overlap.

# 5. Event Organizer

Organizer thuộc Ban quản lý Đường Sách. Mỗi Event có organizerUserId xác định Organizer chịu trách nhiệm xử lý; đây là trách nhiệm nghiệp vụ/audit, không biến Event thành tài sản cá nhân.

- Manage Events: tạo/cập nhật/xóa Draft; publish; cập nhật có giới hạn hoặc cancel một Event
  PUBLISHED chưa có financial/Assignment blocker; theo dõi lifecycle một chiều đến ONGOING và
  COMPLETED. Event đã publish không bị hard-delete.

- Manage Locations & Booths: Area, Stage, physical Booth, EventBoothConfig (giá theo từng Event–Booth), availability, Hold, Payment và Assignment.

- Review Partner Applications & Booth Requests; chọn request phù hợp rồi tạo Hold và khóa giá Event–Booth. Candidate khác giữ PENDING trong payment window; Assignment tạo thì chuyển NOT_SELECTED. Hết Hold hoặc Partner release an toàn thì Organizer có thể chọn candidate tiếp theo. Organizer không xử lý business refund trong MVP.

- Review Activity Proposals.

- Manage Activities: tạo Activity BTC tại shared non-Booth Location; cấu hình Draft, publish,
  audited reschedule/move, cancel và quản lý lifecycle/request.

- Monitor Event/Activity registrations, Attendance và BoothVisit; Organizer chỉ correction/override Attendance khi cần và phải lưu lý do/thời điểm audit, không vận hành quét QR thay Participant.

- View Reports & Manage Public Content.

# 6. System Admin

Admin quản trị hệ thống, không thay Organizer điều hành Event.

- Manage Accounts: tạo, xem, sửa thông tin và khóa/mở tài khoản kèm lý do; không xem hoặc đặt lại mật khẩu.

- Manage Roles: gán/gỡ PARTNER, ORGANIZER hoặc ADMIN qua UserRole; role nâng cao yêu cầu verified email. Tài khoản mới mặc định PARTICIPANT; MVP không có Permission/RolePermission entity.

- Manage Badges: quản lý danh mục Badge, ngưỡng total Points và trạng thái sử dụng.

- Review Audit Logs: xem, tìm và lọc nhật ký thao tác quản trị; nhật ký chỉ đọc.

- Manage Partner Organizations: xem tổ chức đối tác và khóa/mở tổ chức kèm lý do; không sửa hồ sơ hay xóa tổ chức.

- Xem Dashboard toàn hệ thống từ số liệu thật; không phải Use Case riêng.
