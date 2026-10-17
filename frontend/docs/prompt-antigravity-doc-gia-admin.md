# Prompt Antigravity — Đồng bộ giao diện Độc giả & Admin

Bạn là product designer và frontend engineer của BookStreet, hệ thống quản lý sự kiện Đường Sách TP.HCM. Thiết kế lại giao diện Độc giả (PARTICIPANT) và Quản trị viên (ADMIN) dựa trên component, phong cách và hành vi của giao diện Đối tác (PARTNER) hiện có. Mục tiêu: cùng một sản phẩm, khác tác vụ; ít chữ, rõ việc, không có cảm giác AI slop. Không thiết kế lại role Đối tác.

## 1. Đọc bối cảnh và dùng skill thật trong repo

Thư mục frontend có `.agents/skills`, không phải `.agent`. Đọc và áp dụng `frontend/.agents/skills/frontend-design/SKILL.md`, `design-system/SKILL.md` và `emil-design-eng/SKILL.md`. Đọc các reference liên quan nếu skill yêu cầu; báo đường dẫn thiếu, không tự nhận đã dùng skill chưa đọc. Ưu tiên yêu cầu này nếu skill gợi ý phong cách trái với giao diện Đối tác. Không thêm thư viện UI hoặc đổi stack chỉ vì skill đề xuất.

Trước khi sửa code, đọc theo AGENTS.md: AI_CONTEXT.md → docs/sprints/CURRENT_SPRINT.md → Sprint, Use Case và API Contract được tham chiếu → Business Rules và Physical ERD hiện hành → docs/development/BACKEND_AI_CODING_GUIDELINES.md. Sprint 4 hiện đã hoàn tất, chưa có Sprint mới. Đây là yêu cầu đồng bộ UI; không dùng nó để tự mở rộng nghiệp vụ. Phân biệt chức năng thật, dữ liệu demo và chức năng chưa có backend.

Mở giao diện chạy thực tế của cả ba role; kiểm tra ít nhất trang tổng quan, danh sách, chi tiết và biểu mẫu đang có. Dùng tài khoản demo đã cấu hình, không đưa mật khẩu vào mã nguồn hoặc báo cáo. Nếu không chạy được, nêu hạn chế và dựa vào source; không tuyên bố đã kiểm chứng bằng ảnh chụp.

## 2. Nguồn tham chiếu bắt buộc

Đọc các file sau, đường dẫn tính từ gốc repo:

- `frontend/src/pages/partner/PartnerLayout.tsx` và `PartnerLayout.css`: khung ứng dụng, top bar, tìm kiếm, thông báo, tài khoản.
- `frontend/src/pages/partner/PartnerPages.css`: tiêu đề, thẻ, khoảng cách, danh sách và biểu mẫu.
- `frontend/src/components/ui/RoleSidebar.tsx` và `RoleSidebar.css`: sidebar dùng chung đã có ở cả ba role. Tái sử dụng, không tạo bản sao cho từng role.
- `frontend/src/components/partner/PartnerEvents.css`, `PartnerEventCalendar.tsx`, `PartnerDialog.tsx`: bộ lọc, thẻ sự kiện, lịch và modal.
- `frontend/src/pages/partner/PartnerEventPageShared.tsx`: các mẫu tiêu đề và metadata; chỉ kế thừa phần giúp thao tác, không sao chép hero lớn hoặc đoạn giới thiệu dài.
- `frontend/src/pages/participant/` và `frontend/src/components/admin/`: kiểm kê toàn bộ màn hình và luồng hiện có trước khi thay đổi.

Xuất trước một bản kế hoạch ngắn: component giữ lại, component trích dùng chung, màn hình đổi bố cục và chức năng chỉ là demo. Sau đó triển khai trong phạm vi UI đã yêu cầu.

---PAGE---

## 3. Ngôn ngữ thiết kế chung

Giữ nhận diện đang có: xanh rừng trầm, vàng nhạt, nền sáng và hình ảnh sự kiện Đường Sách thật. Không biến giao diện thành landing page quảng cáo hoặc dashboard SaaS chung chung.

