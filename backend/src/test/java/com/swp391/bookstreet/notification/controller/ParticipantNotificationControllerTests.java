package com.swp391.bookstreet.notification.controller;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.common.exception.GlobalExceptionHandler;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationBatchReadResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationPageResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationResponse;
import com.swp391.bookstreet.notification.dto.ParticipantNotificationUnreadCountResponse;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationReferenceType;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ParticipantNotificationControllerTests {

    private static final String BASE_URL = "/api/v1/participant/notifications";
    private static final Instant NOW = Instant.parse("2026-10-25T10:00:00Z");

    @Mock
    private ParticipantNotificationService service;

    @InjectMocks
    private ParticipantNotificationController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/participant/notifications returns 200 with paged response")
    void list_returns200WithPagedContent() throws Exception {
        ParticipantNotificationResponse item = new ParticipantNotificationResponse(
                801L,
                ParticipantNotificationType.ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED,
                "Lịch hoạt động đã thay đổi",
                "Hoạt động Giao lưu tác giả trẻ đã được cập nhật thời gian hoặc địa điểm.",
                ParticipantNotificationReferenceType.ACTIVITY,
                91L,
                NOW,
                null,
                false);

        ParticipantNotificationPageResponse<ParticipantNotificationResponse> page =
                new ParticipantNotificationPageResponse<>(List.of(item), 0, 20, 1L, 1);

        when(service.list(eq(0), eq(20), eq("createdAt,desc"), eq(null), eq(null)))
                .thenReturn(page);

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].notificationId").value(801))
                .andExpect(jsonPath("$.content[0].type").value("ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED"))
                .andExpect(jsonPath("$.content[0].referenceType").value("ACTIVITY"))
                .andExpect(jsonPath("$.content[0].referenceId").value(91))
                .andExpect(jsonPath("$.content[0].read").value(false));
    }

    @Test
    @DisplayName("GET /api/v1/participant/notifications/unread-count returns 200 with unread count")
    void getUnreadCount_returns200() throws Exception {
        when(service.getUnreadCount())
                .thenReturn(new ParticipantNotificationUnreadCountResponse(3L));

        mockMvc.perform(get(BASE_URL + "/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(3));
    }

    @Test
    @DisplayName("POST /api/v1/participant/notifications/{id}/read returns 200 with updated notification")
    void markAsRead_post_returns200() throws Exception {
        ParticipantNotificationResponse response = new ParticipantNotificationResponse(
                801L,
                ParticipantNotificationType.EVENT_CANCELLED,
                "Sự kiện đã bị hủy",
                "Sự kiện đã hủy vì lý do bất khả kháng.",
                ParticipantNotificationReferenceType.EVENT,
                7L,
                NOW.minusSeconds(3600),
                NOW,
                true);

        when(service.markAsRead(801L)).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/801/read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notificationId").value(801))
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.readAt").value(NOW.toString()));
    }


    @Test
    @DisplayName("POST /api/v1/participant/notifications/read-all returns 200 with updatedCount")
    void markAllAsRead_post_returns200() throws Exception {
        when(service.markAllAsRead()).thenReturn(new ParticipantNotificationBatchReadResponse(4));

        mockMvc.perform(post(BASE_URL + "/read-all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(4));
    }


    @Test
    @DisplayName("GET with invalid page returns 400 INVALID_PAGE")
    void list_invalidPage_returns400() throws Exception {
        when(service.list(eq(-1), anyInt(), anyString(), any(), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "page must be non-negative."));

        mockMvc.perform(get(BASE_URL + "?page=-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PAGE"));
    }

    @Test
    @DisplayName("POST non-existent notification read returns 404 NOTIFICATION_NOT_FOUND")
    void markAsRead_notFound_returns404() throws Exception {
        when(service.markAsRead(999L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "NOTIFICATION_NOT_FOUND", "Notification not found."));

        mockMvc.perform(post(BASE_URL + "/999/read"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));
    }
}
