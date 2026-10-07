package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.exception.EventException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * UC-O01 scheduling validation. See the deadline policy in the Sprint 1 API contract.
 */
@Component
public class EventValidation {
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
        publishDeadline(event.getBoothRequestDeadlineAt(), "boothRequestDeadlineAt", now);
        publishDeadline(event.getActivityProposalDeadlineAt(), "activityProposalDeadlineAt", now);
        publishDeadline(event.getParticipantRegistrationDeadlineAt(), "participantRegistrationDeadlineAt", now);
        publishDeadline(event.getPartnerWithdrawalCutoffAt(), "partnerWithdrawalCutoffAt", now);
        publishDeadline(event.getBoothCancellationCutoffAt(), "boothCancellationCutoffAt", now);
        publishDeadline(event.getActivityCancellationCutoffAt(), "activityCancellationCutoffAt", now);
        validateValues(event);
        require(event.getStartAt().isAfter(now), "EVENT_TIME_INVALID", "startAt",
                "Event must start after publication time.");
    }

    private void publishDeadline(Instant value, String field, Instant now) {
        require(value != null, "EVENT_INCOMPLETE_FOR_PUBLISH", field,
                field + " is required before publication.");
        require(value.isAfter(now), "EVENT_TIME_INVALID", field,
                field + " must be after publication time.");
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
        noLaterThan(event.getPartnerWithdrawalCutoffAt(), start, "partnerWithdrawalCutoffAt", "startAt");
        noLaterThan(event.getBoothCancellationCutoffAt(), start, "boothCancellationCutoffAt", "startAt");
        noLaterThan(event.getActivityCancellationCutoffAt(), start, "activityCancellationCutoffAt", "startAt");

        noEarlierThanApplication(event.getBoothRequestDeadlineAt(), event.getPartnerApplicationDeadlineAt(),
                "boothRequestDeadlineAt");
        noEarlierThanApplication(event.getActivityProposalDeadlineAt(), event.getPartnerApplicationDeadlineAt(),
                "activityProposalDeadlineAt");
    }

    private void noLaterThan(Instant value, Instant limit, String field, String limitField) {
        if (value != null && limit != null) {
            require(!value.isAfter(limit), "EVENT_TIME_INVALID", field,
                    field + " must not be after " + limitField + ".");
        }
    }

    private void noEarlierThanApplication(Instant value, Instant applicationDeadline, String field) {
        if (value != null && applicationDeadline != null) {
            require(!value.isBefore(applicationDeadline), "EVENT_TIME_INVALID", field,
                    field + " must not be before partnerApplicationDeadlineAt.");
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

