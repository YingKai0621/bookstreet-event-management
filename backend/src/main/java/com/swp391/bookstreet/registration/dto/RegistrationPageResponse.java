package com.swp391.bookstreet.registration.dto;

import java.util.List;

public record RegistrationPageResponse<T>(List<T> content, int page, int size,
        long totalElements, int totalPages) {
}
