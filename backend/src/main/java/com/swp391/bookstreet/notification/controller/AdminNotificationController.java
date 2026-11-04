package com.swp391.bookstreet.notification.controller;

import com.swp391.bookstreet.notification.dto.NotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.NotificationPageResponse;
import com.swp391.bookstreet.notification.dto.NotificationResponse;
import com.swp391.bookstreet.notification.dto.NotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.service.NotificationInboxService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {
    private final NotificationInboxService service;

    public AdminNotificationController(NotificationInboxService service) {
        this.service = service;
    }

    @GetMapping
    public NotificationPageResponse<NotificationResponse> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(defaultValue = "createdAt,desc") String sort,
            @RequestParam(required = false) String read,
            @RequestParam(required = false) String type) {
        return service.list(NotificationRecipientRole.ADMIN, page, size, sort, read, type);
    }

    @GetMapping("/unread-count")
    public NotificationUnreadCountResponse getUnreadCount() {
        return service.getUnreadCount(NotificationRecipientRole.ADMIN);
    }

    @PostMapping("/{notificationId}/read")
    public NotificationResponse markAsRead(@PathVariable String notificationId) {
        return service.markAsRead(NotificationRecipientRole.ADMIN, notificationId);
    }

    @PostMapping("/read-all")
    public NotificationBatchReadResponse markAllAsRead() {
        return service.markAllAsRead(NotificationRecipientRole.ADMIN);
    }
}
