package com.swp391.bookstreet.reward.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.common.exception.GlobalExceptionHandler;
import com.swp391.bookstreet.reward.exception.RewardApiExceptionHandler;
import com.swp391.bookstreet.reward.service.ParticipantBoothVisitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ParticipantBoothVisitControllerTests {
    private ParticipantBoothVisitService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(ParticipantBoothVisitService.class);
        mvc = MockMvcBuilders.standaloneSetup(new ParticipantBoothVisitController(service))
                .setControllerAdvice(new RewardApiExceptionHandler(),
                        new GlobalExceptionHandler())
                .build();
    }

    @Test
    void missingBodyIsMalformedRequest() throws Exception {
        mvc.perform(post("/api/v1/participant/booth-visits/scan")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        verifyNoInteractions(service);
    }

    @Test
    void blankTokenIsValidationFailureWithRequiredFieldCode() throws Exception {
        mvc.perform(post("/api/v1/participant/booth-visits/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"   \"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("token"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("REQUIRED"));
        verifyNoInteractions(service);
    }

    @Test
    void unknownFieldIsRejectedWithoutEchoingItsValue() throws Exception {
        mvc.perform(post("/api/v1/participant/booth-visits/scan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"safe\",\"points\":999}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"))
                .andExpect(jsonPath("$.message")
                        .value("Request contains an unsupported field."));
        verifyNoInteractions(service);
    }
}
