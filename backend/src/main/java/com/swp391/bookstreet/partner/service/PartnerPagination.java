package com.swp391.bookstreet.partner.service;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

import java.util.Set;

public final class PartnerPagination {

    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "submittedAt",
            "status",
            "eventId",
            "reviewedAt",
            "withdrawnAt"
    );

    private PartnerPagination() {
    }

    public static void validateSort(Pageable pageable) {
        for (Sort.Order order : pageable.getSort()) {
            String property = order.getProperty();

            if (!ALLOWED_SORT_FIELDS.contains(property)) {
                throw new PartnerApiException(
                        HttpStatus.BAD_REQUEST,
                        "INVALID_SORT",
                        "Sort field must be submittedAt, status, eventId, reviewedAt or withdrawnAt."
                );
            }
        }
    }
}
