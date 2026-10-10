package com.swp391.bookstreet.event.service;

import com.swp391.bookstreet.event.repository.EventRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventLifecycleServiceTests {
    private static final Instant NOW = Instant.parse("2030-01-01T10:00:00Z");

    private final EventRepository repository = mock(EventRepository.class);
    private final EventLifecycleTransactionService transactionService =
            mock(EventLifecycleTransactionService.class);
    private final EventLifecycleService service = new EventLifecycleService(
            repository, transactionService, Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void scansDueEventsInRepositoryOrderAndAdvancesEachInItsOwnTransaction() {
        when(repository.findDueLifecycleIds(NOW)).thenReturn(List.of(21L, 22L, 23L));
        when(transactionService.advance(21L)).thenReturn(true);
        when(transactionService.advance(22L)).thenReturn(false);
        when(transactionService.advance(23L)).thenReturn(true);

        assertThat(service.advanceDueEvents()).isEqualTo(2);

        verify(transactionService).advance(21L);
        verify(transactionService).advance(22L);
        verify(transactionService).advance(23L);
    }

    @Test
    void eachLifecycleTransitionUsesANewTransaction() throws NoSuchMethodException {
        Transactional transactional = EventLifecycleTransactionService.class
                .getMethod("advance", Long.class)
                .getAnnotation(Transactional.class);

        assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }
}
