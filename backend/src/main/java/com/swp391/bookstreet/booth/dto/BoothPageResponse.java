package com.swp391.bookstreet.booth.dto;

import java.util.List;
import org.springframework.data.domain.Page;

public record BoothPageResponse<T>(List<T> content, int page, int size,
        long totalElements, int totalPages) {
    public static <T> BoothPageResponse<T> from(Page<T> result) {
        return new BoothPageResponse<>(result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    public static <T> BoothPageResponse<T> of(List<T> content, int page, int size,
            long totalElements) {
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / size);
        return new BoothPageResponse<>(content, page, size, totalElements, totalPages);
    }
}
