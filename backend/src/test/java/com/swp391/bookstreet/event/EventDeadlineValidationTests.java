package com.swp391.bookstreet.event;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.event.service.EventValidation;
import java.time.Instant;
import java.util.function.BiConsumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import static org.assertj.core.api.Assertions.*;

class EventDeadlineValidationTests {
    private final EventValidation validation = new EventValidation();
    private static final Instant START = Instant.now().plusSeconds(86400 * 30);

    record Deadline(String field, BiConsumer<Event, Instant> setter) {}

    static Stream<Deadline> deadlines() {
        return Stream.of(
                new Deadline("partnerApplicationDeadlineAt", Event::setPartnerApplicationDeadlineAt),
                new Deadline("boothRequestDeadlineAt", Event::setBoothRequestDeadlineAt),
                new Deadline("activityProposalDeadlineAt", Event::setActivityProposalDeadlineAt),
                new Deadline("participantRegistrationDeadlineAt", Event::setParticipantRegistrationDeadlineAt),
                new Deadline("partnerWithdrawalCutoffAt", Event::setPartnerWithdrawalCutoffAt),
                new Deadline("boothCancellationCutoffAt", Event::setBoothCancellationCutoffAt),
                new Deadline("activityCancellationCutoffAt", Event::setActivityCancellationCutoffAt));
    }

    @ParameterizedTest
    @MethodSource("deadlines")
    void rejectsDeadlineAfterStartForSavingAndPublishing(Deadline deadline) {
        Event event = event();
        deadline.setter().accept(event, START.plusSeconds(1));
        assertInvalid(() -> validation.validate(event), deadline.field());
        assertInvalid(() -> validation.validateForPublish(event), deadline.field());
    }

    @ParameterizedTest
    @MethodSource("deadlines")
    void acceptsExactStartIncludingEquivalentTimezone(Deadline deadline) {
        Event event = event();
        deadline.setter().accept(event, START.atOffset(java.time.ZoneOffset.ofHours(7)).toInstant());
        assertThatCode(() -> validation.validate(event)).doesNotThrowAnyException();
        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
    }

    @Test
    void rejectsDownstreamDeadlinesBeforePartnerApplicationsClose() {
        Event event = event();
        event.setPartnerApplicationDeadlineAt(START.minusSeconds(100));
        event.setBoothRequestDeadlineAt(START.minusSeconds(101));
        assertInvalid(() -> validation.validate(event), "boothRequestDeadlineAt");
        event.setBoothRequestDeadlineAt(START.minusSeconds(100));
        event.setActivityProposalDeadlineAt(START.minusSeconds(101));
        assertInvalid(() -> validation.validateForPublish(event), "activityProposalDeadlineAt");
        event.setActivityProposalDeadlineAt(START.minusSeconds(100));
        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
    }

    @Test
    void cutoffCanBeAfterApplicationDeadlineAndMissingFieldsStayOptional() {
        Event event = event();
        assertThatCode(() -> validation.validate(event)).doesNotThrowAnyException();
        event.setPartnerApplicationDeadlineAt(START.minusSeconds(100));
        event.setPartnerWithdrawalCutoffAt(START.minusSeconds(50));
        event.setBoothCancellationCutoffAt(START);
        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
    }

    @Test
    void movingStartEarlierRevalidatesExistingDeadlines() {
        Event event = event();
        deadlines().forEach(d -> d.setter().accept(event, null));
        event.setParticipantRegistrationDeadlineAt(START.minusSeconds(10));
        event.setStartAt(START.minusSeconds(20));
        assertInvalid(() -> validation.validate(event), "participantRegistrationDeadlineAt");
    }

    private void assertInvalid(Runnable action, String field) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(EventException.class, error -> {
            assertThat(error.getStatus().value()).isEqualTo(422);
            assertThat(error.getCode()).isEqualTo("EVENT_TIME_INVALID");
            assertThat(error.getField()).isEqualTo(field);
        });
    }

    private Event event() {
        Event event = new Event();
        event.setName("Book Street");
        event.setStartAt(START);
        event.setEndAt(START.plusSeconds(3600));
        event.setBoothPaymentWindowMinutes(30);
        event.setMaxBoothsPerPartner(1);
        event.setMaxActivitiesPerPartner(5);
        deadlines().forEach(d -> d.setter().accept(event, START));
        return event;
    }
}
