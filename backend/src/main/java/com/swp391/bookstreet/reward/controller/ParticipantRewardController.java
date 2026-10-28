package com.swp391.bookstreet.reward.controller;

import com.swp391.bookstreet.reward.dto.ParticipantBadgeResponse;
import com.swp391.bookstreet.reward.dto.PointTransactionResponse;
import com.swp391.bookstreet.reward.dto.RewardPageResponse;
import com.swp391.bookstreet.reward.dto.RewardSummaryResponse;
import com.swp391.bookstreet.reward.service.ParticipantRewardQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant/rewards")
public class ParticipantRewardController {
    private final ParticipantRewardQueryService service;

    public ParticipantRewardController(ParticipantRewardQueryService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public RewardSummaryResponse summary() {
        return service.summary();
    }

    @GetMapping("/point-transactions")
    public RewardPageResponse<PointTransactionResponse> pointTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) Long boothId) {
        return service.pointTransactions(page, size, sort, eventId, boothId);
    }

    @GetMapping("/badges")
    public RewardPageResponse<ParticipantBadgeResponse> badges(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "ALL") String state,
            @RequestParam(required = false) String sort) {
        return service.badges(page, size, state, sort);
    }
}