Mốc màu lấy từ source Đối tác: top bar `#14241F`; xanh chính `#17382E`; vàng nhấn `#E9BC63`; nền `#F8FAF9`; mặt thẻ `#FFFFFF`; chữ `#172421`; chữ phụ `#556B65`; viền `#E2EAE5`. Đối chiếu computed style trước khi chốt token vì CSS chung có thể ghi đè. Vàng chủ yếu dùng cho trạng thái điều hướng và điểm nhấn; không dùng chữ vàng nhạt trên nền trắng.

Giữ top bar 64px trên desktop, kích thước sidebar theo RoleSidebar thực tế và nhịp khoảng cách của Partner. Nội dung canh trái, vùng đọc tối đa khoảng 1400px; mobile giảm padding, giữ tác vụ chính dễ chạm. Bo góc theo chức năng: control nhỏ, thẻ 12–16px, modal thống nhất. Viền mảnh, bóng nhẹ; không bọc mọi đoạn nội dung trong một thẻ.

Dùng các biến font hiện có trong index.css. Serif chỉ dành cho tiêu đề phù hợp; sans-serif cho điều hướng, dữ liệu, biểu mẫu. Không tải thêm bộ font. Body khoảng 14–16px, nhãn phụ vẫn dễ đọc; kiểm tra dấu tiếng Việt và tên dài.

Trích component chung khi thực sự có từ hai nơi dùng: PageHeader, SearchFilterBar, StatusBadge, EventCard, DataTable, EmptyState, FormField và ConfirmDialog. Tên này là gợi ý, kiểm tra thư viện hiện có trước. Component nhận dữ liệu/callback; không kéo partnerApi, quyền PARTNER hoặc tác vụ thuê gian hàng sang Độc giả/Admin. Đặc biệt PartnerEventCalendar có logic dữ liệu đối tác: chỉ tái dùng phần trình bày qua props hoặc trích lịch trung lập; không tái dùng nút thêm sự kiện cho Độc giả.

## 4. Ít chữ nhưng đủ thông tin để quyết định

Mỗi trang có một tiêu đề và tối đa một câu hướng dẫn khi cần. Mỗi vùng tác vụ có một CTA chính. Nhãn khoảng 1–4 từ khi đủ nghĩa: “Xem sự kiện”, “Xem chi tiết”, “Lưu thay đổi”, “Thử lại”. Không rút ngắn tên hành động đến mức khó hiểu.

Giữ ngày, giờ, địa điểm, điều kiện và hệ quả thao tác. Đưa thông tin ít dùng vào phần mở rộng, không giấu thông tin thiết yếu trong tooltip. Form có nhãn cố định, lỗi ngay tại trường và giữ dữ liệu đã nhập khi lỗi. Trạng thái luôn có chữ, không chỉ có màu.

Ví dụ nội dung: “Chưa có sự kiện” + “Xem sự kiện”; “Không tải được danh sách” + “Thử lại”; “Đã lưu thay đổi”. Không dùng lời chào dài, khẩu hiệu, từ “nâng tầm”, “trải nghiệm đột phá”, mô tả tính năng bằng ngôn ngữ marketing hoặc đoạn giới thiệu lặp lại tiêu đề.

Không dùng gradient trang trí, glassmorphism, khối phát sáng, emoji làm icon, Sparkles trang trí, số liệu tăng trưởng giả, biểu đồ vô nghĩa, hàng KPI bắt buộc trên mọi trang hoặc họa tiết văn hóa phủ nền. Dùng lucide-react đang có. Chuyển trạng thái nhẹ khoảng 120–180ms khi hữu ích; tôn trọng reduced motion. Không stagger từng thẻ, parallax hay hiệu ứng bay khi cuộn.

---PAGE---

## 5. Thiết kế cho Độc giả

Giữ luồng và route hiện hữu của PARTICIPANT; tên “Độc giả” là nhãn giao diện, không tạo role READER. Kiểm kê ParticipantLayout, ParticipantDashboard, MyEventsPage, MyActivitiesPage, EventDetailPage, ActivityDetailPage, ActivityQrPage, RewardsPage, MyCertificatesPage, ParticipantFeedbackPage và ProfileSettingsPage. Không coi việc có file là bằng chứng chức năng đã nối backend.

