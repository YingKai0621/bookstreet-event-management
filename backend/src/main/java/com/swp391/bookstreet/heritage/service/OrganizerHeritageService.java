package com.swp391.bookstreet.heritage.service;

import com.swp391.bookstreet.heritage.dto.CreateHeritageRequest;
import com.swp391.bookstreet.heritage.dto.HeritagePageResponse;
import com.swp391.bookstreet.heritage.dto.HeritageTransitionRequest;
import com.swp391.bookstreet.heritage.dto.OrganizerHeritageDetailResponse;
import com.swp391.bookstreet.heritage.dto.OrganizerHeritageListItemResponse;
import com.swp391.bookstreet.heritage.dto.UpdateHeritageRequest;
import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.repository.HeritageContentRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.text.Normalizer;
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
public class OrganizerHeritageService {
    private static final Pattern WHITESPACE_RUN = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    private final HeritageContentRepository repository;
    private final HeritageValidationService validation;
    private final Clock clock;

    public OrganizerHeritageService(
            HeritageContentRepository repository,
            HeritageValidationService validation,
            Clock clock
    ) {
        this.repository = repository;
        this.validation = validation;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public HeritagePageResponse<OrganizerHeritageListItemResponse> list(
            String pageValue,
            String sizeValue,
            String sortValue,
            String searchValue,
            String statusValue
    ) {
        int page = parsePage(pageValue);
        int size = parseSize(sizeValue);
        Sort sort = parseSort(sortValue);
        String search = normalizeSearch(searchValue);
        HeritageContentStatus status = parseStatus(statusValue);
        Page<OrganizerHeritageListItemResponse> result = repository.findAll(
                specification(search, status),
                PageRequest.of(page, size, sort)
        ).map(this::toListItem);
        return HeritagePageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public OrganizerHeritageDetailResponse detail(String heritageContentIdValue) {
        return toDetail(find(parseId(heritageContentIdValue)));
    }

    @Transactional
    public OrganizerHeritageDetailResponse create(CreateHeritageRequest request) {
        if (request == null) throw malformed();
        String title = validation.title(request.title());
        String publicCode = generatePublicCode(title);
        String summary = validation.summary(request.summary());
        String content = validation.content(request.content());
        String imageUrl = validation.imageUrl(request.imageUrl());
        String locationText = validation.locationText(request.locationText());
        Instant operationTime = now();
        try {
            HeritageContent created = repository.saveAndFlush(HeritageContent.createDraft(
                    publicCode,
                    title,
                    summary,
                    content,
                    imageUrl,
                    locationText,
                    operationTime
            ));
            return toDetail(created);
        } catch (DataIntegrityViolationException exception) {
            if (isPublicCodeViolation(exception)) throw publicCodeConflict();
            throw exception;
        }
    }

    private String generatePublicCode(String title) {
        String ascii = Normalizer.normalize(
                        title.replace('đ', 'd').replace('Đ', 'D'),
                        Normalizer.Form.NFD
                )
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (ascii.isEmpty()) ascii = "DI-SAN";
        else if (ascii.length() < 3) ascii = "DI-SAN-" + ascii;
        if (ascii.length() > 100) ascii = ascii.substring(0, 100).replaceAll("-+$", "");
        String baseCode = validation.publicCode(ascii);

        repository.lockPublicCodeNamespace("heritage-public-code:" + baseCode);
        if (!repository.existsByPublicCode(baseCode)) return baseCode;

        for (int suffix = 2; suffix < 10000; suffix++) {
            String suffixText = "-" + suffix;
            int baseLength = Math.min(baseCode.length(), 100 - suffixText.length());
            String candidate = baseCode.substring(0, baseLength).replaceAll("-+$", "") + suffixText;
            if (!repository.existsByPublicCode(candidate)) return candidate;
        }
        throw new HeritageApiException(
                HttpStatus.CONFLICT,
                "HERITAGE_PUBLIC_CODE_GENERATION_FAILED",
                "Không thể tạo đường dẫn công khai duy nhất. Vui lòng đổi tiêu đề và thử lại."
        );
    }

    @Transactional
    public OrganizerHeritageDetailResponse update(
            String heritageContentIdValue,
            UpdateHeritageRequest request
    ) {
        Long heritageContentId = parseId(heritageContentIdValue);
        if (request == null) throw malformed();
        Instant expectedUpdatedAt = validation.expectedUpdatedAt(request.getExpectedUpdatedAt());
        if (!request.hasMutableField()) throw validation.emptyUpdate();

        HeritageContent current = find(heritageContentId);
        requireFresh(current, expectedUpdatedAt);
        String title = request.isSupplied("title")
                ? validation.title(request.getTitle()) : current.getTitle();
        String summary = request.isSupplied("summary")
                ? validation.summary(request.getSummary()) : current.getSummary();
        String content = request.isSupplied("content")
                ? validation.content(request.getContent()) : current.getContent();
        String imageUrl = request.isSupplied("imageUrl")
                ? validation.imageUrl(request.getImageUrl()) : current.getImageUrl();
        String locationText = request.isSupplied("locationText")
                ? validation.locationText(request.getLocationText()) : current.getLocationText();
        Instant operationTime = nextOperationTime(current.getUpdatedAt());

        int changed = repository.updateContentGuarded(
                heritageContentId,
                expectedUpdatedAt,
                title,
                summary,
                content,
                imageUrl,
                locationText,
                operationTime
        );
        if (changed == 0) classifyGuardFailure(heritageContentId, expectedUpdatedAt, null, false);
        return toDetail(find(heritageContentId));
    }

    @Transactional
    public OrganizerHeritageDetailResponse publish(
            String heritageContentIdValue,
            HeritageTransitionRequest request
    ) {
        return transition(
                heritageContentIdValue,
                request,
                HeritageContentStatus.DRAFT,
                HeritageContentStatus.PUBLISHED,
                true
        );
    }

    @Transactional
    public OrganizerHeritageDetailResponse archive(
            String heritageContentIdValue,
            HeritageTransitionRequest request
    ) {
        return transition(
                heritageContentIdValue,
                request,
                HeritageContentStatus.PUBLISHED,
                HeritageContentStatus.ARCHIVED,
                false
        );
    }

    @Transactional
    public OrganizerHeritageDetailResponse republish(
            String heritageContentIdValue,
            HeritageTransitionRequest request
    ) {
        return transition(
                heritageContentIdValue,
                request,
                HeritageContentStatus.ARCHIVED,
                HeritageContentStatus.PUBLISHED,
                false
        );
    }

    @Transactional
    public void delete(String heritageContentIdValue, String expectedUpdatedAtValue) {
        Long heritageContentId = parseId(heritageContentIdValue);
        Instant expectedUpdatedAt = validation.expectedUpdatedAt(expectedUpdatedAtValue);
        HeritageContent current = find(heritageContentId);
        requireFresh(current, expectedUpdatedAt);
        if (current.getStatus() != HeritageContentStatus.DRAFT || current.getPublishedAt() != null) {
            throw deleteConflict();
        }
        int changed = repository.deleteDraftGuarded(
                heritageContentId,
                expectedUpdatedAt,
                HeritageContentStatus.DRAFT
        );
        if (changed == 0) classifyGuardFailure(heritageContentId, expectedUpdatedAt, null, true);
    }

    private OrganizerHeritageDetailResponse transition(
            String heritageContentIdValue,
            HeritageTransitionRequest request,
            HeritageContentStatus source,
            HeritageContentStatus target,
            boolean firstPublish
    ) {
        Long heritageContentId = parseId(heritageContentIdValue);
        if (request == null) throw validation.validation(
                "expectedUpdatedAt",
                "Thời điểm cập nhật gần nhất là bắt buộc."
        );
        Instant expectedUpdatedAt = validation.expectedUpdatedAt(request.expectedUpdatedAt());
        HeritageContent current = find(heritageContentId);
        requireFresh(current, expectedUpdatedAt);
        if (current.getStatus() != source) throw transitionConflict();
        if (firstPublish && current.getPublishedAt() != null) throw transitionConflict();
        if (!firstPublish && current.getPublishedAt() == null) throw transitionConflict();
        defensivelyValidate(current);
        Instant operationTime = nextOperationTime(current.getUpdatedAt());

        int changed = firstPublish
                ? repository.publishGuarded(
                        heritageContentId,
                        expectedUpdatedAt,
                        source,
                        target,
                        operationTime
                )
                : repository.transitionGuarded(
                        heritageContentId,
                        expectedUpdatedAt,
                        source,
                        target,
                        operationTime
                );
        if (changed == 0) classifyGuardFailure(heritageContentId, expectedUpdatedAt, source, false);
        return toDetail(find(heritageContentId));
    }

    private void defensivelyValidate(HeritageContent heritage) {
        validation.publicCode(heritage.getPublicCode());
        validation.title(heritage.getTitle());
        validation.content(heritage.getContent());
        validation.summary(heritage.getSummary());
        validation.imageUrl(heritage.getImageUrl());
        validation.locationText(heritage.getLocationText());
    }

    private Specification<HeritageContent> specification(
            String search,
            HeritageContentStatus status
    ) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null) {
                String pattern = containsPattern(search);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("publicCode")), pattern, '\\'),
                        builder.like(builder.lower(root.get("title")), pattern, '\\'),
                        builder.like(builder.lower(root.get("locationText")), pattern, '\\')
                ));
            }
            if (status != null) predicates.add(builder.equal(root.get("status"), status));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private void classifyGuardFailure(
            Long heritageContentId,
            Instant expectedUpdatedAt,
            HeritageContentStatus expectedStatus,
            boolean delete
    ) {
        HeritageContent latest = repository.findById(heritageContentId).orElseThrow(this::notFound);
        requireFresh(latest, expectedUpdatedAt);
        if (delete) throw deleteConflict();
        if (expectedStatus != null && latest.getStatus() != expectedStatus) throw transitionConflict();
        throw new HeritageApiException(
                HttpStatus.CONFLICT,
                "HERITAGE_STALE_WRITE",
                "Nội dung di sản đã được cập nhật. Vui lòng tải lại dữ liệu."
        );
    }

    private void requireFresh(HeritageContent heritage, Instant expectedUpdatedAt) {
        if (!heritage.getUpdatedAt().equals(expectedUpdatedAt)) {
            throw new HeritageApiException(
                    HttpStatus.CONFLICT,
                    "HERITAGE_STALE_WRITE",
                    "Nội dung di sản đã được cập nhật. Vui lòng tải lại dữ liệu."
            );
        }
    }

    private HeritageContent find(Long heritageContentId) {
        return repository.findById(heritageContentId).orElseThrow(this::notFound);
    }

    private OrganizerHeritageListItemResponse toListItem(HeritageContent heritage) {
        return new OrganizerHeritageListItemResponse(
                heritage.getHeritageContentId(),
                heritage.getPublicCode(),
                heritage.getTitle(),
                heritage.getSummary(),
                heritage.getImageUrl(),
                heritage.getLocationText(),
                heritage.getStatus(),
                heritage.getPublishedAt(),
                heritage.getCreatedAt(),
                heritage.getUpdatedAt()
        );
    }

    private OrganizerHeritageDetailResponse toDetail(HeritageContent heritage) {
        return new OrganizerHeritageDetailResponse(
                heritage.getHeritageContentId(),
                heritage.getPublicCode(),
                heritage.getTitle(),
                heritage.getSummary(),
                heritage.getContent(),
                heritage.getImageUrl(),
                heritage.getLocationText(),
                heritage.getStatus(),
                heritage.getPublishedAt(),
                heritage.getCreatedAt(),
                heritage.getUpdatedAt()
        );
    }

    private int parsePage(String value) {
        try {
            int page = Integer.parseInt(Objects.requireNonNullElse(value, "0"));
            if (page >= 0) return page;
        } catch (NumberFormatException ignored) {
            // Stable error below.
        }
        throw badRequest("INVALID_PAGE", "Trang phải là số nguyên không âm.");
    }

    private int parseSize(String value) {
        try {
            int size = Integer.parseInt(Objects.requireNonNullElse(value, "20"));
            if (size >= 1 && size <= 100) return size;
        } catch (NumberFormatException ignored) {
            // Stable error below.
        }
        throw badRequest("INVALID_SIZE", "Kích thước trang phải từ 1 đến 100.");
    }

    private Sort parseSort(String value) {
        String normalized = Objects.requireNonNullElse(value, "updatedAt,desc");
        return switch (normalized) {
            case "updatedAt,desc" -> Sort.by(
                    Sort.Order.desc("updatedAt"),
                    Sort.Order.desc("heritageContentId")
            );
            case "updatedAt,asc" -> Sort.by(
                    Sort.Order.asc("updatedAt"),
                    Sort.Order.asc("heritageContentId")
            );
            case "title,asc" -> Sort.by(
                    Sort.Order.asc("title").ignoreCase(),
                    Sort.Order.asc("heritageContentId")
            );
            case "title,desc" -> Sort.by(
                    Sort.Order.desc("title").ignoreCase(),
                    Sort.Order.desc("heritageContentId")
            );
            default -> throw badRequest("INVALID_SORT", "Kiểu sắp xếp không được hỗ trợ.");
        };
    }

    private String normalizeSearch(String value) {
        if (value == null) return null;
        String normalized = WHITESPACE_RUN.matcher(value.strip()).replaceAll(" ");
        if (normalized.isEmpty()) return null;
        if (normalized.codePointCount(0, normalized.length()) > 100) {
            throw badRequest("INVALID_FILTER", "Từ khóa tìm kiếm không được vượt quá 100 ký tự.");
        }
        return normalized;
    }

    private HeritageContentStatus parseStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return HeritageContentStatus.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw badRequest("INVALID_ENUM_VALUE", "Giá trị status không hợp lệ.");
        }
    }

    private Long parseId(String value) {
        try {
            long id = Long.parseLong(value);
            if (id > 0) return id;
        } catch (NumberFormatException | NullPointerException ignored) {
            // Stable error below.
        }
        throw malformed();
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private Instant nextOperationTime(Instant previous) {
        Instant current = now();
        Instant minimum = previous.plus(1, ChronoUnit.MICROS);
        return current.isAfter(previous) ? current : minimum;
    }

    private String containsPattern(String value) {
        String escaped = value.toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private boolean isPublicCodeViolation(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause.getMessage() != null
                    && cause.getMessage().contains("uq_heritage_contents_public_code")) {
                return true;
            }
        }
        return false;
    }

    private HeritageApiException malformed() {
        return badRequest("MALFORMED_REQUEST", "Mã nội dung di sản không hợp lệ.");
    }

    private HeritageApiException badRequest(String code, String message) {
        return new HeritageApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    private HeritageApiException notFound() {
        return new HeritageApiException(
                HttpStatus.NOT_FOUND,
                "HERITAGE_NOT_FOUND",
                "Không tìm thấy nội dung di sản."
        );
    }

    private HeritageApiException publicCodeConflict() {
        return new HeritageApiException(
                HttpStatus.CONFLICT,
                "HERITAGE_PUBLIC_CODE_CONFLICT",
                "Mã công khai đã tồn tại."
        );
    }

    private HeritageApiException transitionConflict() {
        return new HeritageApiException(
                HttpStatus.CONFLICT,
                "HERITAGE_TRANSITION_CONFLICT",
                "Trạng thái nội dung di sản không phù hợp với thao tác này."
        );
    }

    private HeritageApiException deleteConflict() {
        return new HeritageApiException(
                HttpStatus.CONFLICT,
                "HERITAGE_DELETE_CONFLICT",
                "Chỉ nội dung nháp chưa từng công bố mới có thể xóa."
        );
    }
}
