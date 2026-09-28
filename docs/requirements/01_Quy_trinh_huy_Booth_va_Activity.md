**QUY TRÌNH HỦY BOOTH VÀ ACTIVITY**

Cancellation & Change Handling

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
| Cancellation Request | Yêu cầu hủy được Partner gửi sau khi nội dung đã được duyệt/phân bổ.                                                   |
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

- Nếu Booth Request hoặc Activity Proposal vẫn ở trạng thái PENDING: Partner được tự Withdraw, không cần Organizer xác nhận. Booth Request đang PENDING chưa tạo Hold nên không có Hold để release.

- Nếu Booth đã được phân hoặc Activity đã Approved/Published: Partner gửi Cancellation Request; Organizer là người xác nhận và xử lý chính thức trên hệ thống.

- Không xóa dữ liệu lịch sử. Hệ thống giữ lại request, lý do hủy, thời điểm hủy và trạng thái để phục vụ báo cáo.

- Nên dùng “Confirm Cancellation” thay vì hiểu Organizer có thể ép Partner tiếp tục. Organizer xác nhận và xử lý hậu quả của việc hủy.

# 3. Hủy Booth / Hủy Booth Assignment

Thực tế không nên “xóa Booth”. Booth là tài nguyên vật lý dùng chung của Đường Sách; chỉ Booth Assignment của Partner trong một Event bị hủy/release.

## 3.1 Khi Booth Request chưa được duyệt

Partner có thể bấm Withdraw Request. Booth chưa được cấp và chưa có Hold nên không cần Organizer duyệt việc rút request; việc rút cũng không ảnh hưởng các request khác đang cùng xin Booth đó.

## 3.2 Khi Booth đã được phân

- Partner mở Booth đã được cấp và chọn “Request Cancellation / Yêu cầu hủy gian hàng”.

- Partner nhập lý do hủy và gửi yêu cầu.

- Organizer nhận yêu cầu trong màn hình quản lý Booth Cancellation Requests.

- Organizer kiểm tra thời điểm hủy, chính sách hoàn tiền và các Activity đang dùng Booth đó.

- Organizer Confirm Cancellation. BoothAssignment chuyển CANCELLED/RELEASED ngay, không chờ tiền thực tế về tài khoản Partner. Nếu đủ điều kiện refund, hệ thống tạo BoothPayment loại REFUND ở trạng thái PENDING, tham chiếu Payment SUCCESS gốc và gửi yêu cầu hoàn tiền bất đồng bộ qua Payment Gateway; Payment gốc vẫn giữ SUCCESS.

- Ngay khi BoothAssignment chuyển RELEASED/CANCELLED, QR của Assignment đó không còn hợp lệ cho lượt quét mới. BoothVisit, Point và Badge đã phát sinh hợp lệ vẫn được giữ làm lịch sử.

- Hệ thống tính lại availability của Booth cho Event/khoảng thời gian liên quan. Booth vật lý không đổi trạng thái ASSIGNED toàn cục.

## 3.3 Hủy Booth sớm và hủy Booth sát giờ

| **Tình huống**         | **Organizer xử lý**                                                                         | **Kết quả**                                                                                 |
|------------------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| Hủy trước cutoff       | Confirm cancellation, hoàn 100%, release Booth và có thể mở lại cho Partner khác.           | Booth có thể trở lại AVAILABLE cho Event/thời gian đó nếu không có Hold/Assignment overlap. |
| Hủy sau cutoff         | Confirm cancellation, không hoàn tiền; release Booth nhưng thường không mở đăng ký tự động. | Organizer quyết định reassign thủ công hay để trống; lưu đầy đủ lịch sử.                    |
| Event bị Organizer hủy | Hủy các Assignment liên quan và hoàn 100% khoản thanh toán Booth.                           | Booth được giải phóng theo Event/time; các Activity được xử lý riêng.                       |

Organizer cấu hình Event.boothCancellationCutoffAt. BoothCancellationRequest.submittedAt \<= cutoff được refund 100%; submittedAt \> cutoff được refund 0%. Nếu Event bị Organizer/System hủy, Partner được hoàn 100%. Số tiền refund lấy từ Payment SUCCESS gốc, không lấy từ giá EventBoothConfig hiện tại. Sau khi Assignment được release, Booth có thể mở lại trước cutoff; sau cutoff, Organizer quyết định reassign thủ công hay để trống.

## 3.4 Activity đang nằm tại Booth bị hủy thì sao?

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

## 4.1 Khi Activity Proposal còn Pending

Partner có thể Withdraw Proposal trực tiếp. Vì Activity chưa được duyệt và chưa public nên không cần Organizer xác nhận.

## 4.2 Khi Activity đã Approved/Published

- Partner chọn Activity và gửi “Activity Cancellation Request”.

- Partner nhập lý do hủy, ghi chú và gửi yêu cầu.

- Organizer xem số người đã đăng ký, thời gian còn lại, địa điểm và khả năng xử lý thay thế.

- Organizer chọn phương án: Confirm Cancel, Reschedule, Change Location hoặc Request More Information.

- Nếu Cancel: Activity chuyển sang Cancelled và hệ thống xử lý tự động các đăng ký liên quan.

