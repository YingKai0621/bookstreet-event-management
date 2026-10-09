package com.swp391.bookstreet.payment.dto;

import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BoothAssignmentResponse(
        Long boothAssignmentId,
        Long boothHoldId,
        Long boothRequestId,
        Long eventId,
        Long boothId,
        String boothCode,
        Long partnerOrganizationId,
        String partnerOrganizationName,
        BigDecimal lockedRentalPrice,
        UUID qrToken,
        String coverImageUrl,
        BoothAssignmentStatus status,
        Instant assignedAt,
        Instant releasedAt,
        String releaseReason
) {
    public static BoothAssignmentResponse from(BoothAssignment assignment) {
        var hold = assignment.getBoothHold();
        var request = hold.getBoothRequest();
        var organization = request.getApplication().getPartnerOrganization();
        return new BoothAssignmentResponse(assignment.getBoothAssignmentId(),
                hold.getBoothHoldId(), request.getBoothRequestId(),
                request.getApplication().getEventId(), request.getBooth().getBoothId(),
                request.getBooth().getLocation().getCode(), organization.getId(),
                organization.getName(), hold.getLockedRentalPrice(), assignment.getQrToken(),
                assignment.getCoverImageUrl(), assignment.getStatus(), assignment.getAssignedAt(),
                assignment.getReleasedAt(), assignment.getReleaseReason());
    }
}
