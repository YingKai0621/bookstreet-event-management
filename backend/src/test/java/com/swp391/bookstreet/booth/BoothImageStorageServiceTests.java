package com.swp391.bookstreet.booth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.repository.BoothRepository;
import com.swp391.bookstreet.booth.service.BoothImageStorageService;
import com.swp391.bookstreet.common.media.MediaStorageTestSupport;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class BoothImageStorageServiceTests {
    @TempDir
    Path temporaryDirectory;

    BoothRepository boothRepository = mock(BoothRepository.class);

    @Test
    void storesAndLoadsAValidatedWebpUsingAServerGeneratedName() throws Exception {
        BoothImageStorageService service = new BoothImageStorageService(
                MediaStorageTestSupport.local(temporaryDirectory), boothRepository);
        byte[] webp = new byte[] {
                'R', 'I', 'F', 'F', 0x04, 0x00, 0x00, 0x00,
                'W', 'E', 'B', 'P', 0x01
        };

        var uploaded = service.store(new MockMultipartFile(
                "file", "../../booth.webp", "image/webp", webp));

        assertThat(uploaded.url()).matches(
                "/api/v1/media/booth-images/[0-9a-f-]{36}\\.webp");
        String fileName = uploaded.url().substring(uploaded.url().lastIndexOf('/') + 1);
        var stored = service.load(fileName);
        assertThat(stored.mediaType().toString()).isEqualTo("image/webp");
        assertThat(stored.resource().getContentAsByteArray()).isEqualTo(webp);
        try (var files = Files.list(temporaryDirectory)) {
            assertThat(files).hasSize(1);
        }
    }

    @Test
    void rejectsContentWhoseDeclaredTypeDoesNotMatchItsSignature() {
        BoothImageStorageService service = new BoothImageStorageService(
                MediaStorageTestSupport.local(temporaryDirectory), boothRepository);

        assertThatThrownBy(() -> service.store(new MockMultipartFile(
                "file", "fake.png", "image/png", "not-an-image".getBytes())))
                .isInstanceOfSatisfying(BoothApiException.class, error -> {
                    assertThat(error.getStatus().value()).isEqualTo(422);
                    assertThat(error.getCode()).isEqualTo("BOOTH_IMAGE_INVALID");
                    assertThat(error.getField()).isEqualTo("file");
                });
    }

    @Test
    void rejectsUnsafeOrMissingPublicFileNames() {
        BoothImageStorageService service = new BoothImageStorageService(
                MediaStorageTestSupport.local(temporaryDirectory), boothRepository);

        assertThatThrownBy(() -> service.load("../secret.png"))
                .isInstanceOfSatisfying(BoothApiException.class,
                        error -> assertThat(error.getCode())
                                .isEqualTo("BOOTH_IMAGE_NOT_FOUND"));
    }

    @Test
    void deletesAnUnreferencedUploadedImageIdempotently() {
        BoothImageStorageService service = new BoothImageStorageService(
                MediaStorageTestSupport.local(temporaryDirectory), boothRepository);
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        };
        var uploaded = service.store(new MockMultipartFile(
                "file", "booth.png", "image/png", png));
        String fileName = uploaded.url().substring(uploaded.url().lastIndexOf('/') + 1);

        service.deleteIfUnreferenced(fileName);
        service.deleteIfUnreferenced(fileName);

        assertThat(Files.exists(temporaryDirectory.resolve(fileName))).isFalse();
    }

    @Test
    void refusesToDeleteAnImageReferencedByABooth() {
        BoothImageStorageService service = new BoothImageStorageService(
                MediaStorageTestSupport.local(temporaryDirectory), boothRepository);
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        };
        var uploaded = service.store(new MockMultipartFile(
                "file", "booth.png", "image/png", png));
        String fileName = uploaded.url().substring(uploaded.url().lastIndexOf('/') + 1);
        when(boothRepository.existsByImageUrl(uploaded.url())).thenReturn(true);

        assertThatThrownBy(() -> service.deleteIfUnreferenced(fileName))
                .isInstanceOfSatisfying(BoothApiException.class, error -> {
                    assertThat(error.getStatus()).isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
                    assertThat(error.getCode()).isEqualTo("BOOTH_IMAGE_IN_USE");
                });
        assertThat(Files.exists(temporaryDirectory.resolve(fileName))).isTrue();
    }
}
