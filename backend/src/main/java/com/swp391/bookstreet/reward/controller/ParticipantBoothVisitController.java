package com.swp391.bookstreet.reward.controller;

import com.swp391.bookstreet.reward.dto.BoothScanRequest;
import com.swp391.bookstreet.reward.dto.BoothScanResponse;
import com.swp391.bookstreet.reward.service.ParticipantBoothVisitService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant/booth-visits")
public class ParticipantBoothVisitController {
    private final ParticipantBoothVisitService service;

    public ParticipantBoothVisitController(ParticipantBoothVisitService service) {
        this.service = service;
    }

    @PostMapping("/scan")
    public BoothScanResponse scan(@Valid @RequestBody BoothScanRequest request) {
        return service.scan(request.token());
    }
}
