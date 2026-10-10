package com.swp391.bookstreet.event.dto;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.time.Instant;

public record EventResponse(
        Long eventId,
        Long organizerUserId,
        String name,
        String description,
        Instant startAt,
        Instant endAt,
        Instant partnerApplicationDeadlineAt,
        Instant boothRequestDeadlineAt,
        Instant activityProposalDeadlineAt,
        Instant participantRegistrationDeadlineAt,
        Instant partnerWithdrawalCutoffAt,
        Instant boothCancellationCutoffAt,
        Instant activityCancellationCutoffAt,
        Integer boothPaymentWindowMinutes,
        Integer maxBoothsPerPartner,
        Integer maxActivitiesPerPartner,
        String bannerUrl,
        EventStatus status,
        Instant cancelledAt,
        String cancellationReason,
        Instant createdAt,
        Instant updatedAt
) {
    public static EventResponse from(Event event) {
        return new EventResponse(event.getEventId(), event.getOrganizerUserId(),
                event.getName(),
                event.getDescription(),
                event.getStartAt(),
                event.getEndAt(),
                event.getPartnerApplicationDeadlineAt(),
                event.getBoothRequestDeadlineAt(),
                event.getActivityProposalDeadlineAt(),
                event.getParticipantRegistrationDeadlineAt(),
                event.getPartnerWithdrawalCutoffAt(),
                event.getBoothCancellationCutoffAt(),
                event.getActivityCancellationCutoffAt(),
                event.getBoothPaymentWindowMinutes(),
                event.getMaxBoothsPerPartner(),
                event.getMaxActivitiesPerPartner(),
                event.getBannerUrl(),
                event.getStatus(),
                event.getCancelledAt(),
                event.getCancellationReason(),
                event.getCreatedAt(), event.getUpdatedAt());
    }
}

