package com.swp391.bookstreet.registration.controller;

import com.swp391.bookstreet.registration.dto.ActivityRegistrationResponse;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import com.swp391.bookstreet.registration.service.ParticipantActivityRegistrationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant")
public class ParticipantActivityRegistrationController {
    private final ParticipantActivityRegistrationService service;

    public ParticipantActivityRegistrationController(
            ParticipantActivityRegistrationService service) {
        this.service = service;
    }

    @GetMapping("/activity-registrations")
    public RegistrationPageResponse<ActivityRegistrationResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "activityStartAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) String registrationStatus,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String activityStatus,
            @RequestParam(required = false) String search) {
        return service.list(page, size, sort, eventId, registrationStatus, outcome,
                activityStatus, search);
    }

    @GetMapping("/activity-registrations/{activityRegistrationId}")
    public ActivityRegistrationResponse detail(@PathVariable Long activityRegistrationId) {
        return service.detail(activityRegistrationId);
    }

    @PostMapping("/activities/{activityId}/register")
    public ActivityRegistrationResponse register(@PathVariable Long activityId) {
        return service.register(activityId);
    }

    @PostMapping("/activities/{activityId}/cancel-registration")
    public ActivityRegistrationResponse cancel(@PathVariable Long activityId) {
        return service.cancel(activityId);
    }
}
