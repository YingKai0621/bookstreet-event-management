package com.swp391.bookstreet.payment.repository;

import com.swp391.bookstreet.payment.entity.BoothPayment;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoothPaymentRepository extends JpaRepository<BoothPayment, Long> {
    @EntityGraph(attributePaths = {
            "boothHold", "boothHold.boothRequest",
            "boothHold.boothRequest.application",
            "boothHold.boothRequest.application.partnerOrganization"
    })
    Optional<BoothPayment> findByIdempotencyKey(UUID idempotencyKey);

    @EntityGraph(attributePaths = {
            "boothHold", "boothHold.boothRequest",
            "boothHold.boothRequest.application",
            "boothHold.boothRequest.application.partnerOrganization"
    })
    @Query("""
            select payment
            from BoothPayment payment
            where payment.boothPaymentId = :paymentId
              and payment.boothHold.boothRequest.application.partnerOrganization.representativeUserId = :userId
            """)
    Optional<BoothPayment> findOwnedById(
            @Param("paymentId") Long paymentId,
            @Param("userId") Long userId);

    @EntityGraph(attributePaths = {"boothHold", "boothHold.boothRequest"})
    @Query(value = """
            select payment
            from BoothPayment payment
            where payment.boothHold.boothRequest.boothRequestId = :requestId
              and payment.boothHold.boothRequest.application.partnerOrganization.representativeUserId = :userId
            """,
            countQuery = """
                    select count(payment)
                    from BoothPayment payment
                    where payment.boothHold.boothRequest.boothRequestId = :requestId
                      and payment.boothHold.boothRequest.application.partnerOrganization.representativeUserId = :userId
                    """)
    Page<BoothPayment> findOwnedByRequest(
            @Param("requestId") Long requestId,
            @Param("userId") Long userId,
            Pageable pageable);

    Optional<BoothPayment> findFirstByBoothHoldBoothHoldIdAndStatusOrderByCreatedAtDesc(
            Long boothHoldId, BoothPaymentStatus status);

    boolean existsByBoothHoldBoothHoldIdAndStatus(Long boothHoldId, BoothPaymentStatus status);

    boolean existsByBoothHoldBoothHoldIdAndReconciliationRequiredTrue(Long boothHoldId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select payment from BoothPayment payment
            where payment.boothHold.boothHoldId = :holdId
            order by payment.boothPaymentId
            """)
    List<BoothPayment> findByHoldIdForUpdate(@Param("holdId") Long holdId);

    boolean existsByBoothHoldBoothHoldIdAndBoothPaymentIdGreaterThan(
            Long boothHoldId, Long boothPaymentId);

    @Query("""
            select new com.swp391.bookstreet.payment.repository.PaymentLockRoot(
                payment.boothHold.boothRequest.application.eventId,
                payment.boothHold.boothHoldId)
            from BoothPayment payment
            where payment.boothPaymentId = :paymentId
            """)
    Optional<PaymentLockRoot> findLockRootByPaymentId(@Param("paymentId") Long paymentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"boothHold", "boothHold.boothRequest"})
    @Query("select payment from BoothPayment payment where payment.boothPaymentId = :paymentId")
    Optional<BoothPayment> findByIdForUpdate(@Param("paymentId") Long paymentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select payment
            from BoothPayment payment
            where payment.boothHold.eventBoothConfig.eventId = :eventId
            order by payment.boothPaymentId
            """)
    List<BoothPayment> findByEventIdForUpdate(@Param("eventId") Long eventId);

    @Query(value = """
            select booth_payment_id
            from booth_payments
            where status = 'PENDING'
              and checkout_expires_at is not null
              and checkout_expires_at <= :eligibleCheckoutExpiry
              and (last_gateway_query_at is null
                   or last_gateway_query_at <= :eligibleLastQuery)
            order by checkout_expires_at, booth_payment_id
            limit 50
            """, nativeQuery = true)
    List<Long> findReconciliationCandidateIds(
            @Param("eligibleCheckoutExpiry") Instant eligibleCheckoutExpiry,
            @Param("eligibleLastQuery") Instant eligibleLastQuery);

    @Query(value = """
            select booth_payment_id
            from booth_payments
            where status = 'PENDING'
              and (checkout_url is null or checkout_expires_at is null)
              and created_at <= :eligibleCreatedAt
            order by created_at, booth_payment_id
            limit 50
            """, nativeQuery = true)
    List<Long> findCheckoutCreationOrphanIds(
            @Param("eligibleCreatedAt") Instant eligibleCreatedAt);
}
