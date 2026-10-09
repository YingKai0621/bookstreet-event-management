package com.swp391.bookstreet.booth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "booth_assignments")
public class BoothAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booth_assignment_id")
    private Long boothAssignmentId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booth_hold_id", nullable = false, updatable = false, unique = true)
    private BoothHold boothHold;

    @Column(name = "qr_token", nullable = false, updatable = false, unique = true)
    private UUID qrToken;

    @Column(name = "cover_image_url", columnDefinition = "text")
    private String coverImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BoothAssignmentStatus status;

    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;

    @Column(name = "released_at")
    private Instant releasedAt;

    @Column(name = "release_reason", length = 30)
    private String releaseReason;

    protected BoothAssignment() {
    }

    public static BoothAssignment create(BoothHold hold, Instant assignedAt) {
        BoothAssignment assignment = new BoothAssignment();
        assignment.boothHold = hold;
        assignment.qrToken = UUID.randomUUID();
        assignment.status = BoothAssignmentStatus.ACTIVE;
        assignment.assignedAt = assignedAt;
        return assignment;
    }

    public Long getBoothAssignmentId() { return boothAssignmentId; }
    public BoothHold getBoothHold() { return boothHold; }
    public UUID getQrToken() { return qrToken; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public BoothAssignmentStatus getStatus() { return status; }
    public Instant getAssignedAt() { return assignedAt; }
    public Instant getReleasedAt() { return releasedAt; }
    public String getReleaseReason() { return releaseReason; }
}
