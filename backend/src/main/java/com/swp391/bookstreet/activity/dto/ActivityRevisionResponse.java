package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityRevision;
import com.swp391.bookstreet.activity.entity.ActivityRevisionSource;
import java.time.Instant;
import java.util.Map;

public record ActivityRevisionResponse(
        Long activityRevisionId,
        Long activityId,
        Long actorUserId,
        Long sourceRequestId,
        ActivityRevisionSource revisionSource,
        String changeReason,
        Map<String, Object> oldSnapshot,
        Map<String, Object> newSnapshot,
        Instant changedAt
) {
    public static ActivityRevisionResponse from(ActivityRevision revision) {
        return new ActivityRevisionResponse(revision.getActivityRevisionId(),
                revision.getActivityId(), revision.getActorUserId(),
                revision.getSourceRequestId(), revision.getRevisionSource(),
                revision.getChangeReason(), revision.getOldSnapshot(),
                revision.getNewSnapshot(), revision.getChangedAt());
    }
}
