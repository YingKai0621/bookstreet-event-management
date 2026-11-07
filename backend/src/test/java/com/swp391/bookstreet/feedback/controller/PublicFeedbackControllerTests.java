package com.swp391.bookstreet.feedback.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.feedback.dto.CreatePublicFeedbackRequest;
import com.swp391.bookstreet.feedback.dto.PublicFeedbackReceiptResponse;
import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import com.swp391.bookstreet.feedback.exception.FeedbackApiExceptionHandler;
import com.swp391.bookstreet.feedback.service.PublicFeedbackService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class PublicFeedbackControllerTests {
    private static final String PATH = "/api/v1/public/feedbacks";

    @Mock PublicFeedbackService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new PublicFeedbackController(service))
                .setControllerAdvice(new FeedbackApiExceptionHandler())
                .build();
    }

    @Test
    void returnsMinimalCreatedReceiptWithoutLocationHeader() throws Exception {
        Instant receivedAt = Instant.parse("2026-10-31T08:20:00Z");
        when(service.submit(any(CreatePublicFeedbackRequest.class), isNull(), anyString()))
                .thenReturn(new PublicFeedbackReceiptResponse(101L, receivedAt));

        mvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "targetType":"BOOK_STREET",
                                  "message":"Không gian Đường Sách rất thân thiện."
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().doesNotExist("Location"))
                .andExpect(jsonPath("$.feedbackId").value(101))
                .andExpect(jsonPath("$.receivedAt").value("2026-10-31T08:20:00Z"))
                .andExpect(jsonPath("$.status").doesNotExist())
                .andExpect(jsonPath("$.contactEmail").doesNotExist());
    }

    @Test
    void rejectsLegacyUnknownFieldBeforeServiceInvocation() throws Exception {
        mvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "targetType":"BOOK_STREET",
                                  "message":"Không gian Đường Sách rất thân thiện.",
                                  "rating":5
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));

        verifyNoInteractions(service);
    }

    @Test
    void rejectsUnsupportedTargetEnum() throws Exception {
        mvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType":"HERITAGE","message":"Nội dung góp ý hợp lệ."}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ENUM_VALUE"));
    }

    @Test
    void rateLimitResponseIncludesRetryAfterAndNoStore() throws Exception {
        when(service.submit(any(CreatePublicFeedbackRequest.class), isNull(), anyString()))
                .thenThrow(new FeedbackApiException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "FEEDBACK_RATE_LIMITED",
                        "Bạn đã gửi quá nhiều góp ý. Vui lòng thử lại sau.",
                        List.of(),
                        214L
                ));

        mvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType":"BOOK_STREET","message":"Nội dung góp ý hợp lệ."}
                                """))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "214"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("FEEDBACK_RATE_LIMITED"));
    }
}
