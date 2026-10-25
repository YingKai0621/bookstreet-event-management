package com.swp391.bookstreet.notification.dto;

/**
 * NOTE: Chức năng 'read-all' (đánh dấu đã đọc tất cả thông báo) đã được cấp phép
 * bổ sung theo yêu cầu dự án để đồng bộ với Participant UI.
 */
public record ParticipantNotificationBatchReadResponse(
        int updatedCount
) {}
