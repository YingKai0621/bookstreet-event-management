package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.exception.BoothApiException;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

public final class BoothPagination {
    private static final Map<String, String> ORGANIZER_FIELDS = Map.of(
            "code", "location.code",
            "name", "location.name",
            "createdAt", "location.createdAt",
            "updatedAt", "location.updatedAt");
    private static final Set<String> PUBLIC_FIELDS = Set.of("code", "name", "rentalPrice");

    private BoothPagination() {
    }

    public static Pageable organizer(int page, int size, String sort) {
        SortSpec spec = parse(page, size, sort, ORGANIZER_FIELDS.keySet());
        var orders = new ArrayList<Sort.Order>();
        orders.add(new Sort.Order(spec.direction(), ORGANIZER_FIELDS.get(spec.field())));
        orders.add(Sort.Order.asc("boothId"));
        return PageRequest.of(page, size, Sort.by(orders));
    }

    public static SortSpec publicSort(int page, int size, String sort) {
        return parse(page, size, sort, PUBLIC_FIELDS);
    }

    private static SortSpec parse(int page, int size, String sort, Set<String> fields) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_PAGINATION",
                    "page must be non-negative and size must be between 1 and 100.");
        }
        String[] parts = sort.split(",", -1);
        if (parts.length > 2 || !fields.contains(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc")
                    && !parts[1].equalsIgnoreCase("desc"))) {
            throw new BoothApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT",
                    "sort must be an allowed field followed by asc or desc.");
        }
        Sort.Direction direction = parts.length == 2
                ? Sort.Direction.fromString(parts[1]) : Sort.Direction.ASC;
        return new SortSpec(parts[0], direction);
    }

    public record SortSpec(String field, Sort.Direction direction) {
    }
}
