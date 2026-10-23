package com.swp391.bookstreet.certificate.entity;

import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

class CertificateTests {
    private static final Instant ISSUED_AT = Instant.parse("2026-10-23T08:00:00Z");

    @Test
    void issueNormalizesSnapshotsAndCreatesIssuedIdentity() {
        Certificate certificate = Certificate.issue(12L, " BKS-ABC ", " Nguyễn An ", ISSUED_AT);

        assertThat(certificate.getAttendanceId()).isEqualTo(12L);
        assertThat(certificate.getCertificateCode()).isEqualTo("BKS-ABC");
        assertThat(certificate.getRecipientNameSnapshot()).isEqualTo("Nguyễn An");
        assertThat(certificate.getStatus()).isEqualTo(CertificateStatus.ISSUED);
        assertThat(certificate.getIssuedAt()).isEqualTo(ISSUED_AT);
        assertThat(certificate.getCreatedAt()).isEqualTo(ISSUED_AT);
        assertThat(certificate.getUpdatedAt()).isEqualTo(ISSUED_AT);
        assertThat(certificate.getRevokedAt()).isNull();
    }

    @Test
    void revokeAndRestorePreserveDurableIdentityAndOriginalIssueTime() {
        Certificate certificate = Certificate.issue(12L, "BKS-ABC", "Nguyễn An", ISSUED_AT);
        Instant revokedAt = ISSUED_AT.plusSeconds(60);
        Instant restoredAt = revokedAt.plusSeconds(60);

        assertThat(certificate.revoke(revokedAt)).isTrue();
        assertThat(certificate.revoke(revokedAt)).isFalse();
        assertThat(certificate.getStatus()).isEqualTo(CertificateStatus.REVOKED);
        assertThat(certificate.getRevokedAt()).isEqualTo(revokedAt);

        assertThat(certificate.restore(restoredAt)).isTrue();
        assertThat(certificate.restore(restoredAt)).isFalse();
        assertThat(certificate.getStatus()).isEqualTo(CertificateStatus.ISSUED);
        assertThat(certificate.getRevokedAt()).isNull();
        assertThat(certificate.getIssuedAt()).isEqualTo(ISSUED_AT);
        assertThat(certificate.getCertificateCode()).isEqualTo("BKS-ABC");
        assertThat(certificate.getRecipientNameSnapshot()).isEqualTo("Nguyễn An");
    }

    @Test
    void rejectsBlankSnapshotsAndTimeTravelTransitions() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Certificate.issue(12L, " ", "Nguyễn An", ISSUED_AT));
        Certificate certificate = Certificate.issue(12L, "BKS-ABC", "Nguyễn An", ISSUED_AT);
        assertThatIllegalArgumentException()
                .isThrownBy(() -> certificate.revoke(ISSUED_AT.minusSeconds(1)));
    }
}
