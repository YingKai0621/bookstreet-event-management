package com.swp391.bookstreet.notification.controller;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.common.exception.GlobalExceptionHandler;
import com.swp391.bookstreet.notification.dto.NotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.NotificationPageResponse;
import com.swp391.bookstreet.notification.dto.NotificationResponse;
import com.swp391.bookstreet.notification.dto.NotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationReferenceType;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.service.NotificationInboxService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ParticipantNotificationControllerTests {
    private static final String BASE_URL = "/api/v1/participant/notifications";
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");

    @Mock NotificationInboxService service;
    @InjectMocks ParticipantNotificationController controller;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listReturnsBackwardCompatiblePagedResponseWithAdditiveContext() throws Exception {
        NotificationResponse item = new NotificationResponse(
                801L,
                NotificationType.ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED,
                "Lịch hoạt động đã thay đổi",
                "Hoạt động đã được cập nhật.",
                NotificationReferenceType.ACTIVITY,
                91L,
                7L,
                NOW,
                null,
                false);
        when(service.list(
                NotificationRecipientRole.PARTICIPANT,
                "0", "20", "createdAt,desc", null, null))
                .thenReturn(new NotificationPageResponse<>(List.of(item), 0, 20, 1, 1));

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].type")
                        .value("ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED"))
                .andExpect(jsonPath("$.content[0].referenceType").value("ACTIVITY"))
                .andExpect(jsonPath("$.content[0].contextEventId").value(7))
                .andExpect(jsonPath("$.content[0].read").value(false));
    }

    @Test
    void unreadCountUsesParticipantRole() throws Exception {
        when(service.getUnreadCount(NotificationRecipientRole.PARTICIPANT))
                .thenReturn(new NotificationUnreadCountResponse(3));

        mockMvc.perform(get(BASE_URL + "/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(3));
    }

    @Test
    void readCommandsUseParticipantRole() throws Exception {
        NotificationResponse response = new NotificationResponse(
                801L, NotificationType.EVENT_CANCELLED,
                "Sự kiện đã bị hủy", "Sự kiện đã bị hủy.",
                NotificationReferenceType.EVENT, 7L, 7L,
                NOW.minusSeconds(60), NOW, true);
        when(service.markAsRead(NotificationRecipientRole.PARTICIPANT, "801"))
                .thenReturn(response);
        when(service.markAllAsRead(NotificationRecipientRole.PARTICIPANT))
                .thenReturn(new NotificationBatchReadResponse(4));

        mockMvc.perform(post(BASE_URL + "/801/read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").value(NOW.toString()));
        mockMvc.perform(post(BASE_URL + "/read-all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(4));
    }

    @Test
    void serviceValidationErrorUsesStableEnvelope() throws Exception {
        when(service.list(
                eq(NotificationRecipientRole.PARTICIPANT),
                eq("-1"), any(), any(), any(), any()))
                .thenThrow(new ApiException(
                        HttpStatus.BAD_REQUEST, "INVALID_PAGE", "page must be non-negative."));

        mockMvc.perform(get(BASE_URL + "?page=-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
    }
}
