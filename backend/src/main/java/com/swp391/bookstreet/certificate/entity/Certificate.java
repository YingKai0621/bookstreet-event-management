package com.swp391.bookstreet.certificate.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "certificates")
public class Certificate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "certificate_id")
    private Long certificateId;

    @Column(name = "attendance_id", nullable = false, updatable = false)
    private Long attendanceId;

    @Column(name = "certificate_code", nullable = false, length = 50)
    private String certificateCode;

    @Column(name = "recipient_name_snapshot", nullable = false, length = 100)
    private String recipientNameSnapshot;

    @Column(name = "file_url", columnDefinition = "text")
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CertificateStatus status;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Certificate() {
    }

    public static Certificate issue(Long attendanceId, String certificateCode,
            String recipientNameSnapshot, Instant now) {
        Certificate certificate = new Certificate();
        certificate.attendanceId = Objects.requireNonNull(attendanceId,
                "attendanceId must not be null");
        certificate.certificateCode = requireText(certificateCode, "certificateCode");
        certificate.recipientNameSnapshot = requireText(
                recipientNameSnapshot, "recipientNameSnapshot");
        certificate.status = CertificateStatus.ISSUED;
        certificate.issuedAt = Objects.requireNonNull(now, "now must not be null");
        certificate.createdAt = now;
        certificate.updatedAt = now;
        return certificate;
    }

    public boolean revoke(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == CertificateStatus.REVOKED) return false;
        requireNotBefore(now, issuedAt, "revokedAt must not be before issuedAt");
        status = CertificateStatus.REVOKED;
        revokedAt = now;
        fileUrl = null;
        updatedAt = now;
        return true;
    }

    public boolean restore(Instant now) {
        Objects.requireNonNull(now, "now must not be null");
        if (status == CertificateStatus.ISSUED) return false;
        requireNotBefore(now, revokedAt, "restore time must not be before revokedAt");
        status = CertificateStatus.ISSUED;
        revokedAt = null;
        fileUrl = null;
        updatedAt = now;
        return true;
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field + " must not be null");
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return normalized;
    }

    private static void requireNotBefore(Instant candidate, Instant boundary, String message) {
        if (boundary != null && candidate.isBefore(boundary)) {
            throw new IllegalArgumentException(message);
        }
    }

    public Long getCertificateId() { return certificateId; }
    public Long getAttendanceId() { return attendanceId; }
    public String getCertificateCode() { return certificateCode; }
    public String getRecipientNameSnapshot() { return recipientNameSnapshot; }
    public String getFileUrl() { return fileUrl; }
    public CertificateStatus getStatus() { return status; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
