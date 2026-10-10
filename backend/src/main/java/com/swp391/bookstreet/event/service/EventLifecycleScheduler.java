package com.swp391.bookstreet.event.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class EventLifecycleScheduler {
    private final EventLifecycleService lifecycleService;

    public EventLifecycleScheduler(EventLifecycleService lifecycleService) {
        this.lifecycleService = lifecycleService;
    }

    @Scheduled(
            initialDelayString = "${bookstreet.event.lifecycle-initial-delay-ms:60000}",
            fixedDelayString = "${bookstreet.event.lifecycle-delay-ms:60000}"
    )
    public void advanceDueEvents() {
        lifecycleService.advanceDueEvents();
    }
}
