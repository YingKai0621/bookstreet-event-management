package com.swp391.bookstreet.registration.entity;

import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RegistrationEntityTests {
    private static final Instant FIRST_ACTIVATION = Instant.parse("2026-10-19T09:00:00Z");
    private static final Instant LATER = Instant.parse("2026-10-19T10:00:00Z");
    private static final Instant LATEST = Instant.parse("2026-10-19T11:00:00Z");

    @Test
    void eventRegistrationReusesIdentityWhenParticipantJoinsAgain() {
        EventRegistration registration = EventRegistration.join(11L, 21L, FIRST_ACTIVATION);

        assertThat(registration.leave(LATER)).isTrue();
        assertThat(registration.reactivate(LATEST)).isTrue();

        assertThat(registration.getStatus()).isEqualTo(EventRegistrationStatus.ACTIVE);
        assertThat(registration.getRegisteredAt()).isEqualTo(FIRST_ACTIVATION);
        assertThat(registration.getActivatedAt()).isEqualTo(LATEST);
        assertThat(registration.getLeftAt()).isNull();
        assertThat(registration.getUpdatedAt()).isEqualTo(LATEST);
    }

    @Test
    void eventRegistrationRejectsHistoryThatMovesBackwards() {
        EventRegistration registration = EventRegistration.join(11L, 21L, LATER);

        assertThatThrownBy(() -> registration.leave(FIRST_ACTIVATION))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("before activatedAt");
    }

    @Test
    void activityRegistrationReactivatesOnlyParticipantCancellation() {
        ActivityRegistration registration = ActivityRegistration.register(
                31L, 41L, FIRST_ACTIVATION);
        registration.cancel(ActivityRegistrationCancellationSource.PARTICIPANT, LATER);

        assertThat(registration.reactivateParticipantCancellation(LATEST)).isTrue();

        assertThat(registration.getStatus()).isEqualTo(ActivityRegistrationStatus.ACTIVE);
        assertThat(registration.getCancellationSource()).isNull();
        assertThat(registration.getCancelledAt()).isNull();
        assertThat(registration.getActivatedAt()).isEqualTo(LATEST);
        assertThat(registration.getRegisteredAt()).isEqualTo(FIRST_ACTIVATION);
    }

    @Test
    void activityRegistrationRejectsReactivationAfterSystemCancellation() {
        ActivityRegistration registration = ActivityRegistration.register(
                31L, 41L, FIRST_ACTIVATION);
        registration.cancel(ActivityRegistrationCancellationSource.ACTIVITY, LATER);

        assertThatThrownBy(() -> registration.reactivateParticipantCancellation(LATEST))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Participant-cancelled");
    }

    @Test
    void noShowIsTerminalAndCannotBecomeCancelled() {
        ActivityRegistration registration = ActivityRegistration.register(
                31L, 41L, FIRST_ACTIVATION);
        registration.markNoShow(LATER);

        assertThatThrownBy(() -> registration.cancel(
                ActivityRegistrationCancellationSource.PARTICIPANT, LATEST))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Active registration");
    }
}
