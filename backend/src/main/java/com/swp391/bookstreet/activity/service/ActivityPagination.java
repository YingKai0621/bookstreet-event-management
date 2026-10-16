package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import java.util.ArrayList;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

final class ActivityPagination {
    private static final Map<String, String> SORT_FIELDS = Map.of(
            "startAt", "startAt",
            "endAt", "endAt",
            "title", "title",
            "status", "status",
            "createdAt", "createdAt",
            "updatedAt", "updatedAt");

    private ActivityPagination() {
    }

    static Pageable of(int page, int size, String sort) {
        if (page < 0) throw invalid("INVALID_PAGE", "page must be non-negative.");
        if (size < 1 || size > 100) {
            throw invalid("INVALID_SIZE", "size must be between 1 and 100.");
        }
        String[] parts = sort == null ? new String[0] : sort.split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !SORT_FIELDS.containsKey(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc")
                    && !parts[1].equalsIgnoreCase("desc"))) {
            throw invalid("INVALID_SORT", "sort uses an unsupported Activity field.");
        }
        Sort.Direction direction = parts.length == 2
                ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC;
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(direction, SORT_FIELDS.get(parts[0])));
        orders.add(Sort.Order.asc("activityId"));
        return PageRequest.of(page, size, Sort.by(orders));
    }

    private static ActivityApiException invalid(String code, String message) {
        return new ActivityApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
