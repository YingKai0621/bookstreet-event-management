package com.swp391.bookstreet.reward.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.BoothAssignmentStatus;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.reward.config.RewardProperties;
import com.swp391.bookstreet.reward.dto.EventRegistrationAction;
import com.swp391.bookstreet.reward.entity.BoothVisit;
import com.swp391.bookstreet.reward.entity.PointTransaction;
import com.swp391.bookstreet.reward.repository.BoothVisitRepository;
import com.swp391.bookstreet.reward.repository.PointTransactionRepository;
import com.swp391.bookstreet.reward.security.RewardCurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ParticipantBoothVisitServiceTests {
    private static final Long USER_ID = 11L;
    private static final Long EVENT_ID = 21L;
    private static final Long ASSIGNMENT_ID = 31L;
    private static final String TOKEN = "0ad9ec56-5566-4b4d-91c0-4ea995896d2b";
    private static final Instant NOW = Instant.parse("2026-10-28T08:20:00Z");

    @Mock BoothAssignmentRepository assignments;
    @Mock EventRegistrationRepository registrations;
    @Mock BoothVisitRepository visits;
    @Mock PointTransactionRepository points;
    @Mock EventRootLockService eventRootLockService;
    @Mock BadgeAwardService badgeAwardService;
    @Mock RewardCurrentUser currentUser;
    private ParticipantBoothVisitService service;

    @BeforeEach
    void setUp() {
        RewardProperties properties = new RewardProperties();
        properties.setBoothVisitPoints(10);
        service = new ParticipantBoothVisitService(assignments, registrations, visits, points,
                eventRootLockService, badgeAwardService, currentUser, properties,
                Clock.fixed(NOW, ZoneOffset.UTC));
        when(currentUser.requireParticipantId()).thenReturn(USER_ID);
    }

    @Test
    void firstScanCreatesRegistrationVisitPointAndReturnsLedgerTotal() {
        ScanFixture fixture = validFixture(EventStatus.ONGOING, BoothAssignmentStatus.ACTIVE,
                NOW.minusSeconds(10), NOW.plusSeconds(10));
        when(registrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.empty());
        when(registrations.saveAndFlush(any(EventRegistration.class))).thenAnswer(invocation -> {
            EventRegistration value = invocation.getArgument(0);
            ReflectionTestUtils.setField(value, "eventRegistrationId", 41L);
            return value;
        });
        when(visits.findByIdentityForUpdate(41L, ASSIGNMENT_ID)).thenReturn(Optional.empty());
        when(visits.saveAndFlush(any(BoothVisit.class))).thenAnswer(invocation -> {
            BoothVisit value = invocation.getArgument(0);
            ReflectionTestUtils.setField(value, "boothVisitId", 51L);
            return value;
        });
        when(points.saveAndFlush(any(PointTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(badgeAwardService.awardEligibleBadges(USER_ID, NOW))
                .thenReturn(new BadgeAwardResult(List.of(), 30L));

        var result = service.scan(TOKEN);

        assertThat(result.eventRegistrationAction()).isEqualTo(EventRegistrationAction.CREATED);
        assertThat(result.visitPoints()).isEqualTo(10);
        assertThat(result.newlyAwardedPoints()).isEqualTo(10);
        assertThat(result.totalPoints()).isEqualTo(30);
        assertThat(result.alreadyVisited()).isFalse();
        assertThat(result.boothVisit().boothVisitId()).isEqualTo(51L);
        assertThat(result.boothVisit().event().eventId()).isEqualTo(EVENT_ID);
        assertThat(result.boothVisit().booth().code()).isEqualTo("A01");
        verify(points).saveAndFlush(any(PointTransaction.class));
        assertThat(fixture.assignment().getStatus()).isEqualTo(BoothAssignmentStatus.ACTIVE);
    }

    @Test
    void validDuplicateReusesVisitAndNeverAwardsAgain() {
        validFixture(EventStatus.ONGOING, BoothAssignmentStatus.ACTIVE,
                NOW.minusSeconds(10), NOW.plusSeconds(10));
        EventRegistration registration = identifiedRegistration(NOW.minusSeconds(50));
        BoothVisit visit = BoothVisit.record(41L, ASSIGNMENT_ID, NOW.minusSeconds(20));
        ReflectionTestUtils.setField(visit, "boothVisitId", 51L);
        PointTransaction point = PointTransaction.award(51L, 10, NOW.minusSeconds(20));
        when(registrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.of(registration));
        when(visits.findByIdentityForUpdate(41L, ASSIGNMENT_ID))
                .thenReturn(Optional.of(visit));
        when(points.findByBoothVisitIdForUpdate(51L)).thenReturn(Optional.of(point));
        when(points.sumPointsByUserId(USER_ID)).thenReturn(40L);

        var result = service.scan(TOKEN);

        assertThat(result.eventRegistrationAction()).isEqualTo(EventRegistrationAction.REUSED);
        assertThat(result.alreadyVisited()).isTrue();
        assertThat(result.visitPoints()).isEqualTo(10);
        assertThat(result.newlyAwardedPoints()).isZero();
        assertThat(result.totalPoints()).isEqualTo(40);
        verify(visits, never()).saveAndFlush(any());
        verify(points, never()).saveAndFlush(any());
        verify(badgeAwardService, never()).awardEligibleBadges(any(), any());
    }

    @Test
    void leftRegistrationIsReactivatedEvenForAValidDuplicate() {
        validFixture(EventStatus.ONGOING, BoothAssignmentStatus.ACTIVE,
                NOW.minusSeconds(10), NOW.plusSeconds(10));
        EventRegistration registration = identifiedRegistration(NOW.minusSeconds(50));
        registration.leave(NOW.minusSeconds(30));
        BoothVisit visit = BoothVisit.record(41L, ASSIGNMENT_ID, NOW.minusSeconds(20));
        ReflectionTestUtils.setField(visit, "boothVisitId", 51L);
        when(registrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.of(registration));
        when(visits.findByIdentityForUpdate(41L, ASSIGNMENT_ID))
                .thenReturn(Optional.of(visit));
        when(points.findByBoothVisitIdForUpdate(51L))
                .thenReturn(Optional.of(PointTransaction.award(51L, 10, NOW.minusSeconds(20))));
        when(points.sumPointsByUserId(USER_ID)).thenReturn(10L);

        var result = service.scan(TOKEN);

        assertThat(result.eventRegistrationAction())
                .isEqualTo(EventRegistrationAction.REACTIVATED);
        assertThat(registration.getActivatedAt()).isEqualTo(NOW);
        verify(registrations).flush();
    }

    @Test
    void beforeStartAndAtEndUseExactWindowErrors() {
        validFixture(EventStatus.PUBLISHED, BoothAssignmentStatus.ACTIVE,
                NOW.plusNanos(1_000), NOW.plusSeconds(10));

        assertCode(() -> service.scan(TOKEN), "BOOTH_VISIT_WINDOW_NOT_OPEN");

        org.mockito.Mockito.reset(assignments, eventRootLockService);
        validFixture(EventStatus.COMPLETED, BoothAssignmentStatus.ACTIVE,
                NOW.minusSeconds(10), NOW);
        assertCode(() -> service.scan(TOKEN), "BOOTH_VISIT_WINDOW_CLOSED");
        verify(registrations, never()).saveAndFlush(any());
    }

    @Test
    void inactiveAssignmentRejectsBeforeRegistrationMutation() {
        validFixture(EventStatus.ONGOING, BoothAssignmentStatus.RELEASED,
                NOW.minusSeconds(10), NOW.plusSeconds(10));

        assertCode(() -> service.scan(TOKEN), "BOOTH_ASSIGNMENT_INELIGIBLE");

        verify(registrations, never()).saveAndFlush(any());
        verify(visits, never()).saveAndFlush(any());
    }

    @Test
    void malformedUnknownAndTooLongTokensShareSafeNotFoundOutcome() {
        when(assignments.resolveScanTarget("not-a-uuid")).thenReturn(Optional.empty());
        assertCode(() -> service.scan("not-a-uuid"), "BOOTH_QR_NOT_FOUND");
        assertCode(() -> service.scan("x".repeat(201)), "BOOTH_QR_NOT_FOUND");

        verify(assignments).resolveScanTarget("not-a-uuid");
        verify(assignments, never()).resolveScanTarget("x".repeat(201));
        verify(eventRootLockService, never()).lock(any());
    }

    @Test
    void crossEventRelationshipMismatchUsesGenericConflictAndWritesNothing() {
        ScanFixture fixture = validFixture(EventStatus.ONGOING, BoothAssignmentStatus.ACTIVE,
                NOW.minusSeconds(10), NOW.plusSeconds(10));
        when(fixture.config().getEventId()).thenReturn(999L);

        assertCode(() -> service.scan(TOKEN), "BOOTH_VISIT_RELATIONSHIP_INVALID");

        verify(registrations, never()).saveAndFlush(any());
        verify(visits, never()).saveAndFlush(any());
    }

    private ScanFixture validFixture(EventStatus eventStatus,
            BoothAssignmentStatus assignmentStatus, Instant startAt, Instant endAt) {
        BoothAssignmentRepository.ScanTarget target = mock(
                BoothAssignmentRepository.ScanTarget.class);
        when(target.getEventId()).thenReturn(EVENT_ID);
        when(target.getBoothAssignmentId()).thenReturn(ASSIGNMENT_ID);
        when(assignments.resolveScanTarget(TOKEN)).thenReturn(Optional.of(target));

        Event event = new Event();
        ReflectionTestUtils.setField(event, "eventId", EVENT_ID);
        event.setName("Ngày hội sách");
        event.setStartAt(startAt);
        event.setEndAt(endAt);
        event.setStatus(eventStatus);
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));

        BoothAssignment assignment = mock(BoothAssignment.class);
        BoothHold hold = mock(BoothHold.class);
        EventBoothConfig config = mock(EventBoothConfig.class);
        Booth booth = mock(Booth.class);
        Location location = mock(Location.class);
        when(assignments.findByIdForUpdate(ASSIGNMENT_ID)).thenReturn(Optional.of(assignment));
        when(assignment.getBoothAssignmentId()).thenReturn(ASSIGNMENT_ID);
        lenient().when(assignment.getQrToken()).thenReturn(UUID.fromString(TOKEN));
        lenient().when(assignment.getStatus()).thenReturn(assignmentStatus);
        when(assignment.getBoothHold()).thenReturn(hold);
        when(hold.getEventBoothConfig()).thenReturn(config);
        when(config.getEventId()).thenReturn(EVENT_ID);
        when(config.getBooth()).thenReturn(booth);
        lenient().when(booth.getBoothId()).thenReturn(22L);
        when(booth.getLocation()).thenReturn(location);
        lenient().when(location.getLocationId()).thenReturn(22L);
        lenient().when(location.getCode()).thenReturn("A01");
        lenient().when(location.getName()).thenReturn("Gian hàng Trẻ");
        return new ScanFixture(assignment, config);
    }

    private EventRegistration identifiedRegistration(Instant joinedAt) {
        EventRegistration value = EventRegistration.join(USER_ID, EVENT_ID, joinedAt);
        ReflectionTestUtils.setField(value, "eventRegistrationId", 41L);
        return value;
    }

    private static void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable call,
            String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(code));
    }

    private record ScanFixture(BoothAssignment assignment, EventBoothConfig config) {
    }
}
