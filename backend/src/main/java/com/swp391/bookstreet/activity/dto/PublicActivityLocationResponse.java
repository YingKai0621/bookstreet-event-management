package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import java.math.BigDecimal;

public record PublicActivityLocationResponse(
        Long locationId,
        String code,
        String name,
        LocationType locationType,
        String description,
        Integer maxCapacity,
        BigDecimal mapX,
        BigDecimal mapY
) {
    public PublicActivityLocationResponse(Long locationId, String code, String name,
            LocationType locationType) {
        this(locationId, code, name, locationType, null, null, null, null);
    }

    public static PublicActivityLocationResponse from(Location location) {
        return new PublicActivityLocationResponse(location.getLocationId(), location.getCode(),
                location.getName(), location.getLocationType(), location.getDescription(),
                location.getMaxCapacity(), location.getMapX(), location.getMapY());
    }
}
