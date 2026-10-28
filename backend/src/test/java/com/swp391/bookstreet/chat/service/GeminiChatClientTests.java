package com.swp391.bookstreet.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

class GeminiChatClientTests {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void joinsTextPartsFromCompletedGeminiCandidate() {
        var response = mapper.readTree("""
                {"candidates":[{"content":{"parts":[{"text":"Xin "},{"text":"chào"}]},
                "finishReason":"STOP"}]}
                """);
        assertThat(GeminiChatClient.parseAnswer(response)).isEqualTo("Xin chào");
    }

    @Test
    void rejectsBlockedOrIncompleteGeneration() {
        var response = mapper.readTree("""
                {"candidates":[{"content":{"parts":[]},"finishReason":"SAFETY"}]}
                """);
        assertThatThrownBy(() -> GeminiChatClient.parseAnswer(response))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("502");
    }

    @Test
    void acceptsOnlyBoundedClassificationValues() {
        var valid = mapper.readTree("""
                {"intent":"ACTIVITY","timeframe":"THIS_WEEKEND","availableOnly":true}
                """);
        var invalidIntent = mapper.readTree("""
                {"intent":"RUN_SQL","timeframe":"NONE","availableOnly":false}
                """);
        var invalidFlag = mapper.readTree("""
                {"intent":"ACTIVITY","timeframe":"NONE","availableOnly":"true"}
                """);
        var extraField = mapper.readTree("""
                {"intent":"ACTIVITY","timeframe":"NONE","availableOnly":false,
                 "sql":"SELECT * FROM users"}
                """);

        assertThat(GeminiChatClient.parseClassification(valid).intent())
                .isEqualTo(ChatClassification.Kind.ACTIVITY);
        assertThat(GeminiChatClient.parseClassification(invalidIntent).intent())
                .isEqualTo(ChatClassification.Kind.UNKNOWN);
        assertThat(GeminiChatClient.parseClassification(invalidFlag).intent())
                .isEqualTo(ChatClassification.Kind.UNKNOWN);
        assertThat(GeminiChatClient.parseClassification(extraField).intent())
                .isEqualTo(ChatClassification.Kind.UNKNOWN);
    }
}
