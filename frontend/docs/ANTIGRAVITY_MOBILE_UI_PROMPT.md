# PROMPT DÀNH CHO ANTIGRAVITY

## Tối ưu toàn bộ giao diện mobile — Đường Sách TP.HCM

Bạn đang làm việc trong dự án web Đường Sách TP.HCM hiện có. Hãy trực tiếp kiểm tra mã nguồn, chạy ứng dụng và hoàn thiện toàn bộ giao diện trên điện thoại. Đây là nhiệm vụ sửa responsive và tổ chức lại trải nghiệm mobile, không phải thiết kế lại thương hiệu.

### Mục tiêu bắt buộc

1. Giữ nguyên giao diện desktop hiện tại vì phiên bản desktop đã hoàn chỉnh. Không thay đổi bố cục, kích thước, khoảng cách, typography, hình ảnh hoặc hành vi ở màn hình desktop.
2. Chỉ thêm hoặc điều chỉnh quy tắc dành cho mobile/tablet nhỏ. Ưu tiên media query có phạm vi rõ ràng; tránh sửa style nền dùng chung nếu có thể ảnh hưởng desktop.
3. Làm cho mọi trang và mọi trạng thái hiện có vừa vặn, dễ đọc và dễ thao tác trên điện thoại.
4. Thu gọn card, khoảng trắng, hình ảnh và typography một cách có hệ thống. “Nhỏ lại” không có nghĩa là nhồi nhét: phải giữ phân cấp thị giác và vùng chạm đủ lớn.
5. Đồng bộ ngôn ngữ thiết kế giữa trang công khai, không gian di sản, trang chi tiết, form/modal và trang quản trị.

### Kiến thức thiết kế mobile phải áp dụng

