package com.swp391.bookstreet.heritage.service;

import com.swp391.bookstreet.heritage.dto.HeritagePageResponse;
import com.swp391.bookstreet.heritage.dto.PublicHeritageDetailResponse;
import com.swp391.bookstreet.heritage.dto.PublicHeritageListItemResponse;
import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.repository.HeritageContentRepository;
import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicHeritageService {
    private final HeritageContentRepository repository;
    private final HeritageValidationService validation;

    public PublicHeritageService(
            HeritageContentRepository repository,
            HeritageValidationService validation
    ) {
        this.repository = repository;
        this.validation = validation;
    }

    @Transactional(readOnly = true)
    public HeritagePageResponse<PublicHeritageListItemResponse> list(String pageValue, String sizeValue) {
        int page = parsePage(pageValue);
        int size = parseSize(sizeValue);
        Sort sort = Sort.by(
                Sort.Order.desc("publishedAt"),
                Sort.Order.desc("heritageContentId")
        );
        Page<PublicHeritageListItemResponse> result = repository.findByStatus(
                HeritageContentStatus.PUBLISHED,
                PageRequest.of(page, size, sort)
        ).map(this::toListItem);
        return HeritagePageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public PublicHeritageDetailResponse detail(String publicCode) {
        if (!validation.isCanonicalPublicCode(publicCode)) throw notFound();
        HeritageContent heritage = repository.findByPublicCodeAndStatus(
                publicCode,
                HeritageContentStatus.PUBLISHED
        ).orElseThrow(this::notFound);
        return toDetail(heritage);
    }

    private PublicHeritageListItemResponse toListItem(HeritageContent heritage) {
        return new PublicHeritageListItemResponse(
                heritage.getPublicCode(),
                heritage.getTitle(),
                heritage.getSummary(),
                heritage.getImageUrl(),
                heritage.getLocationText(),
                heritage.getPublishedAt()
        );
    }

    private PublicHeritageDetailResponse toDetail(HeritageContent heritage) {
        return new PublicHeritageDetailResponse(
                heritage.getPublicCode(),
                heritage.getTitle(),
                heritage.getSummary(),
                heritage.getContent(),
                heritage.getImageUrl(),
                heritage.getLocationText(),
                heritage.getPublishedAt()
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
}
