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
