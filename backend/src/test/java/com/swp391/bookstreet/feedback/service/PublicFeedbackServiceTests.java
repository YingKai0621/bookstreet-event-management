package com.swp391.bookstreet.feedback.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.feedback.dto.CreatePublicFeedbackRequest;
import com.swp391.bookstreet.feedback.entity.GeneralFeedback;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import com.swp391.bookstreet.feedback.repository.GeneralFeedbackRepository;
import jakarta.validation.Validation;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PublicFeedbackServiceTests {
    private static final Instant NOW = Instant.parse("2026-10-31T08:20:00.123456Z");

    @Mock GeneralFeedbackRepository feedbackRepository;
    @Mock EventRepository eventRepository;
    @Mock UserRepository userRepository;
    @Mock FeedbackRateLimiter rateLimiter;

    private PublicFeedbackService service;

    @BeforeEach
    void setUp() {
        service = new PublicFeedbackService(
                feedbackRepository,
                eventRepository,
                userRepository,
                rateLimiter,
                Validation.buildDefaultValidatorFactory().getValidator(),
                Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    @Test
    void anonymousBookStreetSubmissionNormalizesAndPersistsNewFeedback() {
        when(feedbackRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            GeneralFeedback feedback = invocation.getArgument(0);
            ReflectionTestUtils.setField(feedback, "generalFeedbackId", 101L);
            return feedback;
        });

        var receipt = service.submit(new CreatePublicFeedbackRequest(
                GeneralFeedbackTargetType.BOOK_STREET,
                null,
                "  Minh   An  ",
                " MINHAN@EXAMPLE.COM ",
                "  Không gian rất thân thiện.\r\nTôi sẽ quay lại.  "
        ), null, "192.0.2.10");

        assertThat(receipt.feedbackId()).isEqualTo(101L);
        assertThat(receipt.receivedAt()).isEqualTo(NOW);
        ArgumentCaptor<GeneralFeedback> captor = ArgumentCaptor.forClass(GeneralFeedback.class);
        verify(feedbackRepository).saveAndFlush(captor.capture());
        GeneralFeedback saved = captor.getValue();
        assertThat(saved.getGuestName()).isEqualTo("Minh An");
        assertThat(saved.getContactEmail()).isEqualTo("minhan@example.com");
        assertThat(saved.getMessage()).isEqualTo("Không gian rất thân thiện.\nTôi sẽ quay lại.");
        assertThat(saved.getSubmittedBy()).isNull();
        verify(rateLimiter).countAttempt(null, "192.0.2.10");
    }

    @Test
    void validSessionIsAssociatedFromServerIdentity() {
        User user = new User("participant1", "p@example.com", "hash", "Participant One");
        when(userRepository.findById(31L)).thenReturn(Optional.of(user));
        when(feedbackRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            GeneralFeedback feedback = invocation.getArgument(0);
            ReflectionTestUtils.setField(feedback, "generalFeedbackId", 102L);
            return feedback;
        });

        service.submit(new CreatePublicFeedbackRequest(
                GeneralFeedbackTargetType.BOOK_STREET,
                null,
                null,
                null,
                "Nội dung góp ý hợp lệ."
        ), 31L, "192.0.2.10");

        ArgumentCaptor<GeneralFeedback> captor = ArgumentCaptor.forClass(GeneralFeedback.class);
        verify(feedbackRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getSubmittedBy()).isSameAs(user);
        verify(rateLimiter).countAttempt(31L, "192.0.2.10");
    }

    @Test
    void invalidRelationshipAndTextReturnFieldErrorsAfterCountingAttempt() {
        assertThatThrownBy(() -> service.submit(new CreatePublicFeedbackRequest(
                GeneralFeedbackTargetType.BOOK_STREET,
                7L,
                null,
                "not-an-email",
                "ngắn"
        ), null, "192.0.2.10"))
                .isInstanceOfSatisfying(FeedbackApiException.class, error -> {
                    assertThat(error.getCode()).isEqualTo("VALIDATION_FAILED");
                    assertThat(error.getFieldErrors()).extracting("field")
                            .containsExactly("eventId", "contactEmail", "message");
                });

        verify(rateLimiter).countAttempt(null, "192.0.2.10");
    }

    @Test
    void privateOrMissingEventUsesSamePublicNotFoundError() {
        when(eventRepository.findByEventIdAndStatusIn(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.submit(new CreatePublicFeedbackRequest(
                GeneralFeedbackTargetType.EVENT,
                7L,
                null,
                null,
                "Nội dung góp ý cho sự kiện."
        ), null, "192.0.2.10"))
                .isInstanceOfSatisfying(FeedbackApiException.class, error -> {
                    assertThat(error.getCode()).isEqualTo("EVENT_NOT_FOUND");
                    assertThat(error.getStatus().value()).isEqualTo(404);
                });
    }

    @Test
    void persistenceFailureReturnsInternalErrorInsteadOfSuccessReceipt() {
        when(feedbackRepository.saveAndFlush(any()))
                .thenThrow(new DataIntegrityViolationException("test persistence failure"));

        assertThatThrownBy(() -> service.submit(new CreatePublicFeedbackRequest(
                GeneralFeedbackTargetType.BOOK_STREET,
                null,
                null,
                null,
                "Nội dung góp ý hợp lệ."
        ), null, "192.0.2.10"))
                .isInstanceOfSatisfying(FeedbackApiException.class, error -> {
                    assertThat(error.getCode()).isEqualTo("INTERNAL_ERROR");
                    assertThat(error.getStatus().value()).isEqualTo(500);
                });
    }
}
