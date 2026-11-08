package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.booth.entity.BoothHoldStatus;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.payment.config.VnPayProperties;
import com.swp391.bookstreet.payment.entity.BoothPayment;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.gateway.VnPayGateway;
import com.swp391.bookstreet.payment.gateway.VnPayGatewayException;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentAttemptTransactions {
    private final BoothPaymentRepository paymentRepository;
    private final BoothHoldRepository holdRepository;
    private final BoothRequestRepository requestRepository;
    private final EventRootLockService eventRootLockService;
    private final PartnerOrganizationGuard organizationGuard;
    private final VnPayProperties properties;
    private final VnPayGateway gateway;

    public PaymentAttemptTransactions(BoothPaymentRepository paymentRepository,
            BoothHoldRepository holdRepository, BoothRequestRepository requestRepository,
            EventRootLockService eventRootLockService,
            PartnerOrganizationGuard organizationGuard, VnPayProperties properties,
            VnPayGateway gateway) {
        this.paymentRepository = paymentRepository;
        this.holdRepository = holdRepository;
        this.requestRepository = requestRepository;
        this.eventRootLockService = eventRootLockService;
        this.organizationGuard = organizationGuard;
        this.properties = properties;
        this.gateway = gateway;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentPreparation prepare(Long requestId, Long userId, UUID key, String clientIp,
            Instant now) {
        BoothPayment replay = paymentRepository.findByIdempotencyKey(key).orElse(null);
        if (replay != null) {
            return replay(replay, requestId, userId);
        }

        Long eventId = requestRepository.findOwnedEventIdById(requestId, userId).orElse(null);
        if (eventId == null) {
            throw new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_REQUEST_NOT_FOUND",
                    "Booth request not found.");
        }
        Event event = eventRootLockService.lock(eventId).orElse(null);
        if (event == null) {
            throw new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_REQUEST_NOT_FOUND",
                    "Booth request not found.");
        }
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw conflict("EVENT_NOT_ACCEPTING_PAYMENTS",
                    "The Event no longer accepts new Payment attempts.");
        }

        var hold = holdRepository.findOwnedByRequestIdForUpdate(requestId, userId).orElse(null);
        if (hold == null) {
            throw conflict("BOOTH_REQUEST_NOT_SELECTED",
                    "The Booth request has not been selected for payment.");
        }

        // A concurrent same-key request can miss the first lookup while waiting for this Hold
        // lock. Re-check before the organization guard so an existing attempt stays replayable.
        replay = paymentRepository.findByIdempotencyKey(key).orElse(null);
        if (replay != null) {
            return replay(replay, requestId, userId);
        }
        organizationGuard.requireActive(hold.getBoothRequest().getApplication()
                .getPartnerOrganization());

        if (hold.getBoothRequest().getStatus() == BoothRequestStatus.COMPLETED
                || paymentRepository.existsByBoothHoldBoothHoldIdAndStatus(
                        hold.getBoothHoldId(), BoothPaymentStatus.SUCCESS)) {
            throw conflict("PAYMENT_ALREADY_COMPLETED", "Payment is already completed.");
        }
        if (hold.getBoothRequest().getStatus() != BoothRequestStatus.SELECTED) {
            throw conflict("BOOTH_REQUEST_NOT_SELECTED",
                    "The Booth request is not selected for payment.");
        }
        if (hold.getStatus() != BoothHoldStatus.ACTIVE) {
            if (hold.getStatus() == BoothHoldStatus.EXPIRED) {
                throw conflict("BOOTH_HOLD_EXPIRED", "The Booth Hold has expired.");
            }
            throw conflict("BOOTH_HOLD_NOT_ACTIVE", "The Booth Hold is not Active.");
        }
        if (!now.isBefore(hold.getExpiresAt())) {
            throw conflict("BOOTH_HOLD_EXPIRED", "The Booth Hold has expired.");
        }

        if (hold.getLockedRentalPrice().signum() == 0) {
            throw conflict("PAYMENT_ALREADY_COMPLETED", "A free Booth does not require payment.");
        }
        if (paymentRepository.existsByBoothHoldBoothHoldIdAndReconciliationRequiredTrue(
                hold.getBoothHoldId())) {
            throw conflict("PAYMENT_RESULT_UNKNOWN",
                    "An earlier Payment has contradictory provider evidence under review.");
        }
        Instant minimumExpiry = now.plus(5, ChronoUnit.MINUTES);
        if (hold.getExpiresAt().isBefore(minimumExpiry)) {
            throw conflict("BOOTH_HOLD_EXPIRING_SOON",
                    "Less than five minutes remains on the Booth Hold.");
        }
        BoothPayment pending = paymentRepository
                .findFirstByBoothHoldBoothHoldIdAndStatusOrderByCreatedAtDesc(
                        hold.getBoothHoldId(), BoothPaymentStatus.PENDING)
                .orElse(null);
        if (pending != null) {
            boolean usable = pending.getCheckoutUrl() != null
                    && pending.getCheckoutExpiresAt() != null
                    && now.isBefore(pending.getCheckoutExpiresAt());
            throw conflict(usable ? "PAYMENT_ATTEMPT_ALREADY_PENDING" : "PAYMENT_RESULT_UNKNOWN",
                    usable ? "Another usable Payment attempt is already Pending."
                            : "An earlier Payment result is still being reconciled.");
        }

        Instant gatewayExpiry = now.plus(properties.getCheckoutDurationSeconds(),
                ChronoUnit.SECONDS);
        Instant checkoutExpiry = gatewayExpiry.isBefore(hold.getExpiresAt())
                ? gatewayExpiry : hold.getExpiresAt();
        BoothPayment payment = paymentRepository.saveAndFlush(
                BoothPayment.createInitialRental(hold, key, now));
        try {
            // VNPay PAY checkout creation is local HMAC signing, not network I/O. Keeping this
            // deterministic step in the same transaction prevents a committed Pending Payment
            // without recoverable checkout metadata if the process stops between two commits.
            var checkout = gateway.buildCheckout(payment.getBoothPaymentId(), payment.getAmount(),
                    clientIp, payment.getCreatedAt(), checkoutExpiry);
            payment.attachCheckout(checkout.url(), checkout.expiresAt(), now);
            return new PaymentPreparation(paymentRepository.saveAndFlush(payment), true, false);
        } catch (VnPayGatewayException | IllegalStateException | ArithmeticException error) {
            payment.fail("GATEWAY_CONFIGURATION_ERROR", "Could not create checkout URL.",
                    null, null, null, now);
            paymentRepository.saveAndFlush(payment);
            return new PaymentPreparation(payment, true, true);
        }
    }

    private static PaymentPreparation replay(BoothPayment payment, Long requestId, Long userId) {
        boolean ownedRequest = payment.getBoothHold().getBoothRequest().getBoothRequestId()
                .equals(requestId);
        boolean ownedUser = payment.getBoothHold().getBoothRequest().getApplication()
                .getPartnerOrganization().getRepresentativeUserId().equals(userId);
        if (!ownedRequest || !ownedUser) {
            throw conflict("IDEMPOTENCY_KEY_REUSED",
                    "The idempotency key belongs to another payment request.");
        }
        return new PaymentPreparation(payment, false, false);
    }

    private static BoothApiException conflict(String code, String message) {
        return new BoothApiException(HttpStatus.CONFLICT, code, message);
    }
}
