package com.swp391.bookstreet.reward.service;

import com.swp391.bookstreet.common.exception.ApiException;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** Validates query input before any text is used to build a repository order clause. */
public record RewardManagementQuery(int page, int size, String orderBy, String search) {
    public static RewardManagementQuery visits(int page, int size, String sort, String search) {
        return parse(page, size, sort, search, "visitedAt,desc", "visit.boothVisitId desc",
                Map.of("visitedAt", "visit.visitedAt", "participantDisplayName", "lower(participant.fullName)",
                        "boothCode", "lower(location.code)"));
    }

    public static RewardManagementQuery groups(int page, int size, String sort, String search) {
        return parse(page, size, sort, search, "visitCount,desc", "assignment.boothAssignmentId asc",
                Map.of("visitCount", "count(visit)", "lastVisitedAt", "max(visit.visitedAt)",
                        "boothCode", "lower(location.code)"));
    }

    public static RewardManagementQuery badges(int page, int size, String sort, String search) {
        return parse(page, size, sort, search, "createdAt,desc",
                sort == null ? "badge.badgeId desc" : "badge.badgeId asc",
                Map.of("name", "lower(badge.name)", "requiredPoints", "badge.requiredPoints",
                        "isActive", "badge.active", "createdAt", "badge.createdAt", "updatedAt", "badge.updatedAt"));
    }

    public static Long positiveId(Long id, boolean path) {
        if (id != null && id <= 0) throw invalid(path ? "MALFORMED_REQUEST" : "INVALID_FILTER");
        return id;
    }

    public static Boolean activeFilter(String value) {
        if (value == null) return null;
        if (value.equals("true")) return true;
        if (value.equals("false")) return false;
        throw invalid("INVALID_FILTER");
    }

    private static RewardManagementQuery parse(int page, int size, String sort, String search,
            String defaultSort, String tieBreaker, Map<String, String> allowed) {
        if (page < 0) throw invalid("INVALID_PAGE");
        if (size < 1 || size > 100) throw invalid("INVALID_SIZE");
        String[] parts = (sort == null ? defaultSort : sort).split(",", -1);
        if (parts.length < 1 || parts.length > 2 || !allowed.containsKey(parts[0])) {
            throw invalid("INVALID_SORT");
        }
        String direction = parts.length == 1 ? "asc" : parts[1].toLowerCase(Locale.ROOT);
        if (!direction.equals("asc") && !direction.equals("desc")) throw invalid("INVALID_SORT");
        String normalized = search == null ? null : search.trim().replaceAll("\\s+", " ");
        if (normalized != null && normalized.isEmpty()) normalized = null;
        if (normalized != null && normalized.length() > 100) throw invalid("INVALID_FILTER");
        return new RewardManagementQuery(page, size,
                allowed.get(parts[0]) + " " + direction + ", " + tieBreaker, normalized);
    }

    public long offset() { return (long) page * size; }

    public String searchPattern() {
        if (search == null) return null;
        return "%" + search.toLowerCase(Locale.ROOT).replace("!", "!!")
                .replace("%", "!%").replace("_", "!_") + "%";
    }

    private static ApiException invalid(String code) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, "Invalid reward management query parameter.");
    }
}
