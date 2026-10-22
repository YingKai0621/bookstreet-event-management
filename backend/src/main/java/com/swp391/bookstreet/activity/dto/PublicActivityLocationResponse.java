package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;

public record PublicActivityLocationResponse(
        Long locationId,
        String code,
        String name,
        LocationType locationType
) {
    public static PublicActivityLocationResponse from(Location location) {
        return new PublicActivityLocationResponse(location.getLocationId(), location.getCode(),
                location.getName(), location.getLocationType());
    }
}
