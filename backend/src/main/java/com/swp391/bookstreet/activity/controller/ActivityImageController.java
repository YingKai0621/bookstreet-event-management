package com.swp391.bookstreet.activity.controller;

import com.swp391.bookstreet.activity.service.ActivityImageService;
import com.swp391.bookstreet.common.media.ValidatedImageStorage.ImageUploadResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ActivityImageController {
    private final ActivityImageService service;

    public ActivityImageController(ActivityImageService service) {
        this.service = service;
    }

    @PostMapping(value = "/api/v1/organizer/events/{eventId}/activity-images",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageUploadResponse> organizerUpload(@PathVariable Long eventId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(201).body(service.uploadForOrganizer(eventId, file));
    }

    @PostMapping(value = "/api/v1/partner/activities/{activityId}/images",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageUploadResponse> partnerUpload(@PathVariable Long activityId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(201).body(service.uploadForPartner(activityId, file));
    }

    @GetMapping("/api/v1/media/activity-images/{fileName:.+}")
    public ResponseEntity<Resource> read(@PathVariable String fileName) {
        var image = service.read(fileName);
        if (image.redirects()) {
            return ResponseEntity.status(307).location(image.redirectUri()).build();
        }
        return ResponseEntity.ok().contentType(image.mediaType()).cacheControl(CacheControl.noStore())
                .body(image.resource());
    }
}
