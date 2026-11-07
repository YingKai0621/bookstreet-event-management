package com.swp391.bookstreet.reward.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

@Entity
@Table(name = "user_badges")
public class UserBadge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_badge_id")
    private Long userBadgeId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "badge_id", nullable = false, updatable = false)
    private Long badgeId;

    @Column(name = "earned_at", nullable = false, updatable = false)
    private Instant earnedAt;

    protected UserBadge() {
    }

    public static UserBadge award(Long userId, Long badgeId, Instant earnedAt) {
        UserBadge userBadge = new UserBadge();
        userBadge.userId = positive(userId, "userId");
        userBadge.badgeId = positive(badgeId, "badgeId");
        userBadge.earnedAt = Objects.requireNonNull(earnedAt, "earnedAt must not be null")
                .truncatedTo(ChronoUnit.MICROS);
        return userBadge;
    }

    private static Long positive(Long value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    public Long getUserBadgeId() { return userBadgeId; }
    public Long getUserId() { return userId; }
    public Long getBadgeId() { return badgeId; }
    public Instant getEarnedAt() { return earnedAt; }
}
