package com.swp391.bookstreet.heritage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swp391.bookstreet.heritage.exception.HeritageApiException;
import com.swp391.bookstreet.heritage.service.HeritageValidationService;
import org.junit.jupiter.api.Test;

class HeritageValidationServiceTests {
    private final HeritageValidationService validation = new HeritageValidationService();

    @Test
    void publicCodeAndTextAreCanonicalized() {
        assertThat(validation.publicCode("  buu-dien-tp-hcm ")).isEqualTo("BUU-DIEN-TP-HCM");
        assertThat(validation.title("  Bưu\t\tđiện  ")).isEqualTo("Bưu điện");
        assertThat(validation.content("  Dòng một\r\nDòng hai đủ dài để hợp lệ.  "))
                .isEqualTo("Dòng một\nDòng hai đủ dài để hợp lệ.");
        assertThat(validation.summary("   ")).isNull();
    }

    @Test
    void imageUrlAllowsOnlyApprovedRemoteOrLocalForms() {
        assertThat(validation.imageUrl("https://example.com/heritage.webp"))
                .isEqualTo("https://example.com/heritage.webp");
        assertThat(validation.imageUrl("/assets/heritage/heritage.webp"))
                .isEqualTo("/assets/heritage/heritage.webp");

        for (String invalid : new String[]{
                "data:image/png;base64,abc",
                "//example.com/image.webp",
                "/assets/heritage/../secret.webp",
                "/assets/heritage/%2e%2e/secret.webp",
                "file:///tmp/image.webp"
        }) {
            assertThatThrownBy(() -> validation.imageUrl(invalid))
                    .isInstanceOf(HeritageApiException.class)
                    .extracting(error -> ((HeritageApiException) error).getCode())
                    .isEqualTo("VALIDATION_FAILED");
        }
    }
}
