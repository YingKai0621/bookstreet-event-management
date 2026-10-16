**QUY TRÌNH ĐĂNG KÝ BOOTH VÀ ĐỀ XUẤT ACTIVITY — MVP VÀ THAM CHIẾU POST-MVP**

*Bao phủ đăng ký mới, Hold, duyệt, đổi, hủy Booth và vòng đời Activity*

MVP Baseline — cập nhật 09/10/2026

> **Scope note:** Flow tạo BoothRequest → Hold → Payment → Assignment vẫn là baseline MVP. Các
> phần đổi Booth, hủy Booth sau Assignment, Partner withdrawal sau approval và refund là
> `POST-MVP REFERENCE`. MVP hiện tại chỉ bổ sung Partner withdraw an toàn một BoothRequest
> `SELECTED` trước settlement. Business Rules và tài liệu Sprint 4 có quyền ưu tiên nếu phần tham
> khảo cũ bên dưới khác với chính sách này.

| **Mục tiêu: giúp toàn team hiểu cùng một quy trình từ lúc Partner xin tham gia Event → xin/đổi/hủy Booth → đề xuất/đổi/hủy Activity → các bước sau khi được duyệt. Tài liệu này dùng cùng baseline với Business Rules và ERD hiện tại.** |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 1. Các khái niệm phải phân biệt trước

| **Khái niệm**         | **Hiểu đơn giản**                                         | **Điểm cần nhớ**                                                                                                                                                                                                                     |
|-----------------------|-----------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Physical Booth        | Gian hàng vật lý của Đường Sách, ví dụ A05.               | Tồn tại lâu dài và dùng lại qua nhiều Event; không có trạng thái ASSIGNED toàn cục.                                                                                                                                                  |
| BoothRequest          | Yêu cầu xin một Booth cụ thể của Partner trong một Event. | Gắn Booth được chọn; PENDING không tạo Hold và nhiều Partner có thể cùng request một Booth.                                                                                                                                          |
| BoothHold             | Giữ tạm Booth sau khi Organizer chọn request.             | Có thời hạn trong bước thanh toán; Active Hold chặn xung đột cùng Booth/time.                                                                                                                                                        |
| BoothAssignment       | Quyền sử dụng Booth được tạo sau thanh toán thành công.   | Assignment ACTIVE xác định đúng Booth, Partner, Event và thời gian hiệu lực.                                                                                                                                                         |
| BoothChangeRequest    | Yêu cầu đổi từ Booth đang được cấp sang Booth khác.       | Request chưa tạo Hold; Booth cũ vẫn ACTIVE đến khi payment/settlement Booth mới thành công.                                                                                                                                          |
| ActivityProposal      | Đề xuất Activity do Partner gửi.                          | Chưa phải Activity chính thức cho đến khi Organizer Approve.                                                                                                                                                                         |
| Activity              | Hoạt động chính thức trong Event.                         | Có exact time, exact Location và capacity; Publish là bước riêng sau Approve.                                                                                                                                                        |
| ActivityChangeRequest | Yêu cầu Partner đổi Activity chính thức DRAFT/PUBLISHED.   | Dùng khi đổi nội dung/time/location/capacity/image và cần Organizer xác nhận.                                                                                                                                                         |
| BoothPayment          | Giao dịch thanh toán Booth qua Payment Gateway.           | Active MVP lưu mỗi initial PAYMENT attempt thành record riêng; FAILED hoặc attempt TIMEOUT chỉ retry khi backend time còn trước Hold `expiresAt`. Evidence chưa rõ tiếp tục giữ Hold nhưng chặn retry; backend-verified SUCCESS chỉ tạo Assignment theo lifecycle guard BR-83. REFUND/swap là Post-MVP. |
| EventBoothConfig      | Cấu hình một Booth được cung cấp trong một Event.         | Một record duy nhất cho mỗi Event–Booth; lưu rentalPrice/isEnabled. isEnabled chỉ mở Booth trong Event, không phải availability runtime; không được disable khi có Active Hold/Assignment overlap.                                   |

Câu dễ nhớ: Booth là “CHỖ”; Activity là “VIỆC”. BoothRequest/Hold/Assignment là ba khái niệm khác nhau. ActivityProposal cũng khác Activity chính thức.

# 2. Điều kiện trước: Partner phải được duyệt tham gia Event

- Partner tạo/cập nhật Partner Organization và gửi Apply to Event.

- Organizer Review PartnerEventApplication và Approve hoặc Reject.

