package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.registration.entity.RegistrationWarningCode;
import java.util.List;

public record RegistrationWarningResponse(
        String code,
        String message,
        List<Long> conflictingActivityIds) {
    public static RegistrationWarningResponse scheduleOverlap(List<Long> activityIds) {
        return new RegistrationWarningResponse(RegistrationWarningCode.SCHEDULE_OVERLAP.name(),
                "Lịch hoạt động trùng với một hoạt động bạn đã đăng ký.",
                List.copyOf(activityIds));
    }
}
