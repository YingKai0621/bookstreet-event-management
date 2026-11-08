package com.swp391.bookstreet.partner.repository;

import java.time.Instant;

public interface OrganizerApplicationRow {
    Long getApplicationId();
    Long getEventId();
    Long getPartnerOrganizationId();
    String getPartnerOrganizationName();
    String getPartnerOrganizationStatus();
    String getPartnerCategoryCode();
    String getStatus();
    String getApplicationNote();
    String getReviewNote();
    Instant getSubmittedAt();
    Instant getReviewedAt();
    Instant getWithdrawnAt();
}
