package com.swp391.bookstreet.event.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventLifecycleTransactionService {
    private final EventRootLockService eventRootLockService;

    public EventLifecycleTransactionService(EventRootLockService eventRootLockService) {
        this.eventRootLockService = eventRootLockService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean advance(Long eventId) {
        return eventRootLockService.advance(eventId);
    }
}
