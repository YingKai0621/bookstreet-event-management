-- Public demo schedule for Participant registration and Activity discovery.
-- Dates are fixed relative to the first migration run; use a fresh local database
-- when the schedule has passed. No Participant registrations are pre-created.
WITH demo_events AS (
    SELECT ordinal, title, day_offset
    FROM (VALUES
        (1, 'Ngày hội sách cuối tuần', 5),
        (2, 'Gặp gỡ tác giả trẻ', 7),
        (3, 'Hành trình văn học Việt', 10),
        (4, 'Sách và sáng tạo', 14),
        (5, 'Hội chợ sách gia đình', 21),
        (6, 'Ngày đọc sách cộng đồng', 28)
    ) AS rows(ordinal, title, day_offset)
), inserted_events AS (
    INSERT INTO events (
        organizer_user_id, name, description, start_at, end_at,
        partner_application_deadline_at, booth_request_deadline_at,
        activity_proposal_deadline_at, participant_registration_deadline_at,
        partner_withdrawal_cutoff_at, booth_cancellation_cutoff_at,
        activity_cancellation_cutoff_at, booth_payment_window_minutes,
        max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at
    )
    SELECT u.user_id, '[Demo Participant] ' || d.title,
           'Sự kiện mẫu để thử tham gia sự kiện và đăng ký hoạt động.',
           (v.demo_day + TIME '08:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
           (v.demo_day + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
           CURRENT_TIMESTAMP - INTERVAL '1 day',
           CURRENT_TIMESTAMP - INTERVAL '1 day',
           CURRENT_TIMESTAMP - INTERVAL '1 day',
           (v.demo_day + TIME '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
           CURRENT_TIMESTAMP - INTERVAL '1 day',
           CURRENT_TIMESTAMP - INTERVAL '1 day',
           CURRENT_TIMESTAMP - INTERVAL '1 day',
           1440, 5, 5, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM demo_events d
    CROSS JOIN LATERAL (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
               + d.day_offset AS demo_day
    ) v
    JOIN users u ON LOWER(u.username) = 'organizerdemo'
    WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.name = '[Demo Participant] ' || d.title)
    RETURNING event_id, name, start_at
)
SELECT COUNT(*) FROM inserted_events;

INSERT INTO locations (code, name, location_type, description, max_capacity,
                       map_x, map_y, is_active)
SELECT d.code, d.name, d.location_type, 'Địa điểm mẫu dành cho lịch hoạt động.',
       d.max_capacity, d.map_x, d.map_y, TRUE
FROM (VALUES
    ('DEMO_STAGE', 'Sân khấu trung tâm', 'STAGE', 150, 42, 30),
    ('DEMO_WORKSHOP', 'Phòng workshop', 'WORKSHOP', 40, 64, 55),
    ('DEMO_AREA', 'Khu đọc sách', 'AREA', 100, 22, 70)
) d(code, name, location_type, max_capacity, map_x, map_y)
WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.code = d.code);

INSERT INTO activities (
    event_id, location_id, title, description, activity_type,
    start_at, end_at, registration_required, registration_deadline_at,
    capacity, attendance_qr_token, is_certificate_enabled,
    status, created_at, updated_at, published_at
)
SELECT e.event_id, l.location_id,
       CASE WHEN a.slot = 1 THEN 'Giao lưu và hỏi đáp - ' || e.name
            ELSE 'Góc đọc sách tự do - ' || e.name END,
       CASE WHEN a.slot = 1 THEN 'Gặp gỡ và trao đổi về sách; cần đăng ký để giữ chỗ.'
            ELSE 'Đến tham gia trực tiếp, không cần đăng ký trước.' END,
       CASE WHEN a.slot = 1 THEN 'TALKSHOW' ELSE 'READING' END,
       (e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
           + CASE WHEN a.slot = 1 THEN TIME '10:00' ELSE TIME '14:00' END
           AT TIME ZONE 'Asia/Ho_Chi_Minh',
       (e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
           + CASE WHEN a.slot = 1 THEN TIME '11:30' ELSE TIME '16:00' END
           AT TIME ZONE 'Asia/Ho_Chi_Minh',
       a.slot = 1,
       CASE WHEN a.slot = 1 THEN
           ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '09:30')
               AT TIME ZONE 'Asia/Ho_Chi_Minh'
           ELSE NULL END,
       CASE WHEN a.slot = 1 THEN 30 ELSE 80 END,
       CASE WHEN a.slot = 1 THEN md5('bookstreet-demo-activity-' || e.event_id)::uuid
           ELSE NULL END,
       a.slot = 1, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM events e
CROSS JOIN (VALUES (1, 'DEMO_STAGE'), (2, 'DEMO_AREA')) a(slot, location_code)
JOIN locations l ON l.code = a.location_code
WHERE e.name LIKE '[Demo Participant] %'
  AND NOT EXISTS (
      SELECT 1 FROM activities existing
      WHERE existing.event_id = e.event_id
        AND existing.title = CASE WHEN a.slot = 1 THEN 'Giao lưu và hỏi đáp - ' || e.name
                                  ELSE 'Góc đọc sách tự do - ' || e.name END
  );
