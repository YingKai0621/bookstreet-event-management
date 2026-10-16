package com.swp391.bookstreet.activity.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ActivityLifecycleScheduler {
    private final ActivityLifecycleService lifecycleService;

    public ActivityLifecycleScheduler(ActivityLifecycleService lifecycleService) {
        this.lifecycleService = lifecycleService;
    }

    @Scheduled(
            initialDelayString = "${bookstreet.activity.lifecycle-initial-delay-ms:60000}",
            fixedDelayString = "${bookstreet.activity.lifecycle-delay-ms:60000}"
    )
    public void advanceDueActivities() {
        lifecycleService.advanceDueActivities();
    }
}
