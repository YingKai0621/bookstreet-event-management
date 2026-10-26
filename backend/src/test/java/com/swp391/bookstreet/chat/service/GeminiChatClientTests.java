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
}
