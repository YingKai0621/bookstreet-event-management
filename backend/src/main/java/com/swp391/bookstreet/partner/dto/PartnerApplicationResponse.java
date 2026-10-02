package com.swp391.bookstreet.partner.dto;

import com.swp391.bookstreet.partner.entity.PartnerEventApplication;

import java.time.Instant;

public record PartnerApplicationResponse(
        Long applicationId,
        Long eventId,
        Long partnerOrganizationId,
        String status,
        String applicationNote,
        String reviewNote,
        Instant submittedAt,
        Instant reviewedAt,
        Instant withdrawnAt
) {

    public static PartnerApplicationResponse from(PartnerEventApplication application) {
        return new PartnerApplicationResponse(
                application.getId(),
                application.getEventId(),
                application.getPartnerOrganization().getId(),
                application.getStatus().name(),
                application.getApplicationNote(),
                application.getReviewNote(),
                application.getSubmittedAt(),
                application.getReviewedAt(),
                application.getWithdrawnAt()
        );
    }
}
