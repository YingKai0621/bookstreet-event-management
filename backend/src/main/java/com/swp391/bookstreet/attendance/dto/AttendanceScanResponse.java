package com.swp391.bookstreet.attendance.dto;

import com.swp391.bookstreet.registration.dto.AttendanceSummaryResponse;

public record AttendanceScanResponse(Long activityRegistrationId, Long activityId,
        String activityTitle, AttendanceSummaryResponse attendance, boolean alreadyRecorded) {}
