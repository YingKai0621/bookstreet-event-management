package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.entity.AdminAuditLog;
import com.swp391.bookstreet.admin.entity.AdminAuditTargetType;
import java.time.Instant;
import java.util.Map;

public record AdminAuditLogResponse(
        Long auditLogId,
        Actor actor,
        AdminAuditAction action,
        AdminAuditTargetType targetType,
        Long targetId,
        String targetLabel,
        String reason,
        Map<String, Object> details,
        Instant createdAt
) {
    public record Actor(Long userId, String username, String fullName) {
    }

    public static AdminAuditLogResponse from(AdminAuditLog log) {
        return new AdminAuditLogResponse(
                log.getId(),
                new Actor(log.getActor().getId(), log.getActor().getUsername(), log.getActor().getFullName()),
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getTargetLabel(),
                log.getReason(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
