package com.swp391.bookstreet.partner.repository;

import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PartnerOrganizationRepository extends JpaRepository<PartnerOrganization, Long>,
        JpaSpecificationExecutor<PartnerOrganization> {

    Optional<PartnerOrganization> findByRepresentativeUserId(Long representativeUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select organization from PartnerOrganization organization where organization.id = :organizationId")
    Optional<PartnerOrganization> findByIdForUpdate(@Param("organizationId") Long organizationId);

    @Query("""
            select organization.representativeUserId
            from PartnerOrganization organization
            where organization.status = com.swp391.bookstreet.partner.entity.PartnerOrganization.OrganizationStatus.ACTIVE
              and organization.representativeUserId <> :excludedUserId
            order by organization.representativeUserId
            """)
    List<Long> findActiveRepresentativeIdsExcluding(@Param("excludedUserId") Long excludedUserId);
}
