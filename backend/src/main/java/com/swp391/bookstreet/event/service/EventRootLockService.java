package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.activity.service.EventActivityCascadeService;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventRootLockService {
    private final EventRepository eventRepository;
    private final EventActivityCascadeService activityCascadeService;
    private final Clock clock;

    public EventRootLockService(EventRepository eventRepository,
            EventActivityCascadeService activityCascadeService, Clock clock) {
        this.eventRepository = eventRepository;
        this.activityCascadeService = activityCascadeService;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<Event> lock(Long eventId) {
        return lockAndRefresh(eventId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<Event> lockOwned(Long eventId, Long organizerUserId) {
        return lockAndRefresh(eventId)
                .filter(event -> event.getOrganizerUserId().equals(organizerUserId));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean advance(Long eventId) {
        return lockAndRefreshResult(eventId).advanced();
    }

    private Optional<Event> lockAndRefresh(Long eventId) {
        return lockAndRefreshResult(eventId).event();
    }

    private LockResult lockAndRefreshResult(Long eventId) {
        Instant now = Instant.now(clock);
        Optional<Event> event = eventRepository.findByIdForUpdate(eventId);
        boolean advanced = event.map(value -> value.advanceTimedLifecycle(now)).orElse(false);
        if (advanced && event.orElseThrow().getStatus() == EventStatus.COMPLETED) {
            activityCascadeService.completeEvent(eventId, now);
        }
        return new LockResult(event, advanced);
    }

    private record LockResult(Optional<Event> event, boolean advanced) {}
}
