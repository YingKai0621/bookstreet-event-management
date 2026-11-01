package com.swp391.bookstreet.heritage.dto;

import java.time.Instant;

public record PublicHeritageDetailResponse(
        String publicCode,
        String title,
        String summary,
        String content,
        String imageUrl,
        String locationText,
        Instant publishedAt
) {
}
