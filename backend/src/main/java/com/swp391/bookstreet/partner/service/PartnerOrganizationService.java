package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.partner.dto.PartnerOrganizationRequest;
import com.swp391.bookstreet.partner.dto.PartnerOrganizationResponse;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class PartnerOrganizationService {

    private final PartnerOrganizationRepository organizationRepository;

    public PartnerOrganizationService(PartnerOrganizationRepository organizationRepository) {
        this.organizationRepository = organizationRepository;
    }

    public Optional<PartnerOrganizationResponse> findForRepresentative(Long representativeUserId) {
        return organizationRepository.findByRepresentativeUserId(representativeUserId)
                .map(PartnerOrganizationResponse::from);
    }

    @Transactional
    public SaveResult createOrUpdate(
            Long representativeUserId,
            PartnerOrganizationRequest request
    ) {
        Instant now = Instant.now();
        Optional<PartnerOrganization> existing = organizationRepository
                .findByRepresentativeUserId(representativeUserId);
        boolean created = existing.isEmpty();
        PartnerOrganization organization = existing.orElseGet(() ->
                PartnerOrganization.createForRepresentative(
                        representativeUserId,
                        request.name(),
                        request.description(),
                        request.categoryCode(),
                        request.logoUrl(),
                        request.contactEmail(),
                        request.contactPhone(),
                        request.address(),
                        now
                ));

        if (!created) {
            organization.updateProfile(
                    request.name(),
                    request.description(),
                    request.categoryCode(),
                    request.logoUrl(),
                    request.contactEmail(),
                    request.contactPhone(),
                    request.address(),
                    now
            );
        }

        PartnerOrganizationResponse response = PartnerOrganizationResponse.from(
                organizationRepository.save(organization)
        );
        return new SaveResult(created, response);
    }

    public record SaveResult(boolean created, PartnerOrganizationResponse organization) {
    }
}
