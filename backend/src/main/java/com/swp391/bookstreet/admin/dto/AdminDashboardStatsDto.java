package com.swp391.bookstreet.admin.dto;

import java.util.List;
import java.util.Map;

public record AdminDashboardStatsDto(
        long userCount,
        long eventCount,
        long openEventCount,
        long boothCount,
        long activityCount,
        long todayActivityCount,
        Map<String, Long> usersByRole,
        List<AuditDayDto> auditByDay
) {
    public record AuditDayDto(
            String date,
            long count
    ) {
    }
}
