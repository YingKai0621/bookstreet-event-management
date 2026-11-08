package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.common.exception.ApiException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

/** Shared query parsing for Admin lists, which reject unsupported values rather than replace them. */
public final class AdminPaging {
    private static final int MAX_SIZE = 100;

    private AdminPaging() {
    }

    public static Pageable of(String page, String size, Sort sort) {
        int pageNumber = parseInt(page, "page");
        int pageSize = parseInt(size, "size");
        if (pageNumber < 0 || pageSize < 1 || pageSize > MAX_SIZE) {
            throw invalidFilter("page must be non-negative and size between 1 and " + MAX_SIZE + ".");
        }
        return PageRequest.of(pageNumber, pageSize, sort);
    }

    public static ApiException invalidFilter(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER", message);
    }

    public static Long optionalId(String value, String name) {
        if (value == null) return null;
        long id;
        try {
            id = Long.parseLong(value);
        } catch (NumberFormatException exception) {
            throw invalidFilter(name + " must be a positive identifier.");
        }
        if (id <= 0) throw invalidFilter(name + " must be a positive identifier.");
        return id;
    }

    public static <E extends Enum<E>> E optionalEnum(Class<E> type, String value, String name) {
        if (value == null) return null;
        try {
            return Enum.valueOf(type, value);
        } catch (IllegalArgumentException exception) {
            throw invalidFilter(name + " has an unsupported value.");
        }
    }

    private static int parseInt(String value, String name) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw invalidFilter(name + " must be a whole number.");
        }
    }
}
