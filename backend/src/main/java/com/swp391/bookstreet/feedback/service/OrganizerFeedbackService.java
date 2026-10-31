package com.swp391.bookstreet.feedback.service;

import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.response.FieldValidationError;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.feedback.dto.FeedbackEventBriefResponse;
import com.swp391.bookstreet.feedback.dto.FeedbackUserBriefResponse;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackDetailResponse;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackListItemResponse;
import com.swp391.bookstreet.feedback.dto.OrganizerFeedbackPageResponse;
import com.swp391.bookstreet.feedback.dto.ResolveFeedbackRequest;
import com.swp391.bookstreet.feedback.entity.GeneralFeedback;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackStatus;
import com.swp391.bookstreet.feedback.entity.GeneralFeedbackTargetType;
import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import com.swp391.bookstreet.feedback.repository.GeneralFeedbackRepository;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizerFeedbackService {
    private static final Pattern WHITESPACE_RUN = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final int MAX_PREVIEW_CHARACTERS = 160;

    private final GeneralFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public OrganizerFeedbackService(
            GeneralFeedbackRepository feedbackRepository,
            UserRepository userRepository,
            Clock clock
    ) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public OrganizerFeedbackPageResponse list(
            String pageValue,
            String sizeValue,
            String sortValue,
            String searchValue,
            String senderSearchValue,
            String eventNameSearchValue,
            String targetTypeValue,
            String eventIdValue,
            String statusValue
    ) {
        int page = parsePage(pageValue);
        int size = parseSize(sizeValue);
        Sort sort = parseSort(sortValue);
        String messageSearch = normalizeSearch(searchValue, "Từ khóa nội dung");
        String senderSearch = normalizeSearch(senderSearchValue, "Từ khóa người gửi");
        String eventNameSearch = normalizeSearch(eventNameSearchValue, "Tên sự kiện");
        GeneralFeedbackTargetType targetType = parseTargetType(targetTypeValue);
        Long eventId = parseOptionalEventId(eventIdValue);
        GeneralFeedbackStatus status = parseStatus(statusValue);

        if ((eventId != null || eventNameSearch != null)
                && targetType == GeneralFeedbackTargetType.BOOK_STREET) {
            throw badRequest("INVALID_FILTER", "Bộ lọc sự kiện không phù hợp với phạm vi Đường Sách.");
        }

        Page<OrganizerFeedbackListItemResponse> result = feedbackRepository.findAll(
                specification(messageSearch, senderSearch, eventNameSearch, targetType, eventId, status),
                PageRequest.of(page, size, sort)
        ).map(this::toListItem);
        return OrganizerFeedbackPageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public OrganizerFeedbackDetailResponse detail(String feedbackIdValue) {
        Long feedbackId = parseFeedbackId(feedbackIdValue);
        GeneralFeedback feedback = feedbackRepository.findDetailById(feedbackId)
                .orElseThrow(this::notFound);
        return toDetail(feedback);
    }

    @Transactional
    public OrganizerFeedbackDetailResponse startHandling(String feedbackIdValue, Long organizerUserId) {
        GeneralFeedback feedback = lockFeedback(feedbackIdValue);
        requireState(feedback, GeneralFeedbackStatus.NEW);
        feedback.startHandling(currentOrganizer(organizerUserId), now());
        return flushAndMap(feedback);
    }

    @Transactional
    public OrganizerFeedbackDetailResponse resolve(
            String feedbackIdValue,
            Long organizerUserId,
            ResolveFeedbackRequest request
    ) {
        GeneralFeedback feedback = lockFeedback(feedbackIdValue);
        requireState(feedback, GeneralFeedbackStatus.IN_PROGRESS);
        String internalNote = normalizeInternalNote(request == null ? null : request.internalNote());
        feedback.resolve(currentOrganizer(organizerUserId), internalNote, now());
        return flushAndMap(feedback);
    }

    @Transactional
    public OrganizerFeedbackDetailResponse reopen(String feedbackIdValue, Long organizerUserId) {
        GeneralFeedback feedback = lockFeedback(feedbackIdValue);
        requireState(feedback, GeneralFeedbackStatus.RESOLVED);
        feedback.reopen(currentOrganizer(organizerUserId), now());
        return flushAndMap(feedback);
    }

    private Specification<GeneralFeedback> specification(
            String messageSearch,
            String senderSearch,
            String eventNameSearch,
            GeneralFeedbackTargetType targetType,
            Long eventId,
            GeneralFeedbackStatus status
    ) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (messageSearch != null) {
                predicates.add(builder.like(
                        builder.lower(root.get("message")),
                        containsPattern(messageSearch),
                        '\\'
                ));
            }
            if (senderSearch != null) {
                String pattern = containsPattern(senderSearch);
                var submitterJoin = root.join("submittedBy", JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("guestName")), pattern, '\\'),
                        builder.like(builder.lower(root.get("contactEmail")), pattern, '\\'),
                        builder.like(builder.lower(submitterJoin.get("fullName")), pattern, '\\')
                ));
            }
            if (eventNameSearch != null) {
                var eventJoin = root.join("event", JoinType.LEFT);
                predicates.add(builder.like(
                        builder.lower(eventJoin.get("name")),
                        containsPattern(eventNameSearch),
                        '\\'
                ));
            }
            if (targetType != null) {
                predicates.add(builder.equal(root.get("targetType"), targetType));
            }
            if (eventId != null) {
                predicates.add(builder.equal(root.get("event").get("eventId"), eventId));
            }
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private OrganizerFeedbackListItemResponse toListItem(GeneralFeedback feedback) {
        return new OrganizerFeedbackListItemResponse(
                feedback.getGeneralFeedbackId(),
                feedback.getTargetType(),
                eventBrief(feedback.getEvent()),
                preview(feedback.getMessage()),
                feedback.getStatus(),
                feedback.getSubmittedAt(),
                feedback.getUpdatedAt()
        );
    }

    private OrganizerFeedbackDetailResponse toDetail(GeneralFeedback feedback) {
        return new OrganizerFeedbackDetailResponse(
                feedback.getGeneralFeedbackId(),
                feedback.getTargetType(),
                eventBrief(feedback.getEvent()),
                userBrief(feedback.getSubmittedBy()),
                feedback.getGuestName(),
                feedback.getContactEmail(),
                feedback.getMessage(),
                feedback.getStatus(),
                feedback.getInternalNote(),
                userBrief(feedback.getLastHandledBy()),
                feedback.getSubmittedAt(),
                feedback.getUpdatedAt(),
                feedback.getHandlingStartedAt(),
                feedback.getResolvedAt()
        );
    }

    private FeedbackEventBriefResponse eventBrief(Event event) {
        return event == null ? null : new FeedbackEventBriefResponse(event.getEventId(), event.getName());
    }

    private FeedbackUserBriefResponse userBrief(User user) {
        return user == null ? null : new FeedbackUserBriefResponse(user.getId(), user.getFullName());
    }

    private GeneralFeedback lockFeedback(String feedbackIdValue) {
        Long feedbackId = parseFeedbackId(feedbackIdValue);
        return feedbackRepository.findByIdForUpdate(feedbackId).orElseThrow(this::notFound);
    }

    private User currentOrganizer(Long organizerUserId) {
        if (organizerUserId == null || organizerUserId <= 0) {
            throw new FeedbackApiException(
                    HttpStatus.UNAUTHORIZED,
                    "AUTHENTICATION_REQUIRED",
                    "Yêu cầu đăng nhập."
            );
        }
        return userRepository.findById(organizerUserId).orElseThrow(this::internalError);
    }

    private OrganizerFeedbackDetailResponse flushAndMap(GeneralFeedback feedback) {
        try {
            feedbackRepository.saveAndFlush(feedback);
            return toDetail(feedback);
        } catch (DataIntegrityViolationException exception) {
            throw internalError();
        }
    }

    private void requireState(GeneralFeedback feedback, GeneralFeedbackStatus expected) {
        if (feedback.getStatus() != expected) {
            throw new FeedbackApiException(
                    HttpStatus.CONFLICT,
                    "FEEDBACK_TRANSITION_CONFLICT",
                    "Trạng thái góp ý đã thay đổi. Vui lòng tải lại dữ liệu."
            );
        }
    }

    private String normalizeInternalNote(String value) {
        String normalized = value == null ? null : WHITESPACE_RUN.matcher(value.strip()).replaceAll(" ");
        int length = normalized == null ? 0 : normalized.codePointCount(0, normalized.length());
        if (length < 1 || length > 1000) {
            throw new FeedbackApiException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_FAILED",
                    "Dữ liệu yêu cầu không hợp lệ.",
                    List.of(new FieldValidationError(
                            "internalNote",
                            "Ghi chú nội bộ phải có từ 1 đến 1.000 ký tự."
                    )),
                    null
            );
        }
        return normalized;
    }

    private int parsePage(String value) {
        try {
            int page = Integer.parseInt(Objects.requireNonNullElse(value, "0"));
            if (page >= 0) return page;
        } catch (NumberFormatException ignored) {
            // Stable contract error below.
        }
        throw badRequest("INVALID_PAGE", "Trang phải là số nguyên không âm.");
    }

    private int parseSize(String value) {
        try {
            int size = Integer.parseInt(Objects.requireNonNullElse(value, "20"));
            if (size >= 1 && size <= 100) return size;
        } catch (NumberFormatException ignored) {
            // Stable contract error below.
        }
        throw badRequest("INVALID_SIZE", "Kích thước trang phải từ 1 đến 100.");
    }

    private Sort parseSort(String value) {
        String normalized = Objects.requireNonNullElse(value, "submittedAt,desc");
        return switch (normalized) {
            case "submittedAt,desc" -> Sort.by(
                    Sort.Order.desc("submittedAt"),
                    Sort.Order.desc("generalFeedbackId")
            );
            case "submittedAt,asc" -> Sort.by(
                    Sort.Order.asc("submittedAt"),
                    Sort.Order.asc("generalFeedbackId")
            );
            default -> throw badRequest("INVALID_SORT", "Kiểu sắp xếp không được hỗ trợ.");
        };
    }

    private String normalizeSearch(String value, String fieldLabel) {
        if (value == null) return null;
        String normalized = WHITESPACE_RUN.matcher(value.strip()).replaceAll(" ");
        if (normalized.isEmpty()) return null;
        if (normalized.codePointCount(0, normalized.length()) > 100) {
            throw badRequest("INVALID_FILTER", fieldLabel + " không được vượt quá 100 ký tự.");
        }
        return normalized;
    }

    private GeneralFeedbackTargetType parseTargetType(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return GeneralFeedbackTargetType.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw badRequest("INVALID_ENUM_VALUE", "Giá trị targetType không hợp lệ.");
        }
    }

    private GeneralFeedbackStatus parseStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return GeneralFeedbackStatus.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw badRequest("INVALID_ENUM_VALUE", "Giá trị status không hợp lệ.");
        }
    }

    private Long parseOptionalEventId(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            long eventId = Long.parseLong(value);
            if (eventId > 0) return eventId;
        } catch (NumberFormatException ignored) {
            // Stable contract error below.
        }
        throw badRequest("INVALID_FILTER", "eventId phải là số nguyên dương.");
    }

    private Long parseFeedbackId(String value) {
        try {
            long feedbackId = Long.parseLong(value);
            if (feedbackId > 0) return feedbackId;
        } catch (NumberFormatException | NullPointerException ignored) {
            // Stable contract error below.
        }
        throw badRequest("MALFORMED_REQUEST", "Mã góp ý không hợp lệ.");
    }

    private String preview(String message) {
        String collapsed = WHITESPACE_RUN.matcher(message.strip()).replaceAll(" ");
        int characterCount = collapsed.codePointCount(0, collapsed.length());
        if (characterCount <= MAX_PREVIEW_CHARACTERS) return collapsed;
        int end = collapsed.offsetByCodePoints(0, MAX_PREVIEW_CHARACTERS - 1);
        return collapsed.substring(0, end) + "…";
    }

    private String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private String containsPattern(String value) {
        return "%" + escapeLike(value.toLowerCase(Locale.ROOT)) + "%";
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private FeedbackApiException badRequest(String code, String message) {
        return new FeedbackApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private FeedbackApiException notFound() {
        return new FeedbackApiException(
                HttpStatus.NOT_FOUND,
                "FEEDBACK_NOT_FOUND",
                "Không tìm thấy góp ý."
        );
    }

    private FeedbackApiException internalError() {
        return new FeedbackApiException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Không thể xử lý góp ý lúc này."
        );
    }
}
