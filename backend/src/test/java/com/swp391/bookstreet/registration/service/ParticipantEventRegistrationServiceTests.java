package com.swp391.bookstreet.registration.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.registration.entity.EventRegistration;
import com.swp391.bookstreet.registration.exception.RegistrationApiException;
import com.swp391.bookstreet.registration.repository.ActivityRegistrationRepository;
import com.swp391.bookstreet.registration.repository.EventRegistrationRepository;
import com.swp391.bookstreet.registration.security.RegistrationCurrentUser;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ParticipantEventRegistrationServiceTests {
    private static final Long USER_ID = 11L;
    private static final Long EVENT_ID = 21L;
    private static final Instant NOW = Instant.parse("2026-10-19T08:00:00Z");

    @Mock EventRegistrationRepository eventRegistrations;
    @Mock ActivityRegistrationRepository activityRegistrations;
    @Mock RegistrationCurrentUser currentUser;
    @Mock EventRootLockService eventRootLockService;
    @Mock com.swp391.bookstreet.activity.service.ActivityLifecycleService lifecycleService;
    ParticipantEventRegistrationService service;

    @BeforeEach
    void setup() {
        service = new ParticipantEventRegistrationService(eventRegistrations,
                activityRegistrations, currentUser, eventRootLockService, lifecycleService,
                Clock.fixed(NOW, ZoneOffset.UTC));
        when(currentUser.requireParticipantId()).thenReturn(USER_ID);
    }

    @Test
    void joinAtExactDeadlineCreatesOneActiveRegistration() {
        Event event = event(EventStatus.PUBLISHED, NOW);
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
        when(eventRegistrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.empty());
        when(eventRegistrations.saveAndFlush(any(EventRegistration.class)))
                .thenAnswer(invocation -> identified(invocation.getArgument(0)));
        when(activityRegistrations.countSeatActiveByEventRegistrationIds(List.of(31L)))
                .thenReturn(List.of());

        var response = service.join(EVENT_ID);

        assertThat(response.eventRegistrationId()).isEqualTo(31L);
        assertThat(response.status().name()).isEqualTo("ACTIVE");
        assertThat(response.registeredAt()).isEqualTo(NOW);
        assertThat(response.seatActiveActivityCount()).isZero();
    }

    @Test
    void firstJoinAfterDeadlineIsRejectedWithoutWriting() {
        Event event = event(EventStatus.PUBLISHED, NOW.minusNanos(1_000));
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
        when(eventRegistrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.join(EVENT_ID))
                .isInstanceOfSatisfying(RegistrationApiException.class, error -> {
                    assertThat(error.getStatus().value()).isEqualTo(409);
                    assertThat(error.getCode()).isEqualTo("EVENT_REGISTRATION_DEADLINE_PASSED");
                });
        verify(eventRegistrations, never()).saveAndFlush(any());
    }

    @Test
    void exactJoinRetryReturnsAchievedStateWithoutTimestampDrift() {
        Event event = event(EventStatus.COMPLETED, NOW.minusSeconds(10));
        EventRegistration registration = identified(EventRegistration.join(
                USER_ID, EVENT_ID, NOW.minusSeconds(100)));
        Instant firstActivation = registration.getActivatedAt();
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
        when(eventRegistrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.of(registration));
        when(activityRegistrations.countSeatActiveByEventRegistrationIds(List.of(31L)))
                .thenReturn(List.of());

        var response = service.join(EVENT_ID);

        assertThat(response.activatedAt()).isEqualTo(firstActivation);
        assertThat(response.updatedAt()).isEqualTo(firstActivation);
        verify(eventRegistrations, never()).flush();
    }

    @Test
    void rejoinReusesIdentityAndPreservesFirstRegistrationTime() {
        Event event = event(EventStatus.PUBLISHED, NOW.plusSeconds(1));
        Instant first = NOW.minusSeconds(100);
        EventRegistration registration = identified(EventRegistration.join(USER_ID, EVENT_ID, first));
        registration.leave(NOW.minusSeconds(50));
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
        when(eventRegistrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.of(registration));
        when(activityRegistrations.countSeatActiveByEventRegistrationIds(List.of(31L)))
                .thenReturn(List.of());

        var response = service.join(EVENT_ID);

        assertThat(response.eventRegistrationId()).isEqualTo(31L);
        assertThat(response.registeredAt()).isEqualTo(first);
        assertThat(response.activatedAt()).isEqualTo(NOW);
        assertThat(response.leftAt()).isNull();
        verify(eventRegistrations).flush();
    }

    @Test
    void leaveLocksHistoryAndRejectsSeatActiveActivity() {
        Event event = event(EventStatus.PUBLISHED, NOW.plusSeconds(1));
        EventRegistration registration = identified(EventRegistration.join(
                USER_ID, EVENT_ID, NOW.minusSeconds(10)));
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
        when(eventRegistrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.of(registration));
        when(activityRegistrations.findByEventRegistrationIdForUpdate(31L))
                .thenReturn(List.of());
        when(activityRegistrations.existsSeatActiveByEventRegistrationId(31L))
                .thenReturn(true);

        assertThatThrownBy(() -> service.leave(EVENT_ID))
                .isInstanceOfSatisfying(RegistrationApiException.class, error ->
                        assertThat(error.getCode())
                                .isEqualTo("EVENT_LEAVE_BLOCKED_BY_ACTIVE_ACTIVITY"));
        assertThat(registration.getStatus().name()).isEqualTo("ACTIVE");
        verify(activityRegistrations).findByEventRegistrationIdForUpdate(31L);
        verify(eventRegistrations, never()).flush();
    }

    @Test
    void exactLeaveRetryDoesNotChangeLeftTimestampOrRelockActivities() {
        Event event = event(EventStatus.COMPLETED, NOW.minusSeconds(1));
        EventRegistration registration = identified(EventRegistration.join(
                USER_ID, EVENT_ID, NOW.minusSeconds(20)));
        registration.leave(NOW.minusSeconds(10));
        Instant leftAt = registration.getLeftAt();
        when(eventRootLockService.lock(EVENT_ID)).thenReturn(Optional.of(event));
        when(eventRegistrations.findByUserIdAndEventIdForUpdate(USER_ID, EVENT_ID))
                .thenReturn(Optional.of(registration));
        when(activityRegistrations.countSeatActiveByEventRegistrationIds(List.of(31L)))
                .thenReturn(List.of());

        var response = service.leave(EVENT_ID);

        assertThat(response.leftAt()).isEqualTo(leftAt);
        assertThat(response.updatedAt()).isEqualTo(leftAt);
        verify(activityRegistrations, never()).findByEventRegistrationIdForUpdate(any());
        verify(eventRegistrations, never()).flush();
    }

    @Test
    void foreignDetailUsesOwnershipSafeNotFound() {
        when(eventRegistrations.findOwnedById(99L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(99L))
                .isInstanceOfSatisfying(RegistrationApiException.class, error -> {
                    assertThat(error.getStatus().value()).isEqualTo(404);
                    assertThat(error.getCode()).isEqualTo("EVENT_REGISTRATION_NOT_FOUND");
                });
    }

    private static Event event(EventStatus status, Instant deadline) {
        Event event = new Event();
        ReflectionTestUtils.setField(event, "eventId", EVENT_ID);
        event.setName("Sprint 6 Event");
        event.setStartAt(NOW.plusSeconds(3600));
        event.setEndAt(NOW.plusSeconds(7200));
        event.setParticipantRegistrationDeadlineAt(deadline);
        event.setStatus(status);
        return event;
    }

    private static EventRegistration identified(EventRegistration registration) {
        ReflectionTestUtils.setField(registration, "eventRegistrationId", 31L);
        return registration;
    }
}
