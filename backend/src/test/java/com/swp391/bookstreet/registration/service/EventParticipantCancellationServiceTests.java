package com.swp391.bookstreet.registration.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.registration.entity.ActivityRegistration;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationCancellationSource;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventParticipantCancellationServiceTests {
    private static final Instant CANCELLED_AT = Instant.parse("2026-10-22T12:00:00Z");

    @Mock EventRegistrationRepository eventRegistrations;
    @Mock ActivityRegistrationRepository activityRegistrations;
    @Mock ParticipantNotificationWriter notificationWriter;
    @Mock EventRegistration activeEventRegistration;
    @Mock EventRegistration leftEventRegistration;
    @Mock ActivityRegistration activeActivityRegistration;
    @Mock ActivityRegistration participantCancelledRegistration;
    @Mock ActivityRegistration historicalActiveRegistration;

    EventParticipantCancellationService service;

    @BeforeEach
    void setup() {
        service = new EventParticipantCancellationService(
                eventRegistrations, activityRegistrations, notificationWriter);
    }

    @Test
    void cancellationLocksInOrderCancelsOnlyAffectedActiveSeatsAndNotifiesActiveOwners() {
        when(activeEventRegistration.getEventRegistrationId()).thenReturn(10L);
        when(activeEventRegistration.getUserId()).thenReturn(101L);
        when(activeEventRegistration.getStatus()).thenReturn(EventRegistrationStatus.ACTIVE);
        when(leftEventRegistration.getEventRegistrationId()).thenReturn(20L);
        when(leftEventRegistration.getStatus()).thenReturn(EventRegistrationStatus.LEFT);
        when(eventRegistrations.findByEventIdForUpdate(7L))
                .thenReturn(List.of(activeEventRegistration, leftEventRegistration));
        when(activityRegistrations.findByEventRegistrationIdsForUpdate(List.of(10L, 20L)))
                .thenReturn(List.of(activeActivityRegistration,
                        participantCancelledRegistration, historicalActiveRegistration));
        when(activeActivityRegistration.getActivityId()).thenReturn(70L);
        when(activeActivityRegistration.getStatus())
                .thenReturn(ActivityRegistrationStatus.ACTIVE);
        when(participantCancelledRegistration.getActivityId()).thenReturn(70L);
        when(participantCancelledRegistration.getStatus())
                .thenReturn(ActivityRegistrationStatus.CANCELLED);
        when(historicalActiveRegistration.getActivityId()).thenReturn(80L);

        service.cancelEvent(7L, "Ngày hội sách", List.of(70L), CANCELLED_AT);

        InOrder order = inOrder(eventRegistrations, activityRegistrations, notificationWriter);
        order.verify(eventRegistrations).findByEventIdForUpdate(7L);
        order.verify(activityRegistrations)
                .findByEventRegistrationIdsForUpdate(List.of(10L, 20L));
        verify(activeActivityRegistration).cancel(
                ActivityRegistrationCancellationSource.EVENT, CANCELLED_AT);
        verify(participantCancelledRegistration, never()).cancel(
                ActivityRegistrationCancellationSource.EVENT, CANCELLED_AT);
        verify(historicalActiveRegistration, never()).cancel(
                ActivityRegistrationCancellationSource.EVENT, CANCELLED_AT);

        ArgumentCaptor<ParticipantNotificationCommand> command =
                ArgumentCaptor.forClass(ParticipantNotificationCommand.class);
        order.verify(notificationWriter).write(command.capture());
        assertThat(command.getValue()).satisfies(value -> {
            assertThat(value.recipientUserId()).isEqualTo(101L);
            assertThat(value.type()).isEqualTo(ParticipantNotificationType.EVENT_CANCELLED);
            assertThat(value.eventId()).isEqualTo(7L);
            assertThat(value.deduplicationKey()).isEqualTo("EVENT_CANCELLED:event:7");
            assertThat(value.createdAt()).isEqualTo(CANCELLED_AT);
        });
    }

    @Test
    void cancellationWithoutParticipantsDoesNotAttemptEmptyInQueryOrNotification() {
        when(eventRegistrations.findByEventIdForUpdate(7L)).thenReturn(List.of());

        service.cancelEvent(7L, "Ngày hội sách", List.of(70L), CANCELLED_AT);

        verifyNoInteractions(activityRegistrations, notificationWriter);
    }
}
