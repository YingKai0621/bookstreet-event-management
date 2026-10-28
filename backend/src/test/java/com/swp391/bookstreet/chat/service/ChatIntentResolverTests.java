package com.swp391.bookstreet.chat.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChatIntentResolverTests {
    @Test
    void commonWaysToAskAboutWeekendEventsUseTheSameRoute() {
        for (String question : new String[]{
                "Cuối tuần này có gì vui?", "Lịch thứ Bảy có gì?",
                "Cuối tuần này có chương trình nào?"}) {
            var intent = ChatIntentResolver.resolve(question);
            assertThat(intent.target()).isNotEqualTo(ChatIntentResolver.Target.NONE);
            assertThat(intent.timeframe()).isNotEqualTo(ChatIntentResolver.Timeframe.NONE);
        }
    }

    @Test
    void activitySynonymsAndAvailabilityAreRecognizedWithoutAi() {
        var intent = ChatIntentResolver.resolve("Thứ Bảy có buổi nói chuyện nào còn suất?");
        assertThat(intent.target()).isEqualTo(ChatIntentResolver.Target.ACTIVITY);
        assertThat(intent.timeframe()).isEqualTo(ChatIntentResolver.Timeframe.SATURDAY);
        assertThat(intent.availability()).isTrue();
        var full = ChatIntentResolver.resolve("Buổi nào hết chỗ?");
        assertThat(full.target()).isEqualTo(ChatIntentResolver.Target.ACTIVITY);
        assertThat(full.fullOnly()).isTrue();
    }

    @Test
    void registrationQuestionIsNotMistakenForPersonalData() {
        var intent = ChatIntentResolver.resolve("Vì sao tôi không có mã QR của tôi?");
        assertThat(intent.personal()).isFalse();
        assertThat(intent.howTo()).isTrue();
        assertThat(ChatIntentResolver.resolve("QR của tôi ở đâu?").personal()).isFalse();
    }

    @Test
    void modelClassificationOnlyAddsAllowedRoutingFields() {
        var intent = ChatIntentResolver.fromClassification("Có gì để dự không?",
                new ChatClassification(ChatClassification.Kind.EVENT,
                        ChatIntentResolver.Timeframe.THIS_WEEKEND, false));
        assertThat(intent.target()).isEqualTo(ChatIntentResolver.Target.EVENT);
        assertThat(intent.timeframe()).isEqualTo(ChatIntentResolver.Timeframe.THIS_WEEKEND);
        assertThat(intent.query()).contains("su kien");
    }
}
