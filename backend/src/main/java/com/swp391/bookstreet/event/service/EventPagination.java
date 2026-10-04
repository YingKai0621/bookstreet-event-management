package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.exception.EventException;
import java.util.ArrayList;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

public final class EventPagination {
    private static final Set<String> SORT_FIELDS =
            Set.of("eventId", "name", "startAt", "endAt", "createdAt", "updatedAt");

    private EventPagination() {
    }

    public static Pageable of(int page, int size, String sort) {
        if (page < 0 || size < 1 || size > 100) {
            throw invalid("page must be non-negative and size must be between 1 and 100.");
        }
        String[] parts = sort.split(",", -1);
        if (parts.length > 2 || !SORT_FIELDS.contains(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc")
                    && !parts[1].equalsIgnoreCase("desc"))) {
            throw invalid("sort must be an allowed field followed by asc or desc.");
        }
        var direction = parts.length == 2 ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC;
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(direction, parts[0]));
        if (!parts[0].equals("eventId")) {
            orders.add(Sort.Order.asc("eventId"));
        }
        return PageRequest.of(page, size, Sort.by(orders));
    }

    private static EventException invalid(String message) {
        return new EventException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION", message);
    }
}

