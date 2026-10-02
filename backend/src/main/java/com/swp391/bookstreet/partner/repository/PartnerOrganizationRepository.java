package com.swp391.bookstreet.partner.repository;

import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PartnerOrganizationRepository extends JpaRepository<PartnerOrganization, Long> {

    Optional<PartnerOrganization> findByRepresentativeUserId(Long representativeUserId);
}
