package com.swp391.bookstreet.activity.dto;

import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;

public record ActivityLocationResponse(Long locationId, String code, String name,
        LocationType locationType, Integer maxCapacity, boolean active) {
    public static ActivityLocationResponse from(Location location) {
        return new ActivityLocationResponse(location.getLocationId(), location.getCode(),
                location.getName(), location.getLocationType(), location.getMaxCapacity(),
                location.isActive());
    }
}
