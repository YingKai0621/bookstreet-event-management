package com.swp391.bookstreet.rating.controller;

import com.swp391.bookstreet.rating.dto.ActivityRatingRequest;
import com.swp391.bookstreet.rating.dto.ActivityRatingResponse;
import com.swp391.bookstreet.rating.service.ParticipantActivityRatingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant/activities/{activityId}/rating")
public class ParticipantActivityRatingController {

    private final ParticipantActivityRatingService service;

    public ParticipantActivityRatingController(ParticipantActivityRatingService service) {
        this.service = service;
    }

    @GetMapping
    public ActivityRatingResponse getRating(@PathVariable Long activityId) {
        return service.getRating(activityId);
    }

    @PutMapping
    public ActivityRatingResponse rate(
            @PathVariable Long activityId,
            @RequestBody ActivityRatingRequest request) {
        return service.rate(activityId, request);
    }
}
