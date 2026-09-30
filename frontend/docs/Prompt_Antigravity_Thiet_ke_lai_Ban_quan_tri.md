# PROMPT TRIỂN KHAI CHO ANTIGRAVITY

## Thiết kế lại Cổng Ban Quản Lý — Đường Sách TP.HCM

Bạn là Senior Product Designer kiêm Senior Frontend Engineer. Hãy trực tiếp kiểm tra codebase và giao diện đang chạy tại `http://localhost:5173/`, sau đó thiết kế lại và hoàn thiện **Cổng Ban Quản Lý** của dự án Đường Sách TP.HCM.

Đây là một nhiệm vụ **thiết kế lại và triển khai hoàn chỉnh**, không chỉ đưa ra nhận xét hoặc mockup. Hãy sửa code, kiểm thử các luồng chính và đảm bảo bản build thành công.

## 1. Ngữ cảnh dự án

- Dự án nằm tại `D:\project-Duongsach`.
- Công nghệ hiện tại: React, TypeScript, Vite và CSS.
- Thành phần quản trị chính hiện nằm trong `src/components/ManagementPortal.tsx` và `src/components/ManagementPortal.css`.
- Trạng thái sự kiện, đề xuất và gian hàng đang được quản lý từ `src/App.tsx`, hiện có cơ chế lưu thử nghiệm bằng `localStorage`.
- Website công khai đã có các khu vực: giới thiệu, gian hàng, sự kiện, bản đồ, góp ý và một trải nghiệm Di sản riêng gồm 10 di sản, mỗi di sản có landing page và mã QR.
- Không được làm hỏng hoặc thay đổi ngoài ý muốn giao diện công khai, trải nghiệm Di sản và các luồng đang hoạt động.
- Ưu tiên cao nhất là giao diện desktop; phải hoạt động tốt trên 1440×900, 1366×768, 1280×800 và 1024×768. Mobile chỉ cần không bị vỡ nghiêm trọng.

## 2. Vấn đề hiện tại

Trang quản trị đang có quá nhiều chữ, quá nhiều khung viền và card lồng nhau. Mật độ thông tin cao nhưng thiếu một điểm tập trung rõ ràng. Người dùng phải đọc khá lâu mới hiểu màn hình dùng để làm gì và chức năng nằm ở đâu.

Các vấn đề cụ thể:

- Sidebar rộng và chứa nhiều nhãn dài; ở laptop nhỏ, nội dung chính bị chật.
- Khu vực đầu trang có tiêu đề dài, mô tả dài và nhiều KPI dạng card cạnh nhau.
- Màn hình thẩm định hiển thị đồng thời quá nhiều thông tin, khung, nhãn và nút hành động.
- Danh sách sự kiện và gian hàng là bảng rộng, dễ phải cuộn ngang; thông tin mô tả dài làm giảm khả năng quét nhanh.
- Quá nhiều card có nền trắng, viền và bo góc khiến mọi thứ có trọng lượng thị giác gần như nhau.
- “Tạo đề xuất mới” và “Thêm sự kiện BQL” chưa thể hiện rõ sự khác biệt.
- “Duyệt & Công bố”, “Từ chối” và “Xóa” là thao tác quan trọng nhưng chưa có quy trình xác nhận đủ an toàn.
- Chưa có khu vực quản lý Di sản, QR, phản hồi người dùng và nhật ký hoạt động.
- Lịch tuần hiện giống một danh sách theo ngày hơn là công cụ điều phối trực quan.
- Dữ liệu đang là demo/localStorage; không được giả vờ rằng hệ thống đã có backend hoặc phân quyền production.

## 3. Mục tiêu trải nghiệm

Thiết kế lại để một cán bộ Ban tổ chức chỉ cần **5–10 giây** sau khi mở trang là trả lời được bốn câu hỏi:

1. Hôm nay có việc gì cần xử lý?
2. Có xung đột hoặc rủi ro nào cần chú ý?
3. Tôi cần vào đâu để quản lý sự kiện, gian hàng, di sản hoặc phản hồi?
4. Hành động chính trên màn hình hiện tại là gì?

Giao diện phải tạo cảm giác: điềm tĩnh, rõ ràng, đáng tin cậy, hiện đại và có bản sắc văn hóa Đường Sách. Không được biến thành dashboard SaaS chung chung hoặc sao chép giao diện macOS một cách máy móc.

Áp dụng các nguyên tắc Apple Human Interface Guidelines theo tinh thần phù hợp với web desktop:

