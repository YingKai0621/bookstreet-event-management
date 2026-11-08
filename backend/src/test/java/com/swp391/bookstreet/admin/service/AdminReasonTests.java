package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.common.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminReasonTests {

    @Test
    void normalizesWhitespaceBeforeMeasuring() {
        assertThat(AdminReason.normalize("  Đơn   vị vi phạm\n quy định  ")).isEqualTo("Đơn vị vi phạm quy định");
    }

    @Test
    void acceptsTheExactBoundaries() {
        assertThat(AdminReason.normalize("a".repeat(10))).hasSize(10);
        assertThat(AdminReason.normalize("a".repeat(500))).hasSize(500);
    }

    @Test
    void rejectsMissingShortAndLongReasons() {
        for (String invalid : new String[] {null, "", "          ", "a".repeat(9), "a  b  c  d", "a".repeat(501)}) {
            assertThatThrownBy(() -> AdminReason.normalize(invalid))
                    .isInstanceOfSatisfying(ApiException.class,
                            error -> assertThat(error.getCode()).isEqualTo("VALIDATION_FAILED"));
        }
    }
}
