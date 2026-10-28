package com.swp391.bookstreet.reward.dto;

import java.util.List;

public record BoothScanResponse(
        BoothVisitResponse boothVisit,
        EventRegistrationAction eventRegistrationAction,
        int visitPoints,
        int newlyAwardedPoints,
        long totalPoints,
        boolean alreadyVisited,
        List<ParticipantBadgeResponse> newlyUnlockedBadges) {

    public BoothScanResponse {
        newlyUnlockedBadges = List.copyOf(newlyUnlockedBadges);
    }
}
