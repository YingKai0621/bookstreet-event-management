package com.swp391.bookstreet.registration.dto;

import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.certificate.entity.CertificateStatus;
import java.time.Instant;

public record CertificateSummaryResponse(
        Long certificateId,
        String certificateCode,
        String recipientName,
        String status,
        Instant issuedAt,
        Instant revokedAt,
        boolean downloadAvailable) {
    public static CertificateSummaryResponse from(Certificate certificate) {
        if (certificate == null) return null;
        return new CertificateSummaryResponse(certificate.getCertificateId(),
                certificate.getCertificateCode(), certificate.getRecipientNameSnapshot(),
                certificate.getStatus().name(), certificate.getIssuedAt(),
                certificate.getRevokedAt(), certificate.getStatus() == CertificateStatus.ISSUED);
    }
}
