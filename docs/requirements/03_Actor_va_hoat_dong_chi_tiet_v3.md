**ACTORS & MAIN ACTIVITIES**

*Updated baseline for Event participation, Booth selection and feedback*

# 1. Tổng quan

Hệ thống có 5 Actor chính. Guest và Participant có thể là cùng một người ở hai trạng thái: chưa đăng nhập là Guest; sau khi đăng nhập và dùng chức năng cá nhân thì là Participant.

| **Actor**              | **Hiểu đơn giản**              | **Trọng tâm**                                                                             |
|------------------------|--------------------------------|-------------------------------------------------------------------------------------------|
| Guest / Public Visitor | Khách chưa đăng nhập           | Khám phá public information và gửi general feedback.                                      |
| Participant            | Người dùng đã đăng nhập        | Join Event, Activity registration, tự quét QR, Attendance, BoothVisit, rewards và rating. |
| Partner / Exhibitor    | Nhà xuất bản / đơn vị tham gia | Apply Event, chọn Booth, đề xuất Activity.                                                |
| Event Organizer        | Ban quản lý / Ban tổ chức      | Quản lý nhiều Event, duyệt và vận hành nghiệp vụ.                                         |
| System Admin           | Quản trị hệ thống              | Account, Role/UserRole và Badge toàn hệ thống.                                            |

# 2. Guest / Public Visitor

Guest không cần tài khoản để xem nội dung public.

- Explore Book Street: xem/tìm Event, Activity, Booth, Booth Map và Heritage content.

- Submit General Feedback: gửi góp ý về đúng một target BOOK_STREET, EVENT hoặc HERITAGE mà không cần đăng nhập.

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

- Manage Booth Request: sau khi được duyệt vào Event, chọn Booth cụ thể trên map rồi gửi/đổi/hủy request; submit request chưa tạo Hold.

- Pay Booth Fee & View Assignment: sau khi request được SELECTED, thanh toán/retry theo giá đã khóa trong thời gian Hold; xem từng payment attempt và Assignment sau PAYMENT SUCCESS. Khi đổi/hủy/rút Event, theo dõi REFUND PENDING/SUCCESS/FAILED do backend xử lý qua Payment Gateway bằng cách tham chiếu giao dịch PAYMENT SUCCESS gốc.

- Manage Activity Proposal: tạo/sửa/gửi/rút đề xuất Activity.

- Request Activity Change / Cancellation: yêu cầu thay đổi hoặc hủy Activity đã được duyệt.

- Withdraw from Event: xin rút toàn bộ đơn vị khỏi Event; khi Organizer xác nhận, request/Hold/Assignment liên quan kết thúc ngay và các refund đủ điều kiện được xử lý bất đồng bộ.

Lưu ý: Booth availability được tính theo Event/thời gian. Cùng một Booth vật lý có thể dùng cho Event khác nếu lịch không overlap.

# 5. Event Organizer

Organizer thuộc Ban quản lý Đường Sách. Mỗi Event có organizerUserId xác định Organizer chịu trách nhiệm xử lý; đây là trách nhiệm nghiệp vụ/audit, không biến Event thành tài sản cá nhân.

- Manage Events: tạo, cập nhật, publish, cancel, deadline và lifecycle.

- Manage Locations & Booths: Area, Stage, physical Booth, EventBoothConfig (giá theo từng Event–Booth), availability, Hold, Payment và Assignment.

- Review Partner Applications & Booth Requests; chọn request phù hợp rồi tạo Hold và khóa giá Event–Booth. Candidate khác giữ PENDING trong payment window; khi Assignment được tạo thì chuyển NOT_SELECTED; chỉ khi payment window/Hold hết hạn mới chuyển winner PAYMENT_EXPIRED và chọn candidate tiếp theo. Organizer xác nhận quyền refund; backend/gateway xử lý việc hoàn tiền.

- Review Activity Proposals.

- Manage Activities: Activity của BTC, publish, reschedule, move hoặc cancel.

- Monitor Event/Activity registrations, Attendance và BoothVisit; Organizer chỉ correction/override Attendance khi cần và phải lưu lý do/thời điểm audit, không vận hành quét QR thay Participant.

- View Reports & Manage Public Content.

# 6. System Admin

Admin quản trị hệ thống, không thay Organizer điều hành Event.

- Manage Accounts: xem trạng thái, khóa hoặc mở khóa tài khoản.

- Manage Roles: gán/gỡ PARTNER, ORGANIZER hoặc ADMIN qua UserRole; role nâng cao yêu cầu verified email. Tài khoản mới mặc định PARTICIPANT; MVP không có Permission/RolePermission entity.

- Manage Badges: quản lý danh mục Badge, ngưỡng total Points và trạng thái sử dụng.
