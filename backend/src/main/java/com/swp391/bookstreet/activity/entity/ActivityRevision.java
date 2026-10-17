package com.swp391.bookstreet.activity.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "activity_revisions")
public class ActivityRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "activity_revision_id")
    private Long activityRevisionId;

    @Column(name = "activity_id", nullable = false, updatable = false)
    private Long activityId;

    @Column(name = "actor_user_id", updatable = false)
    private Long actorUserId;

    @Column(name = "source_request_id", updatable = false)
    private Long sourceRequestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "revision_source", nullable = false, length = 30, updatable = false)
    private ActivityRevisionSource revisionSource;

    @Column(name = "change_reason", columnDefinition = "text", updatable = false)
    private String changeReason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_snapshot", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> oldSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_snapshot", nullable = false, columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> newSnapshot;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected ActivityRevision() {
    }

    public static ActivityRevision create(Long activityId, Long actorUserId,
            Long sourceRequestId, ActivityRevisionSource source, String changeReason,
            Map<String, Object> oldSnapshot, Map<String, Object> newSnapshot, Instant now) {
        ActivityRevision revision = new ActivityRevision();
        revision.activityId = activityId;
        revision.actorUserId = actorUserId;
        revision.sourceRequestId = sourceRequestId;
        revision.revisionSource = source;
        revision.changeReason = changeReason;
        revision.oldSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(oldSnapshot));
        revision.newSnapshot = Collections.unmodifiableMap(new LinkedHashMap<>(newSnapshot));
        revision.changedAt = now;
        return revision;
    }

    public Long getActivityRevisionId() { return activityRevisionId; }
    public Long getActivityId() { return activityId; }
    public Long getActorUserId() { return actorUserId; }
    public Long getSourceRequestId() { return sourceRequestId; }
    public ActivityRevisionSource getRevisionSource() { return revisionSource; }
    public String getChangeReason() { return changeReason; }
    public Map<String, Object> getOldSnapshot() { return oldSnapshot; }
    public Map<String, Object> getNewSnapshot() { return newSnapshot; }
    public Instant getChangedAt() { return changedAt; }
}
