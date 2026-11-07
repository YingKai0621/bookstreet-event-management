package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.notification.entity.Notification;
import com.swp391.bookstreet.notification.entity.ParticipantNotificationType;
import com.swp391.bookstreet.notification.service.ParticipantNotificationCommand;
import com.swp391.bookstreet.notification.service.ParticipantNotificationWriter;
import com.swp391.bookstreet.reward.entity.Badge;
import com.swp391.bookstreet.reward.entity.UserBadge;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.repository.PointTransactionRepository;
import com.swp391.bookstreet.reward.repository.UserBadgeRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BadgeAwardServiceImplTests {
    private static final Instant EARNED_AT = Instant.parse("2026-10-28T08:20:00.123456Z");

    private BadgeRepository badgeRepository;
    private PointTransactionRepository pointTransactionRepository;
    private UserBadgeRepository userBadgeRepository;
    private ParticipantNotificationWriter notificationWriter;
    private BadgeAwardServiceImpl service;

    @BeforeEach
    void setUp() {
        badgeRepository = mock(BadgeRepository.class);
        pointTransactionRepository = mock(PointTransactionRepository.class);
        userBadgeRepository = mock(UserBadgeRepository.class);
        notificationWriter = mock(ParticipantNotificationWriter.class);
        service = new BadgeAwardServiceImpl(
                badgeRepository, pointTransactionRepository,
                userBadgeRepository, notificationWriter);

        AtomicLong ids = new AtomicLong(100);
        when(userBadgeRepository.saveAndFlush(any(UserBadge.class))).thenAnswer(invocation -> {
            UserBadge saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "userBadgeId", ids.incrementAndGet());
            return saved;
        });
        when(notificationWriter.write(any(ParticipantNotificationCommand.class)))
                .thenReturn(mock(Notification.class));
    }

    @Test
    void awardsMissingEligibleBadgesAndCreatesStableNotifications() {
        Badge first = badge(11L, "Người khám phá", 10, true);
        Badge second = badge(19L, "Nhà sưu tầm", 20, true);
        when(badgeRepository.findAllActiveForUpdate()).thenReturn(List.of(first, second));
        when(pointTransactionRepository.sumPointsByUserId(7L)).thenReturn(20L);
        when(userBadgeRepository.existsByUserIdAndBadgeId(7L, 11L)).thenReturn(false);
        when(userBadgeRepository.existsByUserIdAndBadgeId(7L, 19L)).thenReturn(false);

        BadgeAwardResult result = service.awardEligibleBadges(7L, EARNED_AT);

        assertThat(result.awardedBadges())
                .extracting(AwardedBadge::badgeId)
                .containsExactly(11L, 19L);
        assertThat(result.totalPoints()).isEqualTo(20);
        var lockThenTotal = inOrder(badgeRepository, pointTransactionRepository);
        lockThenTotal.verify(badgeRepository).findAllActiveForUpdate();
        lockThenTotal.verify(pointTransactionRepository).sumPointsByUserId(7L);
        var ordered = inOrder(userBadgeRepository, notificationWriter);
        ordered.verify(userBadgeRepository).saveAndFlush(any(UserBadge.class));
        ordered.verify(notificationWriter).write(any(ParticipantNotificationCommand.class));
        ordered.verify(userBadgeRepository).saveAndFlush(any(UserBadge.class));
        ordered.verify(notificationWriter).write(any(ParticipantNotificationCommand.class));

        var commandCaptor = org.mockito.ArgumentCaptor.forClass(
                ParticipantNotificationCommand.class);
        verify(notificationWriter, org.mockito.Mockito.times(2)).write(commandCaptor.capture());
        assertThat(commandCaptor.getAllValues()).allSatisfy(command -> {
            assertThat(command.type()).isEqualTo(ParticipantNotificationType.BADGE_UNLOCKED);
            assertThat(command.eventId()).isNull();
            assertThat(command.activityId()).isNull();
            assertThat(command.certificateId()).isNull();
            assertThat(command.badgeId()).isPositive();
            assertThat(command.deduplicationKey())
                    .startsWith("badge-unlocked:user-badge:");
        });
    }

    @Test
    void existingAwardIsAnIdempotentAchievedResult() {
        Badge badge = badge(11L, "Người khám phá", 10, true);
        when(badgeRepository.findAllActiveForUpdate()).thenReturn(List.of(badge));
        when(pointTransactionRepository.sumPointsByUserId(7L)).thenReturn(10L);
        when(userBadgeRepository.existsByUserIdAndBadgeId(7L, 11L)).thenReturn(true);

        BadgeAwardResult result = service.awardEligibleBadges(7L, EARNED_AT);

        assertThat(result.awardedBadges()).isEmpty();
        verify(userBadgeRepository, never()).saveAndFlush(any());
        verify(notificationWriter, never()).write(any());
    }

    @Test
    void singleBadgeBoundaryRechecksActiveStateAndThresholdUnderLock() {
        Badge inactive = badge(11L, "Người khám phá", 10, false);
        when(badgeRepository.findByBadgeIdForUpdate(11L)).thenReturn(Optional.of(inactive));

        BadgeAwardResult result = service.awardBadgeIfEligible(7L, 11L, 50, EARNED_AT);

        assertThat(result.awardedBadges()).isEmpty();
        verify(userBadgeRepository, never()).saveAndFlush(any());
        verify(notificationWriter, never()).write(any());
    }

    @Test
    void notificationFailureEscapesSoTransactionCanRollBackUserBadge() {
        Badge badge = badge(11L, "Người khám phá", 10, true);
        when(badgeRepository.findByBadgeIdForUpdate(11L)).thenReturn(Optional.of(badge));
        when(notificationWriter.write(any())).thenThrow(new IllegalStateException("write failed"));

        assertThatThrownBy(() -> service.awardBadgeIfEligible(7L, 11L, 10, EARNED_AT))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("write failed");
    }

    private Badge badge(Long id, String name, int requiredPoints, boolean active) {
        Badge badge = Badge.create(
                name, null, requiredPoints, null, active, EARNED_AT.minusSeconds(60));
        ReflectionTestUtils.setField(badge, "badgeId", id);
        return badge;
    }
}