- Chỉ PartnerEventApplication = APPROVED mới được tạo BoothRequest hoặc ActivityProposal trong Event đó.

- Partner không bắt buộc phải có Booth mới được đề xuất Activity; Activity có thể diễn ra tại Main Stage, Workshop Area hoặc Location hợp lệ khác.

PartnerOrganization → PartnerEventApplication → APPROVED → được phép Request Booth / Submit Activity Proposal

# 3. Quy trình đăng ký Booth mới

## 3.1 Partner chọn Booth

- Partner mở Booth Map của Event. MVP có map hiển thị và cho chọn Booth; Map Editor nhiều version/click-to-create không nằm trong MVP.

- Map hiển thị availability runtime theo Event/time: AVAILABLE / ON_HOLD / ASSIGNED / UNAVAILABLE. EventBoothConfig.isEnabled chỉ cho biết Booth có được mở trong Event hay không, không phải availability runtime.

- Partner chọn một Booth cụ thể, ví dụ A05. Nhiều Partner có thể cùng gửi request cho A05; BoothRequest chưa làm Booth chuyển sang ON_HOLD.

- Hệ thống kiểm tra Partner đã được duyệt, deadline và quota Booth của Event. Giá được cấu hình cho từng cặp Event–Booth qua EventBoothConfig; Booth category chỉ dùng để gợi ý/ưu tiên phù hợp, không phải điều kiện cứng để chặn request.

## 3.2 Gửi BoothRequest — chưa tạo Hold

Khi Partner bấm Submit, hệ thống chỉ tạo BoothRequest ở trạng thái PENDING cho Booth đã chọn; không tạo BoothHold. Nhiều BoothRequest PENDING có thể cùng nhắm tới một Booth để Organizer so sánh và lựa chọn.

Select A05 → validate eligibility/deadline/quota → BoothRequest(PENDING, booth=A05) — chưa có Hold

- BoothRequest PENDING không khóa Booth và không ngăn Partner khác gửi request cho cùng Booth. Chỉ Hold được tạo sau khi Organizer chọn request mới chặn xung đột trong thời gian thanh toán.

- Partner có thể Withdraw BoothRequest khi PENDING. Khi SELECTED, Partner cũng có thể withdraw và release Hold nếu không có Payment PENDING/SUCCESS, reconciliation conflict hoặc Assignment.

- Organizer chỉ được chọn BoothRequest còn hợp lệ. Ngay trước khi chọn, hệ thống re-check quota, deadline và availability để tránh xung đột.

## 3.3 Organizer chọn request, tạo Hold và mở thanh toán

- Organizer xem các request cạnh tranh theo Partner, Event, Booth, quota, deadline, giá của Booth trong Event và category gợi ý; category không phải điều kiện loại cứng.

- Khi Organizer chọn một request, hệ thống re-check availability rồi tạo BoothHold có thời hạn cho đúng Booth. Partner được yêu cầu thanh toán qua Payment Gateway trong thời gian Hold còn hiệu lực.

- Trong lúc candidate được chọn thanh toán, các BoothRequest cạnh tranh còn lại vẫn PENDING. Chỉ sau khi payment SUCCESS và BoothAssignment được tạo, hệ thống mới chuyển các candidate còn lại sang NOT_SELECTED. Nếu payment window của candidate được chọn hết hạn, các candidate còn lại vẫn PENDING để Organizer chọn tiếp. REJECTED chỉ dùng khi Organizer chủ động từ chối vì lý do nghiệp vụ.

- Partner có thể Withdraw BoothRequest PENDING trực tiếp. Request SELECTED được withdraw kèm release Hold trong cùng transaction khi thỏa điều kiện an toàn; candidate khác vẫn PENDING để Organizer chọn thủ công.

SELECT: BoothRequest hợp lệ → SELECTED → tạo BoothHold ACTIVE và snapshot EventBoothConfig.rentalPrice thành BoothHold.lockedRentalPrice → Partner thanh toán/retry theo giá đã khóa trong payment window → BoothPayment SUCCESS → request COMPLETED + tạo BoothAssignment ACTIVE + consume Hold + competing candidates NOT_SELECTED

