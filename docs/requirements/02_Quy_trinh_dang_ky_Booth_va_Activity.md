**QUY TRÌNH ĐĂNG KÝ BOOTH VÀ ĐỀ XUẤT ACTIVITY**

*Bao phủ đăng ký mới, Hold, duyệt, đổi, hủy Booth và vòng đời Activity*

MVP Baseline — cập nhật 22/09/2026

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
| ActivityChangeRequest | Yêu cầu Partner đổi Activity đã Approved/Published.       | Dùng khi đổi time/location hoặc thay đổi đáng kể cần Organizer xác nhận.                                                                                                                                                             |
| BoothPayment          | Giao dịch thanh toán Booth qua Payment Gateway.           | Giá đã khóa theo Hold. Mỗi PAYMENT/REFUND attempt là record riêng; FAILED hoặc attempt TIMEOUT vẫn có thể retry khi Hold còn hạn. Chỉ payment-window/Hold expiry mới release Hold; backend-verified SUCCESS mới tạo/swap Assignment. |
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

- Partner có thể Withdraw BoothRequest khi request còn PENDING; vì chưa có Hold nên thao tác này chỉ đổi trạng thái request và giữ lịch sử.

- Organizer chỉ được chọn BoothRequest còn hợp lệ. Ngay trước khi chọn, hệ thống re-check quota, deadline và availability để tránh xung đột.

## 3.3 Organizer chọn request, tạo Hold và mở thanh toán

- Organizer xem các request cạnh tranh theo Partner, Event, Booth, quota, deadline, giá của Booth trong Event và category gợi ý; category không phải điều kiện loại cứng.

- Khi Organizer chọn một request, hệ thống re-check availability rồi tạo BoothHold có thời hạn cho đúng Booth. Partner được yêu cầu thanh toán qua Payment Gateway trong thời gian Hold còn hiệu lực.

- Trong lúc candidate được chọn thanh toán, các BoothRequest cạnh tranh còn lại vẫn PENDING. Chỉ sau khi payment SUCCESS và BoothAssignment được tạo, hệ thống mới chuyển các candidate còn lại sang NOT_SELECTED. Nếu payment window của candidate được chọn hết hạn, các candidate còn lại vẫn PENDING để Organizer chọn tiếp. REJECTED chỉ dùng khi Organizer chủ động từ chối vì lý do nghiệp vụ.

- Partner có thể Withdraw BoothRequest khi còn PENDING, không cần Organizer xác nhận và không có Hold để release.

SELECT: BoothRequest hợp lệ → SELECTED → tạo BoothHold ACTIVE và snapshot EventBoothConfig.rentalPrice thành BoothHold.lockedRentalPrice → Partner thanh toán/retry theo giá đã khóa trong payment window → BoothPayment SUCCESS → request COMPLETED + tạo BoothAssignment ACTIVE + consume Hold + competing candidates NOT_SELECTED

PAYMENT ATTEMPT FAILED/TIMEOUT: backend ghi mỗi attempt thành một BoothPayment riêng; nếu Hold còn ACTIVE và còn thời gian thì BoothRequest/BoothChangeRequest vẫn SELECTED và Partner được retry. PAYMENT WINDOW/HOLD EXPIRED: request chuyển PAYMENT_EXPIRED, release Hold, không tạo BoothAssignment và Organizer có thể chọn candidate khác. Attempt TIMEOUT không đồng nghĩa payment window hết hạn. Backend phải xác minh callback/webhook hoặc kết quả server-side; không tin trạng thái SUCCESS chỉ do frontend gửi. REJECT/WITHDRAW khi chưa được chọn: chỉ cập nhật request.

## 3.4 Booth được dùng lại giữa nhiều Event

Booth A05 là tài nguyên vật lý chung. Availability được suy ra: không có EventBoothConfig hoặc isEnabled=false → UNAVAILABLE; isEnabled=true + Active Assignment overlap → ASSIGNED; isEnabled=true + Active Hold overlap → ON_HOLD; còn lại → AVAILABLE. BoothRequest PENDING không làm Booth unavailable. Organizer không được chuyển isEnabled=false khi Event–Booth đang có Active Hold hoặc Active Assignment overlap.

Không dùng Booth.status = ASSIGNED toàn cục và không lưu Partner trực tiếp trên Booth. Quyền sử dụng Booth nằm ở BoothAssignment.

# 4. Sau khi Booth được cấp

Sau khi BoothPayment SUCCESS, hệ thống tạo BoothAssignment ACTIVE cho đúng Partner, Event và Booth đã chọn.

- BoothAssignment là nguồn xác định quyền sử dụng Booth của Partner trong Event và khoảng thời gian tương ứng.

