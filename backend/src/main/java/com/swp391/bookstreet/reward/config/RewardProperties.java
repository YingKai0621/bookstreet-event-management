package com.swp391.bookstreet.reward.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "rewards")
public class RewardProperties {
    @NotNull
    @Min(1)
    private Integer boothVisitPoints;

    public int getBoothVisitPoints() {
        return boothVisitPoints;
    }

    public void setBoothVisitPoints(Integer boothVisitPoints) {
        this.boothVisitPoints = boothVisitPoints;
    }
}
