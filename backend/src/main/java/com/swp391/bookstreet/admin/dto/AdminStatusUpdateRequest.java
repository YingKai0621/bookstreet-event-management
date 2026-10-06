package com.swp391.bookstreet.admin.dto;

public record AdminStatusUpdateRequest(
        String status,
        String reason
) {
}
