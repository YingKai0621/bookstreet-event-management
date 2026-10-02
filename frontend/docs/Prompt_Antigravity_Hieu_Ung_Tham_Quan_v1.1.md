# PROMPT ANTIGRAVITY — HIỆU ỨNG “DẠO ĐƯỜNG SÁCH ONLINE”

Phiên bản: v1.1  
Ngày: 12/09/2026  
Áp dụng cho: frontend React demo hiện có của Đường Sách TP.HCM.

Bạn là senior interaction designer và React motion engineer. Hãy nâng cấp **hiệu ứng chuyển động của website đang chạy**, không làm lại giao diện từ đầu. Giữ bộ chữ Newsreader cho tiêu đề, Plus Jakarta Sans cho nội dung, bảng màu xanh đậm – giấy sáng – vàng ấm, ảnh và bộ icon hiện có. Giữ nguyên cấu trúc nội dung, dữ liệu demo, chức năng tìm/lọc gian hàng, sự kiện, bản đồ, di sản, góp ý và điều hướng. Mục tiêu là biến hành trình cuộn trang thành cảm giác **mở một cuốn sách rồi bước dọc Đường Sách**, có vài khoảnh khắc đáng nhớ nhưng vẫn nhanh, dễ đọc và dễ dùng.

## Ý tưởng chuyển động xuyên suốt

Tạo một “sợi chỉ hành trình” mảnh lấy cảm hứng từ đường chỉ khâu gáy sách và lối đi dưới tán cây. Nó xuất hiện nhẹ sau hero, đi qua các chương của trang và giúp người dùng hiểu mình đang ở đâu. Trên desktop, sợi chỉ có thể chạy ở mép nội dung hoặc kết hợp với thanh hành trình hiện tại; trên mobile, rút gọn thành chỉ báo tiến trình không che màn hình. Icon của từng chương có chuyển trạng thái nhỏ khi chương đi vào vùng nhìn: sách mở, gian hàng sáng đèn, vé sự kiện hiện dấu, bản đồ mở nếp gấp, con dấu di sản và dấu trang góp ý. Icon phải cùng phong cách và có ý nghĩa dẫn đường, không chuyển động vô cớ.

## Bốn khoảnh khắc chuyển cảnh chính

**1. Hero — Mở sách, bước vào phố.** Khi tải trang, ảnh Đường Sách hiện ổn định trước, sau đó hai lớp “trang giấy” hoặc hai mép khung trượt ra rất nhẹ để lộ tiêu đề; tiêu đề và hai CTA vào vị trí theo cùng một nhịp. Tổng thời gian khoảng 700–1000 ms, chỉ chạy một lần. Không dùng màn hình chờ, intro video, hiệu ứng lật 3D quá mạnh hay chặn người dùng nhấn nút. Khi bấm “Khám phá đường sách”, cuộn mượt đến phần giới thiệu và chỉ báo hành trình đổi trạng thái.

**2. Dạo một vòng — Đi qua bốn điểm dừng.** Thay cảm giác bốn thẻ tĩnh cùng xuất hiện bằng một đoạn kể chuyện theo cuộn. Mỗi điểm dừng có ảnh hoặc nền có chiều sâu, icon, tiêu đề ngắn, lời dẫn và CTA; khi điểm mới vào vùng nhìn, điểm hiện tại nhường vị trí bằng chuyển động ngang/dọc rất nhỏ như người xem tiến thêm vài bước. Trên desktop có thể dùng một khung hình sticky ngắn ở một phía và nội dung cuộn ở phía còn lại; giới hạn trong chính section này và thoát tự nhiên. Trên mobile, dùng các điểm dừng xếp dọc, không sticky kéo dài. Không biến việc đọc thành trình chiếu bắt buộc; người dùng cuộn nhanh vẫn đến nội dung ngay.

**3. Gian hàng → Bản đồ — Một hành trình liên tục.** Khi người dùng nhấn “Xem trên bản đồ” từ thẻ gian hàng, nút có phản hồi tức thì, chỉ báo đường đi chuyển sang chương bản đồ, trang cuộn đến bản đồ và điểm tương ứng được nhấn mạnh bằng vòng sáng ngắn một lần; bảng thông tin mở với nội dung của đúng gian hàng. Khi bấm điểm trên bản đồ, panel đổi nội dung bằng chuyển động 180–260 ms; khi quay về danh mục, thẻ tương ứng được nhấn nhẹ để người dùng không mất vị trí. Không dùng hiệu ứng rung/pulse liên tục. Giữ bộ lọc và ô tìm kiếm hoạt động như hiện tại.

