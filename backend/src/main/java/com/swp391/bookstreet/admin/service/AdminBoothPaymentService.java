package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.admin.dto.AdminBoothPaymentResponse;
import com.swp391.bookstreet.admin.dto.AdminPageResponse;
import com.swp391.bookstreet.payment.service.BoothPaymentHistoryCriteria;
import com.swp391.bookstreet.payment.service.BoothPaymentHistoryQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AC-OPT-S11-01: Admin lists Booth Payments across every Event, including PENDING ones, and cannot change them.
 * This service only reads: it writes no audit row, because reads are not audited (BR-118).
 */
@Service
public class AdminBoothPaymentService {
    private final BoothPaymentHistoryQuery history;

    public AdminBoothPaymentService(BoothPaymentHistoryQuery history) {
        this.history = history;
    }

    @Transactional(readOnly = true)
    public AdminPageResponse<AdminBoothPaymentResponse> list(String page, String size, String status,
            String eventId, String reconciliationRequired, String search, String from, String to, String sort) {
        BoothPaymentHistoryCriteria criteria = BoothPaymentHistoryCriteria.parse(
                page, size, status, eventId, reconciliationRequired, search, from, to, sort);
        return AdminPageResponse.from(history.page(criteria, null, true), AdminBoothPaymentResponse::from);
    }
}
