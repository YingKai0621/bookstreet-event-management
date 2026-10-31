package com.swp391.bookstreet.booth;

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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = BoothCatalogIntegrationTests.TestDatabaseGuard.class)
class BoothCatalogIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException("Booth tests require a dedicated *_event_test database.");
            }
        }
    }

    private static final String BOOTHS = "/api/v1/organizer/booths";

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    MockMvc mvc;
    Long owner;
    Long otherOrganizer;
    Long partnerUser;
    String codePrefix;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = insertUser("Owner");
        otherOrganizer = insertUser("Other");
        partnerUser = insertUser("Partner");
        codePrefix = "T" + UUID.randomUUID().toString().substring(0, 7).toUpperCase();
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from activity_revisions where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                owner, otherOrganizer);
        jdbc.update("delete from activity_requests where activity_id in "
                + "(select activity_id from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?)))",
                owner, otherOrganizer);
        jdbc.update("delete from activities where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                owner, otherOrganizer);
        jdbc.update("""
                delete from booth_holds
                where event_booth_config_id in (
                    select c.event_booth_config_id from event_booth_configs c
                    join events e on e.event_id = c.event_id
                    where e.organizer_user_id in (?, ?)
                )
                """, owner, otherOrganizer);
        jdbc.update("""
                delete from booth_requests
                where application_id in (
                    select a.application_id from partner_event_applications a
                    join events e on e.event_id = a.event_id
                    where e.organizer_user_id in (?, ?)
                )
                """, owner, otherOrganizer);
        jdbc.update("delete from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                owner, otherOrganizer);
        jdbc.update("delete from partner_event_applications where event_id in "
                + "(select event_id from events where organizer_user_id in (?, ?))",
                owner, otherOrganizer);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", codePrefix + "%");
        jdbc.update("delete from locations where code like ?", codePrefix + "%");
        jdbc.update("delete from events where organizer_user_id in (?, ?)", owner, otherOrganizer);
        jdbc.update("delete from partner_organizations where representative_user_id = ?", partnerUser);
        jdbc.update("delete from users where user_id in (?, ?, ?)", owner, otherOrganizer, partnerUser);
    }

    @Test
    void organizerCreatesListsReadsAndUpdatesPhysicalBooth() throws Exception {
        long boothId = createBooth(codePrefix + "A05");

        mvc.perform(get(BOOTHS).with(organizer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].boothId").value(boothId))
                .andExpect(jsonPath("$.content[0].code").value(codePrefix + "A05"));

        mvc.perform(get(BOOTHS + "/" + boothId).with(organizer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Booth A05"));

        mvc.perform(patch(BOOTHS + "/" + boothId).with(organizer(owner)).with(csrf())
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Entrance Booth",
                                  "maxCapacity": 10,
                                  "mapX": 25.00,
                                  "categoryCode": null
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Entrance Booth"))
                .andExpect(jsonPath("$.maxCapacity").value(10))
                .andExpect(jsonPath("$.mapX").value(25.0))
                .andExpect(jsonPath("$.imageUrl").value("/images/booths/test-booth.png"))
                .andExpect(jsonPath("$.categoryCode").doesNotExist());

        assertThat(jdbc.queryForObject("select location_type from locations where location_id = ?",
                String.class, boothId)).isEqualTo("BOOTH");
        assertThat(jdbc.queryForObject("select count(*) from booths where booth_id = ?",
                Integer.class, boothId)).isOne();
    }

    @Test
    void codeIsNormalizedAndCaseInsensitiveDuplicateIsConflict() throws Exception {
        String code = codePrefix + "DUP";
        createBooth(code.toLowerCase());
        mvc.perform(post(BOOTHS).with(organizer(owner)).with(csrf())
                        .contentType("application/json").content(createBoothJson(code)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_CODE_ALREADY_EXISTS"));
        assertThat(jdbc.queryForObject("select count(*) from locations where code = ?",
                Integer.class, code)).isOne();
    }

    @Test
    void boothValidationPatchPresenceAndSortAreEnforced() throws Exception {
        mvc.perform(post(BOOTHS).with(organizer(owner)).with(csrf())
                        .contentType("application/json")
                        .content(createBoothJson(codePrefix + "BAD").replace(
                                "\"maxCapacity\": 8", "\"maxCapacity\": 0")))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        long boothId = createBooth(codePrefix + "VALID");
        mvc.perform(patch(BOOTHS + "/" + boothId).with(organizer(owner)).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(get(BOOTHS + "?sort=boothId,desc").with(organizer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
    }

    @Test
    void organizerRoleAndVerifiedEmailAreRequired() throws Exception {
        mvc.perform(get(BOOTHS)).andExpect(status().isUnauthorized());
        mvc.perform(get(BOOTHS).with(authentication(identity(owner, true, "PARTNER"))))
                .andExpect(status().isForbidden());
        mvc.perform(get(BOOTHS).with(authentication(identity(owner, false, "ORGANIZER"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void ownerConfiguresSameEventBoothIdempotentlyAndOtherOrganizerGetsNotFound()
            throws Exception {
        long boothId = createBooth(codePrefix + "CFG");
        long eventId = insertEvent(owner, "DRAFT");
        String path = "/api/v1/organizer/events/" + eventId + "/booth-configs/" + boothId;

        mvc.perform(put(path).with(organizer(owner)).with(csrf())
                        .contentType("application/json")
                        .content("{\"rentalPrice\":2000000,\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").value(eventId))
                .andExpect(jsonPath("$.availability").value("AVAILABLE"));
        mvc.perform(put(path).with(organizer(owner)).with(csrf())
                        .contentType("application/json")
                        .content("{\"rentalPrice\":2500000,\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rentalPrice").value(2500000));

        assertThat(jdbc.queryForObject("""
                select count(*) from event_booth_configs where event_id = ? and booth_id = ?
                """, Integer.class, eventId, boothId)).isOne();

        mvc.perform(put(path).with(organizer(otherOrganizer)).with(csrf())
                        .contentType("application/json")
                        .content("{\"rentalPrice\":1,\"enabled\":true}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));
    }

    @Test
    void publishedEventExposesCompleteBoothGridAndFiltersAvailability() throws Exception {
        long configuredBooth = createBooth(codePrefix + "A01");
        long unconfiguredBooth = createBooth(codePrefix + "A02");
        long eventId = insertEvent(owner, "PUBLISHED");
        configure(eventId, configuredBooth, 2000000, true);

        String publicPath = "/api/v1/events/" + eventId + "/booths";
        mvc.perform(get(publicPath + "?size=100&sort=code,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].booth.boothId").value(configuredBooth))
                .andExpect(jsonPath("$.content[0].availability").value("AVAILABLE"))
                .andExpect(jsonPath("$.content[1].booth.boothId").value(unconfiguredBooth))
                .andExpect(jsonPath("$.content[1].eventBoothConfigId").doesNotExist())
                .andExpect(jsonPath("$.content[1].availability").value("UNAVAILABLE"));

        mvc.perform(get(publicPath + "?availability=AVAILABLE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].booth.boothId").value(configuredBooth));
        mvc.perform(get(publicPath + "/" + unconfiguredBooth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.rentalPrice").doesNotExist());
    }

    @Test
    void draftEventAndUnknownBoothRemainHiddenFromPublic() throws Exception {
        long boothId = createBooth(codePrefix + "HIDDEN");
        long eventId = insertEvent(owner, "DRAFT");
        mvc.perform(get("/api/v1/events/" + eventId + "/booths"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));

        jdbc.update("update events set status = 'PUBLISHED' where event_id = ?", eventId);
        mvc.perform(get("/api/v1/events/" + eventId + "/booths/" + (boothId + 99999)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_BOOTH_NOT_FOUND"));
    }

    @Test
    void currentActiveHoldProducesOnHoldAndPreventsDisabling() throws Exception {
        long boothId = createBooth(codePrefix + "HELD");
        long eventId = insertEvent(owner, "PUBLISHED");
        long configId = configure(eventId, boothId, 2000000, true);
        long holdId = insertActiveHold(eventId, boothId, configId, 2000000);

        mvc.perform(get("/api/v1/events/" + eventId + "/booths/" + boothId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability").value("ON_HOLD"));

        mvc.perform(put("/api/v1/organizer/events/" + eventId + "/booth-configs/" + boothId)
                        .with(organizer(owner)).with(csrf()).contentType("application/json")
                        .content("{\"rentalPrice\":2500000,\"enabled\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_HAS_ACTIVE_HOLD"));

        mvc.perform(put("/api/v1/organizer/events/" + eventId + "/booth-configs/" + boothId)
                        .with(organizer(owner)).with(csrf()).contentType("application/json")
                        .content("{\"rentalPrice\":2500000,\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rentalPrice").value(2500000))
                .andExpect(jsonPath("$.availability").value("ON_HOLD"));
        mvc.perform(patch(BOOTHS + "/" + boothId).with(organizer(owner)).with(csrf())
                        .contentType("application/json").content("{\"active\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOTH_HAS_ACTIVE_HOLD"));

        assertThat(jdbc.queryForObject(
                "select locked_rental_price from booth_holds where booth_hold_id = ?",
                Integer.class, holdId)).isEqualTo(2000000);
    }

    @Test
    void boothCapacityAndActiveStateProtectApplicableActivity() throws Exception {
        long boothId = createBooth(codePrefix + "ACTIVITY");
        long eventId = insertEvent(owner, "PUBLISHED");
        insertActivity(eventId, boothId, 7);

        mvc.perform(patch(BOOTHS + "/" + boothId).with(organizer(owner)).with(csrf())
                        .contentType("application/json").content("{\"maxCapacity\":6}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_CAPACITY_IN_USE"));
        mvc.perform(patch(BOOTHS + "/" + boothId).with(organizer(owner)).with(csrf())
                        .contentType("application/json").content("{\"active\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LOCATION_HAS_ACTIVE_ACTIVITIES"));

        assertThat(jdbc.queryForObject(
                "select max_capacity from locations where location_id = ?",
                Integer.class, boothId)).isEqualTo(8);
        assertThat(jdbc.queryForObject(
                "select is_active from locations where location_id = ?",
                Boolean.class, boothId)).isTrue();
    }

    private long createBooth(String code) throws Exception {
        String response = mvc.perform(post(BOOTHS).with(organizer(owner)).with(csrf())
                        .contentType("application/json").content(createBoothJson(code)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("boothId").asLong();
    }

    private String createBoothJson(String code) {
        return """
                {
                  "code": "%s",
                  "name": "Booth A05",
                  "description": "Near the entrance",
                  "maxCapacity": 8,
                  "mapX": 20.50,
                  "mapY": 80.00,
                  "categoryCode": "PUBLISHER",
                  "note": null,
                  "imageUrl": "/images/booths/test-booth.png"
                }
                """.formatted(code);
    }

    private long insertEvent(Long organizerId, String status) {
        Instant start = Instant.now().plus(Duration.ofDays(30));
        Instant end = start.plus(Duration.ofDays(2));
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, description, start_at, end_at,
                    partner_application_deadline_at, booth_request_deadline_at,
                    activity_proposal_deadline_at, participant_registration_deadline_at,
                    partner_withdrawal_cutoff_at, booth_cancellation_cutoff_at,
                    activity_cancellation_cutoff_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, banner_url,
                    status, created_at, updated_at
                ) values (?, 'Booth Test Event', null, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    1440, 2, 2, null, ?, current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizerId, Timestamp.from(start), Timestamp.from(end),
                Timestamp.from(start.minus(Duration.ofDays(20))),
                Timestamp.from(start.minus(Duration.ofDays(10))),
                Timestamp.from(start.minus(Duration.ofDays(10))),
                Timestamp.from(start.minus(Duration.ofDays(1))),
                Timestamp.from(start.minus(Duration.ofDays(5))),
                Timestamp.from(start.minus(Duration.ofDays(5))),
                Timestamp.from(start.minus(Duration.ofDays(5))), status);
    }

    private long insertActivity(long eventId, long locationId, int capacity) {
        Instant start = Instant.now().plus(Duration.ofDays(31));
        return jdbc.queryForObject("""
                insert into activities(
                    event_id, location_id, title, activity_type, start_at, end_at,
                    registration_required, capacity, is_certificate_enabled, status,
                    created_at, updated_at)
                values (?, ?, 'Booth activity', 'TALKSHOW', ?, ?, false, ?, false,
                    'DRAFT', current_timestamp, current_timestamp)
                returning activity_id
                """, Long.class, eventId, locationId, Timestamp.from(start),
                Timestamp.from(start.plus(Duration.ofHours(1))), capacity);
    }

    private long configure(long eventId, long boothId, int price, boolean enabled) {
        return jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, ?, ?) returning event_booth_config_id
                """, Long.class, eventId, boothId, price, enabled);
    }

    private long insertActiveHold(long eventId, long boothId, long configId, int price) {
        long organizationId = jdbc.queryForObject("""
                insert into partner_organizations(
                    representative_user_id, name, category_code, status, created_at, updated_at)
                values (?, 'Partner Test', 'PUBLISHER', 'ACTIVE', current_timestamp, current_timestamp)
                returning partner_organization_id
                """, Long.class, partnerUser);
        long applicationId = jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, 'APPROVED', current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId);
        long requestId = jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at, selected_at)
                values (?, ?, 'SELECTED', current_timestamp, current_timestamp)
                returning booth_request_id
                """, Long.class, applicationId, boothId);
        return jdbc.queryForObject("""
                insert into booth_holds(
                    event_booth_config_id, booth_request_id, locked_rental_price,
                    status, created_at, expires_at)
                values (?, ?, ?, 'ACTIVE', current_timestamp, current_timestamp + interval '1 day')
                returning booth_hold_id
                """, Long.class, configId, requestId, price);
    }

    private Long insertUser(String label) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email, email_verified_at, status)
                values (?, ?, ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class,
                "booth" + UUID.randomUUID().toString().replace("-", "").substring(0, 14),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                label + " Booth Test", UUID.randomUUID() + "@example.test");
    }

    private static RequestPostProcessor organizer(Long id) {
        return authentication(identity(id, true, "ORGANIZER"));
    }

    private static UsernamePasswordAuthenticationToken identity(Long id, boolean verified,
            String role) {
        return UsernamePasswordAuthenticationToken.authenticated(new Identity(id, verified), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
