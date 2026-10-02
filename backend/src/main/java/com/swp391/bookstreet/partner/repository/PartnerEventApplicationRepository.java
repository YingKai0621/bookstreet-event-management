package com.swp391.bookstreet.partner.repository;

import com.swp391.bookstreet.partner.entity.PartnerEventApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

import java.util.Optional;

public interface PartnerEventApplicationRepository
        extends JpaRepository<PartnerEventApplication, Long> {

    Page<PartnerEventApplication> findAllByPartnerOrganization_RepresentativeUserId(
            Long representativeUserId,
            Pageable pageable
    );

    Optional<PartnerEventApplication> findByIdAndPartnerOrganization_RepresentativeUserId(
            Long applicationId,
            Long representativeUserId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PartnerEventApplication> findWithLockByIdAndPartnerOrganization_RepresentativeUserId(
            Long applicationId,
            Long representativeUserId
    );

    boolean existsByPartnerOrganization_IdAndEventId(
            Long partnerOrganizationId,
            Long eventId
    );
}
