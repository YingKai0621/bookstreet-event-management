package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.booth.dto.BoothPageResponse;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.security.BoothCurrentUser;
import com.swp391.bookstreet.booth.service.BoothHoldExpiryService;
import com.swp391.bookstreet.payment.dto.BoothAssignmentResponse;
import com.swp391.bookstreet.payment.dto.BoothPaymentResponse;
import com.swp391.bookstreet.payment.dto.PaymentInitiationResponse;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.repository.BoothPaymentRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PartnerPaymentService {
    private static final Set<String> SORT_FIELDS = Set.of("createdAt", "status", "amount");

    private final PaymentAttemptTransactions transactions;
    private final BoothPaymentRepository paymentRepository;
    private final BoothRequestRepository requestRepository;
    private final BoothAssignmentRepository assignmentRepository;
    private final BoothCurrentUser currentUser;
    private final BoothHoldExpiryService expiryService;
    private final Clock clock;

    public PartnerPaymentService(PaymentAttemptTransactions transactions,
            BoothPaymentRepository paymentRepository, BoothRequestRepository requestRepository,
            BoothAssignmentRepository assignmentRepository, BoothCurrentUser currentUser,
            BoothHoldExpiryService expiryService, Clock clock) {
        this.transactions = transactions;
        this.paymentRepository = paymentRepository;
        this.requestRepository = requestRepository;
        this.assignmentRepository = assignmentRepository;
        this.currentUser = currentUser;
        this.expiryService = expiryService;
        this.clock = clock;
    }

    public PaymentInitiationResult initiate(Long requestId, UUID key, String clientIp) {
        Long userId = currentUser.requirePartnerId();
        Instant now = clock.instant();
        expiryService.expireDueHolds(now);
        PaymentPreparation preparation;
        try {
            preparation = transactions.prepare(requestId, userId, key, clientIp, now);
        } catch (DataIntegrityViolationException race) {
            // A concurrent request can pass the pre-insert checks before the database unique
            // constraint serializes it. Re-read in a fresh transaction so same-key calls replay
            // the winner and different keys receive the normal pending-attempt conflict.
            preparation = transactions.prepare(requestId, userId, key, clientIp,
                    clock.instant());
        }
        var payment = preparation.payment();
        if (preparation.checkoutCreationFailed()) {
            throw new BoothApiException(HttpStatus.BAD_GATEWAY,
                    "PAYMENT_GATEWAY_UNAVAILABLE", "VNPay checkout is unavailable.");
        }
        if (!preparation.newlyCreated()) {
            boolean usable = payment.getStatus() == BoothPaymentStatus.PENDING
                    && payment.getCheckoutUrl() != null
                    && payment.getCheckoutExpiresAt() != null
                    && now.isBefore(payment.getCheckoutExpiresAt());
            boolean reconciling = payment.getStatus() == BoothPaymentStatus.PENDING && !usable;
            return new PaymentInitiationResult(reconciling ? HttpStatus.ACCEPTED : HttpStatus.OK,
                    response(payment, usable ? payment.getCheckoutUrl() : null,
                            usable ? payment.getCheckoutExpiresAt() : null,
                            reconciling ? "RECONCILING" : null));
        }
        return new PaymentInitiationResult(HttpStatus.CREATED,
                response(payment, payment.getCheckoutUrl(), payment.getCheckoutExpiresAt(), null));
    }

    public BoothPageResponse<BoothPaymentResponse> list(Long requestId, int page, int size,
            String sort) {
        Long userId = currentUser.requirePartnerId();
        if (requestRepository.findOwnedById(requestId, userId).isEmpty()) {
            throw new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_REQUEST_NOT_FOUND",
                    "Booth request not found.");
        }
        var pageable = pageRequest(page, size, sort);
        return BoothPageResponse.from(paymentRepository.findOwnedByRequest(
                requestId, userId, pageable).map(BoothPaymentResponse::from));
    }

    public BoothPaymentResponse detail(Long paymentId) {
        Long userId = currentUser.requirePartnerId();
        return paymentRepository.findOwnedById(paymentId, userId)
                .map(BoothPaymentResponse::from)
                .orElseThrow(() -> new BoothApiException(HttpStatus.NOT_FOUND,
                        "BOOTH_PAYMENT_NOT_FOUND", "Booth Payment not found."));
    }

    public BoothAssignmentResponse assignment(Long requestId) {
        Long userId = currentUser.requirePartnerId();
        if (requestRepository.findOwnedById(requestId, userId).isEmpty()) {
            throw new BoothApiException(HttpStatus.NOT_FOUND, "BOOTH_REQUEST_NOT_FOUND",
                    "Booth request not found.");
        }
        return assignmentRepository.findOwnedByRequestId(requestId, userId)
                .map(BoothAssignmentResponse::from)
                .orElseThrow(() -> new BoothApiException(HttpStatus.NOT_FOUND,
                        "BOOTH_ASSIGNMENT_NOT_FOUND", "Booth Assignment not found."));
    }

    private static PaymentInitiationResponse response(
            com.swp391.bookstreet.payment.entity.BoothPayment payment,
            String checkoutUrl, Instant expiresAt, String resolution) {
        return new PaymentInitiationResponse(BoothPaymentResponse.from(payment), checkoutUrl,
                expiresAt, resolution);
    }

    private static PageRequest pageRequest(int page, int size, String requestedSort) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                    "page must be non-negative and size must be between 1 and 100.");
        }
        String[] parts = requestedSort == null ? new String[0] : requestedSort.split(",", -1);
        String field = parts.length == 0 || parts[0].isBlank() ? "createdAt" : parts[0];
        if (!SORT_FIELDS.contains(field) || parts.length > 2) {
            throw invalidSort();
        }
        Sort.Direction direction;
        try {
            direction = parts.length < 2 || parts[1].isBlank()
                    ? Sort.Direction.DESC : Sort.Direction.fromString(parts[1]);
        } catch (IllegalArgumentException error) {
            throw invalidSort();
        }
        return PageRequest.of(page, size, Sort.by(direction, field));
    }

    private static BoothApiException invalidSort() {
        return new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT",
                "Unsupported payment sort.");
    }
}
