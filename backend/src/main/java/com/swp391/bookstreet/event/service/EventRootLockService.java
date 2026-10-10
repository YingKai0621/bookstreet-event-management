package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.entity.Event;
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
    private final Clock clock;

    public EventRootLockService(EventRepository eventRepository, Clock clock) {
        this.eventRepository = eventRepository;
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

    private Optional<Event> lockAndRefresh(Long eventId) {
        Instant now = Instant.now(clock);
        return eventRepository.findByIdForUpdate(eventId)
                .map(event -> {
                    event.advanceTimedLifecycle(now);
                    return event;
                });
    }
}
