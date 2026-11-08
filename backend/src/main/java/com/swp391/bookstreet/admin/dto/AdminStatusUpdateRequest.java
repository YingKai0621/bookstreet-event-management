package com.swp391.bookstreet.admin.dto;

/** Section 4.5 of the Sprint 11 API contract. The service validates both fields exactly. */
public record AdminStatusUpdateRequest(
        String status,
        String reason
) {
}
