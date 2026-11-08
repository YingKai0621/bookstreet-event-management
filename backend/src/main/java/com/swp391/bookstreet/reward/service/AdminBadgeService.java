package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.admin.entity.AdminAuditAction;
import com.swp391.bookstreet.admin.service.AdminAuditWriter;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.reward.dto.*;
import com.swp391.bookstreet.reward.entity.Badge;
import com.swp391.bookstreet.reward.repository.AdminBadgeQueryRepository;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminBadgeService {
    private final RewardManagementCurrentUser currentUser;
    private final BadgeRepository badges;
    private final AdminBadgeQueryRepository queries;
    private final ApplicationEventPublisher events;
    private final AdminAuditWriter auditWriter;
    private final Clock clock;

    public AdminBadgeService(RewardManagementCurrentUser currentUser, BadgeRepository badges,
            AdminBadgeQueryRepository queries, ApplicationEventPublisher events,
            AdminAuditWriter auditWriter, Clock clock) {
        this.currentUser = currentUser;
        this.badges = badges;
        this.queries = queries;
        this.events = events;
        this.auditWriter = auditWriter;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public RewardPageResponse<AdminBadgeResponse> list(int page, int size, String sort, String active, String search) {
        currentUser.requireAdmin();
        return queries.list(RewardManagementQuery.badges(page, size, sort, search),
                RewardManagementQuery.activeFilter(active));
    }

    @Transactional(readOnly = true)
    public AdminBadgeResponse detail(Long badgeId) {
        currentUser.requireAdmin();
        RewardManagementQuery.positiveId(badgeId, true);
        return queries.response(badges.findById(badgeId).orElseThrow(AdminBadgeService::notFound));
    }

    @Transactional
    public AdminBadgeMutationResponse create(AdminBadgeRequest request) {
        currentUser.requireAdmin();
        AdminBadgeRequest value = AdminBadgeValidation.normalize(request);
        if (queries.nameExists(value.name(), null)) throw nameConflict();
        Badge badge = Badge.create(value.name(), value.description(), value.requiredPoints(),
                value.iconUrl(), value.isActive(), clock.instant());
        save(badge);
        auditWriter.write(AdminAuditAction.BADGE_CREATED, badge.getBadgeId(), badge.getName(), null,
                Map.of("changedFields", List.of("name", "description", "requiredPoints", "iconUrl", "isActive")));
        return mutationResult(badge, badge.isActive());
    }

    @Transactional
    public AdminBadgeMutationResponse update(Long badgeId, AdminBadgeRequest request) {
        currentUser.requireAdmin();
        RewardManagementQuery.positiveId(badgeId, true);
        AdminBadgeRequest value = AdminBadgeValidation.normalize(request);
        Badge badge = badges.findByBadgeIdForUpdate(badgeId).orElseThrow(AdminBadgeService::notFound);
        if (queries.nameExists(value.name(), badgeId)) throw nameConflict();
        List<String> changedFields = changedFields(badge, value);
        boolean trigger = value.isActive() && (!badge.isActive() || value.requiredPoints() < badge.getRequiredPoints());
        badge.update(value.name(), value.description(), value.requiredPoints(), value.iconUrl(),
                value.isActive(), clock.instant());
        save(badge);
        auditWriter.write(AdminAuditAction.BADGE_UPDATED, badge.getBadgeId(), badge.getName(), null,
                Map.of("changedFields", changedFields));
        return mutationResult(badge, trigger);
    }

    private static List<String> changedFields(Badge badge, AdminBadgeRequest value) {
        List<String> fields = new ArrayList<>();
        if (!Objects.equals(badge.getName(), value.name())) fields.add("name");
        if (!Objects.equals(badge.getDescription(), value.description())) fields.add("description");
        if (!Objects.equals(badge.getRequiredPoints(), value.requiredPoints())) fields.add("requiredPoints");
        if (!Objects.equals(badge.getIconUrl(), value.iconUrl())) fields.add("iconUrl");
        if (badge.isActive() != value.isActive()) fields.add("isActive");
        return List.copyOf(fields);
    }

    private AdminBadgeMutationResponse mutationResult(Badge badge, boolean trigger) {
        AdminBadgeResponse response = queries.response(badge);
        if (trigger) events.publishEvent(new BadgeSynchronizationRequested(badge.getBadgeId()));
        return new AdminBadgeMutationResponse(response, trigger);
    }

    private void save(Badge badge) {
        try { badges.saveAndFlush(badge); }
        catch (DataIntegrityViolationException error) {
            if (error.getMostSpecificCause().getMessage() != null
                    && error.getMostSpecificCause().getMessage().contains("uk_badges_name_case_insensitive")) {
                throw nameConflict();
            }
            throw error;
        }
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "BADGE_NOT_FOUND", "Không tìm thấy huy hiệu.");
    }

    private static ApiException nameConflict() {
        return new ApiException(HttpStatus.CONFLICT, "BADGE_NAME_CONFLICT", "Tên huy hiệu đã được sử dụng.");
    }
}
