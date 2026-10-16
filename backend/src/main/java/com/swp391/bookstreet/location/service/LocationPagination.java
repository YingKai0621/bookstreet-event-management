package com.swp391.bookstreet.location.service;

import com.swp391.bookstreet.location.exception.LocationApiException;
import java.util.ArrayList;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

final class LocationPagination {
    private static final Map<String, String> SORT_FIELDS = Map.of(
            "code", "code",
            "name", "name",
            "locationType", "locationType",
            "maxCapacity", "maxCapacity",
            "createdAt", "createdAt");

    private LocationPagination() {
    }

    static Pageable of(int page, int size, String sort) {
        if (page < 0) {
            throw new LocationApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGE",
                    "page must be non-negative.");
        }
        if (size < 1 || size > 100) {
            throw new LocationApiException(HttpStatus.BAD_REQUEST, "INVALID_SIZE",
                    "size must be between 1 and 100.");
        }
        String[] parts = sort == null ? new String[0] : sort.split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !SORT_FIELDS.containsKey(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc")
                    && !parts[1].equalsIgnoreCase("desc"))) {
            throw new LocationApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT",
                    "sort must use code, name, locationType, maxCapacity or createdAt.");
        }
        Sort.Direction direction = parts.length == 2
                ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC;
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(direction, SORT_FIELDS.get(parts[0])));
        orders.add(Sort.Order.asc("locationId"));
        return PageRequest.of(page, size, Sort.by(orders));
    }
}
