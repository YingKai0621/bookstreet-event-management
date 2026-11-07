package com.swp391.bookstreet.notification.controller;

import com.swp391.bookstreet.notification.dto.NotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.NotificationPageResponse;
import com.swp391.bookstreet.notification.dto.NotificationResponse;
import com.swp391.bookstreet.notification.dto.NotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.service.NotificationInboxService;
import com.swp391.bookstreet.notification.service.NotificationLiveUpdateHub;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/participant/notifications")
@PreAuthorize("hasRole('PARTICIPANT')")
public class ParticipantNotificationController {
    private final NotificationInboxService service;
    private final NotificationLiveUpdateHub liveUpdates;

    public ParticipantNotificationController(NotificationInboxService service,
            NotificationLiveUpdateHub liveUpdates) {
        this.service = service;
        this.liveUpdates = liveUpdates;
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return liveUpdates.open(NotificationRecipientRole.PARTICIPANT);
    }

    @GetMapping
    public NotificationPageResponse<NotificationResponse> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(defaultValue = "createdAt,desc") String sort,
            @RequestParam(required = false) String read,
            @RequestParam(required = false) String type) {
        return service.list(NotificationRecipientRole.PARTICIPANT, page, size, sort, read, type);
    }

    @GetMapping("/unread-count")
    public NotificationUnreadCountResponse getUnreadCount() {
        return service.getUnreadCount(NotificationRecipientRole.PARTICIPANT);
    }

    @PostMapping("/{notificationId}/read")
    public NotificationResponse markAsRead(@PathVariable String notificationId) {
        return service.markAsRead(NotificationRecipientRole.PARTICIPANT, notificationId);
    }

    @PostMapping("/read-all")
    public NotificationBatchReadResponse markAllAsRead() {
        return service.markAllAsRead(NotificationRecipientRole.PARTICIPANT);
    }
}
