package com.swp391.bookstreet.notification.controller;

import com.swp391.bookstreet.notification.dto.ParticipantNotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationPageResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.service.ParticipantNotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant/notifications")
public class ParticipantNotificationController {

    private final ParticipantNotificationService service;

    public ParticipantNotificationController(ParticipantNotificationService service) {
        this.service = service;
    }

    @GetMapping
    public ParticipantNotificationPageResponse<ParticipantNotificationResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort,
            @RequestParam(required = false) Boolean read,
            @RequestParam(required = false) String type) {
        return service.list(page, size, sort, read, type);
    }

    @GetMapping("/unread-count")
    public ParticipantNotificationUnreadCountResponse getUnreadCount() {
        return service.getUnreadCount();
    }

    @PostMapping("/{notificationId}/read")
    public ParticipantNotificationResponse markAsRead(@PathVariable Long notificationId) {
        return service.markAsRead(notificationId);
    }

    /**
     * NOTE: Chức năng 'read-all' (đánh dấu đã đọc tất cả thông báo) đã được cấp phép
     * bổ sung theo yêu cầu dự án để đồng bộ với Participant UI.
     */
    @PostMapping("/read-all")
    public ParticipantNotificationBatchReadResponse markAllAsRead() {
        return service.markAllAsRead();
    }
}
