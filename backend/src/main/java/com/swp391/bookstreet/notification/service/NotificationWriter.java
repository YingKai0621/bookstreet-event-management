package com.swp391.bookstreet.notification.service;

public interface NotificationWriter {
    NotificationWriteResult write(NotificationCommand command);
}
