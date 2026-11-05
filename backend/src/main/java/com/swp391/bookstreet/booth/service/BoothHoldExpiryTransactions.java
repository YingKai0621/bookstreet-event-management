package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BoothHoldExpiryTransactions {
    private final EventRootLockService eventRootLockService;
    private final BoothHoldRepository holdRepository;
    private final BoothPaymentRepository paymentRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final BoothReselectionNotificationService reselectionNotifications;

    public BoothHoldExpiryTransactions(EventRootLockService eventRootLockService,
            BoothHoldRepository holdRepository, BoothPaymentRepository paymentRepository,
            BoothRequestRepository requestRepository,
            BoothAssignmentRepository assignmentRepository,
            BoothReselectionNotificationService reselectionNotifications) {
        this.eventRootLockService = eventRootLockService;
        this.holdRepository = holdRepository;
        this.paymentRepository = paymentRepository;
        this.requestRepository = requestRepository;
        this.assignmentRepository = assignmentRepository;
        this.reselectionNotifications = reselectionNotifications;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int expire(Long eventId, Instant now) {
        var event = eventRootLockService.lock(eventId).orElse(null);
        if (event == null) return 0;
        var holds = holdRepository.findByEventIdForUpdate(eventId);
        var payments = paymentRepository.findByEventIdForUpdate(eventId);
        Set<Long> blockedHolds = payments.stream()
                .filter(payment -> payment.isReconciliationRequired()
                        || payment.getStatus() == BoothPaymentStatus.PENDING
                        || payment.getStatus() == BoothPaymentStatus.SUCCESS)
                .map(payment -> payment.getBoothHold().getBoothHoldId())
                .collect(Collectors.toSet());
        requestRepository.findByEventIdAndStatusInForUpdate(
                eventId, Set.of(BoothRequestStatus.SELECTED));
        int expired = 0;
        for (var hold : holds) {
            if (!blockedHolds.contains(hold.getBoothHoldId())
                    && !assignmentRepository.existsByBoothHoldBoothHoldId(hold.getBoothHoldId())
                    && hold.expire(now)) {
                expired++;
                holdRepository.flush();
                reselectionNotifications.notifyIfEligible(
                        event, hold.getBoothRequest(), now);
            }
        }
        return expired;
    }
}
