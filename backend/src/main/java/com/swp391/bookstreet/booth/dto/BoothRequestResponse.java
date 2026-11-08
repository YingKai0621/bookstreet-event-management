package com.swp391.bookstreet.booth.dto;

import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import java.time.Instant;

public record BoothRequestResponse(
        Long boothRequestId,
        Long eventId,
        Long boothId,
        String boothCode,
        Long partnerOrganizationId,
        String partnerOrganizationName,
        String partnerOrganizationStatus,
        BoothRequestStatus status,
        String requestNote,
        String reviewNote,
        Instant submittedAt,
        Instant reviewedAt,
        Instant selectedAt,
        Instant completedAt,
        Instant paymentExpiredAt,
        Instant withdrawnAt,
        Instant cancelledAt,
        BoothHoldResponse hold
) {
    public static BoothRequestResponse from(BoothRequest request) {
        PartnerOrganization organization = request.getApplication().getPartnerOrganization();
        return new BoothRequestResponse(
                request.getBoothRequestId(),
                request.getApplication().getEventId(),
                request.getBooth().getBoothId(),
                request.getBooth().getLocation().getCode(),
                organization.getId(),
                organization.getName(),
                organization.getStatus().name(),
                request.getStatus(),
                request.getRequestNote(),
                request.getReviewNote(),
                request.getSubmittedAt(),
                request.getReviewedAt(),
                request.getSelectedAt(),
                request.getCompletedAt(),
                request.getPaymentExpiredAt(),
                request.getWithdrawnAt(),
                request.getCancelledAt(),
                BoothHoldResponse.from(request.getHold())
        );
    }

    public static BoothRequestResponse from(BoothRequest request, BoothHold hold) {
        PartnerOrganization organization = request.getApplication().getPartnerOrganization();
        return new BoothRequestResponse(
                request.getBoothRequestId(),
                request.getApplication().getEventId(),
                request.getBooth().getBoothId(),
                request.getBooth().getLocation().getCode(),
                organization.getId(),
                organization.getName(),
                organization.getStatus().name(),
                request.getStatus(),
                request.getRequestNote(),
                request.getReviewNote(),
                request.getSubmittedAt(),
                request.getReviewedAt(),
                request.getSelectedAt(),
                request.getCompletedAt(),
                request.getPaymentExpiredAt(),
                request.getWithdrawnAt(),
                request.getCancelledAt(),
                BoothHoldResponse.from(hold)
        );
    }
}
