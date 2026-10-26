package com.swp391.bookstreet.attendance.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;

public record ParticipationPagination(int page, int size, String field, boolean descending) {
    public static ParticipationPagination of(int page, int size, String sort, Map<String, String> allowed) {
        if (page < 0) throw invalid("INVALID_PAGE");
        if (size < 1 || size > 100) throw invalid("INVALID_SIZE");
        String[] parts = sort == null ? new String[0] : sort.split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !allowed.containsKey(parts[0])
                || (parts.length == 2 && !parts[1].equalsIgnoreCase("asc") && !parts[1].equalsIgnoreCase("desc"))) {
            throw invalid("INVALID_SORT");
        }
        return new ParticipationPagination(page, size, allowed.get(parts[0]),
                parts.length == 2 && parts[1].equalsIgnoreCase("desc"));
    }

    public String sql(String tieBreaker) {
        return field + (descending ? " desc" : " asc") + ", " + tieBreaker + " asc";
    }

    public long offset() { return (long) page * size; }

    public Pageable pageable(String tieBreaker) {
        Sort sort = Sort.by(descending ? Sort.Direction.DESC : Sort.Direction.ASC, field);
        if (!field.equals(tieBreaker)) sort = sort.and(Sort.by(tieBreaker));
        return PageRequest.of(page, size, sort);
    }

    public static String filter(String value, Class<? extends Enum<?>> type) {
        if (value == null) return null;
        for (Enum<?> item : type.getEnumConstants()) if (item.name().equals(value)) return value;
        throw invalid("INVALID_FILTER");
    }

    public static String search(String value) {
        if (value == null) return "";
        String normalized = value.strip().replaceAll("(?U)\\s+", " ");
        if (normalized.length() > 200) throw invalid("INVALID_FILTER");
        return normalized;
    }

    private static ActivityApiException invalid(String code) {
        return new ActivityApiException(HttpStatus.BAD_REQUEST, code, "Unsupported pagination, sort or filter.");
    }
}
