package com.swp391.bookstreet.attendance.controller;

import com.swp391.bookstreet.attendance.dto.AttendanceScanRequest;
import com.swp391.bookstreet.attendance.dto.AttendanceScanResponse;
import com.swp391.bookstreet.attendance.service.ParticipantAttendanceService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/participant/attendance-scans")
public class ParticipantAttendanceController {
    private final ParticipantAttendanceService service;

    public ParticipantAttendanceController(ParticipantAttendanceService service) { this.service = service; }

    @PostMapping
    @Operation(summary = "Self-scan the shared Activity QR", description = "AC-P03-02 through AC-P03-07; Session and CSRF required.")
    public AttendanceScanResponse scan(@RequestBody AttendanceScanRequest request) {
        return service.scan(request == null ? null : request.token());
    }
}
