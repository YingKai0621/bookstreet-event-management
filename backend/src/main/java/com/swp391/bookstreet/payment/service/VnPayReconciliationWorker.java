package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.payment.config.VnPayProperties;
import com.swp391.bookstreet.payment.gateway.VnPayGateway;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class VnPayReconciliationWorker {
    private final BoothPaymentRepository paymentRepository;
    private final VnPayGateway gateway;
    private final PaymentSettlementService settlementService;
    private final VnPayProperties properties;
    private final Clock clock;

    public VnPayReconciliationWorker(BoothPaymentRepository paymentRepository,
            VnPayGateway gateway, PaymentSettlementService settlementService,
            VnPayProperties properties, Clock clock) {
        this.paymentRepository = paymentRepository;
        this.gateway = gateway;
        this.settlementService = settlementService;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(
            initialDelayString = "${VNPAY_RECONCILIATION_INITIAL_DELAY_MS:60000}",
            fixedDelayString = "${VNPAY_RECONCILIATION_FIXED_DELAY_MS:60000}"
    )
    public void reconcilePendingPayments() {
        Instant startedAt = clock.instant();
        Instant orphanCutoff = startedAt.minus(properties.getReconciliationDelaySeconds(),
                ChronoUnit.SECONDS);
        for (Long paymentId : paymentRepository.findCheckoutCreationOrphanIds(orphanCutoff)) {
            settlementService.failCheckoutCreationOrphan(paymentId, orphanCutoff,
                    clock.instant());
        }

        Instant eligibleExpiry = startedAt.minus(properties.getReconciliationDelaySeconds(),
                ChronoUnit.SECONDS);
        Instant eligibleLastQuery = startedAt.minus(properties.getQueryMinIntervalSeconds(),
                ChronoUnit.SECONDS);
        for (Long paymentId : paymentRepository.findReconciliationCandidateIds(
                eligibleExpiry, eligibleLastQuery)) {
            reconcileOne(paymentId);
        }
    }

    private void reconcileOne(Long paymentId) {
        Instant queriedAt = clock.instant();
        PaymentQueryClaim claim = settlementService.claimQuery(paymentId, queriedAt);
        if (claim == null) return;
        try {
            var result = gateway.query(claim.paymentId(), claim.amount(), "127.0.0.1",
                    claim.paymentCreatedAt(), claim.queriedAt());
            settlementService.acceptClaimedQuery(claim.paymentId(), result, claim.queriedAt());
        } catch (RuntimeException error) {
            settlementService.recordQueryFailure(claim.paymentId(),
                    "QUERYDR_TRANSPORT_ERROR", claim.queriedAt());
        }
    }
}
