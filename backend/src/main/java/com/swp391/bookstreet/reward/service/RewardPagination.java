package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.exception.ApiException;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;

record RewardPagination(int page, int size, String field, boolean descending,
        boolean defaultBadgeOrder) {
    private static final int MAX_SIZE = 100;
    private static final Map<String, String> POINT_FIELDS = Map.of(
            "createdAt", "pointTransaction.createdAt",
            "visitedAt", "visit.visitedAt",
            "points", "pointTransaction.points");
    private static final Map<String, String> BADGE_FIELDS = Map.of(
            "earnedAt", "userBadge.earnedAt",
            "requiredPoints", "badge.requiredPoints",
            "name", "lower(badge.name)");

    static RewardPagination points(int page, int size, String sort) {
        validatePage(page, size);
        SortValue value = parseSort(sort == null ? "createdAt,desc" : sort, POINT_FIELDS);
        return new RewardPagination(page, size, value.field(), value.descending(), false);
    }

    static RewardPagination badges(int page, int size, String sort) {
        validatePage(page, size);
        if (sort == null) {
            return new RewardPagination(page, size, null, false, true);
        }
        SortValue value = parseSort(sort, BADGE_FIELDS);
        return new RewardPagination(page, size, value.field(), value.descending(), false);
    }

    long offset() {
        return (long) page * size;
    }

    String pointOrderBy() {
        return field + (descending ? " desc" : " asc")
                + ", pointTransaction.pointTransactionId desc";
    }

    String badgeOrderBy() {
        if (defaultBadgeOrder) {
            return "case when userBadge.userBadgeId is null then 1 else 0 end asc, "
                    + "case when userBadge.userBadgeId is not null then userBadge.earnedAt end desc, "
                    + "case when userBadge.userBadgeId is not null then badge.badgeId end desc, "
                    + "case when userBadge.userBadgeId is null then badge.requiredPoints end asc, "
                    + "case when userBadge.userBadgeId is null then badge.badgeId end asc";
        }
        String direction = descending ? " desc" : " asc";
        if (field.equals("userBadge.earnedAt")) {
            return "case when userBadge.earnedAt is null then 1 else 0 end asc, "
                    + field + direction + ", badge.badgeId asc";
        }
        return field + direction + ", badge.badgeId asc";
    }

    static Long positiveFilter(Long value) {
        if (value != null && value <= 0) {
            throw invalid("INVALID_FILTER", "Reward filter identities must be positive.");
        }
        return value;
    }

    private static void validatePage(int page, int size) {
        if (page < 0) throw invalid("INVALID_PAGE", "page must be non-negative.");
        if (size < 1 || size > MAX_SIZE) {
            throw invalid("INVALID_SIZE", "size must be between 1 and 100.");
        }
    }

    private static SortValue parseSort(String requested, Map<String, String> allowed) {
        String[] parts = requested.split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !allowed.containsKey(parts[0])) {
            throw invalid("INVALID_SORT", "sort uses an unsupported reward field.");
        }
        String direction = parts.length == 1 ? "asc" : parts[1].toLowerCase(Locale.ROOT);
        if (!direction.equals("asc") && !direction.equals("desc")) {
            throw invalid("INVALID_SORT", "sort direction must be asc or desc.");
        }
        return new SortValue(allowed.get(parts[0]), direction.equals("desc"));
    }

    private static ApiException invalid(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private record SortValue(String field, boolean descending) {
    }
}
