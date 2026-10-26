package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.event.entity.Event;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ActivityValidationService {
    private final Clock clock;

    public ActivityValidationService(Clock clock) {
        this.clock = clock;
    }

    public ValidatedActivityFields validateCore(Event event, Location location, String title,
            String description, String activityType, Instant startAt, Instant endAt,
            Integer capacity, String imageUrl, boolean futureStartRequired) {
        requireActive(location);
        validateTime(event, startAt, endAt, futureStartRequired);
        validateCapacity(location, capacity);
        return new ValidatedActivityFields(
                requiredCollapsedText(title, "title", 200),
                optionalText(description, "description", 5000),
                requiredCollapsedText(activityType, "activityType", 50),
                startAt,
                endAt,
                capacity,
                optionalHttpUri(imageUrl));
    }

    public void requireActive(Location location) {
        if (location == null || !location.isActive()) {
            throw new ActivityApiException(HttpStatus.CONFLICT, "LOCATION_NOT_ACTIVE",
                    "Location is not active.");
        }
    }

    public void validateTime(Event event, Instant startAt, Instant endAt,
            boolean futureStartRequired) {
        if (startAt == null || endAt == null || !startAt.isBefore(endAt)
                || (futureStartRequired && !startAt.isAfter(clock.instant()))) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_TIME_INVALID",
                    "Activity start and end time are invalid.", "startAt");
        }
        if (event == null || startAt.isBefore(event.getStartAt())
                || endAt.isAfter(event.getEndAt())) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_TIME_OUTSIDE_EVENT",
                    "Activity interval must be within the Event interval.", "startAt");
        }
    }

    public void validateCapacity(Location location, Integer capacity) {
        if (capacity == null || capacity <= 0 || capacity > location.getMaxCapacity()) {
            throw new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT,
                    "ACTIVITY_CAPACITY_INVALID",
                    "Activity capacity must be positive and not exceed Location capacity.",
                    "capacity");
        }
    }

    public String reviewNote(String value) {
        return boundedRequired(value, "reviewNote", 10, 1000);
    }

    public String reason(String value) {
        return boundedRequired(value, "reason", 10, 500);
    }

    public void validateRegistration(boolean registrationRequired,
            Instant registrationDeadlineAt, boolean certificateEnabled, Instant startAt,
            boolean publishing) {
        if (!registrationRequired) {
            if (registrationDeadlineAt != null || certificateEnabled) {
                throw validation("Registration deadline and certificate require registration.",
                        "registrationRequired");
            }
            return;
        }
        if (registrationDeadlineAt != null && registrationDeadlineAt.isAfter(startAt)) {
            throw validation("registrationDeadlineAt must not be after Activity start.",
                    "registrationDeadlineAt");
        }
        if (publishing && (registrationDeadlineAt == null
                || registrationDeadlineAt.isBefore(clock.instant()))) {
            throw validation("A publishable registration deadline must be present and not past.",
                    "registrationDeadlineAt");
        }
    }

    public void validateRegistrationUpdate(boolean registrationRequired,
            Instant registrationDeadlineAt, boolean certificateEnabled, Instant startAt,
            boolean published) {
        validateRegistration(registrationRequired, registrationDeadlineAt, certificateEnabled, startAt, false);
        if (published && registrationRequired && registrationDeadlineAt == null) {
            throw validation("A published registration Activity must keep a registration deadline.",
                    "registrationDeadlineAt");
        }
    }

    private static String requiredText(String value, String field, int maximum) {
        if (value == null) throw validation(field + " is required.", field);
        String normalized = value.trim();
        if (normalized.isEmpty() || normalized.length() > maximum) {
            throw validation(field + " is required and must not exceed " + maximum
                    + " characters.", field);
        }
        return normalized;
    }

    private static String requiredCollapsedText(String value, String field, int maximum) {
        if (value == null) throw validation(field + " is required.", field);
        String normalized = value.trim().replaceAll("\\s+", " ");
        if (normalized.isEmpty() || normalized.length() > maximum) {
            throw validation(field + " is required and must not exceed " + maximum
                    + " characters.", field);
        }
        return normalized;
    }

    private static String optionalText(String value, String field, int maximum) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.length() > maximum) {
            throw validation(field + " must not exceed " + maximum + " characters.", field);
        }
        return normalized.isEmpty() ? null : normalized;
    }

    private static String boundedRequired(String value, String field, int minimum, int maximum) {
        String normalized = requiredText(value, field, maximum);
        if (normalized.length() < minimum) {
            throw validation(field + " must contain at least " + minimum + " characters.", field);
        }
        return normalized;
    }

    private static URI optionalHttpUri(String value) {
        String normalized = optionalText(value, "imageUrl", 2048);
        if (normalized == null) return null;
        try {
            URI uri = new URI(normalized);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || uri.getHost() == null) {
                throw validation("imageUrl must be an absolute HTTP(S) URL.", "imageUrl");
            }
            return uri;
        } catch (URISyntaxException error) {
            throw validation("imageUrl must be an absolute HTTP(S) URL.", "imageUrl");
        }
    }

    private static ActivityApiException validation(String message, String field) {
        return new ActivityApiException(HttpStatus.UNPROCESSABLE_CONTENT, "VALIDATION_FAILED",
                message, field);
    }
}
