package com.swp391.bookstreet.location.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

public class UpdateLocationRequest {
    @JsonIgnore
    private final Set<String> suppliedFields = new HashSet<>();

    @Size(max = 30)
    private String code;
    @Size(max = 100)
    private String name;
    @Size(max = 5000)
    private String description;
    @Positive
    private Integer maxCapacity;
    @Digits(integer = 3, fraction = 2)
    @DecimalMin("0.00")
    @DecimalMax("100.00")
    private BigDecimal mapX;
    @Digits(integer = 3, fraction = 2)
    @DecimalMin("0.00")
    @DecimalMax("100.00")
    private BigDecimal mapY;
    private Boolean active;

    public boolean contains(String field) {
        return suppliedFields.contains(field);
    }

    @JsonIgnore
    public boolean isEmpty() {
        return suppliedFields.isEmpty();
    }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Location field: " + field);
    }

    public String getCode() { return code; }
    @JsonSetter("code") public void setCode(String value) { suppliedFields.add("code"); code = value; }

    public String getName() { return name; }
    @JsonSetter("name") public void setName(String value) { suppliedFields.add("name"); name = value; }

    public String getDescription() { return description; }
    @JsonSetter("description") public void setDescription(String value) {
        suppliedFields.add("description");
        description = value;
    }

    public Integer getMaxCapacity() { return maxCapacity; }
    @JsonSetter("maxCapacity") public void setMaxCapacity(Integer value) {
        suppliedFields.add("maxCapacity");
        maxCapacity = value;
    }

    public BigDecimal getMapX() { return mapX; }
    @JsonSetter("mapX") public void setMapX(BigDecimal value) {
        suppliedFields.add("mapX");
        mapX = value;
    }

    public BigDecimal getMapY() { return mapY; }
    @JsonSetter("mapY") public void setMapY(BigDecimal value) {
        suppliedFields.add("mapY");
        mapY = value;
    }

    public Boolean getActive() { return active; }
    @JsonSetter("active") public void setActive(Boolean value) {
        suppliedFields.add("active");
        active = value;
    }
}
