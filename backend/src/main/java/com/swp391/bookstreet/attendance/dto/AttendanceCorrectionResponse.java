package com.swp391.bookstreet.attendance.dto;

import com.swp391.bookstreet.registration.dto.AttendanceSummaryResponse;

public record AttendanceCorrectionResponse(Participation participation, AttendanceSummaryResponse attendance,
        AttendanceAdjustmentResponse adjustment, Certificate certificate, String ratingStatus,
        boolean idempotentReplay) {
    public record Participation(Long activityRegistrationId, String registrationStatus,
            String cancellationSource, String outcome) {}
    public record Certificate(Long certificateId, String status) {}
}
