package com.swp391.bookstreet.attendance.dto;

import com.swp391.bookstreet.attendance.entity.Attendance;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ParticipationOutcome;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record AttendanceStateResponse(String registrationStatus, String cancellationSource,
        String attendanceStatus, Instant attendedAt, String derivedDisplayOutcome) {
    public static AttendanceStateResponse from(ActivityRegistration registration, Attendance attendance) {
        return new AttendanceStateResponse(registration.getStatus().name(),
                registration.getCancellationSource() == null ? null : registration.getCancellationSource().name(),
                attendance == null ? null : attendance.getStatus().name(),
                attendance == null ? null : attendance.getAttendedAt(),
                ParticipationOutcome.of(registration, attendance).name());
    }

    public static AttendanceStateResponse from(Map<String, Object> snapshot) {
        Object time = snapshot.get("attended_at");
        return new AttendanceStateResponse((String) snapshot.get("registration_status"),
                (String) snapshot.get("cancellation_source"), (String) snapshot.get("attendance_status"),
                time == null ? null : Instant.parse(time.toString()),
                (String) snapshot.get("derived_display_outcome"));
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("registration_status", registrationStatus);
        result.put("cancellation_source", cancellationSource);
        result.put("attendance_status", attendanceStatus);
        result.put("attended_at", attendedAt == null ? null : attendedAt.toString());
        result.put("derived_display_outcome", derivedDisplayOutcome);
        return result;
    }
}
