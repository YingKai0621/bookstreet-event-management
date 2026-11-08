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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

@SpringBootTest(properties = {
        "spring.datasource.url=${EVENT_TEST_DATABASE_URL}",
        "logging.level.org.springframework.security=ERROR"
})
@EnabledIfEnvironmentVariable(named = "EVENT_TEST_DATABASE_URL", matches = ".+")
@ContextConfiguration(initializers = PartnerBoothRequestIntegrationTests.TestDatabaseGuard.class)
class PartnerBoothRequestIntegrationTests {
    static class TestDatabaseGuard
            implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext applicationContext) {
            String url = applicationContext.getEnvironment()
                    .getRequiredProperty("spring.datasource.url");
            if (!url.matches("jdbc:postgresql://[^/]+/[A-Za-z0-9_]+_event_test(?:\\?.*)?")) {
                throw new IllegalStateException(
                        "Booth request tests require a dedicated *_event_test database.");
            }
        }
    }

    @Autowired WebApplicationContext context;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    MockMvc mvc;
    Long organizer;
    Long partnerOne;
    Long partnerTwo;
    String codePrefix;

    @BeforeEach
    void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .endsWith("_event_test");
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        organizer = insertUser("Organizer");
        partnerOne = insertUser("Partner One");
        partnerTwo = insertUser("Partner Two");
        codePrefix = "R" + UUID.randomUUID().toString().substring(0, 7).toUpperCase();
    }

    @AfterEach
    void cleanup() {
        jdbc.update("delete from notifications where recipient_user_id in (?, ?, ?)",
                organizer, partnerOne, partnerTwo);
        jdbc.update("""
                delete from booth_holds
                where booth_request_id in (
                    select request.booth_request_id
                    from booth_requests request
                    join partner_event_applications application
                      on application.application_id = request.application_id
                    join partner_organizations organization
                      on organization.partner_organization_id = application.partner_organization_id
                    where organization.representative_user_id in (?, ?)
                )
                """, partnerOne, partnerTwo);
        jdbc.update("""
                delete from booth_requests
                where application_id in (
                    select application.application_id
                    from partner_event_applications application
                    join partner_organizations organization
                      on organization.partner_organization_id = application.partner_organization_id
                    where organization.representative_user_id in (?, ?)
                )
                """, partnerOne, partnerTwo);
        jdbc.update("delete from event_booth_configs where event_id in "
                + "(select event_id from events where organizer_user_id = ?)", organizer);
        jdbc.update("""
                delete from partner_event_applications
                where partner_organization_id in (
                    select partner_organization_id from partner_organizations
                    where representative_user_id in (?, ?)
                )
                """, partnerOne, partnerTwo);
        jdbc.update("delete from events where organizer_user_id = ?", organizer);
        jdbc.update("delete from booths where booth_id in "
                + "(select location_id from locations where code like ?)", codePrefix + "%");
        jdbc.update("delete from locations where code like ?", codePrefix + "%");
        jdbc.update("delete from partner_organizations where representative_user_id in (?, ?)",
                partnerOne, partnerTwo);
        jdbc.update("delete from users where user_id in (?, ?, ?)",
                organizer, partnerOne, partnerTwo);
    }

    @Test
    void approvedPartnersCanRequestSameAvailableBoothWithoutCreatingHold() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(10)), 2);
        long boothId = insertBooth("A01", true);
        configure(eventId, boothId, true);
        approveApplication(partnerOne, eventId, "ACTIVE");
        approveApplication(partnerTwo, eventId, "ACTIVE");

        long firstId = submit(partnerOne, eventId, boothId, "  Near the entrance  ");
        long secondId = submit(partnerTwo, eventId, boothId, null);

        assertThat(firstId).isNotEqualTo(secondId);
        assertThat(jdbc.queryForObject("select count(*) from booth_requests where booth_id = ?",
                Integer.class, boothId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("""
                select count(*) from booth_holds hold
                join booth_requests request
                  on request.booth_request_id = hold.booth_request_id
                where request.booth_request_id in (?, ?)
                """, Integer.class, firstId, secondId)).isZero();
        assertThat(jdbc.queryForObject("""
                select request_note from booth_requests where booth_request_id = ?
                """, String.class, firstId)).isEqualTo("Near the entrance");

        mvc.perform(get("/api/v1/events/{eventId}/booths/{boothId}", eventId, boothId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.availability").value("AVAILABLE"));
    }

    @Test
    void approvalActiveOrganizationAndOpenDeadlineAreRequired() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(1)), 2);
        long boothId = insertBooth("ELIG", true);
        configure(eventId, boothId, true);
        long applicationId = insertApplication(partnerOne, eventId, "PENDING", "ACTIVE");

        submitExpecting(partnerOne, eventId, boothId,
                403, "PARTNER_APPLICATION_NOT_APPROVED");
        jdbc.update("update partner_event_applications set status = 'APPROVED' "
                + "where application_id = ?", applicationId);
        jdbc.update("update partner_organizations set status = 'INACTIVE' "
                + "where representative_user_id = ?", partnerOne);
        submitExpecting(partnerOne, eventId, boothId,
                409, "PARTNER_ORGANIZATION_INACTIVE");

        jdbc.update("update partner_organizations set status = 'ACTIVE' "
                + "where representative_user_id = ?", partnerOne);
        jdbc.update("update events set booth_request_deadline_at = current_timestamp "
                + "where event_id = ?", eventId);
        submitExpecting(partnerOne, eventId, boothId,
                409, "BOOTH_REQUEST_DEADLINE_PASSED");
        assertThat(requestCount(eventId)).isZero();
    }

    @Test
    void unavailableAndUnconfiguredBoothsCannotBeRequested() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(1)), 2);
        approveApplication(partnerOne, eventId, "ACTIVE");
        long unconfigured = insertBooth("NONE", true);
        long disabled = insertBooth("OFF", true);
        long inactive = insertBooth("INACTIVE", false);
        configure(eventId, disabled, false);
        configure(eventId, inactive, true);

        submitExpecting(partnerOne, eventId, unconfigured,
                404, "EVENT_BOOTH_NOT_FOUND");
        submitExpecting(partnerOne, eventId, disabled,
                409, "BOOTH_NOT_ENABLED");
        submitExpecting(partnerOne, eventId, inactive,
                409, "BOOTH_NOT_AVAILABLE");
    }

    @Test
    void overlappingActiveHoldBlocksRequestAndActiveHoldCountsTowardQuota() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(1)), 1);
        long heldBooth = insertBooth("HELD", true);
        long otherBooth = insertBooth("OTHER", true);
        long heldConfig = configure(eventId, heldBooth, true);
        configure(eventId, otherBooth, true);
        long applicationId = approveApplication(partnerOne, eventId, "ACTIVE");
        insertActiveHold(applicationId, heldBooth, heldConfig);

        submitExpecting(partnerOne, eventId, heldBooth,
                409, "BOOTH_NOT_AVAILABLE");
        submitExpecting(partnerOne, eventId, otherBooth,
                409, "BOOTH_QUOTA_EXCEEDED");
    }

    @Test
    void duplicateRejectedAndWithdrawnResubmissionRulesAreEnforced() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(1)), 2);
        long firstBooth = insertBooth("RULE1", true);
        long secondBooth = insertBooth("RULE2", true);
        long thirdBooth = insertBooth("RULE3", true);
        configure(eventId, firstBooth, true);
        configure(eventId, secondBooth, true);
        configure(eventId, thirdBooth, true);
        long applicationId = approveApplication(partnerOne, eventId, "ACTIVE");

        long pendingId = submit(partnerOne, eventId, firstBooth, null);
        submitExpecting(partnerOne, eventId, firstBooth,
                409, "BOOTH_REQUEST_ALREADY_OPEN");
        mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", pendingId)
                        .with(partner(partnerOne)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.withdrawnAt").exists());
        mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", pendingId)
                        .with(partner(partnerOne)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        submit(partnerOne, eventId, firstBooth, null);

        insertRequest(applicationId, secondBooth, "REJECTED");
        submitExpecting(partnerOne, eventId, secondBooth,
                409, "BOOTH_REQUEST_RESUBMISSION_NOT_ALLOWED");
        insertRequest(applicationId, thirdBooth, "PAYMENT_EXPIRED");
        submit(partnerOne, eventId, thirdBooth, null);
    }

    @Test
    void partnerCanListFilterReadAndWithdrawOnlyOwnedRequests() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(1)), 2);
        long boothId = insertBooth("OWN", true);
        configure(eventId, boothId, true);
        approveApplication(partnerOne, eventId, "ACTIVE");
        approveApplication(partnerTwo, eventId, "ACTIVE");
        long firstId = submit(partnerOne, eventId, boothId, null);
        long secondId = submit(partnerTwo, eventId, boothId, null);

        mvc.perform(get("/api/v1/partner/booth-requests")
                        .param("eventId", Long.toString(eventId))
                        .param("status", "PENDING")
                        .param("sort", "boothCode,asc")
                        .with(partner(partnerOne)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].boothRequestId").value(firstId));
        mvc.perform(get("/api/v1/partner/booth-requests/{id}", firstId)
                        .with(partner(partnerOne)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boothCode").value(codePrefix + "OWN"));
        mvc.perform(get("/api/v1/partner/booth-requests/{id}", secondId)
                        .with(partner(partnerOne)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOTH_REQUEST_NOT_FOUND"));
        mvc.perform(post("/api/v1/partner/booth-requests/{id}/withdraw", secondId)
                        .with(partner(partnerOne)).with(csrf()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOTH_REQUEST_NOT_FOUND"));
    }

    @Test
    void partnerRoleVerifiedEmailValidationAndPaginationAreEnforced() throws Exception {
        long eventId = insertEvent("PUBLISHED", Instant.now().plus(Duration.ofDays(1)), 2);
        long boothId = insertBooth("AUTH", true);
        configure(eventId, boothId, true);
        approveApplication(partnerOne, eventId, "ACTIVE");
        String path = "/api/v1/events/" + eventId + "/booth-requests";

        mvc.perform(post(path).with(csrf()).contentType("application/json")
                        .content("{\"boothId\":" + boothId + "}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(path).with(identity(partnerOne, true, "ORGANIZER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"boothId\":" + boothId + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(post(path).with(identity(partnerOne, false, "PARTNER")).with(csrf())
                        .contentType("application/json")
                        .content("{\"boothId\":" + boothId + "}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(post(path).with(partner(partnerOne)).with(csrf())
                        .contentType("application/json").content("{}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/api/v1/partner/booth-requests")
                        .param("sort", "unknown,asc").with(partner(partnerOne)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"));
    }

    private long submit(Long partnerUserId, long eventId, long boothId, String note)
            throws Exception {
        String noteJson = note == null ? "null" : mapper.writeValueAsString(note);
        String response = mvc.perform(post("/api/v1/events/{eventId}/booth-requests", eventId)
                        .with(partner(partnerUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"boothId\":" + boothId + ",\"requestNote\":"
                                + noteJson + "}"))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.hold").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(response).get("boothRequestId").asLong();
    }

    private void submitExpecting(Long partnerUserId, long eventId, long boothId,
            int expectedStatus, String expectedCode) throws Exception {
        mvc.perform(post("/api/v1/events/{eventId}/booth-requests", eventId)
                        .with(partner(partnerUserId)).with(csrf())
                        .contentType("application/json")
                        .content("{\"boothId\":" + boothId + "}"))
                .andExpect(status().is(expectedStatus))
                .andExpect(jsonPath("$.code").value(expectedCode));
    }

    private long insertEvent(String status, Instant deadline, int quota) {
        Instant start = Instant.now().plus(Duration.ofDays(30));
        Instant end = start.plus(Duration.ofDays(2));
        return jdbc.queryForObject("""
                insert into events(
                    organizer_user_id, name, start_at, end_at,
                    booth_request_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner,
                    status, created_at, updated_at
                ) values (?, 'Request Test Event', ?, ?, ?, 1440, ?, 2, ?,
                    current_timestamp, current_timestamp)
                returning event_id
                """, Long.class, organizer, Timestamp.from(start), Timestamp.from(end),
                Timestamp.from(deadline), quota, status);
    }

    private long insertBooth(String suffix, boolean active) {
        long locationId = jdbc.queryForObject("""
                insert into locations(code, name, max_capacity, map_x, map_y,
                    is_active, location_type, created_at, updated_at)
                values (?, 'Request Booth', 8, 10, 20, ?, 'BOOTH',
                    current_timestamp, current_timestamp)
                returning location_id
                """, Long.class, codePrefix + suffix, active);
        jdbc.update("insert into booths(booth_id, category_code) values (?, 'PUBLISHER')",
                locationId);
        return locationId;
    }

    private long configure(long eventId, long boothId, boolean enabled) {
        return jdbc.queryForObject("""
                insert into event_booth_configs(event_id, booth_id, rental_price, is_enabled)
                values (?, ?, 2000000, ?) returning event_booth_config_id
                """, Long.class, eventId, boothId, enabled);
    }

    private long approveApplication(Long partnerUserId, long eventId, String organizationStatus) {
        return insertApplication(partnerUserId, eventId, "APPROVED", organizationStatus);
    }

    private long insertApplication(Long partnerUserId, long eventId, String status,
            String organizationStatus) {
        Long organizationId = jdbc.query("""
                select partner_organization_id from partner_organizations
                where representative_user_id = ?
                """, result -> result.next() ? result.getLong(1) : null, partnerUserId);
        if (organizationId == null) {
            organizationId = jdbc.queryForObject("""
                    insert into partner_organizations(
                        representative_user_id, name, category_code, status,
                        created_at, updated_at)
                    values (?, 'Request Partner', 'PUBLISHER', ?,
                        current_timestamp, current_timestamp)
                    returning partner_organization_id
                    """, Long.class, partnerUserId, organizationStatus);
        }
        return jdbc.queryForObject("""
                insert into partner_event_applications(
                    partner_organization_id, event_id, status, submitted_at, reviewed_at)
                values (?, ?, ?, current_timestamp, current_timestamp)
                returning application_id
                """, Long.class, organizationId, eventId, status);
    }

    private void insertActiveHold(long applicationId, long boothId, long configId) {
        long requestId = insertRequest(applicationId, boothId, "SELECTED");
        jdbc.update("""
                insert into booth_holds(event_booth_config_id, booth_request_id,
                    locked_rental_price, status, created_at, expires_at)
                values (?, ?, 2000000, 'ACTIVE', current_timestamp,
                    current_timestamp + interval '1 day')
                """, configId, requestId);
    }

    private long insertRequest(long applicationId, long boothId, String status) {
        return jdbc.queryForObject("""
                insert into booth_requests(application_id, booth_id, status, submitted_at)
                values (?, ?, ?, current_timestamp) returning booth_request_id
                """, Long.class, applicationId, boothId, status);
    }

    private int requestCount(long eventId) {
        return jdbc.queryForObject("""
                select count(*) from booth_requests request
                join partner_event_applications application
                  on application.application_id = request.application_id
                where application.event_id = ?
                """, Integer.class, eventId);
    }

    private Long insertUser(String label) {
        return jdbc.queryForObject("""
                insert into users(username, password_hash, full_name, email,
                    email_verified_at, status)
                values (?, ?, ?, ?, current_timestamp, 'ACTIVE') returning user_id
                """, Long.class,
                "request" + UUID.randomUUID().toString().replace("-", "").substring(0, 12),
                new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                label + " Request Test", UUID.randomUUID() + "@example.test");
    }

    private static RequestPostProcessor partner(Long id) {
        return identity(id, true, "PARTNER");
    }

    private static RequestPostProcessor identity(Long id, boolean verified, String role) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new Identity(id, verified), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    record Identity(Long userId, boolean emailVerified) implements AuthenticatedPrincipal {
    }
}
