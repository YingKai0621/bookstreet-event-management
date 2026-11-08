package com.swp391.bookstreet.admin.dto;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

public record AdminPageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <S, T> AdminPageResponse<T> from(Page<S> page, Function<S, T> mapper) {
        return new AdminPageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }
}
