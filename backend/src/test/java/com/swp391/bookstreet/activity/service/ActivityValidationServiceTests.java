package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.event.entity.Event;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActivityValidationServiceTests {
    private static final Instant NOW = Instant.parse("2027-01-01T00:00:00Z");

    private final ActivityValidationService service = new ActivityValidationService(
            Clock.fixed(NOW, ZoneOffset.UTC));
    private Event event;
    private Location location;

    @BeforeEach
    void setup() {
        event = new Event();
        event.setStartAt(NOW.plusSeconds(3600));
        event.setEndAt(NOW.plusSeconds(7200));
        location = mock(Location.class);
        when(location.isActive()).thenReturn(true);
        when(location.getMaxCapacity()).thenReturn(100);
    }

    @Test
    void acceptsEventBoundaryTimesAndNormalizesText() {
        ValidatedActivityFields result = service.validateCore(event, location,
                "  Book   Talk  ", "   ", " TALKSHOW ", event.getStartAt(), event.getEndAt(),
                100, " https://example.test/poster.png ", true);

        assertThat(result.title()).isEqualTo("Book Talk");
        assertThat(result.description()).isNull();
        assertThat(result.activityType()).isEqualTo("TALKSHOW");
        assertThat(result.imageUrl()).hasToString("https://example.test/poster.png");
    }

    @Test
    void rejectsStartThatIsNotStrictlyInFuture() {
        event.setStartAt(NOW.minusSeconds(60));

        assertCode(() -> service.validateTime(event, NOW, NOW.plusSeconds(60), true),
                "ACTIVITY_TIME_INVALID");
    }

    @Test
    void rejectsIntervalOutsideEvent() {
        assertCode(() -> service.validateTime(event, event.getStartAt().minusSeconds(1),
                event.getEndAt(), true), "ACTIVITY_TIME_OUTSIDE_EVENT");
    }

    @Test
    void rejectsCapacityAboveLocationLimit() {
        assertCode(() -> service.validateCapacity(location, 101),
                "ACTIVITY_CAPACITY_INVALID");
    }

    @Test
    void validatesReasonAndImageUrlBounds() {
        assertThat(service.reason("  enough detail  ")).isEqualTo("enough detail");
        assertCode(() -> service.reason("short"), "VALIDATION_FAILED");
        assertCode(() -> service.validateCore(event, location, "Title", null, "Talk",
                event.getStartAt(), event.getEndAt(), 10, "file:///tmp/poster.png", true),
                "VALIDATION_FAILED");
    }

    @Test
    void registrationDisabledRejectsDeadlineAndCertificate() {
        assertCode(() -> service.validateRegistration(false, NOW.plusSeconds(60), false,
                NOW.plusSeconds(120), false), "VALIDATION_FAILED");
        assertCode(() -> service.validateRegistration(false, null, true,
                NOW.plusSeconds(120), false), "VALIDATION_FAILED");
    }

    @Test
    void draftMayKeepRegistrationIncompleteButPublishMayNot() {
        service.validateRegistration(true, null, true, NOW.plusSeconds(120), false);

        assertCode(() -> service.validateRegistration(true, null, true,
                NOW.plusSeconds(120), true), "VALIDATION_FAILED");
        assertCode(() -> service.validateRegistration(true, NOW.minusSeconds(1), false,
                NOW.plusSeconds(120), true), "VALIDATION_FAILED");
    }

    @Test
    void publishAcceptsDeadlineAtCurrentTimeOrActivityStart() {
        service.validateRegistration(true, NOW, false, NOW.plusSeconds(120), true);
        service.validateRegistration(true, NOW.plusSeconds(120), true,
                NOW.plusSeconds(120), true);
    }

    private static void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable action,
            String code) {
        assertThatThrownBy(action)
                .isInstanceOfSatisfying(ActivityApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo(code));
    }
}
