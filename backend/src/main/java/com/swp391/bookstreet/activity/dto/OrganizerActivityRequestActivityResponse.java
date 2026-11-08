package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository.OrganizerRequestContextView;
import com.swp391.bookstreet.booth.entity.LocationType;
import java.time.Instant;

public record OrganizerActivityRequestActivityResponse(
        Long activityId,
        Long eventId,
        String eventName,
        Long partnerOrganizationId,
        String partnerOrganizationName,
        String partnerOrganizationStatus,
        ActivityLocationResponse location,
        String title,
        String description,
        String activityType,
        Instant startAt,
        Instant endAt,
        Integer capacity,
        String imageUrl,
        ActivityStatus status
) {
    public static OrganizerActivityRequestActivityResponse from(
            OrganizerRequestContextView value) {
        return new OrganizerActivityRequestActivityResponse(value.getActivityId(),
                value.getEventId(), value.getEventName(), value.getPartnerOrganizationId(),
                value.getPartnerOrganizationName(), value.getPartnerOrganizationStatus(),
                new ActivityLocationResponse(value.getLocationId(), value.getLocationCode(),
                        value.getLocationName(), LocationType.valueOf(value.getLocationType()),
                        value.getLocationMaxCapacity(), value.getLocationActive()),
                value.getActivityTitle(), value.getActivityDescription(),
                value.getActivityType(), value.getStartAt(), value.getEndAt(),
                value.getActivityCapacity(), value.getActivityImageUrl(),
                ActivityStatus.valueOf(value.getActivityStatus()));
    }
}
