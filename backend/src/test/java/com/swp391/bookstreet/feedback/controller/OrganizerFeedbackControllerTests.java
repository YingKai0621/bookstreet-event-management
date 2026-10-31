package com.swp391.bookstreet.feedback.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackDetailResponse;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackPageResponse;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackStatus;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import com.swp391.bookstreet.feedback.exception.FeedbackApiExceptionHandler;
import com.swp391.bookstreet.feedback.service.OrganizerFeedbackService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class OrganizerFeedbackControllerTests {
    private static final String PATH = "/api/v1/organizer/feedbacks";

    @Mock OrganizerFeedbackService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new OrganizerFeedbackController(service))
                .setControllerAdvice(new FeedbackApiExceptionHandler())
                .build();
    }

    @Test
    void listForwardsServerQueryAndReturnsNoStore() throws Exception {
        when(service.list(
                "2", "10", "submittedAt,asc", "sách", "Minh An", "Ngày hội", "EVENT", "7", "NEW"
        ))
                .thenReturn(new OrganizerFeedbackPageResponse(List.of(), 2, 10, 0, 0));

        mvc.perform(get(PATH)
                        .queryParam("page", "2")
                        .queryParam("size", "10")
                        .queryParam("sort", "submittedAt,asc")
                        .queryParam("search", "sách")
                        .queryParam("senderSearch", "Minh An")
                        .queryParam("eventNameSearch", "Ngày hội")
                        .queryParam("targetType", "EVENT")
                        .queryParam("eventId", "7")
                        .queryParam("status", "NEW"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void transitionUsesSessionIdentityAndReturnsCommittedDetail() throws Exception {
        OrganizerFeedbackDetailResponse detail = detail(101L, GeneralFeedbackStatus.IN_PROGRESS);
        when(service.startHandling("101", 12L)).thenReturn(detail);

        mvc.perform(post(PATH + "/101/start-handling")
                        .principal(authentication(12L)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.feedbackId").value(101))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        verify(service).startHandling("101", 12L);
    }

    @Test
    void rejectsUnknownTransitionFieldBeforeServiceInvocation() throws Exception {
        mvc.perform(post(PATH + "/101/reopen")
                        .principal(authentication(12L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));

        verifyNoInteractions(service);
    }

    @Test
    void resolveAcceptsOnlyInternalNote() throws Exception {
        when(service.resolve(eq("101"), eq(12L), any()))
                .thenReturn(detail(101L, GeneralFeedbackStatus.RESOLVED));

        mvc.perform(post(PATH + "/101/resolve")
                        .principal(authentication(12L))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"internalNote\":\"Đã xử lý.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVED"));
    }

    @Test
    void databaseFailureReturnsCanonicalPrivateError() throws Exception {
        when(service.list("0", "20", "submittedAt,desc", null, null, null, null, null, null))
                .thenThrow(new DataAccessResourceFailureException(
                        "select contact_email, internal_note from private_table"
                ));

        mvc.perform(get(PATH))
                .andExpect(status().isInternalServerError())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("Không thể xử lý góp ý lúc này."))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("contact_email")
                )));
    }

    private UsernamePasswordAuthenticationToken authentication(Long userId) {
        return new UsernamePasswordAuthenticationToken(new Identity(userId), null, List.of());
    }

    private OrganizerFeedbackDetailResponse detail(Long id, GeneralFeedbackStatus status) {
        Instant now = Instant.parse("2026-10-31T08:20:00Z");
        return new OrganizerFeedbackDetailResponse(
                id,
                GeneralFeedbackTargetType.BOOK_STREET,
                null,
                null,
                null,
                null,
                "Nội dung góp ý hợp lệ.",
                status,
                status == GeneralFeedbackStatus.RESOLVED ? "Đã xử lý." : null,
                null,
                now,
                now,
                status == GeneralFeedbackStatus.NEW ? null : now,
                status == GeneralFeedbackStatus.RESOLVED ? now : null
        );
    }

    private record Identity(Long userId) implements AuthenticatedPrincipal {
        @Override public boolean emailVerified() { return true; }
    }
}
