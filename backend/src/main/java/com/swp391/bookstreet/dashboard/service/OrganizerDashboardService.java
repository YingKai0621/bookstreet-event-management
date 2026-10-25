package com.swp391.bookstreet.dashboard.service;

import com.swp391.bookstreet.dashboard.dto.OrganizerDashboardResponse;
import com.swp391.bookstreet.dashboard.repository.DashboardStatusCountRow;
import com.swp391.bookstreet.dashboard.repository.DashboardTaskRow;
import com.swp391.bookstreet.dashboard.repository.OrganizerDashboardRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OrganizerDashboardService {
    private static final List<String> EVENT_STATUSES = List.of(
            "DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED"
    );
    private static final List<String> APPLICATION_STATUSES = List.of(
            "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"
    );

    private final OrganizerDashboardRepository repository;

    public OrganizerDashboardService(OrganizerDashboardRepository repository) {
        this.repository = repository;
    }

    public OrganizerDashboardResponse getOverview(Long organizerUserId) {
        Map<String, Long> eventCounts = normalizedCounts(
                EVENT_STATUSES,
                repository.countEventsByStatus(organizerUserId)
        );
        Map<String, Long> applicationCounts = normalizedCounts(
                APPLICATION_STATUSES,
                repository.countPartnerApplicationsByStatus(organizerUserId)
        );
        long pendingBoothRequests = repository.countPendingBoothRequests(organizerUserId);
        List<OrganizerDashboardResponse.PriorityTask> tasks = repository
                .findPriorityTasks(organizerUserId)
                .stream()
                .map(OrganizerDashboardService::toPriorityTask)
                .toList();

        return new OrganizerDashboardResponse(
                eventCounts.get("PUBLISHED") + eventCounts.get("ONGOING"),
                applicationCounts.get("PENDING"),
                pendingBoothRequests,
                eventCounts,
                applicationCounts,
                tasks
        );
    }

    private static Map<String, Long> normalizedCounts(
            List<String> statuses,
            List<DashboardStatusCountRow> rows
    ) {
        Map<String, Long> result = new LinkedHashMap<>();
        statuses.forEach(status -> result.put(status, 0L));
        rows.forEach(row -> {
            if (row.getStatus() != null && result.containsKey(row.getStatus())) {
                result.put(row.getStatus(), row.getTotal() == null ? 0L : row.getTotal());
            }
        });
        return result;
    }

    private static OrganizerDashboardResponse.PriorityTask toPriorityTask(
            DashboardTaskRow row
    ) {
        return new OrganizerDashboardResponse.PriorityTask(
                row.getTaskType(),
                row.getItemId(),
                row.getEventId(),
                row.getEventName(),
                row.getSubjectName(),
                row.getSubmittedAt()
        );
    }
}
