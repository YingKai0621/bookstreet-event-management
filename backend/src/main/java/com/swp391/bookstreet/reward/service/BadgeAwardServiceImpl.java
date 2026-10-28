package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.reward.entity.Badge;
import com.swp391.bookstreet.reward.entity.UserBadge;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.repository.PointTransactionRepository;
import com.swp391.bookstreet.reward.repository.UserBadgeRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BadgeAwardServiceImpl implements BadgeAwardService {
    private static final String NOTIFICATION_TITLE = "Bạn vừa mở khóa huy hiệu";

    private final BadgeRepository badgeRepository;
    private final PointTransactionRepository pointTransactionRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final ParticipantNotificationWriter notificationWriter;

    public BadgeAwardServiceImpl(
            BadgeRepository badgeRepository,
            PointTransactionRepository pointTransactionRepository,
            UserBadgeRepository userBadgeRepository,
            ParticipantNotificationWriter notificationWriter) {
        this.badgeRepository = badgeRepository;
        this.pointTransactionRepository = pointTransactionRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.notificationWriter = notificationWriter;
    }

    @Override
    @Transactional
    public BadgeAwardResult awardEligibleBadges(Long userId, Instant earnedAt) {
        Long normalizedUserId = positive(userId, "userId");
        Instant normalizedEarnedAt = normalizeTime(earnedAt);

        List<Badge> lockedBadges = badgeRepository.findAllActiveForUpdate();
        long totalPoints = pointTransactionRepository.sumPointsByUserId(normalizedUserId);
        List<AwardedBadge> awards = new ArrayList<>();
        for (Badge badge : lockedBadges) {
            awardIfStillEligible(normalizedUserId, totalPoints, normalizedEarnedAt, badge)
                    .ifPresent(awards::add);
        }
        awards.sort(Comparator.comparing(AwardedBadge::badgeId));
        return new BadgeAwardResult(awards, totalPoints);
    }

    @Override
    @Transactional
    public BadgeAwardResult awardBadgeIfEligible(
            Long userId, Long badgeId, long totalPoints, Instant earnedAt) {
        Long normalizedUserId = positive(userId, "userId");
        Long normalizedBadgeId = positive(badgeId, "badgeId");
        requireNonNegative(totalPoints);
        Instant normalizedEarnedAt = normalizeTime(earnedAt);

        List<AwardedBadge> awards = badgeRepository.findByBadgeIdForUpdate(normalizedBadgeId)
                .flatMap(badge -> awardIfStillEligible(
                        normalizedUserId, totalPoints, normalizedEarnedAt, badge))
                .stream()
                .toList();
        return new BadgeAwardResult(awards, totalPoints);
    }

    private java.util.Optional<AwardedBadge> awardIfStillEligible(
            Long userId, long totalPoints, Instant earnedAt, Badge badge) {
        if (!badge.isActive() || badge.getRequiredPoints() > totalPoints) {
            return java.util.Optional.empty();
        }
        if (userBadgeRepository.existsByUserIdAndBadgeId(userId, badge.getBadgeId())) {
            return java.util.Optional.empty();
        }

        UserBadge userBadge = userBadgeRepository.saveAndFlush(
                UserBadge.award(userId, badge.getBadgeId(), earnedAt));
        notificationWriter.write(new ParticipantNotificationCommand(
                userId,
                ParticipantNotificationType.BADGE_UNLOCKED,
                null,
                null,
                null,
                badge.getBadgeId(),
                "badge-unlocked:user-badge:" + userBadge.getUserBadgeId(),
                NOTIFICATION_TITLE,
                "Bạn đã mở khóa huy hiệu " + badge.getName() + ".",
                earnedAt));
        return java.util.Optional.of(toAwardedBadge(userBadge, badge));
    }

    private AwardedBadge toAwardedBadge(UserBadge userBadge, Badge badge) {
        return new AwardedBadge(
                userBadge.getUserBadgeId(),
                badge.getBadgeId(),
                badge.getName(),
                badge.getDescription(),
                badge.getRequiredPoints(),
                badge.getIconUrl(),
                userBadge.getEarnedAt());
    }

    private Long positive(Long value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        if (value <= 0) throw new IllegalArgumentException(field + " must be positive");
        return value;
    }

    private void requireNonNegative(long totalPoints) {
        if (totalPoints < 0) {
            throw new IllegalArgumentException("totalPoints must not be negative");
        }
    }

    private Instant normalizeTime(Instant value) {
        return Objects.requireNonNull(value, "earnedAt must not be null")
                .truncatedTo(ChronoUnit.MICROS);
    }
}
