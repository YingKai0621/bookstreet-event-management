package com.swp391.bookstreet.heritage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.heritage.dto.CreateHeritageRequest;
import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.repository.HeritageContentRepository;
import com.swp391.bookstreet.heritage.service.HeritageValidationService;
import com.swp391.bookstreet.heritage.service.OrganizerHeritageService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class OrganizerHeritageServiceTests {

    @Test
    void createFallsBackToAValidCodeWhenTitleHasNoAsciiCharacters() {
        HeritageContentRepository repository = mock(HeritageContentRepository.class);
        when(repository.lockPublicCodeNamespace("heritage-public-code:DI-SAN")).thenReturn(1);
        when(repository.existsByPublicCode("DI-SAN")).thenReturn(false);
        when(repository.saveAndFlush(any(HeritageContent.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        OrganizerHeritageService service = new OrganizerHeritageService(
                repository,
                new HeritageValidationService(),
                Clock.fixed(Instant.parse("2026-11-02T00:00:00Z"), ZoneOffset.UTC)
        );

        var created = service.create(new CreateHeritageRequest(
                "🎉 🎊",
                null,
                "Nội dung di sản có đủ độ dài để kiểm thử.",
                null,
                null
        ));

        assertThat(created.publicCode()).isEqualTo("DI-SAN");
        verify(repository).lockPublicCodeNamespace("heritage-public-code:DI-SAN");
    }
}
