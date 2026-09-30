# PROMPT ANTIGRAVITY — SỬA VỊ TRÍ RỒNG VÀ DÙNG ẢNH NGƯỜI DÙNG CUNG CẤP

Phiên bản: v1.2  
Ngày: 13/09/2026  
Áp dụng cho: frontend React demo đang chạy tại http://localhost:5173/.  
Ảnh chụp vị trí đích: `C:\Users\Admin\AppData\Local\Temp\codex-clipboard-a92f0a9b-df80-4d1c-8d08-139badb26529.png`.

Bạn là frontend designer và React developer. Hãy **chỉnh trực tiếp dự án hiện có**, giữ Newsreader, Plus Jakarta Sans, bảng màu, bố cục và các luồng đang hoạt động. Đây là demo: dữ liệu mẫu không phải trọng tâm lần sửa này. Mục tiêu là dùng đúng tài sản hình ảnh người dùng đã đưa, dời con rồng đến đúng vùng trống được khoanh bằng ảnh chụp tham chiếu, giảm đồ họa lấn nội dung và sửa ảnh vỡ. Không làm lại toàn bộ trang hoặc tự tạo một phiên bản rồng mới.

## 1. Vị trí con rồng: yêu cầu bắt buộc

Ảnh chụp tham chiếu cho thấy **vùng nền xanh nhạt bên phải của section Sự kiện**, nằm sau phần tiêu đề/mô tả và trước hoặc sát phía trên hàng thẻ sự kiện; thẻ “Ra mắt sách mới” bắt đầu ở phần dưới ảnh. Hãy đặt rồng **trong khoảng trống đó**, neo theo `#su-kien` hoặc container của section Sự kiện để vị trí không trôi khi thay đổi chiều cao các section trước. Hình rồng xuất hiện ở mép phải với phần đầu và thân nhìn rõ, có thể tràn một phần ra ngoài mép phải như một họa tiết trang trí; giữ đúng tỷ lệ ảnh, không kéo méo. Không đặt rồng ở section Gian hàng, không đặt đè lên tiêu đề, mô tả, bộ lọc, ảnh/thẻ sự kiện hoặc nút trợ lý nổi. Ảnh chụp chỉ là **chỉ dẫn vị trí**, không phải ảnh để hiển thị trên web. Sau khi sửa, chụp màn hình desktop tại đúng đoạn trong ảnh tham chiếu và đối chiếu trực quan: rồng phải nằm trong vùng trống bên phải, thẻ sự kiện và nút trợ lý vẫn nhìn rõ. Nếu vùng trống thay đổi theo breakpoint, ưu tiên giữ nội dung không bị che: thu nhỏ hoặc ẩn rồng trên màn hẹp thay vì đè lên nội dung.

Trong mã hiện tại, họa tiết `h-dragon-booths` đang neo vào `gian-hang` trong `src/components/CulturalSideOrnaments.tsx`; hãy loại bỏ vị trí cũ này và chỉ giữ **một** con rồng ở khu Sự kiện. `z-index: 9999` của lớp họa tiết hiện có khiến hoa sen, cành lúa hoặc rồng có thể nằm trên tiêu đề, bộ lọc và thẻ; hãy đặt họa tiết vào lớp nền trang trí dưới nội dung tương tác, giữ `pointer-events: none` và kiểm tra xếp lớp trên desktop/mobile. Không dùng thông số tọa độ cố định theo toàn trang; đo vị trí tương đối trong section Sự kiện. Khi cuộn, rồng có thể hiện nhẹ một lần bằng opacity/translate, không chạy liên tục.

## 2. Dùng đúng các ảnh người dùng cung cấp

