package com.swp391.bookstreet.certificate.service;

import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class ParticipationDownstreamCommandTests {
    private static final Instant NOW = Instant.parse("2026-10-23T08:00:00Z");

    @Test
    void normalizesTransitionKey() {
        ParticipationDownstreamCommand command =
                new ParticipationDownstreamCommand(1L, " adjustment-123 ", NOW);
        assertThat(command.transitionKey()).isEqualTo("adjustment-123");
    }

    @Test
    void rejectsMissingOrOversizedBusinessIdentity() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ParticipationDownstreamCommand(null, "key", NOW));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ParticipationDownstreamCommand(1L, " ", NOW));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ParticipationDownstreamCommand(
                        1L, "x".repeat(141), NOW));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new ParticipationDownstreamCommand(1L, "key", null));
    }
}
