package com.swp391.bookstreet.booth.service;

import com.swp391.bookstreet.booth.repository.BoothAssignmentRepository;
import com.swp391.bookstreet.booth.repository.BoothRequestRepository;
import com.swp391.bookstreet.booth.repository.EventBoothConfigRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class BoothSelectionEligibilityServiceTests {
    private static final Instant DEADLINE = Instant.parse("2026-11-14T02:00:00Z");

    private final BoothSelectionEligibilityService service =
            new BoothSelectionEligibilityService(
                    mock(EventBoothConfigRepository.class),
                    mock(BoothRequestRepository.class),
                    mock(BoothAssignmentRepository.class));

    @Test
    void selectionWindowIncludesExactDeadlineAndClosesImmediatelyAfter() {
        Event event = publishedEvent();

        assertThat(service.selectionWindowOpen(event, DEADLINE.minus(1, ChronoUnit.MICROS))).isTrue();
        assertThat(service.selectionWindowOpen(event, DEADLINE)).isTrue();
        assertThat(service.selectionWindowOpen(event, DEADLINE.plus(1, ChronoUnit.MICROS))).isFalse();
    }

    private Event publishedEvent() {
        Event event = new Event();
        event.setStatus(EventStatus.PUBLISHED);
        event.setBoothRequestDeadlineAt(DEADLINE);
        event.setStartAt(DEADLINE.plusSeconds(86_400));
        return event;
    }
}
