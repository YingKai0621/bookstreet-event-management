package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.repository.EventRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class EventLifecycleService {
    private final EventRepository eventRepository;
    private final EventLifecycleTransactionService transactionService;
    private final Clock clock;

    public EventLifecycleService(EventRepository eventRepository,
            EventLifecycleTransactionService transactionService, Clock clock) {
        this.eventRepository = eventRepository;
        this.transactionService = transactionService;
        this.clock = clock;
    }

    public int advanceDueEvents() {
        Instant now = clock.instant();
        int advanced = 0;
        for (Long eventId : eventRepository.findDueLifecycleIds(now)) {
            if (transactionService.advance(eventId)) {
                advanced++;
            }
        }
        return advanced;
    }
}
