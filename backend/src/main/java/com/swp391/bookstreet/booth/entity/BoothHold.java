package com.swp391.bookstreet.booth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "booth_holds")
public class BoothHold {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booth_hold_id")
    private Long boothHoldId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_booth_config_id", nullable = false, updatable = false)
    private EventBoothConfig eventBoothConfig;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booth_request_id", nullable = false, updatable = false, unique = true)
    private BoothRequest boothRequest;

    @Column(name = "locked_rental_price", nullable = false, precision = 14, scale = 2)
    private BigDecimal lockedRentalPrice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BoothHoldStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "released_at")
    private Instant releasedAt;

    protected BoothHold() {
    }

    public static BoothHold create(EventBoothConfig config, BoothRequest request,
            BigDecimal lockedRentalPrice, Instant createdAt, Instant expiresAt) {
        BoothHold hold = new BoothHold();
        hold.eventBoothConfig = config;
        hold.boothRequest = request;
        hold.lockedRentalPrice = lockedRentalPrice;
        hold.status = BoothHoldStatus.ACTIVE;
        hold.createdAt = createdAt;
        hold.expiresAt = expiresAt;
        request.attachHold(hold);
        return hold;
    }

    public boolean expire(Instant releasedAt) {
        if (status != BoothHoldStatus.ACTIVE || expiresAt.isAfter(releasedAt)) {
            return false;
        }
        status = BoothHoldStatus.EXPIRED;
        this.releasedAt = releasedAt;
        boothRequest.paymentExpired(releasedAt);
        return true;
    }

    public void consume(Instant consumedAt) {
        if (status != BoothHoldStatus.ACTIVE) {
            throw new IllegalStateException("Only an Active Booth Hold can be consumed.");
        }
        status = BoothHoldStatus.CONSUMED;
        this.consumedAt = consumedAt;
    }

    public boolean release(Instant releasedAt) {
        if (status != BoothHoldStatus.ACTIVE) {
            return false;
        }
        status = BoothHoldStatus.RELEASED;
        this.releasedAt = releasedAt;
        return true;
    }

    public Long getBoothHoldId() {
        return boothHoldId;
    }

    public EventBoothConfig getEventBoothConfig() {
        return eventBoothConfig;
    }

    public BoothRequest getBoothRequest() {
        return boothRequest;
    }

    public BigDecimal getLockedRentalPrice() {
        return lockedRentalPrice;
    }

    public BoothHoldStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getConsumedAt() {
        return consumedAt;
    }

    public Instant getReleasedAt() {
        return releasedAt;
    }
}
