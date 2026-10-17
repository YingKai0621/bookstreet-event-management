package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.activity.entity.ActivityRevision;
import com.swp391.bookstreet.activity.entity.ActivityRevisionSource;
import java.time.Instant;
import java.util.Map;

public record PartnerActivityRevisionResponse(
        Long activityRevisionId,
        Long activityId,
        Long sourceRequestId,
        ActivityRevisionSource revisionSource,
        String changeReason,
        Map<String, Object> oldSnapshot,
        Map<String, Object> newSnapshot,
        Instant changedAt
) {
    public static PartnerActivityRevisionResponse from(ActivityRevision revision) {
        return new PartnerActivityRevisionResponse(revision.getActivityRevisionId(),
                revision.getActivityId(), revision.getSourceRequestId(),
                revision.getRevisionSource(), revision.getChangeReason(),
                revision.getOldSnapshot(), revision.getNewSnapshot(), revision.getChangedAt());
    }
}
