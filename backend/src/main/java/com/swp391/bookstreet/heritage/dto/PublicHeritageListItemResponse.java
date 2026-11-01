package com.swp391.bookstreet.heritage.dto;

import java.time.Instant;

public record PublicHeritageListItemResponse(
        String publicCode,
        String title,
        String summary,
        String imageUrl,
        String locationText,
        Instant publishedAt
) {
}
