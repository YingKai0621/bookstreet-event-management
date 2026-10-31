package com.swp391.bookstreet.feedback.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackPageResponse;
import com.swp391.bookstreet.feedback.dto.ResolveFeedbackRequest;
import com.swp391.bookstreet.feedback.entity.GeneralFeedback;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackStatus;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import com.swp391.bookstreet.feedback.repository.GeneralFeedbackRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class OrganizerFeedbackServiceTests {
    private static final Instant SUBMITTED_AT = Instant.parse("2026-10-31T08:20:00Z");
    private static final Instant NOW = Instant.parse("2026-10-31T09:00:00Z");

    @Mock GeneralFeedbackRepository feedbackRepository;
    @Mock UserRepository userRepository;
    private OrganizerFeedbackService service;
    private User organizer;

    @BeforeEach
    void setUp() {
        service = new OrganizerFeedbackService(
                feedbackRepository,
                userRepository,
                Clock.fixed(NOW, ZoneOffset.UTC)
        );
        organizer = user(12L, "Ban Tổ chức Đường Sách");
    }

    @Test
    @SuppressWarnings("unchecked")
    void listsWithDeterministicSortAndPrivacySafePreview() {
        GeneralFeedback feedback = feedback(101L, "  Một\n\tnội dung   góp ý " + "a".repeat(180));
        when(feedbackRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(invocation -> new PageImpl<>(List.of(feedback), invocation.getArgument(1), 1));

        OrganizerFeedbackPageResponse response = service.list(
                "0", "20", "submittedAt,desc", "   ", "  ", null, null, null, "NEW");

        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.content().getFirst().messagePreview()).hasSize(160).endsWith("…");
        assertThat(response.content().getFirst().messagePreview()).doesNotContain("\n", "\t", "  ");
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(feedbackRepository).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getSort().getOrderFor("submittedAt").isDescending()).isTrue();
        assertThat(pageable.getValue().getSort().getOrderFor("generalFeedbackId").isDescending()).isTrue();
    }

    @Test
    void rejectsEveryInvalidQueryFamilyWithStableCodes() {
        assertCode(() -> service.list("-1", "20", "submittedAt,desc", null, null, null, null, null, null),
                "INVALID_PAGE");
        assertCode(() -> service.list("0", "101", "submittedAt,desc", null, null, null, null, null, null),
                "INVALID_SIZE");
        assertCode(() -> service.list("0", "20", "status,asc", null, null, null, null, null, null),
                "INVALID_SORT");
        assertCode(() -> service.list("0", "20", "submittedAt,desc", null, null, null, "HERITAGE", null, null),
                "INVALID_ENUM_VALUE");
        assertCode(() -> service.list("0", "20", "submittedAt,desc", null, null, null, "BOOK_STREET", "7", null),
                "INVALID_FILTER");
        assertCode(() -> service.list("0", "20", "submittedAt,desc", null, null, "Ngày hội", "BOOK_STREET", null, null),
                "INVALID_FILTER");
        assertCode(() -> service.list("0", "20", "submittedAt,desc", "x".repeat(101), null, null, null, null, null),
                "INVALID_FILTER");
        assertCode(() -> service.list("0", "20", "submittedAt,desc", null, "x".repeat(101), null, null, null, null),
                "INVALID_FILTER");
        assertCode(() -> service.list("0", "20", "submittedAt,desc", null, null, "x".repeat(101), null, null, null),
                "INVALID_FILTER");
        assertCode(() -> service.detail("0"), "MALFORMED_REQUEST");
    }

    @Test
    void detailMapsPrivateContextWithoutMutatingFeedback() {
        User submitter = user(31L, "Nguyễn Minh An");
        GeneralFeedback feedback = feedback(101L, "Nội dung góp ý hợp lệ.");
        ReflectionTestUtils.setField(feedback, "submittedBy", submitter);
        ReflectionTestUtils.setField(feedback, "guestName", "Minh An");
        ReflectionTestUtils.setField(feedback, "contactEmail", "minhan@example.com");
        when(feedbackRepository.findDetailById(101L)).thenReturn(Optional.of(feedback));

        var response = service.detail("101");

        assertThat(response.submitter().userId()).isEqualTo(31L);
        assertThat(response.guestName()).isEqualTo("Minh An");
        assertThat(response.contactEmail()).isEqualTo("minhan@example.com");
        assertThat(response.status()).isEqualTo(GeneralFeedbackStatus.NEW);
        assertThat(response.toString())
                .doesNotContain("minhan@example.com", "Nguyễn Minh An", "Nội dung góp ý hợp lệ.");
        verify(feedbackRepository, never()).saveAndFlush(any());
    }

    @Test
    void performsAllLegalTransitionsAndRetainsInternalNoteOnReopen() {
        GeneralFeedback feedback = feedback(101L, "Nội dung góp ý hợp lệ.");
        when(feedbackRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(feedback));
        when(userRepository.findById(12L)).thenReturn(Optional.of(organizer));
        when(feedbackRepository.saveAndFlush(feedback)).thenReturn(feedback);

        var started = service.startHandling("101", 12L);
        assertThat(started.status()).isEqualTo(GeneralFeedbackStatus.IN_PROGRESS);
        assertThat(started.handlingStartedAt()).isEqualTo(NOW);

        var resolved = service.resolve("101", 12L, new ResolveFeedbackRequest("  Đã   xử lý xong. "));
        assertThat(resolved.status()).isEqualTo(GeneralFeedbackStatus.RESOLVED);
        assertThat(resolved.internalNote()).isEqualTo("Đã xử lý xong.");
        assertThat(resolved.resolvedAt()).isEqualTo(NOW);

        var reopened = service.reopen("101", 12L);
        assertThat(reopened.status()).isEqualTo(GeneralFeedbackStatus.IN_PROGRESS);
        assertThat(reopened.resolvedAt()).isNull();
        assertThat(reopened.internalNote()).isEqualTo("Đã xử lý xong.");
        assertThat(reopened.lastHandledBy().userId()).isEqualTo(12L);
    }

    @Test
    void rejectsStaleTransitionBeforeChangingActorOrTimestamps() {
        GeneralFeedback feedback = feedback(101L, "Nội dung góp ý hợp lệ.");
        feedback.startHandling(organizer, SUBMITTED_AT.plusSeconds(60));
        when(feedbackRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(feedback));

        assertCode(() -> service.startHandling("101", 12L), "FEEDBACK_TRANSITION_CONFLICT");
        assertThat(feedback.getLastHandledBy()).isSameAs(organizer);
        assertThat(feedback.getHandlingStartedAt()).isEqualTo(SUBMITTED_AT.plusSeconds(60));
        verify(userRepository, never()).findById(any());
        verify(feedbackRepository, never()).saveAndFlush(any());
    }

    @Test
    void validatesResolveNoteAfterLockAndLeavesRowInProgress() {
        GeneralFeedback feedback = feedback(101L, "Nội dung góp ý hợp lệ.");
        feedback.startHandling(organizer, SUBMITTED_AT.plusSeconds(60));
        when(feedbackRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(feedback));

        assertCode(() -> service.resolve("101", 12L, new ResolveFeedbackRequest("   ")),
                "VALIDATION_FAILED");
        assertCode(() -> service.resolve("101", 12L, new ResolveFeedbackRequest("x".repeat(1001))),
                "VALIDATION_FAILED");
        assertThat(feedback.getStatus()).isEqualTo(GeneralFeedbackStatus.IN_PROGRESS);
        assertThat(feedback.getInternalNote()).isNull();
        verify(userRepository, never()).findById(any());
        verify(feedbackRepository, never()).saveAndFlush(any());
    }

    private GeneralFeedback feedback(Long id, String message) {
        GeneralFeedback feedback = GeneralFeedback.create(
                null,
                GeneralFeedbackTargetType.BOOK_STREET,
                null,
                null,
                null,
                message,
                SUBMITTED_AT
        );
        ReflectionTestUtils.setField(feedback, "generalFeedbackId", id);
        return feedback;
    }

    private User user(Long id, String fullName) {
        User user = new User("user" + id, "user" + id + "@example.com", "hash", fullName);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private void assertCode(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable, String code) {
        assertThatThrownBy(callable)
                .isInstanceOf(FeedbackApiException.class)
                .extracting(exception -> ((FeedbackApiException) exception).getCode())
                .isEqualTo(code);
    }
}
