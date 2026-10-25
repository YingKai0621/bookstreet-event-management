package com.swp391.bookstreet.notification.dto;

import java.util.List;

public record ParticipantNotificationPageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
