package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class BoothHoldExpiryService {
    private final BoothHoldRepository holdRepository;
    private final BoothHoldExpiryTransactions transactions;
    private final Clock clock;

    public BoothHoldExpiryService(BoothHoldRepository holdRepository,
            BoothHoldExpiryTransactions transactions, Clock clock) {
        this.holdRepository = holdRepository;
        this.transactions = transactions;
        this.clock = clock;
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
}
