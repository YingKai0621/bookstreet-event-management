package com.swp391.bookstreet.certificate.dto;

import java.util.List;

public record CertificatePageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {}
