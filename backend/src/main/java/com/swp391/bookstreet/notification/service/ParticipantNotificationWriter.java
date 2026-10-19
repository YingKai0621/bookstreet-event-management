package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotification;

public interface ParticipantNotificationWriter {
    ParticipantNotification write(ParticipantNotificationCommand command);
}
