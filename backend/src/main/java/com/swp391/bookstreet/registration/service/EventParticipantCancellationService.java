package com.swp391.bookstreet.registration.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationCancellationSource;
import com.swp391.bookstreet.registration.entity.ActivityRegistrationStatus;
import com.swp391.bookstreet.registration.entity.EventRegistrationStatus;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventParticipantCancellationService {
    private static final String NOTIFICATION_TITLE = "Sự kiện đã bị hủy";

    private final EventRegistrationRepository eventRegistrationRepository;
    private final ActivityRegistrationRepository activityRegistrationRepository;
    private final ParticipantNotificationWriter notificationWriter;

    public EventParticipantCancellationService(
            EventRegistrationRepository eventRegistrationRepository,
            ActivityRegistrationRepository activityRegistrationRepository,
            ParticipantNotificationWriter notificationWriter) {
        this.eventRegistrationRepository = eventRegistrationRepository;
        this.activityRegistrationRepository = activityRegistrationRepository;
        this.notificationWriter = notificationWriter;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelEvent(Long eventId, String eventName,
            Collection<Long> seatActiveActivityIds, Instant cancelledAt) {
        Set<Long> affectedActivityIds = Set.copyOf(seatActiveActivityIds);
        var eventRegistrations = eventRegistrationRepository.findByEventIdForUpdate(eventId);
        var eventRegistrationIds = eventRegistrations.stream()
                .map(registration -> registration.getEventRegistrationId())
                .toList();
        if (!eventRegistrationIds.isEmpty()) {
            activityRegistrationRepository.findByEventRegistrationIdsForUpdate(
                            eventRegistrationIds)
                    .stream()
                    .filter(registration -> affectedActivityIds.contains(
                            registration.getActivityId()))
                    .filter(registration -> registration.getStatus()
                            == ActivityRegistrationStatus.ACTIVE)
                    .forEach(registration -> registration.cancel(
                            ActivityRegistrationCancellationSource.EVENT, cancelledAt));
        }

        String deduplicationKey = "EVENT_CANCELLED:event:" + eventId;
        String message = "Sự kiện \"" + eventName + "\" đã bị hủy.";
        eventRegistrations.stream()
                .filter(registration -> registration.getStatus()
                        == EventRegistrationStatus.ACTIVE)
                .forEach(registration -> notificationWriter.write(
                        new ParticipantNotificationCommand(
                                registration.getUserId(),
                                ParticipantNotificationType.EVENT_CANCELLED,
                                eventId,
                                null,
                                null,
                                deduplicationKey,
                                NOTIFICATION_TITLE,
                                message,
                                cancelledAt)));
    }
}
