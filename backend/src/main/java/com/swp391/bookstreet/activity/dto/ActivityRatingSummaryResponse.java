package com.swp391.bookstreet.activity.dto;

import java.math.BigDecimal;

public record ActivityRatingSummaryResponse(BigDecimal averageScore, long ratingCount) {
    public static ActivityRatingSummaryResponse empty() {
        return new ActivityRatingSummaryResponse(null, 0);
    }
}
