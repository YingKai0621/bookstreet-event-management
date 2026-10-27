-- V12 was applied locally; correct its Activity time-zone conversion without
-- rewriting the applied migration. Both slots stay inside their parent Event.
UPDATE activities a
SET start_at = ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                + CASE WHEN a.registration_required THEN TIME '10:00' ELSE TIME '14:00' END)
                AT TIME ZONE 'Asia/Ho_Chi_Minh',
    end_at = ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              + CASE WHEN a.registration_required THEN TIME '11:30' ELSE TIME '16:00' END)
              AT TIME ZONE 'Asia/Ho_Chi_Minh',
    registration_deadline_at = CASE WHEN a.registration_required THEN
        ((e.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + TIME '09:30')
            AT TIME ZONE 'Asia/Ho_Chi_Minh' ELSE NULL END,
    updated_at = CURRENT_TIMESTAMP
FROM events e
WHERE a.event_id = e.event_id
  AND e.name LIKE '[Demo Participant] %';
