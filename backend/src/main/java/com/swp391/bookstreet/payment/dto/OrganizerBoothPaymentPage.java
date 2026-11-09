package com.swp391.bookstreet.payment.dto;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.data.domain.Page;

/**
 * The shared paging shape plus collectedAmount: successful Payments of type PAYMENT under the same filters
 * except status, so the total does not change when the Organizer looks at failed attempts.
 */
public record OrganizerBoothPaymentPage(
        List<OrganizerBoothPaymentResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        BigDecimal collectedAmount
) {
    public static OrganizerBoothPaymentPage from(Page<BoothPaymentHistoryRow> page, BigDecimal collectedAmount) {
        return new OrganizerBoothPaymentPage(
                page.getContent().stream().map(OrganizerBoothPaymentResponse::from).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                collectedAmount);
    }
}
