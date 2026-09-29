# PROMPT ANTIGRAVITY — GẮN HỌA TIẾT THEO ẢNH CHUẨN

**Phiên bản: v1.3 — 13/09/2026**  
**Ảnh tham chiếu:** `C:\Users\Admin\Downloads\Untitled.png`  
**Dự án:** React frontend tại `D:\project-Duongsach`, xem tại `http://localhost:5173/`.

Bạn là frontend designer kiêm React developer. Hãy chỉnh trực tiếp FE hiện tại để **chỉ thêm hoặc điều chỉnh lớp họa tiết trang trí văn hóa Việt theo đúng ảnh tham chiếu**. Giữ nguyên 100% phần giao diện và hành vi đang có: thứ tự section, chiều rộng nội dung, khoảng cách, chiều cao, chữ, font, màu, ảnh nội dung, thẻ, thanh điều hướng, biểu mẫu, bản đồ, bộ lọc, tìm kiếm, nút, animation và luồng tương tác. Không dựng lại trang theo ảnh tham chiếu; ảnh này chỉ quy định **họa tiết nào, vị trí tương đối, kích thước và cách tràn mép**. Nếu ảnh tham chiếu khác FE hiện tại ở bất kỳ nội dung hay bố cục nào, **FE hiện tại là nguồn chuẩn** và không được sửa theo ảnh. Không dùng toàn bộ ảnh chụp làm background hoặc một ảnh dài phủ trang.

## 1. Dùng đúng nguồn họa tiết

Ưu tiên các tệp gốc do người dùng cung cấp trong `D:\project-Duongsach\tailieu\`: `Trống_đồng_Đông_Sơn.png`, `Vietnamese_Dragon_green.png`, `canva-lotus-flower-flat-icon-MAGunCfPBvU.png`, `Cach_dieu_Khue_Van_Cac.svg.png`. Dự án đã có bản dùng trên web tương ứng trong `public/assets/vietnam-cultural/`: `trong_dong.png`, `rong_viet.png`, `hoa_sen.png`, `khue_van_cac.png`; đối chiếu với tệp gốc và dùng đúng hình gần nhất với ảnh tham chiếu. Không vẽ lại, đổi màu, dùng emoji, ảnh AI hay ảnh thư viện thay thế. Bảo đảm nền ảnh trong suốt; nếu bản đang dùng có nền trắng thì xử lý từ tệp nguồn và giữ nguyên hình chính. Nếu họa tiết hồng nhạt phía Di sản trong ảnh không khớp tệp Khuê Văn Các hiện có, tìm đúng tài sản người dùng đã cấp; nếu không có thì nêu rõ thiếu tài sản và **không tự chế họa tiết khác**.

## 2. Bốn điểm đặt theo ảnh chuẩn, từ trên xuống

**Trống đồng:** một trống đồng lớn nằm ở **mép trái**, khoảng giao giữa cuối `#kham-pha` (Dạo một vòng Đường Sách) và đầu `#gian-hang` (Các gian hàng tại Đường Sách). Phần lớn hình nằm ngoài mép trái, phần còn lại hiện trên nền hai section như ảnh. Tâm hình gần đường ranh section; không đè lên tiêu đề, ô tìm kiếm, bộ lọc hoặc thẻ.

**Rồng Việt:** **chỉ một con rồng**, ở **mép phải phần đầu `#su-kien`**, nằm qua ranh giới cuối `#gian-hang` và đầu `#su-kien`. Đầu và thân rồng nhìn rõ trong vùng trống bên phải tiêu đề/sát phía trên hàng thẻ sự kiện; phần đuôi được phép tràn ra ngoài mép phải. Không để rồng ở mép trái Gian hàng, Hero, hay vị trí cũ khác. Không che chữ, tab thời gian, thẻ sự kiện, nút tham gia hoặc nút trợ lý AI.

**Hoa sen hồng:** họa tiết sen lớn ở **mép trái `#ban-do`**, tràn nửa ra ngoài khung nhìn và làm nền phía sau vùng bản đồ như ảnh. Đây là họa tiết trang trí, không phải lớp phủ lên nội dung: tiêu đề, tab, bản đồ, marker và panel thông tin phải luôn rõ và bấm được.

**Họa tiết hồng nhạt của Di sản:** đặt ở **mép phải `#di-san`**, kích thước lớn, tràn ra ngoài khung nhìn; nét và màu hồng nhạt như ảnh tham chiếu. Nó nằm sau nội dung, không phủ tiêu đề, ảnh/thẻ di sản, nút mở trang hoặc thanh hành trình.

Không thêm họa tiết vào Hero, Giá trị cốt lõi, Góp ý, Footer hoặc các vị trí khác. Nếu `CulturalSideOrnaments.tsx` hoặc CSS hiện có đang định nghĩa sáu họa tiết, hãy sửa **bốn vị trí cần thiết, bỏ các bản trùng/lệch vị trí**; không để một hình xuất hiện hai lần.

## 3. Cách gắn vào FE mà không làm xô giao diện

Tạo một lớp trang trí độc lập, neo từng hình **theo section hoặc ranh giới giữa hai section**, không dùng tọa độ Y tuyệt đối của toàn trang. Họa tiết nằm ngoài luồng bố cục (`position: absolute` trong wrapper có `position: relative`), `pointer-events: none`, `aria-hidden="true"`; không làm thay đổi kích thước section, chiều cao trang hoặc điểm cuộn anchor. Đừng dùng `position: fixed`: hình phải cuộn cùng trang như ảnh chuẩn. Dùng `overflow-x: clip` ở cấp trang để tránh thanh cuộn ngang, nhưng không cắt phần họa tiết cần tràn vào giữa các section. Thiết lập thứ tự lớp có chủ đích: họa tiết nổi trên nền màu của section nhưng **dưới chữ, thẻ, bộ lọc, nút, modal và điều hướng cố định**; không dùng `z-index: 9999` cho toàn bộ họa tiết. Nếu nền section che họa tiết tại đường ranh, chỉnh cấu trúc lớp trang trí thay vì nâng z-index che nội dung.

Giữ tỷ lệ ảnh gốc (`height: auto`, `object-fit: contain`), không kéo méo và không tạo khung trắng. Trên desktop khoảng 1440–1536 px, đối chiếu tỷ lệ với ảnh chuẩn; trên tablet 768 px và mobile 390/360 px, giảm cỡ hoặc ẩn họa tiết nếu thiếu khoảng trống, tuyệt đối không che nội dung tương tác. Không thêm hiệu ứng mới nếu FE hiện tại đã có chuyển động; nếu cần cho hình xuất hiện, chỉ dùng reveal nhẹ một lần và tuân thủ `prefers-reduced-motion`.

## 4. Kiểm tra và bàn giao

Trước khi sửa, ghi nhanh mapping `họa tiết → tệp ảnh → section/vị trí` và xác định họa tiết nào đã có để tránh trùng. Sau khi sửa, chạy build; mở FE tại desktop 1440–1536 px, tablet 768 px, mobile 390/360 px; chụp ảnh toàn trang và ảnh cận bốn vùng họa tiết để so với `Untitled.png`. Kiểm tra thanh cuộn ngang không xuất hiện, các nút/bộ lọc/marker bản đồ vẫn bấm được, anchor cuộn đúng, nội dung và bố cục cũ không đổi. Bàn giao danh sách tệp đã sửa và ảnh trước/sau. Chỉ hoàn thành khi **chỉ bốn họa tiết đúng vị trí trong ảnh chuẩn** được thêm/chỉnh, còn FE hiện tại giữ nguyên.
