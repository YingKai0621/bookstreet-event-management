package com.swp391.bookstreet.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
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
        var turn = GeminiChatClient.parseTurn(response);
        assertThat(turn.text()).isEqualTo("Xin chào");
        assertThat(turn.functionCalls()).isEmpty();
    }

    @Test
    void extractsFunctionCallsAndKeepsRawContentForThoughtSignatures() {
        var response = mapper.readTree("""
                {"candidates":[{"content":{"role":"model","parts":[{"functionCall":
                {"name":"search_events","args":{"keyword":"sach"}},"thoughtSignature":"abc"}]},
                "finishReason":"STOP"}]}
                """);
        var turn = GeminiChatClient.parseTurn(response);
        assertThat(turn.functionCalls()).singleElement()
                .satisfies(call -> {
                    assertThat(call.name()).isEqualTo("search_events");
                    assertThat(call.args().path("keyword").asString()).isEqualTo("sach");
                });
        assertThat(turn.content().toString()).contains("thoughtSignature");
    }

    @Test
    void rejectsBlockedOrIncompleteGeneration() {
        var response = mapper.readTree("""
                {"candidates":[{"content":{"parts":[]},"finishReason":"SAFETY"}]}
                """);
        assertThatThrownBy(() -> GeminiChatClient.parseTurn(response))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("502");
    }

    @Test
    void unconfiguredModelDoesNotPretendToAnswer() {
        var client = new GeminiChatClient(mapper, "", "gemini-3.5-flash-lite");
        assertThatThrownBy(() -> client.generate("x", List.of(), List.of()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("503");
    }
}
