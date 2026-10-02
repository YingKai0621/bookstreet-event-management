package com.swp391.bookstreet.partner.dto;

import java.time.Instant;

public record OrganizerApplicationResponse(
        Long applicationId,
        Long eventId,
        Long partnerOrganizationId,
        String partnerOrganizationName,
        String partnerCategoryCode,
        String status,
        String applicationNote,
        String reviewNote,
        Instant submittedAt,
        Instant reviewedAt,
        Instant withdrawnAt
) {
}
