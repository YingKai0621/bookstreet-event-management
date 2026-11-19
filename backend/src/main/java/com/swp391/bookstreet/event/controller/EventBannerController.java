package com.swp391.bookstreet.event.controller;

import com.swp391.bookstreet.event.dto.EventBannerUploadResponse;
import com.swp391.bookstreet.event.service.EventBannerStorageService;
import com.swp391.bookstreet.common.media.StoredMediaAsset;
import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class EventBannerController {
    private final EventBannerStorageService storageService;

    public EventBannerController(EventBannerStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping(value = "/organizer/event-banners",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EventBannerUploadResponse> upload(
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(201).body(storageService.store(file));
    }

    @GetMapping("/media/event-banners/{fileName:.+}")
    public ResponseEntity<Resource> read(@PathVariable String fileName) {
        StoredMediaAsset banner = storageService.load(fileName);
        if (banner.redirects()) {
            return ResponseEntity.status(307)
                    .location(banner.redirectUri())
                    .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                    .build();
        }
        return ResponseEntity.ok()
                .contentType(banner.mediaType())
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                .body(banner.resource());
    }
}
