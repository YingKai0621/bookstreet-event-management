package com.swp391.bookstreet.booth.dto;

import com.swp391.bookstreet.booth.entity.Booth;
import java.math.BigDecimal;

public record BoothResponse(
        Long boothId,
        String code,
        String name,
        String description,
        Integer maxCapacity,
        BigDecimal mapX,
        BigDecimal mapY,
        boolean active,
        String categoryCode,
        String note,
        String imageUrl
) {
    public static BoothResponse from(Booth booth) {
        var location = booth.getLocation();
        return new BoothResponse(booth.getBoothId(), location.getCode(), location.getName(),
                location.getDescription(), location.getMaxCapacity(), location.getMapX(),
                location.getMapY(), location.isActive(), booth.getCategoryCode(), booth.getNote(),
                booth.getImageUrl());
    }
}
