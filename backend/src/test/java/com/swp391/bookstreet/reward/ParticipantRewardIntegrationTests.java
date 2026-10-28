package com.swp391.bookstreet.reward;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = {
        "debug=false",
        "logging.level.root=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
class ParticipantRewardIntegrationTests {
    private static final String SCHEMA =
            "s7_participant_rewards_" + UUID.randomUUID().toString().replace("-", "");
    private static final String BASE_URL = "/api/v1/participant/rewards";
    private static final Instant BASE = Instant.parse("2026-10-28T08:00:00Z");

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    private MockMvc mvc;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", ParticipantRewardIntegrationTests::databaseUrl);
        registry.add("spring.datasource.username", ParticipantRewardIntegrationTests::databaseUser);
        registry.add("spring.datasource.password", ParticipantRewardIntegrationTests::databasePassword);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.create-schemas", () -> true);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
    }

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        jdbc.execute("TRUNCATE TABLE " + table("users") + ", " + table("locations")
                + ", " + table("badges") + " RESTART IDENTITY CASCADE");
    }

    @AfterAll
    static void dropSchema() throws SQLException {
        try (Connection connection = DriverManager.getConnection(
                databaseUrl(), databaseUser(), databasePassword());
                Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + quotedSchema() + " CASCADE");
        }
    }

    @Test
    void summaryAndHistoryUseDurableDataOwnedByAuthenticatedParticipant() throws Exception {
        Fixture fixture = seedFixture();

        mvc.perform(get(BASE_URL + "/summary").with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPoints").value(60))
                .andExpect(jsonPath("$.totalVisits").value(3))
                .andExpect(jsonPath("$.earnedBadgeCount").value(2))
                .andExpect(jsonPath("$.activeBadgeCount").value(3))
                .andExpect(jsonPath("$.nextBadge.badgeId").value(fixture.nextBadgeId()))
                .andExpect(jsonPath("$.nextBadge.remainingPoints").value(10))
                .andExpect(jsonPath("$.nextBadge.progressPercent").value(85));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[*].pointTransactionId", contains(
                        fixture.eventTwoReward().pointTransactionId().intValue(),
                        fixture.eventOneSecondReward().pointTransactionId().intValue(),
                        fixture.eventOneFirstReward().pointTransactionId().intValue())))
                .andExpect(jsonPath("$.content[*].pointTransactionId",
                        not(hasItem(fixture.foreignReward().pointTransactionId().intValue()))));

        mvc.perform(get(BASE_URL + "/summary").with(participant(fixture.participantTwoId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPoints").value(99))
                .andExpect(jsonPath("$.totalVisits").value(1))
                .andExpect(jsonPath("$.earnedBadgeCount").value(1));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .with(participant(fixture.participantTwoId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].pointTransactionId")
                        .value(fixture.foreignReward().pointTransactionId()));

        mvc.perform(get(BASE_URL + "/badges")
                        .param("state", "EARNED")
                        .with(participant(fixture.participantTwoId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].badgeId").value(fixture.nextBadgeId()))
                .andExpect(jsonPath("$.content[*].badgeId",
                        not(hasItem(fixture.activeEarnedBadgeId().intValue()))));
    }

    @Test
    void pointHistorySupportsStablePaginationExplicitSortAndOwnedFilters() throws Exception {
        Fixture fixture = seedFixture();

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("page", "0")
                        .param("size", "2")
                        .param("sort", "points,asc")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[*].points", contains(10, 20)));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("page", "1")
                        .param("size", "2")
                        .param("sort", "points,asc")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].points", contains(30)));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("eventId", fixture.eventOneId().toString())
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].event.eventId",
                        contains(fixture.eventOneId().intValue(), fixture.eventOneId().intValue())));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("boothId", fixture.boothOneId().toString())
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].booth.boothId").value(fixture.boothOneId()))
                .andExpect(jsonPath("$.content[0].pointTransactionId")
                        .value(fixture.eventOneFirstReward().pointTransactionId()));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("eventId", Long.toString(Long.MAX_VALUE))
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void badgesKeepEarnedInactiveHideUnearnedInactiveAndSortDeterministically()
            throws Exception {
        Fixture fixture = seedFixture();

        mvc.perform(get(BASE_URL + "/badges")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.content[*].badgeId", contains(
                        fixture.inactiveEarnedBadgeId().intValue(),
                        fixture.activeEarnedBadgeId().intValue(),
                        fixture.nextBadgeId().intValue(), fixture.laterBadgeId().intValue())))
                .andExpect(jsonPath("$.content[*].badgeId",
                        not(hasItem(fixture.inactiveUnearnedBadgeId().intValue()))))
                .andExpect(jsonPath("$.content[0].state").value("EARNED"))
                .andExpect(jsonPath("$.content[0].isActive").value(false))
                .andExpect(jsonPath("$.content[0].remainingPoints").value(0))
                .andExpect(jsonPath("$.content[0].progressPercent").value(100))
                .andExpect(jsonPath("$.content[2].state").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.content[2].remainingPoints").value(10))
                .andExpect(jsonPath("$.content[2].progressPercent").value(85));

        mvc.perform(get(BASE_URL + "/badges")
                        .param("state", "EARNED")
                        .param("page", "0")
                        .param("size", "1")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content[0].badgeId")
                        .value(fixture.inactiveEarnedBadgeId()));

        mvc.perform(get(BASE_URL + "/badges")
                        .param("state", "IN_PROGRESS")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[*].badgeId",
                        contains(fixture.nextBadgeId().intValue(),
                                fixture.laterBadgeId().intValue())));

        mvc.perform(get(BASE_URL + "/badges")
                        .param("sort", "requiredPoints,desc")
                        .with(participant(fixture.participantOneId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].badgeId", contains(
                        fixture.laterBadgeId().intValue(), fixture.nextBadgeId().intValue(),
                        fixture.inactiveEarnedBadgeId().intValue(),
                        fixture.activeEarnedBadgeId().intValue())));
    }

    @Test
    void emptyAccountReturnsContractZeroAndEmptyStatesWithoutPlaceholders() throws Exception {
        long participantId = insertUser("empty-participant");

        mvc.perform(get(BASE_URL + "/summary").with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPoints").value(0))
                .andExpect(jsonPath("$.totalVisits").value(0))
                .andExpect(jsonPath("$.earnedBadgeCount").value(0))
                .andExpect(jsonPath("$.activeBadgeCount").value(0))
                .andExpect(jsonPath("$.nextBadge").doesNotExist());

        mvc.perform(get(BASE_URL + "/point-transactions").with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.content").isEmpty());

        mvc.perform(get(BASE_URL + "/badges").with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0))
                .andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void badgeProgressUsesWideArithmeticForLargeDurablePointTotals() throws Exception {
        long organizerId = insertUser("large-organizer");
        long partnerId = insertUser("large-partner");
        long participantId = insertUser("large-participant");
        long organizationId = insertPartnerOrganization(partnerId);
        long eventId = insertEvent(organizerId, "Large Progress Event");
        long applicationId = insertApplication(organizationId, eventId);
        long boothId = insertBooth("S7-C-MAX", "Large Progress Booth");
        long assignmentId = insertAssignment(applicationId, eventId, boothId);
        long registrationId = insertRegistration(participantId, eventId);
        insertReward(registrationId, assignmentId, BASE, 2_000_000_000, BASE);
        long badgeId = insertBadge("S7 C Maximum Threshold", Integer.MAX_VALUE, true);

        mvc.perform(get(BASE_URL + "/badges").with(participant(participantId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].badgeId").value(badgeId))
                .andExpect(jsonPath("$.content[0].requiredPoints").value(Integer.MAX_VALUE))
                .andExpect(jsonPath("$.content[0].remainingPoints").value(147_483_647))
                .andExpect(jsonPath("$.content[0].progressPercent").value(93));
    }

    @Test
    void endpointsEnforceParticipantAuthorityAndCanonicalQueryValidation() throws Exception {
        long participantId = insertUser("validation-participant");

        mvc.perform(get(BASE_URL + "/summary"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

        mvc.perform(get(BASE_URL + "/summary").with(role(participantId, "ORGANIZER")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("eventId", "0")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));

        mvc.perform(get(BASE_URL + "/point-transactions")
                        .param("sort", "eventName,asc")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));

        mvc.perform(get(BASE_URL + "/badges")
                        .param("state", "UNKNOWN")
                        .with(participant(participantId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ENUM_VALUE"));
    }

    private Fixture seedFixture() {
        long organizerId = insertUser("organizer");
        long partnerId = insertUser("partner");
        long participantOneId = insertUser("participant-one");
        long participantTwoId = insertUser("participant-two");
        long organizationId = insertPartnerOrganization(partnerId);

        long eventOneId = insertEvent(organizerId, "Participant Rewards Event One");
        long eventTwoId = insertEvent(organizerId, "Participant Rewards Event Two");
        long applicationOneId = insertApplication(organizationId, eventOneId);
        long applicationTwoId = insertApplication(organizationId, eventTwoId);

        long boothOneId = insertBooth("S7-C-A01", "Reward Booth One");
        long boothTwoId = insertBooth("S7-C-A02", "Reward Booth Two");
        long boothThreeId = insertBooth("S7-C-B01", "Reward Booth Three");
        long assignmentOneId = insertAssignment(applicationOneId, eventOneId, boothOneId);
        long assignmentTwoId = insertAssignment(applicationOneId, eventOneId, boothTwoId);
        long assignmentThreeId = insertAssignment(applicationTwoId, eventTwoId, boothThreeId);

        long participantOneRegistrationOne = insertRegistration(participantOneId, eventOneId);
        long participantOneRegistrationTwo = insertRegistration(participantOneId, eventTwoId);
        long participantTwoRegistration = insertRegistration(participantTwoId, eventOneId);

        RewardRow eventOneFirstReward = insertReward(
                participantOneRegistrationOne, assignmentOneId,
                BASE.plusSeconds(10), 10, BASE.plusSeconds(60));
        RewardRow eventOneSecondReward = insertReward(
                participantOneRegistrationOne, assignmentTwoId,
                BASE.plusSeconds(20), 30, BASE.plusSeconds(60));
        RewardRow eventTwoReward = insertReward(
                participantOneRegistrationTwo, assignmentThreeId,
                BASE.plusSeconds(30), 20, BASE.plusSeconds(120));
        RewardRow foreignReward = insertReward(
                participantTwoRegistration, assignmentOneId,
                BASE.plusSeconds(40), 99, BASE.plusSeconds(180));

        long activeEarnedBadgeId = insertBadge("S7 C Active Earned", 10, true);
        long inactiveEarnedBadgeId = insertBadge("S7 C Inactive Earned", 20, false);
        long nextBadgeId = insertBadge("S7 C Next", 70, true);
        long inactiveUnearnedBadgeId = insertBadge("S7 C Hidden", 40, false);
        long laterBadgeId = insertBadge("S7 C Later", 80, true);
        insertUserBadge(participantOneId, activeEarnedBadgeId, BASE.plusSeconds(300));
        insertUserBadge(participantOneId, inactiveEarnedBadgeId, BASE.plusSeconds(300));
        insertUserBadge(participantTwoId, nextBadgeId, BASE.plusSeconds(360));

        return new Fixture(
                participantOneId, participantTwoId, eventOneId, boothOneId,
                eventOneFirstReward, eventOneSecondReward, eventTwoReward, foreignReward,
                activeEarnedBadgeId, inactiveEarnedBadgeId, nextBadgeId,
                inactiveUnearnedBadgeId, laterBadgeId);
    }

    private long insertUser(String label) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String usernamePrefix = label.replace("-", "");
        if (usernamePrefix.length() > 16) {
            usernamePrefix = usernamePrefix.substring(0, 16);
        }
        return jdbc.queryForObject("""
                insert into %s(username, email, password_hash, full_name, status)
                values (?, ?, '{noop}unused', ?, 'ACTIVE')
                returning user_id
                """.formatted(table("users")), Long.class,
                usernamePrefix + suffix, usernamePrefix + suffix + "@example.test",
                "S7 C " + label);
    }

    private long insertEvent(long organizerId, String name) {
        return jdbc.queryForObject("""
                insert into %s(
                    organizer_user_id, name, start_at, end_at,
                    booth_payment_window_minutes, max_booths_per_partner,
                    max_activities_per_partner, status, created_at, updated_at)
                values (?, ?, ?, ?, 60, 5, 5, 'ONGOING', ?, ?)
                returning event_id
                """.formatted(table("events")), Long.class, organizerId, name,
                Timestamp.from(BASE.minusSeconds(3600)), Timestamp.from(BASE.plusSeconds(3600)),
                Timestamp.from(BASE.minusSeconds(7200)), Timestamp.from(BASE.minusSeconds(7200)));
    }

    private long insertPartnerOrganization(long partnerId) {
        return jdbc.queryForObject("""
                insert into %s(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, 'S7 C Partner', 'PUBLISHER', 'ACTIVE', ?, ?)
                returning partner_organization_id
                """.formatted(table("partner_organizations")), Long.class, partnerId,
                Timestamp.from(BASE.minusSeconds(7200)), Timestamp.from(BASE.minusSeconds(7200)));
    }

    private long insertApplication(long organizationId, long eventId) {
        return jdbc.queryForObject("""
                insert into %s(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', ?, ?)
                returning application_id
                """.formatted(table("partner_event_applications")), Long.class,
                organizationId, eventId, Timestamp.from(BASE.minusSeconds(7000)),
                Timestamp.from(BASE.minusSeconds(6900)));
    }

    private long insertBooth(String code, String name) {
        long boothId = jdbc.queryForObject("""
                insert into %s(
                    code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values (?, ?, 'BOOTH', 20, true, ?, ?)
                returning location_id
                """.formatted(table("locations")), Long.class, code, name,
                Timestamp.from(BASE.minusSeconds(7200)), Timestamp.from(BASE.minusSeconds(7200)));
        jdbc.update("insert into " + table("booths")
                + "(booth_id, category_code) values (?, 'PUBLISHER')", boothId);
        return boothId;
    }

    private long insertAssignment(long applicationId, long eventId, long boothId) {
        long configId = jdbc.queryForObject("""
                insert into %s(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true)
                returning event_booth_config_id
                """.formatted(table("event_booth_configs")), Long.class, eventId, boothId);
        long requestId = jdbc.queryForObject("""
                insert into %s(
                    application_id, booth_id, status, submitted_at, reviewed_at,
                    selected_at, completed_at)
                values (?, ?, 'COMPLETED', ?, ?, ?, ?)
                returning booth_request_id
                """.formatted(table("booth_requests")), Long.class, applicationId, boothId,
                Timestamp.from(BASE.minusSeconds(6800)), Timestamp.from(BASE.minusSeconds(6700)),
                Timestamp.from(BASE.minusSeconds(6600)), Timestamp.from(BASE.minusSeconds(6500)));
        long holdId = jdbc.queryForObject("""
                insert into %s(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at, consumed_at)
                values (?, ?, 10000, 'CONSUMED', ?, ?, ?)
                returning booth_hold_id
                """.formatted(table("booth_holds")), Long.class, configId, requestId,
                Timestamp.from(BASE.minusSeconds(6400)), Timestamp.from(BASE.plusSeconds(7200)),
                Timestamp.from(BASE.minusSeconds(6300)));
        return jdbc.queryForObject("""
                insert into %s(booth_hold_id, qr_token, status, assigned_at)
                values (?, ?, 'ACTIVE', ?)
                returning booth_assignment_id
                """.formatted(table("booth_assignments")), Long.class, holdId, UUID.randomUUID(),
                Timestamp.from(BASE.minusSeconds(6200)));
    }

    private long insertRegistration(long participantId, long eventId) {
        return jdbc.queryForObject("""
                insert into %s(
                    user_id, event_id, status, registered_at, activated_at, updated_at)
                values (?, ?, 'ACTIVE', ?, ?, ?)
                returning event_registration_id
                """.formatted(table("event_registrations")), Long.class, participantId, eventId,
                Timestamp.from(BASE.minusSeconds(6000)), Timestamp.from(BASE.minusSeconds(5900)),
                Timestamp.from(BASE.minusSeconds(5800)));
    }

    private RewardRow insertReward(
            long registrationId, long assignmentId, Instant visitedAt,
            int points, Instant createdAt) {
        long visitId = jdbc.queryForObject("""
                insert into %s(event_registration_id, booth_assignment_id, visited_at)
                values (?, ?, ?)
                returning booth_visit_id
                """.formatted(table("booth_visits")), Long.class,
                registrationId, assignmentId, Timestamp.from(visitedAt));
        long pointTransactionId = jdbc.queryForObject("""
                insert into %s(booth_visit_id, points, created_at)
                values (?, ?, ?)
                returning point_transaction_id
                """.formatted(table("point_transactions")), Long.class,
                visitId, points, Timestamp.from(createdAt));
        return new RewardRow(visitId, pointTransactionId);
    }

    private long insertBadge(String name, int requiredPoints, boolean active) {
        return jdbc.queryForObject("""
                insert into %s(
                    name, description, required_points, icon_url,
                    is_active, created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, ?)
                returning badge_id
                """.formatted(table("badges")), Long.class, name, name + " description",
                requiredPoints, "https://example.test/badges/" + requiredPoints + ".png", active,
                Timestamp.from(BASE.minusSeconds(5000)), Timestamp.from(BASE.minusSeconds(5000)));
    }

    private void insertUserBadge(long participantId, long badgeId, Instant earnedAt) {
        jdbc.update("""
                insert into %s(user_id, badge_id, earned_at)
                values (?, ?, ?)
                """.formatted(table("user_badges")), participantId, badgeId,
                Timestamp.from(earnedAt));
    }

    private static RequestPostProcessor participant(long userId) {
        return role(userId, "PARTICIPANT");
    }

    private static RequestPostProcessor role(long userId, String role) {
        var token = UsernamePasswordAuthenticationToken.authenticated(
                new TestPrincipal(userId), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        return authentication(token);
    }

    private static String table(String name) {
        return quotedSchema() + ".\"" + name.replace("\"", "\"\"") + "\"";
    }

    private static String quotedSchema() {
        return '"' + SCHEMA.replace("\"", "\"\"") + '"';
    }

    private static String databaseUrl() {
        return System.getenv("EVENT_TEST_DATABASE_URL");
    }

    private static String databaseUser() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_USER", "postgres");
    }

    private static String databasePassword() {
        return System.getenv().getOrDefault("EVENT_TEST_DATABASE_PASSWORD", "postgres");
    }

    private record TestPrincipal(Long userId) implements AuthenticatedPrincipal {
        @Override
        public boolean emailVerified() {
            return true;
        }
    }

    private record RewardRow(Long boothVisitId, Long pointTransactionId) {
    }

    private record Fixture(
            Long participantOneId,
            Long participantTwoId,
            Long eventOneId,
            Long boothOneId,
            RewardRow eventOneFirstReward,
            RewardRow eventOneSecondReward,
            RewardRow eventTwoReward,
            RewardRow foreignReward,
            Long activeEarnedBadgeId,
            Long inactiveEarnedBadgeId,
            Long nextBadgeId,
            Long inactiveUnearnedBadgeId,
            Long laterBadgeId) {
    }
}
