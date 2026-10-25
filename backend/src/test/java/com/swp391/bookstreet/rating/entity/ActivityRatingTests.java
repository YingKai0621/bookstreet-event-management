package com.swp391.bookstreet.rating.entity;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

class ActivityRatingTests {
    private static final Instant CREATED_AT = Instant.parse("2026-10-23T08:00:00Z");

    @Test
    void createInitializesActiveRatingWithValidData() {
        ActivityRating rating = ActivityRating.create(12L, (short) 5, " Tuyệt vời ", CREATED_AT);

        assertThat(rating.getAttendanceId()).isEqualTo(12L);
        assertThat(rating.getScore()).isEqualTo((short) 5);
        assertThat(rating.getComment()).isEqualTo("Tuyệt vời");
        assertThat(rating.getStatus()).isEqualTo(ActivityRatingStatus.ACTIVE);
        assertThat(rating.getCreatedAt()).isEqualTo(CREATED_AT);
        assertThat(rating.getUpdatedAt()).isEqualTo(CREATED_AT);
        assertThat(rating.getInvalidatedAt()).isNull();
    }

    @Test
    void createNormalizesBlankCommentToNull() {
        ActivityRating rating = ActivityRating.create(12L, (short) 4, "   ", CREATED_AT);
        assertThat(rating.getComment()).isNull();

        ActivityRating nullCommentRating = ActivityRating.create(12L, (short) 4, null, CREATED_AT);
        assertThat(nullCommentRating.getComment()).isNull();
    }

    @Test
    void createRejectsInvalidScoreOrComment() {
        assertThatNullPointerException()
                .isThrownBy(() -> ActivityRating.create(null, (short) 5, "comment", CREATED_AT));
        assertThatNullPointerException()
                .isThrownBy(() -> ActivityRating.create(12L, (short) 5, "comment", null));

        assertThatIllegalArgumentException()
                .isThrownBy(() -> ActivityRating.create(12L, (short) 0, "comment", CREATED_AT));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> ActivityRating.create(12L, (short) 6, "comment", CREATED_AT));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> ActivityRating.create(12L, null, "comment", CREATED_AT));

        String longComment = "a".repeat(1001);
        assertThatIllegalArgumentException()
                .isThrownBy(() -> ActivityRating.create(12L, (short) 5, longComment, CREATED_AT));
    }

    @Test
    void updateModifiesScoreCommentAndTimestamp() {
        ActivityRating rating = ActivityRating.create(12L, (short) 3, "Bình thường", CREATED_AT);
        Instant updatedAt = CREATED_AT.plusSeconds(300);

        rating.update((short) 5, "Rất tốt sau khi cập nhật", updatedAt);

        assertThat(rating.getScore()).isEqualTo((short) 5);
        assertThat(rating.getComment()).isEqualTo("Rất tốt sau khi cập nhật");
        assertThat(rating.getCreatedAt()).isEqualTo(CREATED_AT);
        assertThat(rating.getUpdatedAt()).isEqualTo(updatedAt);
    }

    @Test
    void updateRejectsTimestampBeforeCreatedAt() {
        ActivityRating rating = ActivityRating.create(12L, (short) 3, "Bình thường", CREATED_AT);
        assertThatIllegalArgumentException()
                .isThrownBy(() -> rating.update((short) 4, "Sửa", CREATED_AT.minusSeconds(1)));
    }

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
