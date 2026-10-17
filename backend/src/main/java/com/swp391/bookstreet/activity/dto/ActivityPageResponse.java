package com.swp391.bookstreet.activity.dto;

import java.util.List;

public record ActivityPageResponse<T>(List<T> content, int page, int size,
        long totalElements, int totalPages) {
}
