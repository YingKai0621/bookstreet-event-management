package com.swp391.bookstreet.attendance.dto;

import com.swp391.bookstreet.attendance.entity.AttendanceStatus;
import java.time.Instant;

public record AttendanceCorrectionRequest(AttendanceStatus targetAttendanceStatus,
        Instant effectiveAttendedAt, String reason) {
    @com.fasterxml.jackson.annotation.JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("Unknown Attendance field.");
    }
}
