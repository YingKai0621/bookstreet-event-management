package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BoothHoldExpiryService {
    private final BoothHoldRepository holdRepository;
    private final BoothPaymentRepository paymentRepository;
    private final Clock clock;

    public BoothHoldExpiryService(BoothHoldRepository holdRepository,
            BoothPaymentRepository paymentRepository, Clock clock) {
        this.holdRepository = holdRepository;
        this.paymentRepository = paymentRepository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int expireDueHolds() {
        return expireDueHolds(clock.instant());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int expireDueHolds(Instant now) {
        int expired = 0;
        for (BoothHold hold : holdRepository.findDueActiveForUpdate(now)) {
            if (paymentRepository.existsByBoothHoldBoothHoldIdAndStatus(
                    hold.getBoothHoldId(), BoothPaymentStatus.PENDING)) {
                continue;
            }
            if (hold.expire(now)) {
                expired++;
            }
        }
        return expired;
    }
}
