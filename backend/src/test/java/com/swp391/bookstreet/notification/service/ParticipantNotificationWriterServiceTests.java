package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.repository.ParticipantNotificationRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ParticipantNotificationWriterServiceTests {
    private ParticipantNotificationRepository repository;
    private ParticipantNotificationWriterService service;

    @BeforeEach
    void setUp() {
        repository = mock(ParticipantNotificationRepository.class);
        service = new ParticipantNotificationWriterService(repository);
    }

    @Test
    void writeNormalizesContentAndReturnsDurableNotification() {
        Instant createdAt = Instant.parse("2026-10-19T10:00:00Z");
        ParticipantNotification stored = mock(ParticipantNotification.class);
        when(repository.findByRecipientUserIdAndDeduplicationKey(
                41L, "activity-cancelled:19")).thenReturn(Optional.of(stored));

        ParticipantNotification result = service.write(new ParticipantNotificationCommand(
                41L,
                ParticipantNotificationType.ACTIVITY_CANCELLED,
                null,
                19L,
                null,
                "  activity-cancelled:19  ",
                "  Hoạt động đã hủy  ",
                "  Hoạt động không còn diễn ra.  ",
                createdAt));

        assertThat(result).isSameAs(stored);
        verify(repository).insertIfAbsent(
                41L,
                "ACTIVITY_CANCELLED",
                null,
                19L,
                null,
                "activity-cancelled:19",
                "Hoạt động đã hủy",
                "Hoạt động không còn diễn ra.",
                createdAt);
    }

    @Test
    void writeIsIdempotentWhenNotificationAlreadyExists() {
        Instant createdAt = Instant.parse("2026-10-19T10:00:00Z");
        ParticipantNotification stored = mock(ParticipantNotification.class);
        when(repository.insertIfAbsent(
                41L, "EVENT_CANCELLED", 7L, null, null,
                "event-cancelled:7", "Sự kiện đã hủy", "Sự kiện không còn diễn ra.", createdAt))
                .thenReturn(0);
        when(repository.findByRecipientUserIdAndDeduplicationKey(
                41L, "event-cancelled:7")).thenReturn(Optional.of(stored));

        ParticipantNotification result = service.write(new ParticipantNotificationCommand(
                41L,
                ParticipantNotificationType.EVENT_CANCELLED,
                7L,
                null,
                null,
                "event-cancelled:7",
                "Sự kiện đã hủy",
                "Sự kiện không còn diễn ra.",
                createdAt));

        assertThat(result).isSameAs(stored);
    }

    @Test
    void writeRejectsReferenceThatDoesNotMatchNotificationType() {
        ParticipantNotificationCommand command = new ParticipantNotificationCommand(
                41L,
                ParticipantNotificationType.CERTIFICATE_ISSUED,
                null,
                19L,
                null,
                "certificate-issued:19",
                "Chứng nhận đã cấp",
                "Chứng nhận đã sẵn sàng.",
                Instant.parse("2026-10-19T10:00:00Z"));

        assertThatThrownBy(() -> service.write(command))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly its approved reference");
        verifyNoInteractions(repository);
    }

    @Test
    void writeRejectsBlankOrOversizedNormalizedFields() {
        ParticipantNotificationCommand blankKey = new ParticipantNotificationCommand(
                41L,
                ParticipantNotificationType.EVENT_CANCELLED,
                7L,
                null,
                null,
                "   ",
                "Sự kiện đã hủy",
                "Sự kiện không còn diễn ra.",
                Instant.parse("2026-10-19T10:00:00Z"));

        assertThatThrownBy(() -> service.write(blankKey))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("deduplicationKey must not be blank");

        ParticipantNotificationCommand oversizedTitle = new ParticipantNotificationCommand(
                41L,
                ParticipantNotificationType.EVENT_CANCELLED,
                7L,
                null,
                null,
                "event-cancelled:7",
                "x".repeat(201),
                "Sự kiện không còn diễn ra.",
                Instant.parse("2026-10-19T10:00:00Z"));
        assertThatThrownBy(() -> service.write(oversizedTitle))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title exceeds 200 characters");
        verifyNoInteractions(repository);
    }

    @Test
    void writeFailsIfInsertDoesNotProduceDurableRow() {
        ParticipantNotificationCommand command = new ParticipantNotificationCommand(
                41L,
                ParticipantNotificationType.EVENT_CANCELLED,
                7L,
                null,
                null,
                "event-cancelled:7",
                "Sự kiện đã hủy",
                "Sự kiện không còn diễn ra.",
                Instant.parse("2026-10-19T10:00:00Z"));
        when(repository.findByRecipientUserIdAndDeduplicationKey(
                41L, "event-cancelled:7")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.write(command))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("without a durable row");
    }
}
