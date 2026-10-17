package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

public class UpdateActivityProposalRequest {
    @JsonIgnore
    private final Set<String> suppliedFields = new HashSet<>();

    private Long locationId;
    private String title;
    private String description;
    private String activityType;
    private Instant proposedStartAt;
    private Instant proposedEndAt;
    private Integer capacity;

    public boolean contains(String field) { return suppliedFields.contains(field); }

    @JsonIgnore
    public boolean isEmpty() { return suppliedFields.isEmpty(); }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity field: " + field);
    }

    public Long getLocationId() { return locationId; }
    @JsonSetter("locationId")
    public void setLocationId(Long value) { suppliedFields.add("locationId"); locationId = value; }

    public String getTitle() { return title; }
    @JsonSetter("title")
    public void setTitle(String value) { suppliedFields.add("title"); title = value; }

    public String getDescription() { return description; }
    @JsonSetter("description")
    public void setDescription(String value) { suppliedFields.add("description"); description = value; }

    public String getActivityType() { return activityType; }
    @JsonSetter("activityType")
    public void setActivityType(String value) { suppliedFields.add("activityType"); activityType = value; }

    public Instant getProposedStartAt() { return proposedStartAt; }
    @JsonSetter("proposedStartAt")
    public void setProposedStartAt(Instant value) { suppliedFields.add("proposedStartAt"); proposedStartAt = value; }

    public Instant getProposedEndAt() { return proposedEndAt; }
    @JsonSetter("proposedEndAt")
    public void setProposedEndAt(Instant value) { suppliedFields.add("proposedEndAt"); proposedEndAt = value; }

    public Integer getCapacity() { return capacity; }
    @JsonSetter("capacity")
    public void setCapacity(Integer value) { suppliedFields.add("capacity"); capacity = value; }
}
