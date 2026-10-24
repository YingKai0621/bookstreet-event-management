package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.common.exception.ApiException;
import java.util.ArrayList;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

final class CertificatePagination {
    private static final Map<String, String> FIELDS = Map.of(
            "issuedAt", "issued_at",
            "updatedAt", "updated_at",
            "activityTitle", "act.title"
    );

    private CertificatePagination() {
    }

    static Pageable of(int page, int size, String sort) {
        if (page < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE", "page must be non-negative.");
        }
        if (size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SIZE", "size must be between 1 and 100.");
        }
        String sortParam = (sort == null || sort.isBlank()) ? "issuedAt,desc" : sort.trim();
        String[] parts = sortParam.split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !FIELDS.containsKey(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc") && !parts[1].equalsIgnoreCase("desc"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT", "sort uses an unsupported Certificate field.");
        }
        Sort.Direction direction = (parts.length == 2 && parts[1].equalsIgnoreCase("asc"))
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(direction, FIELDS.get(parts[0])));
        orders.add(Sort.Order.asc("certificate_id"));
        return PageRequest.of(page, size, Sort.by(orders));
    }
}
