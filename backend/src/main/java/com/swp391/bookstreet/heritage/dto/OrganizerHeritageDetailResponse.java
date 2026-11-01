package com.swp391.bookstreet.heritage.dto;

import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import java.time.Instant;

public record OrganizerHeritageDetailResponse(
        Long heritageContentId,
        String publicCode,
        String title,
        String summary,
        String content,
        String imageUrl,
        String locationText,
        HeritageContentStatus status,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
