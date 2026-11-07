package com.swp391.bookstreet.reward.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Objects;

@Entity
@Table(name = "badges")
public class Badge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "badge_id")
    private Long badgeId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "required_points", nullable = false)
    private Integer requiredPoints;

    @Column(name = "icon_url", columnDefinition = "text")
    private String iconUrl;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Badge() {
    }

    public static Badge create(String name, String description, int requiredPoints,
            String iconUrl, boolean active, Instant now) {
        Instant normalizedNow = normalizeTime(now, "now");
        Badge badge = new Badge();
        badge.apply(name, description, requiredPoints, iconUrl, active);
        badge.createdAt = normalizedNow;
        badge.updatedAt = normalizedNow;
        return badge;
    }

    public void update(String name, String description, int requiredPoints, String iconUrl,
            boolean active, Instant now) {
        Instant normalizedNow = normalizeTime(now, "now");
        if (normalizedNow.isBefore(createdAt)) {
            throw new IllegalArgumentException("updatedAt must not be before createdAt");
        }
        apply(name, description, requiredPoints, iconUrl, active);
        updatedAt = normalizedNow;
    }

    private void apply(String name, String description, int requiredPoints, String iconUrl,
            boolean active) {
        this.name = normalizeName(name);
        this.description = normalizeOptional(description, 1000, "description");
        if (requiredPoints <= 0) {
            throw new IllegalArgumentException("requiredPoints must be positive");
        }
        this.requiredPoints = requiredPoints;
        this.iconUrl = normalizeIconUrl(iconUrl);
        this.active = active;
    }

    private static String normalizeName(String value) {
        Objects.requireNonNull(value, "name must not be null");
        String normalized = value.trim().replaceAll("\\s+", " ");
        if (normalized.isEmpty()) throw new IllegalArgumentException("name must not be blank");
        if (normalized.length() > 100) {
            throw new IllegalArgumentException("name exceeds 100 characters");
        }
        return normalized;
    }

    private static String normalizeOptional(String value, int maxLength, String field) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return normalized;
    }

    private static String normalizeIconUrl(String value) {
        String normalized = normalizeOptional(value, 2048, "iconUrl");
        if (normalized == null) return null;
        try {
            URI uri = URI.create(normalized);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
            return normalized;
        } catch (RuntimeException error) {
            throw new IllegalArgumentException("iconUrl must be an absolute HTTP(S) URL", error);
        }
    }

    private static Instant normalizeTime(Instant value, String field) {
        return Objects.requireNonNull(value, field + " must not be null")
                .truncatedTo(ChronoUnit.MICROS);
    }

    public Long getBadgeId() { return badgeId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Integer getRequiredPoints() { return requiredPoints; }
    public String getIconUrl() { return iconUrl; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