- Activity QR không còn hợp lệ để tạo Attendance mới sau khi Activity bị CANCELLED. Attendance, Certificate hoặc ActivityRating đã phát sinh hợp lệ trước đó vẫn được giữ lịch sử; registration chưa scan hợp lệ không được coi là đã tham dự.

## 4.3 Nếu Activity bị hủy sau khi đã có Participant đăng ký

| **Thành phần** | **Xử lý khi Activity Cancelled**              |
|----------------|-----------------------------------------------|
| Activity       | Chuyển trạng thái CANCELLED, vẫn giữ lịch sử. |
| Registration   | Giữ record để theo dõi lịch sử; không xóa.    |
| Participant    | Nhận thông báo hủy/thay đổi lịch.             |

## 4.4 Hủy Activity sát giờ

Ví dụ 14:30 Partner báo không thể tổ chức Activity lúc 15:00. Organizer xác nhận việc hủy ngay trên hệ thống; hệ thống thông báo hàng loạt cho Participant và đóng các đăng ký liên quan. Organizer không xử lý từng người thủ công.

# 5. Partner rút khỏi toàn bộ Event

Đây là trường hợp lớn hơn Cancel Booth hoặc Cancel Activity. Partner chọn “Withdraw from Event” và gửi yêu cầu cho Organizer.

- Organizer xác nhận Partner không còn tham gia Event.

- Khi Organizer xác nhận PartnerWithdrawalRequest, các BoothRequest PENDING kết thúc WITHDRAWN, Active Hold được release và các BoothAssignment ACTIVE được release ngay. Refund của từng Assignment dùng PartnerWithdrawalRequest.submittedAt so với Event.boothCancellationCutoffAt: trước/đúng cutoff 100%, sau cutoff 0%; Event bị Organizer/System hủy thì refund 100% bất kể cutoff. Mỗi Payment SUCCESS gốc đủ điều kiện tạo một REFUND PENDING riêng để gateway xử lý bất đồng bộ; Withdrawal không chờ refund SUCCESS.

- QR của các BoothAssignment bị release mất hiệu lực cho scan mới; dữ liệu BoothVisit/Point/Badge hợp lệ trước đó không bị xóa.

- Các Activity do Partner tổ chức được Cancel hoặc xử lý theo phương án của Organizer.

- Participant đã đăng ký các Activity bị ảnh hưởng được thông báo.

- Các Activity Registration của Activity bị hủy được giữ lại để truy vết, chuyển trạng thái phù hợp và thông báo cho Participant bị ảnh hưởng.

# 6. Business Rule đề xuất

| **Trạng thái / tình huống** | **Partner**                      | **Organizer**                                                                                                                                                                      |
|-----------------------------|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Booth Request - PENDING     | Withdraw trực tiếp; chưa có Hold | Không cần xác nhận                                                                                                                                                                 |
| Booth đã Assigned           | Gửi Cancellation Request         | Confirm + hoàn tiền theo cutoff + release Booth                                                                                                                                    |
| Activity Proposal - Pending | Withdraw trực tiếp               | Không cần xác nhận                                                                                                                                                                 |
| Activity Approved/Published | Gửi Cancellation Request         | Cancel / Reschedule / Change Location                                                                                                                                              |
| Booth hủy trước cutoff      | Gửi yêu cầu                      | Hoàn 100%; release assignment; có thể mở lại nếu còn phù hợp                                                                                                                       |
| Booth hủy sau cutoff        | Gửi yêu cầu                      | Không hoàn tiền; release assignment; thường để trống hoặc chủ động reassign                                                                                                        |
| Activity hủy sát giờ        | Gửi yêu cầu                      | Confirm cancel + notify Participant                                                                                                                                                |
| Rút khỏi Event              | Gửi Withdrawal Request           | Release request/Hold/Assignment ngay; mỗi khoản đủ điều kiện tạo REFUND PENDING theo submittedAt so với Event.boothCancellationCutoffAt; gateway xử lý bất đồng bộ; xử lý Activity |
| Event bị Organizer hủy      | Nhận thông báo                   | Hoàn 100% khoản thanh toán Booth + release Booth + xử lý Activity                                                                                                                  |

# 7. Flow tóm tắt

Booth: Partner chọn Booth → BoothRequest PENDING (chưa Hold, chưa khóa giá) → Organizer chọn request → SELECTED + Hold và khóa giá từ EventBoothConfig → Partner thanh toán thật. Payment attempt FAILED hoặc attempt TIMEOUT được lưu riêng và vẫn có thể retry khi Hold còn hiệu lực; chỉ khi payment window/Hold hết hạn mới chuyển PAYMENT_EXPIRED và release Hold. Payment SUCCESS tạo BoothAssignment và hoàn tất request. Khi hủy: Partner gửi Cancellation Request → Organizer Confirm → hoàn 100% trước cutoff, 0% sau cutoff; Event bị hủy hoàn 100% → release Assignment → tính lại availability.

Activity: Partner Proposal → Organizer Approve → Activity Published → Partner Cancellation Request → Organizer Handle → Cancel/Reschedule/Change Location → System Notify Participant.
