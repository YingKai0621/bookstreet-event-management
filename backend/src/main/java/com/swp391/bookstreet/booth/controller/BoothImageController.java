package com.swp391.bookstreet.booth.controller;

import com.swp391.bookstreet.booth.dto.BoothImageUploadResponse;
import com.swp391.bookstreet.booth.service.BoothImageStorageService;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class BoothImageController {
    private final BoothImageStorageService storageService;

    public BoothImageController(BoothImageStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping(value = "/organizer/booth-images",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BoothImageUploadResponse> upload(
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(201).body(storageService.store(file));
    }

    @GetMapping("/media/booth-images/{fileName:.+}")
    public ResponseEntity<Resource> read(@PathVariable String fileName) {
        StoredMediaAsset image = storageService.load(fileName);
        if (image.redirects()) {
            return ResponseEntity.status(307)
                    .location(image.redirectUri())
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                    .build();
        }
        return ResponseEntity.ok()
                .contentType(image.mediaType())
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + fileName + "\"")
                .body(image.resource());
    }

    @DeleteMapping("/organizer/booth-images/{fileName:.+}")
    public ResponseEntity<Void> deleteTemporaryImage(@PathVariable String fileName) {
        storageService.deleteIfUnreferenced(fileName);
        return ResponseEntity.noContent().build();
    }
}
