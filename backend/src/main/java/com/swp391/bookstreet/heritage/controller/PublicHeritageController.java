package com.swp391.bookstreet.heritage.controller;

import com.swp391.bookstreet.heritage.dto.HeritagePageResponse;
import com.swp391.bookstreet.heritage.dto.PublicHeritageDetailResponse;
import com.swp391.bookstreet.heritage.dto.PublicHeritageListItemResponse;
import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.service.PublicHeritageService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/heritages")
public class PublicHeritageController {
    private final PublicHeritageService service;

    public PublicHeritageController(PublicHeritageService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<HeritagePageResponse<PublicHeritageListItemResponse>> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            HttpServletRequest request
    ) {
        rejectUnsupportedQuery(request, Set.of("page", "size"));
        return noStore(service.list(page, size));
    }

    @GetMapping("/{publicCode}")
    public ResponseEntity<PublicHeritageDetailResponse> detail(
            @PathVariable String publicCode,
            HttpServletRequest request
    ) {
        rejectUnsupportedQuery(request, Set.of());
        return noStore(service.detail(publicCode));
    }

    private void rejectUnsupportedQuery(HttpServletRequest request, Set<String> supported) {
        if (request.getParameterMap().keySet().stream().anyMatch(parameter -> !supported.contains(parameter))) {
            throw new HeritageApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_FILTER",
                    "Tham số truy vấn không được hỗ trợ."
            );
        }
    }

    private <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
