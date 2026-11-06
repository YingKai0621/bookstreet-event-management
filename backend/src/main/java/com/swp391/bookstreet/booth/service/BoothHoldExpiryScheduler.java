package com.swp391.bookstreet.booth.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class BoothHoldExpiryScheduler {
    private final BoothHoldExpiryService expiryService;

    public BoothHoldExpiryScheduler(BoothHoldExpiryService expiryService) {
        this.expiryService = expiryService;
    }

    @Scheduled(
            initialDelayString = "${bookstreet.booth.hold-expiry-initial-delay-ms:60000}",
            fixedDelayString = "${bookstreet.booth.hold-expiry-delay-ms:60000}"
    )
    public void expireDueHolds() {
        expiryService.expireDueHolds();
    }

    @Scheduled(
            initialDelayString = "${bookstreet.booth.hold-expiry-initial-delay-ms:60000}",
            fixedDelayString = "${bookstreet.booth.hold-expiry-delay-ms:60000}"
    )
    public void remindExpiringHolds() {
        expiryService.remindExpiringHolds();
    }
}
