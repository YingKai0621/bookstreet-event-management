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
import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParticipantNotificationServiceTests {

    private static final Long PARTICIPANT_ID = 42L;
    private static final Instant NOW = Instant.parse("2026-10-25T10:00:00Z");

    @Mock
    private ParticipantNotificationRepository notificationRepository;

    @Mock
    private NotificationCurrentUser currentUser;

    private Clock clock;
    private ParticipantNotificationService service;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new ParticipantNotificationService(notificationRepository, currentUser, clock);
    }

    @Test
    @DisplayName("list() with default pagination and sorting returns page of notifications")
    void list_withDefaultPagination_returnsPagedResponse() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        ParticipantNotification notification = createNotification(
                101L,
                PARTICIPANT_ID,
                ParticipantNotificationType.ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED,
                null,
                55L,
                null,
                "Lịch hoạt động đã thay đổi",
                "Hoạt động đã đổi phòng.",
                NOW.minusSeconds(3600),
                null);

        Page<ParticipantNotification> page = new PageImpl<>(List.of(notification));
        when(notificationRepository.findNotifications(eq(PARTICIPANT_ID), eq(null), eq(null), any(Pageable.class)))
                .thenReturn(page);

        ParticipantNotificationPageResponse<ParticipantNotificationResponse> response =
                service.list(0, 20, "createdAt,desc", null, null);

        assertThat(response.content()).hasSize(1);
        assertThat(response.content().get(0).notificationId()).isEqualTo(101L);
        assertThat(response.content().get(0).title()).isEqualTo("Lịch hoạt động đã thay đổi");
        assertThat(response.content().get(0).read()).isFalse();
    }

    @Test
    @DisplayName("list() with read and type filters passes parsed criteria to repository")
    void list_withFilters_passesCriteriaToRepository() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Page<ParticipantNotification> emptyPage = new PageImpl<>(List.of());
        when(notificationRepository.findNotifications(
                eq(PARTICIPANT_ID),
                eq(ParticipantNotificationType.CERTIFICATE_ISSUED),
                eq(true),
                any(Pageable.class))).thenReturn(emptyPage);

        ParticipantNotificationPageResponse<ParticipantNotificationResponse> response =
                service.list(0, 10, "readAt,asc", true, "CERTIFICATE_ISSUED");

        assertThat(response.content()).isEmpty();
    }

    @Test
    @DisplayName("list() with invalid page throws 400 INVALID_PAGE")
    void list_withInvalidPage_throwsInvalidPage() {
        assertThatThrownBy(() -> service.list(-1, 20, "createdAt,desc", null, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getCode()).isEqualTo("INVALID_PAGE");
                });
    }

    @Test
    @DisplayName("list() with invalid size throws 400 INVALID_SIZE")
    void list_withInvalidSize_throwsInvalidSize() {
        assertThatThrownBy(() -> service.list(0, 0, "createdAt,desc", null, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getCode()).isEqualTo("INVALID_SIZE");
                });
    }

    @Test
    @DisplayName("list() with invalid sort throws 400 INVALID_SORT")
    void list_withInvalidSort_throwsInvalidSort() {
        assertThatThrownBy(() -> service.list(0, 20, "title,asc", null, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getCode()).isEqualTo("INVALID_SORT");
                });
    }

    @Test
    @DisplayName("list() with invalid type throws 400 INVALID_ENUM_VALUE")
    void list_withInvalidType_throwsInvalidEnumValue() {
        assertThatThrownBy(() -> service.list(0, 20, "createdAt,desc", null, "UNKNOWN_TYPE"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(ex.getCode()).isEqualTo("INVALID_ENUM_VALUE");
                });
    }

    @Test
    @DisplayName("getUnreadCount() returns unread notification count for participant")
    void getUnreadCount_returnsCorrectCount() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);
        when(notificationRepository.countByRecipientUserIdAndReadAtIsNull(PARTICIPANT_ID))
                .thenReturn(5L);

        ParticipantNotificationUnreadCountResponse response = service.getUnreadCount();

        assertThat(response.unreadCount()).isEqualTo(5L);
    }

    @Test
    @DisplayName("markAsRead() updates readAt for unread notification and returns 200")
    void markAsRead_unreadNotification_setsReadAt() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        ParticipantNotification notification = createNotification(
                201L,
                PARTICIPANT_ID,
                ParticipantNotificationType.EVENT_CANCELLED,
                10L,
                null,
                null,
                "Sự kiện đã bị hủy",
                "Sự kiện đã hủy vì lý do thời tiết.",
                NOW.minusSeconds(600),
                null);

        when(notificationRepository.findByNotificationIdAndRecipientUserId(201L, PARTICIPANT_ID))
                .thenReturn(Optional.of(notification));

        ParticipantNotificationResponse response = service.markAsRead(201L);

        assertThat(response.notificationId()).isEqualTo(201L);
        assertThat(response.read()).isTrue();
        assertThat(response.readAt()).isEqualTo(NOW);
    }

    @Test
    @DisplayName("markAsRead() retry preserves initial readAt (idempotent replay)")
    void markAsRead_alreadyRead_preservesInitialReadAt() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Instant firstReadAt = NOW.minusSeconds(300);
        ParticipantNotification notification = createNotification(
                202L,
                PARTICIPANT_ID,
                ParticipantNotificationType.CERTIFICATE_ISSUED,
                null,
                null,
                88L,
                "Chứng chỉ đã được cấp",
                "Chứng chỉ hoàn thành hoạt động đã sẵn sàng.",
                NOW.minusSeconds(600),
                firstReadAt);

        when(notificationRepository.findByNotificationIdAndRecipientUserId(202L, PARTICIPANT_ID))
                .thenReturn(Optional.of(notification));

        ParticipantNotificationResponse response = service.markAsRead(202L);

        assertThat(response.read()).isTrue();
        assertThat(response.readAt()).isEqualTo(firstReadAt);
    }

    @Test
    @DisplayName("markAsRead() with non-existent or foreign notification throws 404 NOTIFICATION_NOT_FOUND")
    void markAsRead_foreignOrNotFound_throwsNotificationNotFound() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);
        when(notificationRepository.findByNotificationIdAndRecipientUserId(999L, PARTICIPANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markAsRead(999L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException ex = (ApiException) e;
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(ex.getCode()).isEqualTo("NOTIFICATION_NOT_FOUND");
                });
    }

    @Test
    @DisplayName("markAllAsRead() calls repository bulk update and returns updatedCount")
    void markAllAsRead_callsRepositoryBulkUpdate() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);
        when(notificationRepository.markAllAsRead(PARTICIPANT_ID, NOW)).thenReturn(3);

        ParticipantNotificationBatchReadResponse response = service.markAllAsRead();

        assertThat(response.updatedCount()).isEqualTo(3);
        verify(notificationRepository).markAllAsRead(PARTICIPANT_ID, NOW);
    }

    private ParticipantNotification createNotification(
            Long id,
            Long recipientUserId,
            ParticipantNotificationType type,
            Long eventId,
            Long activityId,
            Long certificateId,
            String title,
            String message,
            Instant createdAt,
            Instant readAt) {
        try {
            var constructor = ParticipantNotification.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            ParticipantNotification entity = constructor.newInstance();

            setField(entity, "notificationId", id);
            setField(entity, "recipientUserId", recipientUserId);
            setField(entity, "type", type);
            setField(entity, "eventId", eventId);
            setField(entity, "activityId", activityId);
            setField(entity, "certificateId", certificateId);
            setField(entity, "deduplicationKey", "key-" + id);
            setField(entity, "title", title);
            setField(entity, "message", message);
            setField(entity, "createdAt", createdAt);
            setField(entity, "readAt", readAt);
            return entity;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