PAYMENT ATTEMPT FAILED/TIMEOUT: backend ghi mỗi attempt thành một BoothPayment riêng; nếu Hold còn ACTIVE và backend time trước `expiresAt` thì BoothRequest vẫn SELECTED và Partner được retry hoặc withdraw an toàn. PAYMENT WINDOW/HOLD EXPIRED: khi không có evidence chưa chắc chắn, request chuyển PAYMENT_EXPIRED, release Hold, không tạo BoothAssignment và Organizer có thể chọn candidate khác. Attempt TIMEOUT không đồng nghĩa payment window hết hạn. Payment PENDING hoặc reconciliation conflict tiếp tục chặn withdraw/reassign dù `expiresAt` đã qua. Backend phải xác minh callback/webhook hoặc kết quả server-side; không tin trạng thái SUCCESS chỉ do frontend gửi.

Nếu evidence chưa chắc chắn kéo dài qua `startAt`, Event vẫn chuyển sang ONGOING theo backend time
và Hold tiếp tục chặn attempt/reassignment mới. Trusted SUCCESS tạo Assignment khi Event còn
PUBLISHED/ONGOING; sau COMPLETED/CANCELLED, hệ thống chỉ giữ evidence để đối soát thủ công và không
tạo Assignment. Terminal failure/timeout đã xác minh cho phép expiry flow đóng Hold/request nhưng
không tự chọn candidate khác sau Booth deadline.

## 3.4 Booth được dùng lại giữa nhiều Event

Booth A05 là tài nguyên vật lý chung. Availability được suy ra: không có EventBoothConfig hoặc isEnabled=false → UNAVAILABLE; isEnabled=true + Active Assignment overlap → ASSIGNED; isEnabled=true + Active Hold overlap → ON_HOLD; còn lại → AVAILABLE. BoothRequest PENDING không làm Booth unavailable. Organizer không được chuyển isEnabled=false khi Event–Booth đang có Active Hold hoặc Active Assignment overlap.

Không dùng Booth.status = ASSIGNED toàn cục và không lưu Partner trực tiếp trên Booth. Quyền sử dụng Booth nằm ở BoothAssignment.

# 4. Sau khi Booth được cấp

Sau khi BoothPayment SUCCESS hợp lệ khi Event còn PUBLISHED/ONGOING, hệ thống tạo BoothAssignment ACTIVE cho đúng Partner, Event và Booth đã chọn. Nếu Event đã COMPLETED/CANCELLED thì chỉ giữ evidence để đối soát và không tạo Assignment.

- BoothAssignment là nguồn xác định quyền sử dụng Booth của Partner trong Event và khoảng thời gian tương ứng.

- Khi BoothAssignment RELEASED/CANCELLED hoặc Event kết thúc, quyền sử dụng Booth chấm dứt nhưng lịch sử Assignment và Payment vẫn được giữ.

- Mỗi BoothAssignment ACTIVE có QR riêng. Participant tự quét QR khi ghé Booth; scan hợp lệ tạo BoothVisit gắn EventRegistration + BoothAssignment, tự tạo EventRegistration nếu chưa có. Mỗi cặp này chỉ có tối đa một BoothVisit được tính thưởng.

- BoothVisit hợp lệ tạo Point theo rule; Badge được xét theo total Points tích lũy qua các Event. QR mất hiệu lực khi Assignment/Event kết thúc; scan lặp không tạo thêm BoothVisit hoặc Point được tính thưởng.

# 5. Quy trình đổi Booth đã được cấp — POST-MVP REFERENCE

## 5.1 Vì sao không release Booth cũ ngay?

Khi Partner đang có A05 và muốn đổi sang A07, A05 phải tiếp tục giữ Assignment trong lúc chờ duyệt. Nếu thả A05 ngay mà A07 bị Reject/Expire thì Partner có thể mất cả Booth cũ lẫn Booth mới.

Current Assignment A05 → BoothChangeRequest xin A07 (chưa Hold) → Organizer chọn/approve → Hold A07 → thanh toán/settlement

## 5.2 Tạo BoothChangeRequest

- Partner chọn Booth mới mong muốn và gửi BoothChangeRequest cho Assignment hiện tại. Request đổi chưa tạo Hold và có thể cùng tồn tại với request khác cho Booth mới.

- Hệ thống chỉ ghi nhận BoothChangeRequest; Booth cũ vẫn ACTIVE. Hold cho Booth mới chỉ được tạo sau khi Organizer chấp thuận yêu cầu đổi.

- Mỗi Partner chỉ được có tối đa một BoothChangeRequest active trong cùng một Event tại một thời điểm.

- Khi Organizer chấp thuận, hệ thống tạo Hold có thời hạn cho Booth mới và mở bước thanh toán/settlement. Booth cũ vẫn ACTIVE cho đến khi bước này hoàn tất.

