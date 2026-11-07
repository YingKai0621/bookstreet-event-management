package com.swp391.bookstreet.heritage.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record HeritagePageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <T> HeritagePageResponse<T> from(Page<T> result) {
        return new HeritagePageResponse<>(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }
}
