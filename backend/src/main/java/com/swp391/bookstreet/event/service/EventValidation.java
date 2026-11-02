package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.exception.EventException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * UC-O01 scheduling validation. See the deadline policy in the Sprint 1 API contract.
 */
@Component
public class EventValidation {
    private static final long MIN_PARTNER_REVIEW_HOURS = 24;
    private static final long MIN_BOOTH_SETUP_MINUTES = 24 * 60;
    private static final Set<String> PUBLICATION_TIMELINE_FIELDS = Set.of(
            "startAt",
            "partnerApplicationDeadlineAt",
            "boothRequestDeadlineAt",
            "activityProposalDeadlineAt",
            "participantRegistrationDeadlineAt",
            "boothPaymentWindowMinutes",
            "maxBoothsPerPartner",
            "maxActivitiesPerPartner");

    public void validate(Event event) {
        validateRequired(event, "EVENT_CONFIGURATION_INVALID");
        validateValues(event);
    }

    public void validateForPublish(Event event) {
        validateForPublish(event, Instant.now());
    }

    void validateForPublish(Event event, Instant now) {
        validateRequired(event, "EVENT_INCOMPLETE_FOR_PUBLISH");
        publishDeadline(event.getPartnerApplicationDeadlineAt(), "partnerApplicationDeadlineAt", now);
        publishDeadline(event.getParticipantRegistrationDeadlineAt(), "participantRegistrationDeadlineAt", now);
        if (boothsEnabled(event)) {
            publishDeadline(event.getBoothRequestDeadlineAt(), "boothRequestDeadlineAt", now);
        }
        if (partnerActivitiesEnabled(event)) {
            publishDeadline(event.getActivityProposalDeadlineAt(), "activityProposalDeadlineAt", now);
        }
        validateValues(event);
        validatePublicationTimeline(event);
        if (boothsEnabled(event)) validateBoothPaymentBoundary(event);
        require(event.getStartAt().isAfter(now), "EVENT_TIME_INVALID", "startAt",
                "Event must start after publication time.");
    }

    void validateForOperationalUpdate(Event event, Set<String> suppliedFields, Instant now) {
        validateRequired(event, "EVENT_CONFIGURATION_INVALID");
        validatePublishedDeadlinesPresent(event);
        validateValues(event);
        if (suppliedFields.stream().anyMatch(PUBLICATION_TIMELINE_FIELDS::contains)) {
            validatePublicationTimeline(event);
        }
        if (boothsEnabled(event)) validateBoothPaymentBoundary(event);
        require(event.getStartAt().isAfter(now), "EVENT_TIME_INVALID", "startAt",
                "Event must start after operational update time.");

        validateSuppliedDeadline(event.getPartnerApplicationDeadlineAt(),
                "partnerApplicationDeadlineAt", suppliedFields, now);
        if (boothsEnabled(event)) {
            validateSuppliedDeadline(event.getBoothRequestDeadlineAt(),
                    "boothRequestDeadlineAt", suppliedFields, now);
        }
        if (partnerActivitiesEnabled(event)) {
            validateSuppliedDeadline(event.getActivityProposalDeadlineAt(),
                    "activityProposalDeadlineAt", suppliedFields, now);
        }
        validateSuppliedDeadline(event.getParticipantRegistrationDeadlineAt(),
                "participantRegistrationDeadlineAt", suppliedFields, now);
    }

    void validateBoothPaymentBoundary(Event event) {
        try {
            Instant paymentDeadline = event.getBoothRequestDeadlineAt().plus(
                    event.getBoothPaymentWindowMinutes() + MIN_BOOTH_SETUP_MINUTES,
                    ChronoUnit.MINUTES);
            require(!paymentDeadline.isAfter(event.getStartAt()),
                    "EVENT_TIME_INVALID", "boothPaymentWindowMinutes",
                    "Booth request deadline plus payment window must leave at least 24 hours "
                            + "for setup before event start time.");
        } catch (DateTimeException | ArithmeticException error) {
            require(false, "EVENT_TIME_INVALID", "boothPaymentWindowMinutes",
                    "Booth request deadline, payment window and setup time are outside "
                            + "the supported time range.");
        }
    }

    private void publishDeadline(Instant value, String field, Instant now) {
        require(value != null, "EVENT_INCOMPLETE_FOR_PUBLISH", field,
                field + " is required before publication.");
        require(value.isAfter(now), "EVENT_TIME_INVALID", field,
                field + " must be after publication time.");
    }

    private void validatePublishedDeadlinesPresent(Event event) {
        requirePresent(event.getPartnerApplicationDeadlineAt(), "partnerApplicationDeadlineAt");
        requirePresent(event.getParticipantRegistrationDeadlineAt(),
                "participantRegistrationDeadlineAt");
        if (boothsEnabled(event)) {
            requirePresent(event.getBoothRequestDeadlineAt(), "boothRequestDeadlineAt");
        }
        if (partnerActivitiesEnabled(event)) {
            requirePresent(event.getActivityProposalDeadlineAt(), "activityProposalDeadlineAt");
        }
    }

