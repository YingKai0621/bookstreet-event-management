package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class BoothHoldExpiryService {
    private final BoothHoldRepository holdRepository;
    private final BoothHoldExpiryTransactions transactions;
    private final Clock clock;
    private final int reminderWindowMinutes;

    public BoothHoldExpiryService(BoothHoldRepository holdRepository,
            BoothHoldExpiryTransactions transactions, Clock clock,
            @Value("${bookstreet.booth.hold-reminder-window-minutes:120}") int reminderWindowMinutes) {
        this.holdRepository = holdRepository;
        this.transactions = transactions;
        this.clock = clock;
        this.reminderWindowMinutes = reminderWindowMinutes;
    }

    public int expireDueHolds() {
        return expireDueHolds(clock.instant());
    }

    public int expireDueHolds(Instant now) {
        int expired = 0;
        for (Long eventId : holdRepository.findDueEventIds(now)) {
            expired += transactions.expire(eventId, now);
        }
        return expired;
    }

    public int remindExpiringHolds() {
        return remindExpiringHolds(clock.instant());
    }

    public int remindExpiringHolds(Instant now) {
        Duration window = Duration.ofMinutes(reminderWindowMinutes);
        int reminded = 0;
        for (Long eventId : holdRepository.findEventIdsWithHoldsToRemind(
                now, now.plus(window), reminderWindowMinutes)) {
            reminded += transactions.remindExpiring(eventId, now, window);
        }
        return reminded;
    }
}
