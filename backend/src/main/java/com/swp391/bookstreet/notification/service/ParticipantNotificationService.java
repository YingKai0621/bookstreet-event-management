package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationPageResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.entity.ParticipantNotification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.repository.ParticipantNotificationRepository;
import com.swp391.bookstreet.notification.security.NotificationCurrentUser;
import java.time.Clock;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ParticipantNotificationService {

    private final ParticipantNotificationRepository notificationRepository;
    private final NotificationCurrentUser currentUser;
    private final Clock clock;

    public ParticipantNotificationService(
            ParticipantNotificationRepository notificationRepository,
            NotificationCurrentUser currentUser,
            Clock clock) {
        this.notificationRepository = notificationRepository;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    public ParticipantNotificationPageResponse<ParticipantNotificationResponse> list(
            int page, int size, String sort, Boolean read, String type) {
        ParticipantNotificationType parsedType = parseType(type);
        Pageable pageable = ParticipantNotificationPagination.of(page, size, sort);
        Long participantId = currentUser.requireParticipantId();

        Page<ParticipantNotification> pageResult = notificationRepository.findNotifications(
                participantId, parsedType, read, pageable);

        List<ParticipantNotificationResponse> content = pageResult.getContent().stream()
                .map(ParticipantNotificationResponse::from)
                .toList();

        return new ParticipantNotificationPageResponse<>(
                content,
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages());
    }

    public ParticipantNotificationUnreadCountResponse getUnreadCount() {
        Long participantId = currentUser.requireParticipantId();
        long unreadCount = notificationRepository.countByRecipientUserIdAndReadAtIsNull(participantId);
        return new ParticipantNotificationUnreadCountResponse(unreadCount);
    }

    @Transactional
    public ParticipantNotificationResponse markAsRead(Long notificationId) {
        if (notificationId == null || notificationId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER", "notificationId must be positive.");
        }

        Long participantId = currentUser.requireParticipantId();
        ParticipantNotification notification = notificationRepository
                .findByNotificationIdAndRecipientUserId(notificationId, participantId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "NOTIFICATION_NOT_FOUND",
                        "Notification not found."));

        notification.markRead(clock.instant());
        return ParticipantNotificationResponse.from(notification);
    }

    /**
     * NOTE: Chức năng 'read-all' (đánh dấu đã đọc tất cả thông báo) đã được cấp phép
     * bổ sung theo yêu cầu dự án để đồng bộ với Participant UI.
     */
    @Transactional
    public ParticipantNotificationBatchReadResponse markAllAsRead() {
        Long participantId = currentUser.requireParticipantId();
        int updatedCount = notificationRepository.markAllAsRead(participantId, clock.instant());
        return new ParticipantNotificationBatchReadResponse(updatedCount);
    }

    private ParticipantNotificationType parseType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        try {
            return ParticipantNotificationType.valueOf(type.trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_ENUM_VALUE",
                    "type uses an unsupported notification type.");
        }
    }
}