**4. Bản đồ và di sản — Mở tờ gấp, lật trang.** Khi section bản đồ lần đầu vào vùng nhìn, hai mép bản đồ mở ra như giấy gấp trong khoảng 500–700 ms; nội dung, marker và chú giải phải vẫn dùng được nếu animation chưa chạy hoặc bị tắt. Ở section di sản, chọn một thẻ có thể mở chi tiết bằng hiệu ứng chuyển trang 250–400 ms, gợi giấy và dấu mộc; tránh mô phỏng lật cả trang 3D gây chóng mặt. Hiệu ứng chỉ chạy khi người dùng cuộn tới hoặc chọn thẻ, không tự lặp.

## Vi tương tác và nhịp chuyển động

Thiết kế một hệ motion thống nhất: phản hồi nút 120–180 ms, panel/menu 180–260 ms, reveal nội dung 300–450 ms, chuyển cảnh lớn 500–800 ms; easing ưu tiên cubic-bezier(0.16, 1, 0.3, 1). Dùng transform và opacity làm chính, tránh animate top/left/width hoặc filter nặng trên nhiều phần tử. Nút có trạng thái hover/focus/pressed rõ nhưng không phóng to quá mức. Bộ lọc gian hàng và sự kiện chuyển kết quả bằng crossfade ngắn, không làm danh sách nhảy đột ngột; trạng thái rỗng xuất hiện rõ. Menu mobile mở từ vị trí hợp lý, các mục hiện liền mạch và đóng ngay sau khi chọn. Form góp ý và nút gửi cho phản hồi rõ của bản demo; không tạo cảm giác đã gửi dữ liệu thật.

## Quy tắc chống rối và tiếp cận

Chỉ bốn khoảnh khắc trên là hiệu ứng nổi bật; các section còn lại chuyển nhẹ hoặc đứng yên để người xem nghỉ mắt. Không scroll-jacking, không cuộn ngang bắt buộc, không parallax mạnh, không hiệu ứng tự chạy vô hạn, không trì hoãn nội dung để chờ animation. Khi người dùng cuộn ngược, trạng thái phải đúng và không giật; các animation có thể bị ngắt. Tôn trọng prefers-reduced-motion: bỏ chuyển động lớn, bỏ sticky storytelling và hiệu ứng gấp/lật, cho nội dung hiện ngay; chỉ giữ phản hồi trạng thái tối thiểu. Tất cả CTA, filter, marker và menu dùng được bằng chuột, cảm ứng và bàn phím; focus rõ. Trên điện thoại, tránh để nút trợ lý nổi che CTA hoặc nội dung. Bảo đảm mượt trên máy tầm trung và không làm tăng đáng kể thời gian tải trang.

## Cách triển khai và bàn giao

Trước khi sửa mã, hãy xem các component/CSS hiện có và viết một motion storyboard ngắn: mỗi hiệu ứng gồm điểm kích hoạt, trạng thái đầu/cuối, thời lượng, easing và phiên bản mobile/reduced-motion. Sau đó sửa trực tiếp dự án React hiện tại; dùng CSS, IntersectionObserver và chỉ thêm thư viện animation nếu lợi ích rõ ràng. Không thay dữ liệu demo hoặc thiết kế lại toàn bộ màu/chữ. Tạo các token motion dùng chung thay vì rải giá trị thời gian khác nhau khắp CSS. Sau khi làm, mở website kiểm tra trên desktop và mobile; thử cuộn chậm/cuộn nhanh/cuộn ngược, menu, gian hàng → đúng điểm bản đồ → quay lại, bộ lọc sự kiện, di sản và chế độ giảm chuyển động. Bàn giao bản chạy được kèm ghi chú ngắn về bốn khoảnh khắc đã triển khai, các giới hạn của bản demo và những hiệu ứng đã giảm/bỏ trên mobile. Chỉ coi nhiệm vụ hoàn thành khi hiệu ứng làm trải nghiệm tham quan thú vị hơn mà người dùng vẫn tìm thông tin nhanh như trước.