- Simplicity: mọi thành phần phải có lý do tồn tại.
- Hierarchy: ưu tiên bằng vị trí, khoảng trắng, cỡ chữ và trọng lượng; không dùng thêm khung để giải quyết mọi vấn đề.
- Familiarity: navigation, search, bảng, dialog và nút phải có hành vi quen thuộc.
- Agency: người dùng có thể xem trước, hủy, quay lại và phục hồi từ sai sót.
- Progressive disclosure: chỉ hiển thị tóm tắt trước; chi tiết mở khi người dùng yêu cầu.
- Accessibility: không truyền đạt trạng thái chỉ bằng màu; keyboard focus rõ; tương phản đạt WCAG AA; nội dung hoạt động khi zoom 200%.

## 4. Luận điểm thiết kế

**Một trung tâm điều phối yên tĩnh, nơi việc cần làm nổi lên trước và dữ liệu chi tiết lùi lại cho đến khi được yêu cầu.**

Yếu tố nhận diện đáng nhớ duy nhất là một **dòng điều phối trong ngày** lấy cảm hứng từ hành trình dọc Đường Sách: các sự kiện được đặt theo thời gian và địa điểm, xung đột xuất hiện như một nút thắt cần tháo gỡ. Không dùng trang trí thừa, gradient dày đặc hoặc hiệu ứng kính ở mọi nơi.

## 5. Kiến trúc thông tin mới

Tổ chức sidebar thành các mục ngắn, dễ nhớ. Giữ tối đa hai cấp và cho phép thu gọn sidebar.

### Nhóm Điều hành

1. **Tổng quan**
2. **Cần duyệt** — badge chỉ hiển thị khi có hồ sơ cần xử lý
3. **Lịch & sự kiện**

### Nhóm Nội dung

4. **Gian hàng**
5. **Di sản & QR**
6. **Phản hồi**

### Nhóm Hệ thống

7. **Nhật ký**

Đặt “Xem trang độc giả” và tài khoản cán bộ ở khu vực phụ, không cạnh tranh với navigation chính. Sidebar mặc định khoảng 232–248px trên màn hình rộng; tự thu thành rail icon khoảng 68–76px khi không đủ không gian hoặc khi người dùng chủ động thu gọn. Khi thu gọn, cung cấp tooltip cho icon.

## 6. Thiết kế từng màn hình

### 6.1 Tổng quan

Đây phải là màn hình mặc định. Không dùng một lưới KPI dày đặc.

Phần đầu chỉ gồm:

- Lời chào ngắn: “Chào buổi sáng, Ban Điều phối”.
- Ngày hiện tại.
- Một nút chính: “Tạo sự kiện”.
- Một nút phụ/menu: “Tạo mới”.

Khối quan trọng nhất là **Cần xử lý hôm nay**, chỉ hiển thị tối đa 3–5 mục:

- Hồ sơ chờ duyệt.
- Xung đột lịch.
- Phản hồi khẩn/cần trả lời.
- Nội dung Di sản đang ở trạng thái nháp hoặc thiếu QR.

Mỗi mục chỉ gồm tên, thời điểm, trạng thái và một hành động rõ. Có liên kết “Xem tất cả”. Nếu không có việc cần xử lý, hiển thị empty state tích cực.

Bên cạnh hoặc phía dưới là **Lịch hôm nay** dạng timeline ngắn theo giờ và sân khấu. Cuối trang có một hàng số liệu tóm tắt nhỏ, không đặt mỗi số trong một card nặng nề.

### 6.2 Cần duyệt

Dùng mô hình split view:

- Cột trái: danh sách hồ sơ gọn, chỉ hiển thị đơn vị, tên sự kiện, thời gian, địa điểm và trạng thái.
- Cột phải: chi tiết hồ sơ đang chọn.
- Dòng được chọn phải nổi bật và duy trì selection.
- Cột trái có thể thu gọn để người dùng tập trung vào nội dung thẩm định.

Trong chi tiết, thông tin được chia theo mức ưu tiên, không dùng card cho từng trường:

1. Tên sự kiện, đơn vị, trạng thái.
2. Thời gian, địa điểm, diễn giả.
3. Cảnh báo xung đột — chỉ xuất hiện khi có xung đột.
4. Thiết bị — thu gọn bằng disclosure nếu danh sách dài.
5. Mô tả và ghi chú.
6. Thanh hành động sticky: “Yêu cầu bổ sung”, “Từ chối”, “Duyệt & công bố”.

“Duyệt & công bố” là nút primary duy nhất. Khi nhấn, mở dialog xác nhận cho biết chính xác sự kiện, thời gian, địa điểm, xung đột còn lại và ghi chú gửi đi. Không cho công bố nếu còn xung đột chưa được xác nhận/giải quyết.

