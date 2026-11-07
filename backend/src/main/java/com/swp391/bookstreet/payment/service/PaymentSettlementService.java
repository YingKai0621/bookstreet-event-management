package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.booth.entity.BoothAssignment;
import com.swp391.bookstreet.booth.entity.BoothHold;
import com.swp391.bookstreet.booth.entity.BoothHoldStatus;
import com.swp391.bookstreet.booth.entity.BoothRequest;
import com.swp391.bookstreet.booth.entity.BoothRequestStatus;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothHoldRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.service.BoothReselectionNotificationService;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.service.EventRootLockService;
import com.swp391.bookstreet.notification.service.OrganizerWorkItemNotificationService;
import com.swp391.bookstreet.payment.config.VnPayProperties;
import com.swp391.bookstreet.payment.dto.VnPayAcknowledgement;
import com.swp391.bookstreet.payment.entity.BoothPayment;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.gateway.VnPayGatewayAdapter;
import com.swp391.bookstreet.payment.gateway.VnPayResult;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import com.swp391.bookstreet.partner.service.PartnerOutcomeNotificationService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentSettlementService {
    // Only status 02 is a safe terminal failure for the initial-payment flow. Status 04 may
    // represent a reversal after the customer was debited, while 07 is suspicious and 09 is a
    // refund status. Treating those as retryable failures could cause a second charge.
    private static final Set<String> TERMINAL_FAILURE_STATUSES = Set.of("02");

    private final BoothPaymentRepository paymentRepository;
    private final BoothHoldRepository holdRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final EventRootLockService eventRootLockService;
    private final BoothReselectionNotificationService reselectionNotifications;
    private final VnPayProperties properties;
    private final PartnerOutcomeNotificationService outcomeNotifications;
    private final OrganizerWorkItemNotificationService organizerNotifications;

    public PaymentSettlementService(BoothPaymentRepository paymentRepository,
            BoothHoldRepository holdRepository, BoothRequestRepository requestRepository,
            BoothAssignmentRepository assignmentRepository,
            EventRootLockService eventRootLockService,
            BoothReselectionNotificationService reselectionNotifications,
            VnPayProperties properties,
            PartnerOutcomeNotificationService outcomeNotifications,
            OrganizerWorkItemNotificationService organizerNotifications) {
        this.paymentRepository = paymentRepository;
        this.holdRepository = holdRepository;
        this.requestRepository = requestRepository;
        this.assignmentRepository = assignmentRepository;
        this.eventRootLockService = eventRootLockService;
        this.reselectionNotifications = reselectionNotifications;
        this.properties = properties;
        this.outcomeNotifications = outcomeNotifications;
        this.organizerNotifications = organizerNotifications;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public VnPayAcknowledgement acceptIpn(VnPayResult result, Instant now) {
        if (!result.signatureValid()) return VnPayAcknowledgement.invalidChecksum();
        Long paymentId = paymentId(result.txnRef());
        if (paymentId == null) return VnPayAcknowledgement.notFound();
        LockedPayment locked = lockPayment(paymentId);
        if (locked == null) return VnPayAcknowledgement.notFound();
        Event event = locked.event();
        BoothHold hold = locked.hold();
        BoothPayment payment = locked.payment();
        if (payment == null || !expectedTxnRef(payment).equals(result.txnRef())) {
            return VnPayAcknowledgement.notFound();
        }
        if (!VnPayGatewayAdapter.minorAmount(payment.getAmount()).equals(result.amountMinor())) {
            return VnPayAcknowledgement.invalidAmount();
        }
        if (payment.getStatus() == BoothPaymentStatus.SUCCESS) {
            return VnPayAcknowledgement.alreadyConfirmed();
        }
        if (isSuccess(result)) {
            if (payment.getStatus() == BoothPaymentStatus.TIMEOUT) {
                if (canSafelySettleLate(payment, hold)) {
                    settle(event, payment, hold, result, now);
                } else {
                    payment.recordUnsafeLateSuccess(result.transactionNo(), result.responseCode(),
                            result.transactionStatus(), now);
                }
                return VnPayAcknowledgement.success();
            }
            if (payment.getStatus() != BoothPaymentStatus.PENDING) {
                payment.recordUnsafeLateSuccess(result.transactionNo(), result.responseCode(),
                        result.transactionStatus(), now);
                return VnPayAcknowledgement.success();
            }
            settle(event, payment, hold, result, now);
            return VnPayAcknowledgement.success();
        }
        if (payment.getStatus() != BoothPaymentStatus.PENDING) {
            return VnPayAcknowledgement.alreadyConfirmed();
        }
        applyNonSuccessCallback(event, payment, hold, result, now);
        return VnPayAcknowledgement.success();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void acceptQuery(Long paymentId, VnPayResult result, Instant now) {
        applyQuery(paymentId, result, now, false);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void acceptClaimedQuery(Long paymentId, VnPayResult result, Instant queriedAt) {
        applyQuery(paymentId, result, queriedAt, true);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentQueryClaim claimQuery(Long paymentId, Instant now) {
        LockedPayment locked = lockPayment(paymentId);
        if (locked == null) return null;
        BoothPayment payment = locked.payment();
        if (payment.getStatus() != BoothPaymentStatus.PENDING
                || payment.getCheckoutUrl() == null || payment.getCheckoutExpiresAt() == null) {
            return null;
        }
        Instant firstEligibleAt = payment.getCheckoutExpiresAt().plus(
                properties.getReconciliationDelaySeconds(), ChronoUnit.SECONDS);
        Instant previous = payment.getLastGatewayQueryAt();
        boolean intervalPassed = previous == null || !now.isBefore(previous.plus(
                properties.getQueryMinIntervalSeconds(), ChronoUnit.SECONDS));
        if (now.isBefore(firstEligibleAt) || !intervalPassed) return null;
        payment.recordGatewayQuery(now);
        return new PaymentQueryClaim(paymentId, payment.getAmount(), payment.getCreatedAt(), now);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failCheckoutCreationOrphan(Long paymentId, Instant eligibleCreatedAt,
            Instant now) {
        LockedPayment locked = lockPayment(paymentId);
        if (locked == null) return;
        BoothHold hold = locked.hold();
        BoothPayment payment = locked.payment();
        if (payment.getStatus() != BoothPaymentStatus.PENDING
                || payment.getCreatedAt().isAfter(eligibleCreatedAt)
                || (payment.getCheckoutUrl() != null
                    && payment.getCheckoutExpiresAt() != null)) {
            return;
        }
        payment.fail("CHECKOUT_NOT_CREATED",
                "The checkout was not durably created and no VNPay session exists.",
                null, null, null, now);
        expireHoldAndNotify(locked.event(), hold, now);
    }

    private void applyQuery(Long paymentId, VnPayResult result, Instant now,
            boolean queryAlreadyClaimed) {
        LockedPayment locked = lockPayment(paymentId);
        if (locked == null) return;
        Event event = locked.event();
        BoothHold hold = locked.hold();
        BoothPayment payment = locked.payment();

        boolean trusted = result.signatureValid() && "00".equals(result.responseCode())
                && expectedTxnRef(payment).equals(result.txnRef())
                && VnPayGatewayAdapter.minorAmount(payment.getAmount()).equals(result.amountMinor());
        if (!trusted) {
            retainForReconciliation(payment, "UNTRUSTED_QUERYDR_RESULT", now);
            return;
        }
        if (isSuccess(result)) {
            if (payment.getStatus() == BoothPaymentStatus.PENDING) {
                settle(event, payment, hold, result, now);
            } else if (payment.getStatus() == BoothPaymentStatus.TIMEOUT) {
                if (canSafelySettleLate(payment, hold)) {
                    settle(event, payment, hold, result, now);
                } else {
                    payment.recordUnsafeLateSuccess(result.transactionNo(), result.responseCode(),
                            result.transactionStatus(), now);
                }
            } else if (payment.getStatus() == BoothPaymentStatus.FAILED) {
                payment.recordUnsafeLateSuccess(result.transactionNo(), result.responseCode(),
                        result.transactionStatus(), now);
            }
            return;
        }
        if (payment.getStatus() != BoothPaymentStatus.PENDING) return;
        if ("01".equals(result.transactionStatus())) {
            if (!queryAlreadyClaimed) {
                if (payment.getCheckoutExpiresAt() == null) return;
                Instant firstEligibleAt = payment.getCheckoutExpiresAt().plus(
                        properties.getReconciliationDelaySeconds(), ChronoUnit.SECONDS);
                Instant previous = payment.getLastGatewayQueryAt();
                boolean intervalPassed = previous == null || !now.isBefore(previous.plus(
                        properties.getQueryMinIntervalSeconds(), ChronoUnit.SECONDS));
                if (now.isBefore(firstEligibleAt) || !intervalPassed) return;
            }
            payment.recordTrustedIncompleteQuery(result.responseCode(),
                    result.transactionStatus(), result.transactionNo(), now);
            if (payment.getTrustedIncompleteQueryCount() >= 2) {
                payment.timeout(now);
                expireHoldAndNotify(event, hold, now);
            }
            return;
        }
        if (TERMINAL_FAILURE_STATUSES.contains(result.transactionStatus())) {
            payment.fail("VNPAY_" + result.transactionStatus(), providerMessage(result),
                    result.responseCode(), result.transactionStatus(), result.transactionNo(), now);
            expireHoldAndNotify(event, hold, now);
            return;
        }
        payment.recordProviderEvidence(result.responseCode(), result.transactionStatus(),
                result.transactionNo(), now);
        payment.requireReconciliation("UNMAPPED_QUERYDR_STATUS", now);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordQueryFailure(Long paymentId, String reason, Instant now) {
        LockedPayment locked = lockPayment(paymentId);
        if (locked == null) return;
        retainForReconciliation(locked.payment(), reason, now);
    }

    private void settle(Event event, BoothPayment payment, BoothHold hold,
            VnPayResult result, Instant now) {
        BoothRequest request = hold.getBoothRequest();
        if (!canCreateAssignment(event)
                || hold.getStatus() != BoothHoldStatus.ACTIVE
                || request.getStatus() != BoothRequestStatus.SELECTED
                || assignmentRepository.existsByBoothHoldBoothHoldId(hold.getBoothHoldId())) {
            payment.recordUnsafeLateSuccess(result.transactionNo(), result.responseCode(),
                    result.transactionStatus(), now);
            return;
        }
        payment.succeed(result.transactionNo(), result.responseCode(),
                result.transactionStatus(), now);
        hold.consume(now);
        request.complete(now);
        assignmentRepository.save(BoothAssignment.create(hold, now));
        outcomeNotifications.boothChanged(request);
        organizerNotifications.boothPaymentConfirmed(event, request);
        requestRepository.findCompetingForUpdate(
                        request.getApplication().getEventId(), request.getBooth().getBoothId(),
                        BoothRequestStatus.PENDING)
                .forEach(competing -> {
                    competing.notSelected(now);
                    outcomeNotifications.boothChanged(competing);
                });
    }

    private LockedPayment lockPayment(Long paymentId) {
        var root = paymentRepository.findLockRootByPaymentId(paymentId).orElse(null);
        if (root == null) return null;
        Event event = eventRootLockService.lock(root.eventId()).orElse(null);
        if (event == null) return null;
        BoothHold hold = holdRepository.findByIdForUpdate(root.boothHoldId()).orElse(null);
        if (hold == null) return null;
        BoothPayment payment = paymentRepository.findByIdForUpdate(paymentId).orElse(null);
        if (payment == null) return null;
        return new LockedPayment(event, hold, payment);
    }

    private static boolean canCreateAssignment(Event event) {
        return event.getStatus() == EventStatus.PUBLISHED
                || event.getStatus() == EventStatus.ONGOING;
    }

    private void applyNonSuccessCallback(Event event, BoothPayment payment, BoothHold hold,
            VnPayResult result, Instant now) {
        if ("01".equals(result.transactionStatus())) {
            payment.recordProviderEvidence(result.responseCode(), result.transactionStatus(),
                    result.transactionNo(), now);
            payment.requireReconciliation("VNPAY_INCOMPLETE_REQUIRES_QUERYDR", now);
            return;
        }
        boolean cancelled = "24".equals(result.responseCode())
                && "02".equals(result.transactionStatus());
        if (cancelled || TERMINAL_FAILURE_STATUSES.contains(result.transactionStatus())) {
            payment.fail(cancelled ? "VNPAY_CANCELLED" : "VNPAY_" + result.transactionStatus(),
                    providerMessage(result), result.responseCode(), result.transactionStatus(),
                    result.transactionNo(), now);
            expireHoldAndNotify(event, hold, now);
            return;
        }
        payment.recordProviderEvidence(result.responseCode(), result.transactionStatus(),
                result.transactionNo(), now);
        payment.requireReconciliation("UNMAPPED_VNPAY_CALLBACK", now);
    }

    private void expireHoldAndNotify(Event event, BoothHold hold, Instant now) {
        if (hold.expire(now)) {
            outcomeNotifications.boothChanged(hold.getBoothRequest());
            holdRepository.flush();
            reselectionNotifications.notifyIfEligible(event, hold.getBoothRequest(), now);
        }
    }

    private boolean canSafelySettleLate(BoothPayment payment, BoothHold hold) {
        return hold.getStatus() == BoothHoldStatus.ACTIVE
                && !paymentRepository.existsByBoothHoldBoothHoldIdAndBoothPaymentIdGreaterThan(
                        hold.getBoothHoldId(), payment.getBoothPaymentId())
                && !paymentRepository.existsByBoothHoldBoothHoldIdAndStatus(
                        hold.getBoothHoldId(), BoothPaymentStatus.SUCCESS)
                && !assignmentRepository.existsByBoothHoldBoothHoldId(hold.getBoothHoldId());
    }

    private static void retainForReconciliation(BoothPayment payment, String detail, Instant now) {
        if (payment.getStatus() == BoothPaymentStatus.PENDING) {
            payment.recordGatewayQuery(now);
            payment.requireReconciliation(detail, now);
        }
    }

    private static boolean isSuccess(VnPayResult result) {
        return "00".equals(result.responseCode()) && "00".equals(result.transactionStatus());
    }

    private static Long paymentId(String txnRef) {
        if (txnRef == null || !txnRef.matches("BSP[1-9][0-9]*")) return null;
        try {
            return Long.valueOf(txnRef.substring(3));
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private static String expectedTxnRef(BoothPayment payment) {
        return VnPayGatewayAdapter.txnRef(payment.getBoothPaymentId());
    }

    private static String providerMessage(VnPayResult result) {
        return result.message() == null || result.message().isBlank()
                ? "VNPay reported an unsuccessful transaction." : result.message();
    }

    private record LockedPayment(Event event, BoothHold hold, BoothPayment payment) {
    }
}
