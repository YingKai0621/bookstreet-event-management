package com.swp391.bookstreet.feedback.service;

import com.swp391.bookstreet.feedback.exception.FeedbackApiException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Iterator;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class FeedbackRateLimiter {
    static final int MAX_ATTEMPTS = 10;
    static final int MAX_ACTIVE_KEYS = 5_000;
    static final Duration WINDOW_DURATION = Duration.ofMinutes(10);

    private final Clock clock;
    private final byte[] hmacSecret;
    private final Map<String, Window> windows = new HashMap<>();

    public FeedbackRateLimiter(
            Clock clock,
            @Value("${bookstreet.feedback.throttle-hmac-secret:}") String hmacSecret
    ) {
        this.clock = clock;
        this.hmacSecret = hmacSecret == null ? new byte[0] : hmacSecret.getBytes(StandardCharsets.UTF_8);
    }

    public void countAttempt(Long authenticatedUserId, String remoteAddress) {
        String clientKey = authenticatedUserId != null
                ? authenticatedKey(authenticatedUserId)
                : anonymousKey(remoteAddress);
        Instant now = clock.instant();

        synchronized (windows) {
            Window existing = windows.get(clientKey);
            if (existing != null && !now.isBefore(existing.expiresAt())) {
                windows.remove(clientKey);
                existing = null;
            }

            if (existing == null) {
                removeExpired(now);
                if (windows.size() >= MAX_ACTIVE_KEYS) {
                    throw unavailable();
                }
                windows.put(clientKey, new Window(1, now.plus(WINDOW_DURATION)));
                return;
            }

            int nextCount = Math.min(existing.count() + 1, MAX_ATTEMPTS + 1);
            Window incremented = new Window(nextCount, existing.expiresAt());
            windows.put(clientKey, incremented);
            if (nextCount > MAX_ATTEMPTS) {
                long retryAfter = Math.max(1L,
                        (Duration.between(now, existing.expiresAt()).toMillis() + 999L) / 1_000L);
                throw new FeedbackApiException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "FEEDBACK_RATE_LIMITED",
                        "Bạn đã gửi quá nhiều góp ý. Vui lòng thử lại sau.",
                        java.util.List.of(),
                        retryAfter
                );
            }
        }
    }

    private String authenticatedKey(Long userId) {
        if (userId <= 0) {
            throw unavailable();
        }
        return "user:" + userId;
    }

    private String anonymousKey(String remoteAddress) {
        if (remoteAddress == null || remoteAddress.isBlank() || hmacSecret.length == 0) {
            throw unavailable();
        }
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(hmacSecret, "HmacSHA256"));
            byte[] digest = hmac.doFinal(remoteAddress.trim().getBytes(StandardCharsets.UTF_8));
            return "anon:" + HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException exception) {
            throw unavailable();
        }
    }

    private void removeExpired(Instant now) {
        Iterator<Map.Entry<String, Window>> iterator = windows.entrySet().iterator();
        while (iterator.hasNext()) {
            if (!now.isBefore(iterator.next().getValue().expiresAt())) {
                iterator.remove();
            }
        }
    }

    private FeedbackApiException unavailable() {
        return new FeedbackApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "FEEDBACK_THROTTLE_UNAVAILABLE",
                "Hệ thống tiếp nhận góp ý tạm thời không khả dụng. Vui lòng thử lại sau."
        );
    }

    private record Window(int count, Instant expiresAt) {
    }
}
