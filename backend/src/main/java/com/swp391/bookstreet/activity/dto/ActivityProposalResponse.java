package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityProposalStatus;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository.PartnerProposalView;
import com.swp391.bookstreet.booth.entity.LocationType;
import java.time.Instant;

public record ActivityProposalResponse(
        Long activityProposalId,
        Long eventId,
        String eventName,
        Long partnerOrganizationId,
        String partnerOrganizationName,
        String partnerOrganizationStatus,
        ActivityLocationResponse location,
        String title,
        String description,
        String activityType,
        Instant proposedStartAt,
        Instant proposedEndAt,
        Integer capacity,
        ActivityProposalStatus status,
        String reviewNote,
        Instant submittedAt,
        Instant updatedAt,
        Instant reviewedAt,
        Instant withdrawnAt,
        Instant cancelledAt,
        Long activityId
) {
    public static ActivityProposalResponse from(PartnerProposalView value) {
        return new ActivityProposalResponse(value.getActivityProposalId(), value.getEventId(),
                value.getEventName(), value.getPartnerOrganizationId(),
                value.getPartnerOrganizationName(), value.getPartnerOrganizationStatus(),
                new ActivityLocationResponse(value.getLocationId(), value.getLocationCode(),
                        value.getLocationName(), LocationType.valueOf(value.getLocationType()),
                        value.getLocationMaxCapacity(), value.getLocationActive()),
                value.getTitle(), value.getDescription(), value.getActivityType(),
                value.getProposedStartAt(), value.getProposedEndAt(), value.getCapacity(),
                ActivityProposalStatus.valueOf(value.getStatus()), value.getReviewNote(),
                value.getSubmittedAt(), value.getUpdatedAt(), value.getReviewedAt(),
                value.getWithdrawnAt(), value.getCancelledAt(), value.getActivityId());
    }
}