- Settlement dùng giá Booth mới đã snapshot vào Replacement Hold và giá đã thanh toán của Assignment cũ. Giá mới cao hơn: Partner phải PAYMENT phần chênh lệch và chỉ SUCCESS mới atomic swap. Giá mới thấp hơn: trong cùng một DB transaction, hệ thống ghi bền vững BoothPayment loại REFUND ở trạng thái PENDING, tham chiếu Payment SUCCESS gốc, rồi release Assignment cũ, consume Replacement Hold, tạo Assignment mới và hoàn tất BoothChangeRequest. Nếu không ghi được REFUND PENDING thì toàn bộ transaction rollback và Booth cũ vẫn ACTIVE. Sau khi transaction commit, backend mới gửi refund bất đồng bộ qua Payment Gateway; không chờ tiền thực tế về tài khoản. Payment gốc vẫn SUCCESS; không dùng status REFUNDED và không tạo entity Refund riêng.

## 5.3 Organizer xử lý Change

- Sau khi thanh toán/settlement thành công, hệ thống atomic swap: kiểm tra Hold mới còn hợp lệ → release Assignment cũ → consume Hold mới → tạo Result BoothAssignment mới.

- Nếu bất kỳ bước nào lỗi, toàn bộ transaction rollback; Booth cũ vẫn giữ nguyên.

- REJECTED/WITHDRAWN trước selection chỉ đóng request. Một payment attempt FAILED hoặc attempt TIMEOUT vẫn cho retry nếu Replacement Hold còn ACTIVE. Khi payment window/Hold hết hạn, BoothChangeRequest chuyển PAYMENT_EXPIRED và release Hold mới. Booth cũ giữ Assignment cho đến PAYMENT phần chênh lệch SUCCESS. Nếu giá mới thấp hơn, REFUND PENDING và atomic swap phải được commit trong cùng một DB transaction; nếu giá bằng nhau thì swap không cần giao dịch tiền.

- Trước khi Booth cũ được reassign cho đơn vị khác, các Activity đang dùng Booth đó phải được move hoặc cancel theo quy trình Activity.

SUCCESS: A05 Assignment → RELEASED \| A07 Hold → CONSUMED \| tạo A07 Assignment ACTIVE trong một transaction

REJECTED/WITHDRAWN: không tạo Hold A07 \| PAYMENT_EXPIRED: release Hold A07 \| A05 vẫn ACTIVE trong mọi trường hợp chưa SUCCESS

# 6. Quy trình hủy Booth đã được cấp — POST-MVP REFERENCE

Hủy Booth Assignment khác với Withdraw BoothRequest. Khi Booth đã được cấp, Partner không được tự release ngay mà phải gửi BoothCancellationRequest.

- Partner gửi lý do hủy.

- Organizer kiểm tra thời điểm hủy, cancellation cutoff và các Activity đang phụ thuộc Booth.

- Organizer Confirm Cancellation thì BoothAssignment mới chuyển RELEASED/CANCELLED, availability được tính lại và hệ thống xử lý hoàn tiền theo cutoff.

- BoothCancellationRequest.submittedAt \<= Event.boothCancellationCutoffAt: refund 100%; submittedAt \> cutoff: refund 0%. Event bị Organizer/System hủy: refund 100% bất kể cutoff. Khi Organizer confirm, hệ thống release Assignment ngay và tạo REFUND PENDING từ Payment SUCCESS gốc để gateway xử lý bất đồng bộ; refund FAILED/TIMEOUT được query/retry, không rollback việc hủy.

- Không hard-delete Booth/Assignment lịch sử.

BoothAssignment ACTIVE → BoothCancellationRequest → Organizer Confirm → Assignment RELEASED/CANCELLED

# 7. Quy trình đề xuất Activity của Partner

## 7.1 Partner tạo ActivityProposal

- Partner mở Event `PUBLISHED` mà PartnerEventApplication đã `APPROVED`.
- Hệ thống không lưu Draft Proposal. Lệnh tạo hợp lệ ghi ngay Proposal `PENDING`, `submittedAt`
  và `updatedAt`; lần submit đầu chấp nhận đến đúng `activityProposalDeadlineAt`.
- Partner nhập title, description/type, exact start/end, exact Location và capacity. Thời gian phải
  ở tương lai, nằm trọn trong Event và dùng UTC Instant.
