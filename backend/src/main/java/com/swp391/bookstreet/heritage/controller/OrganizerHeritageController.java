package com.swp391.bookstreet.heritage.controller;

import com.swp391.bookstreet.heritage.dto.CreateHeritageRequest;
import com.swp391.bookstreet.heritage.dto.HeritagePageResponse;
import com.swp391.bookstreet.heritage.dto.HeritageTransitionRequest;
import com.swp391.bookstreet.heritage.dto.OrganizerHeritageDetailResponse;
import com.swp391.bookstreet.heritage.dto.OrganizerHeritageListItemResponse;
import com.swp391.bookstreet.heritage.dto.UpdateHeritageRequest;
import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.service.OrganizerHeritageService;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/organizer/heritages")
@PreAuthorize("hasRole('ORGANIZER')")
public class OrganizerHeritageController {
    private final OrganizerHeritageService service;

    public OrganizerHeritageController(OrganizerHeritageService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<HeritagePageResponse<OrganizerHeritageListItemResponse>> list(
            @RequestParam(defaultValue = "0") String page,
            @RequestParam(defaultValue = "20") String size,
            @RequestParam(defaultValue = "updatedAt,desc") String sort,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        rejectUnsupportedQuery(request, Set.of("page", "size", "sort", "search", "status"));
        return noStore(service.list(page, size, sort, search, status));
    }

    @GetMapping("/{heritageContentId}")
    public ResponseEntity<OrganizerHeritageDetailResponse> detail(
            @PathVariable String heritageContentId,
            HttpServletRequest request
    ) {
        rejectUnsupportedQuery(request, Set.of());
        return noStore(service.detail(heritageContentId));
    }

    @PostMapping
    public ResponseEntity<OrganizerHeritageDetailResponse> create(
            @RequestBody CreateHeritageRequest request,
            HttpServletRequest servletRequest
    ) {
        rejectUnsupportedQuery(servletRequest, Set.of());
        OrganizerHeritageDetailResponse created = service.create(request);
        return ResponseEntity.created(URI.create(
                        "/api/v1/organizer/heritages/" + created.heritageContentId()
                ))
                .cacheControl(CacheControl.noStore())
                .body(created);
    }

    @PatchMapping("/{heritageContentId}")
    public ResponseEntity<OrganizerHeritageDetailResponse> update(
            @PathVariable String heritageContentId,
            @RequestBody UpdateHeritageRequest request,
            HttpServletRequest servletRequest
    ) {
        rejectUnsupportedQuery(servletRequest, Set.of());
        return noStore(service.update(heritageContentId, request));
    }

    @PostMapping("/{heritageContentId}/publish")
    public ResponseEntity<OrganizerHeritageDetailResponse> publish(
            @PathVariable String heritageContentId,
            @RequestBody HeritageTransitionRequest request,
            HttpServletRequest servletRequest
    ) {
        rejectUnsupportedQuery(servletRequest, Set.of());
        return noStore(service.publish(heritageContentId, request));
    }

    @PostMapping("/{heritageContentId}/archive")
    public ResponseEntity<OrganizerHeritageDetailResponse> archive(
            @PathVariable String heritageContentId,
            @RequestBody HeritageTransitionRequest request,
            HttpServletRequest servletRequest
    ) {
        rejectUnsupportedQuery(servletRequest, Set.of());
        return noStore(service.archive(heritageContentId, request));
    }

    @PostMapping("/{heritageContentId}/republish")
    public ResponseEntity<OrganizerHeritageDetailResponse> republish(
            @PathVariable String heritageContentId,
            @RequestBody HeritageTransitionRequest request,
            HttpServletRequest servletRequest
    ) {
        rejectUnsupportedQuery(servletRequest, Set.of());
        return noStore(service.republish(heritageContentId, request));
    }

    @DeleteMapping("/{heritageContentId}")
    public ResponseEntity<Void> delete(
            @PathVariable String heritageContentId,
            @RequestParam(required = false) String expectedUpdatedAt,
            HttpServletRequest request
    ) {
        rejectUnsupportedQuery(request, Set.of("expectedUpdatedAt"));
        service.delete(heritageContentId, expectedUpdatedAt);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
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
