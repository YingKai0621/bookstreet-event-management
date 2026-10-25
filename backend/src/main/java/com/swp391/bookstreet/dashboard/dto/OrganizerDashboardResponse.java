package com.swp391.bookstreet.dashboard.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record OrganizerDashboardResponse(
        long activeEventCount,
        long pendingPartnerApplicationCount,
        long pendingBoothRequestCount,
        Map<String, Long> eventStatusCounts,
        Map<String, Long> partnerApplicationStatusCounts,
        List<PriorityTask> priorityTasks
) {
    public record PriorityTask(
            String type,
            Long id,
            Long eventId,
            String eventName,
            String subjectName,
            Instant submittedAt
    ) {
    }
}
