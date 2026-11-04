package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ParticipantNotificationWriterServiceTests {
    @Test
    void participantAdapterPreservesExistingProducerContract() {
        NotificationWriter sharedWriter = mock(NotificationWriter.class);
        Notification stored = mock(Notification.class);
        when(sharedWriter.write(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new NotificationWriteResult(stored, true));
        ParticipantNotificationWriterService service =
                new ParticipantNotificationWriterService(sharedWriter);
        Instant createdAt = Instant.parse("2026-11-04T01:00:00Z");

        Notification result = service.write(new ParticipantNotificationCommand(
                9L,
                ParticipantNotificationType.BADGE_UNLOCKED,
                null, null, null, 23L,
                "user-badge:81", "Mở khóa huy hiệu", "Bạn vừa nhận huy hiệu.", createdAt));

        assertThat(result).isSameAs(stored);
        ArgumentCaptor<NotificationCommand> command =
                ArgumentCaptor.forClass(NotificationCommand.class);
        verify(sharedWriter).write(command.capture());
        assertThat(command.getValue().recipientRole())
                .isEqualTo(NotificationRecipientRole.PARTICIPANT);
        assertThat(command.getValue().type()).isEqualTo(NotificationType.BADGE_UNLOCKED);
        assertThat(command.getValue().badgeId()).isEqualTo(23L);
    }
}
