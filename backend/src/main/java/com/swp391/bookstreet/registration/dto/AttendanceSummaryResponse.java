package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.attendance.entity.Attendance;
import java.time.Instant;

public record AttendanceSummaryResponse(
        Long attendanceId,
        String status,
        String recordedSource,
        Instant attendedAt,
        Instant createdAt,
        Instant updatedAt,
        Instant voidedAt) {
    public static AttendanceSummaryResponse from(Attendance attendance) {
        if (attendance == null) return null;
        return new AttendanceSummaryResponse(attendance.getAttendanceId(),
                attendance.getStatus().name(), attendance.getRecordedSource().name(),
                attendance.getAttendedAt(), attendance.getCreatedAt(),
                attendance.getUpdatedAt(), attendance.getVoidedAt());
    }
}
