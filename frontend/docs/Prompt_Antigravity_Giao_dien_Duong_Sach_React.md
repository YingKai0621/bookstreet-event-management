# PROMPT CHO ANTIGRAVITY — GIAO DIỆN ĐƯỜNG SÁCH TRỰC TUYẾN

Vai trò: Bạn là senior React frontend designer và interaction designer. Hãy tạo một nguyên mẫu giao diện chạy được cho website Đường Sách TP.HCM, ưu tiên trải nghiệm của khách tham quan. Đây là giai đoạn thiết kế giao diện tương tác; dùng dữ liệu mẫu có nhãn rõ ràng, chưa tích hợp backend, đăng nhập, thanh toán hoặc chatbot AI thật.

## 1. Mục tiêu trải nghiệm

Thiết kế một chuyến tham quan Đường Sách trực tuyến liền mạch từ đầu đến cuối: người xem được chào đón, hiểu giá trị văn hóa, khám phá con đường và các gian hàng, xem sự kiện, tìm vị trí trên bản đồ, rồi có hành động tiếp theo rõ ràng. Trang phải mang cảm giác tri thức nhưng gần gũi, có chút vui nhộn; đủ sinh động để khám phá nhưng không cản trở việc tìm thông tin. Đối tượng gồm bạn đọc, gia đình, người lần đầu đến, khách du lịch Việt Nam và quốc tế.

Tham khảo https://oryzo.ai/ ở nhịp kể chuyện bằng cuộn trang, chuyển cảnh có chủ đích và chi tiết tương tác thú vị. Không sao chép bố cục, hình ảnh, nội dung, nhân vật, hiệu ứng hay nhận diện thương hiệu của Oryzo. Chuyển tinh thần đó thành ngôn ngữ của Đường Sách: trang sách, gáy sách, bóng cây, biển chỉ đường, con phố và dấu mốc văn hóa. Chỉ dùng một vài khoảnh khắc chuyển cảnh nổi bật; không làm mọi đoạn đều bay, xoay hoặc parallax.

## 2. Công nghệ và đầu ra

Kiểm tra dự án trước khi viết. Nếu chưa có ứng dụng, tạo React + TypeScript + Vite với cấu trúc component rõ ràng, CSS có token thiết kế, dữ liệu mẫu tách riêng khỏi giao diện. Ưu tiên CSS/IntersectionObserver cho reveal; chỉ dùng thư viện motion nếu thật sự cần cho đoạn kể chuyện chính. Mọi nút và vùng tương tác phải có phản hồi có thể thử được. Dùng SVG/CSS hoặc ảnh hợp pháp, tối ưu; tuyệt đối không lấy ảnh hoặc tài sản của Oryzo.

Bàn giao mã nguồn chạy được, hướng dẫn chạy ngắn, và danh sách dữ liệu mẫu/chức năng cần thay bằng dữ liệu thật. Không tạo backend giả khiến người dùng tưởng đã gửi đăng ký hoặc góp ý tới Ban quản lý. Nếu lưu trạng thái nguyên mẫu, ghi rõ “Bản xem thử”.

## 3. Hướng nghệ thuật

Tạo bản sắc riêng: nền giấy sáng #F7F4E9, mực xanh đậm #223B3A, xanh lá tán cây #5D8068, vàng nắng #E9BC63, đỏ dấu sách #B65A48, màu chữ phụ #596865. Dùng màu nhấn tiết chế; bảo đảm tương phản chữ rõ. Typography: tiêu đề giàu chất biên tập bằng font serif hỗ trợ tiếng Việt, nội dung bằng sans-serif dễ đọc. Không dùng bố cục SaaS gồm hàng loạt thẻ giống nhau; thay đổi nhịp bố cục theo tuyến tham quan, đồng thời giữ lưới và khoảng cách nhất quán. Hình ảnh minh họa nên gợi phố sách Việt Nam, không tạo cảm giác thư viện phương Tây chung chung.