- Location dùng chung có thể là `STAGE`, `WORKSHOP` hoặc `AREA`. Partner không cần có Booth để đề
  xuất Activity. Nếu chọn `BOOTH`, Booth phải có Assignment `ACTIVE` của đúng Partner trong cùng
  Event ở cả lúc submit và approve.
- Proposal theo dõi một trong các trạng thái `PENDING`, `NEED_CHANGES`, `APPROVED`, `REJECTED`,
  `WITHDRAWN`, `CANCELLED`.

## 7.2 Validation trước khi duyệt

- Title sau normalize dài 1–200; activityType 1–50; description tối đa 5.000. Proposal Sprint 5
  chưa mang image/registration configuration; các field đó được Organizer cấu hình trên Activity
  Draft hoặc Partner đề xuất image về sau qua Change Request.
- Capacity là số dương và không vượt `Location.maxCapacity`.
- Proposal `PENDING` không khóa Location/time slot và không tính quota Activity chính thức.
- Hard conflict chỉ áp dụng khi tạo/cập nhật Activity chính thức: cùng physical Location và khoảng
  `[startAt, endAt)` overlap bị chặn, kể cả Activity thuộc Event khác. Hai khoảng chạm biên được phép.
- `maxActivitiesPerPartner=0` nghĩa là Partner không được có Activity. Quota đếm Activity chính
  thức của Partner có status khác `CANCELLED`.
- Ngay trước approve, hệ thống khóa Event trước, recheck Event/Application/Booth ownership,
  Location/capacity/quota/conflict và dùng database exclusion constraint làm chốt cuối.

## 7.3 Organizer Review / Approve / Publish

- Chỉ Proposal `PENDING` được review. Organizer có thể Approve, Reject hoặc Request Changes.
- Organizer không được âm thầm đổi nội dung Proposal trong lệnh approve. Nếu cần sửa, Proposal
  chuyển `NEED_CHANGES` cùng review note.
- Partner được sửa `PENDING` đến deadline. Proposal `NEED_CHANGES` được revise/resubmit sau deadline
  chung nếu Event còn `PUBLISHED`/`ONGOING` và backend time vẫn trước proposed start; resubmit về
  `PENDING`.
- Approve atomically chuyển Proposal sang `APPROVED` và tạo đúng một Activity `DRAFT`. Approve lặp
  lại trả Activity cũ, không tạo bản sao.
- Publish là bước riêng. Activity chỉ public sau khi `PUBLISHED`; publish lặp lại không tạo lại QR,
  timestamp hoặc email.

ActivityProposal → Validation → Organizer Review → APPROVED → Activity → PUBLISHED

# 8. Activity do Ban tổ chức tạo

Organizer có thể tạo trực tiếp Activity của BTC mà không cần ActivityProposal, nhưng trong Sprint 5
chỉ được dùng Location chung `STAGE`, `WORKSHOP` hoặc `AREA`. Organizer không được dùng flow này để
chiếm Booth đã cấp cho Partner; Activity tại `BOOTH` chỉ hình thành từ Proposal hợp lệ của Partner
đang sở hữu Assignment. Activity BTC vẫn phải qua validation, conflict và lifecycle trước publish.

# 9. Quy trình đổi Activity chính thức DRAFT/PUBLISHED

Partner không sửa trực tiếp Activity chính thức. Activity của Partner được nhận diện bằng source
Proposal và chỉ nhận Change Request khi còn `DRAFT` hoặc `PUBLISHED`.

- Activity hiện tại giữ dữ liệu có hiệu lực trong khi request `PENDING`.
- Request có thể đề xuất title, description, activityType, Location, start/end, capacity hoặc image
  URL; phải có ít nhất một thay đổi thực. `requestedStartAt` và `requestedEndAt` phải xuất hiện cùng
  nhau.
- Dữ liệu mới được merge với Activity hiện tại rồi validate đầy đủ ở submit và approve.
- Nếu đổi sang Booth, phải recheck Assignment `ACTIVE` đúng Partner/cùng Event.
- Mỗi Activity chỉ có tối đa một request `PENDING` tổng cộng giữa Change và Cancellation.
- Approve atomically cập nhật Activity. Activity đang `PUBLISHED` vẫn `PUBLISHED`; reschedule được
  ghi audit, không tạo status `RESCHEDULED`.
- Sprint 5 gửi email sau commit cho representative Partner bị ảnh hưởng. Notification cho
  Participant đã đăng ký được nối ở Sprint Participant sau này.

Activity hiện tại → ActivityChangeRequest → Organizer Review → validation lại → Apply audited
change → email Partner sau commit; notify registrations khi module Participant được triển khai

