package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.repository.NotificationContextEvent;
import com.swp391.bookstreet.notification.repository.NotificationRepository;
import com.swp391.bookstreet.notification.security.NotificationCurrentUser;
import java.lang.reflect.Field;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationInboxServiceTests {
    private static final long USER_ID = 42L;
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00.123456Z");

    @Mock NotificationRepository repository;
    @Mock NotificationCurrentUser currentUser;

    private NotificationInboxService service;

    @BeforeEach
    void setUp() {
        service = new NotificationInboxService(
                repository, currentUser, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void listScopesByUserAndRoleAndAddsDerivedContext() {
        Notification notification = notification(
                101L,
                NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_NEW_PARTNER_APPLICATION,
                81L,
                null);
        when(currentUser.requireUserId(NotificationRecipientRole.ORGANIZER)).thenReturn(USER_ID);
        when(repository.findNotifications(
                eq(USER_ID),
                eq(NotificationRecipientRole.ORGANIZER),
                eq(NotificationType.ORGANIZER_NEW_PARTNER_APPLICATION),
                eq(false),
                any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(notification)));
        NotificationContextEvent context = mock(NotificationContextEvent.class);
        when(context.getNotificationId()).thenReturn(101L);
        when(context.getContextEventId()).thenReturn(55L);
        when(repository.findContextEventIds(List.of(101L))).thenReturn(List.of(context));

        var result = service.list(
                NotificationRecipientRole.ORGANIZER,
                "0", "20", "createdAt,desc", "false",
                "ORGANIZER_NEW_PARTNER_APPLICATION");

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).contextEventId()).isEqualTo(55L);
        assertThat(result.content().get(0).referenceId()).isEqualTo(81L);
        assertThat(result.content().get(0).read()).isFalse();
    }

    @Test
    void listRejectsRoleIncompatibleType() {
        assertThatThrownBy(() -> service.list(
                NotificationRecipientRole.PARTNER,
                "0", "20", "createdAt,desc", null,
                "EVENT_CANCELLED"))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> {
                    ApiException exception = (ApiException) error;
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.getCode()).isEqualTo("INVALID_ENUM_VALUE");
                });
    }

    @Test
    void listRejectsInvalidDeclaredQueryValues() {
        assertCode("x", "20", "createdAt,desc", null, "INVALID_PAGE");
        assertCode("0", "0", "createdAt,desc", null, "INVALID_SIZE");
        assertCode("0", "20", "title,asc", null, "INVALID_SORT");
        assertCode("0", "20", "createdAt,desc", "maybe", "INVALID_FILTER");
    }

    @Test
    void unreadCountUsesBothUserAndRole() {
        when(currentUser.requireUserId(NotificationRecipientRole.PARTNER)).thenReturn(USER_ID);
        when(repository.countByRecipientUserIdAndRecipientRoleAndReadAtIsNull(
                USER_ID, NotificationRecipientRole.PARTNER)).thenReturn(4L);

        assertThat(service.getUnreadCount(NotificationRecipientRole.PARTNER).unreadCount())
                .isEqualTo(4L);
    }

    @Test
    void markOneUsesConditionalUpdateThenReturnsDurableState() {
        Notification notification = notification(
                201L,
                NotificationRecipientRole.PARTICIPANT,
                NotificationType.EVENT_CANCELLED,
                77L,
                NOW.minusSeconds(5));
        when(currentUser.requireUserId(NotificationRecipientRole.PARTICIPANT)).thenReturn(USER_ID);
        when(repository.findByNotificationIdAndRecipientUserIdAndRecipientRole(
                201L, USER_ID, NotificationRecipientRole.PARTICIPANT))
                .thenReturn(Optional.of(notification));
        NotificationContextEvent context = mock(NotificationContextEvent.class);
        when(context.getNotificationId()).thenReturn(201L);
        when(context.getContextEventId()).thenReturn(77L);
        when(repository.findContextEventIds(List.of(201L))).thenReturn(List.of(context));

        var result = service.markAsRead(NotificationRecipientRole.PARTICIPANT, "201");

        verify(repository).markOneAsRead(
                201L, USER_ID, NotificationRecipientRole.PARTICIPANT, NOW);
        assertThat(result.readAt()).isEqualTo(NOW.minusSeconds(5));
    }

    @Test
    void markOneConcealsUnknownOtherOwnerAndOtherRole() {
        when(currentUser.requireUserId(NotificationRecipientRole.ADMIN)).thenReturn(USER_ID);
        when(repository.findByNotificationIdAndRecipientUserIdAndRecipientRole(
                999L, USER_ID, NotificationRecipientRole.ADMIN))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markAsRead(NotificationRecipientRole.ADMIN, "999"))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getCode())
                        .isEqualTo("NOTIFICATION_NOT_FOUND"));
    }

    @Test
    void markOneRejectsNonNumericNonPositiveAndOverflowIdentifiers() {
        for (String value : List.of("abc", "0", "-1", "9223372036854775808")) {
            assertThatThrownBy(() -> service.markAsRead(
                    NotificationRecipientRole.PARTICIPANT, value))
                    .isInstanceOf(ApiException.class)
                    .satisfies(error -> {
                        ApiException exception = (ApiException) error;
                        assertThat(exception.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                        assertThat(exception.getCode()).isEqualTo("INVALID_IDENTIFIER");
                    });
        }
    }

    @Test
    void markAllUsesOneRoleScopedTimestamp() {
        when(currentUser.requireUserId(NotificationRecipientRole.PARTNER)).thenReturn(USER_ID);
        when(repository.markAllAsRead(USER_ID, NotificationRecipientRole.PARTNER, NOW))
                .thenReturn(3);

        assertThat(service.markAllAsRead(NotificationRecipientRole.PARTNER).updatedCount())
                .isEqualTo(3);
    }

    private void assertCode(
            String page, String size, String sort, String read, String expectedCode) {
        assertThatThrownBy(() -> service.list(
                NotificationRecipientRole.PARTICIPANT,
                page, size, sort, read, null))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getCode())
                        .isEqualTo(expectedCode));
    }

    private Notification notification(
            Long id,
            NotificationRecipientRole role,
            NotificationType type,
            Long referenceId,
            Instant readAt) {
        try {
            var constructor = Notification.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Notification entity = constructor.newInstance();
            set(entity, "notificationId", id);
            set(entity, "recipientUserId", USER_ID);
            set(entity, "recipientRole", role);
            set(entity, "type", type);
            if (type == NotificationType.EVENT_CANCELLED) {
                set(entity, "eventId", referenceId);
            } else {
                set(entity, "partnerEventApplicationId", referenceId);
            }
            set(entity, "deduplicationKey", "key-" + id);
            set(entity, "title", "Tiêu đề");
            set(entity, "message", "Nội dung");
            set(entity, "createdAt", NOW.minusSeconds(60));
            set(entity, "readAt", readAt);
            return entity;
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void set(Object target, String name, Object value) throws ReflectiveOperationException {
        Field field = target.getClass().getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }
}
