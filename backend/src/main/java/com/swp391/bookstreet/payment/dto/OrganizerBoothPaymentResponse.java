package com.swp391.bookstreet.payment.dto;

import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentTransactionType;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * One Booth Payment of an Event the Organizer owns. Gateway details stay with Admin oversight: the
 * reconciliation flag, gateway reference and failure code are left out, because the Organizer cannot act
 * on them.
 */
public record OrganizerBoothPaymentResponse(
        Long boothPaymentId,
        EventRef event,
        OrganizationRef partnerOrganization,
        BoothRef booth,
        BoothPaymentTransactionType transactionType,
        BigDecimal amount,
        BoothPaymentStatus status,
        Instant createdAt,
        Instant completedAt
) {
    public record EventRef(Long eventId, String name) {
    }

    public record OrganizationRef(Long partnerOrganizationId, String name) {
    }

    public record BoothRef(Long boothId, String code, String name) {
    }

    public static OrganizerBoothPaymentResponse from(BoothPaymentHistoryRow row) {
        return new OrganizerBoothPaymentResponse(
                row.boothPaymentId(),
                new EventRef(row.eventId(), row.eventName()),
                new OrganizationRef(row.partnerOrganizationId(), row.partnerOrganizationName()),
                new BoothRef(row.boothId(), row.boothCode(), row.boothName()),
                row.transactionType(),
                row.amount(),
                row.status(),
                row.createdAt(),
                row.completedAt());
    }
}
