ALTER TABLE activities
    ADD COLUMN attendance_early_scan_minutes INTEGER NOT NULL DEFAULT 15;

ALTER TABLE activities
    ADD CONSTRAINT ck_activities_attendance_early_scan_minutes
    CHECK (attendance_early_scan_minutes BETWEEN 0 AND 1440);