Hero mở bằng một “cổng vào Đường Sách” mang tính thị giác: tên trang, lời giới thiệu ngắn, hai nút “Khám phá đường sách” và “Xem bản đồ”. Có tín hiệu cuộn trang rõ ràng. Khi cuộn, người xem có cảm giác đi dọc một con phố, các chương lần lượt mở ra. Dùng một đường dẫn thị giác mảnh hoặc hệ chỉ đường để liên kết các phần, không kéo dài hoạt cảnh khiến người dùng phải chờ.

## 4. Cấu trúc trang một mạch từ trên xuống

1) Header cố định gọn, logo chữ Đường Sách, menu neo đến Giới thiệu, Gian hàng, Sự kiện, Bản đồ, Di sản, Góp ý; nút đổi VI/EN thể hiện được trạng thái. Mobile dùng menu mở/đóng có bàn phím và nút đóng rõ.

2) Hero/cổng vào: một lời chào giàu hình ảnh, nêu đây là điểm đến văn hóa đọc tại TP.HCM. Hai CTA hoạt động: cuộn đến đoạn khám phá và bản đồ.

3) Giới thiệu ngắn: câu chuyện và lý do ghé thăm; thông tin thiết yếu như địa chỉ, giờ mở cửa, cách đến, tiện ích. Nếu chưa có dữ liệu được xác nhận, hiển thị nhãn “Thông tin minh họa — cần xác nhận”, không bịa địa chỉ hoặc giờ mở cửa.

4) “Đi dạo giữa những trang sách”: đoạn kể chuyện bằng cuộn trang với 3–4 cảnh có nội dung thật về đọc sách, gặp gỡ, workshop, khám phá. Mỗi cảnh reveal một lần theo cuộn, có hình/đồ họa liên quan và CTA nhỏ đến mục tương ứng. Giữ văn bản có thể đọc ngay cả khi hiệu ứng không chạy.

5) Gian hàng: khu tra cứu tích hợp ngay trong trang. Có ô tìm, lọc theo chủ đề, kết quả và trạng thái không tìm thấy; nhấn gian hàng mở panel hoặc trang chi tiết trong nguyên mẫu với tên, mô tả, chủ đề sách, vị trí trên bản đồ và hành động “Xem trên bản đồ”. Dùng ít nhất 6 gian hàng MẪU được gắn nhãn rõ, không mạo nhận là gian hàng thật. Không hiển thị “số lượng sách” khi chưa thống nhất đó là số đầu sách hay số bản.

6) Sự kiện: mục “Hôm nay và sắp tới” với dữ liệu minh họa, lọc ngày/loại và trạng thái trống. Mỗi sự kiện có tiêu đề, thời gian, nơi diễn ra, mô tả, nút xem chi tiết. Không đặt nút đăng ký hoạt động thật khi chưa có backend; nếu có nút bản xem thử, mở hộp thoại giải thích rõ.

7) Bản đồ tương tác: đặt trong luồng trang, không tách thành trang rời. Dùng sơ đồ minh họa dễ hiểu trên desktop và mobile với điểm có thể bấm bằng chuột, cảm ứng và bàn phím. Lọc gian hàng/tiện ích/di sản; bấm điểm mở panel thông tin, đổi trạng thái điểm đang chọn, có đường quay về danh sách. Kết nối hai chiều: chọn gian hàng → điểm bản đồ được nhấn mạnh; chọn điểm → xem chi tiết gian hàng. Có chú giải và nút “Xem toàn bản đồ”. Vị trí thực tế phải được Ban quản lý xác nhận trước khi công bố.

8) Di sản Đường Sách Thủ Đức: trình bày lối vào khu “27 di sản” dưới dạng bộ sưu tập khám phá. Ở nguyên mẫu chỉ dựng 1 landing page di sản MẪU và một vài thẻ minh họa; không tự đặt tên hoặc nội dung cho 27 di sản. Diễn giải rằng mỗi di sản về sau có URL ổn định và QR riêng. Không tạo QR thật trước khi có tên miền và URL chính thức.

