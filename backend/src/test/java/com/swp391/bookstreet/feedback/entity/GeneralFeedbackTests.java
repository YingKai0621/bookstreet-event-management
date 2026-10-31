package com.swp391.bookstreet.feedback.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swp391.bookstreet.auth.entity.User;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class GeneralFeedbackTests {
    private static final Instant SUBMITTED_AT = Instant.parse("2026-10-31T08:20:00Z");

    @Test
    void createUsesExactNewState() {
        GeneralFeedback feedback = GeneralFeedback.create(
                null,
                GeneralFeedbackTargetType.BOOK_STREET,
                null,
                "Minh An",
                "minhan@example.com",
                "Nội dung góp ý hợp lệ.",
                SUBMITTED_AT
        );

        assertThat(feedback.getStatus()).isEqualTo(GeneralFeedbackStatus.NEW);
        assertThat(feedback.getSubmittedAt()).isEqualTo(SUBMITTED_AT);
        assertThat(feedback.getUpdatedAt()).isEqualTo(SUBMITTED_AT);
        assertThat(feedback.getLastHandledBy()).isNull();
        assertThat(feedback.getHandlingStartedAt()).isNull();
        assertThat(feedback.getInternalNote()).isNull();
        assertThat(feedback.getResolvedAt()).isNull();
    }

    @Test
    void legalTransitionsRetainNoteAndResetCurrentHandlingCycleOnReopen() {
        User organizer = new User("organizer1", "organizer@example.com", "hash", "Organizer One");
        GeneralFeedback feedback = GeneralFeedback.create(
                null, GeneralFeedbackTargetType.BOOK_STREET, null, null, null,
                "Nội dung góp ý hợp lệ.", SUBMITTED_AT);

        Instant firstHandling = SUBMITTED_AT.plusSeconds(60);
        Instant resolved = SUBMITTED_AT.plusSeconds(120);
        Instant reopened = SUBMITTED_AT.plusSeconds(180);
        feedback.startHandling(organizer, firstHandling);
        feedback.resolve(organizer, "Đã kiểm tra và xử lý.", resolved);
        feedback.reopen(organizer, reopened);

        assertThat(feedback.getStatus()).isEqualTo(GeneralFeedbackStatus.IN_PROGRESS);
        assertThat(feedback.getHandlingStartedAt()).isEqualTo(reopened);
        assertThat(feedback.getResolvedAt()).isNull();
        assertThat(feedback.getInternalNote()).isEqualTo("Đã kiểm tra và xử lý.");
        assertThat(feedback.getUpdatedAt()).isEqualTo(reopened);
    }

    @Test
    void rejectsUnsupportedTargetAndStateTransition() {
        assertThatThrownBy(() -> GeneralFeedback.create(
                null, GeneralFeedbackTargetType.EVENT, null, null, null,
                "Nội dung góp ý hợp lệ.", SUBMITTED_AT))
                .isInstanceOf(IllegalArgumentException.class);

        GeneralFeedback feedback = GeneralFeedback.create(
                null, GeneralFeedbackTargetType.BOOK_STREET, null, null, null,
                "Nội dung góp ý hợp lệ.", SUBMITTED_AT);
        User organizer = new User("organizer1", "organizer@example.com", "hash", "Organizer One");
        assertThatThrownBy(() -> feedback.resolve(organizer, "Ghi chú", SUBMITTED_AT.plusSeconds(1)))
                .isInstanceOf(IllegalStateException.class);
    }
}
