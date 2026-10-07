package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.exception.BoothApiException;
import java.util.ArrayList;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

final class BoothRequestPagination {
    private static final Map<String, String> FIELDS = Map.of(
            "submittedAt", "submittedAt",
            "status", "status",
            "boothCode", "booth.location.code"
    );
    private static final Map<String, String> ORGANIZER_FIELDS = Map.of(
            "submittedAt", "submittedAt",
            "status", "status",
            "boothCode", "booth.location.code",
            "partnerOrganizationName", "application.partnerOrganization.name"
    );

    private BoothRequestPagination() {
    }

    static Pageable page(int page, int size, String sort) {
        return page(page, size, sort, FIELDS,
                "sort must be submittedAt, status, or boothCode followed by asc or desc.");
    }

    static Pageable organizerPage(int page, int size, String sort) {
        return page(page, size, sort, ORGANIZER_FIELDS,
                "sort must be submittedAt, status, boothCode, or partnerOrganizationName "
                        + "followed by asc or desc.");
    }

    private static Pageable page(int page, int size, String sort,
            Map<String, String> fields, String sortMessage) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                    "page must be non-negative and size must be between 1 and 100.");
        }

        String[] parts = sort.split(",", -1);
        if (parts.length > 2 || !fields.containsKey(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc")
                && !parts[1].equalsIgnoreCase("desc"))) {
            throw new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT",
                    sortMessage);
        }

        Sort.Direction direction = parts.length == 2
                ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC;
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(direction, fields.get(parts[0])));
        orders.add(Sort.Order.asc("boothRequestId"));
        return PageRequest.of(page, size, Sort.by(orders));
    }
}
