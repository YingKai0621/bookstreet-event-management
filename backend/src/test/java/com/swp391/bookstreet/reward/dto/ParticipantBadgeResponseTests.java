package com.swp391.bookstreet.reward.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import org.junit.jupiter.api.Test;

class ParticipantBadgeResponseTests {
    @Test
    void calculatesFloorPercentageWithoutOverflow() {
        assertThat(ParticipantBadgeResponse.calculateProgressPercent(3, 10)).isEqualTo(30);
        assertThat(ParticipantBadgeResponse.calculateProgressPercent(
                2_000_000_000L, Integer.MAX_VALUE)).isEqualTo(93);
        assertThat(ParticipantBadgeResponse.calculateProgressPercent(
                Long.MAX_VALUE, Integer.MAX_VALUE)).isEqualTo(100);
    }

    @Test
    void rejectsInvalidInputs() {
        assertThatIllegalArgumentException().isThrownBy(
                () -> ParticipantBadgeResponse.calculateProgressPercent(-1, 10));
        assertThatIllegalArgumentException().isThrownBy(
                () -> ParticipantBadgeResponse.calculateProgressPercent(0, 0));
    }
}
