package com.swp391.bookstreet.attendance.controller;

import com.swp391.bookstreet.attendance.dto.*;
import com.swp391.bookstreet.attendance.service.OrganizerParticipationService;
import com.swp391.bookstreet.attendance.service.OrganizerAttendanceCorrectionService;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/organizer")
public class OrganizerParticipationController {
    private final OrganizerParticipationService service;
    private final OrganizerAttendanceCorrectionService corrections;

    public OrganizerParticipationController(OrganizerParticipationService service,
            OrganizerAttendanceCorrectionService corrections) {
        this.service = service; this.corrections = corrections;
    }

    @GetMapping("/events/{eventId}/event-registrations")
    @Operation(summary = "List owned Event participation", description = "AC-O07-01/02")
    public RegistrationPageResponse<OrganizerEventRegistrationResponse> events(@PathVariable Long eventId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "activatedAt,desc") String sort,
            @RequestParam(required = false) String status, @RequestParam(required = false) String search) {
        return service.events(eventId, page, size, sort, status, search);
    }

    @GetMapping("/activities/{activityId}/registrations")
    @Operation(summary = "List owned Activity registration and Attendance outcomes", description = "AC-O07-01/02")
    public RegistrationPageResponse<OrganizerParticipationResponse> activities(@PathVariable Long activityId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "registeredAt,asc") String sort,
            @RequestParam(required = false) String registrationStatus,
            @RequestParam(required = false) String outcome,
            @RequestParam(required = false) String attendanceStatus,
            @RequestParam(required = false) String search) {
        return service.activities(activityId, page, size, sort, registrationStatus, outcome, attendanceStatus, search);
    }

    @GetMapping("/activity-registrations/{registrationId}")
    @Operation(summary = "Read participation detail within the Organizer's Event")
    public OrganizerParticipationResponse detail(@PathVariable Long registrationId) { return service.detail(registrationId); }

    @GetMapping("/activity-registrations/{registrationId}/attendance-adjustments")
    @Operation(summary = "Read immutable Attendance correction history")
    public RegistrationPageResponse<AttendanceAdjustmentResponse> history(@PathVariable Long registrationId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "adjustedAt,desc") String sort) {
        return service.history(registrationId, page, size, sort);
    }

    @PostMapping("/activity-registrations/{registrationId}/attendance-adjustments")
    @Operation(summary = "Correct Attendance with an immutable audit", description = "AC-O07-03 through AC-O07-10; UUID Idempotency-Key required.")
    public AttendanceCorrectionResponse correct(@PathVariable Long registrationId,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody AttendanceCorrectionRequest request) {
        return corrections.correct(registrationId, key, request);
    }
}
