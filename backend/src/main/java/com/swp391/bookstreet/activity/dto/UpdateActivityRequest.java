package com.swp391.bookstreet.activity.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

public class UpdateActivityRequest {
    @JsonIgnore
    private final Set<String> suppliedFields = new HashSet<>();

    private String title;
    private String description;
    private String activityType;
    private Long locationId;
    private Instant startAt;
    private Instant endAt;
    private Integer capacity;
    private String imageUrl;
    private Boolean registrationRequired;
    private Instant registrationDeadlineAt;
    private Boolean certificateEnabled;
    private Integer attendanceEarlyScanMinutes;
    private String changeReason;

    public boolean contains(String field) { return suppliedFields.contains(field); }

    @JsonIgnore
    public boolean isEmpty() {
        return suppliedFields.stream().noneMatch(field -> !field.equals("changeReason"));
    }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Activity field: " + field);
    }

    public String getTitle() { return title; }
    @JsonSetter("title") public void setTitle(String value) { suppliedFields.add("title"); title = value; }
    public String getDescription() { return description; }
    @JsonSetter("description") public void setDescription(String value) { suppliedFields.add("description"); description = value; }
    public String getActivityType() { return activityType; }
    @JsonSetter("activityType") public void setActivityType(String value) { suppliedFields.add("activityType"); activityType = value; }
    public Long getLocationId() { return locationId; }
    @JsonSetter("locationId") public void setLocationId(Long value) { suppliedFields.add("locationId"); locationId = value; }
    public Instant getStartAt() { return startAt; }
    @JsonSetter("startAt") public void setStartAt(Instant value) { suppliedFields.add("startAt"); startAt = value; }
    public Instant getEndAt() { return endAt; }
    @JsonSetter("endAt") public void setEndAt(Instant value) { suppliedFields.add("endAt"); endAt = value; }
    public Integer getCapacity() { return capacity; }
    @JsonSetter("capacity") public void setCapacity(Integer value) { suppliedFields.add("capacity"); capacity = value; }
    public String getImageUrl() { return imageUrl; }
    @JsonSetter("imageUrl") public void setImageUrl(String value) { suppliedFields.add("imageUrl"); imageUrl = value; }
    public Boolean getRegistrationRequired() { return registrationRequired; }
    @JsonSetter("registrationRequired") public void setRegistrationRequired(Boolean value) { suppliedFields.add("registrationRequired"); registrationRequired = value; }
    public Instant getRegistrationDeadlineAt() { return registrationDeadlineAt; }
    @JsonSetter("registrationDeadlineAt") public void setRegistrationDeadlineAt(Instant value) { suppliedFields.add("registrationDeadlineAt"); registrationDeadlineAt = value; }
    public Boolean getCertificateEnabled() { return certificateEnabled; }
    @JsonSetter("certificateEnabled") public void setCertificateEnabled(Boolean value) { suppliedFields.add("certificateEnabled"); certificateEnabled = value; }
    public Integer getAttendanceEarlyScanMinutes() { return attendanceEarlyScanMinutes; }
    @JsonSetter("attendanceEarlyScanMinutes") public void setAttendanceEarlyScanMinutes(Integer value) { suppliedFields.add("attendanceEarlyScanMinutes"); attendanceEarlyScanMinutes = value; }
    public String getChangeReason() { return changeReason; }
    @JsonSetter("changeReason") public void setChangeReason(String value) { suppliedFields.add("changeReason"); changeReason = value; }
}
