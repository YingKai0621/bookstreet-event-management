package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.entity.AdminAuditLog;
import com.swp391.bookstreet.admin.repository.AdminAuditLogRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The only way to record an administrative change. It joins the caller's transaction, so a change and
 * its audit row commit or roll back together, and it takes the actor from the Session, never from input.
 * Call it only after a real change: a command that repeats the current state must not write a row.
 */
@Service
public class AdminAuditWriter {
    private final AdminAuditLogRepository auditLogs;
    private final UserRepository users;
    private final Clock clock;

    public AdminAuditWriter(AdminAuditLogRepository auditLogs, UserRepository users, Clock clock) {
        this.auditLogs = auditLogs;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void write(AdminAuditAction action, Long targetId, String targetLabel, String reason,
            Map<String, Object> details) {
        if (action.reasonRequired() == (reason == null)) {
            throw new IllegalArgumentException(action + " has the wrong reason presence.");
        }
        auditLogs.saveAndFlush(new AdminAuditLog(
                users.getReferenceById(currentActorId()),
                action,
                targetId,
                targetLabel,
                reason,
                details == null ? Map.of() : Map.copyOf(details),
                clock.instant().truncatedTo(ChronoUnit.MICROS)));
    }

    private static Long currentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal) {
            return principal.userId();
        }
        throw new IllegalStateException("An administrative change requires an authenticated actor.");
    }
}
