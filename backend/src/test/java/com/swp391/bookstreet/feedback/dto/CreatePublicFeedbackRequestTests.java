package com.swp391.bookstreet.feedback.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import org.junit.jupiter.api.Test;

class CreatePublicFeedbackRequestTests {

    @Test
    void stringRepresentationRedactsAllGuestProvidedContent() {
        CreatePublicFeedbackRequest request = new CreatePublicFeedbackRequest(
                GeneralFeedbackTargetType.EVENT,
                7L,
                "Sensitive Guest Name",
                "private@example.test",
                "Sensitive feedback message"
        );

        assertThat(request.toString())
                .contains("targetType=EVENT", "eventId=7")
                .contains("guestName=<redacted>", "contactEmail=<redacted>", "message=<redacted>")
                .doesNotContain("Sensitive Guest Name", "private@example.test", "Sensitive feedback message");
    }
}
