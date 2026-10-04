package com.swp391.bookstreet.partner.dto;

import com.swp391.bookstreet.partner.entity.PartnerOrganization;

import java.time.Instant;

public record PartnerOrganizationResponse(
        Long partnerOrganizationId,
        String name,
        String description,
        String categoryCode,
        String logoUrl,
        String contactEmail,
        String contactPhone,
        String address,
        String status,
        Instant createdAt,
        Instant updatedAt
) {

    public static PartnerOrganizationResponse from(PartnerOrganization organization) {
        return new PartnerOrganizationResponse(
                organization.getId(),
                organization.getName(),
                organization.getDescription(),
                organization.getCategoryCode(),
                organization.getLogoUrl(),
                organization.getContactEmail(),
                organization.getContactPhone(),
                organization.getAddress(),
                organization.getStatus().name(),
                organization.getCreatedAt(),
                organization.getUpdatedAt()
        );
    }
}
