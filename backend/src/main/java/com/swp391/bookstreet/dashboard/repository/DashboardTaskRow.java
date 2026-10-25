package com.swp391.bookstreet.dashboard.repository;

import java.time.Instant;

public interface DashboardTaskRow {
    String getTaskType();
    Long getItemId();
    Long getEventId();
    String getEventName();
    String getSubjectName();
    Instant getSubmittedAt();
}
