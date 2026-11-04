package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.notification.dto.NotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.NotificationPageResponse;
import com.swp391.bookstreet.notification.dto.NotificationResponse;
import com.swp391.bookstreet.notification.dto.NotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.repository.NotificationContextEvent;
import com.swp391.bookstreet.notification.repository.NotificationRepository;
import com.swp391.bookstreet.notification.security.NotificationCurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NotificationInboxService {
    private final NotificationRepository notificationRepository;
    private final NotificationCurrentUser currentUser;
    private final Clock clock;

    public NotificationInboxService(
            NotificationRepository notificationRepository,
            NotificationCurrentUser currentUser,
            Clock clock) {
        this.notificationRepository = notificationRepository;
        this.currentUser = currentUser;
        this.clock = clock;
    }

    public NotificationPageResponse<NotificationResponse> list(
            NotificationRecipientRole role,
            String page,
            String size,
            String sort,
            String read,
            String type) {
        int parsedPage = parseInteger(page, "INVALID_PAGE", "page must be an integer.");
        int parsedSize = parseInteger(size, "INVALID_SIZE", "size must be an integer.");
        Boolean parsedRead = parseRead(read);
        NotificationType parsedType = parseType(role, type);
        Pageable pageable = NotificationPagination.of(parsedPage, parsedSize, sort);
        Long userId = currentUser.requireUserId(role);

        Page<Notification> pageResult = notificationRepository.findNotifications(
                userId, role, parsedType, parsedRead, pageable);
        Map<Long, Long> contextEventIds = findContextEventIds(pageResult.getContent());
        List<NotificationResponse> content = pageResult.getContent().stream()
                .map(notification -> NotificationResponse.from(
                        notification, contextEventIds.get(notification.getNotificationId())))
                .toList();

        return new NotificationPageResponse<>(
                content,
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages());
    }

    public NotificationUnreadCountResponse getUnreadCount(NotificationRecipientRole role) {
        Long userId = currentUser.requireUserId(role);
        long unreadCount = notificationRepository
                .countByRecipientUserIdAndRecipientRoleAndReadAtIsNull(userId, role);
        return new NotificationUnreadCountResponse(unreadCount);
    }

    @Transactional
    public NotificationResponse markAsRead(
            NotificationRecipientRole role, String notificationId) {
        long parsedNotificationId;
        try {
            parsedNotificationId = Long.parseLong(notificationId);
        } catch (NumberFormatException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER",
                    "notificationId must be positive.");
        }
        if (parsedNotificationId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER",
                    "notificationId must be positive.");
        }

        Long userId = currentUser.requireUserId(role);
        Instant operationTime = operationTime();
        notificationRepository.markOneAsRead(parsedNotificationId, userId, role, operationTime);
        Notification notification = notificationRepository
                .findByNotificationIdAndRecipientUserIdAndRecipientRole(
                        parsedNotificationId, userId, role)
                .orElseThrow(this::notFound);
        Long contextEventId = findContextEventIds(List.of(notification))
                .get(notification.getNotificationId());
        return NotificationResponse.from(notification, contextEventId);
    }

    @Transactional
    public NotificationBatchReadResponse markAllAsRead(NotificationRecipientRole role) {
        Long userId = currentUser.requireUserId(role);
        int updatedCount = notificationRepository.markAllAsRead(userId, role, operationTime());
        return new NotificationBatchReadResponse(updatedCount);
    }

    private int parseInteger(String value, String code, String message) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, code, message);
        }
    }

    private Boolean parseRead(String read) {
        if (read == null) return null;
        if ("true".equalsIgnoreCase(read)) return true;
        if ("false".equalsIgnoreCase(read)) return false;
        throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER",
                "read must be true or false.");
    }

    private NotificationType parseType(NotificationRecipientRole role, String type) {
        if (type == null || type.isBlank()) return null;
        try {
            NotificationType parsed = NotificationType.valueOf(type.trim());
            if (!parsed.supports(role)) throw new IllegalArgumentException();
            return parsed;
        } catch (IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ENUM_VALUE",
                    "type uses an unsupported notification type.");
        }
    }

    private Map<Long, Long> findContextEventIds(Collection<Notification> notifications) {
        if (notifications.isEmpty()) return Map.of();
        List<Long> ids = notifications.stream().map(Notification::getNotificationId).toList();
        Map<Long, Long> result = new HashMap<>();
        for (NotificationContextEvent context : notificationRepository.findContextEventIds(ids)) {
            result.put(context.getNotificationId(), context.getContextEventId());
        }
        return result;
    }

    private Instant operationTime() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND",
                "Notification not found.");
    }
}
