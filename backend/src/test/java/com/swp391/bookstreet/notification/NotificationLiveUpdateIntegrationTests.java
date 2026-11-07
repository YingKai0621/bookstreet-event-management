package com.swp391.bookstreet.notification;

import com.swp391.bookstreet.notification.entity.NotificationRecipientRole;
import com.swp391.bookstreet.notification.entity.NotificationType;
import com.swp391.bookstreet.notification.service.NotificationCommand;
import com.swp391.bookstreet.notification.service.NotificationStreamsRevoked;
import com.swp391.bookstreet.notification.service.NotificationWriter;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/** Uses a real server because Security, the Session and async streaming only meet in the container. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = NotificationLiveUpdateIntegrationTests.TestDatabaseGuard.class)
class NotificationLiveUpdateIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            String url = context.getEnvironment().getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Live update tests require *_event_test DB.");
            }
        }
    }

    private static final String PASSWORD = "learning-password";
    private static final String CHANGED_LINE = "event:notifications-changed";

    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired NotificationWriter writer;
    @Autowired TransactionTemplate transactions;
    @Autowired ApplicationEventPublisher events;

    private final BlockingQueue<String> streamLines = new LinkedBlockingQueue<>();
    private HttpClient client;
    private Stream<String> openStream;
    private String username;
    private long userId;
    private long eventId;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        client = HttpClient.newBuilder().cookieHandler(new CookieManager())
                .version(HttpClient.Version.HTTP_1_1).build();
        username = "live" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        userId = jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, ?, 'Live Update User', ?, current_timestamp, 'ACTIVE')
                returning user_id
                """, Long.class, username, new BCryptPasswordEncoder().encode(PASSWORD),
                username + "@example.test");
        for (String role : new String[] {"PARTICIPANT", "PARTNER"}) {
            jdbc.update("insert into user_roles(user_id, role_id) "
                    + "select ?, role_id from roles where code = ?", userId, role);
        }
        Instant start = Instant.now().truncatedTo(ChronoUnit.MICROS).plus(Duration.ofDays(5));
        eventId = jdbc.queryForObject("""
                insert into events(organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, 'Live Update Event', ?, ?, 60, 2, 3, 'PUBLISHED',
                    current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, userId, Timestamp.from(start),
                Timestamp.from(start.plus(Duration.ofDays(1))));
    }

    @AfterEach
    void cleanup() {
        if (openStream != null) openStream.close();
        jdbc.update("delete from notifications where recipient_user_id = ?", userId);
        jdbc.update("delete from events where event_id = ?", eventId);
        jdbc.update("delete from user_roles where user_id = ?", userId);
        jdbc.update("delete from users where user_id = ?", userId);
    }

    @Test
    void streamSignalsOnlyCommittedNewRowsOfTheConnectedRole() throws Exception {
        assertThat(status("/api/v1/partner/notifications/stream")).isEqualTo(401);
        login();
        assertThat(status("/api/v1/organizer/notifications/stream")).isEqualTo(403);

        HttpResponse<Stream<String>> stream = client.send(
                request("/api/v1/partner/notifications/stream").build(),
                HttpResponse.BodyHandlers.ofLines());
        openStream = stream.body();
        assertThat(stream.statusCode()).isEqualTo(200);
        assertThat(stream.headers().firstValue("Content-Type").orElseThrow())
                .startsWith("text/event-stream");
        assertThat(stream.headers().firstValue("Cache-Control").orElseThrow())
                .contains("no-store");
        Thread reader = new Thread(() -> {
            try {
                openStream.forEach(streamLines::add);
            } catch (java.io.UncheckedIOException closedByTest) {
                streamLines.add("closed");
            }
        });
        reader.setDaemon(true);
        reader.start();

        transactions.executeWithoutResult(status -> writer.write(command(
                NotificationRecipientRole.PARTICIPANT, NotificationType.EVENT_CANCELLED, "other-role")));
        transactions.executeWithoutResult(status -> {
            writer.write(command(NotificationRecipientRole.PARTNER,
                    NotificationType.PARTNER_EVENT_PUBLISHED, "rolled-back"));
            status.setRollbackOnly();
        });
        assertNoSignal();

        transactions.executeWithoutResult(status -> writer.write(command(
                NotificationRecipientRole.PARTNER, NotificationType.PARTNER_EVENT_PUBLISHED, "committed")));
        assertThat(nextEventLine()).isEqualTo(CHANGED_LINE);
        assertThat(streamLines.poll(5, TimeUnit.SECONDS)).isEqualTo("data:{}");

        transactions.executeWithoutResult(status -> writer.write(command(
                NotificationRecipientRole.PARTNER, NotificationType.PARTNER_EVENT_PUBLISHED, "committed")));
        assertNoSignal();

        transactions.executeWithoutResult(status -> events.publishEvent(
                new NotificationStreamsRevoked(userId, NotificationRecipientRole.PARTICIPANT)));
        assertNoSignal();
        assertThat(reader.isAlive()).as("another role's revocation keeps this stream open").isTrue();
        transactions.executeWithoutResult(status -> {
            events.publishEvent(new NotificationStreamsRevoked(userId, NotificationRecipientRole.PARTNER));
            status.setRollbackOnly();
        });
        Thread.sleep(700);
        assertThat(reader.isAlive()).as("a rolled-back revocation keeps this stream open").isTrue();
        transactions.executeWithoutResult(status -> events.publishEvent(
                new NotificationStreamsRevoked(userId, NotificationRecipientRole.PARTNER)));
        reader.join(5000);
        assertThat(reader.isAlive()).as("a committed revocation ends the stream").isFalse();

        jdbc.update("update users set status = 'DISABLED' where user_id = ?", userId);
        assertThat(status("/api/v1/partner/notifications/stream")).isEqualTo(401);
    }

    private NotificationCommand command(NotificationRecipientRole role, NotificationType type,
            String key) {
        return new NotificationCommand(userId, role, type, eventId, null, null, null,
                null, null, null, null, "live:" + key, "Tiêu đề", "Nội dung",
                Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    private void login() throws Exception {
        client.send(request("/api/v1/auth/csrf").build(), HttpResponse.BodyHandlers.discarding());
        String csrf = ((CookieManager) client.cookieHandler().orElseThrow()).getCookieStore()
                .getCookies().stream().filter(cookie -> cookie.getName().equals("XSRF-TOKEN"))
                .findFirst().orElseThrow().getValue();
        HttpResponse<Void> login = client.send(request("/api/v1/auth/login")
                .header("Content-Type", "application/json")
                .header("X-XSRF-TOKEN", csrf)
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"username\":\"" + username + "\",\"password\":\"" + PASSWORD + "\"}"))
                .build(), HttpResponse.BodyHandlers.discarding());
        assertThat(login.statusCode()).isEqualTo(200);
    }

    private int status(String path) throws Exception {
        return client.send(request(path).build(), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private String nextEventLine() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            String line = streamLines.poll(1, TimeUnit.SECONDS);
            if (line != null && line.startsWith("event:")) return line;
        }
        return null;
    }

    private void assertNoSignal() throws InterruptedException {
        Thread.sleep(700);
        assertThat(streamLines).doesNotContain(CHANGED_LINE);
    }
}
