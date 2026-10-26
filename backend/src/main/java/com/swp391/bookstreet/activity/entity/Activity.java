package com.swp391.bookstreet.activity.entity;

import com.swp391.bookstreet.activity.service.ValidatedActivityFields;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "activities")
public class Activity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "activity_id")
    private Long activityId;

    @Column(name = "event_id", nullable = false, updatable = false)
    private Long eventId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "source_proposal_id", unique = true, updatable = false)
    private Long sourceProposalId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "activity_type", nullable = false, length = 50)
    private String activityType;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "registration_required", nullable = false)
    private boolean registrationRequired;

    @Column(name = "registration_deadline_at")
    private Instant registrationDeadlineAt;

    @Column(nullable = false)
    private Integer capacity;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @Column(name = "attendance_qr_token", unique = true)
    private UUID attendanceQrToken;

    @Column(name = "attendance_early_scan_minutes", nullable = false)
    private int attendanceEarlyScanMinutes = 15;

    @Column(name = "is_certificate_enabled", nullable = false)
    private boolean certificateEnabled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancellation_reason", columnDefinition = "text")
    private String cancellationReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_source", length = 30)
    private ActivityCancellationSource cancellationSource;

    protected Activity() {
    }

    public static Activity createDirect(Long eventId, Long locationId,
            ValidatedActivityFields fields, boolean registrationRequired,
            Instant registrationDeadlineAt, boolean certificateEnabled, Instant now) {
        Activity activity = new Activity();
        activity.eventId = eventId;
        activity.locationId = locationId;
        activity.sourceProposalId = null;
        activity.status = ActivityStatus.DRAFT;
        activity.createdAt = now;
        activity.apply(fields, registrationRequired, registrationDeadlineAt,
                certificateEnabled, now);
        return activity;
    }

    public static Activity createFromProposal(Long eventId, Long locationId,
            Long sourceProposalId, ValidatedActivityFields fields, Instant now) {
        Activity activity = createDirect(eventId, locationId, fields,
                false, null, false, now);
        activity.sourceProposalId = sourceProposalId;
        return activity;
    }

    public void apply(ValidatedActivityFields fields, boolean registrationRequired,
            Instant registrationDeadlineAt, boolean certificateEnabled, Instant now) {
        this.title = fields.title();
        this.description = fields.description();
        this.activityType = fields.activityType();
        this.startAt = fields.startAt();
        this.endAt = fields.endAt();
        this.capacity = fields.capacity();
        this.imageUrl = fields.imageUrl() == null ? null : fields.imageUrl().toString();
        this.registrationRequired = registrationRequired;
        this.registrationDeadlineAt = registrationDeadlineAt;
        this.certificateEnabled = certificateEnabled;
        this.updatedAt = now;
    }

    public void moveToLocation(Long newLocationId) {
        this.locationId = newLocationId;
    }

    public boolean publish(Instant now, UUID generatedToken) {
        if (status != ActivityStatus.DRAFT) return false;
        status = ActivityStatus.PUBLISHED;
        publishedAt = now;
        if (registrationRequired && attendanceQrToken == null) {
            attendanceQrToken = generatedToken;
        }
        updatedAt = now;
        return true;
    }

    public boolean cancel(String reason, ActivityCancellationSource source, Instant now) {
        if (status == ActivityStatus.CANCELLED) return false;
        status = ActivityStatus.CANCELLED;
        cancelledAt = now;
        cancellationReason = reason;
        cancellationSource = source;
        updatedAt = now;
        return true;
    }

    public boolean advanceTimedLifecycle(Instant now) {
        if (status == ActivityStatus.PUBLISHED) {
            if (!now.isBefore(endAt)) {
                status = ActivityStatus.COMPLETED;
                completedAt = now;
                updatedAt = now;
                return true;
            }
            if (!now.isBefore(startAt)) {
                status = ActivityStatus.ONGOING;
                updatedAt = now;
                return true;
            }
        } else if (status == ActivityStatus.ONGOING && !now.isBefore(endAt)) {
            status = ActivityStatus.COMPLETED;
            completedAt = now;
            updatedAt = now;
            return true;
        }
        return false;
    }

    public Long getActivityId() { return activityId; }
    public Long getEventId() { return eventId; }
    public Long getLocationId() { return locationId; }
    public Long getSourceProposalId() { return sourceProposalId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getActivityType() { return activityType; }
    public Instant getStartAt() { return startAt; }
    public Instant getEndAt() { return endAt; }
    public boolean isRegistrationRequired() { return registrationRequired; }
    public Instant getRegistrationDeadlineAt() { return registrationDeadlineAt; }
    public Integer getCapacity() { return capacity; }
    public String getImageUrl() { return imageUrl; }
    public UUID getAttendanceQrToken() { return attendanceQrToken; }
    public int getAttendanceEarlyScanMinutes() { return attendanceEarlyScanMinutes; }
    public void setAttendanceEarlyScanMinutes(int minutes) { this.attendanceEarlyScanMinutes = minutes; }
    public boolean isCertificateEnabled() { return certificateEnabled; }
    public ActivityStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public String getCancellationReason() { return cancellationReason; }
    public ActivityCancellationSource getCancellationSource() { return cancellationSource; }
}
