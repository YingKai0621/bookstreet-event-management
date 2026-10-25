package com.swp391.bookstreet.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.dashboard.repository.DashboardStatusCountRow;
import com.swp391.bookstreet.dashboard.repository.DashboardTaskRow;
import com.swp391.bookstreet.dashboard.repository.OrganizerDashboardRepository;
import com.swp391.bookstreet.dashboard.service.OrganizerDashboardService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrganizerDashboardServiceTests {

    @Test
    void aggregatesOnlyTheAuthenticatedOrganizersRepositoryScope() {
        OrganizerDashboardRepository repository = mock(OrganizerDashboardRepository.class);
        List<DashboardStatusCountRow> eventRows = List.of(
                status("PUBLISHED", 3L), status("ONGOING", 2L), status("CANCELLED", 1L)
        );
        List<DashboardStatusCountRow> applicationRows = List.of(
                status("PENDING", 4L), status("APPROVED", 7L), status("REJECTED", 2L)
        );
        DashboardTaskRow priorityTask = task(
                "PARTNER_APPLICATION", 91L, 11L, "Hội sách", "NXB Trẻ"
        );
        when(repository.countEventsByStatus(17L)).thenReturn(eventRows);
        when(repository.countPartnerApplicationsByStatus(17L)).thenReturn(applicationRows);
        when(repository.countPendingBoothRequests(17L)).thenReturn(5L);
        when(repository.findPriorityTasks(17L)).thenReturn(List.of(priorityTask));

        var response = new OrganizerDashboardService(repository).getOverview(17L);

        assertThat(response.activeEventCount()).isEqualTo(5L);
        assertThat(response.pendingPartnerApplicationCount()).isEqualTo(4L);
        assertThat(response.pendingBoothRequestCount()).isEqualTo(5L);
        assertThat(response.eventStatusCounts()).containsEntry("DRAFT", 0L)
                .containsEntry("CANCELLED", 1L);
        assertThat(response.partnerApplicationStatusCounts()).containsEntry("WITHDRAWN", 0L)
                .containsEntry("APPROVED", 7L);
        assertThat(response.priorityTasks()).singleElement().satisfies(item -> {
            assertThat(item.type()).isEqualTo("PARTNER_APPLICATION");
            assertThat(item.eventId()).isEqualTo(11L);
            assertThat(item.eventName()).isEqualTo("Hội sách");
        });
    }

    private static DashboardStatusCountRow status(String value, Long total) {
        DashboardStatusCountRow row = mock(DashboardStatusCountRow.class);
        when(row.getStatus()).thenReturn(value);
        when(row.getTotal()).thenReturn(total);
        return row;
    }

    private static DashboardTaskRow task(
            String type,
            Long id,
            Long eventId,
            String eventName,
            String subjectName
    ) {
        DashboardTaskRow row = mock(DashboardTaskRow.class);
        when(row.getTaskType()).thenReturn(type);
        when(row.getItemId()).thenReturn(id);
        when(row.getEventId()).thenReturn(eventId);
        when(row.getEventName()).thenReturn(eventName);
        when(row.getSubjectName()).thenReturn(subjectName);
        when(row.getSubmittedAt()).thenReturn(Instant.parse("2026-10-20T10:00:00Z"));
        return row;
    }
}
