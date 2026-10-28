package com.swp391.bookstreet.reward.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.Map;
import java.util.Set;

public record AdminBadgeRequest(
        @NotNull(message = "REQUIRED") String name,
        String description,
        @NotNull(message = "REQUIRED") @Min(value = 1, message = "RANGE") Integer requiredPoints,
        String iconUrl,
        @NotNull(message = "REQUIRED") Boolean isActive) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static AdminBadgeRequest fromJson(Map<String, Object> fields) {
        if (!Set.of("name", "description", "requiredPoints", "iconUrl", "isActive").containsAll(fields.keySet())) {
            throw new IllegalArgumentException("Unknown Badge field.");
        }
        Object points = fields.get("requiredPoints");
        Object active = fields.get("isActive");
        // Do not silently truncate decimal thresholds or coerce strings into numbers/Booleans.
        if (points != null && !(points instanceof Integer)) throw new IllegalArgumentException("Invalid Badge field type.");
        if (active != null && !(active instanceof Boolean)) throw new IllegalArgumentException("Invalid Badge field type.");
        return new AdminBadgeRequest(text(fields.get("name")), text(fields.get("description")),
                (Integer) points, text(fields.get("iconUrl")), (Boolean) active);
    }

    private static String text(Object value) {
        if (value != null && !(value instanceof String)) throw new IllegalArgumentException("Invalid Badge field type.");
        return (String) value;
    }
}