# 10. Quy trình hủy Activity

## 10.1 Khi ActivityProposal còn mở

- Partner có thể withdraw Proposal `PENDING` hoặc `NEED_CHANGES`; lệnh lặp lại trả trạng thái cũ.
- Event cancellation chuyển Proposal còn mở sang `CANCELLED`.

## 10.2 Khi Activity đã chính thức

- Partner gửi ActivityCancellationRequest với reason sau normalize dài 10–500 ký tự; Activity phải
  thuộc Partner qua source Proposal và chưa terminal.
- Gửi tại `now <= activityCancellationCutoffAt` có `isLate=false`; sau biên vẫn nhận nhưng đánh dấu
  `isLate=true`.
- Submit không hủy Activity. Organizer approve mới atomically chuyển Activity sang `CANCELLED`,
  lưu `cancelledAt`, reason và source `PARTNER_REQUEST`.
- Organizer hủy trực tiếp dùng source `ORGANIZER`; Event cancellation dùng `EVENT_CANCELLATION`;
  lifecycle cleanup dùng `SYSTEM`.
- Request `PENDING` bị đóng `CANCELLED` khi Event/Activity terminal hóa. Không hard-delete lịch sử.
- Cancel lặp lại trả state/metadata đầu tiên, không gửi email lặp. Lệnh xung đột khác trên terminal
  state trả `409`.

Activity chính thức → ActivityCancellationRequest → Organizer Approve → Activity CANCELLED →
email Partner sau commit; notify Participant khi module Participant được triển khai

# 11. Activity Registration sau khi Publish

Sprint 5 chỉ chuẩn bị contract và dữ liệu cho Sprint Participant. Activity có
`registrationRequired`:

- Nếu `false`, `registrationDeadlineAt` phải null, `isCertificateEnabled=false` và không phát sinh
  ActivityRegistration/Attendance/Certificate.
- Nếu `true`, trước publish phải có `registrationDeadlineAt <= startAt`; QR attendance được tạo
  đúng một lần khi publish. `isCertificateEnabled=true` chỉ hợp lệ trong trường hợp này.

Khi module Participant được triển khai, Participant có thể đăng ký Activity `PUBLISHED` yêu cầu
registration nếu còn capacity và deadline chưa qua.

- Nếu User đăng ký Activity mà chưa có EventRegistration, hệ thống tự tạo EventRegistration trước rồi tạo ActivityRegistration.

- Mỗi Participant chỉ có tối đa một ActivityRegistration active cho cùng một Activity.

- ActivityRegistration dùng để giữ chỗ và quản lý capacity; trạng thái đăng ký phải được cập nhật thay vì xóa lịch sử.

- Yêu cầu đăng ký lặp không được tạo thêm ActivityRegistration active cho cùng Participant và Activity.

- Mỗi Activity có QR riêng. Participant có ActivityRegistration ACTIVE tự quét trong time window hợp lệ để tạo tối đa một Attendance = ATTENDED; không có Attendance Operator, check-in/check-out hoặc attendance duration. ActivityRating cần Attendance hợp lệ; Certificate chỉ được cấp khi Activity đã COMPLETED, Attendance hợp lệ và Activity được cấu hình có Certificate.

Activity PUBLISHED → ActivityRegistration ACTIVE → Participant tự scan Activity QR trong time window → Attendance = ATTENDED → ActivityRating khi đủ điều kiện; sau khi Activity COMPLETED → cấp Certificate nếu Attendance hợp lệ và certificateAvailable=true

# 12. Partner rút khỏi toàn bộ Event — POST-MVP REFERENCE

Withdraw from Event là nghiệp vụ lớn hơn hủy một Booth hoặc một Activity. Partner gửi PartnerWithdrawalRequest và Organizer xác nhận trước khi rút có hiệu lực. Khi xác nhận, request PENDING chuyển WITHDRAWN, Active Hold và BoothAssignment được release ngay. Refund cho mỗi Payment SUCCESS gốc đủ điều kiện dùng PartnerWithdrawalRequest.submittedAt so với Event.boothCancellationCutoffAt: trước/đúng cutoff 100%, sau cutoff 0%; Event bị Organizer/System hủy refund 100%. Mỗi khoản tạo REFUND PENDING riêng và được gateway xử lý bất đồng bộ; Withdrawal không chờ refund SUCCESS.

- Release/cancel các BoothAssignment theo quy trình phù hợp.

