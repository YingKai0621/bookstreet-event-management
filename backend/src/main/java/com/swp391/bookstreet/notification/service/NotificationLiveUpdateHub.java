package com.swp391.bookstreet.notification.service;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.security.NotificationCurrentUser;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Tells open workspaces that their inbox changed. The signal carries no Notification data, so
 * clients still read through the audited inbox APIs. Connections are per application instance.
 */
@Component
public class NotificationLiveUpdateHub {
    static final String CHANGED_EVENT = "notifications-changed";

    // Longer than the 30-minute Session, so an idle tab's reconnect cannot keep its Session alive.
    private static final long CONNECTION_TIMEOUT_MS = Duration.ofHours(1).toMillis();
    private static final long HEARTBEAT_MS = 25_000;
    private static final int MAX_CONNECTIONS_PER_AUDIENCE = 5;

    private final NotificationCurrentUser currentUser;
    private final Map<Audience, List<SseEmitter>> connections = new ConcurrentHashMap<>();

    public NotificationLiveUpdateHub(NotificationCurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    public SseEmitter open(NotificationRecipientRole role) {
        Audience audience = new Audience(currentUser.requireUserId(role), role);
        SseEmitter emitter = new SseEmitter(CONNECTION_TIMEOUT_MS);
        emitter.onCompletion(() -> remove(audience, emitter));
        emitter.onTimeout(emitter::complete);
        emitter.onError(error -> remove(audience, emitter));

        List<SseEmitter> emitters = connections.computeIfAbsent(
                audience, ignored -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);
        while (emitters.size() > MAX_CONNECTIONS_PER_AUDIENCE) {
            SseEmitter oldest = emitters.remove(0);
            oldest.complete();
        }
        // The first write flushes the response headers so the browser reports the stream as open.
        send(audience, emitter, SseEmitter.event().comment("connected"));
        return emitter;
    }

    public void signal(Long recipientUserId, NotificationRecipientRole role) {
        Audience audience = new Audience(recipientUserId, role);
        for (SseEmitter emitter : connections.getOrDefault(audience, List.of())) {
            send(audience, emitter, SseEmitter.event().name(CHANGED_EVENT).data("{}"));
        }
    }

    /** Ends open streams once access is revoked. A null role closes every role of that User. */
    public void close(Long userId, NotificationRecipientRole role) {
        connections.forEach((audience, emitters) -> {
            if (audience.userId().equals(userId) && (role == null || audience.role() == role)) {
                emitters.forEach(emitter -> {
                    remove(audience, emitter);
                    emitter.complete();
                });
            }
        });
    }

    @Scheduled(initialDelay = HEARTBEAT_MS, fixedDelay = HEARTBEAT_MS)
    void heartbeat() {
        connections.forEach((audience, emitters) -> emitters.forEach(
                emitter -> send(audience, emitter, SseEmitter.event().comment("heartbeat"))));
    }

    @PreDestroy
    void closeAll() {
        connections.values().forEach(emitters -> emitters.forEach(SseEmitter::complete));
    }

    private void send(Audience audience, SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (IOException | IllegalStateException disconnected) {
            remove(audience, emitter);
            emitter.complete();
        }
    }

    private void remove(Audience audience, SseEmitter emitter) {
        connections.computeIfPresent(audience, (key, emitters) -> {
            emitters.remove(emitter);
            return emitters.isEmpty() ? null : emitters;
        });
    }

    private record Audience(Long userId, NotificationRecipientRole role) {
    }
}