- Khi BoothAssignment RELEASED/CANCELLED hoặc Event kết thúc, quyền sử dụng Booth chấm dứt nhưng lịch sử Assignment và Payment vẫn được giữ.

- Mỗi BoothAssignment ACTIVE có QR riêng. Participant tự quét QR khi ghé Booth; scan hợp lệ tạo BoothVisit gắn EventRegistration + BoothAssignment, tự tạo EventRegistration nếu chưa có. Mỗi cặp này chỉ có tối đa một BoothVisit được tính thưởng.

- BoothVisit hợp lệ tạo Point theo rule; Badge được xét theo total Points tích lũy qua các Event. QR mất hiệu lực khi Assignment/Event kết thúc; scan lặp không tạo thêm BoothVisit hoặc Point được tính thưởng.

# 5. Quy trình đổi Booth đã được cấp

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

# 6. Quy trình hủy Booth đã được cấp

Hủy Booth Assignment khác với Withdraw BoothRequest. Khi Booth đã được cấp, Partner không được tự release ngay mà phải gửi BoothCancellationRequest.

- Partner gửi lý do hủy.

- Organizer kiểm tra thời điểm hủy, cancellation cutoff và các Activity đang phụ thuộc Booth.

- Organizer Confirm Cancellation thì BoothAssignment mới chuyển RELEASED/CANCELLED, availability được tính lại và hệ thống xử lý hoàn tiền theo cutoff.

- BoothCancellationRequest.submittedAt \<= Event.boothCancellationCutoffAt: refund 100%; submittedAt \> cutoff: refund 0%. Event bị Organizer/System hủy: refund 100% bất kể cutoff. Khi Organizer confirm, hệ thống release Assignment ngay và tạo REFUND PENDING từ Payment SUCCESS gốc để gateway xử lý bất đồng bộ; refund FAILED/TIMEOUT được query/retry, không rollback việc hủy.

- Không hard-delete Booth/Assignment lịch sử.

BoothAssignment ACTIVE → BoothCancellationRequest → Organizer Confirm → Assignment RELEASED/CANCELLED

# 7. Quy trình đề xuất Activity của Partner

## 7.1 Partner tạo ActivityProposal

- Partner mở Event mà PartnerEventApplication đã APPROVED.

- Nhập title, description/type, exact start time, exact end time, exact Location và capacity.

- Location có thể là Booth đã được assign cho Partner hoặc Location hợp lệ khác như Main Stage/Workshop Area.

- Gửi ActivityProposal và theo dõi trạng thái PENDING / NEED_CHANGES / APPROVED / REJECTED / WITHDRAWN.

## 7.2 Validation trước khi duyệt

- ActivityProposal PENDING không hard-lock Location/time slot.

- Hệ thống kiểm tra capacity không vượt capacity của Location.

- Hard conflict: cùng physical Location và thời gian overlap thì bị chặn, kể cả Activity thuộc Event khác.

- Ngay trước khi Approve, hệ thống phải check conflict/capacity lại để tránh dữ liệu thay đổi trong thời gian chờ duyệt.

## 7.3 Organizer Review / Approve / Publish

- Organizer có thể Approve, Reject hoặc Request Change/More Information.

- Approve Proposal tạo/cho phép hình thành Activity chính thức; Approve chưa đồng nghĩa public.

- Publish là bước riêng. Chỉ Activity PUBLISHED mới hiển thị như chương trình chính thức cho Guest/Participant.

ActivityProposal → Validation → Organizer Review → APPROVED → Activity → PUBLISHED

# 8. Activity do Ban tổ chức tạo

Organizer có thể tạo trực tiếp Activity của BTC mà không cần ActivityProposal. Tuy vậy Activity vẫn phải tuân thủ Location/time conflict, capacity và lifecycle trước khi Publish.

# 9. Quy trình đổi Activity đã Approved/Published

Nếu Partner muốn đổi time/location của Activity đã Approved/Published, phải gửi ActivityChangeRequest. Không sửa trực tiếp Activity chính thức trước khi Organizer duyệt.

- Activity hiện tại vẫn giữ thông tin đang hiệu lực trong lúc Change Request chờ xử lý.

- Change Request có thể đề xuất time mới, Location mới hoặc thay đổi lớn khác.

- Nếu chỉ đổi nội dung nhỏ không ảnh hưởng lịch/địa điểm, cách xử lý cụ thể có thể do Organizer quyết định; ERD vẫn cho phép Change Request không có Location mới.

- Khi Approve, hệ thống re-check conflict và capacity với dữ liệu mới nhất.

- Nếu đổi time/location của Activity đã có Participant đăng ký, hệ thống phải notify các Participant bị ảnh hưởng và cho phép họ cancel dù đã qua deadline hủy thông thường.

