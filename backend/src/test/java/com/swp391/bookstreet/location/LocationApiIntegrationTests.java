package com.swp391.bookstreet.location;

import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "spring.datasource.hikari.maximum-pool-size=2",
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = LocationApiIntegrationTests.TestDatabaseGuard.class)
class LocationApiIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Location tests require a dedicated *_event_test database.");
            }
        }
    }

    private static final String LOCATIONS = "/api/v1/organizer/locations";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    MockMvc mvc;
    Long organizerUser;
    Long partnerUser;
    Long otherPartnerUser;
    String prefix;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        organizerUser = insertUser("Organizer");
        partnerUser = insertUser("Partner");
        otherPartnerUser = insertUser("Other Partner");
        prefix = "L" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 8).toUpperCase();
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from activity_revisions where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerUser);
        jdbc.update("delete from activity_requests where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerUser);
        jdbc.update("delete from activities where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerUser);
        jdbc.update("delete from activity_proposals where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerUser);
        jdbc.update("delete from booth_assignments where booth_hold_id in ("
                + "select h.booth_hold_id from booth_holds h join event_booth_configs c "
                + "on c.event_booth_config_id = h.event_booth_config_id join events e "
                + "on e.event_id = c.event_id where e.organizer_user_id = ?)", organizerUser);
        jdbc.update("delete from booth_holds where event_booth_config_id in ("
                + "select c.event_booth_config_id from event_booth_configs c join events e "
                + "on e.event_id = c.event_id where e.organizer_user_id = ?)", organizerUser);
        jdbc.update("delete from booth_requests where application_id in "
                + "(select application_id from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?))", organizerUser);
        jdbc.update("delete from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerUser);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizerUser);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", prefix + "%");
        jdbc.update("delete from locations where code like ?", prefix + "%");
        jdbc.update("delete from events where organizer_user_id = ?", organizerUser);
        jdbc.update("delete from partner_organizations where representative_user_id in (?, ?)",
                partnerUser, otherPartnerUser);
        jdbc.update("delete from users where user_id in (?, ?, ?)", organizerUser,
                partnerUser, otherPartnerUser);
    }

    @Test
    void organizerCreatesNormalizedSharedLocationAndListsIt() throws Exception {
        String code = prefix + "stage";
        String response = mvc.perform(post(LOCATIONS).with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content(createJson(code, "Main Heritage Stage", "STAGE", 120)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.code").value(code.toUpperCase()))
                .andExpect(jsonPath("$.locationType").value("STAGE"))
                .andExpect(jsonPath("$.boothAssignmentId").doesNotExist())
                .andExpect(jsonPath("$.eligible").value(true))
                .andReturn().getResponse().getContentAsString();
        long locationId = mapper.readTree(response).get("locationId").asLong();

        mvc.perform(get(LOCATIONS).with(organizer())
                        .param("search", "heritage")
                        .param("type", "STAGE")
                        .param("active", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].locationId").value(locationId));
    }

    @Test
    void genericLocationApiRejectsBoothAndCaseInsensitiveDuplicate() throws Exception {
        String code = prefix + "DUP";
        createShared(code.toLowerCase(), "Shared Area", "AREA", 20);

        mvc.perform(post(LOCATIONS).with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content(createJson(code, "Duplicate", "WORKSHOP", 10)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_CODE_ALREADY_EXISTS"));

        mvc.perform(post(LOCATIONS).with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content(createJson(prefix + "BOOTH", "Wrong API", "BOOTH", 10)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mvc.perform(get(LOCATIONS).with(organizer()).param("type", "BOOTH"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    @Test
    void updateRejectsUnknownAndMixedInvalidPatchWithoutApplyingAnything() throws Exception {
        long locationId = createShared(prefix + "PATCH", "Original Name", "WORKSHOP", 30);

        mvc.perform(patch(LOCATIONS + "/" + locationId).with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"name\":\"Changed Name\",\"locationType\":\"AREA\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNKNOWN_FIELD"));

        assertThat(jdbc.queryForObject("select name from locations where location_id = ?",
                String.class, locationId)).isEqualTo("Original Name");
    }

    @Test
    void deactivationAndCapacityReductionProtectApplicableActivity() throws Exception {
        long locationId = createShared(prefix + "PROTECTED", "Protected Stage", "STAGE", 100);
        EventFixture event = insertEvent();
        insertActivity(event.eventId(), locationId, event.startAt().plus(Duration.ofHours(1)),
                event.startAt().plus(Duration.ofHours(2)), 80);

        mvc.perform(patch(LOCATIONS + "/" + locationId).with(organizer()).with(csrf())
                        .contentType("application/json").content("{\"active\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_HAS_ACTIVE_ACTIVITIES"));

        mvc.perform(patch(LOCATIONS + "/" + locationId).with(organizer()).with(csrf())
                        .contentType("application/json").content("{\"maxCapacity\":79}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_CAPACITY_IN_USE"));

        mvc.perform(patch(LOCATIONS + "/" + locationId).with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content("{\"name\":\"Changed\",\"maxCapacity\":79}"))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject(
                "select name from locations where location_id = ?", String.class, locationId))
                .isEqualTo("Protected Stage");
    }

    @Test
    void partnerSeesSharedAndOwnedBoothButNeverAnotherPartnersBooth() throws Exception {
        long sharedId = createShared(prefix + "SHARED", "Shared Stage", "STAGE", 100);
        EventFixture event = insertEvent();
        long applicationId = insertApprovedApplication(partnerUser, event.eventId(), "Partner One");
        long otherApplicationId = insertApprovedApplication(otherPartnerUser, event.eventId(),
                "Partner Two");
        long ownedBoothId = insertAssignedBooth(event.eventId(), applicationId,
                prefix + "OWNED");
        long foreignBoothId = insertAssignedBooth(event.eventId(), otherApplicationId,
                prefix + "FOREIGN");
        Instant requestedStart = event.startAt().plus(Duration.ofHours(3));
        Instant requestedEnd = requestedStart.plus(Duration.ofHours(1));
        insertActivity(event.eventId(), sharedId, requestedStart, requestedEnd, 50);

        mvc.perform(get("/api/v1/partner/events/{eventId}/activity-locations", event.eventId())
                        .with(partner())
                        .param("startAt", requestedStart.toString())
                        .param("endAt", requestedEnd.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.locationId == " + sharedId
                        + ")].eligible").value(false))
                .andExpect(jsonPath("$[?(@.locationId == " + sharedId
                        + ")].ineligibleReason").value("ACTIVITY_LOCATION_TIME_CONFLICT"))
                .andExpect(jsonPath("$[?(@.locationId == " + ownedBoothId
                        + ")].boothAssignmentId").exists())
                .andExpect(jsonPath("$[?(@.locationId == " + foreignBoothId + ")]").isEmpty());
    }

    @Test
    void partnerEligibilityRequiresApprovedApplicationAndValidInterval() throws Exception {
        EventFixture event = insertEvent();
        insertApplication(partnerUser, event.eventId(), "PENDING", "Pending Partner");

        mvc.perform(get("/api/v1/partner/events/{eventId}/activity-locations", event.eventId())
                        .with(partner()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_APPLICATION_NOT_APPROVED"));

        mvc.perform(get("/api/v1/partner/events/{eventId}/activity-locations", event.eventId())
                        .with(partner()).param("startAt", event.startAt().toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_FILTER"));
    }

    @Test
    void organizerLocationRoutesRejectPartnerRole() throws Exception {
        mvc.perform(get(LOCATIONS).with(partner()))
                .andExpect(status().isForbidden());
    }

    private long createShared(String code, String name, String type, int capacity)
            throws Exception {
        String body = mvc.perform(post(LOCATIONS).with(organizer()).with(csrf())
                        .contentType("application/json")
                        .content(createJson(code, name, type, capacity)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("locationId").asLong();
    }

    private static String createJson(String code, String name, String type, int capacity) {
        return """
                {
                  "code": "%s",
                  "name": "%s",
                  "locationType": "%s",
                  "description": "Heritage activity location",
                  "maxCapacity": %d,
                  "mapX": 52.50,
                  "mapY": 18.25
                }
                """.formatted(code, name, type, capacity);
    }

    private EventFixture insertEvent() {
        Instant start = Instant.now().plus(Duration.ofDays(30));
        Instant end = start.plus(Duration.ofDays(2));
        long id = jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    activity_proposal_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at)
                values (?, 'Location API Event', ?, ?, ?, 1440, 2, 3,
                    'PUBLISHED', current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerUser, Timestamp.from(start), Timestamp.from(end),
                Timestamp.from(start.minus(Duration.ofDays(1))));
        return new EventFixture(id, start, end);
    }

    private long insertActivity(long eventId, long locationId, Instant startAt, Instant endAt,
            int capacity) {
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    capacity, status, created_at, updated_at)
                values (?, ?, 'Location protection Activity', 'TALKSHOW', ?, ?, ?,
                    'DRAFT', current_timestamp, current_timestamp)
                returning activity_id
                """, Long.class, eventId, locationId, Timestamp.from(startAt),
                Timestamp.from(endAt), capacity);
    }

    private long insertApprovedApplication(Long representativeUserId, long eventId, String name) {
        return insertApplication(representativeUserId, eventId, "APPROVED", name);
    }

    private long insertApplication(Long representativeUserId, long eventId, String status,
            String name) {
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, ?, 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, representativeUserId, name);
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, ?, current_timestamp,
                    case when ? = 'APPROVED' then current_timestamp else null end)
                returning application_id
                """, Long.class, organizationId, eventId, status, status);
    }

    private long insertAssignedBooth(long eventId, long applicationId, String code) {
        long boothId = jdbc.queryForObject("""
                insert into locations(
                    code, name, location_type, max_capacity, is_active, created_at, updated_at)
                values (?, ?, 'BOOTH', 8, true, current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, code, code + " Booth");
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                boothId);
        long configId = jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 10000, true) returning event_booth_config_id
                """, Long.class, eventId, boothId);
        long requestId = jdbc.queryForObject("""
                insert into booth_requests(
                    application_id, booth_id, status, submitted_at, reviewed_at,
                    selected_at, completed_at)
                values (?, ?, 'COMPLETED', current_timestamp, current_timestamp,
                    current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, boothId);
        long holdId = jdbc.queryForObject("""
                insert into booth_holds(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at, consumed_at)
                values (?, ?, 10000, 'CONSUMED', current_timestamp,
                    current_timestamp + interval '1 day', current_timestamp)
                returning booth_hold_id
                """, Long.class, configId, requestId);
        jdbc.update("""
                insert into booth_assignments(booth_hold_id, qr_token, status, assigned_at)
                values (?, ?, 'ACTIVE', current_timestamp)
                """, holdId, UUID.randomUUID());
        return boothId;
    }

    private Long insertUser(String label) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, ?, ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class,
                "location" + UUID.randomUUID().toString().replace("-", "").substring(0, 12),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                label + " Location Test", UUID.randomUUID() + "@example.test");
    }

    private RequestPostProcessor organizer() {
        return authentication(identity(organizerUser, "ORGANIZER"));
    }

    private RequestPostProcessor partner() {
        return authentication(identity(partnerUser, "PARTNER"));
    }

    private static UsernamePasswordAuthenticationToken identity(Long id, String role) {
        return UsernamePasswordAuthenticationToken.authenticated(new Identity(id, true), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }

    record EventFixture(long eventId, Instant startAt, Instant endAt) {
    }
}
