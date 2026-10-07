package com.swp391.bookstreet.event.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.*;
import java.time.Instant;

public record CreateEventRequest(
        @NotBlank @Size(max = 150) String name,
        String description,
        @NotNull Instant startAt,
        @NotNull Instant endAt,
        Instant partnerApplicationDeadlineAt,
        Instant boothRequestDeadlineAt,
        Instant activityProposalDeadlineAt,
        Instant participantRegistrationDeadlineAt,
        Instant partnerWithdrawalCutoffAt,
        Instant boothCancellationCutoffAt,
        Instant activityCancellationCutoffAt,
        Integer boothPaymentWindowMinutes,
        @NotNull @PositiveOrZero Integer maxBoothsPerPartner,
        @NotNull @PositiveOrZero Integer maxActivitiesPerPartner,
        String bannerUrl
) {
    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unsupported event request field: " + field);
    }
}
