package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record AdminDashboardStatsDto(
        AccountsDto accounts,
        EventsDto events,
        long activeBoothAssignments,
        BigDecimal boothRevenue,
        List<AuditDayDto> auditByDay
) {
    public record AccountsDto(long total, Map<RoleCode, Long> byRole, Map<AccountStatus, Long> byStatus) {}

    public record EventsDto(long total, Map<EventStatus, Long> byStatus) {}

    public record AuditDayDto(LocalDate date, long count) {}
}
