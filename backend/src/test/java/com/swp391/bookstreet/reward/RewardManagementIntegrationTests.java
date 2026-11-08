package com.swp391.bookstreet.reward;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.reward.dto.AdminBadgeRequest;
import com.swp391.bookstreet.reward.repository.BadgeRepository;
import com.swp391.bookstreet.reward.service.*;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.task.TaskExecutor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

/** AC-O07-S7-01..06 and AC-A03-01..12 against real PostgreSQL and the shared award service. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class RewardManagementIntegrationTests {
    private static final String SCHEMA = "s7b_" + UUID.randomUUID().toString().replace("-", "");
    private static final String ADMIN = "/api/v1/admin/badges";
    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired AdminBadgeService admin;
    @Autowired AdminBadgeSynchronizationService synchronization;
    @Autowired BadgeSynchronizationBatchService batches;
    @Autowired OrganizerBoothVisitQueryService monitoring;
    @Autowired ParticipantBoothVisitService scans;
    @Autowired BadgeRepository badges;
    @Autowired PlatformTransactionManager transactions;
    @Autowired org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @org.springframework.boot.test.web.server.LocalServerPort int port;
    @MockitoBean(name = "badgeSynchronizationExecutor") TaskExecutor executor;
    @MockitoSpyBean BadgeAwardServiceImpl awards;
    final Queue<Runnable> scheduled = new ConcurrentLinkedQueue<>();
    MockMvc mvc;
    long organizerId;
    long adminId;
    long eventId;
    long assignmentId;
    long boothId;
    Instant now;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> databaseUrl() + (databaseUrl().contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> System.getenv("EVENT_TEST_DATABASE_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("EVENT_TEST_DATABASE_PASSWORD"));
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.flyway.locations", () -> "classpath:db/migration");
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
        registry.add("spring.session.redis.namespace", () -> "bookstreet:test:" + SCHEMA);
    }

    private static String databaseUrl() {
        String url = System.getenv("EVENT_TEST_DATABASE_URL");
        if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
            throw new IllegalStateException("Reward tests require a dedicated *_event_test database.");
        }
        return url;
    }

    @AfterAll
    static void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(databaseUrl(), System.getenv("EVENT_TEST_DATABASE_USER"), System.getenv("EVENT_TEST_DATABASE_PASSWORD"));
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS \"" + SCHEMA + "\" CASCADE");
        }
    }

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_schema()", String.class)).isEqualTo(SCHEMA);
        jdbc.execute("truncate users, locations, badges restart identity cascade");
        scheduled.clear();
        doAnswer(call -> { scheduled.add(call.getArgument(0)); return null; }).when(executor).execute(any());
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        now = Instant.now().minusSeconds(2);
        organizerId = user("Organizer");
        adminId = user("Admin");
        eventId = event(organizerId);
        assignmentId = assignment(eventId, "A01");
        boothId = jdbc.queryForObject("select booth_id from event_booth_configs where event_id = ?", Long.class, eventId);
        authenticate(adminId, "ADMIN");
    }

    @AfterEach void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void organizerCountsHistoryPaginationAndOwnershipAreAccurate() throws Exception {
        long participant = user("Nguyễn Minh Anh");
        long second = user("Trần An");
        long otherAssignment = assignment(eventId, "B02");
        long firstVisit = visit(participant, eventId, assignmentId, 10);
        long lastVisit = visit(second, eventId, assignmentId, 10);
        visit(participant, eventId, otherAssignment, 10);
        jdbc.update("update booth_assignments set status = 'ENDED' where booth_assignment_id = ?", assignmentId);
        authenticate(organizerId, "ORGANIZER");
        var summary = monitoring.summary(eventId);
        assertThat(summary.totalVisits()).isEqualTo(3);
        assertThat(summary.uniqueParticipants()).isEqualTo(2);
        assertThat(summary.visitedBoothAssignments()).isEqualTo(2);
        var groups = monitoring.groups(eventId, 0, 1, null, null, null);
        assertThat(groups.totalElements()).isEqualTo(2);
        assertThat(groups.totalPages()).isEqualTo(2);
        assertThat(groups.content().getFirst().assignmentStatus().name()).isEqualTo("ENDED");
        assertThat(groups.content().getFirst().visitCount()).isEqualTo(2);
        assertThat(monitoring.groups(eventId, 1, 1, null, null, null).content().getFirst().boothAssignmentId()).isEqualTo(otherAssignment);
        var visits = monitoring.visits(eventId, 0, 1, null, boothId, null);
        assertThat(visits.totalElements()).isEqualTo(2);
        assertThat(visits.content().getFirst().boothVisitId()).isEqualTo(lastVisit);
        assertThat(monitoring.visits(eventId, 1, 1, null, boothId, null).content().getFirst().boothVisitId()).isEqualTo(firstVisit);
        assertThat(monitoring.visits(eventId, 0, 20, "participantDisplayName,asc", null, "  Nguyễn   Minh  ").totalElements()).isEqualTo(2);
        assertThat(monitoring.groups(eventId, 0, 20, "boothCode,asc", null, "b02").totalElements()).isOne();
        assertThat(monitoring.visits(eventId, 0, 20, null, Long.MAX_VALUE, null).content()).isEmpty();
        assertThat(monitoring.visits(eventId, Integer.MAX_VALUE, 100, null, null, null).content()).isEmpty();
        long foreignEvent = event(user("Foreign Organizer"));
        for (long id : List.of(foreignEvent, Long.MAX_VALUE)) {
            for (String endpoint : List.of("/booth-visits/summary", "/booth-visit-groups", "/booth-visits")) {
                mvc.perform(get("/api/v1/organizer/events/" + id + endpoint).with(authentication(auth(organizerId, "ORGANIZER"))))
                        .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
            }
        }
        String body = mvc.perform(get("/api/v1/organizer/events/" + eventId + "/booth-visits")
                .with(authentication(auth(organizerId, "ORGANIZER")))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("qrToken", "email", "totalPoints", "notification", "password");
    }

    @Test
    void emptyMonitoringAndQueryAllowlists() throws Exception {
        authenticate(organizerId, "ORGANIZER");
        assertThat(monitoring.summary(eventId).totalVisits()).isZero();
        assertThat(monitoring.groups(eventId, 0, 20, null, null, null).content()).isEmpty();
        assertThat(monitoring.visits(eventId, 0, 20, null, null, null).content()).isEmpty();
        String path = "/api/v1/organizer/events/" + eventId + "/booth-visits";
        for (String[] input : List.of(new String[]{"page", "-1", "INVALID_PAGE"}, new String[]{"size", "101", "INVALID_SIZE"},
                new String[]{"sort", "qrToken,asc", "INVALID_SORT"}, new String[]{"boothId", "0", "INVALID_FILTER"},
                new String[]{"search", "x".repeat(101), "INVALID_FILTER"}, new String[]{"page", "bad", "INVALID_PAGE"})) {
            mvc.perform(get(path).param(input[0], input[1]).with(authentication(auth(organizerId, "ORGANIZER"))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(input[2]));
        }
    }

    @Test
    void catalogNormalizationValidationSearchAndNoUnapprovedEndpoints() throws Exception {
        var created = admin.create(input("  Nhà   Thám Hiểm  ", 10, false));
        assertThat(created.badge().name()).isEqualTo("Nhà Thám Hiểm");
        assertThat(created.synchronizationTriggered()).isFalse();
        assertThat(scheduled).isEmpty();
        assertThat(admin.list(0, 1, "name,asc", "false", "thám").totalElements()).isOne();
        assertThat(admin.list(0, 20, null, "true", null).content()).isEmpty();
        assertThatThrownBy(() -> admin.create(input("nhà thám hiểm", 20, true))).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo("BADGE_NAME_CONFLICT"));
        assertThat(scheduled).isEmpty();
        String[] invalid = {
            "{\"name\":\" \u0020\",\"requiredPoints\":1,\"isActive\":true}",
            "{\"name\":\"Test\",\"requiredPoints\":0,\"isActive\":true}",
            "{\"name\":\"Test\",\"requiredPoints\":1}",
            "{\"name\":\"Test\",\"requiredPoints\":1,\"isActive\":true,\"iconUrl\":\"javascript:alert(1)\"}"
        };
        for (String json : invalid) mvc.perform(post(ADMIN).with(authentication(auth(adminId, "ADMIN"))).with(csrf())
                .contentType("application/json").content(json)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED")).andExpect(jsonPath("$.fieldErrors[0].code").exists());
        mvc.perform(post(ADMIN).with(authentication(auth(adminId, "ADMIN"))).with(csrf()).contentType("application/json")
                .content("{\"name\":\"New\",\"requiredPoints\":1,\"isActive\":false,\"perks\":[]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));
        mvc.perform(get(ADMIN).param("active", "yes").with(authentication(auth(adminId, "ADMIN"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_FILTER"));
        mvc.perform(get(ADMIN + "/999999").with(authentication(auth(adminId, "ADMIN"))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("BADGE_NOT_FOUND"));
        mvc.perform(delete(ADMIN + "/" + created.badge().badgeId()).with(authentication(auth(adminId, "ADMIN"))).with(csrf()))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void badgeCommandsWriteAuditDetailsAndAuditFailureRollsBackTheMutation() {
        var created = admin.create(input("Audit badge", 10, false));
        long badgeId = created.badge().badgeId();
        assertThat(jdbc.queryForObject("""
                select count(*) from admin_audit_logs
                where action = 'BADGE_CREATED' and target_type = 'BADGE' and target_id = ?
                """, Long.class, badgeId)).isOne();
        assertThat(jdbc.queryForObject("select details::text from admin_audit_logs where action = 'BADGE_CREATED' and target_id = ?",
                String.class, badgeId)).contains("requiredPoints", "isActive");

        admin.update(badgeId, new AdminBadgeRequest("Audit badge updated", "Mô tả", 20, null, true));
        assertThat(jdbc.queryForObject("select details::text from admin_audit_logs where action = 'BADGE_UPDATED' and target_id = ?",
                String.class, badgeId)).contains("name", "description", "requiredPoints", "isActive");

        var synchronizedAwards = synchronization.synchronize(badgeId);
        assertThat(jdbc.queryForObject("select details::text from admin_audit_logs where action = 'BADGE_AWARDS_SYNCHRONIZED' and target_id = ?",
                String.class, badgeId)).contains(
                        "processedCount", "awardedCount", "remainingEligibleCount", "completed");
        assertThat(synchronizedAwards.remainingEligibleCount()).isZero();

        authenticate(Long.MAX_VALUE, "ADMIN");
        assertThatThrownBy(() -> admin.create(input("Rolled back badge", 99, false)))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("select count(*) from badges where name = 'Rolled back badge'", Long.class)).isZero();
    }

    @Test
    void everyMutationRequiresAdminAndCsrfAndReadsRequireRoles() throws Exception {
        long badgeId = admin.create(input("Protected", 10, true)).badge().badgeId();
        for (var request : List.of(post(ADMIN), put(ADMIN + "/" + badgeId), post(ADMIN + "/" + badgeId + "/synchronize-awards"))) {
            mvc.perform(request.with(authentication(auth(organizerId, "ORGANIZER"))).with(csrf())
                    .contentType("application/json").content("{\"name\":\"Test\",\"requiredPoints\":10,\"isActive\":true}"))
                    .andExpect(status().isForbidden());
        }
        for (var request : List.of(post(ADMIN), put(ADMIN + "/" + badgeId), post(ADMIN + "/" + badgeId + "/synchronize-awards"))) {
            mvc.perform(request.with(authentication(auth(adminId, "ADMIN"))))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        }
        mvc.perform(get(ADMIN).with(anonymous())).andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN).with(authentication(auth(organizerId, "ORGANIZER")))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/organizer/events/" + eventId + "/booth-visits").with(authentication(auth(adminId, "PARTICIPANT"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void badgeJsonDoesNotCoerceInvalidTypesAndNormalizedBoundsAreValidated() throws Exception {
        for (String json : List.of(
                "{\"name\":\"Test\",\"requiredPoints\":1.5,\"isActive\":true}",
                "{\"name\":\"Test\",\"requiredPoints\":\"10\",\"isActive\":true}",
                "{\"name\":\"Test\",\"requiredPoints\":10,\"isActive\":\"true\"}",
                "{\"name\":10,\"requiredPoints\":10,\"isActive\":true}")) {
            mvc.perform(post(ADMIN).with(authentication(auth(adminId, "ADMIN"))).with(csrf())
                    .contentType("application/json").content(json)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        }
        authenticate(adminId, "ADMIN");
        for (AdminBadgeRequest request : List.of(input("x".repeat(101), 10, false),
                new AdminBadgeRequest("Valid", "x".repeat(1001), 10, null, false),
                new AdminBadgeRequest("Valid", null, 10, "https://example.test/" + "x".repeat(2048), false))) {
            assertThatThrownBy(() -> admin.create(request))
                    .isInstanceOf(com.swp391.bookstreet.reward.exception.BadgeValidationException.class);
        }
        var created = admin.create(new AdminBadgeRequest("  Valid  ", " \n ", Integer.MAX_VALUE, " https://example.test/icon.png ", false));
        assertThat(created.badge().description()).isNull();
        assertThat(created.badge().iconUrl()).isEqualTo("https://example.test/icon.png");
        assertThat(created.badge().requiredPoints()).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void allTriggersNonTriggersAndEarnedHistoryFollowCurrentRule() {
        long participant = user("Reader");
        visit(participant, eventId, assignmentId, 10);
        var inactive = admin.create(input("Explorer", 20, false));
        long id = inactive.badge().badgeId();
        assertThat(inactive.badge().remainingEligibleCount()).isZero();
        assertThat(admin.update(id, input("Explorer", 10, false)).synchronizationTriggered()).isFalse();
        assertThat(scheduled).isEmpty();
        assertThatThrownBy(() -> synchronization.synchronize(id)).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo("BADGE_NOT_ACTIVE"));
        assertThat(admin.update(id, input("Explorer", 20, true)).synchronizationTriggered()).isTrue();
        runScheduled();
        assertThat(count("user_badges")).isZero();
        assertThat(admin.update(id, input("Explorer", 10, true)).synchronizationTriggered()).isTrue();
        runScheduled();
        assertThat(count("user_badges")).isOne();
        assertThat(count("notifications")).isOne();
        Instant earned = jdbc.queryForObject("select earned_at from user_badges", Timestamp.class).toInstant();
        assertThat(admin.update(id, input("Renamed", 100, true)).synchronizationTriggered()).isFalse();
        assertThat(admin.update(id, new AdminBadgeRequest("Renamed", "New description", 100, "https://example.test/icon.png", true)).synchronizationTriggered()).isFalse();
        assertThat(admin.update(id, input("Renamed", 100, false)).synchronizationTriggered()).isFalse();
        assertThat(admin.detail(id).awardedUserCount()).isOne();
        assertThat(scheduled).isEmpty();
        assertThat(jdbc.queryForObject("select earned_at from user_badges", Timestamp.class).toInstant()).isEqualTo(earned);
        admin.update(id, input("Renamed", 10, true)); runScheduled();
        var retry = synchronization.synchronize(id);
        assertThat(retry.processedCount()).isZero();
        assertThat(retry.awardedCount()).isZero();
        assertThat(retry.completed()).isTrue();
        assertThat(count("notifications")).isOne();
    }

    @Test
    void activeCreateSchedulesOnlyAfterCommitAndRollbackSchedulesNothing() {
        visit(user("Reader"), eventId, assignmentId, 10);
        new TransactionTemplate(transactions).executeWithoutResult(tx -> {
            admin.create(input("Rolled back", 10, true));
            assertThat(scheduled).isEmpty();
            tx.setRollbackOnly();
        });
        assertThat(scheduled).isEmpty();
        assertThat(count("badges")).isZero();
        var result = admin.create(input("Committed", 10, true));
        assertThat(result.synchronizationTriggered()).isTrue();
        assertThat(result.badge().remainingEligibleCount()).isOne();
        assertThat(scheduled).hasSize(1);
        assertThat(count("user_badges")).isZero();
        runScheduled();
        assertThat(count("user_badges")).isOne();
        assertThat(count("notifications")).isOne();
    }

    @Test
    void batchesAreBoundedCommitSeparatelyAndResumeAfterMidBatchFailure() {
        List<Long> users = new ArrayList<>();
        for (int i = 0; i < 201; i++) { long user = user("Reader " + i); users.add(user); visit(user, eventId, assignmentId, 10); }
        long id = admin.create(input("Large batch", 10, true)).badge().badgeId();
        doThrow(new IllegalStateException("Injected award failure")).when(awards)
                .awardBadgeIfEligible(eq(users.get(150)), eq(id), anyLong(), any());
        runScheduled();
        assertThat(count("user_badges")).isEqualTo(100);
        assertThat(count("notifications")).isEqualTo(100);
        assertThat(admin.detail(id).remainingEligibleCount()).isEqualTo(101);
        assertThat(jdbc.queryForList("select user_id from user_badges order by user_id", Long.class)).isEqualTo(users.subList(0, 100));
        reset(awards);
        var resumed = synchronization.synchronize(id);
        assertThat(resumed.processedCount()).isEqualTo(100);
        assertThat(resumed.awardedCount()).isEqualTo(100);
        assertThat(resumed.remainingEligibleCount()).isOne();
        assertThat(resumed.completed()).isFalse();
        runScheduled();
        assertThat(count("user_badges")).isEqualTo(201);
        assertThat(count("notifications")).isEqualTo(201);
        assertThat(synchronization.synchronize(id).completed()).isTrue();
    }

    @Test
    void concurrentScanAndBackfillConvergeOnOneBadgeAndNotification() throws Exception {
        long participant = user("Concurrent Reader");
        visit(participant, eventId, assignmentId, 10);
        long nextAssignment = assignment(eventId, "B02");
        String token = jdbc.queryForObject("select qr_token::text from booth_assignments where booth_assignment_id = ?", String.class, nextAssignment);
        long id = admin.create(input("Concurrent badge", 10, true)).badge().badgeId();
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var scan = pool.submit(() -> { await(start); authenticate(participant, "PARTICIPANT"); try { return scans.scan(token); } finally { SecurityContextHolder.clearContext(); } });
            var backfill = pool.submit(() -> { await(start); return batches.process(id); });
            start.countDown();
            scan.get(20, TimeUnit.SECONDS); backfill.get(20, TimeUnit.SECONDS);
        }
        assertThat(count("user_badges")).isOne();
        assertThat(count("notifications")).isOne();
        assertThat(count("point_transactions")).isEqualTo(2);
    }

    @Test
    void normalizedNameRaceReturnsOneCreationAndOneStableConflict() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            List<Future<String>> results = new ArrayList<>();
            for (String name : List.of("  Same   Name ", "same name")) results.add(pool.submit(() -> {
                await(start); authenticate(adminId, "ADMIN");
                try { admin.create(input(name, 10, false)); return "CREATED"; }
                catch (ApiException error) { return error.getCode(); }
                finally { SecurityContextHolder.clearContext(); }
            }));
            start.countDown();
            assertThat(List.of(results.get(0).get(20, TimeUnit.SECONDS), results.get(1).get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder("CREATED", "BADGE_NAME_CONFLICT");
        }
        assertThat(count("badges")).isOne();
    }

    @Test
    void backfillWaitingOnAdminLockUsesCommittedCurrentThreshold() throws Exception {
        visit(user("Reader"), eventId, assignmentId, 10);
        long id = admin.create(input("Locked badge", 10, true)).badge().badgeId();
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var mutation = pool.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(tx -> {
                var badge = badges.findByBadgeIdForUpdate(id).orElseThrow(); locked.countDown(); await(release);
                badge.update(badge.getName(), null, 20, null, true, Instant.now());
            }));
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
            var backfill = pool.submit(() -> batches.process(id));
            release.countDown();
            mutation.get(20, TimeUnit.SECONDS);
            assertThat(backfill.get(20, TimeUnit.SECONDS).awardedCount()).isZero();
        }
        assertThat(count("user_badges")).isZero();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "S7B_BROWSER_SMOKE", matches = "true")
    void browserSmokeUsesRealSessionsScanMonitoringAndBadgeBackfill() throws Exception {
        long participant = user("Bạn đọc kiểm thử");
        long foreignOrganizer = user("Ban tổ chức khác");
        long emptyEvent = event(organizerId);
        String password = UUID.randomUUID() + "Ab1!";
        for (var entry : Map.of(adminId, "ADMIN", organizerId, "ORGANIZER", participant, "PARTICIPANT", foreignOrganizer, "ORGANIZER").entrySet()) {
            jdbc.update("update users set username = ?, password_hash = ?, email = ?, email_verified_at = ? where user_id = ?",
                    "browser" + entry.getKey(), passwordEncoder.encode(password), "browser" + entry.getKey() + "@example.test", ts(now), entry.getKey());
            jdbc.update("insert into user_roles(user_id, role_id) select ?, role_id from roles where code in ('PARTICIPANT', ?)", entry.getKey(), entry.getValue());
        }
        var builder = new ProcessBuilder("node", "tests/smoke/sprint7-reward-management.mjs");
        builder.directory(java.nio.file.Path.of("../frontend").toFile());
        builder.environment().putAll(Map.of(
                "S7B_BACKEND_URL", "http://127.0.0.1:" + port,
                "S7B_PASSWORD", password,
                "S7B_ADMIN", "browser" + adminId,
                "S7B_ORGANIZER", "browser" + organizerId,
                "S7B_PARTICIPANT", "browser" + participant,
                "S7B_FOREIGN_ORGANIZER", "browser" + foreignOrganizer,
                "S7B_EVENT_ID", String.valueOf(eventId),
                "S7B_EMPTY_EVENT_ID", String.valueOf(emptyEvent),
                "S7B_SCAN_TOKEN", jdbc.queryForObject("select qr_token::text from booth_assignments where booth_assignment_id = ?", String.class, assignmentId)));
        var log = java.nio.file.Path.of("target/s7b-browser-smoke.log");
        builder.redirectErrorStream(true).redirectOutput(log.toFile());
        var process = builder.start();
        boolean finished = process.waitFor(120, TimeUnit.SECONDS);
        if (!finished) process.destroyForcibly();
        assertThat(finished).as("Browser smoke finished; see target/s7b-browser-smoke.log").isTrue();
        assertThat(process.exitValue()).as("Browser smoke exit; see target/s7b-browser-smoke.log").isZero();
        assertThat(count("user_badges")).isOne();
        assertThat(count("notifications")).isOne();
    }

    private void runScheduled() { for (Runnable task; (task = scheduled.poll()) != null;) task.run(); }
    private long count(String table) { return jdbc.queryForObject("select count(*) from " + table, Long.class); }
    private AdminBadgeRequest input(String name, int points, boolean active) { return new AdminBadgeRequest(name, null, points, null, active); }
    private static Timestamp ts(Instant value) { return Timestamp.from(value); }
    private static void await(CountDownLatch latch) { try { if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("Timed out"); } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new AssertionError(error); } }
    private static UsernamePasswordAuthenticationToken auth(long userId, String role) {
        return UsernamePasswordAuthenticationToken.authenticated(new Principal(userId), null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
    private static void authenticate(long userId, String role) { SecurityContextHolder.getContext().setAuthentication(auth(userId, role)); }
    private record Principal(Long userId) implements AuthenticatedPrincipal { @Override public boolean emailVerified() { return true; } }

    private long user(String displayName) {
        return jdbc.queryForObject("insert into users(username, password_hash, full_name, status) values (?, 'unused-test-hash', ?, 'ACTIVE') returning user_id",
                Long.class, "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 18), displayName);
    }

    private long event(long owner) {
        return jdbc.queryForObject("""
                insert into events(organizer_user_id, name, start_at, end_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at)
                values (?, 'S7 B test event', ?, ?, 60, 5, 5, 'ONGOING', ?, ?) returning event_id
                """, Long.class, owner, ts(now.minusSeconds(3600)), ts(now.plusSeconds(3600)), ts(now.minusSeconds(7200)), ts(now.minusSeconds(7200)));
    }

    private long assignment(long targetEvent, String code) {
        long partner = user("Partner " + code);
        long organization = jdbc.queryForObject("""
                insert into partner_organizations(representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, 'Test partner', 'PUBLISHER', 'ACTIVE', ?, ?) returning partner_organization_id
                """, Long.class, partner, ts(now), ts(now));
        long application = jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', ?, ?) returning application_id
                """, Long.class, organization, targetEvent, ts(now), ts(now));
        long booth = jdbc.queryForObject("""
                insert into locations(code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values (?, ?, 'BOOTH', 10, true, ?, ?) returning location_id
                """, Long.class, code, "Booth " + code, ts(now), ts(now));
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')", booth);
        long config = jdbc.queryForObject("insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled) values (?, ?, 10000, true) returning event_booth_config_id", Long.class, targetEvent, booth);
        long request = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at, reviewed_at, selected_at, completed_at)
                values (?, ?, 'COMPLETED', ?, ?, ?, ?) returning booth_request_id
                """, Long.class, application, booth, ts(now), ts(now), ts(now), ts(now));
        long hold = jdbc.queryForObject("""
                insert into booth_holds(event_booth_config_id, booth_request_id, locked_rental_price, status, created_at, expires_at, consumed_at)
                values (?, ?, 10000, 'CONSUMED', ?, ?, ?) returning booth_hold_id
                """, Long.class, config, request, ts(now.minusSeconds(120)), ts(now.plusSeconds(120)), ts(now));
        return jdbc.queryForObject("insert into booth_assignments(booth_hold_id, qr_token, status, assigned_at) values (?, ?, 'ACTIVE', ?) returning booth_assignment_id",
                Long.class, hold, UUID.randomUUID(), ts(now));
    }

    private long visit(long user, long targetEvent, long assignment, int points) {
        Long registration = jdbc.query("select event_registration_id from event_registrations where user_id = ? and event_id = ?",
                (row, index) -> row.getLong(1), user, targetEvent).stream().findFirst().orElse(null);
        if (registration == null) registration = jdbc.queryForObject("""
                insert into event_registrations(user_id, event_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?) returning event_registration_id
                """, Long.class, user, targetEvent, ts(now), ts(now), ts(now));
        long visit = jdbc.queryForObject("insert into booth_visits(event_registration_id, booth_assignment_id, visited_at) values (?, ?, ?) returning booth_visit_id", Long.class, registration, assignment, ts(now));
        jdbc.update("insert into point_transactions(booth_visit_id, points, created_at) values (?, ?, ?)", visit, points, ts(now));
        return visit;
    }
}