“Từ chối” là destructive action, cần lý do bắt buộc. “Yêu cầu bổ sung” cần ghi chú rõ. Sau khi xử lý, hiển thị feedback trong giao diện và chuyển hợp lý sang hồ sơ tiếp theo.

### 6.3 Lịch & sự kiện

Gộp “Lịch Biểu Tuần Thông Minh” và “Danh Sách Sự Kiện Sắp Tới” thành một module với hai chế độ xem:

- **Lịch tuần**: timeline/grid theo ngày, giờ và địa điểm; xung đột nhìn thấy ngay.
- **Danh sách**: bảng gọn cho tìm kiếm, lọc và thao tác hàng loạt.

Thanh công cụ gồm tìm kiếm, khoảng ngày, địa điểm, trạng thái và nút “Tạo sự kiện”. Các bộ lọc ít dùng nằm trong popover “Bộ lọc”.

Trong bảng, mặc định chỉ hiển thị các cột quan trọng: thời gian, sự kiện, địa điểm, trạng thái và hành động. Mô tả dài chỉ xuất hiện trong detail drawer. Cho phép sort cột phù hợp và giữ cột hành động ở cạnh phải.

Mỗi sự kiện cần có các hành động: xem, chỉnh sửa, dời lịch, nhân bản, tạm ẩn/hủy. Không đặt nút đỏ “Xóa” trực tiếp trên mọi dòng.

### 6.4 Gian hàng

Dùng bảng/list rõ ràng. Mặc định hiển thị mã, tên gian hàng, loại hình, giờ hoạt động, trạng thái và số hồ sơ. Mô tả dài chuyển sang drawer chi tiết.

Thêm các trạng thái thực tế: đang hoạt động, tạm ngưng, sắp mở, cần cập nhật. Hành động nguy hiểm nằm trong menu ba chấm. Ưu tiên “Tạm ngưng” hơn “Xóa”.

Có form thêm/chỉnh sửa gian hàng với validation trực tiếp, dùng input ngày/giờ/select đúng loại thay vì văn bản tự do.

### 6.5 Di sản & QR — khu vực mới bắt buộc

Tạo module quản lý đủ 10 di sản đang xuất hiện trên website công khai.

Danh sách mỗi di sản hiển thị:

- Mã DS-01 đến DS-10.
- Tên di sản.
- Ảnh đại diện nhỏ.
- Trạng thái: Nháp, Sẵn sàng, Đã xuất bản, Đang ẩn.
- Trạng thái mã QR.
- Ngày cập nhật gần nhất.

Các chức năng bắt buộc:

- Xem trước landing page.
- Chỉnh sửa nội dung tổng quan và nội dung chi tiết.
- Quản lý ảnh, nguồn ảnh và alt text.
- Bật/tắt hiển thị mà không xóa dữ liệu.
- Tạo hoặc làm mới QR riêng cho từng di sản.
- Xem trước QR, tải PNG/SVG/PDF và in QR.
- Sao chép đường dẫn landing page.
- Hiển thị lượt xem và lượt quét QR nếu có dữ liệu; nếu chưa có backend thì dùng trạng thái demo được ghi chú rõ.

Editor di sản nên là trang/drawer riêng có các nhóm: Thông tin chung, Nội dung, Thư viện ảnh, QR & liên kết, SEO/metadata và trạng thái xuất bản. Có autosave chỉ khi cơ chế lưu hiện tại hỗ trợ an toàn; nếu không, dùng nút “Lưu thay đổi” rõ ràng.

### 6.6 Phản hồi — khu vực mới bắt buộc

Tạo inbox phản hồi với:

- Tìm kiếm và lọc theo phạm vi, số sao, trạng thái, ngày.
- Trạng thái: Mới, Đang xử lý, Đã phản hồi, Đã đóng.
- Hiển thị nguồn phản hồi: QR chung, QR di sản cụ thể, gian hàng hoặc sự kiện.
- Chi tiết phản hồi ở panel bên phải.
- Cho phép gán người xử lý, thêm ghi chú nội bộ và đánh dấu trạng thái.
- Không để thông tin liên hệ cá nhân xuất hiện tràn lan trong bảng tổng quan.

### 6.7 Nhật ký — khu vực mới bắt buộc

Hiển thị lịch sử những hành động quan trọng: tạo, chỉnh sửa, duyệt, công bố, đổi lịch, tạo QR, tạm ẩn và xóa. Mỗi bản ghi gồm người thực hiện, hành động, đối tượng và thời gian. Với dữ liệu demo, tạo một lớp dữ liệu rõ ràng và không tuyên bố đây là audit log production.

