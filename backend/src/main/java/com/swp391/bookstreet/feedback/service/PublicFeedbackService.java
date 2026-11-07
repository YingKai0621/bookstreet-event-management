package com.swp391.bookstreet.feedback.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.response.FieldValidationError;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.entity.EventStatus;
import com.swp391.bookstreet.event.repository.EventRepository;
import com.swp391.bookstreet.feedback.dto.CreatePublicFeedbackRequest;
import com.swp391.bookstreet.feedback.dto.PublicFeedbackReceiptResponse;
import com.swp391.bookstreet.feedback.entity.GeneralFeedback;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import com.swp391.bookstreet.feedback.repository.GeneralFeedbackRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicFeedbackService {
    private static final Set<EventStatus> PUBLIC_DETAIL_EVENT_STATUSES = EnumSet.of(
            EventStatus.PUBLISHED,
            EventStatus.ONGOING,
            EventStatus.COMPLETED,
            EventStatus.CANCELLED
    );
    private static final Pattern WHITESPACE_RUN = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    private final GeneralFeedbackRepository feedbackRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final FeedbackRateLimiter rateLimiter;
    private final Validator validator;
    private final Clock clock;

    public PublicFeedbackService(
            GeneralFeedbackRepository feedbackRepository,
            EventRepository eventRepository,
            UserRepository userRepository,
            FeedbackRateLimiter rateLimiter,
            Validator validator,
            Clock clock
    ) {
        this.feedbackRepository = feedbackRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.rateLimiter = rateLimiter;
        this.validator = validator;
        this.clock = clock;
    }

    @Transactional
    public PublicFeedbackReceiptResponse submit(
            CreatePublicFeedbackRequest request,
            Long authenticatedUserId,
            String remoteAddress
    ) {
        rateLimiter.countAttempt(authenticatedUserId, remoteAddress);
        NormalizedSubmission submission = validateAndNormalize(request);

        Event event = null;
        if (submission.targetType() == GeneralFeedbackTargetType.EVENT) {
            event = eventRepository.findByEventIdAndStatusIn(
                            submission.eventId(), PUBLIC_DETAIL_EVENT_STATUSES)
                    .orElseThrow(() -> new FeedbackApiException(
                            HttpStatus.NOT_FOUND,
                            "EVENT_NOT_FOUND",
                            "Không tìm thấy sự kiện."
                    ));
        }

        User submittedBy = authenticatedUserId == null ? null : userRepository.findById(authenticatedUserId)
                .orElseThrow(this::internalError);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        GeneralFeedback feedback = GeneralFeedback.create(
                submittedBy,
                submission.targetType(),
                event,
                submission.guestName(),
                submission.contactEmail(),
                submission.message(),
                now
        );

        try {
            GeneralFeedback saved = feedbackRepository.saveAndFlush(feedback);
            return new PublicFeedbackReceiptResponse(saved.getGeneralFeedbackId(), saved.getSubmittedAt());
        } catch (DataIntegrityViolationException exception) {
            throw internalError();
        }
    }

    private NormalizedSubmission validateAndNormalize(CreatePublicFeedbackRequest request) {
        List<FieldValidationError> errors = new ArrayList<>();
        if (request == null) {
            errors.add(new FieldValidationError("targetType", "Phạm vi góp ý là bắt buộc."));
            errors.add(new FieldValidationError("message", "Nội dung góp ý là bắt buộc."));
            throw validationFailed(errors);
        }

        GeneralFeedbackTargetType targetType = request.targetType();
        Long eventId = request.eventId();
        if (targetType == null) {
            errors.add(new FieldValidationError("targetType", "Phạm vi góp ý là bắt buộc."));
        } else if (targetType == GeneralFeedbackTargetType.BOOK_STREET && eventId != null) {
            errors.add(new FieldValidationError("eventId", "Không được gửi eventId cho góp ý toàn Đường Sách."));
        } else if (targetType == GeneralFeedbackTargetType.EVENT && (eventId == null || eventId <= 0)) {
            errors.add(new FieldValidationError("eventId", "Sự kiện là bắt buộc và phải có mã hợp lệ."));
        }

        String guestName = normalizeCollapsedOptional(request.guestName());
        if (guestName != null && characterLength(guestName) > 100) {
            errors.add(new FieldValidationError("guestName", "Tên khách phải có từ 1 đến 100 ký tự."));
        }

        String contactEmail = normalizeEmail(request.contactEmail());
        if (contactEmail != null) {
            int emailLength = characterLength(contactEmail);
            Set<ConstraintViolation<CreatePublicFeedbackRequest>> emailViolations = validator.validateValue(
                    CreatePublicFeedbackRequest.class,
                    "contactEmail",
                    contactEmail
            );
            if (emailLength < 3 || emailLength > 255 || !emailViolations.isEmpty()) {
                errors.add(new FieldValidationError("contactEmail", "Email liên hệ không hợp lệ."));
            }
        }

        String message = normalizeMessage(request.message());
        int messageLength = message == null ? 0 : characterLength(message);
        if (messageLength < 10 || messageLength > 2000) {
            errors.add(new FieldValidationError("message", "Nội dung góp ý phải có từ 10 đến 2000 ký tự."));
        }

        if (!errors.isEmpty()) {
            throw validationFailed(errors);
        }
        return new NormalizedSubmission(targetType, eventId, guestName, contactEmail, message);
    }

    private String normalizeCollapsedOptional(String value) {
        if (value == null) return null;
        String normalized = WHITESPACE_RUN.matcher(value.strip()).replaceAll(" ");
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeEmail(String value) {
        if (value == null) return null;
        String normalized = value.strip().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeMessage(String value) {
        if (value == null) return null;
        String normalized = value.replace("\r\n", "\n").replace('\r', '\n').strip();
        return normalized.isEmpty() ? null : normalized;
    }

    private int characterLength(String value) {
        return value.codePointCount(0, value.length());
    }

    private FeedbackApiException validationFailed(List<FieldValidationError> errors) {
        return new FeedbackApiException(
                HttpStatus.UNPROCESSABLE_CONTENT,
                "VALIDATION_FAILED",
                "Dữ liệu không hợp lệ.",
                errors,
                null
        );
    }

    private FeedbackApiException internalError() {
        return new FeedbackApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Không thể tiếp nhận góp ý vào lúc này."
        );
    }

    private record NormalizedSubmission(
            GeneralFeedbackTargetType targetType,
            Long eventId,
            String guestName,
            String contactEmail,
            String message
    ) {
    }
}