Áp dụng các nguyên tắc từ skill `mobile-app-ui-design` của dự án (nguồn tham khảo: https://github.com/ceorkm/mobile-app-ui-design):

- Thiết kế và kiểm tra từ baseline 375px.
- Tất cả vùng chạm tương tác tối thiểu 44×44 CSS px, kể cả khi biểu tượng hiển thị nhỏ hơn.
- Đặt hành động chính ở vị trí dễ với ngón cái; không để CTA quan trọng bị che hoặc quá sát mép.
- Dùng hệ khoảng cách 8pt: 4, 8, 12, 16, 24, 32, 48px.
- Mỗi màn hình có một điểm nhấn chính; giảm yếu tố cạnh tranh sự chú ý.
- Nội dung theo thứ tự đọc tự nhiên, ưu tiên thông tin cần thiết và giảm số lần chạm.
- Typography mobile tối đa khoảng 4 cấp cỡ chữ và 2 độ đậm chính trong cùng một khu vực.
- Bảo đảm tương phản, focus state, trạng thái loading/empty/error/success và `prefers-reduced-motion`.
- Giữ phong cách văn hóa, trang trọng và gần gũi của Đường Sách; không biến giao diện thành mẫu SaaS/mobile generic.

### Viewport và breakpoint nghiệm thu

Phải kiểm tra tối thiểu:

- 320×568 — điện thoại rất nhỏ.
- 360×800 — Android phổ biến.
- 375×667 — baseline mobile.
- 390×844 — iPhone phổ biến.
- 430×932 — điện thoại lớn.
- 768×1024 — tablet dọc, chỉ để xác nhận chuyển tiếp breakpoint.
- Desktop 1280px và 1440px — visual regression; giao diện phải giữ nguyên.

Không được xuất hiện thanh cuộn ngang ngoài chủ ý. Không dùng `overflow-x: hidden` để che một layout đang vỡ; phải sửa nguyên nhân về width, min-width, grid, flex hoặc positioning.

## Phạm vi phải hoàn thiện

### 1. Header và menu mobile

- Giữ logo dễ nhận diện nhưng cân lại chiều rộng để đủ chỗ cho Di sản, ngôn ngữ và menu.
- Vùng chạm của menu, đổi ngôn ngữ và bookmark Di sản phải đạt 44×44px.
- Bookmark Di sản không được che nội dung hero hoặc chiếm chiều cao quá mức.
- Menu dạng drawer phải vừa màn hình, có nền che hợp lý, nút đóng rõ ràng, focus trap, đóng bằng Escape và khóa scroll nền.
- Các mục điều hướng có khoảng cách chạm thoải mái; badge quản trị không làm lệch hàng.
- Khi chuyển trang hoặc cuộn đến section, menu tự đóng và tiêu đề section không bị header sticky che.

### 2. Trang chủ và hero

- Giữ nguyên tinh thần hình ảnh và nhận diện desktop.
- Cân lại chiều cao hero cho mobile; nội dung quan trọng phải xuất hiện sớm, không cần cuộn quá nhiều mới thấy CTA.
- Bảo đảm tương phản chữ trên ảnh nền trong mọi vùng ảnh.
- Tiêu đề không ngắt dòng vụn hoặc tạo một dòng chỉ có 1–2 từ thiếu cân đối.
- Ô tìm kiếm phải đủ cao, không bị nút Tìm kiếm ép nhỏ; cho phép xếp dọc nếu cần ở 320–360px.
- Chip gợi ý nhỏ gọn về hình thức nhưng vùng chạm vẫn đủ 44px; cho phép cuộn ngang có chủ đích hoặc wrap gọn.
- Nút chính và nút phụ có thứ bậc rõ, không bị nút AI che.

### 3. Giá trị cốt lõi và Dạo một vòng Đường Sách

- Thu nhỏ card, hình ảnh và khoảng cách section để giảm độ dài trang nhưng không làm chữ chật.
- Card mobile dùng một cột; padding khuyến nghị 16px, khoảng cách card 12–16px.
- Các tab/điểm dừng phải dễ quét, có trạng thái active rõ và không tạo hàng chữ quá dài.
- Hình trang trí tuyệt đối không tạo tràn ngang hoặc che nội dung.
- Nếu nội dung lặp lại quá dài, dùng progressive disclosure hoặc carousel có điều khiển rõ ràng và hỗ trợ accessibility; không tự chạy gây khó đọc.

### 4. Danh mục gian hàng

- Ô tìm kiếm chiếm chiều rộng hợp lý và cao tối thiểu 44px.
- Bộ lọc danh mục dùng chip gọn; có thể wrap 2 hàng hoặc cuộn ngang có chỉ dấu, không để chip bị cắt.
- Card gian hàng thu gọn: ảnh có tỉ lệ nhất quán, tiêu đề tối đa số dòng hợp lý, metadata bớt chiếm chỗ.
- Các hành động “Chi tiết” và “Xem trên bản đồ” phải đủ lớn; ở màn hình hẹp có thể xếp dọc hoặc chia đều hai cột.
- Cân nhắc chỉ hiển thị số lượng card ưu tiên rồi có “Xem thêm” để giảm chiều dài trang, nhưng không được làm mất khả năng truy cập toàn bộ gian hàng.
- Thiết kế trạng thái không có kết quả tìm kiếm và trạng thái filter rỗng.

### 5. Sự kiện

- Tab Tuần này/Tháng này đủ vùng chạm và có trạng thái selected rõ.
- Card sự kiện phải ưu tiên theo thứ tự: trạng thái/ngày → tên → thời gian/địa điểm → CTA.
- Giảm chiều cao ảnh và khoảng trắng; không làm phần mô tả dài lấn át CTA.
- “Xem chi tiết” và “Đăng ký tham gia” không nhỏ hơn 44px chiều cao.
- Modal chi tiết/đăng ký phải vừa viewport, cho phép cuộn nội dung bên trong, nút đóng luôn tiếp cận được và bàn phím ảo không che nút gửi.

### 6. Bản đồ tương tác

- Bản đồ vừa chiều rộng thiết bị, không làm méo tỉ lệ và không gây tràn ngang.
- Marker phải có vùng chạm tối thiểu 44px hoặc cung cấp danh sách địa điểm thay thế ngay dưới bản đồ.
- Khi marker gần nhau, dùng lựa chọn theo danh sách/bottom sheet thay vì bắt người dùng chạm quá chính xác.
- Panel chi tiết địa điểm chuyển thành card hoặc bottom sheet dễ đọc; CTA luôn nằm trong viewport hợp lý.
- Chú giải bản đồ gọn, wrap đều và không bị nút AI che.

### 7. Góp ý và QR

- Trên điện thoại, không ưu tiên một QR lớn để người dùng quét trên chính thiết bị đang xem. Thay bằng CTA “Mở biểu mẫu góp ý”; QR là nội dung phụ/có thể thu gọn.
- Form một cột, label rõ, input/select/textarea tối thiểu 44px; textarea đủ cao.
- Nút đánh giá 1–5 hoặc sao phải có vùng chạm 44×44px và trạng thái được chọn dễ nhận biết.
- Nút gửi full-width hoặc nổi bật trong thumb zone; bổ sung trạng thái đang gửi, thành công và lỗi kèm hướng dẫn xử lý.
- Rà soát và thống nhất tên phạm vi: “Đường Sách TP.HCM / Nguyễn Văn Bình” và “Đường Sách Thủ Đức” đang không nhất quán. Không tự đoán nội dung đúng; xác định nguồn dữ liệu/cấu hình chung rồi dùng nhất quán.

### 8. Không gian di sản `/di-san`

- Hero gọn hơn trên mobile nhưng vẫn giữ cá tính thị giác.
- Tiêu đề lớn phải scale bằng `clamp()` hoặc breakpoint riêng, không chiếm gần toàn bộ viewport.
- Search và filter đủ vùng chạm, không bị cắt.
- Card di sản một cột, ảnh đồng nhất tỉ lệ, số thứ tự và địa danh không đè lên nhau.
- Giảm khoảng trắng giữa các card, vẫn giữ nhịp đọc và chất liệu văn hóa.
- Toàn bộ 10 hồ sơ phải truy cập được; có thể dùng tải thêm nếu cần.

### 9. Chi tiết di sản `/di-san/:id`

- Ảnh hero không được làm mất thông tin quan trọng khi crop.
- Tiêu đề dài phải xuống dòng cân đối và không đụng khung/trang trí.
- Nguồn ảnh, giấy phép và metadata vẫn đọc được; không dùng cỡ chữ quá nhỏ.
- Nội dung bài viết có line-height thoải mái và độ dài dòng phù hợp mobile.
- Khối thông tin, QR và điều hướng tiếp theo xếp một cột gọn.
- CTA quay lại và tiếp tục hành trình đủ lớn, vị trí dễ hiểu.

### 10. Cổng Ban Quản Lý trên mobile

Đây là hạng mục ưu tiên cao nhất. Layout hiện tại có sidebar cố định chiếm phần lớn chiều rộng khiến nội dung chính bị ép thành một dải hẹp.

- Ở mobile, sidebar phải chuyển thành drawer đóng mặc định; top app bar hiển thị tên trang hiện tại, nút menu và tối đa 1 hành động quan trọng.
- Nội dung chính dùng toàn bộ chiều rộng còn lại, không min-width desktop và không bị cắt.
- Dashboard chỉ ưu tiên thông tin cần thiết: số đề xuất chờ duyệt, xung đột cần xử lý, sự kiện hôm nay, phản hồi mới và quick actions.
- KPI dùng grid 2 cột ở 375–430px; chuyển 1 cột ở 320px nếu cần. Không ép 4 cột.
- Bảng dữ liệu phải chuyển thành card/list responsive hoặc bảng cuộn ngang có cột định danh sticky. Ưu tiên card cho tác vụ thường dùng.
- Mỗi item quản trị hiển thị tiêu đề, trạng thái, thời gian và 1–2 hành động chính; hành động phụ đặt trong menu “Thêm”.
- Form thêm/sửa gian hàng, sự kiện, di sản và đề xuất phải một cột, label luôn hiển thị, footer hành động sticky nhưng không che nội dung.
- Modal xác nhận, duyệt/từ chối/yêu cầu chỉnh sửa phải vừa màn hình và hỗ trợ bàn phím ảo.
- Không xóa chức năng desktop. Mobile có thể giảm dữ liệu hiển thị ban đầu nhưng phải có đường dẫn rõ để xem chi tiết đầy đủ.

### 11. Nút trợ lý AI và các lớp nổi

- Nút AI không được che CTA, bản đồ, chú giải, form hoặc thanh điều hướng.
- Trên mobile chỉ hiển thị nút tròn gọn; ẩn label dài hoặc đưa label vào tooltip/accessible name.
- Tôn trọng safe-area ở iPhone bằng `env(safe-area-inset-bottom/right)`.
- Modal trợ lý dùng chiều cao động (`dvh`), không vượt viewport và bàn phím ảo không che ô nhập.

### 12. Footer, nội dung và accessibility

- Footer xếp cột theo mức ưu tiên; giảm khoảng trắng nhưng không làm các link quá sát nhau.
- Ẩn khỏi giao diện production các mã prototype như SK02/SK05/SK06 và nhãn “NỘI DUNG MINH HỌA”, trừ khi có yêu cầu nghiệp vụ giữ lại.
- Mọi icon-only button có `aria-label`; heading theo thứ bậc đúng; form gắn label thật.
- Focus visible rõ ràng, tương phản đạt WCAG AA, ảnh có alt phù hợp.
- Không phụ thuộc hover để lộ hành động quan trọng.

## Chiến lược CSS và bảo vệ desktop

- Trước khi sửa, chụp ảnh đối chiếu desktop ở 1280px/1440px cho các màn hình chính.
- Ưu tiên override trong media query mobile rõ ràng, ví dụ `@media (max-width: 767px)`; chỉ thêm breakpoint khác khi có lý do.
- Dùng `min-width: 0`, `max-width: 100%`, grid/flex responsive và `clamp()` đúng chỗ.
- Không dùng scale toàn bộ trang để giả lập mobile.
- Không giảm mọi thứ theo cùng một tỉ lệ. Typography, vùng chạm, ảnh, card và spacing phải được điều chỉnh theo vai trò.
- Tránh selector quá rộng làm thay đổi desktop hoặc các trang không liên quan.
- Không thay đổi dữ liệu, logic nghiệp vụ, route hoặc hành vi desktop nếu không cần thiết cho responsive.

## Quy trình thực hiện

1. Audit route, component, modal và breakpoint hiện có; lập danh sách màn hình/trạng thái.
2. Chụp baseline desktop và mobile trước khi sửa.
3. Sửa theo thứ tự: Cổng quản lý → header/menu → trang công khai → bản đồ/form → di sản → modal/trạng thái phụ.
4. Sau mỗi nhóm thay đổi, kiểm tra các viewport mục tiêu và xác nhận không có tràn ngang.
5. Kiểm tra thao tác thật: mở/đóng menu, search/filter, card CTA, tab sự kiện, marker bản đồ, form góp ý, modal, điều hướng di sản và toàn bộ module quản trị.
6. Chạy lint, typecheck, test và build hiện có.
7. Chụp ảnh sau sửa ở mobile và desktop để đối chiếu.

## Tiêu chí hoàn thành bắt buộc

- Tất cả màn hình hoạt động tốt từ 320px đến 430px.
- Không có nội dung bị cắt, chồng, lệch ngoài viewport hoặc cuộn ngang ngoài chủ ý.
- Tất cả control chính có vùng chạm tối thiểu 44×44px.
- Card và khoảng trắng gọn, cân đối; không tạo cảm giác giao diện desktop bị thu nhỏ máy móc.
- Cổng Ban Quản Lý sử dụng được hoàn chỉnh trên điện thoại.
- Navigation, modal, form và bàn phím ảo hoạt động đúng.
- Giao diện giữa các trang đồng bộ về typography, màu, bán kính, shadow, spacing và trạng thái tương tác.
- Desktop 1280px/1440px không có thay đổi thị giác ngoài ý muốn.
- Không có lỗi console mới; lint, typecheck, test và build đều đạt.

## Kết quả cần bàn giao

Sau khi hoàn thành, hãy cung cấp:

1. Danh sách file đã sửa và lý do.
2. Tóm tắt thay đổi theo từng màn hình.
3. Bảng viewport đã kiểm thử và kết quả.
4. Ảnh before/after cho 390×844 và ảnh regression desktop 1440px.
5. Kết quả lint, typecheck, test và build.
6. Những vấn đề còn lại hoặc quyết định nghiệp vụ cần xác nhận, đặc biệt là tên “TP.HCM” và “Thủ Đức”.

Không dừng ở việc đề xuất. Hãy chỉnh sửa mã nguồn, kiểm thử trực tiếp và chỉ kết luận hoàn thành khi toàn bộ tiêu chí trên đạt yêu cầu.
