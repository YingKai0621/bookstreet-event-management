package com.swp391.bookstreet.booth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "locations")
public class Location {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "location_id")
    private Long locationId;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "location_type", nullable = false, length = 30)
    private LocationType locationType;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "max_capacity", nullable = false)
    private Integer maxCapacity;

    @Column(name = "map_x", precision = 10, scale = 2)
    private BigDecimal mapX;

    @Column(name = "map_y", precision = 10, scale = 2)
    private BigDecimal mapY;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Location() {
    }

    public static Location createBooth(String code, String name, String description,
            Integer maxCapacity, BigDecimal mapX, BigDecimal mapY, Instant now) {
        Location location = new Location();
        location.code = code;
        location.locationType = LocationType.BOOTH;
        location.active = true;
        location.createdAt = now;
        location.update(name, description, maxCapacity, mapX, mapY, true, now);
        return location;
    }

    public static Location createShared(String code, String name, LocationType locationType,
            String description, Integer maxCapacity, BigDecimal mapX, BigDecimal mapY,
            Instant now) {
        if (locationType == null || locationType == LocationType.BOOTH) {
            throw new IllegalArgumentException("A shared Location cannot use type BOOTH.");
        }
        Location location = new Location();
        location.code = code;
        location.locationType = locationType;
        location.active = true;
        location.createdAt = now;
        location.update(name, description, maxCapacity, mapX, mapY, true, now);
        return location;
    }

    public void update(String name, String description, Integer maxCapacity,
            BigDecimal mapX, BigDecimal mapY, boolean active, Instant now) {
        this.name = name;
        this.description = description;
        this.maxCapacity = maxCapacity;
        this.mapX = mapX;
        this.mapY = mapY;
        this.active = active;
        this.updatedAt = now;
    }

    public Long getLocationId() {
        return locationId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public LocationType getLocationType() {
        return locationType;
    }

    public String getDescription() {
        return description;
    }

    public Integer getMaxCapacity() {
        return maxCapacity;
    }

    public BigDecimal getMapX() {
        return mapX;
    }

    public BigDecimal getMapY() {
        return mapY;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
