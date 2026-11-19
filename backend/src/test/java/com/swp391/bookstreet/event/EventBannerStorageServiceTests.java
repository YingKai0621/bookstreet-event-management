package com.swp391.bookstreet.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swp391.bookstreet.event.exception.EventException;
import com.swp391.bookstreet.event.service.EventBannerStorageService;
import com.swp391.bookstreet.common.media.MediaStorageTestSupport;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class EventBannerStorageServiceTests {
    @TempDir
    Path temporaryDirectory;

    @Test
    void storesAndLoadsAValidatedPngUsingAServerGeneratedName() throws Exception {
        EventBannerStorageService service = new EventBannerStorageService(
                MediaStorageTestSupport.local(temporaryDirectory));
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01
        };

        var uploaded = service.store(new MockMultipartFile(
                "file", "../../banner.png", "image/png", png));

        assertThat(uploaded.url()).matches(
                "/api/v1/media/event-banners/[0-9a-f-]{36}\\.png");
        String fileName = uploaded.url().substring(uploaded.url().lastIndexOf('/') + 1);
        var stored = service.load(fileName);
        assertThat(stored.mediaType().toString()).isEqualTo("image/png");
        assertThat(stored.resource().getContentAsByteArray()).isEqualTo(png);
        try (var files = Files.list(temporaryDirectory)) {
            assertThat(files).hasSize(1);
        }
    }

    @Test
    void rejectsContentWhoseDeclaredTypeDoesNotMatchItsSignature() {
        EventBannerStorageService service = new EventBannerStorageService(
                MediaStorageTestSupport.local(temporaryDirectory));

        assertThatThrownBy(() -> service.store(new MockMultipartFile(
                "file", "fake.png", "image/png", "not-an-image".getBytes())))
                .isInstanceOfSatisfying(EventException.class, error -> {
                    assertThat(error.getStatus().value()).isEqualTo(422);
                    assertThat(error.getCode()).isEqualTo("EVENT_BANNER_INVALID");
                    assertThat(error.getField()).isEqualTo("file");
                });
    }

    @Test
    void rejectsUnsafeOrMissingPublicFileNames() {
        EventBannerStorageService service = new EventBannerStorageService(
                MediaStorageTestSupport.local(temporaryDirectory));

        assertThatThrownBy(() -> service.load("../secret.png"))
                .isInstanceOfSatisfying(EventException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo("EVENT_BANNER_NOT_FOUND"));
    }
}
