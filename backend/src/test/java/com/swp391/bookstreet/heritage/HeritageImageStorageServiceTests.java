package com.swp391.bookstreet.heritage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.repository.HeritageContentRepository;
import com.swp391.bookstreet.heritage.service.HeritageImageStorageService;
import com.swp391.bookstreet.common.media.MediaStorageTestSupport;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class HeritageImageStorageServiceTests {
    @TempDir
    Path temporaryDirectory;

    private final HeritageContentRepository repository = mock(HeritageContentRepository.class);

    @Test
    void storesLoadsAndDeletesAnUnreferencedValidatedImage() throws Exception {
        HeritageImageStorageService service = service();
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01
        };

        var uploaded = service.store(new MockMultipartFile(
                "file", "../../heritage.png", "image/png", png));

        assertThat(uploaded.imageUrl()).matches(
                "/assets/heritage/uploads/[0-9a-f-]{36}\\.png");
        String fileName = uploaded.imageUrl().substring(uploaded.imageUrl().lastIndexOf('/') + 1);
        var stored = service.load(fileName);
        assertThat(stored.mediaType().toString()).isEqualTo("image/png");
        assertThat(stored.resource().getContentAsByteArray()).isEqualTo(png);

        service.deleteIfUnreferenced(fileName);
        assertThat(Files.exists(temporaryDirectory.resolve(fileName))).isFalse();
    }

    @Test
    void rejectsInvalidImageContentAndReferencedImageDeletion() {
        HeritageImageStorageService service = service();

        assertThatThrownBy(() -> service.store(new MockMultipartFile(
                "file", "fake.png", "image/png", "not-an-image".getBytes())))
                .isInstanceOfSatisfying(HeritageApiException.class, error -> {
                    assertThat(error.getStatus().value()).isEqualTo(422);
                    assertThat(error.getCode()).isEqualTo("HERITAGE_IMAGE_INVALID");
                });

        String fileName = "00000000-0000-0000-0000-000000000000.png";
        when(repository.existsByImageUrl("/assets/heritage/uploads/" + fileName)).thenReturn(true);
        assertThatThrownBy(() -> service.deleteIfUnreferenced(fileName))
                .isInstanceOfSatisfying(HeritageApiException.class,
                        error -> assertThat(error.getCode()).isEqualTo("HERITAGE_IMAGE_IN_USE"));
    }

    private HeritageImageStorageService service() {
        return new HeritageImageStorageService(
                MediaStorageTestSupport.local(temporaryDirectory), repository);
    }
}