Kiểm kê trước các tệp trong `D:\project-Duongsach\tailieu\`, đặc biệt: `Vietnamese_Dragon_green.png` (rồng xanh phải dùng cho vị trí trên), `Cach_dieu_Khue_Van_Cac.svg.png`, `Trống_đồng_Đông_Sơn.png`, `canva-lotus-flower-flat-icon-MAGunCfPBvU.png` và `dsc3937-1703003902394740344635.png` (ảnh thật gian hàng Kim Đồng). Dùng **chính các tệp này** làm nguồn; sao chép có chủ đích vào thư mục asset của frontend, đặt tên dễ hiểu và giữ bản gốc trong `tailieu`. Với motif do người dùng cấp, không thay bằng SVG tự vẽ, emoji, ảnh Unsplash hoặc hình AI trông tương tự. Nếu một motif đang được vẽ bởi `CulturalMotifIcons.tsx`, thay cách hiển thị ở nơi liên quan bằng ảnh được cấp, đồng thời giữ alt/aria hợp lý (motif trang trí `aria-hidden`, ảnh nội dung có alt). Không dùng ảnh chụp màn hình vị trí đích như ảnh sản phẩm.

Ảnh `dsc3937-1703003902394740344635.png` cho thấy gian hàng Kim Đồng: dùng ảnh này ở thẻ/panel tương ứng thay ảnh thư viện chung, crop sao cho bảng hiệu và mặt tiền vẫn nhìn thấy. Các ảnh thật khác đã có trong `public` chỉ dùng đúng ngữ cảnh của chúng. Với gian hàng/sự kiện/di sản chưa được người dùng cung cấp ảnh, tiếp tục dán nhãn “Ảnh minh họa”; không ghép ảnh của một địa điểm thành ảnh đại diện cho địa điểm khác. Nếu một ảnh từ nguồn ngoài lỗi, hiển thị nền dự phòng và nhãn “Chưa có ảnh” thay vì để biểu tượng ảnh vỡ và alt text tràn lên giao diện. Ưu tiên asset nội bộ ổn định cho bản demo; tối ưu dung lượng ảnh nhưng không làm mất chi tiết nhận diện.

## 3. Chỉnh lại sự tiết chế của đồ họa và hiệu ứng

Giữ ý tưởng biểu tượng văn hóa Việt nhưng để nội dung là chính. Trên bản hiện tại, hoa sen hồng rất lớn che một phần tiêu đề và thẻ của “Dạo một vòng Đường Sách”; họa tiết nhiều màu ở Gian hàng lấn bộ lọc trên mobile. Hãy giảm kích thước/độ nổi, dịch motif ra sát mép và bảo đảm vùng an toàn quanh chữ, ô tìm kiếm, bộ lọc, CTA, marker bản đồ. Trên điện thoại 390 px, chỉ hiện motif khi thật sự còn khoảng trống; không đặt rồng, hoa sen hay icon AI đè nút. Thanh hành trình và hero hiện tạo nhận diện tốt, giữ lại; sửa khoảng bù khi cuộn theo anchor để header cố định không che tiêu đề. Hiệu ứng reveal/giấy gấp chỉ chạy một lần, nhẹ và tôn trọng `prefers-reduced-motion`.

## 4. Kiểm tra và đầu ra cần bàn giao

Trước khi sửa, nêu ngắn mapping **tệp ảnh → nơi dùng** và sơ đồ vị trí rồng trong section Sự kiện. Sau khi sửa, chạy build và kiểm tra trực tiếp ở desktop khoảng 1440 px, tablet 768 px và mobile 390/360 px. Chụp hai ảnh so sánh desktop/mobile của khu Sự kiện có rồng; kiểm tra hoa sen không che “Dạo một vòng”, các bộ lọc Gian hàng còn bấm được, ảnh Kim Đồng đúng, ảnh lỗi có fallback, nút trợ lý không che CTA. Thử lại luồng tìm Nhã Nam → “Xem trên bản đồ” → B-03 được chọn (luồng này hiện đã đúng, đừng làm hỏng). Bàn giao mã nguồn đã chỉnh, danh sách ảnh đã thay và các ảnh chụp kiểm tra. Chỉ coi hoàn thành khi rồng **không còn ở vị trí Gian hàng** và **đã nằm đúng vùng trống bên phải của Sự kiện theo ảnh người dùng**.