    private void requirePresent(Instant value, String field) {
        require(value != null, "EVENT_CONFIGURATION_INVALID", field,
                field + " cannot be cleared after publication.");
    }

    private void validateSuppliedDeadline(Instant value, String field,
            Set<String> suppliedFields, Instant now) {
        if (suppliedFields.contains(field)) {
            require(value != null, "EVENT_CONFIGURATION_INVALID", field,
                    field + " cannot be cleared after publication.");
            require(value.isAfter(now), "EVENT_TIME_INVALID", field,
                    field + " must remain after operational update time.");
        }
    }

    private void validateRequired(Event event, String code) {
        require(event.getName() != null && !event.getName().isBlank(), code,
                "name", "Event name is required.");
        require(event.getStartAt() != null, code, "startAt", "Start time is required.");
        require(event.getEndAt() != null, code, "endAt", "End time is required.");
        require(event.getBoothPaymentWindowMinutes() != null, code,
                "boothPaymentWindowMinutes", "Payment window is required.");
        require(event.getMaxBoothsPerPartner() != null, code,
                "maxBoothsPerPartner", "Booth limit is required.");
        require(event.getMaxActivitiesPerPartner() != null, code,
                "maxActivitiesPerPartner", "Activity limit is required.");
    }

    private void validateValues(Event event) {
        require(event.getName().codePointCount(0, event.getName().length()) <= 150,
                "EVENT_CONFIGURATION_INVALID", "name", "Event name must not exceed 150 characters.");
        require(event.getEndAt().isAfter(event.getStartAt()), "EVENT_TIME_INVALID",
                "endAt", "End time must be after start time.");
        require(event.getBoothPaymentWindowMinutes() >= 60
                        && event.getBoothPaymentWindowMinutes() <= 10080,
                "EVENT_CONFIGURATION_INVALID", "boothPaymentWindowMinutes",
                "Payment window must be between 60 and 10080 minutes.");
        nonNegative(event.getMaxBoothsPerPartner(), "maxBoothsPerPartner");
        nonNegative(event.getMaxActivitiesPerPartner(), "maxActivitiesPerPartner");
        validateDeadlines(event);
    }

    private void validateDeadlines(Event event) {
        Instant start = event.getStartAt();
        noLaterThan(event.getPartnerApplicationDeadlineAt(), start, "partnerApplicationDeadlineAt", "startAt");
        noLaterThan(event.getBoothRequestDeadlineAt(), start, "boothRequestDeadlineAt", "startAt");
        noLaterThan(event.getActivityProposalDeadlineAt(), start, "activityProposalDeadlineAt", "startAt");
        noLaterThan(event.getParticipantRegistrationDeadlineAt(), start, "participantRegistrationDeadlineAt", "startAt");
    }

    private void validatePublicationTimeline(Event event) {
        if (boothsEnabled(event)) {
            requireMinimumPartnerReviewWindow(event.getBoothRequestDeadlineAt(),
                    event.getPartnerApplicationDeadlineAt(), "boothRequestDeadlineAt");
        }
        if (partnerActivitiesEnabled(event)) {
            requireMinimumPartnerReviewWindow(event.getActivityProposalDeadlineAt(),
                    event.getPartnerApplicationDeadlineAt(), "activityProposalDeadlineAt");
        }
        require(event.getParticipantRegistrationDeadlineAt().isBefore(event.getStartAt()),
                "EVENT_TIME_INVALID", "participantRegistrationDeadlineAt",
                "Participant registration deadline must be before event start time.");
    }

    private void requireMinimumPartnerReviewWindow(Instant downstreamDeadline,
            Instant applicationDeadline, String field) {
        try {
            Instant earliest = applicationDeadline.plus(MIN_PARTNER_REVIEW_HOURS,
                    ChronoUnit.HOURS);
            require(!downstreamDeadline.isBefore(earliest), "EVENT_TIME_INVALID", field,
                    field + " must be at least 24 hours after partnerApplicationDeadlineAt.");
        } catch (DateTimeException | ArithmeticException error) {
            require(false, "EVENT_TIME_INVALID", field,
                    field + " is outside the supported time range.");
        }
    }

    private static boolean boothsEnabled(Event event) {
        return event.getMaxBoothsPerPartner() != null && event.getMaxBoothsPerPartner() > 0;
    }

    private static boolean partnerActivitiesEnabled(Event event) {
        return event.getMaxActivitiesPerPartner() != null
                && event.getMaxActivitiesPerPartner() > 0;
    }

    private void noLaterThan(Instant value, Instant limit, String field, String limitField) {
        if (value != null && limit != null) {
            require(!value.isAfter(limit), "EVENT_TIME_INVALID", field,
                    field + " must not be after " + limitField + ".");
        }
    }

    private void nonNegative(Integer value, String field) {
        require(value >= 0, "EVENT_CONFIGURATION_INVALID", field, "Value must be non-negative.");
    }

    private void require(boolean valid, String code, String field, String message) {
        if (!valid) {
            throw new EventException(HttpStatus.UNPROCESSABLE_CONTENT, code, message, field);
        }
    }
}

