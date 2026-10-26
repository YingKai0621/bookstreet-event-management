package com.swp391.bookstreet.chat.service;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ChatRateLimiter {
    private static final int MAX_PER_MINUTE = 8;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public ChatRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public void check(HttpServletRequest request) {
        long minute = clock.instant().getEpochSecond() / 60;
        String client = request.getRemoteAddr();
        if (windows.size() >= 5_000 && !windows.containsKey(client)) {
            windows.entrySet().removeIf(entry -> entry.getValue().minute < minute);
            if (windows.size() >= 5_000) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Chatbot is busy. Please try again later.");
            }
        }
        Window window = windows.compute(client, (key, old) -> old == null || old.minute != minute
                ? new Window(minute, 1) : new Window(minute, old.count + 1));
        if (window.count > MAX_PER_MINUTE) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many chatbot requests. Please try again later.");
        }
    }

    private record Window(long minute, int count) {
    }
}