9) Góp ý và kết thúc chuyến đi: form nguyên mẫu gồm chọn “Toàn Đường Sách” hoặc di sản, mức hài lòng, nội dung góp ý, thông tin liên hệ tùy chọn. Nêu rõ chưa gửi dữ liệu đến Ban quản lý; có kiểm tra trường, trạng thái thành công trong bản xem thử và thông báo lỗi minh họa. Kết trang bằng lời mời đến thăm trực tiếp, liên kết quay lên đầu trang và thông tin liên hệ chỉ khi được cung cấp.

## 5. Hành vi motion và khả năng sử dụng

Scroll storytelling phải phục vụ định hướng: hero mở cổng; một đoạn chuyển từ phố sang các gian hàng; bản đồ được “mở” như tờ gấp khi đi tới mục bản đồ. Reveal bằng opacity/translate nhẹ khoảng 250–500 ms, easing mềm, có thể ngắt khi cuộn nhanh; tránh scroll-jacking, khóa cuộn, chuyển động liên tục hoặc hiệu ứng gây chóng mặt. Sticky chỉ dùng cho một đoạn kể chuyện ngắn và phải thoát tự nhiên. Hover là bổ sung, mọi tính năng vẫn dùng được bằng touch và keyboard. Tôn trọng prefers-reduced-motion: bỏ parallax/sticky animation phức tạp, nội dung hiện ngay, điều hướng vẫn hoạt động.

Thiết kế responsive 360 px, tablet và desktop. Focus rõ, tiêu đề đúng thứ bậc, alt text cho ảnh có nghĩa, nút có nhãn, form có label và lỗi dễ hiểu. Đạt mức tương phản hợp lý hướng tới WCAG 2.2 AA cho luồng chính. Tối ưu để hiệu ứng không giật trên điện thoại: animate transform/opacity, lazy-load ảnh, tránh video nền nặng. Không để chuyển cảnh che mất nội dung hoặc CTA.

## 6. Phạm vi loại trừ và dữ liệu cần xác nhận

Chưa làm cổng quản trị, quy trình duyệt sự kiện, vé, thanh toán, đăng nhập, Passport/check-in, dashboard và chatbot AI thật trong vòng giao diện này. Có thể để vị trí mở rộng trong cấu trúc dữ liệu nhưng không trình bày như chức năng đã hoàn thành. Ghi rõ dữ liệu mẫu, đặc biệt gian hàng, sự kiện, bản đồ, địa chỉ/giờ mở cửa và di sản. Chờ xác nhận từ Ban quản lý về nội dung VI/EN, sơ đồ thực tế, danh sách gian hàng, sự kiện, 27 di sản, quyền ảnh và cách tiếp nhận góp ý.

## 7. Tiêu chí nghiệm thu bản giao diện

- Người mới có thể hiểu Đường Sách là gì, xem thông tin thiết yếu và tìm đường đến bản đồ trong tối đa 3 thao tác.
- Có thể tìm và lọc gian hàng mẫu, mở chi tiết, chuyển sang đúng điểm trên bản đồ; thao tác ngược từ bản đồ về chi tiết cũng hoạt động.
- Có thể xem/lọc sự kiện mẫu và mở nội dung chi tiết; trạng thái không có kết quả rõ ràng.
- Các liên kết menu, CTA, đổi ngôn ngữ, mobile menu, panel bản đồ và form nguyên mẫu đều có trạng thái và phản hồi hợp lý.
- Cuộn trang tạo nhịp kể chuyện hấp dẫn nhưng không cản đọc; chế độ giảm chuyển động và điều khiển bàn phím vẫn dùng được.
- Không xuất hiện nội dung giả như dữ liệu đã xác thực, QR hoạt động, góp ý đã gửi thật hoặc chatbot đã tích hợp.
- Chạy build thành công; không có lỗi giao diện nghiêm trọng ở 360 px, tablet và desktop.

Trước khi code, hãy trình bày ngắn sơ đồ section, hệ màu/chữ, 3 khoảnh khắc motion chính và cách nối gian hàng với bản đồ. Sau đó triển khai nguyên mẫu hoàn chỉnh, tự mở trang kiểm tra và chỉnh các lỗi nhìn thấy. Không dừng ở bản mô tả hoặc các thẻ tĩnh.
