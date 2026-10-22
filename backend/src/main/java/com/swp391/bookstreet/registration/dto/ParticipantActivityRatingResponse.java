package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.rating.entity.ActivityRating;
import java.time.Instant;

public record ParticipantActivityRatingResponse(
        Long activityRatingId,
        Long activityId,
        Short score,
        String comment,
        String status,
        Instant createdAt,
        Instant updatedAt,
        Instant invalidatedAt) {
    public static ParticipantActivityRatingResponse from(ActivityRating rating, Long activityId) {
        if (rating == null) return null;
        return new ParticipantActivityRatingResponse(rating.getActivityRatingId(), activityId,
                rating.getScore(), rating.getComment(), rating.getStatus().name(),
                rating.getCreatedAt(), rating.getUpdatedAt(), rating.getInvalidatedAt());
    }
}