- Nếu đổi sang Booth, Booth đó phải là Location hợp lệ và phải thỏa quyền sử dụng/Assignment của Partner nếu Activity thuộc Partner.

Activity hiện tại → ActivityChangeRequest → Organizer Review → validation lại → Apply change/reschedule → Notify registrations

# 10. Quy trình hủy Activity

## 10.1 Khi ActivityProposal còn PENDING

- Partner có thể Withdraw Proposal trực tiếp; không cần Organizer xác nhận vì chưa có Activity chính thức/public.

## 10.2 Khi Activity đã Approved/Published

- Partner gửi ActivityCancellationRequest và lý do.

- Organizer phải xác nhận trước khi việc hủy có hiệu lực.

- Request sau cancellation cutoff vẫn được tiếp nhận nhưng đánh dấu Late/LATE_CANCELLATION để Organizer xử lý hậu quả.

- Khi Cancel: Activity chuyển CANCELLED; giữ lịch sử Activity Registration và thông báo Participant bị ảnh hưởng.

- Không hard-delete Activity đã phát sinh nghiệp vụ.

Activity APPROVED/PUBLISHED → ActivityCancellationRequest → Organizer Confirm → Activity CANCELLED → Notify Participant

# 11. Activity Registration sau khi Publish

Sau khi Activity được Publish, Participant có thể đăng ký nếu Activity yêu cầu registration và còn capacity.

- Nếu User đăng ký Activity mà chưa có EventRegistration, hệ thống tự tạo EventRegistration trước rồi tạo ActivityRegistration.

- Mỗi Participant chỉ có tối đa một ActivityRegistration active cho cùng một Activity.

- ActivityRegistration dùng để giữ chỗ và quản lý capacity; trạng thái đăng ký phải được cập nhật thay vì xóa lịch sử.

- Yêu cầu đăng ký lặp không được tạo thêm ActivityRegistration active cho cùng Participant và Activity.

- Mỗi Activity có QR riêng. Participant có ActivityRegistration ACTIVE tự quét trong time window hợp lệ để tạo tối đa một Attendance = ATTENDED; không có Attendance Operator, check-in/check-out hoặc attendance duration. ActivityRating cần Attendance hợp lệ; Certificate chỉ được cấp khi Activity đã COMPLETED, Attendance hợp lệ và Activity được cấu hình có Certificate.

Activity PUBLISHED → ActivityRegistration ACTIVE → Participant tự scan Activity QR trong time window → Attendance = ATTENDED → ActivityRating khi đủ điều kiện; sau khi Activity COMPLETED → cấp Certificate nếu Attendance hợp lệ và certificateAvailable=true

# 12. Partner rút khỏi toàn bộ Event

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
| One active Booth Change   | Mỗi Partner tối đa một BoothChangeRequest active trong một Event; request chưa tạo Hold.                                                                                                                                                                                                                                                                                 |
| Payment-gated atomic swap | Booth mới giá cao hơn chỉ atomic swap sau PAYMENT SUCCESS. Giá mới thấp hơn: ghi REFUND PENDING và atomic swap trong cùng một DB transaction, không chờ tiền về; sau commit, backend xử lý refund bất đồng bộ qua Payment Gateway dựa trên Payment SUCCESS gốc. Booth cũ vẫn giữ khi payment phần chênh lệch chưa SUCCESS hoặc khi transaction ghi refund/swap thất bại. |
| Cancellation & refund     | Cancellation/Withdrawal so sánh request.submittedAt với Event.boothCancellationCutoffAt. Khi confirm, release nội bộ ngay; khoản đủ điều kiện tạo REFUND PENDING theo Payment gốc và gateway xử lý bất đồng bộ. Refund failure không rollback cancellation/withdrawal.                                                                                                   |
| Activity conflict         | Cùng physical Location + overlap time bị block; check lại ngay trước Approve.                                                                                                                                                                                                                                                                                            |
| Registration separation   | Event Registration và Activity Registration là hai khái niệm riêng; đăng ký Activity quản lý capacity và trạng thái đăng ký.                                                                                                                                                                                                                                             |
| Keep history              | Request/Assignment/Activity đã phát sinh không hard-delete; dùng status/lifecycle.                                                                                                                                                                                                                                                                                       |
| Event price & category    | Giá thuê theo từng Event–Booth qua EventBoothConfig; khi SELECTED + Hold, giá được snapshot thành BoothHold.lockedRentalPrice và không đổi trong payment window. Booth.categoryCode chỉ gợi ý/ưu tiên, không hard-lock Partner.                                                                                                                                          |
| QR self-scan              | Activity QR thuộc Activity và tạo Attendance từ registration hợp lệ; Booth QR thuộc BoothAssignment ACTIVE và tạo BoothVisit. Không có Attendance Operator/check-in/check-out/duration.                                                                                                                                                                                  |

