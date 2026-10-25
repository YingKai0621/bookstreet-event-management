package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.certificate.dto.CertificateDetailActivityResponse;
import com.swp391.bookstreet.certificate.dto.CertificateDetailEventResponse;
import com.swp391.bookstreet.certificate.dto.CertificateDetailResponse;
import com.swp391.bookstreet.certificate.dto.CertificatePageResponse;
import com.swp391.bookstreet.certificate.dto.CertificateSummaryResponse;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.certificate.entity.CertificateStatus;
import com.swp391.bookstreet.certificate.repository.CertificateDetailRecord;
import com.swp391.bookstreet.certificate.repository.CertificateRepository;
import com.swp391.bookstreet.certificate.security.CertificateCurrentUser;
import com.swp391.bookstreet.common.exception.ApiException;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ParticipantCertificateService {

    private final CertificateRepository certificateRepository;
    private final CertificateCurrentUser currentUser;
    private final CertificatePdfRenderer pdfRenderer;

    public ParticipantCertificateService(
            CertificateRepository certificateRepository,
            CertificateCurrentUser currentUser,
            CertificatePdfRenderer pdfRenderer) {
        this.certificateRepository = certificateRepository;
        this.currentUser = currentUser;
        this.pdfRenderer = pdfRenderer;
    }

    public CertificatePageResponse<CertificateSummaryResponse> list(
            int page, int size, String sort, Long eventId, Long activityId, String status) {
        if (eventId != null && eventId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER", "eventId must be positive.");
        }
        if (activityId != null && activityId <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER", "activityId must be positive.");
        }

        CertificateStatus parsedStatus = parseStatus(status);
        String statusParam = parsedStatus != null ? parsedStatus.name() : null;
        Pageable pageable = CertificatePagination.of(page, size, sort);
        Long participantId = currentUser.requireParticipantId();

        Page<Certificate> pageResult = certificateRepository.findOwnedCertificates(
                participantId, eventId, activityId, statusParam, pageable);

        List<CertificateSummaryResponse> content = pageResult.getContent().stream()
                .map(CertificateSummaryResponse::from)
                .toList();

        return new CertificatePageResponse<>(
                content,
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages()
        );
    }

    public CertificateDetailResponse detail(Long certificateId) {
        requirePositiveId(certificateId, "certificateId");
        Long participantId = currentUser.requireParticipantId();

        CertificateDetailRecord record = certificateRepository.findOwnedDetail(certificateId, participantId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND, "CERTIFICATE_NOT_FOUND", "Certificate not found."));

        return new CertificateDetailResponse(
                CertificateSummaryResponse.from(record.certificate()),
                new CertificateDetailActivityResponse(
                        record.activity().getActivityId(),
                        record.activity().getTitle(),
                        record.activity().getStartAt(),
                        record.activity().getEndAt()
                ),
                new CertificateDetailEventResponse(
                        record.event().getEventId(),
                        record.event().getName()
                )
        );
    }

    public CertificateDownloadResult download(Long certificateId) {
        requirePositiveId(certificateId, "certificateId");
        Long participantId = currentUser.requireParticipantId();

        CertificateDetailRecord record = certificateRepository.findOwnedDetail(certificateId, participantId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND, "CERTIFICATE_NOT_FOUND", "Certificate not found."));

        if (record.certificate().getStatus() == CertificateStatus.REVOKED) {
            throw new ApiException(
                    HttpStatus.CONFLICT, "CERTIFICATE_REVOKED", "Revoked certificate cannot be downloaded.");
        }

        byte[] pdfBytes = pdfRenderer.render(record.certificate(), record.activity(), record.event());
        String filename = "certificate-" + record.certificate().getCertificateCode() + ".pdf";

        return new CertificateDownloadResult(pdfBytes, filename);
    }

    private CertificateStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return CertificateStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILTER", "status must be ISSUED or REVOKED.");
        }
    }

    private void requirePositiveId(Long id, String field) {
        if (id == null || id <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IDENTIFIER", field + " must be positive.");
        }
    }

    public record CertificateDownloadResult(byte[] pdfContent, String filename) {}
}
