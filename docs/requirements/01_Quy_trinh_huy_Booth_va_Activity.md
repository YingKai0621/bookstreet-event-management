**QUY TRÌNH HỦY BOOTH VÀ ACTIVITY — MVP VÀ THAM CHIẾU POST-MVP**

Cancellation & Change Handling

> **Trạng thái tài liệu (2026-10-09):** Luồng Activity vẫn là định hướng MVP. Đối với Booth,
> MVP hiện tại chỉ cho withdraw `PENDING` hoặc release an toàn `SELECTED` trước settlement.
> Booth đã có Assignment không được đổi/hủy; Partner withdrawal sau approval và business refund
> là `POST-MVP REFERENCE`. Các mục được đánh dấu Post-MVP không phải nguồn triển khai hiện hành.

# 0. Chính sách Booth đang có hiệu lực

- `PENDING`: Partner withdraw trực tiếp; chưa có Hold.
- `SELECTED`: Partner được withdraw và release Hold khi không có Payment `PENDING`/`SUCCESS`,
  không có reconciliation conflict và chưa có Assignment.
- Payment `FAILED`/`TIMEOUT` đã xác minh không chặn withdrawal.
- Payment chưa rõ kết quả tiếp tục khóa Hold; không được release hoặc reassign Booth.
- Sau khi có BoothAssignment, Partner không được đổi/hủy Booth trong MVP.
- Event có Payment thành công/chưa rõ kết quả hoặc có Assignment không được Organizer hủy trong
  MVP, vì vậy không phát sinh business refund.
- Thiết kế refund/Booth change phía dưới được giữ để nghiên cứu sau MVP, không dùng cho API hay
  migration Sprint 4.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Mục tiêu tài liệu</strong><br />
Mô tả rõ cách Partner gửi yêu cầu hủy, cách Organizer xử lý, và ảnh hưởng của việc hủy Booth/Activity đến các phần còn lại của hệ thống.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 1. Khái niệm cần phân biệt

| **Khái niệm**        | **Hiểu đơn giản**                                                                                                      |
|----------------------|------------------------------------------------------------------------------------------------------------------------|
| Booth                | Gian hàng / vị trí vật lý dùng chung của Đường Sách; có thể được dùng lại ở các Event không trùng thời gian.           |
| Activity             | Hoạt động / chương trình diễn ra tại một thời gian và địa điểm cụ thể.                                                 |
| Booth Assignment     | Việc một Booth được phân cho một Partner trong một Event/khoảng thời gian cụ thể.                                      |
| Cancellation Request | Yêu cầu hủy Activity đã duyệt; Booth Cancellation Request sau Assignment là Post-MVP.                                 |
| Withdraw             | Rút một request/proposal khi nó vẫn còn Pending, chưa được duyệt.                                                      |
| Booth Payment        | Giao dịch thanh toán Booth theo mức giá cấu hình riêng cho từng Event; thanh toán thành công mới tạo Booth Assignment. |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Câu dễ nhớ</strong><br />
Booth là “chỗ”, Activity là “việc”. Hủy một Activity không đồng nghĩa mất Booth. Hủy quyền sử dụng Booth chỉ ảnh hưởng những Activity đang diễn ra tại Booth đó.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 2. Nguyên tắc chung về hủy

- BoothRequest `PENDING` được Partner tự withdraw. ActivityProposal `PENDING` hoặc `NEED_CHANGES`
  cũng được tự withdraw, không cần Organizer xác nhận; các record mở này chưa phải Assignment hay
  Activity chính thức.

- Nếu Activity đã chính thức và chưa terminal: Partner gửi Cancellation Request; submit chưa hủy
  Activity, Organizer approve mới làm việc hủy có hiệu lực. Booth đã Assigned không có
  cancellation workflow trong MVP.

- Không xóa dữ liệu lịch sử. Hệ thống giữ lại request, lý do hủy, thời điểm hủy và trạng thái để phục vụ báo cáo.

- Nên dùng “Confirm Cancellation” thay vì hiểu Organizer có thể ép Partner tiếp tục. Organizer xác nhận và xử lý hậu quả của việc hủy.

# 3. BoothRequest withdrawal và thiết kế hủy Booth Assignment tương lai

Thực tế không nên “xóa Booth”. Booth là tài nguyên vật lý dùng chung của Đường Sách; chỉ Booth Assignment của Partner trong một Event bị hủy/release.

## 3.1 Khi Booth Request chưa được duyệt

Partner có thể bấm Withdraw Request. Booth chưa được cấp và chưa có Hold nên không cần Organizer duyệt việc rút request; việc rút cũng không ảnh hưởng các request khác đang cùng xin Booth đó.

## 3.2 Khi Booth đã được phân — POST-MVP REFERENCE

- Partner mở Booth đã được cấp và chọn “Request Cancellation / Yêu cầu hủy gian hàng”.

- Partner nhập lý do hủy và gửi yêu cầu.

- Organizer nhận yêu cầu trong màn hình quản lý Booth Cancellation Requests.

- Organizer kiểm tra thời điểm hủy, chính sách hoàn tiền và các Activity đang dùng Booth đó.

