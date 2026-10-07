package com.swp391.bookstreet.booth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "event_booth_configs", uniqueConstraints =
        @UniqueConstraint(name = "uk_event_booth_configs_event_booth",
                columnNames = {"event_id", "booth_id"}))
public class EventBoothConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_booth_config_id")
    private Long eventBoothConfigId;

    @Column(name = "event_id", nullable = false, updatable = false)
    private Long eventId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booth_id", nullable = false, updatable = false)
    private Booth booth;

    @Column(name = "rental_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal rentalPrice;

    @Column(name = "is_enabled", nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected EventBoothConfig() {
    }

    public static EventBoothConfig create(Long eventId, Booth booth, BigDecimal rentalPrice,
            boolean enabled, Instant now) {
        EventBoothConfig config = new EventBoothConfig();
        config.eventId = eventId;
        config.booth = booth;
        config.createdAt = now;
        config.update(rentalPrice, enabled, now);
        return config;
    }

    public void update(BigDecimal rentalPrice, boolean enabled, Instant now) {
        this.rentalPrice = rentalPrice;
        this.enabled = enabled;
        this.updatedAt = now;
    }

    public Long getEventBoothConfigId() {
        return eventBoothConfigId;
    }

    public Long getEventId() {
        return eventId;
    }

    public Booth getBooth() {
        return booth;
    }

    public BigDecimal getRentalPrice() {
        return rentalPrice;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
