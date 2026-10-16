package com.swp391.bookstreet.location.dto;

import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.entity.LocationType;
import java.math.BigDecimal;

public record LocationSummary(
        Long locationId,
        String code,
        String name,
        LocationType locationType,
        Integer maxCapacity,
        String description,
        BigDecimal mapX,
        BigDecimal mapY,
        boolean active,
        Long boothAssignmentId,
        boolean eligible,
        String ineligibleReason
) {
    public static LocationSummary shared(Location location, boolean eligible,
            String ineligibleReason) {
        return from(location, null, eligible, ineligibleReason);
    }

    public static LocationSummary assignedBooth(Location location, Long boothAssignmentId,
            boolean eligible, String ineligibleReason) {
        return from(location, boothAssignmentId, eligible, ineligibleReason);
    }

    private static LocationSummary from(Location location, Long boothAssignmentId,
            boolean eligible, String ineligibleReason) {
        return new LocationSummary(location.getLocationId(), location.getCode(),
                location.getName(), location.getLocationType(), location.getMaxCapacity(),
                location.getDescription(), location.getMapX(), location.getMapY(),
                location.isActive(), boothAssignmentId, eligible, ineligibleReason);
    }
}