- Organizer Confirm Cancellation. BoothAssignment chuyển CANCELLED/RELEASED ngay, không chờ tiền thực tế về tài khoản Partner. Nếu đủ điều kiện refund, hệ thống tạo BoothPayment loại REFUND ở trạng thái PENDING, tham chiếu Payment SUCCESS gốc và gửi yêu cầu hoàn tiền bất đồng bộ qua Payment Gateway; Payment gốc vẫn giữ SUCCESS.

- Ngay khi BoothAssignment chuyển RELEASED/CANCELLED, QR của Assignment đó không còn hợp lệ cho lượt quét mới. BoothVisit, Point và Badge đã phát sinh hợp lệ vẫn được giữ làm lịch sử.

- Hệ thống tính lại availability của Booth cho Event/khoảng thời gian liên quan. Booth vật lý không đổi trạng thái ASSIGNED toàn cục.

## 3.3 Hủy Booth sớm và hủy Booth sát giờ — POST-MVP REFERENCE

| **Tình huống**         | **Organizer xử lý**                                                                         | **Kết quả**                                                                                 |
|------------------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| Hủy trước cutoff       | Confirm cancellation, hoàn 100%, release Booth và có thể mở lại cho Partner khác.           | Booth có thể trở lại AVAILABLE cho Event/thời gian đó nếu không có Hold/Assignment overlap. |
| Hủy sau cutoff         | Confirm cancellation, không hoàn tiền; release Booth nhưng thường không mở đăng ký tự động. | Organizer quyết định reassign thủ công hay để trống; lưu đầy đủ lịch sử.                    |
| Event bị Organizer hủy | Hủy các Assignment liên quan và hoàn 100% khoản thanh toán Booth.                           | Booth được giải phóng theo Event/time; các Activity được xử lý riêng.                       |

Organizer cấu hình Event.boothCancellationCutoffAt. BoothCancellationRequest.submittedAt \<= cutoff được refund 100%; submittedAt \> cutoff được refund 0%. Nếu Event bị Organizer/System hủy, Partner được hoàn 100%. Số tiền refund lấy từ Payment SUCCESS gốc, không lấy từ giá EventBoothConfig hiện tại. Sau khi Assignment được release, Booth có thể mở lại trước cutoff; sau cutoff, Organizer quyết định reassign thủ công hay để trống.

## 3.4 Activity đang nằm tại Booth bị hủy thì sao? — POST-MVP REFERENCE

Hệ thống không nên tự động hủy tất cả Activity. Khi Booth Assignment bị release, hệ thống liệt kê các Activity có location chính là Booth đó để Organizer xử lý.

- Đổi địa điểm Activity sang Booth/Stage/Area khác nếu còn phù hợp.

- Reschedule nếu cần thêm thời gian chuẩn bị.

- Cancel Activity nếu không còn địa điểm hoặc Partner không thể tổ chức.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Ví dụ</strong><br />
Kim Đồng mất Booth A05. Activity “Mini game tại A05” bị ảnh hưởng; nhưng Activity “Giao lưu tác giả tại Main Stage” không bị ảnh hưởng.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 4. Hủy Activity

## 4.1 Khi Activity Proposal còn mở

Partner có thể Withdraw Proposal `PENDING` hoặc `NEED_CHANGES` trực tiếp. Vì Activity chưa được duyệt
và chưa public nên không cần Organizer xác nhận. Event cancellation chuyển Proposal còn mở sang
`CANCELLED`; không hard-delete record.

## 4.2 Khi Activity đã chính thức

- Partner chọn Activity và gửi “Activity Cancellation Request”.

- Partner nhập lý do hủy sau normalize dài 10–500 ký tự và gửi yêu cầu. Đúng biên
  `activityCancellationCutoffAt` chưa bị coi là trễ; sau biên request vẫn được nhận với
  `isLate=true`.

- Organizer xem số người đã đăng ký, thời gian còn lại, địa điểm và khả năng xử lý thay thế.

- Organizer approve hoặc reject Cancellation Request. Reschedule/Change Location phải dùng
  ActivityChangeRequest riêng, không biến Cancellation Request thành một lệnh sửa Activity.

- Nếu approve: request chuyển `APPROVED`; Activity atomically chuyển `CANCELLED` và lưu
  `cancelledAt`, `cancellationReason`, `cancellationSource=PARTNER_REQUEST`. Organizer hủy trực tiếp
  dùng source `ORGANIZER`; Event cancellation dùng `EVENT_CANCELLATION`; cleanup dùng `SYSTEM`.

- Submit request chưa làm QR mất hiệu lực; chỉ khi Activity thực sự `CANCELLED` thì QR không còn hợp
  lệ cho Attendance mới. Attendance, Certificate hoặc ActivityRating hợp lệ trước đó vẫn được giữ;
  registration chưa scan hợp lệ không được coi là đã tham dự.

## 4.3 Nếu Activity bị hủy sau khi đã có Participant đăng ký

| **Thành phần** | **Xử lý khi Activity Cancelled**              |
|----------------|-----------------------------------------------|
| Activity       | Chuyển trạng thái CANCELLED, vẫn giữ lịch sử. |
| Registration   | Giữ record để theo dõi lịch sử; không xóa.    |
| Participant    | Nhận thông báo hủy/thay đổi lịch.             |

