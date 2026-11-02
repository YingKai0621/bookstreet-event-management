package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.exception.EventException;
import java.time.Instant;
import java.util.function.BiConsumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import static org.assertj.core.api.Assertions.*;

class EventPublicationTests {
    private final EventValidation validation = new EventValidation();
    private static final Instant NOW = Instant.parse("2030-01-01T00:00:00Z");
    record Deadline(String field, BiConsumer<Event, Instant> set) {}
    static Stream<Deadline> requiredDeadlines() {
        return Stream.of(
            new Deadline("partnerApplicationDeadlineAt", Event::setPartnerApplicationDeadlineAt),
            new Deadline("boothRequestDeadlineAt", Event::setBoothRequestDeadlineAt),
            new Deadline("activityProposalDeadlineAt", Event::setActivityProposalDeadlineAt),
            new Deadline("participantRegistrationDeadlineAt", Event::setParticipantRegistrationDeadlineAt));
    }
    @ParameterizedTest @MethodSource("requiredDeadlines")
    void missingDeadlineIsAllowedInDraftButNotPublication(Deadline d) {
        Event e = complete();
        d.set().accept(e, null);
        assertThatCode(() -> validation.validate(e)).doesNotThrowAnyException();
        assertError(e, "EVENT_INCOMPLETE_FOR_PUBLISH", d.field());
    }
    @ParameterizedTest @MethodSource("requiredDeadlines")
    void expiredAndExactNowDeadlineCannotBePublished(Deadline d) {
        Event e = complete();
        d.set().accept(e, NOW.minusSeconds(1));
        assertError(e, "EVENT_TIME_INVALID", d.field());
        d.set().accept(e, NOW);
        assertError(e, "EVENT_TIME_INVALID", d.field());
    }
    @Test
    void completeFutureScheduleAndOptionalPresentationFieldsAreAccepted() {
        assertThatCode(() -> validation.validateForPublish(complete(), NOW)).doesNotThrowAnyException();
    }
    @Test
    void paymentWindowMayEndExactlyOneDayBeforeEventStart() {
        Event event = complete();
        event.setBoothRequestDeadlineAt(event.getStartAt().minusSeconds(25 * 3600));

        assertThatCode(() -> validation.validateForPublish(event, NOW)).doesNotThrowAnyException();
    }
    @Test
    void paymentWindowMustLeaveOneFullSetupDayBeforeEventStart() {
        Event event = complete();
        event.setBoothRequestDeadlineAt(event.getStartAt().minusSeconds(25 * 3600 - 1));

        assertError(event, "EVENT_TIME_INVALID", "boothPaymentWindowMinutes");
    }
    @Test
    void timePassingBetweenDraftSaveAndPublishClosesPublication() {
        Event e = complete();
        validation.validate(e);
        assertThatThrownBy(() -> validation.validateForPublish(e, NOW.plusSeconds(24 * 3600)))
            .isInstanceOf(EventException.class);
    }
    @Test
    void legacyCutoffsAreOptionalAndDisabledFlowsDoNotRequireTheirDeadlines() {
        Event e = complete();
        e.setPartnerWithdrawalCutoffAt(null);
        e.setBoothCancellationCutoffAt(null);
        e.setActivityCancellationCutoffAt(null);
        e.setMaxBoothsPerPartner(0);
        e.setMaxActivitiesPerPartner(0);
        e.setBoothRequestDeadlineAt(null);
        e.setActivityProposalDeadlineAt(null);

        assertThatCode(() -> validation.validateForPublish(e, NOW)).doesNotThrowAnyException();
    }
    private void assertError(Event e, String code, String field) {
        assertThatThrownBy(() -> validation.validateForPublish(e, NOW))
            .isInstanceOfSatisfying(EventException.class, error -> {
                assertThat(error.getStatus().value()).isEqualTo(422);
                assertThat(error.getCode()).isEqualTo(code);
                assertThat(error.getField()).isEqualTo(field);
            });
    }
    private Event complete() {
        Event e = new Event();
        e.setName("Publication test");
        e.setStartAt(NOW.plusSeconds(10 * 24 * 3600));
        e.setEndAt(NOW.plusSeconds(11 * 24 * 3600));
        e.setBoothPaymentWindowMinutes(60);
        e.setMaxBoothsPerPartner(1);
        e.setMaxActivitiesPerPartner(1);
        e.setPartnerApplicationDeadlineAt(NOW.plusSeconds(24 * 3600));
        e.setBoothRequestDeadlineAt(NOW.plusSeconds(2 * 24 * 3600));
        e.setActivityProposalDeadlineAt(NOW.plusSeconds(2 * 24 * 3600));
        e.setParticipantRegistrationDeadlineAt(NOW.plusSeconds(9 * 24 * 3600));
        return e;
    }
}
