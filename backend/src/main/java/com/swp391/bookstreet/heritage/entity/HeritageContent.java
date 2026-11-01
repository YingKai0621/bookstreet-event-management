package com.swp391.bookstreet.heritage.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "heritage_contents")
public class HeritageContent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "heritage_content_id")
    private Long heritageContentId;

    @Column(name = "public_code", nullable = false, length = 100, updatable = false)
    private String publicCode;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "summary", columnDefinition = "text")
    private String summary;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    @Column(name = "location_text", length = 255)
    private String locationText;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private HeritageContentStatus status;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected HeritageContent() {
    }

    public static HeritageContent createDraft(
            String publicCode,
            String title,
            String summary,
            String content,
            String imageUrl,
            String locationText,
            Instant operationTime
    ) {
        HeritageContent heritage = new HeritageContent();
        heritage.publicCode = Objects.requireNonNull(publicCode, "publicCode must not be null");
        heritage.title = Objects.requireNonNull(title, "title must not be null");
        heritage.summary = summary;
        heritage.content = Objects.requireNonNull(content, "content must not be null");
        heritage.imageUrl = imageUrl;
        heritage.locationText = locationText;
        heritage.status = HeritageContentStatus.DRAFT;
        heritage.createdAt = Objects.requireNonNull(operationTime, "operationTime must not be null");
        heritage.updatedAt = operationTime;
        return heritage;
    }

    public void updateContent(
            String title,
            String summary,
            String content,
            String imageUrl,
            String locationText,
            Instant operationTime
    ) {
        Objects.requireNonNull(title, "title must not be null");
        Objects.requireNonNull(content, "content must not be null");
        Instant acceptedTime = requireLaterOperationTime(operationTime);
        this.title = title;
        this.summary = summary;
        this.content = content;
        this.imageUrl = imageUrl;
        this.locationText = locationText;
        this.updatedAt = acceptedTime;
    }

    public void publish(Instant operationTime) {
        requireStatus(HeritageContentStatus.DRAFT);
        Instant acceptedTime = requireLaterOperationTime(operationTime);
        this.status = HeritageContentStatus.PUBLISHED;
        this.publishedAt = acceptedTime;
        this.updatedAt = acceptedTime;
    }

    public void archive(Instant operationTime) {
        requireStatus(HeritageContentStatus.PUBLISHED);
        this.status = HeritageContentStatus.ARCHIVED;
        this.updatedAt = requireLaterOperationTime(operationTime);
    }

    public void republish(Instant operationTime) {
        requireStatus(HeritageContentStatus.ARCHIVED);
        this.status = HeritageContentStatus.PUBLISHED;
        this.updatedAt = requireLaterOperationTime(operationTime);
    }

    private Instant requireLaterOperationTime(Instant operationTime) {
        Objects.requireNonNull(operationTime, "operationTime must not be null");
        if (!operationTime.isAfter(updatedAt)) {
            throw new IllegalArgumentException("operationTime must be later than updatedAt");
        }
        return operationTime;
    }

    private void requireStatus(HeritageContentStatus requiredStatus) {
        if (status != requiredStatus) {
            throw new IllegalStateException("unsupported heritage state transition");
        }
    }

    public Long getHeritageContentId() {
        return heritageContentId;
    }

    public String getPublicCode() {
        return publicCode;
    }

    public String getTitle() {
        return title;
    }

    public String getSummary() {
        return summary;
    }

    public String getContent() {
        return content;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public String getLocationText() {
        return locationText;
    }

    public HeritageContentStatus getStatus() {
        return status;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
