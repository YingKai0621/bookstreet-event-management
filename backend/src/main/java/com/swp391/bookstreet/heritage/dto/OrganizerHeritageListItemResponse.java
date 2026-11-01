package com.swp391.bookstreet.heritage.dto;

import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import java.time.Instant;

public record OrganizerHeritageListItemResponse(
        Long heritageContentId,
        String publicCode,
        String title,
        String summary,
        String imageUrl,
        String locationText,
        HeritageContentStatus status,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