- Xử lý các Activity của Partner: cancel/move/reschedule tùy trường hợp.

- Thông báo Participant bị ảnh hưởng và giữ lịch sử nghiệp vụ.

# 13. Các rule quan trọng cần nhớ khi code

| **Rule**                  | **Ý nghĩa thực tế**                                                                                                                                                                                                                                                                                                                                                      |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Request before Hold       | Submit chỉ tạo BoothRequest PENDING; nhiều Partner có thể request cùng Booth.                                                                                                                                                                                                                                                                                            |
| Hold after selection      | Organizer chọn request rồi hệ thống mới tạo Hold có thời hạn cho bước thanh toán.                                                                                                                                                                                                                                                                                        |
| No global ASSIGNED        | Booth không có status ASSIGNED toàn cục. EventBoothConfig.isEnabled khác availability; runtime state suy ra từ isEnabled, Active Hold/Assignment và allocation time.                                                                                                                                                                                                     |
| Pre-settlement release    | Partner có thể withdraw SELECTED request và release Hold khi không có Payment PENDING/SUCCESS, reconciliation conflict hoặc Assignment.                                                                                                                                                                                                                                  |
| Post-MVP Booth Change     | BoothChangeRequest và payment/refund chênh lệch được giữ làm tham chiếu tương lai, không phải MVP hiện tại.                                                                                                                                                                                                                                                               |
| Post-MVP refund           | Cancellation/Withdrawal sau Assignment và business refund không có API/workflow trong MVP hiện tại.                                                                                                                                                                                                                                                                      |
| Activity conflict         | Cùng physical Location + overlap time bị block; check lại ngay trước Approve.                                                                                                                                                                                                                                                                                            |
| Registration separation   | Event Registration và Activity Registration là hai khái niệm riêng; đăng ký Activity quản lý capacity và trạng thái đăng ký.                                                                                                                                                                                                                                             |
| Keep history              | Request/Assignment/Activity đã phát sinh không hard-delete; dùng status/lifecycle.                                                                                                                                                                                                                                                                                       |
| Event price & category    | Giá thuê theo từng Event–Booth qua EventBoothConfig; khi SELECTED + Hold, giá được snapshot thành BoothHold.lockedRentalPrice và không đổi trong payment window. Booth.categoryCode chỉ gợi ý/ưu tiên, không hard-lock Partner.                                                                                                                                          |
| QR self-scan              | Activity QR thuộc Activity và tạo Attendance từ registration hợp lệ; Booth QR thuộc BoothAssignment ACTIVE và tạo BoothVisit. Không có Attendance Operator/check-in/check-out/duration.                                                                                                                                                                                  |

# 14. Bảng trạng thái chính

| **Đối tượng**               | **Trạng thái chính / lifecycle**                                                                                                                                                                           |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| PartnerEventApplication     | PENDING → APPROVED / REJECTED / WITHDRAWN                                                                                                                                                                  |
| BoothRequest                | PENDING → SELECTED → COMPLETED / PAYMENT_EXPIRED; PENDING → NOT_SELECTED / REJECTED / WITHDRAWN; SELECTED → WITHDRAWN khi release an toàn; PENDING/SELECTED → CANCELLED khi Event bị hủy |
| BoothHold                   | ACTIVE → RELEASED / EXPIRED / CONSUMED; chỉ tạo sau Organizer chọn request                                                                                                                                 |
| BoothAssignment             | MVP hiện tại tạo ACTIVE; RELEASED/CANCELLED/ENDED thuộc lifecycle tương lai hoặc kết thúc Event được triển khai sau                                                                                       |
| BoothChangeRequest          | POST-MVP REFERENCE                                                                                                                                                                                         |
| BoothCancellationRequest    | POST-MVP REFERENCE                                                                                                                                                                                         |
| ActivityProposal            | PENDING → NEED_CHANGES / APPROVED / REJECTED / WITHDRAWN / CANCELLED; NEED_CHANGES → PENDING / WITHDRAWN / CANCELLED                                                                                        |
| Activity                    | DRAFT → PUBLISHED → ONGOING → COMPLETED; DRAFT/PUBLISHED/ONGOING → CANCELLED; COMPLETED/CANCELLED terminal; không có persisted RESCHEDULED                                                                  |
| ActivityChangeRequest       | PENDING → APPROVED / REJECTED / WITHDRAWN / CANCELLED                                                                                                                                                      |
| ActivityCancellationRequest | PENDING → APPROVED / REJECTED / WITHDRAWN / CANCELLED                                                                                                                                                      |
| ActivityRegistration        | ACTIVE/REGISTERED → CANCELLED / COMPLETED theo lifecycle được triển khai                                                                                                                                   |
| BoothPayment                | MVP tạo transactionType=PAYMENT cho initial rental; mỗi gateway attempt là record riêng với status PENDING → SUCCESS / FAILED / TIMEOUT. REFUND chỉ là extension point Post-MVP. |
| Attendance                  | Tối đa một record cho mỗi ActivityRegistration; trạng thái ATTENDED khi self-scan hợp lệ                                                                                                                   |
| BoothVisit                  | Tối đa một lượt được tính thưởng cho mỗi EventRegistration + BoothAssignment                                                                                                                               |