## 7. Hệ thống thị giác

### Màu sắc

Giữ bản sắc xanh đậm và vàng của Đường Sách nhưng giảm độ phô trương:

- `--surface-app`: #F5F6F4
- `--surface-primary`: #FFFFFF
- `--surface-subtle`: #EEF1EE
- `--text-primary`: #17201D
- `--text-secondary`: #5D6964
- `--accent-primary`: #174C3A
- `--brand-gold`: #C8943F — dùng hạn chế cho điểm nhận diện, không dùng cho mọi nút
- `--danger`: #B42318
- `--warning`: #B86E00
- `--success`: #18794E

Hãy kiểm tra và điều chỉnh để text thông thường đạt tương phản tối thiểu 4.5:1. Trạng thái luôn có icon hoặc nhãn, không dựa vào màu đơn thuần.

### Typography

- UI, bảng và form: system sans hoặc font sans hiện có, ưu tiên độ rõ.
- Serif thương hiệu chỉ dùng cho tiêu đề cấp cao hoặc một vài điểm nhận diện, không dùng dày đặc trong bảng và control.
- Page title: 28–32px, semibold/bold.
- Section title: 18–20px, semibold.
- Body/control: 14–16px.
- Metadata: tối thiểu 12–13px và đủ tương phản.
- Giới hạn mỗi màn hình ở 3–4 cấp chữ rõ ràng.

### Khoảng cách và hình khối

- Dùng hệ spacing 4/8/12/16/24/32.
- Bo góc 10–14px cho panel chính; control 8–10px.
- Giảm ít nhất 40–50% số khung viền/card nhìn thấy so với hiện tại.
- Dùng khoảng trắng và divider mảnh để nhóm thông tin.
- Chỉ dùng shadow rất nhẹ cho lớp nổi như popover/dialog; không đổ bóng mọi card.
- Mỗi màn hình chỉ có 1 nút primary nổi bật, tối đa 2 nếu thật sự cần.

### Icon

- Tiếp tục dùng Lucide hoặc một bộ icon duy nhất.
- Kích thước và stroke thống nhất.
- Icon-only button phải có tooltip và accessible name.
- Không dùng emoji làm icon nghiệp vụ.

### Motion

- Chuyển tab/panel 160–220ms, nhẹ và có mục đích.
- Không dùng hiệu ứng nảy, zoom lớn hoặc animation lặp.
- Tôn trọng `prefers-reduced-motion`.

## 8. Form và dialog

- Dùng `input type="date"`, `input type="time"` hoặc component picker phù hợp.
- Không cho phép ngày và thứ trong tuần mâu thuẫn; thứ phải được suy ra từ ngày.
- Validation xuất hiện ngay cạnh trường, không đợi submit mới báo tất cả lỗi.
- Dialog có tiêu đề, mô tả ngắn, nút đóng, hỗ trợ Escape, focus trap và trả focus về nút mở.
- Không đóng form khi bấm ra ngoài nếu người dùng đã nhập dữ liệu mà chưa lưu.
- Nút submit chỉ active khi dữ liệu bắt buộc hợp lệ.
- Hành động bất đồng bộ phải có loading state và ngăn double submit.

## 9. Responsive desktop

- 1440px trở lên: sidebar đầy đủ, nội dung tối đa khoảng 1440–1600px.
- 1200–1439px: giảm khoảng trống, giữ sidebar đầy đủ nếu vẫn đủ chỗ.
- 1024–1199px: sidebar tự thu thành icon rail; detail panel có thể mở dạng drawer.
- Bảng không được làm toàn trang xuất hiện horizontal scrollbar. Nếu bảng cần cuộn ngang, scrollbar chỉ nằm trong vùng bảng và cột quan trọng/action phải luôn tiếp cận được.
- Không cắt tên menu bằng ellipsis khi sidebar đầy đủ.
- Kiểm thử zoom trình duyệt 125%, 150% và 200%.

## 10. Accessibility và keyboard

- Dùng HTML semantic: `nav`, `main`, `header`, `table`, `dialog` hoặc ARIA tương ứng.
- Sidebar/tab phải thể hiện đúng item đang chọn.
- Có visible focus ring trên mọi control.
- Hỗ trợ Tab/Shift+Tab, Enter/Space và Escape.
- Target click trên desktop tối thiểu khoảng 28×28px, ưu tiên 36–40px cho hành động thường dùng.
- Text không bị mất thông tin khi zoom 200%.
- Trạng thái lỗi, cảnh báo, thành công có cả icon và text.
- Tôn trọng `prefers-reduced-motion` và `prefers-contrast` khi phù hợp.

