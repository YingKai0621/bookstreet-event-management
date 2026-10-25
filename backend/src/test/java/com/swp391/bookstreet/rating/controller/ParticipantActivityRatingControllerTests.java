package com.swp391.bookstreet.rating.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.common.exception.GlobalExceptionHandler;
import com.swp391.bookstreet.rating.dto.ActivityRatingRequest;
import com.swp391.bookstreet.rating.dto.ActivityRatingResponse;
import com.swp391.bookstreet.rating.service.ParticipantActivityRatingService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ParticipantActivityRatingControllerTests {

    private static final String BASE_URL = "/api/v1/participant/activities/91/rating";
    private static final Instant NOW = Instant.parse("2027-01-11T03:10:00Z");

    @Mock
    private ParticipantActivityRatingService service;

    @InjectMocks
    private ParticipantActivityRatingController controller;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getRatingReturns200WithRatingData() throws Exception {
        ActivityRatingResponse response = new ActivityRatingResponse(
                701L, 91L, (short) 5, "Nội dung hữu ích và tổ chức tốt.",
                "ACTIVE", NOW, NOW, null);

        when(service.getRating(91L)).thenReturn(response);

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityRatingId").value(701))
                .andExpect(jsonPath("$.activityId").value(91))
                .andExpect(jsonPath("$.score").value(5))
                .andExpect(jsonPath("$.comment").value("Nội dung hữu ích và tổ chức tốt."))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.invalidatedAt").doesNotExist());
    }

    @Test
    void getRatingReturns404WhenNotFound() throws Exception {
        when(service.getRating(91L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "ACTIVITY_RATING_NOT_FOUND",
                        "Activity rating not found."));

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACTIVITY_RATING_NOT_FOUND"));
    }

    @Test
    void rateReturns200WithUpdatedRating() throws Exception {
        ActivityRatingRequest request = new ActivityRatingRequest(5, "Nội dung hữu ích và tổ chức tốt.");
        ActivityRatingResponse response = new ActivityRatingResponse(
                701L, 91L, (short) 5, "Nội dung hữu ích và tổ chức tốt.",
                "ACTIVE", NOW, NOW, null);

        when(service.rate(eq(91L), any(ActivityRatingRequest.class))).thenReturn(response);

        mockMvc.perform(put(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityRatingId").value(701))
                .andExpect(jsonPath("$.activityId").value(91))
                .andExpect(jsonPath("$.score").value(5))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void rateReturns409WhenActivityNotCompleted() throws Exception {
        ActivityRatingRequest request = new ActivityRatingRequest(5, "Tốt");

        when(service.rate(eq(91L), any(ActivityRatingRequest.class)))
                .thenThrow(new ApiException(HttpStatus.CONFLICT, "RATING_ACTIVITY_NOT_COMPLETED",
                        "Rating requires completed Activity."));

        mockMvc.perform(put(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RATING_ACTIVITY_NOT_COMPLETED"));
    }

    @Test
    void rateReturns409WhenAttendanceVoided() throws Exception {
        ActivityRatingRequest request = new ActivityRatingRequest(5, "Tốt");

        when(service.rate(eq(91L), any(ActivityRatingRequest.class)))
                .thenThrow(new ApiException(HttpStatus.CONFLICT, "RATING_ATTENDANCE_VOIDED",
                        "Cannot rate with voided Attendance."));

        mockMvc.perform(put(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RATING_ATTENDANCE_VOIDED"));
    }

    @Test
    void rateReturns422WhenScoreInvalid() throws Exception {
        ActivityRatingRequest request = new ActivityRatingRequest(6, "Tốt");

        when(service.rate(eq(91L), any(ActivityRatingRequest.class)))
                .thenThrow(new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "RATING_SCORE_INVALID",
                        "Score must be an integer from 1 to 5."));

        mockMvc.perform(put(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("RATING_SCORE_INVALID"));
    }
}
