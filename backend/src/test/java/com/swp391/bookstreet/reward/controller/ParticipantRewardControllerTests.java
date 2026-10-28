package com.swp391.bookstreet.reward.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.common.exception.GlobalExceptionHandler;
import com.swp391.bookstreet.reward.dto.RewardPageResponse;
import com.swp391.bookstreet.reward.exception.RewardApiExceptionHandler;
import com.swp391.bookstreet.reward.service.ParticipantRewardQueryService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ParticipantRewardControllerTests {
    private ParticipantRewardQueryService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(ParticipantRewardQueryService.class);
        mvc = MockMvcBuilders.standaloneSetup(new ParticipantRewardController(service))
                .setControllerAdvice(new RewardApiExceptionHandler(),
                        new GlobalExceptionHandler())
                .build();
    }

    @Test
    void pointHistoryForwardsApprovedPaginationSortAndFilters() throws Exception {
        org.mockito.Mockito.when(service.pointTransactions(
                        2, 15, "points,asc", 7L, 22L))
                .thenReturn(new RewardPageResponse<>(List.of(), 2, 15, 0, 0));

        mvc.perform(get("/api/v1/participant/rewards/point-transactions")
                        .param("page", "2")
                        .param("size", "15")
                        .param("sort", "points,asc")
                        .param("eventId", "7")
                        .param("boothId", "22"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());

        verify(service).pointTransactions(2, 15, "points,asc", 7L, 22L);
    }

    @Test
    void badgeQueryKeepsNullSortForContractDefaultOrdering() throws Exception {
        org.mockito.Mockito.when(service.badges(0, 20, "ALL", null))
                .thenReturn(new RewardPageResponse<>(List.of(), 0, 20, 0, 0));

        mvc.perform(get("/api/v1/participant/rewards/badges"))
                .andExpect(status().isOk());

        verify(service).badges(0, 20, "ALL", null);
    }

    @Test
    void malformedIdentityUsesCanonicalInvalidFilterResponse() throws Exception {
        mvc.perform(get("/api/v1/participant/rewards/point-transactions")
                        .param("eventId", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));

        verifyNoInteractions(service);
    }
}
