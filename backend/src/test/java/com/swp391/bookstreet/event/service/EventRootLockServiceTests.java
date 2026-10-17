package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.activity.service.EventActivityCascadeService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventRootLockServiceTests {
    private static final Instant NOW = Instant.parse("2030-01-01T10:00:00Z");

    private final EventRepository repository = mock(EventRepository.class);
    private final EventActivityCascadeService activityCascadeService =
            mock(EventActivityCascadeService.class);
    private final EventRootLockService service = new EventRootLockService(
            repository, activityCascadeService, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void locksEventByIdAndKeepsPublishedBeforeStart() {
        Event event = event(EventStatus.PUBLISHED, NOW.plusSeconds(1), NOW.plusSeconds(2));
        when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(event));

        assertThat(service.lock(21L)).containsSame(event);
        assertThat(event.getStatus()).isEqualTo(EventStatus.PUBLISHED);
        verify(repository).findByIdForUpdate(21L);
    }

    @Test
    void advancesPublishedEventToOngoingAtStartBoundary() {
        Event event = event(EventStatus.PUBLISHED, NOW, NOW.plusSeconds(1));
        when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(event));

        service.lock(21L);

        assertThat(event.getStatus()).isEqualTo(EventStatus.ONGOING);
    }

    @Test
    void advanceReportsWhetherLifecycleChanged() {
        Event due = event(EventStatus.PUBLISHED, NOW, NOW.plusSeconds(1));
        when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(due));

        assertThat(service.advance(21L)).isTrue();

        Event notDue = event(EventStatus.PUBLISHED, NOW.plusSeconds(1), NOW.plusSeconds(2));
        when(repository.findByIdForUpdate(22L)).thenReturn(Optional.of(notDue));
        assertThat(service.advance(22L)).isFalse();
    }

    @Test
    void advancesOverduePublishedEventDirectlyToCompleted() {
        Event event = event(EventStatus.PUBLISHED, NOW.minusSeconds(2), NOW);
        when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(event));

        service.lock(21L);

        assertThat(event.getStatus()).isEqualTo(EventStatus.COMPLETED);
        verify(activityCascadeService).completeEvent(21L, NOW);
    }

    @Test
    void advancesOngoingEventToCompletedAtEndBoundary() {
        Event event = event(EventStatus.ONGOING, NOW.minusSeconds(1), NOW);
        when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(event));

        service.lock(21L);

        assertThat(event.getStatus()).isEqualTo(EventStatus.COMPLETED);
        verify(activityCascadeService).completeEvent(21L, NOW);
    }

    @Test
    void doesNotChangeNonTimedStatuses() {
        for (EventStatus status : new EventStatus[] {
                EventStatus.DRAFT, EventStatus.CANCELLED, EventStatus.COMPLETED }) {
            Event event = event(status, NOW.minusSeconds(2), NOW.minusSeconds(1));
            when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(event));

            service.lock(21L);

            assertThat(event.getStatus()).isEqualTo(status);
        }
    }

    @Test
    void ownedLockHidesAnotherOrganizersEventAfterLockingIt() {
        Event event = event(EventStatus.PUBLISHED, NOW.plusSeconds(1), NOW.plusSeconds(2));
        event.setOrganizerUserId(19L);
        when(repository.findByIdForUpdate(21L)).thenReturn(Optional.of(event));

        assertThat(service.lockOwned(21L, 20L)).isEmpty();
        verify(repository).findByIdForUpdate(21L);
    }

    @Test
    void publicMethodsRequireAnExistingTransaction() throws NoSuchMethodException {
        Transactional lock = EventRootLockService.class
                .getMethod("lock", Long.class)
                .getAnnotation(Transactional.class);
        Transactional lockOwned = EventRootLockService.class
                .getMethod("lockOwned", Long.class, Long.class)
                .getAnnotation(Transactional.class);
        Transactional advance = EventRootLockService.class
                .getMethod("advance", Long.class)
                .getAnnotation(Transactional.class);

        assertThat(lock.propagation()).isEqualTo(Propagation.MANDATORY);
        assertThat(lockOwned.propagation()).isEqualTo(Propagation.MANDATORY);
        assertThat(advance.propagation()).isEqualTo(Propagation.MANDATORY);
    }

    private static Event event(EventStatus status, Instant startAt, Instant endAt) {
        Event event = new Event();
        event.setStatus(status);
        event.setStartAt(startAt);
        event.setEndAt(endAt);
        return event;
    }
}
