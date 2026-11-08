package com.swp391.bookstreet.partner.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The single check behind BR-117. Call it in every operation listed in section 8 of the Sprint 11 API
 * contract, after loading the organization and before creating any row. Settlement, Hold expiry and
 * lifecycle closures must not call it, because locking an organization never stops existing work.
 */
@Service
public class PartnerOrganizationGuard {

    public void requireActive(PartnerOrganization organization) {
        if (organization.getStatus() != PartnerOrganization.OrganizationStatus.ACTIVE) {
            throw new ApiException(HttpStatus.CONFLICT, "PARTNER_ORGANIZATION_INACTIVE",
                    "The Partner organization is locked.");
        }
    }
}
