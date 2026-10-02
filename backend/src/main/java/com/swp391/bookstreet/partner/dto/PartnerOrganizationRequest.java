package com.swp391.bookstreet.partner.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PartnerOrganizationRequest(
        @NotBlank
        @Size(max = 150)
        String name,

        String description,

        @NotBlank
        @Size(max = 50)
        String categoryCode,

        String logoUrl,

        @Size(max = 255)
        String contactEmail,

        @Size(max = 20)
        String contactPhone,

        String address
) {
}
