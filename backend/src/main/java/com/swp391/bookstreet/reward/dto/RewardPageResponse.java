package com.swp391.bookstreet.reward.dto;

import java.util.List;

public record RewardPageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
