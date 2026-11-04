package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import org.springframework.stereotype.Service;

@Service
public class ParticipantNotificationWriterService implements ParticipantNotificationWriter {
    private final NotificationWriter notificationWriter;

    public ParticipantNotificationWriterService(NotificationWriter notificationWriter) {
        this.notificationWriter = notificationWriter;
    }

    @Override
    public Notification write(ParticipantNotificationCommand command) {
        return notificationWriter.write(new NotificationCommand(
                command.recipientUserId(),
                NotificationRecipientRole.PARTICIPANT,
                NotificationType.valueOf(command.type().name()),
                command.eventId(),
                command.activityId(),
                command.certificateId(),
                command.badgeId(),
                null,
                null,
                null,
                null,
                command.deduplicationKey(),
                command.title(),
                command.message(),
                command.createdAt())).notification();
    }
}
