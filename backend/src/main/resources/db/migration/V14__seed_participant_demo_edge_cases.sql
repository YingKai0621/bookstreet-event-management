-- Two realistic negative cases: an Event whose Join deadline has passed,
-- and an Activity whose only seat is held by another demo Participant.
UPDATE events
SET participant_registration_deadline_at = CURRENT_TIMESTAMP - INTERVAL '1 hour',
    updated_at = CURRENT_TIMESTAMP
WHERE name = '[Demo Participant] Gặp gỡ tác giả trẻ';

INSERT INTO users (username, email, password_hash, full_name,
                   email_verified_at, status)
SELECT 'seatdemoreader', 'seat.demo.reader@example.com',
       '$2a$10$pvN1yBhezmRmImNG22HPnOIU2e39H1AJpS1Za1JuYYnHzWq6kJQ6q',
       'Demo Seat Reader', CURRENT_TIMESTAMP, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(username) = 'seatdemoreader');

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u JOIN roles r ON r.code = 'PARTICIPANT'
WHERE LOWER(u.username) = 'seatdemoreader'
ON CONFLICT (user_id, role_id) DO NOTHING;

UPDATE activities a
SET capacity = 1, updated_at = CURRENT_TIMESTAMP
FROM events e
WHERE a.event_id = e.event_id
  AND e.name = '[Demo Participant] Hành trình văn học Việt'
  AND a.registration_required;

INSERT INTO event_registrations (user_id, event_id, status,
                                 registered_at, activated_at, updated_at)
SELECT u.user_id, e.event_id, 'ACTIVE', CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u CROSS JOIN events e
WHERE LOWER(u.username) = 'seatdemoreader'
  AND e.name = '[Demo Participant] Hành trình văn học Việt'
ON CONFLICT (user_id, event_id) DO NOTHING;

INSERT INTO activity_registrations (event_registration_id, activity_id, status,
                                    registered_at, activated_at, updated_at)
SELECT er.event_registration_id, a.activity_id, 'ACTIVE',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM event_registrations er
JOIN events e ON e.event_id = er.event_id
JOIN activities a ON a.event_id = e.event_id AND a.registration_required
JOIN users u ON u.user_id = er.user_id
WHERE LOWER(u.username) = 'seatdemoreader'
  AND e.name = '[Demo Participant] Hành trình văn học Việt'
ON CONFLICT (event_registration_id, activity_id) DO NOTHING;