# 14. Bảng trạng thái chính

| **Đối tượng**               | **Trạng thái chính / lifecycle**                                                                                                                                                                           |
|-----------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| PartnerEventApplication     | PENDING → APPROVED / REJECTED / WITHDRAWN                                                                                                                                                                  |
| BoothRequest                | PENDING → SELECTED → COMPLETED / PAYMENT_EXPIRED; PENDING → NOT_SELECTED / REJECTED / WITHDRAWN                                                                                                            |
| BoothHold                   | ACTIVE → RELEASED / EXPIRED / CONSUMED; chỉ tạo sau Organizer chọn request                                                                                                                                 |
| BoothAssignment             | ACTIVE → RELEASED / CANCELLED / ENDED                                                                                                                                                                      |
| BoothChangeRequest          | PENDING → SELECTED → COMPLETED / PAYMENT_EXPIRED; PENDING → NOT_SELECTED / REJECTED / WITHDRAWN                                                                                                            |
| BoothCancellationRequest    | PENDING → CONFIRMED / REJECTED / WITHDRAWN (tùy final status set)                                                                                                                                          |
| ActivityProposal            | PENDING → NEED_CHANGES → APPROVED / REJECTED / WITHDRAWN                                                                                                                                                   |
| Activity                    | DRAFT / PUBLISHED / ONGOING / COMPLETED / CANCELLED / RESCHEDULED                                                                                                                                          |
| ActivityChangeRequest       | PENDING → APPROVED / REJECTED / WITHDRAWN                                                                                                                                                                  |
| ActivityCancellationRequest | PENDING → CONFIRMED / REJECTED / WITHDRAWN                                                                                                                                                                 |
| ActivityRegistration        | ACTIVE/REGISTERED → CANCELLED / COMPLETED theo lifecycle được triển khai                                                                                                                                   |
| BoothPayment                | transactionType = PAYMENT / REFUND; mỗi gateway attempt là record riêng với status PENDING → SUCCESS / FAILED / TIMEOUT. Attempt TIMEOUT khác payment-window expiry. Payment gốc không đổi thành REFUNDED. |
| Attendance                  | Tối đa một record cho mỗi ActivityRegistration; trạng thái ATTENDED khi self-scan hợp lệ                                                                                                                   |
| BoothVisit                  | Tối đa một lượt được tính thưởng cho mỗi EventRegistration + BoothAssignment                                                                                                                               |

# 15. Flow tổng hợp để team dễ nhớ

## 15.1 Xin Booth mới

Apply Event → APPROVED → Select Booth → BoothRequest PENDING (chưa Hold) → Organizer chọn → Hold → Payment SUCCESS → BoothAssignment ACTIVE

## 15.2 Đổi Booth

Current Assignment ACTIVE → BoothChangeRequest (chưa Hold) → Organizer approve → Replacement Hold + khóa giá → nếu giá tăng: PAYMENT SUCCESS; nếu giá giảm: commit REFUND PENDING cùng atomic swap; nếu bằng: không giao dịch → Assignment mới

## 15.3 Hủy Booth

BoothAssignment → BoothCancellationRequest → Organizer Confirm → release Assignment. Trước/đúng cutoff: tạo REFUND PENDING bằng 100% khoản thanh toán gốc; sau cutoff: không tạo refund transaction; Event bị hủy: tạo REFUND PENDING bằng 100% không phụ thuộc cutoff → gateway xử lý refund bất đồng bộ → xử lý Activity phụ thuộc

## 15.4 Đề xuất Activity

Partner APPROVED → ActivityProposal(time + Location + capacity) → Validation → Organizer Approve → Activity → Publish

## 15.5 Đổi Activity

Activity Approved/Published → ActivityChangeRequest → re-check conflict/capacity → Approve → update/reschedule → notify Participant

## 15.6 Hủy Activity

Activity Approved/Published → ActivityCancellationRequest → Organizer Confirm → CANCELLED → notify Participant và cập nhật registrations

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

Tài liệu này là baseline quy trình Booth + Activity cho MVP hiện tại. Khi requirement thay đổi, cần cập nhật đồng thời Business Rules, Use Case, ERD và tài liệu này để tránh team dùng các flow cũ khác nhau.

Điểm chốt: New Booth = Request (chưa Hold) → Organizer chọn → Hold → Payment → Assignment. Đổi Booth = giữ Assignment cũ → Change Request (chưa Hold) → Organizer approve → Hold mới → Payment/settlement → atomic swap. Activity = Proposal → Approve → Activity → Publish; Activity không có payment trong MVP và đổi/hủy Activity chính thức phải qua Request cùng Organizer xác nhận.
