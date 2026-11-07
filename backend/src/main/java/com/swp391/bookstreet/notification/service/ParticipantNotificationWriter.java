package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.Notification;

public interface ParticipantNotificationWriter {
    Notification write(ParticipantNotificationCommand command);
}