Trang tổng quan ưu tiên câu hỏi “Có sự kiện nào để xem?” và “Lịch của tôi ở đâu?”. Đầu trang là tiêu đề ngắn và lối vào danh sách sự kiện đang có; tiếp đến lịch/sự kiện sắp tới của người dùng nếu có dữ liệu thật. Khi chưa có lịch, hiển thị hướng dẫn một dòng và nút dẫn đến danh sách hiện hữu. Không đặt điểm thưởng, huy hiệu hay số thống kê lên trên tác vụ chính chỉ để lấp chỗ trống.

Danh sách sự kiện dùng nhịp thẻ, bộ lọc và metadata của Đối tác: ảnh thật, tên sự kiện, thời gian, địa điểm, trạng thái và một hành động rõ. Chi tiết đưa tên, lịch, địa điểm và hành động hợp lệ lên trước; mô tả dài xuống dưới. Không dùng hành động đăng ký đối tác cho độc giả. Chỉ hiển thị CTA tham gia/đăng ký khi luồng đó thực sự được hỗ trợ và người dùng đủ điều kiện.

“Sự kiện của tôi” ưu tiên lịch gần nhất và trạng thái dễ hiểu. Các nhóm sắp tới/đã kết thúc chỉ là cách trình bày dữ liệu hiện có, không tạo status mới. QR, chứng nhận, đổi thưởng, điểm danh và góp ý chỉ giữ theo khả năng đã được kiểm chứng. Nếu đang là demo, ghi rõ trong bản bàn giao và giữ ranh giới demo; không dựng trạng thái thành công giả.

Điều hướng dùng RoleSidebar hiện có. Rút gọn nhãn khi không mất nghĩa, ví dụ “Hồ sơ”, “Góp ý”; giữ các mục đang có đường đi rõ ràng. Không tự thêm mục không có route. Mobile giữ bộ lọc và CTA trong nội dung; không giấu tác vụ sau icon khó đoán.

## 6. Thiết kế cho Admin

Kiểm kê AdminPortal, AdminTopBar, AdminSidebar, AdminPortal.css, AdminVisualRefresh.css và toàn bộ các View tương ứng. Giữ cơ chế activeTab hiện có trừ khi thật sự cần đổi; không chuyển route chỉ để làm đẹp.

Admin dùng cùng shell, font, button, form, badge và modal của Đối tác, nhưng nội dung ưu tiên bảng để rà soát nhanh. Sidebar có thể phân nhóm bằng nhãn ngắn: “Vận hành”, “Tài khoản”, “Hệ thống”, giữ mọi mục hiện có truy cập được. Giữ nguyên quyền và khả năng thao tác của từng mục.

Tổng quan chỉ hiển thị số liệu thật giúp ra quyết định và nhật ký hữu ích đang có. Mục cần xử lý chỉ xuất hiện khi có dữ liệu/quy tắc thật; không tự tạo queue phê duyệt hoặc đếm cảnh báo giả. Không bày nhiều biểu đồ cho đủ màn hình.

Quản lý người dùng: tìm kiếm/bộ lọc ở đầu, bảng có tên tài khoản, vai trò và trạng thái theo dữ liệu thực; hành động đặt cạnh bản ghi hoặc trong menu có nhãn. Các danh mục gian hàng, địa điểm, thiết bị dùng cùng một mẫu toolbar + bảng + form nếu đã có chức năng. Dùng tên hành động cụ thể thay cho nút “Quản lý”. Chỉ thêm xác nhận cho thao tác có hệ quả đáng kể; nói rõ đối tượng và hệ quả, không xác nhận hai lần.

Role code hợp lệ chỉ gồm PARTICIPANT, PARTNER, ORGANIZER, ADMIN. Backend account status chỉ ACTIVE/DISABLED. Nếu UI cũ có locked hoặc pending_verification, báo chênh lệch và kiểm tra mapping; email verification là thông tin riêng, không tự biến thành account status mới. Không thêm quyền, endpoint hoặc sửa backend để khớp bản vẽ.

---PAGE---

## 7. Quy trình thực hiện và giới hạn

Làm trên nhánh riêng từ main đã cập nhật, giữ thay đổi hiện có của người khác. Không sửa AGENTS.md, AI_CONTEXT.md, migration, schema, authentication hoặc API contract trong công việc UI này. Giữ session cookie HttpOnly, Redis session, CSRF và quyền hiện có. Không thay bằng JWT và không thay dữ liệu thật bằng mock để màn hình trông đẹp.