## 11. Yêu cầu kỹ thuật

- Trước khi sửa, đọc kỹ cấu trúc hiện tại và tái sử dụng types/data/handlers đang có.
- Tách `ManagementPortal.tsx` thành các component/module có trách nhiệm rõ ràng; tránh tiếp tục mở rộng một file khổng lồ.
- Đề xuất cấu trúc như `management/layout`, `management/dashboard`, `management/reviews`, `management/events`, `management/booths`, `management/heritage`, `management/feedback`, `management/audit` và `management/shared` nếu phù hợp với project.
- Tạo design tokens bằng CSS custom properties; tránh hard-code cùng một màu/spacing ở nhiều nơi.
- Không thêm thư viện UI lớn nếu chức năng hiện tại có thể triển khai sạch bằng React/CSS/Lucide.
- Không làm mất dữ liệu mẫu hoặc các thao tác hiện có.
- Sửa thao tác tự điều phối xung đột theo hướng immutable state update; không mutate trực tiếp object đang nhận từ props/state.
- Nếu backend, authentication, analytics hoặc audit log thật chưa tồn tại, giữ adapter/mock rõ ràng và ghi chú giới hạn. Không giả lập bảo mật production.
- Không thay đổi route hoặc giao diện công khai ngoài những điều cần thiết để kết nối chức năng quản trị.

## 12. Trình tự thực hiện

1. Kiểm tra giao diện hiện tại tại URL chạy local và đọc code liên quan.
2. Tóm tắt ngắn kiến trúc hiện tại và xác định dữ liệu có thể tái sử dụng.
3. Lập bản đồ thông tin mới và wireframe desktop bằng chữ trước khi code.
4. Xây design tokens và shell quản trị mới.
5. Hoàn thiện Tổng quan và Cần duyệt trước.
6. Hoàn thiện Lịch & sự kiện, Gian hàng.
7. Bổ sung Di sản & QR, Phản hồi, Nhật ký.
8. Hoàn thiện dialog, validation, trạng thái loading/empty/error/success.
9. Kiểm thử các kích thước desktop và keyboard/accessibility.
10. Chạy lint/build/test phù hợp; sửa lỗi phát sinh trong phạm vi thay đổi.

## 13. Tiêu chí nghiệm thu

Chỉ coi nhiệm vụ hoàn thành khi đáp ứng tất cả điều kiện sau:

- Trong 5–10 giây, người dùng nhìn thấy rõ việc cần xử lý và navigation chính.
- Số card/khung nhìn thấy giảm đáng kể; không còn card lồng card không cần thiết.
- Sidebar rõ, có thể thu gọn và hoạt động tốt từ 1024px trở lên.
- Có đủ 7 khu vực: Tổng quan, Cần duyệt, Lịch & sự kiện, Gian hàng, Di sản & QR, Phản hồi, Nhật ký.
- Module Di sản quản lý đủ 10 mục và các thao tác QR/preview/publish.
- Màn hình duyệt có split view rõ ràng và dialog xác nhận trước khi công bố.
- Danh sách sự kiện có hành động xem/chỉnh sửa/dời lịch/nhân bản/tạm ẩn hoặc hủy.
- Bảng dễ quét, nội dung dài được đưa vào detail panel.
- Form dùng kiểu dữ liệu phù hợp và validation trực tiếp.
- Destructive action không nằm như hành động mặc định và có cơ chế xác nhận/phục hồi phù hợp.
- Giao diện dùng được bằng bàn phím, focus rõ, trạng thái không phụ thuộc màu.
- Không có horizontal scrollbar ở cấp toàn trang trên các kích thước desktop yêu cầu.
- Không làm hỏng website công khai hoặc trải nghiệm Di sản.
- Build thành công; báo cáo rõ file đã thay đổi, kiểm thử đã chạy và giới hạn còn lại.

## 14. Đầu ra mong muốn từ Antigravity

Sau khi hoàn tất, hãy cung cấp:

1. Tóm tắt thiết kế mới và lý do của các quyết định chính.
2. Danh sách file đã tạo/chỉnh sửa.
3. Ảnh chụp các màn hình chính ở desktop 1440px và laptop 1024/1366px.
4. Kết quả build/lint/test.
5. Danh sách giới hạn còn lại, đặc biệt là backend, authentication, analytics và dữ liệu production.

Không dừng ở việc mô tả hoặc đề xuất. Hãy triển khai, tự kiểm tra trực quan, sửa các lỗi nhìn thấy và chỉ kết thúc khi các tiêu chí nghiệm thu trong prompt này đã được đáp ứng.

