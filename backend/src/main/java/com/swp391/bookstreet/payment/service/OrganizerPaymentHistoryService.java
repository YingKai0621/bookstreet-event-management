package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.payment.dto.OrganizerBoothPaymentPage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * AC-ORG-PAY-S11-01: an Organizer reads the Booth Payments of the Events they own, and nothing else. An
 * eventId the Organizer does not own simply matches no row, so the response does not reveal whether that
 * Event exists. The Organizer cannot change a Payment.
 */
@Service
public class OrganizerPaymentHistoryService {
    private final BoothPaymentHistoryQuery history;

    public OrganizerPaymentHistoryService(BoothPaymentHistoryQuery history) {
        this.history = history;
    }

    @Transactional(readOnly = true)
    public OrganizerBoothPaymentPage list(Long organizerUserId, String page, String size, String status,
            String eventId, String search, String from, String to, String sort) {
        // The reconciliation filter belongs to Admin oversight, so it is not offered here.
        BoothPaymentHistoryCriteria criteria = BoothPaymentHistoryCriteria.parse(
                page, size, status, eventId, null, search, from, to, sort);
        return OrganizerBoothPaymentPage.from(
                history.page(criteria, organizerUserId, false),
                history.collectedAmount(criteria, organizerUserId, false));
    }
}
