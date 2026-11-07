package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.repository.NotificationRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationWriterServiceTests {
    private static final Instant CREATED_AT = Instant.parse("2026-11-04T01:00:00Z");

    private NotificationRepository repository;
    private ApplicationEventPublisher eventPublisher;
    private NotificationWriterService service;

    @BeforeEach
    void setUp() {
        repository = mock(NotificationRepository.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        service = new NotificationWriterService(repository, eventPublisher);
    }

    @Test
    void writesValidatedRoleScopedNotificationAndReturnsDurableRow() {
        Notification stored = mock(Notification.class);
        when(repository.findByRecipientUserIdAndRecipientRoleAndDeduplicationKey(
                7L, NotificationRecipientRole.ORGANIZER, "application:31:submitted"))
                .thenReturn(Optional.of(stored));
        when(repository.insertIfAbsent(
                7L, "ORGANIZER", "ORGANIZER_NEW_PARTNER_APPLICATION",
                null, null, null, null,
                31L, null, null, null,
                "application:31:submitted", "Đơn đăng ký mới",
                "Có một hồ sơ đang chờ duyệt.", CREATED_AT))
                .thenReturn(1);

        NotificationWriteResult result = service.write(new NotificationCommand(
                7L,
                NotificationRecipientRole.ORGANIZER,
                NotificationType.ORGANIZER_NEW_PARTNER_APPLICATION,
                null, null, null, null,
                31L, null, null, null,
                " application:31:submitted ",
                " Đơn đăng ký mới ",
                " Có một hồ sơ đang chờ duyệt. ",
                CREATED_AT));

        assertThat(result.notification()).isSameAs(stored);
        assertThat(result.created()).isTrue();
        verify(repository).insertIfAbsent(
                7L,
                "ORGANIZER",
                "ORGANIZER_NEW_PARTNER_APPLICATION",
                null, null, null, null,
                31L, null, null, null,
                "application:31:submitted",
                "Đơn đăng ký mới",
                "Có một hồ sơ đang chờ duyệt.",
                CREATED_AT);
        verify(eventPublisher).publishEvent(
                new NotificationCreated(7L, NotificationRecipientRole.ORGANIZER));
    }

    @Test
    void reportsExistingRowWhenDeduplicationConflictWins() {
        Notification stored = mock(Notification.class);
        when(repository.findByRecipientUserIdAndRecipientRoleAndDeduplicationKey(
                7L, NotificationRecipientRole.PARTNER, "event:4:cancelled"))
                .thenReturn(Optional.of(stored));

        NotificationWriteResult result = service.write(new NotificationCommand(
                7L,
                NotificationRecipientRole.PARTNER,
                NotificationType.PARTNER_EVENT_CANCELLED,
                4L, null, null, null,
                null, null, null, null,
                "event:4:cancelled", "Sự kiện đã hủy", "Sự kiện không còn diễn ra.", CREATED_AT));

        assertThat(result.notification()).isSameAs(stored);
        assertThat(result.created()).isFalse();
        verifyNoInteractions(eventPublisher);
    }

    @Test
    void rejectsTypeFromAnotherRole() {
        assertThatThrownBy(() -> service.write(new NotificationCommand(
                7L,
                NotificationRecipientRole.PARTNER,
                NotificationType.ORGANIZER_NEW_PARTNER_APPLICATION,
                null, null, null, null,
                31L, null, null, null,
                "key", "title", "message", CREATED_AT)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recipientRole");
    }

    @Test
    void rejectsMoreThanOneReference() {
        assertThatThrownBy(() -> service.write(new NotificationCommand(
                7L,
                NotificationRecipientRole.PARTNER,
                NotificationType.PARTNER_EVENT_CANCELLED,
                4L, 5L, null, null,
                null, null, null, null,
                "key", "title", "message", CREATED_AT)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly its approved reference");
    }

    @Test
    void rejectsAdminBecauseNoCompatibleTypeExists() {
        assertThatThrownBy(() -> service.write(new NotificationCommand(
                7L,
                NotificationRecipientRole.ADMIN,
                NotificationType.EVENT_CANCELLED,
                4L, null, null, null,
                null, null, null, null,
                "key", "title", "message", CREATED_AT)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recipientRole");
    }
}
