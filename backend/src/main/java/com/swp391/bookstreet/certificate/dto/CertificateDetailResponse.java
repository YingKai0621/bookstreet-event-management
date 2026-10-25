package com.swp391.bookstreet.certificate.dto;

public record CertificateDetailResponse(
        CertificateSummaryResponse certificate,
        CertificateDetailActivityResponse activity,
        CertificateDetailEventResponse event
) {}
