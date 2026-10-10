package com.swp391.bookstreet.event.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/** Tracks JSON presence so a PATCH can distinguish omission from explicit null. */
public class UpdateEventRequest {
    @JsonIgnore
    private final Set<String> suppliedFields = new HashSet<>();

    @Size(max = 150)
    private String name;

    private String description;

    private Instant startAt;

    private Instant endAt;

    private Instant partnerApplicationDeadlineAt;

    private Instant boothRequestDeadlineAt;

    private Instant activityProposalDeadlineAt;

    private Instant participantRegistrationDeadlineAt;

    private Instant partnerWithdrawalCutoffAt;

    private Instant boothCancellationCutoffAt;

    private Instant activityCancellationCutoffAt;

    private Integer boothPaymentWindowMinutes;

    @PositiveOrZero
    private Integer maxBoothsPerPartner;

    @PositiveOrZero
    private Integer maxActivitiesPerPartner;

    private String bannerUrl;

    public boolean contains(String field) {
        return suppliedFields.contains(field);
    }

    @JsonIgnore
    public Set<String> suppliedFields() {
        return Set.copyOf(suppliedFields);
    }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unsupported event request field: " + field);
    }

    public String getName() { return name; }

    @JsonSetter("name")
    public void setName(String value) {
        suppliedFields.add("name");
        name = value;
    }

    public String getDescription() { return description; }

    @JsonSetter("description")
    public void setDescription(String value) {
        suppliedFields.add("description");
        description = value;
    }

    public Instant getStartAt() { return startAt; }

    @JsonSetter("startAt")
    public void setStartAt(Instant value) {
        suppliedFields.add("startAt");
        startAt = value;
    }

    public Instant getEndAt() { return endAt; }

    @JsonSetter("endAt")
    public void setEndAt(Instant value) {
        suppliedFields.add("endAt");
        endAt = value;
    }

    public Instant getPartnerApplicationDeadlineAt() { return partnerApplicationDeadlineAt; }

    @JsonSetter("partnerApplicationDeadlineAt")
    public void setPartnerApplicationDeadlineAt(Instant value) {
        suppliedFields.add("partnerApplicationDeadlineAt");
        partnerApplicationDeadlineAt = value;
    }

    public Instant getBoothRequestDeadlineAt() { return boothRequestDeadlineAt; }

    @JsonSetter("boothRequestDeadlineAt")
    public void setBoothRequestDeadlineAt(Instant value) {
        suppliedFields.add("boothRequestDeadlineAt");
        boothRequestDeadlineAt = value;
    }

    public Instant getActivityProposalDeadlineAt() { return activityProposalDeadlineAt; }

    @JsonSetter("activityProposalDeadlineAt")
    public void setActivityProposalDeadlineAt(Instant value) {
        suppliedFields.add("activityProposalDeadlineAt");
        activityProposalDeadlineAt = value;
    }

    public Instant getParticipantRegistrationDeadlineAt() { return participantRegistrationDeadlineAt; }

    @JsonSetter("participantRegistrationDeadlineAt")
    public void setParticipantRegistrationDeadlineAt(Instant value) {
        suppliedFields.add("participantRegistrationDeadlineAt");
        participantRegistrationDeadlineAt = value;
    }

    public Instant getPartnerWithdrawalCutoffAt() { return partnerWithdrawalCutoffAt; }

    @JsonSetter("partnerWithdrawalCutoffAt")
    public void setPartnerWithdrawalCutoffAt(Instant value) {
        suppliedFields.add("partnerWithdrawalCutoffAt");
        partnerWithdrawalCutoffAt = value;
    }

    public Instant getBoothCancellationCutoffAt() { return boothCancellationCutoffAt; }

    @JsonSetter("boothCancellationCutoffAt")
    public void setBoothCancellationCutoffAt(Instant value) {
        suppliedFields.add("boothCancellationCutoffAt");
        boothCancellationCutoffAt = value;
    }

    public Instant getActivityCancellationCutoffAt() { return activityCancellationCutoffAt; }

    @JsonSetter("activityCancellationCutoffAt")
    public void setActivityCancellationCutoffAt(Instant value) {
        suppliedFields.add("activityCancellationCutoffAt");
        activityCancellationCutoffAt = value;
    }

    public Integer getBoothPaymentWindowMinutes() { return boothPaymentWindowMinutes; }

    @JsonSetter("boothPaymentWindowMinutes")
    public void setBoothPaymentWindowMinutes(Integer value) {
        suppliedFields.add("boothPaymentWindowMinutes");
        boothPaymentWindowMinutes = value;
    }

    public Integer getMaxBoothsPerPartner() { return maxBoothsPerPartner; }

    @JsonSetter("maxBoothsPerPartner")
    public void setMaxBoothsPerPartner(Integer value) {
        suppliedFields.add("maxBoothsPerPartner");
        maxBoothsPerPartner = value;
    }

    public Integer getMaxActivitiesPerPartner() { return maxActivitiesPerPartner; }

    @JsonSetter("maxActivitiesPerPartner")
    public void setMaxActivitiesPerPartner(Integer value) {
        suppliedFields.add("maxActivitiesPerPartner");
        maxActivitiesPerPartner = value;
    }

    public String getBannerUrl() { return bannerUrl; }

    @JsonSetter("bannerUrl")
    public void setBannerUrl(String value) {
        suppliedFields.add("bannerUrl");
        bannerUrl = value;
    }
}
