package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import com.swp391.bookstreet.partner.dto.PartnerApplicationResponse;
import com.swp391.bookstreet.partner.repository.PartnerEventApplicationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class PartnerApplicationQueryService {

    private final PartnerEventApplicationRepository applicationRepository;

    public PartnerApplicationQueryService(
            PartnerEventApplicationRepository applicationRepository
    ) {
        this.applicationRepository = applicationRepository;
    }

    public Page<PartnerApplicationResponse> findAllForRepresentative(
            Long representativeUserId,
            Pageable pageable
    ) {
        PartnerPagination.validateSort(pageable);

        return applicationRepository
                .findAllByPartnerOrganization_RepresentativeUserId(representativeUserId, pageable)
                .map(PartnerApplicationResponse::from);
    }

    public Optional<PartnerApplicationResponse> findOwnedApplication(
            Long applicationId,
            Long representativeUserId
    ) {
        return applicationRepository
                .findByIdAndPartnerOrganization_RepresentativeUserId(
                        applicationId,
                        representativeUserId
                )
                .map(PartnerApplicationResponse::from);
    }
}
