-- Disposable demo fixtures for Participant Join and Activity registration.
-- Relative dates are frozen when Flyway first applies this migration.
WITH scenarios(code, event_name, day_offset, event_join_open, partner_apply_open, description, banner_url) AS (
    VALUES
    ('HAPPY', '[Demo Scenarios] 01 - Đăng ký bình thường', 35, TRUE, TRUE,
     'Sự kiện còn hạn tham gia và còn hạn nộp đơn đối tác. Hai hoạt động cần giữ chỗ còn chỗ và còn hạn; một khu đọc sách tham gia trực tiếp.',
     '/duong_sach_hero_bg.jpg'),
    ('EVENT_DEADLINE', '[Demo Scenarios] 02 - Quá hạn tham gia sự kiện', 42, FALSE, FALSE,
     'Sự kiện chưa diễn ra nhưng đã quá hạn tham gia và quá hạn nộp đơn đối tác. Các hoạt động vẫn có thể xem; người chưa tham gia sự kiện không thể giữ chỗ.',
     '/vintage_book_ornament.jpg'),
    ('ACTIVITY_DEADLINE', '[Demo Scenarios] 03 - Một hoạt động quá hạn', 49, TRUE, TRUE,
     'Sự kiện còn hạn tham gia. Workshop đầu tiên đã quá hạn đăng ký; workshop thứ hai vẫn còn hạn và còn chỗ.',
     '/core_values_bg.jpg'),
    ('FULL', '[Demo Scenarios] 04 - Một hoạt động hết chỗ', 56, TRUE, TRUE,
     'Sự kiện còn hạn tham gia. Workshop đầu tiên chỉ có một chỗ và đã có người giữ; workshop thứ hai vẫn còn chỗ.',
     '/kim_dong_nxb_bg.jpg')
), scheduled AS (
    SELECT s.*, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + s.day_offset AS event_day
    FROM scenarios s
)
INSERT INTO events (
    organizer_user_id, name, description, start_at, end_at,
    partner_application_deadline_at, booth_request_deadline_at,
    activity_proposal_deadline_at, participant_registration_deadline_at,
    partner_withdrawal_cutoff_at, booth_cancellation_cutoff_at,
    activity_cancellation_cutoff_at, booth_payment_window_minutes,
    max_booths_per_partner, max_activities_per_partner, banner_url,
    status, created_at, updated_at
)
SELECT u.user_id, s.event_name, s.description,
       (s.event_day + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (s.event_day + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       CASE WHEN s.partner_apply_open THEN
           (s.event_day - 2 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
           ELSE CURRENT_TIMESTAMP - INTERVAL '1 day' END,
       (s.event_day - 2 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (s.event_day - 2 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       CASE WHEN s.event_join_open THEN
           (s.event_day - 1 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
           ELSE CURRENT_TIMESTAMP - INTERVAL '1 day' END,
       (s.event_day - 2 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (s.event_day - 2 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (s.event_day - 2 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
       1440, 5, 5, s.banner_url,
       'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM scheduled s
JOIN users u ON LOWER(u.username) = 'organizerdemo'
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.name = s.event_name);

-- Nonoverlapping physical slots on different dates, each inside its Event.
WITH activity_slots(slot, location_code, title_prefix, activity_type, start_time, end_time,
                    registration_required, capacity, image_url) AS (
    VALUES
    (1, 'DEMO_WORKSHOP', 'Workshop giữ chỗ A - ', 'WORKSHOP', TIME '09:00', TIME '10:00', TRUE, 20, '/core_values_bg.jpg'),
    (2, 'DEMO_STAGE', 'Giao lưu giữ chỗ B - ', 'TALKSHOW', TIME '11:00', TIME '12:00', TRUE, 30, '/vintage_book_ornament.jpg'),
    (3, 'DEMO_AREA', 'Góc đọc sách tự do - ', 'READING', TIME '14:00', TIME '16:00', FALSE, 80, '/assets/heritage/ds-05.jpg')
)
INSERT INTO activities (
    event_id, location_id, title, description, activity_type,
    start_at, end_at, registration_required, registration_deadline_at,
    capacity, image_url, attendance_qr_token, is_certificate_enabled,
    status, created_at, updated_at, published_at
)
SELECT e.event_id, l.location_id, s.title_prefix || e.name,
       CASE WHEN s.registration_required THEN
           'Hoạt động có giới hạn chỗ. Xem thời hạn đăng ký và số chỗ còn lại trước khi giữ chỗ.'
           ELSE 'Không cần đăng ký giữ chỗ; khách tham quan có thể đến trực tiếp trong giờ mở cửa.' END,
       s.activity_type,
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + s.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh',
       ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + s.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh',
       s.registration_required,
       CASE WHEN NOT s.registration_required THEN NULL
            WHEN e.name = '[Demo Scenarios] 03 - Một hoạt động quá hạn' AND s.slot = 1
                THEN CURRENT_TIMESTAMP - INTERVAL '1 hour'
            ELSE ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + s.start_time - INTERVAL '30 minutes')
                 AT TIME ZONE 'Asia/Ho_Chi_Minh' END,
       CASE WHEN e.name = '[Demo Scenarios] 04 - Một hoạt động hết chỗ' AND s.slot = 1
           THEN 1 ELSE s.capacity END,
       s.image_url,
       CASE WHEN s.registration_required THEN md5('bookstreet-scenario-' || e.event_id || '-' || s.slot)::uuid
            ELSE NULL END,
       s.registration_required, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM events e
CROSS JOIN activity_slots s
JOIN locations l ON l.code = s.location_code
WHERE e.name LIKE '[Demo Scenarios] %'
  AND NOT EXISTS (
      SELECT 1 FROM activities a
      WHERE a.event_id = e.event_id AND a.title = s.title_prefix || e.name
  );

-- Occupy the only seat in scenario 04 without affecting participantdemo.
INSERT INTO event_registrations (user_id, event_id, status, registered_at, activated_at, updated_at)
SELECT u.user_id, e.event_id, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u CROSS JOIN events e
WHERE LOWER(u.username) = 'seatdemoreader'
  AND e.name = '[Demo Scenarios] 04 - Một hoạt động hết chỗ'
ON CONFLICT (user_id, event_id) DO NOTHING;

INSERT INTO activity_registrations (
    event_registration_id, activity_id, status, registered_at, activated_at, updated_at
)
SELECT er.event_registration_id, a.activity_id, 'ACTIVE',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM event_registrations er
JOIN events e ON e.event_id = er.event_id
JOIN activities a ON a.event_id = e.event_id
JOIN users u ON u.user_id = er.user_id
WHERE LOWER(u.username) = 'seatdemoreader'
  AND e.name = '[Demo Scenarios] 04 - Một hoạt động hết chỗ'
  AND a.title LIKE 'Workshop giữ chỗ A - %'
ON CONFLICT (event_registration_id, activity_id) DO NOTHING;
