package com.swp391.bookstreet.rating.entity;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class ActivityRatingTests {
    private static final Instant CREATED_AT = Instant.parse("2026-10-23T08:00:00Z");

    @Test
    void invalidateAndRestoreAreIdempotentAndReuseTheSameRating() {
        ActivityRating rating = activeRating();
        Instant invalidatedAt = CREATED_AT.plusSeconds(60);
        Instant restoredAt = invalidatedAt.plusSeconds(60);

        assertThat(rating.invalidate(invalidatedAt)).isTrue();
        assertThat(rating.invalidate(invalidatedAt)).isFalse();
        assertThat(rating.getStatus()).isEqualTo(ActivityRatingStatus.INVALIDATED);
        assertThat(rating.getInvalidatedAt()).isEqualTo(invalidatedAt);

        assertThat(rating.restore(restoredAt)).isTrue();
        assertThat(rating.restore(restoredAt)).isFalse();
        assertThat(rating.getStatus()).isEqualTo(ActivityRatingStatus.ACTIVE);
        assertThat(rating.getInvalidatedAt()).isNull();
        assertThat(rating.getUpdatedAt()).isEqualTo(restoredAt);
    }

    @Test
    void rejectsTransitionBeforeExistingStateTimestamp() {
        ActivityRating rating = activeRating();
        assertThatIllegalArgumentException()
                .isThrownBy(() -> rating.invalidate(CREATED_AT.minusSeconds(1)));
    }

    private ActivityRating activeRating() {
        ActivityRating rating = new ActivityRating();
        ReflectionTestUtils.setField(rating, "activityRatingId", 91L);
        ReflectionTestUtils.setField(rating, "attendanceId", 12L);
        ReflectionTestUtils.setField(rating, "status", ActivityRatingStatus.ACTIVE);
        ReflectionTestUtils.setField(rating, "createdAt", CREATED_AT);
        ReflectionTestUtils.setField(rating, "updatedAt", CREATED_AT);
        return rating;
    }
}
