package com.swp391.bookstreet.feedback.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class FeedbackRateLimiterTests {

    @Test
    void permitsTenAttemptsThenReturnsRetryAfterWithoutExtendingWindow() {
        MutableClock clock = new MutableClock(Instant.parse("2026-10-31T08:00:00Z"));
        FeedbackRateLimiter limiter = new FeedbackRateLimiter(clock, "test-only-secret");

        for (int attempt = 1; attempt <= 10; attempt++) {
            assertThatCode(() -> limiter.countAttempt(null, "192.0.2.10")).doesNotThrowAnyException();
        }

        assertThatThrownBy(() -> limiter.countAttempt(null, "192.0.2.10"))
                .isInstanceOfSatisfying(FeedbackApiException.class, error -> {
                    assertThat(error.getCode()).isEqualTo("FEEDBACK_RATE_LIMITED");
                    assertThat(error.getRetryAfterSeconds()).isEqualTo(600L);
                });

        clock.advanceSeconds(599);
        assertThatThrownBy(() -> limiter.countAttempt(null, "192.0.2.10"))
                .isInstanceOfSatisfying(FeedbackApiException.class,
                        error -> assertThat(error.getRetryAfterSeconds()).isEqualTo(1L));

        clock.advanceSeconds(1);
        assertThatCode(() -> limiter.countAttempt(null, "192.0.2.10")).doesNotThrowAnyException();
    }

    @Test
    void keepsAuthenticatedAndAnonymousClientKeysSeparate() {
        FeedbackRateLimiter limiter = new FeedbackRateLimiter(
                Clock.fixed(Instant.parse("2026-10-31T08:00:00Z"), ZoneOffset.UTC),
                "test-only-secret"
        );

        for (int attempt = 0; attempt < 10; attempt++) {
            limiter.countAttempt(31L, "192.0.2.10");
            limiter.countAttempt(null, "192.0.2.10");
        }

        assertThatThrownBy(() -> limiter.countAttempt(31L, "198.51.100.20"))
                .isInstanceOf(FeedbackApiException.class);
        assertThatCode(() -> limiter.countAttempt(32L, "192.0.2.10")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.countAttempt(null, "198.51.100.20")).doesNotThrowAnyException();
    }

    @Test
    void failsClosedWhenSecretOrCapacityIsUnavailable() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-31T08:00:00Z"), ZoneOffset.UTC);
        FeedbackRateLimiter missingSecret = new FeedbackRateLimiter(clock, "");

        assertThatThrownBy(() -> missingSecret.countAttempt(null, "192.0.2.10"))
                .isInstanceOfSatisfying(FeedbackApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("FEEDBACK_THROTTLE_UNAVAILABLE"));

        FeedbackRateLimiter full = new FeedbackRateLimiter(clock, "test-only-secret");
        for (int client = 0; client < FeedbackRateLimiter.MAX_ACTIVE_KEYS; client++) {
            full.countAttempt(null, "192.0.2." + client);
        }
        assertThatThrownBy(() -> full.countAttempt(null, "198.51.100.1"))
                .isInstanceOfSatisfying(FeedbackApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("FEEDBACK_THROTTLE_UNAVAILABLE"));
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advanceSeconds(long seconds) {
            instant = instant.plusSeconds(seconds);
        }

        @Override
        public ZoneId getZone() { return ZoneOffset.UTC; }

        @Override
        public Clock withZone(ZoneId zone) { return this; }

        @Override
        public Instant instant() { return instant; }
    }
}
