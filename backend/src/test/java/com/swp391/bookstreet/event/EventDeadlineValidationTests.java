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

    static Stream<Deadline> activeDeadlines() {
        return Stream.of(
                new Deadline("partnerApplicationDeadlineAt", Event::setPartnerApplicationDeadlineAt),
                new Deadline("boothRequestDeadlineAt", Event::setBoothRequestDeadlineAt),
                new Deadline("activityProposalDeadlineAt", Event::setActivityProposalDeadlineAt),
                new Deadline("participantRegistrationDeadlineAt", Event::setParticipantRegistrationDeadlineAt));
    }

    @ParameterizedTest
    @MethodSource("activeDeadlines")
    void rejectsDeadlineAfterStartForSavingAndPublishing(Deadline deadline) {
        Event event = event();
        deadline.setter().accept(event, START.plusSeconds(1));
        assertInvalid(() -> validation.validate(event), deadline.field());
        assertInvalid(() -> validation.validateForPublish(event), deadline.field());
    }

    @ParameterizedTest
    @MethodSource("activeDeadlines")
    void draftAcceptsExactStartIncludingEquivalentTimezone(Deadline deadline) {
        Event event = event();
        deadline.setter().accept(event, START.atOffset(java.time.ZoneOffset.ofHours(7)).toInstant());
        assertThatCode(() -> validation.validate(event)).doesNotThrowAnyException();
    }

    @Test
    void draftAllowsContradictoryDownstreamDeadlineButPublicationRequiresReviewWindow() {
        Event event = event();
        Instant partnerDeadline = START.minusSeconds(72 * 3600);
        event.setPartnerApplicationDeadlineAt(partnerDeadline);
        event.setBoothRequestDeadlineAt(partnerDeadline.minusSeconds(1));
        assertThatCode(() -> validation.validate(event)).doesNotThrowAnyException();
        assertInvalid(() -> validation.validateForPublish(event), "boothRequestDeadlineAt");

        event.setBoothRequestDeadlineAt(partnerDeadline.plusSeconds(24 * 3600 - 1));
        assertInvalid(() -> validation.validateForPublish(event), "boothRequestDeadlineAt");
        event.setBoothRequestDeadlineAt(partnerDeadline.plusSeconds(24 * 3600));

        event.setActivityProposalDeadlineAt(partnerDeadline.plusSeconds(24 * 3600 - 1));
        assertInvalid(() -> validation.validateForPublish(event), "activityProposalDeadlineAt");
        event.setActivityProposalDeadlineAt(partnerDeadline.plusSeconds(24 * 3600));
        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
    }

    @Test
    void legacyCutoffsAreNotRequiredForPublication() {
        Event event = event();
        event.setPartnerWithdrawalCutoffAt(null);
        event.setBoothCancellationCutoffAt(null);
        event.setActivityCancellationCutoffAt(null);

        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
    }

    @Test
    void participantDeadlineAtStartCanBeSavedAsDraftButCannotBePublished() {
        Event participantTimeline = event();
        participantTimeline.setParticipantRegistrationDeadlineAt(participantTimeline.getStartAt());
        assertThatCode(() -> validation.validate(participantTimeline)).doesNotThrowAnyException();
        assertInvalid(() -> validation.validateForPublish(participantTimeline), "participantRegistrationDeadlineAt");
    }

    @Test
    void movingStartEarlierRevalidatesExistingDeadlines() {
        Event event = event();
        activeDeadlines().forEach(d -> d.setter().accept(event, null));
        event.setParticipantRegistrationDeadlineAt(START.minusSeconds(10));
        event.setStartAt(START.minusSeconds(20));
        assertInvalid(() -> validation.validate(event), "participantRegistrationDeadlineAt");
    }

    @Test
    void publicationRequiresPaymentAndSetupToFinishAtLeastOneDayBeforeStart() {
        Event event = event();
        event.setBoothPaymentWindowMinutes(60);
        event.setBoothRequestDeadlineAt(START.minusSeconds(25 * 3600 - 1));
        assertThatCode(() -> validation.validate(event)).doesNotThrowAnyException();
        assertInvalid(() -> validation.validateForPublish(event), "boothPaymentWindowMinutes");

        event.setBoothRequestDeadlineAt(START.minusSeconds(25 * 3600));
        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
    }

    @Test
    void disabledPartnerFlowsDoNotRequireTheirDeadlines() {
        Event event = event();
        event.setMaxBoothsPerPartner(0);
        event.setMaxActivitiesPerPartner(0);
        event.setBoothRequestDeadlineAt(null);
        event.setActivityProposalDeadlineAt(null);

        assertThatCode(() -> validation.validateForPublish(event)).doesNotThrowAnyException();
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
        event.setBoothPaymentWindowMinutes(60);
        event.setMaxBoothsPerPartner(1);
        event.setMaxActivitiesPerPartner(5);
        event.setPartnerApplicationDeadlineAt(START.minusSeconds(72 * 3600));
        event.setBoothRequestDeadlineAt(START.minusSeconds(48 * 3600));
        event.setActivityProposalDeadlineAt(START.minusSeconds(48 * 3600));
        event.setParticipantRegistrationDeadlineAt(START.minusSeconds(3_600));
        return event;
    }
}
