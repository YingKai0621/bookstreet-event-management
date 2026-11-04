package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.Notification;

public record NotificationWriteResult(Notification notification, boolean created) {
}
