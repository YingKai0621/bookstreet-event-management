package com.swp391.bookstreet.registration.service;

import com.swp391.bookstreet.registration.exception.RegistrationApiException;
import java.util.ArrayList;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

final class RegistrationPagination {
    private static final Map<String, String> EVENT_SORT_FIELDS = Map.of(
            "registeredAt", "registeredAt",
            "activatedAt", "activatedAt",
            "updatedAt", "updatedAt",
            "eventStartAt", "event.startAt",
            "eventName", "event.name");

    private static final Map<String, String> ACTIVITY_SORT_FIELDS = Map.of(
            "registeredAt", "registeredAt",
            "activatedAt", "activatedAt",
            "updatedAt", "updatedAt",
            "activityStartAt", "activity.startAt",
            "activityTitle", "activity.title");

    private RegistrationPagination() {
    }

    static Pageable events(int page, int size, String sort) {
        return pageable(page, size, sort, EVENT_SORT_FIELDS, "Event Registration",
                "eventRegistrationId");
    }

    static Pageable activities(int page, int size, String sort) {
        return pageable(page, size, sort, ACTIVITY_SORT_FIELDS, "Activity Registration",
                "activityRegistrationId");
    }

    private static Pageable pageable(int page, int size, String sort,
            Map<String, String> fields, String label, String tieBreaker) {
        if (page < 0) throw invalid("INVALID_PAGE", "page must be non-negative.");
        if (size < 1 || size > 100) {
            throw invalid("INVALID_SIZE", "size must be between 1 and 100.");
        }
        String[] parts = sort == null ? new String[0] : sort.split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !fields.containsKey(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc")
                    && !parts[1].equalsIgnoreCase("desc"))) {
            throw invalid("INVALID_SORT", "sort uses an unsupported " + label + " field.");
        }
        Sort.Direction direction = parts.length == 2
                ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC;
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(direction, fields.get(parts[0])));
        orders.add(Sort.Order.asc(tieBreaker));
        return PageRequest.of(page, size, Sort.by(orders));
    }

    private static RegistrationApiException invalid(String code, String message) {
        return new RegistrationApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