# 15. Flow tổng hợp để team dễ nhớ

## 15.1 Xin Booth mới

Apply Event → APPROVED → Select Booth → BoothRequest PENDING (chưa Hold) → Organizer chọn → Hold → Payment SUCCESS khi Event PUBLISHED/ONGOING → BoothAssignment ACTIVE

## 15.2 Đổi Booth — POST-MVP REFERENCE

Current Assignment ACTIVE → BoothChangeRequest (chưa Hold) → Organizer approve → Replacement Hold + khóa giá → nếu giá tăng: PAYMENT SUCCESS; nếu giá giảm: commit REFUND PENDING cùng atomic swap; nếu bằng: không giao dịch → Assignment mới

## 15.3 Hủy Booth — POST-MVP REFERENCE

BoothAssignment → BoothCancellationRequest → Organizer Confirm → release Assignment. Trước/đúng cutoff: tạo REFUND PENDING bằng 100% khoản thanh toán gốc; sau cutoff: không tạo refund transaction; Event bị hủy: tạo REFUND PENDING bằng 100% không phụ thuộc cutoff → gateway xử lý refund bất đồng bộ → xử lý Activity phụ thuộc

## 15.4 Đề xuất Activity

Partner APPROVED → submit ActivityProposal PENDING trước/đúng deadline → Organizer Approve atomically → Activity DRAFT → Publish

## 15.5 Đổi Activity

Activity DRAFT/PUBLISHED của Partner → ActivityChangeRequest → merge + re-check toàn bộ → Approve → audited update; nếu public thì giữ PUBLISHED

## 15.6 Hủy Activity

Activity chính thức của Partner → ActivityCancellationRequest PENDING → Organizer Approve → Activity CANCELLED + cancellation metadata

## 15.7 Participant sau khi Activity được publish

Register Activity → ActivityRegistration ACTIVE → tự scan Activity QR hợp lệ → Attendance = ATTENDED → Rating khi đủ điều kiện; Activity COMPLETED → Certificate nếu đủ điều kiện

## 15.8 Khám phá Booth

Scan QR của BoothAssignment ACTIVE → auto-create EventRegistration nếu thiếu → BoothVisit → Point → xét Badge theo total Points

# 16. Phạm vi MVP liên quan tài liệu này

- Có Booth Map để Guest/Partner xem và Partner chọn Booth cụ thể.

- Có CRUD Location/Booth thông thường.

- Không làm Advanced Map Editor: nhiều map version, click-to-create Location/Booth, drag/drop là Future/Stretch scope.

- Có Payment Gateway và thanh toán Booth thật trong MVP; giá cấu hình cho từng Event–Booth. Gateway credentials/webhook là backend environment configuration, không phải màn hình Admin trong MVP. Paid Activity/ticket, waitlist, staff scheduling, reward redemption và equipment inventory không nằm trong MVP.

# 17. Kết luận

Các phần không đánh dấu Post-MVP là baseline quy trình Booth + Activity cho MVP hiện tại. Khi requirement thay đổi, cần cập nhật đồng thời Business Rules, Use Case, ERD và tài liệu này để tránh team dùng các flow cũ khác nhau.

Điểm chốt MVP: New Booth = Request (chưa Hold) → Organizer chọn → Hold → Payment → Assignment. Trước settlement, Partner được release Hold theo điều kiện an toàn; sau Assignment không đổi/hủy Booth và không business refund. Activity = Proposal PENDING (không khóa chỗ) → approve atomically thành Activity DRAFT (khóa slot) → Publish; Activity không có payment trong MVP, không có status RESCHEDULED, và Partner đổi/hủy Activity chính thức phải qua một request PENDING duy nhất cùng Organizer xác nhận.
