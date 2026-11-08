package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.EnumMap;
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

    /** Keeps the pre-Sprint 11 AdminUserService source compatible while that service is owned by Developer B. */
    public AdminDashboardStatsDto(long userCount, long eventCount, long openEventCount, long boothCount,
            long activityCount, long todayActivityCount, Map<String, Long> usersByRole,
            List<AuditDayDto> auditByDay) {
        this(new AccountsDto(userCount, roleCounts(usersByRole),
                        Map.of(AccountStatus.ACTIVE, userCount, AccountStatus.DISABLED, 0L)),
                new EventsDto(eventCount, eventCounts(eventCount, openEventCount)),
                boothCount, BigDecimal.ZERO, auditByDay);
    }

    private static Map<RoleCode, Long> roleCounts(Map<String, Long> counts) {
        Map<RoleCode, Long> result = new EnumMap<>(RoleCode.class);
        for (RoleCode role : RoleCode.values()) result.put(role, counts.getOrDefault(role.name().toLowerCase(), 0L));
        return result;
    }

    private static Map<EventStatus, Long> eventCounts(long total, long open) {
        Map<EventStatus, Long> result = new EnumMap<>(EventStatus.class);
        for (EventStatus status : EventStatus.values()) result.put(status, 0L);
        result.put(EventStatus.PUBLISHED, Math.min(total, open));
        return result;
    }

    public record AuditDayDto(LocalDate date, long count) {
        public AuditDayDto(String date, long count) {
            this(parseDate(date), count);
        }

        private static LocalDate parseDate(String date) {
            try {
                return LocalDate.parse(date);
            } catch (DateTimeParseException exception) {
                return LocalDate.MIN;
            }
        }
    }
}