Thực hiện theo thứ tự: kiểm kê → token/component dùng chung → shell hai role → tổng quan và danh sách → chi tiết và form → trạng thái lỗi/trống/loading → responsive và kiểm tra. Kiểm tra CSS có phạm vi để không làm đổi Partner, Organizer, trang công khai hoặc màn hình đăng nhập ngoài phạm vi. Tránh chồng thêm một file override khổng lồ và !important để che lỗi cấu trúc.

Khung tham khảo, điều chỉnh theo dữ liệu hiện hữu:

- Độc giả: Top bar → Sidebar | Tiêu đề + hành động → Tìm/bộ lọc → Sự kiện hoặc lịch sắp tới → Thông tin phụ.
- Admin: Top bar → Sidebar | Tiêu đề + hành động → Tìm/bộ lọc → Bảng nghiệp vụ → Phân trang hoặc thông tin kết quả.

## 8. Tiêu chí nghiệm thu

- Người mới nhận ra vai trò hiện tại, trang đang mở và hành động tiếp theo trong 5–10 giây. Đây là mục tiêu cần kiểm chứng, không phải lời cam kết chỉ dựa vào đánh giá của AI.
- Thử với ít nhất 3 người chưa quen: cho xem mỗi màn hình tổng quan 5 giây, che màn hình, hỏi “Bạn đang ở đâu?” và “Bạn sẽ bấm đâu để làm việc chính?”. Sau đó cho thao tác tối đa 10 giây: Độc giả mở chi tiết một sự kiện; Admin tìm một tài khoản và mở chi tiết. Ghi thời gian, lỗi và điều chỉnh nếu người dùng do dự. Nếu chưa có người thử, bàn giao kịch bản và ghi “Chưa kiểm chứng với người dùng”.
- Các component tương đương nhìn và hoạt động đồng nhất ở ba role. Cấu trúc trang phản ánh công việc của từng role, không nhân bản dashboard Đối tác rồi đổi tên.
- Kiểm tra ở 1440px, 1024px, 768px và 390px: không tràn trang, không cắt CTA, modal không vượt màn hình. Bảng nhỏ ưu tiên cột quan trọng và vùng cuộn được gắn nhãn khi cần.
- Tab/Shift+Tab đi đúng thứ tự; focus nhìn rõ; dialog hỗ trợ Esc, giữ focus và trả focus khi đóng. Icon đơn lẻ có accessible name. Vùng chạm mobile khoảng 44px. Độ tương phản chữ thường tối thiểu 4.5:1; trạng thái không phụ thuộc màu.
- Có loading, empty, error, success và disabled ở nơi thích hợp. Không có nút giả, link chết hoặc dữ liệu thành công giả. Tên sự kiện dài, tên tài khoản dài và nội dung tiếng Việt vẫn đọc được.
- Chạy lint/build và các kiểm tra giao diện liên quan sẵn có. Chụp ảnh trước/sau ít nhất: tổng quan và danh sách của hai role ở desktop/mobile; thêm một form hoặc modal và một trạng thái trống/lỗi. Smoke test Partner sau khi thay component chung.

## 9. Bàn giao

Trả về bản triển khai UI, danh sách file đổi, component dùng chung và kết quả kiểm tra. Kèm ảnh trước/sau, phần demo/chưa nối backend, giới hạn chưa kiểm chứng và các xung đột tài liệu nếu có. Báo ngắn gọn; không viết bài quảng cáo cho thiết kế.

Tự duyệt lần cuối: xóa phần trang trí không giúp thao tác; xóa câu không giúp quyết định; giữ lại thông tin người dùng cần. Kết quả phải giống sản phẩm Đường Sách đã được chăm chút bởi người thiết kế, không giống một template AI được đổi màu.

---

Ghi chú biên soạn · 17/10/2026: Prompt dựa trên source giao diện Đối tác, Độc giả, Admin và skill frontend-design hiện có trong repo; chưa kiểm tra giao diện chạy thực tế trong lần biên soạn này. Các bước chạy ứng dụng, đọc baseline đầy đủ và thử với người dùng ở trên là yêu cầu dành cho Antigravity khi thực hiện.
