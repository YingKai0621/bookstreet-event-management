-- Enrich only the six Participant demo Events. This follows the already applied V12-V14.
WITH content(name, description, banner_url) AS (
    VALUES
    ('[Demo Participant] Ngày hội sách cuối tuần',
     'Một ngày dành cho người yêu sách tại Đường Sách: trò chuyện cùng cộng đồng độc giả, khám phá sách mới, tham gia workshop và thư giãn ở góc đọc sách. Khách có thể tham quan tự do; tài khoản Participant cần tham gia sự kiện trước khi đăng ký hoạt động có giới hạn chỗ.',
     '/duong_sach_hero_bg.jpg'),
    ('[Demo Participant] Gặp gỡ tác giả trẻ',
     'Gặp gỡ các cây bút trẻ, nghe chia sẻ về hành trình viết và trao đổi trực tiếp về tác phẩm. Sự kiện này dùng để thử trường hợp đã hết hạn tham gia sự kiện; các hoạt động vẫn được hiển thị để xem thông tin.',
     '/vintage_book_ornament.jpg'),
    ('[Demo Participant] Hành trình văn học Việt',
     'Khám phá các câu chuyện văn học Việt qua phần giao lưu, workshop và không gian đọc mở. Hoạt động giao lưu có đúng một chỗ và đã được đăng ký để thử tình huống hết chỗ; các hoạt động khác vẫn có thể tham gia.',
     '/assets/heritage/ds-03.jpg'),
    ('[Demo Participant] Sách và sáng tạo',
     'Khơi gợi ý tưởng sáng tạo từ sách qua phần trò chuyện, thực hành làm dấu trang và trưng bày sản phẩm. Phù hợp với người muốn tìm một buổi trải nghiệm ngắn tại Đường Sách.',
     '/core_values_bg.jpg'),
    ('[Demo Participant] Hội chợ sách gia đình',
     'Không gian đọc và khám phá sách dành cho cả gia đình. Người tham dự có thể chọn hoạt động cần giữ chỗ hoặc ghé khu đọc và trưng bày tự do.',
     '/kim_dong_nxb_bg.jpg'),
    ('[Demo Participant] Ngày đọc sách cộng đồng',
     'Cùng cộng đồng chia sẻ cuốn sách yêu thích, tham gia workshop và dạo xem trưng bày tại Đường Sách. Các hoạt động có thời gian và địa điểm riêng trong lịch sự kiện.',
     '/assets/heritage/ds-08.jpg')
)
UPDATE events e
SET description = c.description,
    banner_url = c.banner_url,
    updated_at = CURRENT_TIMESTAMP
FROM content c
WHERE e.name = c.name;

UPDATE activities a
SET description = CASE
        WHEN a.registration_required THEN
            'Buổi giao lưu và hỏi đáp theo chủ đề của sự kiện. Cần đăng ký trước để giữ chỗ; sau khi đăng ký, người tham dự dùng mã QR chung của hoạt động để điểm danh trong khung giờ cho phép.'
        ELSE
            'Không gian đọc sách mở. Người tham dự có thể ghé trực tiếp trong khung giờ hoạt động, không cần đăng ký giữ chỗ.'
    END,
    image_url = CASE WHEN a.registration_required
        THEN '/vintage_book_ornament.jpg'
        ELSE '/assets/heritage/ds-05.jpg' END,
    updated_at = CURRENT_TIMESTAMP
FROM events e
WHERE a.event_id = e.event_id
  AND e.name LIKE '[Demo Participant] %'
  AND (a.title LIKE 'Giao lưu và hỏi đáp - %'
       OR a.title LIKE 'Góc đọc sách tự do - %');

-- The workshop room has a different physical location from the existing stage
-- and reading area; all new slots remain inside their parent Event's 08:00-18:00 window.
INSERT INTO activities (
    event_id, location_id, title, description, activity_type,
    start_at, end_at, registration_required, registration_deadline_at,
    capacity, image_url, attendance_qr_token, is_certificate_enabled,
    status, created_at, updated_at, published_at
)
SELECT e.event_id, l.location_id,
       'Workshop dấu trang - ' || e.name,
       'Tự làm dấu trang lấy cảm hứng từ cuốn sách yêu thích. Số chỗ giới hạn, cần đăng ký trước. Người tham dự đủ điều kiện có thể nhận chứng nhận sau khi điểm danh hợp lệ.',
       'WORKSHOP',
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '13:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       TRUE,
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '11:30') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       20, '/core_values_bg.jpg',
       md5('bookstreet-demo-workshop-' || e.event_id)::uuid,
       TRUE, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM events e
JOIN locations l ON l.code = 'DEMO_WORKSHOP'
WHERE e.name LIKE '[Demo Participant] %'
  AND NOT EXISTS (
      SELECT 1 FROM activities a
      WHERE a.event_id = e.event_id
        AND a.title = 'Workshop dấu trang - ' || e.name
  );

INSERT INTO activities (
    event_id, location_id, title, description, activity_type,
    start_at, end_at, registration_required, registration_deadline_at,
    capacity, image_url, attendance_qr_token, is_certificate_enabled,
    status, created_at, updated_at, published_at
)
SELECT e.event_id, l.location_id,
       'Trưng bày sách nổi bật - ' || e.name,
       'Ghé xem tuyển chọn sách theo chủ đề của sự kiện. Khu trưng bày mở cho mọi khách tham quan, không cần đăng ký trước.',
       'EXHIBITION',
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '16:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '17:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       FALSE, NULL, 80, '/assets/heritage/ds-08.jpg', NULL, FALSE,
       'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM events e
JOIN locations l ON l.code = 'DEMO_AREA'
WHERE e.name LIKE '[Demo Participant] %'
  AND NOT EXISTS (
      SELECT 1 FROM activities a
      WHERE a.event_id = e.event_id
        AND a.title = 'Trưng bày sách nổi bật - ' || e.name
  );
