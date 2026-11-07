package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.dto.AdminAuditLogResponse;
import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.entity.AdminAuditLog;
import com.swp391.bookstreet.admin.entity.AdminAuditTargetType;
import com.swp391.bookstreet.admin.repository.AdminAuditLogRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuditLogService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Sort NEWEST_FIRST =
            Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

    private final AdminAuditLogRepository auditLogs;

    public AdminAuditLogService(AdminAuditLogRepository auditLogs) {
        this.auditLogs = auditLogs;
    }

    @Transactional(readOnly = true)
    public AdminPageResponse<AdminAuditLogResponse> list(String page, String size, String actorUserId,
            String action, String targetType, String targetId, String from, String to) {
        Long actor = AdminPaging.optionalId(actorUserId, "actorUserId");
        AdminAuditAction actionFilter = AdminPaging.optionalEnum(AdminAuditAction.class, action, "action");
        AdminAuditTargetType typeFilter = AdminPaging.optionalEnum(AdminAuditTargetType.class, targetType, "targetType");
        Long target = AdminPaging.optionalId(targetId, "targetId");
        if (target != null && typeFilter == null) {
            throw AdminPaging.invalidFilter("targetId requires targetType.");
        }
        LocalDate fromDate = optionalDate(from, "from");
        LocalDate toDate = optionalDate(to, "to");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw AdminPaging.invalidFilter("from must not be later than to.");
        }

        Specification<AdminAuditLog> filter = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (actor != null) predicates.add(builder.equal(root.get("actor").get("id"), actor));
            if (actionFilter != null) predicates.add(builder.equal(root.get("action"), actionFilter));
            if (typeFilter != null) predicates.add(builder.equal(root.get("targetType"), typeFilter));
            if (target != null) predicates.add(builder.equal(root.get("targetId"), target));
            if (fromDate != null) {
                predicates.add(builder.greaterThanOrEqualTo(
                        root.<Instant>get("createdAt"), startOf(fromDate)));
            }
            if (toDate != null) {
                predicates.add(builder.lessThan(
                        root.<Instant>get("createdAt"), startOf(toDate.plusDays(1))));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return AdminPageResponse.from(
                auditLogs.findAll(filter, AdminPaging.of(page, size, NEWEST_FIRST)),
                AdminAuditLogResponse::from);
    }

    private static Instant startOf(LocalDate date) {
        return date.atStartOfDay(BUSINESS_ZONE).toInstant();
    }

    private static LocalDate optionalDate(String value, String name) {
        if (value == null) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw AdminPaging.invalidFilter(name + " must use yyyy-MM-dd.");
        }
    }
}
