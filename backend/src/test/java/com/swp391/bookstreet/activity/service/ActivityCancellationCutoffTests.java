package com.swp391.bookstreet.activity.service;

import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityCancellationCutoffTests {
    @Test
    void exactCutoffIsOnTimeAndOnlyLaterSubmissionIsLate() {
        Instant cutoff = Instant.parse("2027-01-10T13:00:00Z");

        assertThat(PartnerActivityCancellationRequestService.isLate(cutoff, cutoff))
                .isFalse();
        assertThat(PartnerActivityCancellationRequestService.isLate(
                cutoff.minusNanos(1), cutoff)).isFalse();
        assertThat(PartnerActivityCancellationRequestService.isLate(
                cutoff.plusNanos(1), cutoff)).isTrue();
    }
}
