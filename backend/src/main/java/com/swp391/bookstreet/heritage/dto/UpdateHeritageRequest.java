package com.swp391.bookstreet.heritage.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonSetter;
import java.util.HashSet;
import java.util.Set;

public class UpdateHeritageRequest {
    private final Set<String> suppliedFields = new HashSet<>();
    private String title;
    private String summary;
    private String content;
    private String imageUrl;
    private String locationText;
    private String expectedUpdatedAt;

    public String getTitle() {
        return title;
    }

    @JsonSetter("title")
    public void setTitle(String title) {
        suppliedFields.add("title");
        this.title = title;
    }

    public String getSummary() {
        return summary;
    }

    @JsonSetter("summary")
    public void setSummary(String summary) {
        suppliedFields.add("summary");
        this.summary = summary;
    }

    public String getContent() {
        return content;
    }

    @JsonSetter("content")
    public void setContent(String content) {
        suppliedFields.add("content");
        this.content = content;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    @JsonSetter("imageUrl")
    public void setImageUrl(String imageUrl) {
        suppliedFields.add("imageUrl");
        this.imageUrl = imageUrl;
    }

    public String getLocationText() {
        return locationText;
    }

    @JsonSetter("locationText")
    public void setLocationText(String locationText) {
        suppliedFields.add("locationText");
        this.locationText = locationText;
    }

    public String getExpectedUpdatedAt() {
        return expectedUpdatedAt;
    }

    @JsonSetter("expectedUpdatedAt")
    public void setExpectedUpdatedAt(String expectedUpdatedAt) {
        suppliedFields.add("expectedUpdatedAt");
        this.expectedUpdatedAt = expectedUpdatedAt;
    }

    public boolean isSupplied(String field) {
        return suppliedFields.contains(field);
    }

    public boolean hasMutableField() {
        return suppliedFields.stream().anyMatch(field -> !"expectedUpdatedAt".equals(field));
    }

    @JsonAnySetter
    public void rejectUnknownField(String field, Object value) {
        throw new IllegalArgumentException("Unknown Heritage field: " + field);
    }
}
