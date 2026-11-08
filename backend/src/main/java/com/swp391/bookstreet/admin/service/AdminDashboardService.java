package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.dto.AdminDashboardStatsDto;
import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentTransactionType;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDashboardService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final EntityManager entityManager;
    private final Clock clock;

    public AdminDashboardService(EntityManager entityManager, Clock clock) {
        this.entityManager = entityManager;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AdminDashboardStatsDto getStats() {
        Map<AccountStatus, Long> accountsByStatus = zeroCounts(AccountStatus.class);
        for (Object[] row : entityManager.createQuery(
                "select u.status, count(u) from User u group by u.status", Object[].class).getResultList()) {
            accountsByStatus.put((AccountStatus) row[0], ((Number) row[1]).longValue());
        }

        Map<RoleCode, Long> accountsByRole = zeroCounts(RoleCode.class);
        for (Object[] row : entityManager.createQuery(
                "select ur.role.code, count(distinct ur.user.id) from UserRole ur group by ur.role.code",
                Object[].class).getResultList()) {
            accountsByRole.put((RoleCode) row[0], ((Number) row[1]).longValue());
        }
        long accountTotal = accountsByStatus.values().stream().mapToLong(Long::longValue).sum();

        Map<EventStatus, Long> eventsByStatus = zeroCounts(EventStatus.class);
        for (Object[] row : entityManager.createQuery(
                "select e.status, count(e) from Event e group by e.status", Object[].class).getResultList()) {
            eventsByStatus.put((EventStatus) row[0], ((Number) row[1]).longValue());
        }
        long eventTotal = eventsByStatus.values().stream().mapToLong(Long::longValue).sum();

        long activeAssignments = entityManager.createQuery(
                "select count(a) from BoothAssignment a where a.status = :status", Long.class)
                .setParameter("status", BoothAssignmentStatus.ACTIVE)
                .getSingleResult();

        BigDecimal boothRevenue = entityManager.createQuery(
                "select sum(p.amount) from BoothPayment p where p.status = :status and p.transactionType = :type",
                BigDecimal.class)
                .setParameter("status", BoothPaymentStatus.SUCCESS)
                .setParameter("type", BoothPaymentTransactionType.PAYMENT)
                .getSingleResult();
        if (boothRevenue == null) boothRevenue = BigDecimal.ZERO;

        LocalDate today = LocalDate.now(clock.withZone(BUSINESS_ZONE));
        LocalDate firstDay = today.minusDays(6);
        Instant from = firstDay.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant until = clock.instant();
        Map<LocalDate, Long> auditCounts = new java.util.HashMap<>();
        if (until.isAfter(from)) {
            List<Instant> auditTimestamps = entityManager.createQuery(
                    "select a.createdAt from AdminAuditLog a where a.createdAt >= :from and a.createdAt <= :until",
                    Instant.class)
                    .setParameter("from", from)
                    .setParameter("until", until)
                    .getResultList();
            for (Instant timestamp : auditTimestamps) {
                LocalDate day = timestamp.atZone(BUSINESS_ZONE).toLocalDate();
                auditCounts.merge(day, 1L, Long::sum);
            }
        }
        List<AdminDashboardStatsDto.AuditDayDto> auditByDay = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) {
            LocalDate day = firstDay.plusDays(i);
            auditByDay.add(new AdminDashboardStatsDto.AuditDayDto(day, auditCounts.getOrDefault(day, 0L)));
        }

        return new AdminDashboardStatsDto(
                new AdminDashboardStatsDto.AccountsDto(accountTotal, accountsByRole, accountsByStatus),
                new AdminDashboardStatsDto.EventsDto(eventTotal, eventsByStatus),
                activeAssignments,
                boothRevenue,
                auditByDay);
    }

    private static <E extends Enum<E>> Map<E, Long> zeroCounts(Class<E> enumType) {
        Map<E, Long> counts = new EnumMap<>(enumType);
        for (E value : enumType.getEnumConstants()) counts.put(value, 0L);
        return counts;
    }
}
