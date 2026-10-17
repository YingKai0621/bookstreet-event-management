package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

public class CreateActivityChangeRequest {
    @JsonIgnore
    private final Set<String> suppliedFields = new HashSet<>();

    private String reason;
    private Long requestedLocationId;
    private String requestedTitle;
    private String requestedDescription;
    private String requestedActivityType;
    private Instant requestedStartAt;
    private Instant requestedEndAt;
    private Integer requestedCapacity;
    private String requestedImageUrl;

    public boolean contains(String field) { return suppliedFields.contains(field); }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity field: " + field);
    }

    public String getReason() { return reason; }
    @JsonSetter("reason")
    public void setReason(String value) { reason = value; }

    public Long getRequestedLocationId() { return requestedLocationId; }
    @JsonSetter("requestedLocationId")
    public void setRequestedLocationId(Long value) {
        suppliedFields.add("requestedLocationId");
        requestedLocationId = value;
    }

    public String getRequestedTitle() { return requestedTitle; }
    @JsonSetter("requestedTitle")
    public void setRequestedTitle(String value) {
        suppliedFields.add("requestedTitle");
        requestedTitle = value;
    }

    public String getRequestedDescription() { return requestedDescription; }
    @JsonSetter("requestedDescription")
    public void setRequestedDescription(String value) {
        suppliedFields.add("requestedDescription");
        requestedDescription = value;
    }

    public String getRequestedActivityType() { return requestedActivityType; }
    @JsonSetter("requestedActivityType")
    public void setRequestedActivityType(String value) {
        suppliedFields.add("requestedActivityType");
        requestedActivityType = value;
    }

    public Instant getRequestedStartAt() { return requestedStartAt; }
    @JsonSetter("requestedStartAt")
    public void setRequestedStartAt(Instant value) {
        suppliedFields.add("requestedStartAt");
        requestedStartAt = value;
    }

    public Instant getRequestedEndAt() { return requestedEndAt; }
    @JsonSetter("requestedEndAt")
    public void setRequestedEndAt(Instant value) {
        suppliedFields.add("requestedEndAt");
        requestedEndAt = value;
    }

    public Integer getRequestedCapacity() { return requestedCapacity; }
    @JsonSetter("requestedCapacity")
    public void setRequestedCapacity(Integer value) {
        suppliedFields.add("requestedCapacity");
        requestedCapacity = value;
    }

    public String getRequestedImageUrl() { return requestedImageUrl; }
    @JsonSetter("requestedImageUrl")
    public void setRequestedImageUrl(String value) {
        suppliedFields.add("requestedImageUrl");
        requestedImageUrl = value;
    }
}
