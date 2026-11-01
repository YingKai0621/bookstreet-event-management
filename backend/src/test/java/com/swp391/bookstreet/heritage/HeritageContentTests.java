package com.swp391.bookstreet.heritage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swp391.bookstreet.heritage.entity.HeritageContent;
import com.swp391.bookstreet.heritage.entity.HeritageContentStatus;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class HeritageContentTests {
    private static final Instant CREATED_AT = Instant.parse("2026-11-01T07:00:00Z");

    @Test
    void canonicalLifecyclePreservesFirstPublicationTime() {
        HeritageContent heritage = draft();

        heritage.publish(CREATED_AT.plusSeconds(1));
        Instant firstPublishedAt = heritage.getPublishedAt();
        heritage.archive(CREATED_AT.plusSeconds(2));
        heritage.republish(CREATED_AT.plusSeconds(3));

        assertThat(heritage.getStatus()).isEqualTo(HeritageContentStatus.PUBLISHED);
        assertThat(heritage.getPublishedAt()).isEqualTo(firstPublishedAt);
        assertThat(heritage.getUpdatedAt()).isEqualTo(CREATED_AT.plusSeconds(3));
    }

    @Test
    void invalidTransitionDoesNotChangeEntity() {
        HeritageContent heritage = draft();

        assertThatThrownBy(() -> heritage.archive(CREATED_AT.plusSeconds(1)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("unsupported heritage state transition");

        assertThat(heritage.getStatus()).isEqualTo(HeritageContentStatus.DRAFT);
        assertThat(heritage.getPublishedAt()).isNull();
        assertThat(heritage.getUpdatedAt()).isEqualTo(CREATED_AT);
    }

    @Test
    void mutationRequiresStrictlyLaterTimestamp() {
        HeritageContent heritage = draft();

        assertThatThrownBy(() -> heritage.updateContent(
                "Tiêu đề mới",
                null,
                "Nội dung mới vẫn bảo đảm độ dài hợp lệ.",
                null,
                null,
                CREATED_AT
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("operationTime must be later than updatedAt");

        assertThat(heritage.getTitle()).isEqualTo("Di sản nền tảng");
        assertThat(heritage.getUpdatedAt()).isEqualTo(CREATED_AT);
    }

    private HeritageContent draft() {
        return HeritageContent.createDraft(
                "DS-FOUNDATION",
                "Di sản nền tảng",
                null,
                "Nội dung di sản nền tảng đủ dài để kiểm thử.",
                null,
                null,
                CREATED_AT
        );
    }
}
