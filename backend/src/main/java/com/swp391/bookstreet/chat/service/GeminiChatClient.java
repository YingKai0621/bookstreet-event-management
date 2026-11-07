package com.swp391.bookstreet.chat.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Thin Gemini generateContent client with function-calling support. The model may only
 * call the function declarations supplied by {@link ChatTools}; it never sees raw data.
 */
@Component
public class GeminiChatClient {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(4)).build();
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String model;

    public GeminiChatClient(ObjectMapper mapper,
            @Value("${bookstreet.chatbot.api-key:}") String apiKey,
            @Value("${bookstreet.chatbot.model:gemini-3.5-flash-lite}") String model) {
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Sends one turn of the conversation and returns the model's reply: either text,
     * or function calls that the caller must execute and send back.
     */
    public ModelTurn generate(String instructions, List<JsonNode> contents,
            List<Map<String, Object>> functionDeclarations) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Chatbot AI is not configured");
        }
        if (!model.matches("[A-Za-z0-9._-]+")) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Chatbot model is not configured correctly");
        }
        try {
            String body = mapper.writeValueAsString(Map.of(
                    "systemInstruction", Map.of("parts", List.of(Map.of("text", instructions))),
                    "contents", contents,
                    "tools", List.of(Map.of("functionDeclarations", functionDeclarations)),
                    "toolConfig", Map.of("functionCallingConfig", Map.of("mode", "AUTO")),
                    "generationConfig", Map.of("maxOutputTokens", 800, "temperature", 0.3)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(
                            "https://generativelanguage.googleapis.com/v1beta/models/"
                                    + model + ":generateContent"))
                    .timeout(Duration.ofSeconds(25))
                    .header("x-goog-api-key", apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            checkStatus(response.statusCode());
            return parseTurn(mapper.readTree(response.body()));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Chatbot AI request interrupted");
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Chatbot AI is temporarily unavailable");
        }
    }

    private static void checkStatus(int status) {
        if (status == 200) return;
        if (status == 402) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "Gemini account billing or quota is unavailable");
        }
        if (status == 429) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Gemini rate limit reached");
        }
        if (status == 401 || status == 403 || status == 404) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Gemini API key or model access is unavailable");
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Gemini is temporarily unavailable");
    }

    static ModelTurn parseTurn(JsonNode root) {
        JsonNode candidate = root.path("candidates").path(0);
        String finishReason = candidate.path("finishReason").asString();
        JsonNode content = candidate.path("content");
        List<FunctionCall> calls = new ArrayList<>();
        StringBuilder text = new StringBuilder();
        for (JsonNode part : content.path("parts")) {
            if (part.has("functionCall")) {
                JsonNode call = part.path("functionCall");
                calls.add(new FunctionCall(call.path("name").asString(), call.path("args")));
            } else if (part.has("text") && !part.path("thought").asBoolean(false)) {
                text.append(part.path("text").asString());
            }
        }
        if (calls.isEmpty() && !"STOP".equals(finishReason)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Gemini did not complete the answer");
        }
        if (calls.isEmpty() && text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Chatbot AI returned no answer");
        }
        return new ModelTurn(content, calls, text.toString().trim());
    }

    /** {@code content} is echoed back verbatim so Gemini thought signatures are preserved. */
    public record ModelTurn(JsonNode content, List<FunctionCall> functionCalls, String text) {
    }

    public record FunctionCall(String name, JsonNode args) {
    }
}
