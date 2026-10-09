package com.swp391.bookstreet.payment.entity;

import com.swp391.bookstreet.booth.entity.BoothHold;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BoothPaymentTests {
    private static final Instant NOW = Instant.parse("2026-10-08T03:00:00Z");

    @Test
    void incompleteQueryNeedsTwoTrustedObservationsBeforeTimeout() {
        BoothPayment payment = payment();

        assertThatIllegalStateException().isThrownBy(() -> payment.attachCheckout(
                "https://sandbox.example/checkout", NOW.plusSeconds(901), NOW));

        payment.recordTrustedIncompleteQuery("00", "01", null, NOW);

        assertThat(payment.getTrustedIncompleteQueryCount()).isEqualTo((short) 1);
        assertThatIllegalStateException().isThrownBy(() -> payment.timeout(NOW));

        payment.recordTrustedIncompleteQuery("00", "01", null, NOW.plusSeconds(300));
        payment.timeout(NOW.plusSeconds(300));

        assertThat(payment.getStatus()).isEqualTo(BoothPaymentStatus.TIMEOUT);
        assertThat(payment.getCompletedAt()).isEqualTo(NOW.plusSeconds(300));
    }

    @Test
    void verifiedLateSuccessEvidenceDoesNotSilentlyChangeTimeoutToSuccess() {
        BoothPayment payment = payment();
        payment.recordTrustedIncompleteQuery("00", "01", null, NOW);
        payment.recordTrustedIncompleteQuery("00", "01", null, NOW.plusSeconds(300));
        payment.timeout(NOW.plusSeconds(300));

        payment.recordUnsafeLateSuccess("123", "00", "00", NOW.plusSeconds(600));

        assertThat(payment.getStatus()).isEqualTo(BoothPaymentStatus.TIMEOUT);
        assertThat(payment.isReconciliationRequired()).isTrue();
        assertThat(payment.getReconciliationDetail())
                .isEqualTo("VERIFIED_LATE_SUCCESS_REQUIRES_MANUAL_REFUND");
    }

    private static BoothPayment payment() {
        BoothHold hold = mock(BoothHold.class);
        when(hold.getLockedRentalPrice()).thenReturn(new BigDecimal("10000"));
        when(hold.getExpiresAt()).thenReturn(NOW.plusSeconds(900));
        return BoothPayment.createInitialRental(hold, UUID.randomUUID(), NOW);
    }
}
