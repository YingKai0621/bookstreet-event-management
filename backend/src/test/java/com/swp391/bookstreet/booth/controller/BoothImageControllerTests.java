package com.swp391.bookstreet.booth.controller;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.booth.dto.BoothImageUploadResponse;
import com.swp391.bookstreet.booth.exception.BoothApiException;
import com.swp391.bookstreet.booth.exception.BoothApiExceptionHandler;
import com.swp391.bookstreet.booth.service.BoothImageStorageService;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class BoothImageControllerTests {
    private static final String FILE_NAME =
            "12345678-1234-1234-1234-123456789abc.png";
    private static final String PUBLIC_URL = "/api/v1/media/booth-images/" + FILE_NAME;

    @Mock
    BoothImageStorageService storageService;

    @InjectMocks
    BoothImageController controller;

    MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new BoothApiExceptionHandler())
                .build();
    }

    @Test
    void organizerUploadReturnsCreatedImageUrl() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "booth.png", "image/png", pngBytes());
        when(storageService.store(file)).thenReturn(new BoothImageUploadResponse(PUBLIC_URL));

        mvc.perform(multipart("/api/v1/organizer/booth-images").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url").value(PUBLIC_URL));
    }

    @Test
    void publicReadReturnsValidatedMediaTypeAndImmutableCacheHeader() throws Exception {
        byte[] content = pngBytes();
        when(storageService.load(FILE_NAME)).thenReturn(StoredMediaAsset.local(
                new ByteArrayResource(content), MediaType.IMAGE_PNG));

        mvc.perform(get(PUBLIC_URL))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(content))
                .andExpect(header().string("Content-Disposition",
                        "inline; filename=\"" + FILE_NAME + "\""))
                .andExpect(header().string("Cache-Control",
                        "max-age=31536000, public, immutable"));
    }

    @Test
    void cloudBackedReadRedirectsToTheCdnWithoutProxyingBytes() throws Exception {
        URI cdn = URI.create("https://res.cloudinary.com/demo/image/upload/bookstreet/booth-images/"
                + FILE_NAME);
        when(storageService.load(FILE_NAME)).thenReturn(
                StoredMediaAsset.redirect(cdn, MediaType.IMAGE_PNG));

        mvc.perform(get(PUBLIC_URL))
                .andExpect(status().isTemporaryRedirect())
                .andExpect(header().string("Location", cdn.toString()))
                .andExpect(header().string("Cache-Control",
                        "max-age=31536000, public, immutable"));
    }

    @Test
    void organizerDeleteRemovesOnlyAnUnreferencedUpload() throws Exception {
        doNothing().when(storageService).deleteIfUnreferenced(FILE_NAME);

        mvc.perform(delete("/api/v1/organizer/booth-images/{fileName}", FILE_NAME))
                .andExpect(status().isNoContent());

        verify(storageService).deleteIfUnreferenced(FILE_NAME);
    }

    @Test
    void deleteInUseReturnsStableConflict() throws Exception {
        doThrow(new BoothApiException(HttpStatus.CONFLICT, "BOOTH_IMAGE_IN_USE",
                "Ảnh gian hàng đang được sử dụng và không thể xóa."))
                .when(storageService).deleteIfUnreferenced(FILE_NAME);

        mvc.perform(delete("/api/v1/organizer/booth-images/{fileName}", FILE_NAME))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_IMAGE_IN_USE"));
    }

    private static byte[] pngBytes() {
        return "test-png-content".getBytes(StandardCharsets.UTF_8);
    }
}
