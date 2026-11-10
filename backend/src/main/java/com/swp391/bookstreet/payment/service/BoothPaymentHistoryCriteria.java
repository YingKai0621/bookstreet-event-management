package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Validated filters for a Booth Payment history page. Unsupported values are rejected rather than replaced,
 * as section 1.1 of the Sprint 11 API contract requires. Dates are whole days in Asia/Ho_Chi_Minh.
 */
public record BoothPaymentHistoryCriteria(
        int page,
        int size,
        BoothPaymentStatus status,
        Long eventId,
        Boolean reconciliationRequired,
        String search,
        Instant createdFrom,
        Instant createdBefore,
        String orderBy
) {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_SIZE = 100;
    private static final int MAX_SEARCH_LENGTH = 100;
    private static final Map<String, String> SORTS = Map.of(
            "createdAt,desc", "p.createdAt desc, p.boothPaymentId desc",
            "createdAt,asc", "p.createdAt asc, p.boothPaymentId asc",
            "amount,desc", "p.amount desc, p.boothPaymentId desc",
            "amount,asc", "p.amount asc, p.boothPaymentId asc");

    public static BoothPaymentHistoryCriteria parse(String page, String size, String status, String eventId,
            String reconciliationRequired, String search, String from, String to, String sort) {
        String orderBy = SORTS.get(sort == null ? "createdAt,desc" : sort);
        if (orderBy == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT", "sort has an unsupported value.");
        }
        int pageNumber = wholeNumber(page == null ? "0" : page, "page");
        int pageSize = wholeNumber(size == null ? "20" : size, "size");
        if (pageNumber < 0 || pageSize < 1 || pageSize > MAX_SIZE) {
            throw invalid("page must be non-negative and size between 1 and " + MAX_SIZE + ".");
        }
        String searchTerm = search == null ? "" : search.strip();
        if (searchTerm.length() > MAX_SEARCH_LENGTH) {
            throw invalid("search must not exceed " + MAX_SEARCH_LENGTH + " characters.");
        }
        LocalDate fromDate = date(from, "from");
        LocalDate toDate = date(to, "to");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw invalid("from must not be later than to.");
        }
        return new BoothPaymentHistoryCriteria(
                pageNumber,
                pageSize,
                paymentStatus(status),
                positiveId(eventId),
                bool(reconciliationRequired),
                searchTerm,
                fromDate == null ? null : fromDate.atStartOfDay(BUSINESS_ZONE).toInstant(),
                toDate == null ? null : toDate.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant(),
                orderBy);
    }

    private static BoothPaymentStatus paymentStatus(String value) {
        if (value == null) return null;
        try {
            return BoothPaymentStatus.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw invalid("status has an unsupported value.");
        }
    }

    private static Long positiveId(String value) {
        if (value == null) return null;
        try {
            long id = Long.parseLong(value);
            if (id > 0) return id;
        } catch (NumberFormatException ignored) {
            // reported below
        }
        throw invalid("eventId must be a positive identifier.");
    }

    private static Boolean bool(String value) {
        if (value == null) return null;
        if ("true".equals(value)) return Boolean.TRUE;
        if ("false".equals(value)) return Boolean.FALSE;
        throw invalid("reconciliationRequired must be true or false.");
    }

    private static LocalDate date(String value, String name) {
        if (value == null) return null;
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw invalid(name + " must use yyyy-MM-dd.");
        }
    }

    private static int wholeNumber(String value, String name) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw invalid(name + " must be a whole number.");
        }
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER", message);
    }
}
