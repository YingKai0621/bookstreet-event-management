package com.swp391.bookstreet.admin.dto;

import com.swp391.bookstreet.auth.entity.AccountStatus;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import java.time.Instant;

public record AdminPartnerOrganizationResponse(
        Long partnerOrganizationId,
        String name,
        String description,
        String categoryCode,
        String logoUrl,
        String contactEmail,
        String contactPhone,
        String address,
        PartnerOrganization.OrganizationStatus status,
        RepresentativeResponse representative,
        Instant createdAt,
        Instant updatedAt
) {
    public static AdminPartnerOrganizationResponse from(
            PartnerOrganization organization,
            User representative
    ) {
        boolean hasPartnerRole = representative.getUserRoles().stream()
                .anyMatch(userRole -> userRole.getRole().getCode() == RoleCode.PARTNER);
        return new AdminPartnerOrganizationResponse(
                organization.getId(),
                organization.getName(),
                organization.getDescription(),
                organization.getCategoryCode(),
                organization.getLogoUrl(),
                organization.getContactEmail(),
                organization.getContactPhone(),
                organization.getAddress(),
                organization.getStatus(),
                new RepresentativeResponse(
                        representative.getId(),
                        representative.getUsername(),
                        representative.getFullName(),
                        representative.getStatus(),
                        hasPartnerRole
                ),
                organization.getCreatedAt(),
                organization.getUpdatedAt()
        );
    }

    public record RepresentativeResponse(
            Long userId,
            String username,
            String fullName,
            AccountStatus accountStatus,
            boolean hasPartnerRole
    ) {
    }
}
