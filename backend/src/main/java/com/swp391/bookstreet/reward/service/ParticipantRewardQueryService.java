package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.reward.dto.ParticipantBadgeResponse;
import com.swp391.bookstreet.reward.dto.PointTransactionResponse;
import com.swp391.bookstreet.reward.dto.RewardPageResponse;
import com.swp391.bookstreet.reward.dto.RewardSummaryResponse;
import com.swp391.bookstreet.reward.entity.Badge;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.repository.BoothVisitRepository;
import com.swp391.bookstreet.reward.repository.ParticipantRewardQueryRepository;
import com.swp391.bookstreet.reward.repository.PointTransactionRepository;
import com.swp391.bookstreet.reward.repository.UserBadgeRepository;
import com.swp391.bookstreet.reward.security.RewardCurrentUser;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ParticipantRewardQueryService {
    private final PointTransactionRepository pointRepository;
    private final BoothVisitRepository visitRepository;
    private final BadgeRepository badgeRepository;
    private final UserBadgeRepository userBadgeRepository;
    private final ParticipantRewardQueryRepository queryRepository;
    private final RewardCurrentUser currentUser;

    public ParticipantRewardQueryService(
            PointTransactionRepository pointRepository,
            BoothVisitRepository visitRepository,
            BadgeRepository badgeRepository,
            UserBadgeRepository userBadgeRepository,
            ParticipantRewardQueryRepository queryRepository,
            RewardCurrentUser currentUser) {
        this.pointRepository = pointRepository;
        this.visitRepository = visitRepository;
        this.badgeRepository = badgeRepository;
        this.userBadgeRepository = userBadgeRepository;
        this.queryRepository = queryRepository;
        this.currentUser = currentUser;
    }

    public RewardSummaryResponse summary() {
        Long userId = currentUser.requireParticipantId();
        long totalPoints = pointRepository.sumPointsByUserId(userId);
        Badge next = queryRepository.nextBadge(userId);

        return new RewardSummaryResponse(
                totalPoints,
                visitRepository.countByUserId(userId),
                userBadgeRepository.countByUserId(userId),
                badgeRepository.countByActiveTrue(),
                next == null ? null : inProgress(next, totalPoints));
    }

    public RewardPageResponse<PointTransactionResponse> pointTransactions(
            int page, int size, String sort, Long requestedEventId, Long requestedBoothId) {
        RewardPagination pagination = RewardPagination.points(page, size, sort);
        Long eventId = RewardPagination.positiveFilter(requestedEventId);
        Long boothId = RewardPagination.positiveFilter(requestedBoothId);
        Long userId = currentUser.requireParticipantId();
        return queryRepository.pointTransactions(
                userId, page, size, pagination.offset(), pagination.pointOrderBy(),
                eventId, boothId);
    }

    public RewardPageResponse<ParticipantBadgeResponse> badges(
            int page, int size, String requestedState, String sort) {
        RewardPagination pagination = RewardPagination.badges(page, size, sort);
        BadgeState state = parseState(requestedState);
        Long userId = currentUser.requireParticipantId();
        long totalPoints = pointRepository.sumPointsByUserId(userId);
        return queryRepository.badges(
                userId, totalPoints, page, size, pagination.offset(),
                state.name(), pagination.badgeOrderBy());
    }

    private static ParticipantBadgeResponse inProgress(Badge badge, long totalPoints) {
        long remaining = Math.max(0, (long) badge.getRequiredPoints() - totalPoints);
        int progress = ParticipantBadgeResponse.calculateProgressPercent(
                totalPoints, badge.getRequiredPoints());
        return new ParticipantBadgeResponse(
                badge.getBadgeId(), badge.getName(), badge.getDescription(), badge.getIconUrl(),
                badge.getRequiredPoints(), badge.isActive(), "IN_PROGRESS", false,
                null, remaining, progress);
    }

    private static BadgeState parseState(String requestedState) {
        try {
            return BadgeState.valueOf((requestedState == null ? "ALL" : requestedState)
                    .trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException error) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ENUM_VALUE",
                    "state must be ALL, EARNED or IN_PROGRESS.");
        }
    }

    private enum BadgeState {
        ALL,
        EARNED,
        IN_PROGRESS
    }
}
