package com.swp391.bookstreet.event.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record EventPageResponse<T>(List<T> content, int page, int size,
        long totalElements, int totalPages) {
    public static <T> EventPageResponse<T> from(Page<T> result) {
        return new EventPageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }
}