## 4.4 Hủy Activity sát giờ

Ví dụ 14:30 Partner báo không thể tổ chức Activity lúc 15:00. Request vẫn được ghi nhận là late để
Organizer xử lý. Sprint 5 gửi email sau commit cho representative Partner; notification hàng loạt
và đóng registration của Participant được thực hiện khi module Participant được triển khai.

# 5. Partner rút khỏi toàn bộ Event — POST-MVP REFERENCE

Đây là trường hợp lớn hơn Cancel Booth hoặc Cancel Activity. Partner chọn “Withdraw from Event” và gửi yêu cầu cho Organizer.

- Organizer xác nhận Partner không còn tham gia Event.

- Khi Organizer xác nhận PartnerWithdrawalRequest, các BoothRequest PENDING kết thúc WITHDRAWN, Active Hold được release và các BoothAssignment ACTIVE được release ngay. Refund của từng Assignment dùng PartnerWithdrawalRequest.submittedAt so với Event.boothCancellationCutoffAt: trước/đúng cutoff 100%, sau cutoff 0%; Event bị Organizer/System hủy thì refund 100% bất kể cutoff. Mỗi Payment SUCCESS gốc đủ điều kiện tạo một REFUND PENDING riêng để gateway xử lý bất đồng bộ; Withdrawal không chờ refund SUCCESS.

- QR của các BoothAssignment bị release mất hiệu lực cho scan mới; dữ liệu BoothVisit/Point/Badge hợp lệ trước đó không bị xóa.

- Các Activity do Partner tổ chức được Cancel hoặc xử lý theo phương án của Organizer.

- Participant đã đăng ký các Activity bị ảnh hưởng được thông báo.

- Các Activity Registration của Activity bị hủy được giữ lại để truy vết, chuyển trạng thái phù hợp và thông báo cho Participant bị ảnh hưởng.

# 6. Ma trận thiết kế tương lai — POST-MVP REFERENCE

| **Trạng thái / tình huống** | **Partner**                      | **Organizer**                                                                                                                                                                      |
|-----------------------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Booth Request - PENDING     | Withdraw trực tiếp; chưa có Hold | Không cần xác nhận                                                                                                                                                                 |
| Booth đã Assigned           | Gửi Cancellation Request         | Confirm + hoàn tiền theo cutoff + release Booth                                                                                                                                    |
| Activity Proposal - PENDING/NEED_CHANGES | Withdraw trực tiếp     | Không cần xác nhận                                                                                                                                                                 |
| Activity chính thức chưa terminal | Gửi Cancellation Request    | Approve/reject Cancellation; reschedule/move dùng Change Request riêng                                                                                                             |
| Booth hủy trước cutoff      | Gửi yêu cầu                      | Hoàn 100%; release assignment; có thể mở lại nếu còn phù hợp                                                                                                                       |
| Booth hủy sau cutoff        | Gửi yêu cầu                      | Không hoàn tiền; release assignment; thường để trống hoặc chủ động reassign                                                                                                        |
| Activity hủy sát giờ        | Gửi yêu cầu                      | Confirm cancel + notify Participant                                                                                                                                                |
| Rút khỏi Event              | Gửi Withdrawal Request           | Release request/Hold/Assignment ngay; mỗi khoản đủ điều kiện tạo REFUND PENDING theo submittedAt so với Event.boothCancellationCutoffAt; gateway xử lý bất đồng bộ; xử lý Activity |
| Event bị Organizer hủy      | Nhận thông báo                   | Hoàn 100% khoản thanh toán Booth + release Booth + xử lý Activity                                                                                                                  |

# 7. Flow tóm tắt

Booth MVP: Partner chọn Booth → BoothRequest PENDING (chưa Hold, chưa khóa giá) → Organizer chọn request → SELECTED + Hold và khóa giá từ EventBoothConfig → Partner thanh toán thật. Payment attempt FAILED hoặc attempt TIMEOUT được lưu riêng và vẫn có thể retry khi payment window còn mở. Partner có thể withdraw SELECTED để release Hold khi mọi Payment đều đã terminal an toàn và chưa có Assignment. Payment chưa rõ kết quả tiếp tục khóa Hold và có thể kéo dài sang ONGOING mà không dừng Event lifecycle. Payment SUCCESS tạo BoothAssignment và hoàn tất request khi Event còn PUBLISHED/ONGOING; sau COMPLETED/CANCELLED, success chỉ tạo reconciliation evidence và không tạo Assignment. Sau Assignment không có change/cancellation/refund workflow trong MVP.

Booth Post-MVP: Cancellation Request, Partner withdrawal sau approval và refund theo cutoff chỉ là thiết kế tham khảo tương lai.

Activity: Partner Proposal PENDING → Organizer approve atomically thành Activity DRAFT → Publish →
Partner gửi Change hoặc Cancellation Request → Organizer approve/reject. Sprint 5 gửi email
post-commit cho Partner; notification Participant được nối khi module Participant được triển khai.
