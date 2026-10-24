package com.swp391.bookstreet.certificate.controller;

import com.swp391.bookstreet.certificate.dto.CertificateDetailResponse;
import com.swp391.bookstreet.certificate.dto.CertificatePageResponse;
import com.swp391.bookstreet.certificate.dto.CertificateSummaryResponse;
import com.swp391.bookstreet.certificate.service.ParticipantCertificateService;
import com.swp391.bookstreet.certificate.service.ParticipantCertificateService.CertificateDownloadResult;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/participant/certificates")
public class ParticipantCertificateController {

    private final ParticipantCertificateService service;

    public ParticipantCertificateController(ParticipantCertificateService service) {
        this.service = service;
    }

    @GetMapping
    public CertificatePageResponse<CertificateSummaryResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "issuedAt,desc") String sort,
            @RequestParam(required = false) Long eventId,
            @RequestParam(required = false) Long activityId,
            @RequestParam(required = false) String status) {
        return service.list(page, size, sort, eventId, activityId, status);
    }

    @GetMapping("/{certificateId}")
    public CertificateDetailResponse detail(@PathVariable Long certificateId) {
        return service.detail(certificateId);
    }

    @GetMapping("/{certificateId}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long certificateId) {
        CertificateDownloadResult result = service.download(certificateId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(result.filename())
                .build());
        headers.setContentLength(result.pdfContent().length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(result.pdfContent());
    }
}
